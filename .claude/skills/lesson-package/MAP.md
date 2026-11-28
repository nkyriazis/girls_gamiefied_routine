# Where every rule of the lesson skill lives

Until 2026-11-28 one file, SKILL.md (~2,850 words), held everything and every agent read all of it. Now each rule
has one home, where it is used. This table lists every item of that file and where it went, so nothing was lost
and the next rule finds its place. **A new rule gets a row here and exactly one home.**

Homes: **check** = `tools/lessons/test/check.mjs` (E: enforced, a FAIL; L: a LOOK; P: pending, fails nothing until
the owner promotes it), each with its case in `test/regress.mjs`; **pack** = the Pi's own checks (`shared/lessons.ts`
`lessonProblems`, the schema, gendered words; `tools/lessons/pack.mjs`); **brief** = a file in `briefs/`;
**script** = how a tool behaves; **workflow** = `.claude/workflows/lesson.js`; **skill** = SKILL.md.
Where a rule is both judged and checked, the brief says it so the first draft is right and the check catches a miss.

## The frame

| # | Item of the old skill | Home |
|---|---|---|
| 1 | A lesson is content and a script; the agent designs the delivery, the player only runs it | skill (intro); brief source |
| 2 | The format is `shared/lessons.ts`, the shape `backend/lesson.schema.json` | brief source («Read first»); pack |
| 3 | Every piece is the book's own sentences; help in place, never a rewrite | brief source «Pieces»; check L «every sentence is the book's own»; brief critique |
| 4 | A parent imports the zip at /parent → …; kids find it under ✏️ | skill (review row); workflow `review` next; tools/lessons/README.md |
| 5 | Who it is for (10, ADHD) and the one aim | skill (intro); brief source «For whom»; brief critique |
| 6 | The table «Why it works for ADHD» (10 difficulties → what the lesson does) | split by row: each why sits beside its rule, in brief source (the script table's Why column, «Pieces», «Help with the words») and as the comment and the «→» of its check (rows 7–16) |
| 7 | attention fades → pieces of 2–4 sentences, one idea | check E «5-8 pieces», «pieces of 2-4 sentences»; «one idea»: brief source, critique |
| 8 | misses the main idea → the ⭐ sentence, an early «what matters most» | check E «a what matters most find…», P «every piece marks its key sentence»; which sentence: brief source, critique |
| 9 | working memory → the piece beside the question, a wrong try lights the sentences | the player (script); check P «a question on a piece's text names its evidence» |
| 10 | reading is effortful → listen, 🔊, hard words, «Πιο απλά» | the player; checks under 31–33; brief source «Help with the words» |
| 11 | refuses to start → she chooses; the first step is easy | check E «intro, choose, book (before)»; «the first question is easy»: brief source, critique |
| 12 | restlessness → a warm-up and a move every 2–3 pieces (adhd path) | check E «a warm-up move…», «a move every 2-3 pieces» |
| 13 | needs a reward often → a star a piece | check E «a star on every piece», P «a star on every explain» |
| 14 | answers on impulse → think first (adhd path) | check E «think-first on about one question in three»; «the easy ones»: brief source, critique |
| 15 | forgets fast → review questions, explaining | check E «2-4 review questions», «an explain» |
| 16 | frustration → no clock, lives, penalties; the answer shown after 2 wrong | the player (`SHOW_ANSWER_AFTER`); the never list (17) |
| 17 | **Never**: timer, countdown, lives, a wait after a wrong answer, combos, a long block of text | brief source «Never»; brief critique; check P «nothing said to her sets a clock or a race»; the format has no block for any of them (pack) |

## The steps

| # | Item | Home |
|---|---|---|
| 18 | Find the chapter: TOC.md, passages.jsonl with `python3 -I`; `loc` is the PDF's page; the student book; the teacher's book for the goals | brief find; workflow `make` (Find) |
| 19 | Render the pages with pages.sh | workflow `make` (setup runs it); script |
| 20 | Read the images: the text file mixes captions and sources; spelling from the text | brief source «Read first» |
| 21 | Write `lesson.src.json`; it is the whole output | brief source (top) |
| 22 | `book`: pdf, from, to, firstPrinted | brief source «The file»; script (compile.mjs refuses a bad one) |
| 23 | `pictures`: a page and a box in pixels of page-N.png; named as images/<name>.jpg | brief source «The file»; script (compile.mjs) |
| 24 | Pick the pictures that carry meaning, 1–3 a lesson | brief source «Pictures»; check P «a picture or more from the book, and none cut that nothing shows» (the upper count is judged: kpa-e-a4 has 4) |
| 25 | No `pages` and no `audio` in the source | brief source «The file»; check P «the source has no pages and no audio» |
| 26 | Build with build.sh; it stops at the first FAIL; fix and build again; `--no-voice` while fixing | workflow `make` (Build loop, 3 fixes); brief fix |
| 27 | A LOOK: look at the page; yours → the book's back; the PDF's layout → tell the owner | the check's «→» line; brief fix; brief critique (judges each LOOK) |
| 28 | The owl's words: review.sh, publish with the Artifact tool (`{db: {}}`), wait, read `verdicts`, apply.mjs, build again, repeat | workflow `signoff` and `apply`; script `tools/lessons/signoff.sh`, `voices.sh`; skill (the two rows: publishing and reading the answers are the main session's) |
| 29 | Never sign off yourself; never edit rules.json's statuses | skill «Guardrails»; brief speech; script `guard.sh --rules-may-grow` |
| 30 | A respelling that looks like a pattern: add the rule, pending | brief speech; workflow `apply` |
| 31 | Look at every picture: the whole picture and nothing else; fix its box | brief pictures; workflow `make` (Look), by an agent that did not write the lesson |
| 32 | Review with the owner: show the pieces and the questions | script `show.sh` (→ work/<id>/lesson.md); workflow `make` next; skill |
| 33 | Nothing a machine checks proves the history right | skill; brief source «Report back»; workflow RULES |
| 34 | The video: video.sh, no choices of yours; don't write a scenario or drive the screen | workflow `review`; script |
| 35 | work/ is git-ignored: the book's text, a public repo | skill «Guardrails»; workflow RULES; .gitignore |

## Content

| # | Item | Home |
|---|---|---|
| 36 | `id`: <subject>-<grade letter>-<chapter>, ascii | brief find; check P «the id is the folder's name…» |
| 37 | grade, subject as the book says, icon, chapter, title short, source | brief source «The file»; pack (schema) |
| 38 | Pieces: 2–4 sentences, ~70 words, 5–8 a chapter | check E (7) |
| 39 | You may cut a clause that only lists names, or split a long sentence; never add facts | brief source «Pieces»; brief fix; brief critique |
| 40 | A piece ends on a whole thought, not on a sentence that announces what comes next | brief source «Pieces»; brief critique; check P «no piece ends on a sentence that announces…» (catches «:» only) |
| 41 | `id` short; `title` 2–5 words | brief source; check P «piece titles of 2-5 words» |
| 42 | `key`: the sentence that says what matters most | (8) |
| 43 | `glossary`: the words she would stop at; footnotes first; examples | brief source «Help with the words»; brief critique |
| 44 | At most 4 a piece, about 3 a piece over the lesson; a piece that needs more is too hard | check E «at most 4 hard words a piece», «about 3 hard words a piece…», «hard words explained»; brief source |
| 45 | Not everyday words, names the text explains, words the sentence explains | brief source; brief critique |
| 46 | `term` exactly as written in the sentence | pack («hard word … is in none of its sentences»); brief source |
| 47 | `meaning`: plain, short, for the word as used here | brief source; brief critique |
| 48 | `easy` for every hard sentence; same facts, nothing added or left out; easy sentences get none | check E «every long sentence (20+ words) has Πιο απλά»; the rest: brief source, brief critique |
| 49 | `image`: a picture the piece is about, a short caption | brief source «Pieces» (caption), «The file» |
| 50 | Sources: a piece only if short and plain; quoted as printed, no words of yours around | brief source «Pieces» |
| 51 | Captions, tables, timelines stay what they are | brief source «Pieces»; check L (3) flags one made into a sentence; brief critique |
| 52 | A sentence that points at a picture needs it on its piece | check E «a sentence that points at a picture…», P the same with Greek word edges; brief source |
| 53 | The chapter's pages: title to the page before the next title | brief find; brief source «The file»; a case file's `book` (test/cases) |
| 54 | The book's open questions go in `talk`, singular | check E «the book's questions kept for the parent», P «the questions to talk about are in the singular»; brief source |

## The blocks and the questions

| # | Item | Home |
|---|---|---|
| 55 | The table of blocks: what each does and when | brief source «The script» (what a block does on screen is the player's: shared/lessons.ts comments); the «when» of each row is a check E (7–15) |
| 56 | `explain` once or twice, after a piece with a cause or a why | check E «an explain»; where: brief source, critique |
| 57 | `find-sentence`: one main early, one or two plain | check E (8); brief source |
| 58 | `multiple-choice`: 3 options, one right | check P «multiple choice has 3 options»; pack (correctIndex) |
| 59 | Wrong options plausible, near misses, never silly (two examples) | brief source «Questions» (one example kept); brief critique |
| 60 | `fill-blank` 1–2 extra words; `ordering` 3–5; `match-pairs` 3–4, short right sides | check P (three); brief source |
| 61 | `sort` for comparing | brief source; a case file's `types` |
| 62 | `spot`: regions in %; draw and look; each covers its place, none overlap | check P «a spot's regions are inside the picture and don't overlap»; script `regions.sh` draws them; brief pictures |
| 63 | What the book shows is learning too: questions on pictures, maps, timelines, tables | brief source «Pictures» |
| 64 | Keep it on the chapter's subject; name what to look at; `picture` on the step; no evidence | brief source «Pictures»; brief critique; check P «a question on a picture has no evidence and says what to look at» |
| 65 | Numbers may be digits in what the owl says | brief source «Questions»; script (the voice check reads both the same) |
| 66 | Evidence on every question but find-sentence, spot, review ordering/matching; every question names its piece | check P «a question on a piece's text names its evidence», «every question names its piece…» (a review `sort` across pieces is let off like ordering and matching, as fysika-e-40-41 and istoria-e-16 have it: the owner's to confirm); pack (evidence is a sentence of its piece) |
| 67 | `star: true` on the last step of each piece, each explain, the last review | check E, P (13, 15) |
| 68 | Ask about what the text says, causes, order, people, places; no trivia; one number at most | check E «at most one question about a number»; brief source; brief critique |
| 69 | A good shape; vary the types; sort or spot where the chapter compares or shows | check E «at least 5 kinds of question» and the shape checks; brief source |

## Two paths, words, example

| # | Item | Home |
|---|---|---|
| 70 | One package, two paths; `for`, `think`; the pieces the same | brief source «Two paths»; shared/lessons.ts |
| 71 | Each path a whole lesson (every piece read and asked, review, explain, a star a piece) | pack (`lessonProblems`, per path); check E (every shape check runs per path) |
| 72 | Most of a lesson is unmasked | brief source |
| 73 | adhd only: moves and think | check E «[plain] no movement breaks», «[plain] no think-first»; brief source |
| 74 | plain only, when it helps: one bigger question | brief source |
| 75 | Never mask a read, intro, choose, end | pack; brief source |
| 76 | Greek, singular, the same to every child; a question about people may say «ποιος» | pack (gendered words in choose, move, explain); questions and the rest: brief source, brief critique |
| 77 | Short sentences, the words of the book | brief source «Words» |
| 78 | Your own text is written as it is said | check E «your own text is written as it is said», P the same with Greek word edges; brief source; brief fix |
| 79 | The book's sentences stay as printed; the speech rules say them | brief source «Words»; script (read_aloud.py applies rules.json) |
| 80 | A word said wrong is fixed in rules.json, by a pattern when it is one; never by respelling the source | brief speech; brief fix; brief source «Words» |
| 81 | The example: istoria-e-14 | brief source «Read first» |

## New with the workflow (not in the old skill)

| Item | Home |
|---|---|
| A second reader checks the answers, the evidence and the wrong options against the page | brief critique; workflow `make` (Look) |
| An agent changes its lesson's source and nothing else | script `guard.sh`; workflow RULES |
| A check can't be loosened to pass a lesson | `test/regress.mjs` (run by guard.sh) |
| The owner's corrections are kept, pending until promoted | `corrections.md`; workflow `make` (Learn) |
| Voice jobs sized by free GPU memory; out of memory is tried again | script `voices.sh` |
| Each stage's time in the rounds log | script `stage.sh` (step `stage:<name>`) |

## Gone

Nothing was dropped as untrue. Shortened: the second example of a silly option (59), the second half of the
«Why» table's wording (6: the reasons are kept, beside their rules), and the step-by-step commands of the
sign-off (28: they are scripts now).
