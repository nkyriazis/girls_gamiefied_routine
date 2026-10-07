# Follow-up issue from #36 part 1 (text to open; the owner decides)

---

**Title:** Προχωρημένα → Ρυθμίσεις (JSON): warn about mistakes the schema can't see (colour typo, blank name, duplicate ids, links to a missing kid), without refusing the file

The kids' form (#36) can't make these mistakes, but the JSON editor still can, and the schema says nothing. `POST /api/admin/validate` answers `{"valid":true}` to data.json with each of these (#36's before-validate.txt):

- a colour typo: `"color": "var(--color-secondry)"`. The browser drops a style it can't resolve, so the dock avatar (`background: user.color`, Dashboard.tsx) would lose its colour (read from the code, not played).
- a blank name: `"name": "  "` (the schema's `minLength: 1` counts spaces).
- two kids with the same id: `u1` twice. Stars, history and routine runs are keyed by the id, so the two would share them.
- an assignment to a kid who is gone: `routineAssignments[0].userId = "u3"`. The backend skips it quietly (`usersView` in db.ts).

The same goes for other links between lists: a `routineTasks[].taskId` or `routineId` that doesn't exist (db.ts skips the task), a `schedules[].targetId` that names no flow or assignment, a chore's `eligibleUsers` with a missing kid, duplicate ids in tasks, routines, flows, rewards, chores or schedules.

**Not as schema rules.** piserve's live data.json loads through the same schema. A new rule that its data happens to break would make the config invalid at startup (the backend then keeps the last valid one, or an empty fallback after a restart) and block every form's save until someone fixes the file by hand. These checks must never make a file fail to load.

**Proposal:** a pure `configWarnings(config): { path: string; message: string }[]` in `shared/` (so the editor and the server share it), covering the cases above. Colours: a theme `var(--color-…)`, a hex, or anything `CSS.supports('color', v)` accepts in the browser.
- The JSON editor lists them under the errors, in a softer style («Προσοχή: …», in Greek), and still saves. A save with warnings could ask once more («Αποθήκευση παρ' όλα αυτά»).
- `/api/admin/validate` returns them as `warnings` next to `valid`. The status call and the parent's Σήμερα could show a count, so a hand edit made over ssh gets noticed too.
- Tests: each case above gives one warning, and piserve-shaped data (the dev data.json) gives none.

Out of scope: refusing such a file, or changing the schema.
