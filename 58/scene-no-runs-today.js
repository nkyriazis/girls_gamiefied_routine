// Dev only, scene for #58: a kid has no routine execution that started today (Europe/Athens),
// so a skip in the take can only come from the run she starts in that take.
//   node scene-no-runs-today.js u1
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/app/routine.db');
const userId = process.argv[2];
if (!userId) { console.error('usage: scene-no-runs-today <kid>'); process.exit(1); }
const tz = 'Europe/Athens';
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const today = fmt.format(new Date()).slice(0, 10);
const [y, m, d] = today.split('-').map(Number);
let start;
for (let h = -14; h <= 14 && !start; h++) {
  const t = Date.UTC(y, m - 1, d) - h * 3600e3;
  if (fmt.format(t) === `${today}, 00:00`) start = new Date(t).toISOString();
}
if (!start) { console.error('no local midnight found'); process.exit(1); }
const ids = db.prepare('SELECT id FROM routine_executions WHERE userId = ? AND startedAt >= ?').all(userId, start).map(r => r.id);
let tasks = 0;
for (const id of ids) tasks += db.prepare('DELETE FROM task_executions WHERE executionId = ?').run(id).changes;
const runs = db.prepare('DELETE FROM routine_executions WHERE userId = ? AND startedAt >= ?').run(userId, start).changes;
const left = db.prepare('SELECT COUNT(*) AS n FROM routine_executions WHERE userId = ? AND startedAt >= ?').get(userId, start).n;
console.log(userId, 'today from', start, 'executions removed', runs, 'task executions removed', tasks, 'executions left today', left);
