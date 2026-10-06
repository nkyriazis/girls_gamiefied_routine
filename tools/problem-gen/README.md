# problem-gen: the step-by-step problems, generated and audited

The daily and extra problems (`type: "problem"`, see `ProblemExercise` in `shared/types.ts`)
come from here. Each **family** is a kind of problem from the textbooks. It tells its story
in several ways and settings, picks numbers within the grade's range, and computes every
answer from those numbers. `gen.ts` writes 500 problems per grade into
`backend/exercise-pools/*-generated.json`, and `audit.ts` checks them independently. The daily
plain maths of Γ΄ and Ε΄ comes from `maths/` the same way (see «Plain maths» below).

It runs with Node 24 alone (no packages): in Docker, from the repo root:

```bash
N="docker run --rm -u $(id -u):$(id -g) -v $PWD:/w -w /w node:24-alpine"
$N backend/node_modules/.bin/tsc -p tools/problem-gen          # type check
$N node tools/problem-gen/gen.ts                               # write the pools
$N node tools/problem-gen/audit.ts --sample tools/problem-gen/.sample.md 40   # audit + a sample to read
# while writing a family: only it, 40 problems, into a folder of your own
$N node tools/problem-gen/gen.ts --families my-family --target 40 --out tools/problem-gen/.out/me
$N node tools/problem-gen/audit.ts --dir tools/problem-gen/.out/me --sample tools/problem-gen/.out/me/sample.md 40
```

The output is the same on every run (each family is seeded by its id), so a diff of the
pool files shows exactly what a change did. Never edit the generated JSON by hand.
`npm test` in the backend also loads every pool and solves every step.

## Writing a family

Copy the shape of `families/g3/change.ts` or `families/e5/parts.ts`: a `Family` with `id`,
`grade`, `unit` (textbook unit whose skills it needs), `source` (chapter it comes from) and
`make(r, b)`. It returns `{ title, story, steps }`, or `null` to skip numbers that don't
work (the generator tries again).

### Story
- Mark every phrase the tag step asks about: `known(...)`, `sought(...)`, `extra(...)`.
  **Every number in the story must be inside a mark** (the audit fails otherwise), and a
  tag step needs at least one of each.
- `extra` is information the story gives but the answer doesn't need, **with a number**,
  that a child might wrongly use: an age, a time, the pages of a book, how many there
  were in the shop. It must be plausible in its sentence and change nothing.
- The question is a `sought` phrase ending in `;` (the Greek question mark).
- Give each family **at least 3 ways of telling** and **at least 4 settings** (things,
  places, people), so that 20 problems don't read the same. The audit warns when a family
  has fewer than 5 different story shapes.
- Numbers: whole numbers only, answers at most 6 digits, and within what the grade has
  covered (below). Format every number with `fmt()` (1.229, as the books write them).
- **Realistic magnitudes**: a crate holds 8–25 kg, a bottle 1–2 litres, a bus 40–60 seats,
  a toy costs 5–60 €, a child is 7–12, a book has 40–300 pages. If numbers come out
  absurd, return `null`.

### Greek
The audit can't read Greek; you must. The traps the generator has already hit:
- **Enclitic accent**: a word stressed on the antepenult takes a second accent before
  `μου/σου/του/της/μας/τους`: «τα γενέθλιά της», «τα χρήματά του», «το παιχνίδι του» (no
  change: paroxytone). Write such phrases out in full; don't glue `${p.his}` after them.
- **Number and gender agreement**: «1 μπάλα» but «2 μπάλες»; use `count(n, thing)` and
  `howMany(thing)`; avoid the number 1 in labels that are plural («Θα περισσέψουν 1
  ευρώ» is wrong, «Ευρώ που περισσεύουν: 1» is fine). Adjectives agree: «οι μπάλες ήταν
  διπλάσιες», «τα βιβλία ήταν διπλάσια». Pronouns agree: «τα μοιράζει» (κουλουράκια),
  «τις μοιράζει» (καραμέλες).
- **Articles and cases** come with the people: `p.Nom` «Ο Νίκος», `p.nom`, `p.gen` «του
  Νίκου», `p.acc` «τον Νίκο» / «τη Δανάη» / «την Άννα», `p.his` «του/της». With σε:
  `σ${p.acc}` gives «στον Νίκο», «στη Δανάη», «στην Άννα».
- Subject and object: «Πόσοι επιβάτες χωράνε» (nominative) but «Πόσους μαρκαδόρους
  αγοράζει» (accusative): `howMany(t, false)` / `howMany(t, true)`.
- Don't repeat a name in consecutive sentences; say «Πληρώνει με…».
- Use the book's words: «Τι ξέρουμε και τι ψάχνουμε;» (Γ΄), «Τι προσπαθούμε να βρούμε; Τι
  γνωρίζουμε;» (Ε΄), «Λύνουμε.», «Πώς ελέγχουμε;», «Αναστοχαζόμαστε», and the Ε΄ strategies
  (Παρουσιάζω το πρόβλημα, Δοκιμάζω-ελέγχω-αναθεωρώ, Αναζητώ ένα μοτίβο, Εργάζομαι
  αντίστροφα, Λύνω ένα πιο απλό πρόβλημα) and tools (ζωγραφιά, πίνακας, κατάλογος, διάγραμμα).
- Operators with a space on each side, as the books: `76 − 35 = 41`, `8 × 19 + 4`,
  `1.229 : 20`. Use − (U+2212) and ×, not - and x.

### Steps
- Start with `b.tag(...)` (read), then 2 to 4 more steps across plan / solve / check.
  Vary the scaffolding within a family: sometimes the plan step, sometimes not; number
  rows that show the operation (`76 − 35 =`) or only name the quantity (`Μένουν`).
- `b.choice(phase, prompt, right, wrongs, hint)`: list the **right option first**; the
  builder shuffles. Wrong options are the **typical mistakes** (the wrong operation,
  forgetting oneself in «ο Φώτης και οι 3 φίλοι του», ignoring the remainder, adding every
  number in the story), all different from each other and from the right one.
- `b.numbers(phase, prompt, rows, hint)`: one row per intermediate quantity, from the
  knowns to the unknown. That chain is the point of the whole exercise.
- `b.order(...)`: plan steps whose order is unique.
- Hints help with the step without doing it; they may show a sub-calculation.
- **Every equation you write must be true**, in the story, prompts, hints, rows and right
  options. The audit evaluates them all. Wrong options may hold wrong equations.

### Range by grade (what the class has covered by autumn)
- **Γ΄** units 1–3: numbers to 1.000 and then 3.000; addition and subtraction of 2- and
  3-digit numbers; times tables to 10 × 10; division within the tables (with remainder);
  2-digit × 1-digit; lengths in cm/m (1 m = 100 cm); euros (no cents arithmetic beyond
  whole euros, except simple coin puzzles). Stars: 3.
- **Ε΄** units 1–2: natural numbers into the millions; place value, comparing, rounding;
  the four operations with large numbers; multiples, divisors, LCM, divisibility by 2, 3,
  5, 9, 10; Euclidean division (Δ = δ × π + υ). No fractions or decimals yet. Stars: 4.

## Plain maths (`maths/`)

The daily maths card of the Γ΄ and Ε΄ kids (#49 part 2): plain exercises in the six existing
types, no new widget. `maths/gen-maths.ts` writes 120 per grade, ⭐1 each, into
`backend/exercise-pools/g-dimotikou-maths.json` and `e-dimotikou-maths.json`; `audit.ts` checks
them with the problems (`maths/check.ts`, which re-solves each one from its text).

```bash
$N node tools/problem-gen/maths/gen-maths.ts          # write the two pools
$N node tools/problem-gen/audit.ts                    # audit everything (problems and maths)
$N node tools/problem-gen/maths/gen-maths.ts --families round,lcm --target 20 --out tools/problem-gen/.out/me
```

**Keyed by grade.** `maths/curriculum.ts` holds, per grade, the units the class covers by
autumn (Γ΄ 1–3, Ε΄ 1–2, as for the problems), the largest number (Γ΄ 3.000, Ε΄ 999.999.999),
the tables' limit (Γ΄: one factor at most 11, divisors at most 11) and the book's chapters, as
committed data (from the student book's contents; nothing reads `materials/`). `maths/grades.ts`
gives each grade its families, id prefix and file. Δ΄ or ΣΤ΄ is one entry in each, plus a file of
families. No month gating yet: every family of the covered units plays from September (follow-up).

**A family** (`maths/g3.ts`, `maths/e5.ts`): `{ id, grade, chapter, skill, weight?, make(r) }`.
`chapter` is a chapter of the TOC within the grade's units; it becomes the item's `source`
(«Μαθηματικά Γ΄, κεφ. 4: Πολλαπλασιασμός, προπαίδεια (Ι)») and `generatorParams.unit`. `make`
picks numbers and returns one item through the builders in `maths/lib.ts` (`num`, `mc`, `tf`,
`match`, `order`, `fill`), or `null` to try other numbers. List the right option first; the
builder shuffles. Model it on its chapter's workbook exercise, and make the wrong options the
typical slips: the carry forgotten (`forgotCarry`), the smaller digit taken from the larger, a
group of digits in the wrong place, rounding the other way or at the next place, a remainder as
big as the divisor. Ids are `g3-math-<family>-NNN` / `e5-math-<family>-NNN` (never `-gen-`).

**The wordings the audit reads** (`skill` → text; numbers as the books write them, `1.229`):

| skill | wording |
|---|---|
| `calc` | «Πόσο κάνει 348 + 275;» (any of + − × : and parentheses); match pairs «7 × 5» – «35» |
| `equation` | fill-blank «6 × {0} = 42», «2.279 = 25 × {0} + 4»; body «Συμπλήρωσε τον αριθμό που λείπει.» |
| `words` | «Πώς γράφεται με ψηφία ο αριθμός «δύο χιλιάδες σαράντα»;»; match words – digits |
| `neighbour` | «Γράψε/Κύκλωσε τον αμέσως επόμενο/προηγούμενο αριθμό του 1.299.» |
| `group-count` | «Πόσες δεκάδες/εκατοντάδες έχει συνολικά το 368;» |
| `digit-value` | «Ποια είναι η αξία του ψηφίου 3 στον αριθμό 2.375;» (the digit once in the number) |
| `digits-extreme` | «Γράψε τον μεγαλύτερο/μικρότερο τριψήφιο αριθμό με τα ψηφία 4, 0 και 7, από μία φορά το καθένα.» |
| `compare` | true-false «Το 2.408 είναι μεγαλύτερο/μικρότερο από το 2.480.» |
| `extreme` | «Κύκλωσε τον μεγαλύτερο/μικρότερο αριθμό.» |
| `order` | ordering, body «Βάλε τους αριθμούς στη σειρά, από τον μικρότερο στον μεγαλύτερο.» (or the reverse) |
| `round` | «Στρογγυλοποίησε το 2.541 στην πλησιέστερη εκατοντάδα.» (δεκάδα … εκατοντάδα χιλιάδων, «στο πλησιέστερο εκατομμύριο») |
| `count-by` | «Συνέχισε το μοτίβο: 250, 500, 750, … Γράψε τον επόμενο αριθμό.» / «Κύκλωσε τον επόμενο αριθμό του μοτίβου: …, …» |
| `fact-family` | «Κύκλωσε την πράξη που ανήκει στην ίδια οικογένεια με την 6 × 7 = 42.» |
| `div-rem` | «Πόσο κάνει 67 : 8;» with options «8 και περισσεύουν 3» («περισσεύει 1») |
| `division-part` | «Βρες το πηλίκο/υπόλοιπο της διαίρεσης 1.584 : 9.» |
| `dividend` | «Σε μια διαίρεση ο διαιρέτης είναι 48, το πηλίκο 7 και το υπόλοιπο 25. Βρες τον διαιρετέο.» |
| `div-check` | true-false «Στη διαίρεση 100 : 7 το πηλίκο είναι 14 και το υπόλοιπο 2.» |
| `bad-remainder` | «Μια διαίρεση έχει διαιρέτη 6. Κύκλωσε τον αριθμό που δεν μπορεί να είναι το υπόλοιπό της.» |
| `length` | «Πόσα χιλιοστά/εκατοστά είναι 3 μέτρα και 53 εκατοστά;» |
| `money` | «Έχεις 2 χαρτονομίσματα των 10 ευρώ και 1 κέρμα του 1 λεπτού. Πόσα ευρώ/λεπτά έχεις;» (real notes and coins, one currency) |
| `multiple` | «Κύκλωσε τον αριθμό που είναι πολλαπλάσιο/διαιρέτης του 8.» |
| `lcm` | «Βρες το Ε.Κ.Π. των 4 και 6.» (or «των 3, 4 και 6.») |
| `divisible` | true-false «Το 4.581 διαιρείται με το 9.» / «Κύκλωσε τον αριθμό που διαιρείται με το 9.» |

A new wording needs its solver in `maths/check.ts`, written from the text, not from the family.

**Types.** Each grade's set: true-false at most 10 % (and «Σωστό» 40–60 %: the true-false
families share one alternating `nextTruth`), fill-blank at most 10 % with exactly one gap
(`FillBlankRenderer` submits on the last gap, #50). number-input only for answers below 10.000
(the numpad has no digit grouping and takes 6 digits); larger answers are multiple choice.
Multiple choice and fill-blank: exactly one right option, no repeats, and the right option must not
be the only longest one (the options are shuffled on screen, so its length is the only tell;
the generator drops such items). Numeric wrong options are whole and at most 100 times off.

**«Δείξε μου».** On a wrong try (forgiving) and after the last try (unforgiving), the screen shows
`answerText` in one run, «a – b, c – d, …» for a match and «a → b → …» for an ordering, at 2.5rem
for 4.5 seconds. Keep it at most 100 characters (about three lines at 1280×800): `match()` keeps
3 or 4 pairs, as many as fit, and the audit fails a longer one. A 4-pair match of millions in
words was 140 characters and wrapped to five lines, its pairs split across lines.

**Greek and realism.** Speak to the child in the imperative or second person («Υπολόγισε»,
«Κύκλωσε», «Βάλε», «Έχεις»), the same to every child: the audit fails check-gender's words (the
list is `frontend/scripts/gendered.mjs`), so no «Ποιος αριθμός…» (say «Γράψε τον αριθμό…»), no
«όλους». Number words agree: thousands are feminine («τρεις χιλιάδες», «διακόσιες χιλιάδες», «είκοσι
μία χιλιάδες», «χίλια» alone), the rest neuter («τρία εκατομμύρια», «εκατόν»/«εκατό»); nouns
agree with 1 («1 κέρμα του 1 λεπτού», «2 κέρματα των 5 λεπτών»). The books' symbols: `:`, `×`, `−`
(U+2212), numbers with their dots. Γ΄ uses «εφτά, οχτώ, εννιά» in words. Magnitudes as in the book:
Γ΄ money up to a few hundred euros, Ε΄ numbers into the millions.

**Counts.** 120 per grade (four months of one a day); the audit fails under 60. `npm test`
(dailyMix.test.ts) prints how many days pass before an item comes back and only warns under 30.

## Layout
- `lib.ts`: randomness, names, counted nouns, step builders, `Family`.
- `families/g3/`, `families/e5/`: one file per family; `index.ts` lists them (sets
  `set-*.ts` group families written together).
- `gen.ts`, `audit.ts`: see the top of each.
- `maths/`: the plain maths (`curriculum.ts`, `grades.ts`, `lib.ts`, `g3.ts`, `e5.ts`, `gen-maths.ts`, `check.ts`).

## World models (`world/`)

A world is quantities and relations (out = a op b); a problem picks a question and
states the rest, and a solver finds which facts are needed, so the same sentence is
needed in one problem and extra in another. Pieces of text remember their quantity, so
the painting check knows each fact's words, and the calc step can read back any
calculation. `world/run.ts` prints a sample and how far lazy strategies get;
`world/gen-world.ts` writes `backend/exercise-pools/g-dimotikou-world.json`. Every
other valid way to work it out must be a quantity too (the other order of two changes,
two changes taken together), or a right calculation reads back as meaning nothing.
Questions that refer to what the story tells (the item bought, «η νονά της», «αυτές τις
εβδομάδες») go in `late` and are asked only at the end. So far one world, Γ΄ only: a
child's money or collection that changes, friends compared, their own collections.
