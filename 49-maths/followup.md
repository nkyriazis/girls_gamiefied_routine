# Daily exercises: play a family only from the month its chapter is taught (problems and maths)

Follow-up to #49 part 2. Title above; body below, for the owner to open as an issue when part 2 merges.

## What happens

The generated problems (`tools/problem-gen/families/`) and the plain maths (`tools/problem-gen/maths/`) are limited to the units each class covers **by autumn**: Γ΄ units 1–3, Ε΄ units 1–2. Every family in those units plays from the first day of school. Two things follow:

- In September the Γ΄ kid can get «Διαίρεση με υπόλοιπο» (ch. 18) or «Πόσο κάνει 23 × 4;» (ch. 11/17) before her class has reached them, and the Ε΄ kid Euclidean division (2.12) in the first week.
- From about December on, nothing new comes: Γ΄ fractions (ch. 22–26), four-digit numbers (ch. 27, 40, 53), Ε΄ fractions (3.13+), decimals (5.25+) and the rest of the year never reach the daily set. The 120 maths items per grade also run out in four months and start coming back.

## Proposal

- Give each chapter in `tools/problem-gen/maths/curriculum.ts` the month it is usually taught (from the teacher's book's yearly plan: 10-0064 for Γ΄, 10-0213 for Ε΄), and let families of later units in, with their `source` and `generatorParams.unit` as now.
- Store the month (or the chapter) on each generated item, problems and maths alike, and make `drawDailySet` (backend/src/exercisePool.ts) skip items whose month hasn't come yet, in the school year of `settings.timezone`. A setting could shift it per kid (a class ahead or behind).
- Write the families of the later units: Γ΄ fractions and decimals, four-digit operations, time, mass, area; Ε΄ fractions, decimals, percentages, measures. The audit already fails a source outside `units`; the range check (largest number, no fractions or decimals) becomes per chapter.
- Raise the per-grade count accordingly, so each month has fresh items, and let `npm test`'s table count only the items open in a given month.

## Out of scope

Language pools (#49 part 3) and the group game. The owner's tracker decisions (#51) stand.

---

# «Δείξε μου»: hold the answer until a tap, or give it time by its length

A second follow-up to #49 part 2, from its review. Title above; body below, for the owner to open as an issue when part 2 merges.

## What happens

On «Δείξε μου» (forgiving rung) and after the last try (unforgiving rung), `AssignmentPlayer` shows «Η σωστή απάντηση: …» at 2.5rem and closes the player by itself after 4.5 s (frontend/src/components/AssignmentPlayer.tsx, `onClose` after 4500 ms). Every answer gets the same 4.5 s, whether it is «Σωστό» or a two-line ordering of seven-digit numbers. A Γ΄ child can't read two lines of numbers in that time, and once it closes she can't get it back.

Part 2 works around it in the pool: the generator keeps a revealed match to one line (40 characters) and anything else to two (60), and the number-words items became multiple choice because three pairs of them took three lines. That keeps what she sees short. It doesn't give her more time.

## Proposal

- Keep the answer on screen until she taps it («Εντάξει» or a tap anywhere), as a routine card waits for its ✕. Or, at least, give it time by its length (say 4.5 s plus a second per 10 characters).
- Show a match one pair per line (a – b under each other), not as one run of text, so a pair never breaks across lines.
- After that, the pool caps (`REVEAL_MAX`, `REVEAL_MATCH_MAX` in tools/problem-gen/maths/check.ts) can be relaxed, and the number-words match could come back as a match.

## Out of scope

The tracker #51 decisions stand. The sounds stay as they are.
