# Brief: write the lesson's source

You write one file, `tools/lessons/work/<id>/lesson.src.json`, from the chapter's pages. Scripts do the rest. To
check yourself run `tools/lessons/build.sh <id> --no-voice` (always with `--no-voice`); a line that doesn't pass
says what to do. Counts and shape are checked there, so this brief is about what only you can judge.

**For whom.** A girl of 10 with ADHD. Short reading, answered at once, feedback that points back into the text,
effort rewarded often, the body allowed to move. Each rule carries its why; break one "just this once" and the
lesson stops doing its job (`docs/research/adhd-long-text-study.md`).

**Never**, in anything you write: a timer, a countdown or a race; lives or anything she can lose; a wait after a
wrong answer; streaks or combos; a long block of text.

**Read first.** Every `page-N.png` in the lesson's folder (Read tool): the image shows what is main text, caption,
source, footnote. `page-N.txt` mixes them; take only the spelling from it. Types: `shared/lessons.ts`. An example
for the shape, not the choices: `tools/lessons/work/istoria-e-14/lesson.src.json`.

## The file

The lesson as `shared/lessons.ts` has it (`format: 2`), plus `book` and `pictures`. No `pages`, no `audio`.

- `id`: the folder's name. `grade` (Ε΄ = 5), `subject` as the book says, `icon` one emoji, `chapter`, `title` the
  chapter's own, shortened, `source`: book code, chapter, pages.
- `book`: `{ "pdf", "from", "to", "firstPrinted" }`: PDF pages from the chapter's title to the page before the
  next title; `firstPrinted` is the number printed on the first.
- `pictures`: `{ "<name>": { "page": <PDF page>, "box": [x, y, w, h] } }`, pixels of page-N.png. A list of boxes
  sets pictures the book shows apart side by side, in that order. Named elsewhere as `images/<name>.jpg`.
- `talk`: the book's open questions («Πώς εξηγείτε…»), for the parent, in the singular («Πώς εξηγείς…»).

## Pieces

5–8 pieces, 2–4 sentences, about 70 words at most, **one idea each** (attention fades on long text).

- **The book's own sentences.** You may cut a clause that only lists names nobody is asked about, or split a long
  sentence. Never add a fact, never reword: help goes beside the text (below).
- End on a whole thought. A sentence that announces what the book says next («Θερμόμετρα δε χρησιμοποιούμε όμως
  μόνο…») takes the next sentence with it, or stays out.
- `title`: 2–5 words. `key`: the sentence that says what matters most (the main idea is what an ADHD reader misses).
- A caption stays a caption (`image.caption`); a table or timeline worth learning is cut as a picture and asked
  about. Neither becomes a sentence.
- A source (a quote in a box) is a piece only if short and as plain as the main text; most are not. Quote it as
  printed, with no words of yours around it, or put the book's question about it in `talk`.
- A sentence that points at a picture («στην αριστερή φωτογραφία», «στον χάρτη») has that picture on its piece
  (`image`), or goes: she can't read about what she can't see.

## Help with the words

Reading itself is effortful for her, so help sits where the word is.

- `glossary`: the words she would **stop at**: the book's footnotes, then learned, old or technical words
  («μεταρρυθμίσεις», «λεηλάτησαν», «γόητρο»). At most 4 a piece, about 3 a piece overall. Not everyday words
  («εμπόριο», «φόροι»), not names the text explains, not a word the sentence already explains: those bury the
  ones that matter. A piece that needs more is too hard: cut its hardest clause, or leave it out.
- `term` as written in the sentence («λεηλάτησαν», not «λεηλατώ»). `meaning`: short, plain, for the word as used
  here («έβαλαν φωτιά»), not a dictionary entry.
- `easy` (`{"<sentence index>": "…"}`) for every hard sentence: 20 words or more, learned words, an unusual order,
  an idea to unpack. The same facts in plain everyday Greek, a whole sentence or two; nothing added, nothing a
  question asks about left out. Easy sentences get none.

## Pictures

1–3, the ones that carry meaning (a map, a diagram, a photo the text talks about), each box tight around the
whole picture. What the book shows is learning too: a question may ask what only a map, photo, timeline or table
shows. Then: keep to the chapter's subject (a map of the mountains asks about mountains, not the seas it also
names), say what to look at («Κοίτα τον χάρτη…»), and put `"picture": "images/<name>.jpg"` on the step, which
shows it in place of the text. No `evidence` there.

## The script

| Block | When | Why |
|---|---|---|
| `intro`, then `choose` (`listen`: the owl reads; `read`: alone) | first | a choice lowers refusal |
| `book` `when:"before"` | next | the real pages tie it to her book |
| `move` `warmup:true` `for:"adhd"` | before the first piece | exercise helps self-control |
| `read` | each piece, once | |
| `ask` | 1–3 after each piece | answered while fresh; a wrong try lights `evidence` |
| `ask` + `think:"adhd"` | one question in three, the easy ones | recall first, against answering on impulse |
| `move` `for:"adhd"` | every 2–3 pieces | restlessness |
| `explain` (with `stems`) | once or twice, after a piece with a cause or a why | saying it makes it stay |
| `ask` + `review:true` | 2–4 before the end | she forgets fast |
| `book` `when:"after"`, then `end` | last | |

`star: true` on the last step of each piece, on each `explain`, on the last review step: a reward a piece. The
first question is an easy one.

## Questions

About what the text says, causes, order, people, places. No trivia; at most one with a number. Five kinds or more.

- `find-sentence`: one with `main: true` («which sentence says what matters most») in the first two pieces, and
  one or two plain ones.
- `multiple-choice`: 3 options. **The wrong ones are near misses**: a thing the chapter says, or close to the
  answer. Never one nobody would pick («Τις θάλασσες της Ευρώπης» for what mountains shaped).
- `true-false`; `fill-blank` (1–2 extra words in the bank); `ordering` (3–5); `match-pairs` (3–4, short right sides).
- `sort` (two boxes: then/now, cause/effect) where the chapter compares; `spot` (regions in % of the picture, each
  on its place, none overlapping) where it shows.
- Each names its `piece` and the `evidence` sentences that hold the answer. None on a `find-sentence`, a `spot`,
  a picture question, or a review across pieces.
- Digits are fine in what the owl says («Κάνε 5 καθίσματα»).

## Two paths, one file

A kid with the ADHD switch plays the `adhd` path, the others `plain`. `"for"` on a step puts it on one path only.

- **adhd only**: every `move` and every `think`. A plain reader takes them as interruptions.
- **plain only**, rarely: one question that asks for more at once, which adhd gets as two short ones.
- Everything else is good teaching for any child and stays unmasked. Never mask a `read`, `intro`, `choose` or
  `end`. Each path is a whole lesson with a star a piece.

## Words

- Greek, singular, the same to every child: no «έτοιμη/έτοιμος», no «ποια/ποιος» addressed to her, no gendered
  adjective about her. A question about people in the text may say «ποιος». Short sentences, the book's words.
- The owl says it all aloud. **What you write** (questions, options, prompts, moves, «Πιο απλά», meanings) is
  written as it is said: no brackets, abbreviations, unit symbols or «/» («μέτρα», «μετά Χριστόν»). A thing in
  brackets becomes its own short sentence, or goes.
- **The book's sentences** stay as printed, brackets and «μ.» included; the speech rules say them. Never respell
  a word to help the voice.

## Report back

What you left out and why, what you could not place on the pages (a caption printed inside a sentence), and each
choice that is the owner's. Don't call it right: nothing here proves the history; the owner reads it.
