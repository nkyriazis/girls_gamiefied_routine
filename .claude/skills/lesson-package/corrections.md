# Corrections: what the owner fixed, and what became of it

Every correction the owner makes to a lesson gets a row here, so the same mistake is not made twice and nothing
changes on its own. The `lesson` workflow adds rows (status `pending`) when a lesson is revised from the owner's
notes; nothing else writes here.

- A row names the **kind** of mistake in a line. It never quotes the book (this file is public).
- **home**: where a rule for it would live: a check (`tools/lessons/test/check.mjs`), a line of a brief
  (`briefs/<file>.md`), or «this lesson only».
- **status**: `pending` (noted; no agent acts on it yet) → `promoted` (the owner agreed: the check or the brief
  line exists, and for a check its case is in `tools/lessons/test/regress.mjs`) or `declined`. Only the owner
  promotes, in a PR they review. A promoted row stays: with its regress case it is the example that keeps the
  mistake caught.
- An agent making a lesson reads the briefs, not this file: a pending row changes nothing until it is promoted.
- The rows from before this file existed (2026-11-28) were rebuilt from the old skill's examples and the git log;
  their lesson is a best guess.

| when | lesson | the owner's correction | home | status |
|---|---|---|---|---|
| before 2026-11-28 | geografia-e-13 | wrong options nobody would pick | briefs/source.md «Questions», briefs/critique.md | promoted |
| before 2026-11-28 | geografia-e-13 | a question on a map asked about something off the chapter's subject | briefs/source.md «Pictures», briefs/critique.md | promoted |
| before 2026-11-28 | fysika-e-40-41 | a piece ended on a sentence announcing what the book says next | briefs/source.md «Pieces»; check «no piece ends on a sentence that announces…» (pending, catches only «:») | promoted (brief), pending (check) |
| before 2026-11-28 | several | everyday words glossed, burying the hard ones | checks «at most 4 hard words a piece», «about 3 hard words a piece»; briefs/source.md | promoted |
| before 2026-11-28 | fysika-e-40-41 | a caption made into a piece spoke of a photo that was not beside it | check «a sentence that points at a picture has the picture on its piece»; regress «a sentence about a photo that isn't there» | promoted |
| 2026-11-28 | several | the agent's own text had brackets and abbreviations the owl stumbles on | check «your own text is written as it is said»; regress «brackets in a question» | promoted |
