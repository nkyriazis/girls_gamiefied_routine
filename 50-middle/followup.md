Title: Problem choices: the yes/no checks give the answer away by polarity (#50 part 5e)

Part of #50. Found while scoping part 5c (the place by length), left out of it on the owner's word.

**Problem.** In a check whose options all open with «Ναι» or «Όχι», the right option is almost
always the odd one out: one «Ναι» among two «Όχι» (or the reverse). A child who taps the option whose
first word differs from the others, without reading, wins:

| Pool | yes/no choices | right option the odd polarity |
|---|---|---|
| g-dimotikou-generated (Γ΄) | 112 (111 after 5c) | 104 (103), 93 % |
| e-dimotikou-generated (Ε΄) | 58 (59) | 44 (45), 76 % |
| curated Γ΄ + Ε΄ | 5 | 5 |

At random the odd one out would win a third. Families where it is every time: Γ΄ bus-stops 20/20,
two-digit-times 16/16, change-left 12/12, estimate-first 10/10, two-purchases 9/9, collection-goal
8/8, buy-and-change 7/7, equal-groups 7/7, ages 6/6; Ε΄ unit-rate 20/20, group-tickets 5/5,
big-table 4/4. Counted by `.evidence/50-middle/yesno.mjs` (before-yesno.txt on master, after-yesno.txt
on the 5c branch).

**Cause.** The checks are written as one «Ναι, …» (the reason it holds) and two «Όχι, …» (two typical
mistakes, each a reason it wouldn't), e.g. families/g3/change.ts «Ναι, είναι λιγότερα από τα 335 ευρώ»
beside «Όχι, πρέπει να είναι πάνω από 335 ευρώ» and «Όχι, πρέπει να είναι 495: όλα μαζί». Part 5c's
wordings change lengths, not polarity.

**What a fix could be** (for the owner to choose):
- A. Two options of each polarity where a check has four, or a second «Ναι» that is a wrong reason
  («Ναι, γιατί είναι πάνω από 335 ευρώ»): the typical mistake of judging right for a wrong reason.
  The right option is then not the odd one out by its first word.
- B. Checks without the yes/no lead: the options name the reason only («Είναι λιγότερα από τα 335
  ευρώ», «Πρέπει να είναι πάνω από 335 ευρώ»), the prompt asks «Γιατί;» or «Τι ισχύει;».
- C. Some checks where «Όχι» is right (a claimed answer that is wrong, as Ε΄ budget and together-again
  already do: 12/20 and 0/3).
- And an audit rule like 5c's place rule: per family and prompt, the right option is not the odd
  polarity more often than a fair die allows.

**Blast radius.** Option wording in about 25 families' check steps; stories unchanged. No schema,
screen or voice change.
