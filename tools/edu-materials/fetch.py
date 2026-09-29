#!/usr/bin/env python3
"""Mirror the primary-school textbooks of ebooks.edu.gr (ΙΤΥΕ Διόφαντος) locally.

Stages (each resumable, run any subset):
  catalog      query ebooks.edu.gr for every manifestation of grades K01-K06
  pdf          download the plain "pdf για web" books (student, workbook, teacher)
  interactive  crawl the "εμπλουτισμένη html" books page by page, with their assets
  photodentro  fetch metadata for the Photodentro learning objects the books link to
  lo-files     download the HTML5 learning-object packages (zip) found by photodentro

Standard library only; run it in a container (see README.md).
"""
import argparse
import concurrent.futures as cf
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = "https://ebooks.edu.gr/ebooks"
LOR = "https://lor.photodentro.edu.gr"
GRADES = ["K01", "K02", "K03", "K04", "K05", "K06"]
UA = "girls-gamified-routine materials mirror (personal, non-commercial)"
DELAY = 0.2  # seconds between requests per worker

OUT = os.environ.get("MATERIALS_DIR", os.path.join(os.path.dirname(__file__), "../../materials"))


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def get(url, *, tries=4, timeout=120):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                data = r.read()
                time.sleep(DELAY)
                return data, r.geturl(), r.headers.get("Content-Type", "")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                raise
            err = e
        except Exception as e:  # noqa: BLE001 - network flakiness of any kind
            err = e
        time.sleep(2 ** i)
    raise err


def download(url, path, size=None):
    """Download url to path unless it is already there (with the expected size)."""
    if os.path.exists(path) and (size is None or os.path.getsize(path) == size):
        return "skip"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    data, _, _ = get(url, timeout=600)
    tmp = path + ".part"
    with open(tmp, "wb") as f:
        f.write(data)
    os.replace(tmp, path)
    return "ok"


def write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)


def read_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------- catalog

CATALOG_ELEMENTS = [
    "title", "identifier", "classification-digitalExpression", "technical-size",
    "technical-location", "relation-hasThumbnail", "description",
]


def catalog_url(grade):
    q = [
        ("query_field[]", "course.lom.classification-grade"),
        ("query_field[]", "manifestation.lom.lifecycle-status"),
        ("query_op[]", "equals"), ("query_op[]", "equals"),
        ("query_val[]", grade), ("query_val[]", "1"),
        ("limit", "-1"), ("offset", "0"), ("expand", "all,metadata"), ("filters", "none"),
        ("selected_columns", "m1.*"),
        ("selected_elements", ",".join(f"'{e}'" for e in CATALOG_ELEMENTS)),
        ("selected_collections", "'course','work','expression','manifestation'"),
        ("elements_to_get_stored_val", "classification-digitalExpression"),
    ]
    return f"{BASE}/rest/get-items-info-2?" + urllib.parse.urlencode(q)


FILE_RE = re.compile(r"^(.+?): (\d+) bytes, checksum: ([0-9a-f]{32}) \(MD5\)$", re.M)


def normalize(raw):
    md = {}
    for m in raw["metadata"]:
        md.setdefault(m["key"], []).append(m["value"])
    one = lambda k: (md.get(k) or [None])[0]  # noqa: E731
    files = {}
    for p in md.get("manifestation.dc.description.provenance", []):
        for name, size, md5 in FILE_RE.findall(p):
            files[name] = {"size": int(size), "md5": md5}
    return {
        "uuid": raw["manifestation_UUID"],
        "handle": one("manifestation.dc.identifier.uri"),
        "work": one("work.dc.title"),
        "work_handle": one("work.dc.identifier.uri"),
        "expression_handle": one("expression.dc.identifier.uri"),
        "title": one("manifestation.dc.title"),
        "format": one("expression.lom.classification-digitalExpression"),
        "size": int(one("manifestation.lom.technical-size") or 0),
        "download_url": raw.get("manifestation_download_url"),
        "view_url": raw.get("manifestation_view_url"),
        "files": files,
    }


def stage_catalog(args):
    books = {}
    for g in GRADES:
        data, _, _ = get(catalog_url(g))
        raw = json.loads(data)
        write_json(f"{OUT}/catalog/raw/{g}.json", raw)
        for r in raw:
            b = normalize(r)
            books.setdefault(b["uuid"], {**b, "grades": []})["grades"].append(g)
        log(f"catalog {g}: {len(raw)} manifestations")
    books = sorted(books.values(), key=lambda b: (b["grades"][0], b["work"] or "", b["format"] or ""))
    write_json(f"{OUT}/catalog/catalog.json", books)
    log(f"catalog: {len(books)} unique manifestations")


def catalog():
    return read_json(f"{OUT}/catalog/catalog.json")


# ---------------------------------------------------------------- pdf

def stage_pdf(args):
    todo = [b for b in catalog() if b["format"] == "pdf για web" and b["download_url"]]
    total = sum(b["size"] for b in todo)
    log(f"pdf: {len(todo)} files, {total / 1e9:.2f} GB")

    def one(b):
        name = urllib.parse.unquote(b["download_url"].rsplit("/", 1)[1])
        # The catalog's size is the current file's; the upload notes in `files` describe the
        # first upload and are stale for most books.
        size = b["size"] or b["files"].get(name, {}).get("size") or None
        return name, download(BASE + b["download_url"], f"{OUT}/pdf/{name}", size)

    with cf.ThreadPoolExecutor(args.jobs) as ex:
        for i, fut in enumerate(cf.as_completed([ex.submit(one, b) for b in todo]), 1):
            try:
                name, st = fut.result()
                log(f"pdf [{i}/{len(todo)}] {st} {name}")
            except Exception as e:  # noqa: BLE001
                log(f"pdf [{i}/{len(todo)}] FAILED {e}")


# ---------------------------------------------------------------- interactive

ATTR_RE = re.compile(r"""(?:src|href|data|poster|data-src)\s*=\s*["']([^"'#]+)""", re.I)
CSSURL_RE = re.compile(r"""url\(\s*["']?([^"')]+)""", re.I)
OPTION_RE = re.compile(r"""<option\s+value=["']([^"']+\.html?)["']""", re.I)
PHOTODENTRO_RE = re.compile(r"""https?://photodentro\.edu\.gr/[^"'\s<>]+""", re.I)


def local_refs(text, page_url, root):
    refs = set()
    for m in ATTR_RE.findall(text) + CSSURL_RE.findall(text):
        m = html.unescape(m.strip())
        if m.startswith(("javascript:", "mailto:", "data:")):
            continue
        # Query strings only parametrize widgets (e.g. the geography map page); keep one copy.
        u = urllib.parse.urljoin(page_url, m).split("#")[0].split("?")[0]
        if u.startswith(root):
            refs.add(u)
    return refs


def crawl_book(b):
    root = BASE + b["view_url"]
    if not root.endswith("/"):
        root += "/"
    slug = root.rstrip("/").rsplit("/", 1)[1]
    dest = f"{OUT}/interactive/{slug}"
    manifest_path = f"{dest}/_manifest.json"
    if os.path.exists(manifest_path):
        return slug, "skip"
    seen, queue, pages, links, failed = set(), [root + "index.html"], [], {}, []
    while queue:
        u = queue.pop()
        if u in seen:
            continue
        seen.add(u)
        if len(seen) % 10 == 0:
            log(f"interactive-files {slug} {len(seen)} files")
        rel = urllib.parse.unquote(u[len(root):]) or "index.html"
        path = os.path.join(dest, rel)
        try:
            if os.path.exists(path):
                with open(path, "rb") as f:
                    data = f.read()
            else:
                data, _, _ = get(u)
                os.makedirs(os.path.dirname(path), exist_ok=True)
                with open(path, "wb") as f:
                    f.write(data)
        except Exception as e:  # noqa: BLE001
            failed.append({"url": u, "error": str(e)})
            continue
        low = rel.lower()
        if low.endswith((".html", ".htm", ".css")):
            text = data.decode("utf-8", "replace")
            queue.extend(local_refs(text, u, root) - seen)
            if low.endswith((".html", ".htm")):
                pages.append(rel)
                queue.extend(urllib.parse.urljoin(u, o) for o in OPTION_RE.findall(text))
                pd = sorted(set(PHOTODENTRO_RE.findall(text)))
                if pd:
                    links[rel] = pd
    write_json(manifest_path, {
        "book": b, "root": root, "pages": sorted(pages), "photodentro": links, "failed": failed,
    })
    return slug, f"ok ({len(seen)} files, {len(failed)} failed)"


def stage_interactive(args):
    todo = [b for b in catalog() if b["format"] == "εμπλουτισμένη html" and b["view_url"]]
    log(f"interactive: {len(todo)} books")
    with cf.ThreadPoolExecutor(args.jobs) as ex:
        for i, fut in enumerate(cf.as_completed([ex.submit(crawl_book, b) for b in todo]), 1):
            try:
                slug, st = fut.result()
                log(f"interactive [{i}/{len(todo)}] {st} {slug}")
            except Exception as e:  # noqa: BLE001
                log(f"interactive [{i}/{len(todo)}] FAILED {e}")


# ---------------------------------------------------------------- photodentro

PD_ID_RE = re.compile(r"/(\d{4})/(\d+)")


def photodentro_ids():
    ids = {}
    base = f"{OUT}/interactive"
    for slug in sorted(os.listdir(base)):
        mp = f"{base}/{slug}/_manifest.json"
        if not os.path.exists(mp):
            continue
        for page, urls in read_json(mp)["photodentro"].items():
            for u in urls:
                m = PD_ID_RE.search(u)
                if m and "/seals/" not in u:
                    ids.setdefault(f"{m[1]}/{m[2]}", []).append({"book": slug, "page": page, "url": u})
    return ids


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **kw):
        return None


_no_redirect = urllib.request.build_opener(_NoRedirect)


def resolve_lo(pid):
    """Follow the old short link's redirects up to the item UUID on the new repository.

    Only the Location headers are read: the item page at the end of the chain often
    answers 502, while the redirects and the REST API behind it work.
    """
    url = f"https://photodentro.edu.gr/lor/r/{pid}"
    for _ in range(6):
        m = re.search(r"/items/([0-9a-f-]{36})", url)
        if m:
            return m[1]
        url = _next_hop(url)
        if url is None:
            break
        time.sleep(DELAY)
    # Objects that were never migrated redirect to the repository's home page.
    raise NotMigrated(f"no item uuid for {pid} ({url})")


class NotMigrated(RuntimeError):
    pass


def _next_hop(url, tries=12):
    """Location of one redirect; the redirector answers 502 about half the time, so retry."""
    for i in range(tries):
        req = urllib.request.Request(url, headers={"User-Agent": UA}, method="HEAD")
        try:
            with _no_redirect.open(req, timeout=60):
                return None  # a 2xx: no further redirect
        except urllib.error.HTTPError as e:
            loc = e.headers.get("Location")
            if e.code in (301, 302, 303, 307, 308) and loc:
                return urllib.parse.urljoin(url, loc)
            if e.code < 500 or i == tries - 1:
                raise
        except (urllib.error.URLError, TimeoutError):
            if i == tries - 1:
                raise
        time.sleep(min(1.5 * (i + 1), 10))


def fetch_lo(pid, refs):
    path = f"{OUT}/photodentro/meta/{pid.replace('/', '_')}.json"
    missing = f"{OUT}/photodentro/missing/{pid.replace('/', '_')}.json"
    if os.path.exists(path) or os.path.exists(missing):
        return pid, "skip"
    try:
        uuid = resolve_lo(pid)
    except NotMigrated as e:
        write_json(missing, {"id": pid, "used_in": refs, "error": str(e)})
        return pid, "missing"
    item = json.loads(get(f"{LOR}/server/api/core/items/{uuid}")[0])
    bitstreams = []
    bundles = json.loads(get(f"{LOR}/server/api/core/items/{uuid}/bundles")[0])
    for bu in bundles.get("_embedded", {}).get("bundles", []):
        bs = json.loads(get(bu["_links"]["bitstreams"]["href"])[0])
        for s in bs.get("_embedded", {}).get("bitstreams", []):
            bitstreams.append({
                "bundle": bu["name"], "name": s["name"], "size": s.get("sizeBytes"),
                "md5": (s.get("checkSum") or {}).get("value"),
                "href": s["_links"]["content"]["href"],
            })
    md = {k: [v["value"] for v in vs] for k, vs in item.get("metadata", {}).items()}
    write_json(path, {"id": pid, "uuid": uuid, "used_in": refs, "metadata": md, "bitstreams": bitstreams})
    return pid, "ok"


def stage_photodentro(args):
    ids = photodentro_ids()
    log(f"photodentro: {len(ids)} learning objects linked from the books")
    with cf.ThreadPoolExecutor(args.jobs) as ex:
        futs = {ex.submit(fetch_lo, pid, refs): pid for pid, refs in ids.items()}
        for i, fut in enumerate(cf.as_completed(futs), 1):
            try:
                pid, st = fut.result()
                log(f"photodentro [{i}/{len(ids)}] {st} {pid}")
            except Exception as e:  # noqa: BLE001
                log(f"photodentro [{i}/{len(ids)}] FAILED {futs[fut]}: {e}")


def stage_lo_files(args):
    base = f"{OUT}/photodentro/meta"
    todo = []
    for fn in sorted(os.listdir(base)):
        lo = read_json(f"{base}/{fn}")
        md = lo["metadata"]
        # Many objects carry no format tag at all; most of those are HTML5 zips, so only
        # skip what is known to need Flash, which no longer runs anywhere.
        kinds = " ".join(md.get("dc.typos-arxeiou", [])).lower()
        for s in lo["bitstreams"]:
            if s["bundle"] != "ORIGINAL":
                continue
            if s["name"].lower().endswith(".swf") or md.get("dc.flash-required") == ["1"] \
                    or (kinds and "html" not in kinds):
                continue
            todo.append((lo["id"], s))
    total = sum(s["size"] or 0 for _, s in todo)
    log(f"lo-files: {len(todo)} files, {total / 1e9:.2f} GB")

    def one(pid, s):
        path = f"{OUT}/photodentro/files/{pid.replace('/', '_')}/{s['name']}"
        return download(s["href"], path, s["size"]), path

    with cf.ThreadPoolExecutor(args.jobs) as ex:
        futs = [ex.submit(one, pid, s) for pid, s in todo]
        for i, fut in enumerate(cf.as_completed(futs), 1):
            try:
                st, path = fut.result()
                log(f"lo-files [{i}/{len(todo)}] {st} {path[len(OUT):]}")
            except Exception as e:  # noqa: BLE001
                log(f"lo-files [{i}/{len(todo)}] FAILED {e}")


# ---------------------------------------------------------------- verify

def stage_verify(args):
    """Check the PDFs against the catalog's current size and for a complete PDF trailer.

    The MD5s in the provenance notes describe the first upload; most books were replaced
    since, so they don't match what is served today and aren't used here.
    """
    bad = 0
    for b in catalog():
        if b["format"] != "pdf για web" or not b["download_url"]:
            continue
        name = urllib.parse.unquote(b["download_url"].rsplit("/", 1)[1])
        path = f"{OUT}/pdf/{name}"
        if not os.path.exists(path):
            log(f"missing {name}"); bad += 1
            continue
        with open(path, "rb") as f:
            head = f.read(5)
            f.seek(max(0, os.path.getsize(path) - 2048))
            tail = f.read()
        if b["size"] and os.path.getsize(path) != b["size"]:
            log(f"size mismatch {name}"); bad += 1
        elif head != b"%PDF-" or b"%%EOF" not in tail:
            log(f"truncated or not a pdf {name}"); bad += 1
    log(f"verify: {bad} problems")


STAGES = {
    "catalog": stage_catalog, "pdf": stage_pdf, "interactive": stage_interactive,
    "photodentro": stage_photodentro, "lo-files": stage_lo_files, "verify": stage_verify,
}

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("stages", nargs="+", choices=list(STAGES))
    ap.add_argument("-j", "--jobs", type=int, default=4)
    a = ap.parse_args()
    for s in a.stages:
        STAGES[s](a)
