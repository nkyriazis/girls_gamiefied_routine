---
name: lesson-package
description: Prepare a long-text lesson package (Ιστορία, Γεωγραφία, ΚΠΑ, Φυσικά…) from a chapter of the mirrored school books, for the kids' lessons library. Use when asked to "prepare", "make a lesson/package" for a chapter, or to change one.
---

# Lesson package: from a chapter of the book to a `.zip` for the library

A lesson is **content** (short pieces of the book's own sentences, its pictures, its hard words) and a **script**
(the steps the kid goes through, each a block of the library). You extract the content and **design the delivery**
for this chapter; the player and server only run the script. The format is `shared/lessons.ts` (types, checks);
`backend/lesson.schema.json` is its shape. Why the blocks are what they are: `docs/research/adhd-long-text-study.md`.
Every piece's text is **the book's own sentences**; hard words and hard sentences get help in place (`glossary`,
`easy`), never by rewriting the book. A parent imports the zip at /parent → Ρυθμίσεις → Μαθήματα → Εισαγωγή; the kids of that class find it under ✏️.

The kid it is for has ADHD and is 10. Everything below serves one aim: short reading, answered at once, feedback
that points back into the text, effort rewarded often, the body allowed to move, no clock, no lives, no penalties.

## Steps

1. **Find the chapter.** `materials/index/TOC.md` lists every book; `python3 -I` over `materials/index/passages.jsonl`
   (fields `id`, `loc` = «σελ. N», `text`) finds its pages. `loc` is the PDF's page, not the number printed on it.
   Use the student book (Βιβλίο Μαθητή); the teacher's book (Βιβλίο Εκπαιδευτικού) says the chapter's goals.
2. **Render the pages:** `tools/lessons/pages.sh <pdf> <first> <last> tools/lessons/work/<id>` writes
   `page-N.png` (150 dpi) and `page-N.txt`. **Read the images** (Read tool): the text file mixes captions,
   sources and footnotes into the main text; the image shows what belongs where. Take the spelling from the text.
3. **Write `tools/lessons/work/<id>/lesson.src.json`**: the lesson (below) and where its pictures come from. That
   file is your whole output; a script makes the package from it.
   - `book`: `{ "pdf": "<file under materials/pdf>", "from": <first PDF page>, "to": <last>, "firstPrinted": <the
     number printed on the first page> }`: the chapter's pages, shown in the `book` steps.
   - `pictures`: `{ "<name>": { "page": <PDF page>, "box": [x, y, w, h] } }`, the box in pixels of page-N.png (150
     dpi). Pick the pictures that carry meaning (a map, a diagram, a photo the text talks about), 1–3 a lesson. A
     piece's `image.file` or a `spot` question's `image` names one as `images/<name>.jpg`.
   - No `pages` and no `audio`: the build writes them.
4. **Build:** `tools/lessons/build.sh <id>` cuts the pictures and the pages, writes `package/lesson.json`, checks it
   exactly as the Pi will and against this skill's rules (`tools/lessons/test/check.mjs`: the shape, the book's own
   wording, the hard words, the questions), records the owl's voice for every new or changed line (GPU, minutes) and
   zips `tools/lessons/work/<id>.zip`. It stops at the first FAIL; fix the source and build again. A LOOK is a
   sentence that may not be the book's: look at the page; if it is yours, put the book's back; if it is the PDF's
   layout (a caption printed inside the sentence), say so to the owner. While you are still fixing, `--no-voice`
   skips the recording.
5. **Look at every picture** in `package/images/` (Read): it must hold the whole picture and nothing else. Fix its
   box and build again.
6. **Review with the owner:** show the pieces and the questions. Nothing a machine checks proves the history or
   geography right; the owner's eye does. If the owner wants to see it played, `tools/lessons/video.sh <id>` makes
   `tools/lessons/work/<id>.mp4` with no choices of yours (about 10 minutes, dev stack up); send that file. Don't
   write a scenario or drive the screen yourself.

`tools/lessons/work/` is git-ignored: the packages hold the book's text and pictures, and the repo is public.

## Content

- `id`: `<subject>-<grade letter>-<chapter>`, ascii, e.g. `istoria-e-14`, `geografia-e-26`, `kpa-e-a4`.
- `grade` 1–6 (Ε΄ = 5), `subject` as the book says («Ιστορία», «Γεωγραφία», «Κοινωνική και Πολιτική Αγωγή»),
  `icon` one emoji, `chapter`, `title` short (the chapter's own, shortened), `source`: book code, chapter, pages.
- **Pieces**: 2–4 sentences, at most ~70 words. **The book's own sentences**: you may cut a clause that only
  lists names nobody is asked about, or split a long sentence; never add facts. One idea a piece; 5–8 pieces a chapter.
  - `id` short (`p1`…), `title` 2–5 words saying what the piece is about.
  - `key`: the sentence that says what matters most; it is marked for her while she reads.
  - `glossary`: the words she would **stop at**, at most 4 a piece and about 3 a piece over the lesson: the book's
    footnotes first, then learned, old or technical words («μεταρρυθμίσεις», «λεηλάτησαν», «γόητρο», «εύφορα»).
    Not everyday words she knows («εμπόριο», «δόξα», «φόροι»), not names the text itself explains, not a word whose
    meaning the sentence already gives: glossing those buries the words that matter. A piece that needs more than 4
    is too hard for her: cut the hardest clause, or leave that passage out. Write each
    `term` **exactly as it is written in the sentence** (that form, that case: «λεηλάτησαν», not «λεηλατώ»): it is
    marked there with a dotted line and a tap says its `meaning`. The meaning: plain words she knows, short, for
    the word as it is used here («έβαλαν φωτιά», not a dictionary entry). pack refuses a term not in the text.
  - `easy`: for **every hard sentence** (long, learned words, an unusual order, an idea that needs unpacking), the
    same sentence said simply, keyed by its index: `{"0": "…", "2": "…"}`. A whole sentence or two, plain everyday
    Greek, the same facts, nothing added or left out that a question asks about. She taps «💡 Πιο απλά» to see and
    hear it under the book's sentence; the book's wording stays, so she learns its words with help. Easy sentences
    get none.
  - `image`: a picture the piece is about, with a short caption.
- **Sources** in the book (a quote in a box) may become a piece only if they are short and **as plain as the main
  text** (no more hard words than its pieces); most are not, so leave them, or put the book's question about one in
  `talk`. Quote a source as the book prints it, without words of yours around it («Ο Προκόπιος γράφει ότι…»).
- **Captions, tables and timelines stay what they are.** A caption goes with its picture (`image.caption`); a table or
  a timeline worth learning is cut as a picture and asked about (see Questions); never turned into a sentence of
  yours for a piece. The build's wording check flags such sentences.
- **The chapter's pages** run from its title to the page before the next chapter's title, with the pictures and
  sources on them; `book.from`/`to` cover all of them.
- **The book's open questions** («Πώς εξηγείτε…», «Τι θα κάνατε…») go in `talk`, for the parent, in the
  singular («Πώς εξηγείς…»).

## The blocks (`script`)

| Block | What it does | When |
|---|---|---|
| `intro` | title, how many pieces, what she earns | always first |
| `choose` | two ways to go on: `listen` (the owl reads every piece aloud, line by line) or `read` (alone, 🔊 per line) | right after intro; choice lowers refusal |
| `book` `when:"before"` | the chapter's real pages, to look through (title, pictures, length) | after choose: it ties the lesson to her book |
| `move` `warmup:true` `for:"adhd"` | get up first: 10 jumps, stretch… | before the first piece (exercise helps self-control) |
| `read` | one piece, its key sentence marked, hard words under it; in listen mode the owl reads it | every piece, once |
| `ask` | a question, the piece beside it (or, with `picture`, a picture of the book in its place); a wrong try lights the sentences in `evidence`; after 2 wrong the answer is shown and it moves on | 1–3 after each piece |
| `ask` + `think:"adhd"` | «answer in your head first», then the options appear | one in three questions, the easy ones (recall before recognition, against answering on impulse) |
| `move` `for:"adhd"` | a break between pieces | every 2–3 pieces |
| `explain` | say it in your own words to someone, with starters; «Το εξήγησα» | once or twice a lesson, after a piece with a cause or a why |
| `ask` + `review:true` | the review: questions across the chapter | 2–4 before the end |
| `book` `when:"after"` | the pages again: «find in the book what you learned» | right before `end` |
| `end` | her stars, play again | always last |

Questions (`ask.question.type`):
- `find-sentence` (tap the sentence; `main:true` for «which sentence says what matters most») — main ideas are what
  ADHD readers miss: put one `main:true` early, and one or two plain finds.
- `multiple-choice` (3 options, one right; the wrong ones from the same text, plausible, not silly), `true-false`,
  `fill-blank` (word bank with 1–2 extra words), `ordering` (3–5 events), `match-pairs` (3–4 pairs, short right sides).
- `sort` (cards into two boxes: then/now, cause/effect, natural/human…): for comparing.
- `spot` (tap the place on a picture; regions in % of the image): where on a picture something is. Draw the regions
  over the picture and look at them before you build: each covers its place, none overlap.
- **What the book shows besides its text is learning too**: photos, drawings, maps, diagrams, timelines, tables and
  their captions. Any question may ask what only they show (a people's land read off a map's labels, what a photo's
  people are doing, which comes first on a timeline, a row of a table), not just the text. Keep it on the chapter's
  subject, name in the question what to look at («Κοίτα τον χάρτη…», «Στη φωτογραφία…»), and make sure she sees it
  while answering: cut it into `pictures` and name it in the `ask` step's `"picture": "images/<name>.jpg"`, which shows
  it in place of the piece's text (a `spot` shows its own `image`). Such a question has no `evidence` (no sentence
  holds the answer); a wrong try says «κοίτα ξανά την εικόνα».
- Numbers in what the owl says (a move's «Κάνε 5 καθίσματα», a year) are fine as digits: the owl says them as words,
  and the voice check reads both the same.
- Every question but `find-sentence`, `spot` and review ordering/matching has `evidence`: the piece's sentence(s)
  that hold the answer. Every question names its `piece`.
- `star:true` on the last step of each piece, on each `explain`, and on the last review step: a star a piece.
- Ask about what the text says, about causes and order, about people and places. Not page-number trivia and not
  more than one number a lesson.

A good shape: `intro` → `choose` → `book(before)` → `move(warmup)` → [`read` → 1–3 `ask` (★ on the last)] × pieces, a `move`
every 2–3 pieces, an `explain` after the piece with the main why → 2–4 review `ask` (★ last) → `book(after)` → `end`.
Vary the question types across the lesson; use `sort` or `spot` where the chapter compares or shows.

### Two paths, one package: the ADHD mask

The same package plays two ways. A parent turns on «Μαθήματα: Με βοήθεια για ΔΕΠΥ» on a kid (Παιδιά); she plays the
**adhd** path, every other kid the **plain** one. Any step may carry `"for": "adhd"` or `"for": "plain"`; a step
without `for` is on both. `think` is `true` (both), `"adhd"` or `"plain"`. The pieces (the book's text) are the same on
both: only the steps around them are masked. You decide what differs for this chapter; the build checks each path is a
whole lesson of its own (every piece read and asked about, the review, the explain, a star a piece).

- Most of a lesson is good teaching for any child and goes unmasked: short pieces, a question after each, feedback that
  points into the text, hard words, «Πιο απλά», listen or read, the book's pages, the review, the explain.
- **adhd only:** the moves (the warm-up and the breaks) and `think`. These are for attention, impulse and restlessness;
  a plain reader takes them as interruptions. The build fails a plain path with a move or a think.
- **plain only, when it helps:** a question that asks for more at once, which the adhd path gets as two short ones
  (e.g. one `ordering` of the whole chapter for plain, where the adhd path has a shorter one after each half). Optional:
  most chapters need nothing here.
- Never mask a piece's `read`, the `intro`, `choose` or `end`, and keep a star a piece on both paths.

## Words (the kids' screens)

Greek, singular address, and the same to every child: no «έτοιμη/έτοιμος», no «ποια/ποιος» addressed to her
(«ποιο παιδί», or a verb), no gendered adjectives about her. Questions about people in the text may say «ποιος».
Short sentences; the words of the book.

## Example

`tools/lessons/work/istoria-e-14/lesson.src.json` (Ιστορία Ε΄, κεφ. 14, «Η στάση του νίκα»).
