// Dev only: point a kid's problem assignment for today at a given problem and make it fresh.
const { DatabaseSync } = require('node:sqlite');
const [userId, exerciseId] = process.argv.slice(2);
const db = new DatabaseSync('/app/routine.db');
const r = db.prepare(`UPDATE exercise_assignments SET exerciseId = ?, status = 'pending', attempts = 0, stepIndex = NULL, mistakes = NULL,
  completedAt = NULL, starsAwarded = NULL WHERE userId = ? AND date = (SELECT MAX(date) FROM exercise_assignments) AND (exerciseId LIKE '%problem%' OR exerciseId LIKE '%-gen-%' OR exerciseId LIKE '%-world-%') AND (extra IS NULL OR extra = 0)`).run(exerciseId, userId);
console.log(userId, exerciseId, r.changes);
