# problem-gen: the step-by-step problems, generated and audited

The daily and extra problems (`type: "problem"`, see `ProblemExercise` in `shared/types.ts`)
come from here. Each **family** is a kind of problem from the textbooks. It tells its story
in several ways and settings, picks numbers within the grade's range, and computes every
answer from those numbers. `gen.ts` writes 500 problems per grade into
`backend/exercise-pools/*-generated.json`, and `audit.ts` checks them independently.

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

## Layout
- `lib.ts`: randomness, names, counted nouns, step builders, `Family`.
- `families/g3/`, `families/e5/`: one file per family; `index.ts` lists them (sets
  `set-*.ts` group families written together).
- `gen.ts`, `audit.ts`: see the top of each.
