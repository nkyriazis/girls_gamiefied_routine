# Lessons: long-text chapters as packages

A lesson is a chapter of a reading subject (Ιστορία, Γεωγραφία, ΚΠΑ…) cut into short pieces of the book's own
sentences, with its pictures, its hard words and the owl reading it aloud, and a **script**: the steps the kid goes
through, each a block of the player's library (read, ask, sort, tap on a picture, move, explain…). The format and
its checks are `shared/lessons.ts`; the shape is `backend/lesson.schema.json`. Why the blocks are what they are:
`docs/research/adhd-long-text-study.md`.

How one is made: the `lesson` workflow (`.claude/workflows/lesson.js`) runs the stages below in one go, from the
chapter to the video, and the owner reacts once, to the video (with the words to hear and a referee's few questions); the skill (`.claude/skills/lesson-package/SKILL.md`) says how to run it and holds the guardrails.
Every rule has one home: a check here (`test/check.mjs`) when a machine can decide it, a brief for the agent of one
step (`.claude/skills/lesson-package/briefs/`) when it must be judged, a script's behaviour otherwise; the skill's
`MAP.md` lists them all.

| Stage | Scripts, in order | Agents (one brief each) | The owner |
|---|---|---|---|
| make | `stage.sh start`, `pages.sh`, `guard.sh snap`; `build.sh --no-voice` until it passes; `show.sh`, `regions.sh`; `guard.sh check`, `stage.sh end` | find the chapter (`find.md`), write the source (`source.md`), fix what the build refuses (`fix.md`, 3 at most), look at the pictures (`pictures.md`), read it against the book (`critique.md`) | reads `work/<id>/lesson.md`; notes run make again |
| signoff | `voices.sh` (the GPU), `signoff.sh page` | none | hears the words on the page |
| apply | `signoff.sh apply`, `guard.sh`, `voices.sh` for what changed, `signoff.sh page` if words still wait, `speech/rounds.mjs` | a respelling: a word or a pattern (`speech.md`) | hears what was respelled |
| review | `video.sh` | none | watches; imports the zip |

```bash
tools/lessons/pages.sh <pdf> <first> <last> tools/lessons/work/<id>   # the pages as images + text, to read
# write tools/lessons/work/<id>/lesson.src.json, following .claude/skills/lesson-package/briefs/source.md
tools/lessons/build.sh <id>          # → tools/lessons/work/<id>.zip   (--no-voice: skip the recording)
tools/lessons/show.sh <id>           # → tools/lessons/work/<id>/lesson.md, the lesson as text for the owner to read
tools/lessons/video.sh <id> [--read] # → tools/lessons/work/<id>.mp4, the lesson played through, to watch before importing
```

Only the source is an agent's work; everything after it is these scripts, which choose nothing. `video.sh` plays the
lesson on the dev stack the way a child would (`video/play.mjs`: a visible finger, the owl heard to the end, a pause
to think), and what she does is worked out from the lesson (`video/course.mjs` `plan()`): a wrong try on every third
question she can get wrong, both tries used up on one multiple choice (the answer shown), the first hard word in every
other piece, «Πιο απλά» in the others. It plays the path of the dev kid's switch (Παιδιά → Μαθήματα: ΔΕΠΥ or plain). It refuses while the dev stack is down or a schedule would start mid-video.

The source is the lesson as the Pi reads it plus where its pictures come from in the book (`book`: the PDF and the
chapter's pages; `pictures`: a page and a box each, or a list of boxes for pictures the book shows apart, which the
build sets side by side in that order). `build.sh` does the rest, stopping at the first problem:
`compile.mjs` writes `package/lesson.json` (with `pages`) and the list of what to cut, the edu-materials image cuts
the pictures and the pages, `pack.sh` checks, `voice.sh` records what is new, `pack.sh` zips.

Then a parent imports the zip: /parent → Ρυθμίσεις → Μαθήματα → «Εισαγωγή». It goes into `lessons/<id>/` on the data
volume (next to data.json; in the daily backup), the kids of its class find it under ✏️ → 📖 Μαθήματα, and the
parent sees each kid's progress, wrong tries and the book's questions to talk about afterwards. Importing a package
with the same id replaces the lesson; a kid's place in it starts over only if it no longer fits.

`work/` is git-ignored (and docker-ignored): the packages hold the book's text and pictures, and the repo is public.

- `pages.sh`: renders PDF pages (150 dpi) and their text, in the edu-materials image, for reading the chapter
  (a picture's box is in pixels of these).
- `build.sh` / `compile.mjs`: the source to the zip, in one go.
- `video.sh` / `video/`: the zip played through as a video (tools/evidence records it, with its sound).
- `pack.sh` / `pack.mjs`: the schema and `lessonProblems` (the Pi's own checks), no gendered words in what the
  lesson says to the child, then the zip (lesson.json, the pictures it uses, its clips).
- `voice.sh` / `lines.mjs` / `read_aloud.py`: every title, sentence, hard word, question and prompt in the owl's
  voice (tools/help-voice: VoxCPM2, each take heard back by Whisper), kept per line, so a changed sentence alone is
  recorded again. A line under the bar is listed as `CHECK` (short ones, a name alone, often are); listen to it.
- `test/check.mjs` (run by `test/test.sh` in the build): every rule a machine can decide. A FAIL stops the build, a
  LOOK is for a person, a PEND is a new check that fails nothing until the owner promotes it (`pending(` → `check(`
  in a PR). Under each line that doesn't pass, «→» says what to do. `test/regress.mjs` checks the checks: a made-up
  lesson (our own text) passes them all, and each of its cases breaks it one way and names the check that must
  catch it. A new check adds its case; a correction that became a check keeps its case for good.
  `docker run --rm -v "$PWD":/w -w /w node:24-alpine node tools/lessons/test/regress.mjs`
- `show.sh` / `show.mjs`: the source as a page of text (pieces, every question with its answer and where the text
  says it, the two paths), for the owner's reading before any voice is recorded.
- `regions.sh`: every `spot` question's regions drawn on its picture (green: the right one), to look at.
- `guard.sh`: around a stage, `snap` remembers the checks, scripts, briefs, the format, the other lessons' sources
  and the speech rules, and `check` lists what changed and runs regress.mjs. An agent changes its lesson's source and
  nothing else; `--rules-may-grow` lets the speech rules gain pending rules only.
- `voices.sh`: `build.sh` for several lessons, as many at once as the GPU has free memory for (it is shared; a job
  takes ~5.5 GB; `nvidia-smi` decides, never a fixed count). A job that dies of «CUDA out of memory» is queued again,
  3 times; that is never reported as the lesson's failure. One line per lesson: signed, waits, failed or nogpu.
- `signoff.sh`: `page` makes the sign-off page in `work/.signoff/`; `apply <verdicts.json>` puts the owner's answers
  in the registry and says which lessons are signed (zipped) and which wait.
- `stage.sh`: a stage's duration into `work/rounds.jsonl` as step `stage:<name>`, beside the voice and sign-off
  lines (`node tools/lessons/speech/rounds.mjs` shows the rounds).
- `speech/`: what the owl says for what the screen shows (`rules.json`: patterns, signed off by the owner for this
  voice), every clip listened to word by word, the sign-off page, and the gate at the end of `build.sh` that
  refuses a word the owner hasn't heard. See its README.
