# Comment drafts from #48 (the main session posts them on the owner's word)

---

## On #26 (the group game)

The #48 PR changes something this game uses: `MultipleChoiceRenderer` now shuffles its options and labels them with Greek Α–Δ, as the problems' choices already did. The order comes from a seed. In the group game the seed is the exercise id (the default, since `ExerciseGame` passes none), so every player sees the same order for the same question, and the order stays the same across a re-render or a reload. The answer sent is still the option's own index, so `checkExerciseAnswer` and the game's scoring are unchanged. The group game's stars are not touched by the forgiveness ladder: it applies only to a kid's own daily and extra exercises. If the game should draw a new order each session, pass `seed={`${session.id}:${exercise.id}`}` in ExerciseGame.tsx.

---

## On #50 (checker strictness and generator follow-ups)

From #48, for this issue:

1. **Paint and calc mistakes are free for now.** Wrong paintings and calc slips don't cost stars (`stepCounts` in shared/forgiveness.ts), and on both rungs those steps play the forgiving way. Their checkers are still too strict. Once they are fixed here, turn them back on: remove the `paint`/`calc` exception in `stepCounts`, and update the tests in backend/test/forgiveness.test.ts and the CLAUDE.md note.
2. **The longest option is often the answer.** In e-dimotikou-generated, the right choice is the strictly longest option in 362 of 642 choices (56%). Shuffling hides its position but not its length (`.evidence/48/choice-stats.txt`).
3. **Steps with no hint of their own.** 105 Γ΄ and 115 Ε΄ generated numbers steps have no `hint`, so a wrong try says only «Διάβασε ξανά την ιστορία». «Δείξε μου» now covers a stuck kid, but the hint should still exist.
