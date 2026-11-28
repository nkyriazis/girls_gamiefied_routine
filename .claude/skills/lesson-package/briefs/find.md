# Brief: find the chapter

You find where a chapter is in the mirrored books and give it an id. You write nothing.

- `materials/index/TOC.md` lists every book. `python3 -I` over `materials/index/passages.jsonl` (fields `id`,
  `loc` = «σελ. N», `text`) finds the chapter's pages.
- `loc` is the **PDF's page**, not the number printed on it. Return both: `from`/`to` are PDF pages,
  `firstPrinted` is the number printed on the first one.
- Use the student book (Βιβλίο Μαθητή). The teacher's book (Βιβλίο Εκπαιδευτικού) says the chapter's goals: read
  them and return them in a few lines, for whoever writes the lesson.
- The chapter's pages run from its title to the page before the next chapter's title, with the pictures and
  sources on them. `from`/`to` cover all of them.
- The id: `<subject>-<grade letter>-<chapter>`, lowercase ascii: `istoria-e-14`, `geografia-e-26`, `kpa-e-a4`,
  `fysika-e-40-41` (a book with no chapter numbers: its pages).
- Not sure which chapter or which pages was meant: say so in `doubts`, don't guess silently.
