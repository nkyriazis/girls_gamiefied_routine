// Dev only: a kid's daily exercise for today in one category is this one, fresh.
//   dev.sh exercise u2 g2-lang-article-1
// It takes the category from the exercise (read from the pools) and replaces today's daily
// (not extra) assignment of that category, so a scene can show any item of the pools.
const { DatabaseSync } = require('node:sqlite');
const { readdirSync, readFileSync } = require('node:fs');
const [userId, exerciseId] = process.argv.slice(2);
if (!userId || !exerciseId) throw new Error('usage: exercise.js <userId> <exerciseId>');
const category = new Map();
for (const f of readdirSync('/app/exercise-pools').filter(f => f.endsWith('.json')))
  for (const e of JSON.parse(readFileSync(`/app/exercise-pools/${f}`, 'utf-8')).exercises) category.set(e.id, e.category);
const cat = category.get(exerciseId);
if (!cat) throw new Error(`${exerciseId} is in no pool`);
const db = new DatabaseSync('/app/routine.db');
const today = db.prepare('SELECT MAX(date) AS d FROM exercise_assignments').get().d;
const row = db.prepare('SELECT id, exerciseId FROM exercise_assignments WHERE userId = ? AND date = ? AND (extra IS NULL OR extra = 0)')
  .all(userId, today).find(a => category.get(a.exerciseId) === cat);
if (!row) throw new Error(`${userId} has no ${cat} exercise on ${today}`);
db.prepare(`UPDATE exercise_assignments SET exerciseId = ?, status = 'pending', attempts = 0, completedAt = NULL, starsAwarded = NULL WHERE id = ?`)
  .run(exerciseId, row.id);
console.log(userId, today, cat, row.exerciseId, '→', exerciseId);
