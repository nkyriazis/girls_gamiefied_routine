# Follow-up issues from #48 (drafts; the owner decides whether to open them)

---

## Extra problems: set one aside and ask for another

**Today.** An extra problem that is still open takes the place of «🧩 Κι άλλο πρόβλημα». The button changes to «▶ Συνέχισε το πρόβλημα», and `startExtraProblem` (backend/src/db.ts) returns the open problem instead of a new one. To get a different problem, the kid has to finish this one first. Since #48 she can no longer be stuck: «💡 Δείξε μου» shows a step worked after 3 wrong tries. But she may still not want to do this problem now, and today the only way out is to give up on extras for the day.

**Proposal.** In the problem player, «Άφησέ το για μετά» marks the open extra as set aside. This needs a new column, a store migration, `state.schema.json` and shared/types. `startExtraProblem` then starts a new problem. The set-aside problems show as cards she can reopen, and they still count toward `extraProblemsPerDay`, so setting one aside earns nothing.

**Questions for the owner.** Can she set aside more than one? Does a set-aside problem still count for the day? Do unfinished ones carry over to the next day, or disappear at midnight?

---

## Parent: see how the exercises went (paid x of y, shown worked)

**Today.** Since #48 an exercise can pay less than its stars: one star less per problem step that went wrong, 0 for a plain exercise answered wrong first, and a step or answer can be shown worked. Ιστορικό lists only the stars earned. A parent can't see that Ηλέκτρα got ⭐1 of 4 on a problem because three steps went wrong, or that she used «Δείξε μου» twice. That is what a parent needs to know when choosing between Συγχωρετικό and Αυστηρό.

**Proposal.** In Ιστορικό, each exercise shows «⭐ paid of stars», the wrong tries per step (`mistakes`), and which steps or answers were shown worked. The shown ones are in the action log today: `EXERCISE_ASSIGNMENT_REVEAL`, plus `EXERCISE_PROBLEM_STEP` with the rung. They may need their own field on the assignment, which means a store migration. A weekly line per kid could summarise it, e.g. «12 ασκήσεις, ⭐30 από 41, 4 βήματα με Δείξε μου».

**Questions for the owner.** Per exercise, or a daily or weekly summary? Should it show the phrases she tagged wrong, or only counts?
