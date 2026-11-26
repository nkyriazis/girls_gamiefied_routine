# Lessons: long-text chapters as packages

A lesson is a chapter of a reading subject (Ιστορία, Γεωγραφία, ΚΠΑ…) cut into short pieces of the book's own
sentences, with its pictures, its hard words and the owl reading it aloud, and a **script**: the steps the kid goes
through, each a block of the player's library (read, ask, sort, tap on a picture, move, explain…). The format and
its checks are `shared/lessons.ts`; the shape is `backend/lesson.schema.json`; how a package is made, and which block
to use when, is the skill `.claude/skills/lesson-package/SKILL.md`. Why the blocks are what they are:
`docs/research/adhd-long-text-study.md`.

```bash
tools/lessons/pages.sh <pdf> <first> <last> tools/lessons/work/<id>   # the pages as images + text, to read
# write tools/lessons/work/<id>/lesson.src.json, following the skill
tools/lessons/build.sh <id>          # → tools/lessons/work/<id>.zip   (--no-voice: skip the recording)
tools/lessons/video.sh <id> [--read] # → tools/lessons/work/<id>.mp4, the lesson played through, to watch before importing
```

Only the source is an agent's work; everything after it is these scripts, which choose nothing. `video.sh` plays the
lesson on the dev stack the way a child would (`video/play.mjs`: a visible finger, the owl heard to the end, a pause
to think), and what she does is worked out from the lesson (`video/course.mjs` `plan()`): a wrong try on every third
question she can get wrong, both tries used up on one multiple choice (the answer shown), the first hard word in every
other piece, «Πιο απλά» in the others. It plays the path of the dev kid's switch (Παιδιά → Μαθήματα: ΔΕΠΥ or plain). It refuses while the dev stack is down or a schedule would start mid-video.

The source is the lesson as the Pi reads it plus where its pictures come from in the book (`book`: the PDF and the
chapter's pages; `pictures`: a page and a box each). `build.sh` does the rest, stopping at the first problem:
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
