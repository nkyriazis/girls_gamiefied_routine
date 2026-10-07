# Comment drafts (the main session posts them when part 3b ships)

## 1. On #49, posted before merging (the issue's «Leave a mark»)

Done in four PRs: #69 (part 1), #70 (part 2), #73 (part 3a) and this one (part 3b).

**What changed**
- **Part 1 (#69):** a pool's `grades` now means "written for this grade". A lower grade's pool serves a grade only as `revision`, and only for a category that grade has nothing in. The daily set follows `DAILY_MIX` (problem, then maths, then language) instead of one per category. `npm test` prints, per grade and category, how many days pass before an item comes back.
- **Part 2 (#70):** Γ΄ and Ε΄ maths of their own, generated and audited in `tools/problem-gen/maths/`: 120 per grade, ⭐1, each with a `source` naming its chapter.
- **Part 3a (#73):** Γ΄ language of its own, written by hand in `tools/problem-gen/language/`: 80 items from units 1–3 of «Τα απίθανα μολύβια», each citing its lesson and page. An audit derives every key again from a lexicon typed from the books. `npm test` fails when a kid's grade (`KIDS_GRADES`) fills a mix category from revision or repeats within 30 days.
- **Part 3b (this PR):** Ε΄ language of its own: 68 items from units 1–2 of «Της γλώσσας ρόδι και ροδάνι». The lexicon may also cite the grammar book 10-0138. There are new solvers for tense, mood, δε(ν)/μη(ν), time words, adverbs, numerals, compounds and definitions. `KIDS_GRADES` is now [3, 5].

Each kid's three daily cards are now all her own grade's: no «Επανάληψη» pill for either kid. b-dimotikou and d-dimotikou serve no kid and stay as the fallback.

**The economy is unchanged.** Every plain item pays ⭐1, so at full marks Γ΄ earns ⭐5 a day and Ε΄ ⭐6, as before #49. The items ask more than the Β΄/Δ΄ ones did, so expect more wrong tries and some ⭐0 cards on the unforgiving rung.

**Every September:** move `KIDS_GRADES` (top of `backend/test/dailyMix.test.ts`) when the kids go up a grade, and write that grade's pools first, or `npm test` fails. In Sept 2027 that means Δ΄ (problems, and Δ΄ language and maths beyond d-dimotikou's 9 + 9) and ΣΤ΄ (nothing yet). At Δ΄, d-dimotikou is Ιφιγένεια's own grade's, so she gets no revision card. The owl's revision tour editions stay in the code but play for no kid.

**piserve:** no manual step beyond what #23 needed: each kid's `grade` set in the Pi's data.json (3 and 5). The pools ship in the backend image. The first daily draw after local midnight uses them; a set already drawn that day stays as it is.

**Follow-ups:** #71 (gate every family by the month its chapter is taught, and write the later units, for problems, maths and language alike), #72 («Δείξε μου»: hold the answer until a tap), and #26 (the group game, out of this issue).

## 2. On #71 (Ε΄ language joins it)

Ε΄ language joins this issue too (from #49 part 3b).

The Ε΄ items (`tools/problem-gen/language/e5.ts`, 68 items in `backend/exercise-pools/e-dimotikou-language.json`) cover only units 1–2 of «Της γλώσσας ρόδι και ροδάνι». That is what the class reaches by the end of October: tenses, time words, moods, δε(ν)/μη(ν), the -ος feminines, the -ης/-ες adjectives, numerals and adverbs. They are limited the same way as Γ΄ language and the maths. Every item plays from the first day of school. From November nothing new comes: unit 3 (28η Οκτωβρίου) has no grammar box, and units 4–6 and volumes β΄ and γ΄ never reach the daily set. The 68 items come back after 68 days.

`curriculum.ts` already holds Ε΄'s lessons with their pages, the book's texts and then the workbook's sections. The month goes on each lesson (from the teacher's book's yearly plan, 10-0115), as for Γ΄. Later units are written the same way: the lexicon `lexicon/e5.ts` may cite the grammar book 10-0138 for paradigms, while items cite only the student book and workbook.
