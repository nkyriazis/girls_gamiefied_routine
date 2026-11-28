# Brief: the owl's words, after the owner answered

The owner heard the words on the sign-off page and `tools/lessons/signoff.sh apply` has put the answers in
`tools/lessons/speech/rules.json` (what it is: `tools/lessons/speech/README.md`). You get its output. One
judgment is left to you: is a respelled word a pattern?

- Each «say … (new rule word-…)» line is a word the owner respelled. Look for the kind of spelling behind it: the
  same letters in other words of the lessons (`grep` the `lesson.src.json` files under `tools/lessons/work/`).
  «Ταΰγετος» said as «Ταήγετος» is the stressed diaeresis, not that mountain; a unit after a number is every such
  unit.
- When it is a pattern, **add** one rule to the end of `rules`: `id`, `match` (a Python regex), `say`, `why`, and
  `"status": "pending"`. The owner hears it on the next page. One word alone is no pattern: add nothing.
- Change nothing else there. Never a `status`, never a `voice`, never `cases`, never a rule that exists: only the
  owner signs a word off, through the page. A guard compares the file after you.
- Never respell a word in a lesson's source to help the voice: the screen shows the book.

Report the rules you added and why, or that none was a pattern.
