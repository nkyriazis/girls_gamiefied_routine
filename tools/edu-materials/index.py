#!/usr/bin/env python3
"""Index the mirrored textbooks (see fetch.py) so relevant content can be found.

Commands:
  build     extract every interactive chapter page, PDF page and learning object into
            materials/index/passages.jsonl, write the contents file TOC.md, and build the
            full-text index index.db (SQLite FTS5)
  search    full-text search with filters, e.g.
              index.py search "δεδομένα ζητούμενα" -g K03 -s ΜΑΘΗΜΑΤΙΚΑ -k teacher

Greek-aware: accents and case are ignored, final ς matches σ, and words longer than four
letters also match their other endings (πρόβλημα finds προβλήματα). Put a word in quotes
inside the query ('"λύνω"') to match it exactly.

Runs in the edu-materials-tools image (python + poppler), see README.md.
"""
import argparse
import glob
import html
import json
import os
import re
import sqlite3
import subprocess
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get("MATERIALS_DIR", os.path.join(HERE, "../../materials"))
IDX = f"{OUT}/index"

GRADE_NAMES = {"K01": "Α'", "K02": "Β'", "K03": "Γ'", "K04": "Δ'", "K05": "Ε'", "K06": "ΣΤ'"}
KINDS = {  # filename marker -> kind
    "Vivlio-Mathiti": "student", "Tetradio-Ergasion": "workbook",
    "Vivlio-Ekpaideutikou": "teacher", "Vivlio-Ekaideutikou": "teacher",
}
KIND_NAMES = {
    "student": "Βιβλίο Μαθητή", "workbook": "Τετράδιο Εργασιών", "teacher": "Βιβλίο Εκπαιδευτικού",
    "interactive": "Εμπλουτισμένο βιβλίο", "reference": "Βοήθημα", "activity": "Μαθησιακό αντικείμενο",
}


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def read_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------- Greek text

def _fold(ch):
    base = unicodedata.normalize("NFD", ch)[0].lower()
    return "σ" if base == "ς" else base


_FOLD = {}


def fold(text):
    """Accent- and case-free copy of text, same length, so offsets carry over."""
    out = []
    for ch in text:
        f = _FOLD.get(ch)
        if f is None:
            f = _FOLD[ch] = _fold(ch) if len(_fold(ch)) == 1 else ch
        out.append(f)
    return "".join(out)


def _greek_ratio(s):
    letters = [c for c in s if c.isalpha()]
    return sum("Ͱ" <= c <= "Ͽ" or "ἀ" <= c <= "῿" for c in letters) / max(1, len(letters))


def fix_legacy_greek(page):
    """Older books use Mac Greek fonts without a Unicode map: poppler emits them as Mac Roman."""
    if _greek_ratio(page) > 0.3:
        return page
    out = []
    for ch in page:
        if ch == "¤":  # 0xDB: currency sign in old Mac Roman, έ in Mac Greek
            out.append("έ")
            continue
        try:
            out.append(ch.encode("mac_roman").decode("mac_greek"))
        except UnicodeError:
            out.append(ch)
    fixed = "".join(out)
    return fixed if _greek_ratio(fixed) > _greek_ratio(page) else page


def clean(text):
    text = re.sub(r"[ \t ]+", " ", text)
    text = re.sub(r"\.{4,}", "……", text)  # answer lines
    return re.sub(r"\s*\n\s*", "\n", text).strip()


# ---------------------------------------------------------------- interactive books

OPTION_RE = re.compile(r'<option\s+value="([^"]+)"[^>]*class="speech_menu_(\d+)"[^>]*>(.*?)</option>', re.S | re.I)


def html_text(t):
    b = t[t.find("<body"):] if "<body" in t else t
    b = re.sub(r"(?is)<(script|style|select|noscript)\b.*?</\1>", " ", b)
    b = re.sub(r'(?is)<div id="eclass_ebook_header".*?<div id="eclass_ebook_body"', " ", b, count=1)
    b = re.sub(r"(?i)<br\s*/?>|</(p|div|tr|li|h\d|table)>", "\n", b)
    b = re.sub(r"(?s)<[^>]+>", " ", b)
    return clean(html.unescape(b))


def book_toc(book_dir):
    """Contents from the player's section menu: units (not indented) and their chapters."""
    t = open(f"{book_dir}/index.html", encoding="utf-8", errors="replace").read()
    toc, unit = [], None
    for value, level, label in OPTION_RE.findall(t):
        indented = "&nbsp;" in label
        label = clean(html.unescape(re.sub(r"<[^>]+>", "", label)))
        if level == "0" and not indented:
            continue  # the book's own title
        if not indented:
            unit = {"title": label, "page": value, "chapters": []}
            toc.append(unit)
        else:
            if unit is None:
                unit = {"title": "", "page": value, "chapters": []}
                toc.append(unit)
            unit["chapters"].append({"title": label, "page": value})
    return toc


def lo_titles():
    titles = {}
    for p in glob.glob(f"{OUT}/photodentro/meta/*.json"):
        lo = read_json(p)
        md = lo["metadata"]
        titles[lo["id"]] = (md.get("lom.general-title") or md.get("dc.title") or [""])[0]
    return titles


PD_ID_RE = re.compile(r"/(\d{4})/(\d+)")


def interactive_passages(lo_title):
    manifests = sorted(glob.glob(f"{OUT}/interactive/*/_manifest.json"))
    tocs = {}
    for i, mp in enumerate(manifests, 1):
        man = read_json(mp)
        d = os.path.dirname(mp)
        slug = os.path.basename(d)
        book = man["book"]
        toc = book_toc(d)
        tocs[slug] = {"book": book, "toc": toc}
        where = {}
        for u in toc:
            where.setdefault(u["page"], (u["title"], ""))
            for c in u["chapters"]:
                where[c["page"]] = (u["title"], c["title"])
        log(f"[{i}/{len(manifests)}] interactive {slug}")
        for page in man["pages"]:
            if page == "index.html" and len(man["pages"]) > 1:
                pass  # the contents page is indexed too: it holds the book's introduction
            path = f"{d}/{page}"
            try:
                text = html_text(open(path, encoding="utf-8", errors="replace").read())
            except OSError:
                continue
            unit, chapter = where.get(page, ("", ""))
            los = []
            for u in man["photodentro"].get(page, []):
                m = PD_ID_RE.search(u)
                if m and "/seals/" not in u:
                    pid = f"{m[1]}/{m[2]}"
                    if pid not in los:
                        los.append(pid)
            yield {
                "id": f"html:{slug}/{page}", "source": "interactive", "kind": "interactive",
                "subject": subject(book["work"]), "grades": book["grades"], "book": slug,
                "unit": unit, "chapter": chapter, "loc": page,
                "path": os.path.relpath(path, OUT), "url": man["root"] + page,
                "activities": [{"id": p, "title": lo_title.get(p, "")} for p in los],
                "text": text,
            }
    write_json(f"{IDX}/toc.json", tocs)


# ---------------------------------------------------------------- PDFs

def subject(work):
    """Work title without the '(ΔΑΣΚΑΛΟΥ)' / '(ΤΕΤΡΑΔΙΟ ΕΡΓΑΣΙΩΝ)' part: the kind says that."""
    return re.sub(r"\s*\(.*?\)\s*$", "", work or "").strip()


def pdf_kind(name):
    for marker, kind in KINDS.items():
        if marker in name:
            return kind
    return "reference"


def pdf_passages(catalog):
    todo = [b for b in catalog if b["format"] == "pdf για web" and b["download_url"]]
    for i, b in enumerate(todo, 1):
        name = b["download_url"].rsplit("/", 1)[1]
        path = f"{OUT}/pdf/{name}"
        log(f"[{i}/{len(todo)}] pdf {name}")
        try:
            raw = subprocess.run(["pdftotext", "-q", path, "-"], capture_output=True, check=True).stdout
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            log(f"pdftotext failed for {name}: {e}")
            continue
        for n, page in enumerate(raw.decode("utf-8", "replace").split("\f"), 1):
            text = clean(fix_legacy_greek(page))
            if len(text) < 20:
                continue
            yield {
                "id": f"pdf:{name}#{n}", "source": "pdf", "kind": pdf_kind(name),
                "subject": subject(b["work"]), "grades": b["grades"], "book": name,
                "unit": "", "chapter": "", "loc": f"σελ. {n}",
                "path": f"pdf/{name}", "url": f"https://ebooks.edu.gr/ebooks{b['download_url']}#page={n}",
                "activities": [], "text": text,
            }


# ---------------------------------------------------------------- learning objects

def lo_passages(book_grades):
    files = sorted(glob.glob(f"{OUT}/photodentro/meta/*.json"))
    log(f"[0/{len(files)}] learning objects")
    for i, p in enumerate(files, 1):
        lo = read_json(p)
        md = lo["metadata"]
        g = lambda k: md.get(k) or []  # noqa: E731
        title = (g("lom.general-title") or g("dc.title") or [""])[0]
        grades = sorted({gr for u in lo["used_in"] for gr in book_grades.get(u["book"], [])})
        text = "\n".join([
            title, *g("lom.general-description"), "Λέξεις-κλειδιά: " + ", ".join(g("lom.general-keyword")),
            *g("lom.relation-isLinkedIn"),
        ])
        if i % 200 == 0 or i == len(files):
            log(f"[{i}/{len(files)}] learning objects")
        yield {
            "id": f"lo:{lo['id']}", "source": "photodentro", "kind": "activity",
            "subject": "", "grades": grades, "book": lo["used_in"][0]["book"] if lo["used_in"] else "",
            "unit": "", "chapter": title, "loc": lo["id"],
            "path": f"photodentro/meta/{os.path.basename(p)}",
            "url": f"https://photodentro.edu.gr/lor/r/{lo['id']}",
            "activities": [], "text": clean(text),
            "age": (g("lom.educational-rangeAge") or [""])[0],
            "used_in": lo["used_in"],
        }


# ---------------------------------------------------------------- build

def write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)


SCHEMA = """
CREATE TABLE passage (
  rowid INTEGER PRIMARY KEY, id TEXT UNIQUE, source TEXT, kind TEXT, subject TEXT,
  grades TEXT, book TEXT, unit TEXT, chapter TEXT, loc TEXT, path TEXT, url TEXT,
  activities TEXT, text TEXT
);
CREATE VIRTUAL TABLE passage_fts USING fts5(heading, body, tokenize = 'unicode61');
"""


def cmd_build(args):
    os.makedirs(IDX, exist_ok=True)
    catalog = read_json(f"{OUT}/catalog/catalog.json")
    lo_title = lo_titles()
    book_grades = {os.path.basename(os.path.dirname(m)): read_json(m)["book"]["grades"]
                   for m in glob.glob(f"{OUT}/interactive/*/_manifest.json")}
    subject_of = {os.path.basename(os.path.dirname(m)): subject(read_json(m)["book"]["work"])
                  for m in glob.glob(f"{OUT}/interactive/*/_manifest.json")}

    tmp = f"{IDX}/index.db.tmp"
    if os.path.exists(tmp):
        os.remove(tmp)
    db = sqlite3.connect(tmp)
    db.executescript(SCHEMA)
    n = 0
    with open(f"{IDX}/passages.jsonl", "w", encoding="utf-8") as out:
        sources = [interactive_passages(lo_title), pdf_passages(catalog), lo_passages(book_grades)]
        for src in sources:
            for p in src:
                if p["source"] == "photodentro":
                    p["subject"] = subject_of.get(p["book"], "")
                out.write(json.dumps(p, ensure_ascii=False) + "\n")
                heading = " ".join(x for x in (p["unit"], p["chapter"]) if x)
                db.execute(
                    "INSERT INTO passage (id, source, kind, subject, grades, book, unit, chapter, loc, path, url, activities, text)"
                    " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (p["id"], p["source"], p["kind"], p["subject"], " ".join(p["grades"]), p["book"],
                     p["unit"], p["chapter"], p["loc"], p["path"], p["url"],
                     json.dumps(p["activities"], ensure_ascii=False), p["text"]))
                db.execute("INSERT INTO passage_fts (rowid, heading, body) VALUES (last_insert_rowid(), ?, ?)",
                           (fold(heading), fold(p["text"])))
                n += 1
    db.commit()
    db.execute("INSERT INTO passage_fts(passage_fts) VALUES ('optimize')")
    db.commit()
    db.close()
    os.replace(tmp, f"{IDX}/index.db")
    write_toc(read_json(f"{IDX}/toc.json"), catalog)
    log(f"build: {n} passages indexed in {IDX}/index.db")


def write_toc(tocs, catalog):
    by_grade = {}
    for slug, t in tocs.items():
        for g in t["book"]["grades"]:
            by_grade.setdefault(g, []).append((subject(t["book"]["work"]), slug, t["toc"]))
    los = {}
    for p in glob.glob(f"{OUT}/photodentro/meta/*.json"):
        lo = read_json(p)
        for u in lo["used_in"]:
            los.setdefault((u["book"], u["page"]), set()).add(lo["id"])
    lo_title = lo_titles()
    pdfs = {}
    for b in catalog:
        if b["format"] == "pdf για web" and b["download_url"]:
            for g in b["grades"]:
                pdfs.setdefault((g, subject(b["work"])), []).append(b["download_url"].rsplit("/", 1)[1])
    lines = ["# Περιεχόμενα σχολικών βιβλίων Δημοτικού", "",
             "Generated by `tools/edu-materials/index.py build`. Chapters link to the local "
             "interactive pages; 🧩 marks learning objects (Photodentro) used in that chapter.", ""]
    for g in sorted(by_grade):
        lines += [f"## {GRADE_NAMES[g]} Δημοτικού", ""]
        for work, slug, toc in sorted(by_grade[g]):
            lines += [f"### {work.title()}", ""]
            for f in sorted(pdfs.get((g, work), [])):
                lines.append(f"- PDF ({KIND_NAMES[pdf_kind(f)]}): [`{f}`](../pdf/{f})")
            lines.append("")
            for u in toc:
                indent = "  " if u["title"] else ""
                if u["title"]:
                    lines.append(f"- **{u['title']}**")
                for c in u["chapters"]:
                    ids = sorted(los.get((slug, c["page"]), []))
                    acts = "; ".join(lo_title.get(i, i) for i in ids[:6])
                    more = f" (+{len(ids) - 6})" if len(ids) > 6 else ""
                    lines.append(f"{indent}- [{c['title']}](../interactive/{slug}/{c['page']})"
                                 + (f" 🧩 {acts}{more}" if ids else ""))
            lines.append("")
    with open(f"{IDX}/TOC.md", "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


# ---------------------------------------------------------------- search

WORD_RE = re.compile(r'"[^"]+"|[^\s"]+')
# Inflection endings (folded), longest first. Stripping one and matching the stem as a
# prefix finds the other forms: δεδομένα -> δεδομεν* (δεδομένων, δεδομένο).
ENDINGS = sorted(["ουσ", "εισ", "ων", "ου", "οσ", "ησ", "ασ", "εσ", "οι", "ει", "αι", "ια",
                  "α", "ο", "η", "ε", "ι", "υ", "ω"], key=len, reverse=True)


def stem(w):
    for e in ENDINGS:
        if w.endswith(e) and len(w) - len(e) >= 4:
            return w[:-len(e)]
    return w


def fts_query(q, heading=False):
    terms = []
    for w in WORD_RE.findall(q):
        if w.startswith('"'):
            terms.append('"' + fold(w.strip('"')).replace('"', "") + '"')
            continue
        w = re.sub(r"[^\w]", "", fold(w))
        if w:
            terms.append(f'"{stem(w)}"*')
    q = " ".join(terms)
    return f"heading : ({q})" if heading and q else q


def snippets(text, query, width=90, most=3):
    folded = fold(text)
    stems = [re.escape(t.strip('"*')) for t in fts_query(query).split()]
    if not stems:
        return []
    out, last = [], -1
    for m in re.finditer("|".join(stems), folded):
        if m.start() < last:
            continue
        a, b = max(0, m.start() - width), min(len(text), m.end() + width)
        out.append(("…" if a else "") + text[a:b].replace("\n", " ") + ("…" if b < len(text) else ""))
        last = b
        if len(out) == most:
            break
    return out


def cmd_search(args):
    db = sqlite3.connect(f"{IDX}/index.db")
    where, params = ["passage_fts MATCH ?"], [fts_query(args.query, args.heading)]
    if args.grade:
        where.append("(' ' || p.grades || ' ') LIKE ?"); params.append(f"% {args.grade} %")
    if args.subject:
        where.append("p.subject LIKE ?"); params.append(f"%{args.subject}%")
    if args.kind:
        where.append("p.kind IN (%s)" % ",".join("?" * len(args.kind))); params += args.kind
    sql = ("SELECT p.id, p.kind, p.subject, p.grades, p.book, p.unit, p.chapter, p.loc, p.path, p.text,"
           " p.activities, bm25(passage_fts, 5.0, 1.0) AS score"
           " FROM passage_fts JOIN passage p ON p.rowid = passage_fts.rowid"
           f" WHERE {' AND '.join(where)} ORDER BY score LIMIT ?")
    rows = db.execute(sql, params + [args.limit]).fetchall()
    if args.json:
        print(json.dumps([dict(zip(["id", "kind", "subject", "grades", "book", "unit", "chapter", "loc", "path",
                                    "snippets", "activities", "score"],
                                   [*r[:9], snippets(r[9], args.query), json.loads(r[10]), r[11]])) for r in rows],
                         ensure_ascii=False, indent=1))
        return
    for r in rows:
        _, kind, subject, grades, book, unit, chapter, loc, path, text, acts, score = r
        grades = ",".join(GRADE_NAMES.get(g, g) for g in grades.split())
        where_ = " › ".join(x for x in (unit, chapter) if x) or book
        print(f"\n[{grades}] {subject.title()} · {KIND_NAMES.get(kind, kind)} · {where_} · {loc}")
        print(f"  materials/{path}")
        for s in snippets(text, args.query):
            print(f"  » {s}")
        acts = json.loads(acts)
        if acts:
            print("  🧩 " + "; ".join(a["title"] or a["id"] for a in acts[:5]))
    print(f"\n{len(rows)} results", file=sys.stderr)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("build")
    s = sub.add_parser("search")
    s.add_argument("query")
    s.add_argument("-g", "--grade", choices=list(GRADE_NAMES), help="K01..K06")
    s.add_argument("-s", "--subject", help="e.g. ΜΑΘΗΜΑΤΙΚΑ (substring of the work title)")
    s.add_argument("-k", "--kind", action="append",
                   choices=["interactive", "student", "workbook", "teacher", "reference", "activity"])
    s.add_argument("-n", "--limit", type=int, default=15)
    s.add_argument("-H", "--heading", action="store_true", help="match unit/chapter titles only")
    s.add_argument("--json", action="store_true")
    a = ap.parse_args()
    {"build": cmd_build, "search": cmd_search}[a.cmd](a)
