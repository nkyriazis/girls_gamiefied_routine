---
name: lesson-package
description: Prepare a long-text lesson package (Ιστορία, Γεωγραφία, ΚΠΑ, Φυσικά…) from a chapter of the mirrored school books, for the kids' lessons library. Use when asked to "prepare", "make a lesson/package" for a chapter, or to change one.
---

# Lesson package: from a chapter of the book to a `.zip` for the library

A lesson is **content** (short pieces of the book's own sentences, its pictures, its hard words) and a **script**
(the steps the kid goes through, each a block of the player's library). It is for a girl of 10 with ADHD: short
reading, answered at once, feedback that points back into the text, effort rewarded often, the body allowed to
move; no clock, no lives, no penalties (why: `docs/research/adhd-long-text-study.md`).

You don't make it by hand. The **`lesson` workflow** (`.claude/workflows/lesson.js`) runs it from the chapter to the
video in one go; the owner reacts once, to the video. Scripts (`tools/lessons/`, its README) do everything a machine
can decide; agents get one brief each for what must be judged; a referee settles from the books what the others left
open, so only what no source settles reaches the owner, with the video.

## The runs

| Run | What happens | Then you |
|---|---|---|
| `{stage: "make", chapter: "<in words>"}` (or `book: {pdf, from, to, firstPrinted}`, `id`) | the chapter found, `lesson.src.json` written, the build's checks (a fixer per refusal, 3 at most), the pictures looked at, a second reader against the book, a referee (teacher's book, pages, pictures), the voice recorded and listened to, the video | send the owner, together: the `.mp4`, the sign-off page if words wait (publish `work/.signoff/review.html`, Artifact, `capabilities {db: {}}`, the same link every round) and the referee's few questions. Wait. |
| `{stage: "make", id, notes}` | the owner's notes (verbatim) applied, then the same as above, each note also written down as a pending correction | the same. |
| `{stage: "apply", ids}` | the owner's answers on the page into the speech rules, a respelling judged word or pattern, what changed recorded again, the gate; the zip for the Pi when every word is signed | first save the page's `verdicts` (ArtifactData `list`) as `work/.signoff/verdicts.json`. If words still wait, publish and wait again. Show the rounds' times. |
| `{stage: "signoff", ids}`, `{stage: "review", id}` | the voice alone, or the video alone, for a lesson that needs only that | as above. |

A stage that ends `stuck` or `guard` is shown to the owner as it is. Don't finish it by hand.

Nothing a machine checks proves the history or the geography right: the owner's reading does. Never say a lesson
is right; say what was checked and by what.

## Where each rule lives

- A machine can decide it: `tools/lessons/test/check.mjs`, with its why beside it and what to do printed under a
  line that doesn't pass.
- It must be judged: one brief per step in `briefs/`: `find.md`, `source.md` (pieces, hard words, questions,
  pictures, the ADHD mask, words), `fix.md`, `pictures.md`, `critique.md`, `speech.md`.
- It is how a script behaves: that script (`tools/lessons/README.md`).
- `MAP.md` lists every rule and its home. A new rule gets a row there and exactly one home.

## Guardrails

The lessons get better by correction, and only the owner changes what "right" means.

- The owner's corrections become rows in `corrections.md`, **pending**. A pending row changes no agent's work.
  The owner promotes one, in a PR they review: it becomes a check (first `pending` in check.mjs, which fails
  nothing, then enforced) or a line of a brief. Promoted rows stay, each check with a case in
  `tools/lessons/test/regress.mjs`, so a past mistake stays caught.
- Agents never loosen, skip or delete a check, never edit a brief or a script, never touch another lesson.
  `tools/lessons/guard.sh` compares all of them around every stage and runs regress.mjs; a difference stops the stage.
- Only the owner signs off the owl's words, on the page. Never write a verdict, never edit a `status` or a case
  in `tools/lessons/speech/rules.json`. An agent may add a rule, pending.
- A lesson that can't meet a check is reported, not bent, and the check is not changed to let it through.
- `tools/lessons/work/` holds the book's text and pictures and is git-ignored: none of it goes in a tracked file
  or a public page.
- Every stage logs how long it took (`tools/lessons/work/rounds.jsonl`); `node tools/lessons/speech/rounds.mjs`
  shows the rounds. Each should be shorter than the last; when one isn't, say why.

Without the workflow (one small change, say): the same scripts in the same order, with the brief of the step you
are doing. `tools/lessons/README.md` lists them.
