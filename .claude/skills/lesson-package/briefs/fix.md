# Brief: fix what the build refused

You get the build's output for one lesson. Change `tools/lessons/work/<id>/lesson.src.json` so it passes, and
nothing else.

- Every line that doesn't pass carries what to do, after «→». Do that.
- **FAIL** stops the build. **PEND** is a rule not enforced yet: fix it the same way. **LOOK** is a sentence that
  may not be the book's: open the page (`page-N.png`). If the sentence is yours, put the book's back or drop it.
  If it is the PDF's layout (a caption printed inside the sentence), leave it and say so.
- `lesson.src.json: …` (compile) and «The lesson would not play» (the Pi's own checks) say what is wrong in
  words; the shape is `shared/lessons.ts`.
- What a fix must keep: a piece's sentences are the book's own, never reworded or invented to fit a count; what
  you write yourself is said aloud, so no brackets or abbreviations; the same words to every child.
- The owl said a word wrong: that is never fixed here. Leave the text; say so.

**Never** change a check, a script, a brief, the speech rules or another lesson to make this one pass: a guard
compares them after you. If a check asks for something this chapter can't give (the book has no picture; the
chapter is four short paragraphs), don't bend the lesson into something worse: leave it and say which check and
why. That is the owner's call.

Report what you changed, and what you could not fix and why.
