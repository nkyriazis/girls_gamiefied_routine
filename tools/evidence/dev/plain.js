// Dev only: today's plain exercises fresh again, for both kids
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/app/routine.db');
const r = db.prepare(`UPDATE exercise_assignments SET status = 'pending', attempts = 0, completedAt = NULL, starsAwarded = NULL
  WHERE date = (SELECT MAX(date) FROM exercise_assignments) AND (extra IS NULL OR extra = 0)
  AND exerciseId NOT LIKE '%problem%' AND exerciseId NOT LIKE '%-gen-%' AND exerciseId NOT LIKE '%-world-%'`).run();
console.log('plain reset', r.changes);
