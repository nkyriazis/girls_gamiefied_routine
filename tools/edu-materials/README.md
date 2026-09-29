# edu-materials: local mirror of the primary-school textbooks

`fetch.py` mirrors the official Greek primary-school textbooks (Α'–ΣΤ' Δημοτικού) from
[ebooks.edu.gr](https://ebooks.edu.gr) (ΙΤΥΕ «Διόφαντος», Ψηφιακό Σχολείο), plus the
Photodentro learning objects the interactive books link to, into `materials/` at the repo
root. The goal is to study the material and derive exercise generators from it.

`materials/` is in `.gitignore` and `.dockerignore` (the Docker build context is the repo
root, so without the second entry every image build would upload it). It is about 18 GB and
never goes into git or the images.

## Reproduce from scratch

```bash
tools/edu-materials/mirror.sh            # fetch what is missing, verify, index
tools/edu-materials/mirror.sh --index    # rebuild the index only
```

`mirror.sh` builds the tools image (`Dockerfile`: Python + poppler), then runs every stage
below in it at a gentle pace, and finally `index.py build`. Nothing is installed on the host.
Each stage's full output goes to `materials/logs/<stage>.log`. When the Claude Code `flow`
helper is installed, progress shows in the status line; otherwise it prints to stderr.

It is resumable: finished files are skipped (PDFs by size, books by their `_manifest.json`,
learning objects by their metadata file), so rerunning retries only what failed. From
scratch it takes a few hours; with everything in place, a few minutes plus the index.

What a complete run produced on 2026-09-26 (use it to judge a new run):

| | Count | Size |
|---|---|---|
| Catalog | 619 manifestations for K01–K06 | |
| Interactive books | 40 books, 1,838 pages (≈300 URLs 404 on the site itself) | 2.0 GB |
| PDFs (`pdf για web`) | 172 | 2.4 GB |
| Learning objects linked from the books | 2,233: 1,959 with metadata, 274 never migrated | |
| Learning-object packages | 1,937 (22 Flash-only skipped) | 14 GB |
| Index | 21,448 passages | 250 MB |

Lessons from the first run:
- **Keep concurrency low and never run two mirrors at once.** Photodentro's old short links
  (`photodentro.edu.gr/lor/r/<id>`) go through a redirector on `lor.photodentro.edu.gr` that
  answers 502 about half the time under load, while its REST API is reliable. The fetcher
  retries each redirect up to 12 times with growing waits, `mirror.sh` runs repeated passes,
  and a lock file stops a second run.
- **Objects that redirect to the home page were never migrated.** They are recorded once in
  `photodentro/missing/` and skipped on later passes.
- **Don't trust the MD5s and sizes in the upload notes** (`files` in the catalog). They
  describe each file's first upload, and most books were replaced since. The catalog's
  `size` is current: downloads are skipped by it, and `verify` checks it plus a complete
  PDF trailer.
- **Crawl the interactive books.** Some have a zip in the repository, some don't, and the
  zip links return an HTML page. Query strings are dropped when saving (the geography map
  widget is linked hundreds of times with different parameters).
- **Don't filter learning objects by format tag.** 868 objects have none, and most of those
  are HTML5 packages; only objects known to need Flash are skipped.

## Stages

`fetch.py` uses only the standard library. To run a single stage by hand:

```bash
docker run --rm -u $(id -u):$(id -g) -v "$PWD":/w -w /w edu-materials-tools \
  python tools/edu-materials/fetch.py photodentro -j 2
```

`-j N` sets parallel downloads (default 4; `mirror.sh` uses 2, and 3 for PDFs). Keep it low;
this is a public service.

| Stage | What it does |
|---|---|
| `catalog` | Lists every manifestation of grades K01–K06 through the JSON endpoint the site's own pages call (`/ebooks/rest/get-items-info-2`). Books shared between grades (e.g. Γ'–Δ' Μουσική) are kept once, with all their `grades` |
| `interactive` | Crawls each "εμπλουτισμένη html" book from its viewer (`/ebooks/v/html/8547/<id>/<slug>/`): every chapter page listed in the book's section menu, plus the images, css and scripts they use. Not every book has a zip download, so crawling is the one method that works for all of them |
| `photodentro` | For every `photodentro.edu.gr` link in those pages, stores the learning object's LOM metadata and file list from the new repository's DSpace 7 API (`lor.photodentro.edu.gr/server/api`) |
| `lo-files` | Downloads each object's package (usually a zip). Only objects known to need Flash are skipped; many objects have no format tag, and those are mostly HTML5 |
| `pdf` | Downloads the plain "pdf για web" books: Βιβλίο Μαθητή, Τετράδιο Εργασιών, Βιβλίο Εκπαιδευτικού |
| `verify` | Checks every PDF against the catalog's current size and for a complete PDF trailer. (The MD5s in the upload notes describe the first upload; most books were replaced since.) |

Deliberately not fetched: the large-print PDFs (18–36pt), iBooks and the Magic Book DVD zips
(6.4 GB of English-course media).

## Layout

```
materials/
  catalog/catalog.json          one entry per manifestation: work, format, grades, size, urls, files+md5
  catalog/raw/K0?.json          raw endpoint answers
  pdf/<code>_<Subject>_<Grade>_<Kind>.pdf
  interactive/<slug>/           the book as served; open index.html in a browser
  interactive/<slug>/_manifest.json   chapter pages, photodentro links per page, failed urls
  photodentro/meta/8521_<n>.json      title, description, keywords, age range, formats, licence, used_in
  photodentro/files/8521_<n>/*.zip
  photodentro/missing/8521_<n>.json   linked objects that were never moved to the new repository
  index/                        see Index below
  logs/                         one log per stage from the last mirror.sh run
```

The interactive chapters are plain HTML text (exercises, "μαθαίνω" boxes, teacher notes),
so they are the easiest source to mine. The PDFs cover the same books plus the workbooks and
teacher's books.

## Index

`index.py` turns the mirror into something searchable (`mirror.sh` runs `build` at the
end). It needs `pdftotext`, so it runs in the tools image:

```bash
docker build -t edu-materials-tools tools/edu-materials
R="docker run --rm -u $(id -u):$(id -g) -v $PWD:/w -w /w edu-materials-tools python tools/edu-materials/index.py"
$R build                                                   # ~21,000 passages, a few minutes
$R search "δεδομένα ζητούμενα" -g K05 -s ΜΑΘΗΜΑΤΙΚΑ -k teacher
$R search "πρόβλημα" -H -g K03 -s ΜΑΘΗΜΑΤΙΚΑ                # chapter titles only
$R search '"τι γνωριζουμε"' -s ΜΑΘΗΜΑΤΙΚΑ --json             # exact phrase, JSON out
```

`build` writes to `materials/index/`:

| File | Contents |
|---|---|
| `TOC.md` | Contents per grade → subject → unit → chapter, with links to the local pages, the PDFs of that subject, and the learning objects (🧩) each chapter uses |
| `index.db` | SQLite FTS5 index. One passage per interactive chapter page, PDF page and learning object, with grade, subject, kind (`interactive`, `student`, `workbook`, `teacher`, `reference`, `activity`), unit, chapter and location |
| `passages.jsonl` | The same passages as JSON lines, for scripts |
| `toc.json` | The contents of every interactive book, as read from its section menu |

Search ignores accents and case, treats ς as σ, and strips Greek inflection endings, so
`πρόβλημα` also finds `προβλήματα`. Quote a word or phrase to match it exactly. `-g`
takes the grade code (K01 = Α' … K06 = ΣΤ'), `-s` a substring of the subject.

Notes:
- PDF pages are numbered as in the file, which is usually one or two ahead of the number
  printed on the page.
- Older PDFs use Mac Greek fonts without a Unicode map; the indexer detects such pages and
  converts them. A few books use yet another font encoding (e.g. Β' Μελέτη Περιβάλλοντος,
  teacher's book) and stay unreadable; picture-only pages have no text either.

## Licence

The site's [licence page](https://ebooks.edu.gr/ebooks/feedback/licenses.jsp) allows
teachers and students to copy, print, download and store the books locally for educational
use. The Photodentro objects are CC BY-NC-SA 3.0 GR (see each `photodentro/meta` file).
Keep the mirror for the family's own non-commercial use and credit the source.
