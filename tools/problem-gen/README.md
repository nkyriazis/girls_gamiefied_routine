# problem-gen: the step-by-step problems, generated and audited

The daily and extra problems (`type: "problem"`, see `ProblemExercise` in `shared/types.ts`)
come from here. Each **family** is a kind of problem from the textbooks. It tells its story
in several ways and settings, picks numbers within the grade's range, and computes every
answer from those numbers. `gen.ts` writes 500 problems per grade into
`backend/exercise-pools/*-generated.json`, and `audit.ts` checks them independently. The daily
plain maths of Γ΄ and Ε΄ comes from `maths/` the same way (see «Plain maths» below), and the
daily Γ΄ and Ε΄ language from `language/`, written by hand and audited against a lexicon (see «Plain language»).

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

The output is the same on every run (each problem is seeded by its family and number, so a
dropped draft changes only its own problem, not the ones after it), and a diff of the pool files
shows exactly what a change did. Never edit the generated JSON by hand. `gen.ts` prints, per
family, how many drafts it dropped and why; `--tells` also shows what the dropped choices gave away,
and `--places` the prompts whose wordings can't spread the right option evenly by length (see «Steps»).
`npm test` in the backend also loads every pool and solves every step.
The builder's own pieces have tests that run with Node alone: `$N node --test tools/problem-gen/*.test.ts`.

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
- **Prices** come from `prices.ts`, a range per item (κούκλα 12–30 €, παζλ 9–25 €, …; a
  ποδήλατο, κιθάρα or ηλεκτρικό πιάνο a few hundred, for κεφ. 10's three-digit amounts).
  change-left and the world's purchases use it; add an item there, not a price in a family.
  What she pays with is a sum of real notes that needs every note (`payWith`: 20 + 20 for
  37 €, 200 + 100 for 248 €), and savings are above the price. The audit keeps its own,
  wider table (`story-check.ts`, about 150 items, written from real Greek prices, not fitted to the
  pools) and reads the prices of every family (#50 part 5b) in these phrasings: «κοστίζει/κοστίζουν N»,
  «ξόδεψε/πλήρωσε/έδωσε/θέλει να πάρει N για X», «X για N», «X των N», «X αξίας N», «αγόρασε/αγοράζει X με
  N» (any tense or accent), «N το κιλό / την καθεμία / το άτομο», «€» as «ευρώ», «N ευρώ και M λεπτά».
  A «για X» right after a price names that price's item, or none, never the item before («… των 935 €
  και 730 € για το λεωφορείο»). Money in any other phrasing isn't read («βγήκε βόλτα με 20 ευρώ»), so
  a new telling of a price gets a case in `story-check.test.ts` that shows it is read (`reads(…)`). It judges one piece: a pack «με 6 χυμούς για 4 €» and a total «τα πέντε τετράδια κοστίζουν
  8 ευρώ» are divided by their count. **A price names its item in its own sentence** («Στο
  βιβλιοπωλείο το βιβλίο κοστίζει 9 ευρώ», never «Το καθένα κοστίζει 550 €»), and the item is one the
  table knows: a new item goes in the table, with a real range, and a price outside it is fixed in the
  family. Notes and coins are real ones («χαρτονόμισμα των 50», «κέρματα των 20 λεπτών»).

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
- **No option gives the answer away by its length** (#50 parts 5a and 5c). The screen shuffles the
  options, so length is the only tell left, and it has two sides.
  - *In one choice* (`lengthTell` in lib.ts): no option stands out at either end (the longest at
    most 30 % or 5 code points longer than the next, the shortest at most 30 % or 5 shorter than the
    next), and among options that are all numbers («12», «1.229 €») the right one is never the only
    one with the most digits. `b.choice` flags such a choice (and repeated options), `gen.ts` drops the
    draft, the audit fails it in every pool, curated ones too.
  - *Across a prompt* (the place rule, #50 part 5c): one fixed wording puts the right option at the same
    place by length in every problem, and a child who taps «the middle one» without reading wins (before
    5c, 76.5 % of Ε΄ three-option choices). So an option may come in **several wordings**
    (`Wording`, a list, the usual one first): `b.choice(phase, prompt, [right, shorter], [[wrong, longer,
    shorter], …])`. `b.choice` works out the places by length the valid combinations give the right
    option, mixes them so every place is as near to 1/n as they allow, and the problem's seed (`placeSeed`,
    from its id: a dropped draft still changes only its own problem) picks one. The only random draw is
    still the order on screen, so stories, numbers and slots stay when wordings are added. The audit
    counts the places per family, prompt (`promptKey`: names with their article and numbers aside;
    `SAME_PROMPT` merges prompts that ask the same with the same options) and number of options, with
    options **within 2 code points counted as the same length** (the eye can't tell them apart; ties
    split): a prompt from 6 choices on fails where one place wins more than a fair die would (`placeLimit`,
    over it in under 1 prompt in 100), from 3 to 5 choices that is a warning, and a prompt over its share
    and one in 8 is a warning too. Its summary prints, per pool, how often each place is right.
    `gen.ts --places` lists the prompts whose wordings can't spread the right option evenly, and how far
    they get.
  - **How to write a variant.** A wrong option's variant is the *same typical mistake in other words*,
    shorter or longer («Προσθέτω τους αριθμούς του προβλήματος» / «Προσθέτω τους αριθμούς»; «Όχι, πρέπει
    να είναι πάνω από 36 ευρώ» / «Όχι, θα είναι πάνω από 36 ευρώ»). A right option's variant comes **only
    from the book's own wording** (the strategies by their names in Ε΄ κεφ. 1.3: «Παρουσιάζω το πρόβλημα
    με σχέδιο» / «Παρουσιάζω το πρόβλημα», `STRATEGY` in lib.ts; «Το Ε.Κ.Π. των 9 και 10» / «Το Ε.Κ.Π.
    τους»; «6 + 6 + 6 + 6 = 24» / «6 × 4 = 24»), never new content. `b.choice` never takes a variant
    longer than the longest first wording (nothing new wraps), so give the shortest option a longer
    variant and the longest a shorter one. The «not wrong» options are shared (`NO_MISTAKE`,
    `NOTHING_FORGOTTEN`). Every variant says it the same way to every child: no «όλους/όλες» (check-gender
    in the audit fails a new one in an option). A prompt whose right option sits at the cap with nothing
    shorter in the book (a yes/no check, an equation as long as its wrong twin) can't be spread without
    new content: the audit lists it as a warning.
  - Aim for wrong options that are typical mistakes of every length: a «not wrong» option as short as
    the reason beside it, a shorter slip («Τους αγνοούμε» beside «Τους αφαιρούμε»), a check that checks
    nothing with a smaller result («48 − 46 = 2» beside «46 + 48 = 94»). A wrong option never shows a
    number she works out later (the audit fails it): «30 − 21» above «9 + 3 + 9 = 21» gives the sum away;
    the money less the prices, «30 − 3 − 9», doesn't. Never a strategy that would also work (a valid
    «Δοκιμάζω και ελέγχω» is not a wrong option), and give equations as many terms as the right one
    («9 × 5 − 2» beside «9 × 5 + 2»). Two answers that differ by a word of other length are told the
    same way («πάνω από / κάτω από 120 εκατοστά», not «μεγαλύτερο / μικρότερο»); names that are options
    (teams, lists, places) have one length. A false comparison in a wrong option may stay (judging it is
    the skill: «Ναι, γιατί 410 < 300»), but never a number compared with itself.
  - The curated pools (`*-problems.json`) have no prompt asked 6 times: they keep 5a's rules per choice
    and per prompt instead (the right one never the only longest; nor the only shortest in more than
    half a prompt's choices, `onlyShortest`).
- `b.numbers(phase, prompt, rows, hint)`: one row per intermediate quantity, from the
  knowns to the unknown. That chain is the point of the whole exercise.
- **Every step has a hint of its own** (the audit fails one without). Without `hint`,
  `b.numbers` writes one from the first row it can (`workHint` in lib.ts): a row's equation is
  its label («27 + 36 =») or `eq` for a row that only names its quantity (`{ label: 'Στην αρχή
  είχε', eq: '36 + 19' }`). It fits the digits («8 + 2 = 10, και μετά 3 ακόμα», «27 + 30 = 57, και
  μετά 6 ακόμα», «600 × 8 = 4.800, και μετά 6 × 8», «Πόσες φορές χωράει το 29 στο 903; Δοκιμάζουμε
  29 × 30 = 870.») and never states a row's answer, after «=» or as a trial (2.502 : 5 tries 5 × 400,
  not 5 × 500); a step it can't write one for throws. Written hints that work the row out («12 × 2 =
  24.») are listed by the audit as warnings, per family.
- A check step never states the number it asks for («Αναστοχαζόμαστε: πόσα βγαίνουν όλα μαζί;»,
  not «βγαίνουν όλα μαζί 390;» above a row whose answer is 390).
- A family never repeats its known numbers (the [..|known] marks, sorted): `gen.ts` drops the
  draft and the audit fails it, since it is the same calculation in another story.
- Division is «:» everywhere, never «÷», in every pool (the audit fails it).
- Hints and options speak the same way to every child: the audit fails check-gender's words
  (`frontend/scripts/gendered.mjs`) in a hint or an option of a family that had none there
  (`gender-baseline.json`, written by `audit.ts --gender-baseline` from the pools before #50 part
  5a); the ones already there are listed as warnings.
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
| `words` | «Πώς γράφεται με ψηφία ο αριθμός «δύο χιλιάδες σαράντα»;» (multiple choice, not a match: see «Δείξε μου») |
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
for 4.5 seconds, then closes by itself. A line holds about 40 characters at 1280×800 (35 in
words). Keep it at most 60 characters, two lines; an ordering's items have no spaces, so it breaks
only between them. A match breaks at any space, inside a pair too, so a match keeps to one line,
40 characters: `match()` keeps 3 or 4 pairs, as many as fit, and the audit fails a longer one. A
times table of four pairs (47) left «4 × 3 –» on one line and «12» on the next; three are 34–36.
Three pairs of numbers in words came to 75–99 characters, three lines with pairs split across
them, too much for a Γ΄ child in 4.5 s; so the `words` families are multiple choice, the same
digits in other places as the options. The 4.5 s is the screen's limit, not the pool's: holding
the answer until a tap is a follow-up.

**Greek and realism.** Speak to the child in the imperative or second person («Υπολόγισε»,
«Κύκλωσε», «Βάλε», «Έχεις»), the same to every child: the audit fails check-gender's words (the
list is `frontend/scripts/gendered.mjs`), so no «Ποιος αριθμός…» (say «Γράψε τον αριθμό…»), no
«όλους». Number words agree: thousands are feminine («τρεις χιλιάδες», «διακόσιες χιλιάδες», «είκοσι
μία χιλιάδες», «χίλια» alone), the rest neuter («τρία εκατομμύρια», «εκατόν»/«εκατό»); nouns
agree with 1 («1 κέρμα του 1 λεπτού», «2 κέρματα των 5 λεπτών»). The books' symbols: `:`, `×`, `−`
(U+2212), numbers with their dots. Γ΄ uses «εφτά, οχτώ, εννιά» in words. Magnitudes as in the book:
Γ΄ money up to a few hundred euros, Ε΄ numbers into the millions.

**Counts.** 120 per grade (four months of one a day); the audit fails under 60. `npm test`
(dailyMix.test.ts) prints how many days pass before an item comes back; for the grades the kids are
in (`KIDS_GRADES`) a mix category under 30 days, or filled from revision, fails.

## Plain language (`language/`)

The daily language card of the Γ΄ and Ε΄ kids (#49 parts 3a and 3b): plain exercises in the existing
types, no new widget. Unlike the maths, the items are **written by hand**, close to the book's own
sentences, because templated Greek reads badly: `language/g3.ts` lists 80 of them from «Τα απίθανα
μολύβια», units 1–3, and `language/e5.ts` 68 from «Της γλώσσας ρόδι και ροδάνι», units 1–2 (each to
about the end of October; later units come with #71's month gating). `language/gen-language.ts` writes
them to `backend/exercise-pools/g-dimotikou-language.json` and `e-dimotikou-language.json` with their
ids (`g3-lang-*`, `e5-lang-*`), source and generatorParams, shuffling the options seeded by the id.

```bash
$N node tools/problem-gen/language/gen-language.ts    # write the pool (stops on an item that breaks a rule)
$N node tools/problem-gen/audit.ts                    # audit everything (problems, maths, language)
$N node tools/problem-gen/audit.ts --sample tools/problem-gen/.sample.md 20 --all-language   # every language item, to read
```

**Where each item comes from.** `language/curriculum.ts` holds the book's units and lessons with the
pages each takes in the student book and the workbook (printed numbers, one less than the PDF's). An
item names its place as `'2.2 τ23'` (unit 2, lesson 2, workbook page 23; lesson 0 is the unit's
Λεξιλόγιο, `β` the student book); its `source` reads «Γλώσσα Γ΄, ενότητα 2: Στο σπίτι και στη γειτονιά,
μάθημα 2: Η φίλη μας η Αργυρώ (τετράδιο εργασιών, σ. 23)». The audit fails a page outside the lesson
or a unit the class hasn't reached (`units`). Ε΄'s workbook sections don't follow the book's texts, so
a lesson is a student-book text (1.1–1.3, 2.1–2.4, under the heading the book prints) and then each
workbook section, numbered after them (1.4–1.7, 2.5–2.8). A grade's `reference` pages are what the
lexicon may cite besides the lessons: Γ΄'s grammar summary (β85–87), and for Ε΄ the grammar book
«Γραμματική Ε΄ και ΣΤ΄ Δημοτικού» (10-0138, `γ104`) for the paradigms units 1–2 use but don't print
in full (λεωφόρος, the -ης/-ες adjectives, numerals, the conjugation tables). An item never cites it.

**The lexicon** (`language/lexicon/g3.ts`, `lexicon/e5.ts`): the words the audit checks against, typed
out of `materials/` at development time with the page each comes from: nouns with their forms by case
and number, adjectives in three genders, verbs by person in a tense and mood (a compound tense is one
form, «έχουν μολυνθεί»; a subjunctive without its «να»), the words of an exercise or a spelling list as
the page prints them, opposites, synonyms, word families, the book's phrases with the meanings it offers
(right and wrong), similes and proverbs; for Ε΄ also the pieces of a sentence and what they tell
(`expressions`: χρόνο, τόπο, τρόπο, with their kind; «αργά» tells two), compounds with their parts,
numerals with their number and kind, the book's definitions and the ones too close to offer together
(`confusable`). Every form is written out; nothing builds a form from a stem, and nothing reads
`materials/` when the audit runs. Words on check-gender's list stay out (φίλος, όλοι, έτοιμος, μόνος…;
the β20 proverbs with «όποιος» and «όλοι»).

**Skills and their wordings** (`generatorParams.skill`; the audit's solver reads the wording and
derives the key again from the lexicon and the rule, written apart from the items):

| skill | wording | rule |
|---|---|---|
| `pos` | «Κύκλωσε το ρήμα/ουσιαστικό της πρότασης: «…»», or «ένα ουσιαστικό» when the sentence has more than one; true-false «Στην πρόταση «…» η λέξη «…» είναι ρήμα.» | part of speech from the lexicon; options are words of the sentence; every word of the sentence is in the lexicon, and «το» means it has exactly one |
| `gender` | «Κύκλωσε το αρσενικό/θηλυκό/ουδέτερο ουσιαστικό.» | the noun's gender |
| `agree` | a gap ({0} or «…») after an article, or an article before a word | the article's gender, case and number (and the noun's after an adjective) |
| `alpha` | ordering «Βάλε τις λέξεις σε αλφαβητική σειρά.» | Greek collation, accents ignored |
| `week` | ordering «Βάλε τις μέρες της εβδομάδας στη σειρά, από τη Δευτέρα.» | Δευτέρα … Σάββατο |
| `capital` | fill-blank of a proper noun; true-false «Η λέξη «…» γράφεται πάντα με κεφαλαίο.» | proper nouns of the lexicon; the rest are its slips (small letter, a misspelling) |
| `person` | fill-blank «Εμείς {0} γείτονες.», «Ο Γιάννης {0} …», «Οι γονείς μας {0} …» | the verb form of the subject's person |
| `opposite`, `synonym` | «Κύκλωσε το αντίθετο της λέξης «…».», «Κύκλωσε τη λέξη που σημαίνει το ίδιο με τη λέξη «…».» | the lexicon's pairs |
| `family` | «… ανήκει στην οικογένεια της λέξης «…».», «… δεν ανήκει στην ίδια οικογένεια με τις άλλες.» | the lexicon's families |
| `meaning` | true-false «Η φράση «…» σημαίνει «…».»; «Τι σημαίνει εδώ η φράση «…»;» with the sentence as body | the book's meanings, right and wrong |
| `saying` | body «Συμπλήρωσε την παρομοίωση/παροιμία.», the saying with «…» | the lexicon's sayings |
| `san` | «Τι σημαίνει το «σαν» στην πρόταση «…»;» | before a verb «όταν», before a noun «όπως» (τ44) |
| `punct` | fill-blank with the gap right after a word, options «.», «;», «,» | a question word first: «;»; a small letter after: «,»; «.» only after a sentence with no verb («Πολλούς χαιρετισμούς από τη Μάνη», τ41): a Greek yes/no question is the statement with «;», so a sentence with a verb and no question word could take either |
| `spell` | «Κύκλωσε τη λέξη που είναι γραμμένη σωστά.» | one spelling of the lexicon; the rest one or two slips of it (ι/η/υ/ει/οι, ο/ω, ε/αι, ευ/εφ, a double letter) |
| `tense` (Ε΄) | «Κύκλωσε τον χρόνο του ρήματος «κυλούσε».», the sentence as body; options tense names | the form's tense; the whole form is asked («έχουν μολυνθεί»), and a form that is also a subjunctive or imperative isn't |
| `retense` (Ε΄) | «Βάλε το ρήμα στον αόριστο: «Το πλοίο πλησιάζει τις Κυκλάδες.»» | the sentence's one verb form; options are its forms in the same person, one in the asked tense |
| `time` (Ε΄) | «Κύκλωσε αυτό που φανερώνει χρόνο στην πρόταση.» (options are pieces of the sentence); «Τι είναι το «…» στην πρόταση;» (επίρρημα, φράση με πρόθεση, φράση σε αιτιατική, χρονική πρόταση: the books' own words, β9 and τ8) | the `expressions`: one piece tells time; its kind |
| `mood` (Ε΄) | «Κύκλωσε την έγκλιση του ρήματος «πάρε».», options as the tables name them («οριστική ενεστώτα», «συνοπτική προστακτική», …) | after «να» or «μη(ν)» the subjunctive, without them never; a form still two moods (ακούτε) is an error |
| `negation` (Ε΄) | fill-blank before a verb, options δε, δεν, μη, μην | δε(ν) with the indicative, μη(ν) with the subjunctive (β26), -ν before a vowel, κ π τ μπ ντ γκ ξ ψ (γ55); only after «να», before «θα» or before a past tense, where nothing else could follow |
| `adverb` (Ε΄) | «Τι φανερώνει το επίρρημα «εμπρός» στην πρόταση;», options τόπο, χρόνο, τρόπο | what the adverb tells; one that can tell two (αργά) is never asked |
| `numeral` (Ε΄) | «Κύκλωσε το τακτικό αριθμητικό του 7.», «Κύκλωσε το αναλογικό αριθμητικό.» | the numerals' number and kind (β37) |
| `compound` (Ε΄) | «Κύκλωσε τη σύνθετη λέξη με συνθετικά «οίκος + πεδίο».», «… που έχει α΄/β΄ συνθετικό τη λέξη «οδός».» | the compounds' parts; a part the lexicon doesn't know can't be ruled out |
| `define` (Ε΄) | «Κύκλωσε τη λέξη που ταιριάζει στον ορισμό: «…».» | the book's definitions; never two `confusable` words together (αφετηρία, σταθμός, στάση, τέρμα) |

`agree` also reads a gap with no article before it: before a noun it takes the noun's form («λεπτά και
… συναισθήματα»), after «είναι» the subject's in the nominative («Η διαφορά στον ήχο είναι …»); and it
fails the masculine genitive of an -ης adjective, since everyday speech says «του διεθνή» (γ104) and that
right answer would be offered as wrong. `person` reads «Ένα/Μια …» as the 3rd singular, and every option
must be a form of the lexicon or a slip of one.

A wrong option may be a real word (another person, case or article: that is the point), but never
one the rule also accepts: the audit fails an item with more than one acceptable option. A new
wording needs its solver in `language/check.ts`.

**Not giving the answer away.** At least 3 options; the right one never the only longest. The title names
none of the options or all of them: «Της ή τις;» over τις · της · των rules «των» out before she reads the
sentence, so the title is «Τα άρθρα της, τις, των». A spelling
choice crosses two places a word is often misspelt, four spellings with one right (τηλεόραση,
τιλεόραση, τηλεώραση, τιλεώραση): with each wrong spelling one slip from the right one, a vote letter
by letter would find it, so the audit fails a right option that is the one closest to all the others.
A fill-blank has one gap, a whole word (a punctuation mark right after one), never inside a word, so no
last gap is left over by elimination; and its sentence fits one line with the gap (43 characters
besides it at 1280×800: `FillBlankRenderer` lays the pieces between gaps out as blocks, so a long piece
jumps whole to the next line). «Δείξε μου» at most 60 characters (a match 40), as for the maths.

**Types.** True-false at most 10 % and «Σωστό» 40–60 % of the pool's true-false items; fill-blank at
most 40 % (a gap in a sentence is the book's own «Συμπλήρωσε»); no number-input.

**Greek.** The book's terms (ρήμα, ουσιαστικό, γενική πτώση, αόριστο άρθρο, κύρια ονόματα,
παρομοίωση, συνώνυμα), its sentences and names where it has them. Speak to the child in the imperative
(«Κύκλωσε», «Συμπλήρωσε», «Βάλε»), the same to every child: the audit fails check-gender's words
anywhere she reads (title, body, question, options, items), so «όλες τις θάλασσες» became «Τα δελφίνια
πλησιάζουν συχνά τις ακτές», and «Είμαι πολύ θυμωμένος» «Αγανακτώ, θυμώνω πολύ». Adjectives are cited
in the masculine, as the book's word lists do. Every word of two or more syllables has its accent (the
audit knows μια, για, πιο, δυο… as one syllable); no Latin letters. Read every item before committing
(`--all-language`).

**Counts.** 60–80 good items rather than padded ones; the audit fails under 60. Γ΄ has 80, so an item
comes back after 80 days; Ε΄ has 68, back after 68.

## Layout
- `lib.ts`: randomness, names, counted nouns, step builders, `Family`.
- `families/g3/`, `families/e5/`: one file per family; `index.ts` lists them (sets
  `set-*.ts` group families written together).
- `gen.ts`, `audit.ts`: see the top of each.
- `prices.ts`: what things cost and what she pays with (change-left, the world's purchases).
- `story-check.ts`: the audit's reading of who a story means, the order of events, checks and prices,
  for every pool; `story-check.test.ts`: a story per rule.
- `maths/`: the plain maths (`curriculum.ts`, `grades.ts`, `lib.ts`, `g3.ts`, `e5.ts`, `gen-maths.ts`, `check.ts`).
- `language/`: the plain language (`curriculum.ts`, `lexicon.ts` and `lexicon/g3.ts`, `lexicon/e5.ts`, `lib.ts`, `g3.ts`, `e5.ts`, `gen-language.ts`, `check.ts`).

## World models (`world/`)

A world is quantities and relations (out = a op b); a problem picks a question and
states the rest, and a solver finds which facts are needed, so the same sentence is
needed in one problem and extra in another. Pieces of text remember their quantity, so
the painting check knows each fact's words, and the calc step can read back any
calculation. `world/run.ts` prints a sample and how far lazy strategies get;
`world/gen-world.ts` writes `backend/exercise-pools/g-dimotikou-world.json`. Every
other valid way to work it out must read back, or a right calculation reads back as
meaning nothing. Mostly as a quantity of its own (the other order of two changes, two
changes taken together). The exception is a × done by hand (#50 part 3a): adding or
taking away its same-unit factor again and again (58 − 9 − 9 − 9 − 9, 8 + 8) is read by
the checker (`readLines` in shared/problems.ts: runs), not written as partial quantities.
Partials in the world would enter the solver, and `problem()` refuses a problem where a
needed fact can be done without (world.ts, «Needed must be the only way»), so they would
change which problems are made. So a × relation must give its product's unit to exactly one
factor (the each, the stock «διπλάσια» doubles), and the other, how many times, is at most
10: `audit.ts` checks both.
Questions that refer to what the story tells (the item bought, «η νονά της», «αυτές τις
εβδομάδες») go in `late` and are asked only at the end.

**Painting and sentences** (#50). The painting check (`checkPaint`, `paintStrays` in
shared/problems.ts) lets her paint a needed fact's sentence whole; only around an unneeded
fact does a stroke count as too much: in its own sentence, or, in a sentence that also holds a
needed fact, in the clause (split at «,» and «:») that holds it. ⚪ («Δεν χρειάζεται», on
«paint-all») is the other way round: she may paint an unneeded fact's own sentence ⚪ whole,
but ⚪ in a sentence with a needed fact, the question or no fact at all counts as too much,
so painting the whole story ⚪ and the needed phrases over it fails. Since #50 part 4 a
sentence that holds both kinds may be painted whole but the unneeded fact's clause; before,
it had to be painted phrase by phrase. So the words that belong only to an unneeded fact must
be inside its mark, its own clause or its own sentence: a table row is marked whole, its name
and verb too («[Ο Πέτρος πήρε 81 ψήφους|extra], [ο Γιώργος 133 ψήφους|known]»); an aside goes
between commas («Στην τάξη της Άννας, [μέσα σε 6 μήνες|extra], μάζεψαν…», «[που έχει 5 δέντρα
στον κήπο της|extra]»); a sentence doesn't open with a subject and verb that only an unneeded
first row uses («… μετράει τα εισιτήρια που πουλάει. Πούλησε …»). `npm test` (backend) paints
every shipped problem that way, on both painting rungs. A story with no unneeded fact passes
painted whole (36 world stories; `audit.ts` allows them). `world/run.ts`'s painting `grade()` is a prototype
printout, not the check. So far one world, Γ΄ only: a
child's money or collection that changes, friends compared, their own collections.

**Who a sentence means** (#50). A sentence's `say(S, told)` gets its subject and what the
sentence before said (`told`: whose it was, who else it named), and `problem()` decides:
- the subject stays out only when the sentence before was about the same person and named
  no one else («Ο Γιώργος χάρισε 19 βόλους στη Σοφία. Τώρα ο Γιώργος έχει 34», not «Τώρα
  έχει 34»); a change right after a sentence that opened with that name says «Μετά ο
  Γιώργος…», and «Τότε ο Στέλιος είχε…»; a story where two sentences in a row would still
  open with one name is dropped;
- a receiver is named until the clitic is clear: «Ο Αλέξης χάρισε 12 κάρτες στην
  Κατερίνα», and «της χάρισε» only right after a sentence about her that named no one else, when no
  one else of her gender could be meant (a sibling, a relative, a child named before: `Told.clear`);
  a gift question «Πόσα ευρώ της έδωσε η γιαγιά της;» the same way, else «… έδωσε στην Ελένη η γιαγιά
  της;»; «Αναρωτιέται» names her after a sentence that names someone else too, relatives included;
- the question names the hero whenever anyone else is the subject of a sentence, and the
  questions that had no subject say whose («Πόσο κόστιζε το παζλ που αγόρασε ο Πέτρος;»).

**Time.** Every «Τώρα» comes after the last event: nothing changes after it. A friend takes
part in one event only, so their stock changes once (a gift from them and one to them in
the same story is dropped): their «… τώρα» relation then holds every change they were in.
Two events with one friend would need the friend's stock to go through both, with its own
other order and net, so every right way reads back; that isn't built.

**Checks** have at least 3 options, the typical slips: a change the other way, starting from
the answer instead of the start, the other operation, the answer with the other number. A
problem that can't have 3 is dropped.

**In every family** (#50 part 5b) the same reading holds, and `story-check.ts` runs on every pool,
generated and curated, as audit errors (a story that fails is a family bug: fix it in the family;
`story-check.test.ts` has a case per rule, `node --test tools/problem-gen/story-check.test.ts`):
- relatives and friends are people («η γιαγιά», «ο θείος», «η φίλη της»): a sister or a friend in a
  noise sentence is someone the next «του/της» or nameless question could mean;
- a question names whom it means when its verb is singular and it has no subject of its own, once two
  people are subjects; and, the worst case, right after a sentence whose subject is someone the story
  isn't about («… Η αδερφή της είναι 7 χρονών. Πόσα ευρώ θα πάρει πίσω;»): say «… πίσω η Σοφία;».
  A grown-up at work («ο οδηγός», «η δασκάλα», «ο προπονητής», «ο υπεύθυνος», …) is someone else too when
  a child is the story's subject or their sentence is noise («… Ο οδηγός κάνει αυτή τη δουλειά 19 χρόνια.
  Πόσα χιλιόμετρα διάνυσε συνολικά το φορτηγό;»), not when they do what is asked («Ο γυμναστής θέλει να
  τους βάλει σε ίσες σειρές… Με πόσους τρόπους μπορεί να το κάνει;»); a new grown-up goes in `AT_WORK`.
  A plural verb («μάζεψαν και οι δύο μαζί»), its own subject («η ρόδα», «ο καθένας», «ποιο παιδί»,
  «κάθε σειρά», not «κάθε εβδομάδα»; a neuter «το καρουζέλ» only after a verb like «έχει», «κοστίζει», «φτάνει») and a verbless
  follow-up («Πόσα ευρώ λιγότερα;») need no name. «Έχει δίκιο;» after other children: «Έχει δίκιο η Άννα;»;
- «Αναρωτιέται» follows the clitic's rule: whoever wonders is named in it, or is the one person of the
  sentence before, or the only one so far («Η Σοφία χάρισε 25 βόλους στην Ελένη. Αναρωτιέται η Σοφία…»);
- after «Τώρα», a sentence opening with «Νωρίτερα» (no comma) tells what came before: start-unknown's
  backward telling («Τώρα η Κατερίνα έχει 115 αυτοκόλλητα. Νωρίτερα αγόρασε άλλα 39…»);
- the same «<noun> του/της <someone>» isn't said in two told sentences in a row («Στο άλμπουμ του
  Στέλιου … Το άλμπουμ έχει 40 σελίδες»); a question and the sentence after it may repeat it;
- a child's name is never in lowercase: lowercasing «Ο παππούς του Μάρκου» for the middle of a
  question lowercases only the article.
