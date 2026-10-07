// Dev only: a chore a kid says she did («Το έκανα!»), waiting for a parent to confirm or reject it.
//   dev.sh chore u1 chore-dishes     claimed by u1 and attempted now; its id is printed
//   dev.sh chore undo                remove the ones this made
// Its id starts with c4073000-, so `undo` (and the next call) takes exactly those away. The screens pick
// it up on their next load (this writes past the server, so nothing is pushed).
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/app/routine.db');
const PREFIX = 'c4073000-0000-4000-8000-';
const [kid, choreId] = process.argv.slice(2);
const gone = db.prepare('DELETE FROM chore_instances WHERE id LIKE ?').run(PREFIX + '%').changes;
if (kid === 'undo') { console.log('removed', gone, 'chore(s)'); process.exit(0); }
if (!kid || !choreId) { console.error('usage: chore <kid> <choreId> | chore undo'); process.exit(1); }
const now = Date.now(), iso = ms => new Date(ms).toISOString();
const id = PREFIX + String(now % 1e12).padStart(12, '0');
db.prepare(`INSERT INTO chore_instances (id, choreId, status, availableAt, expiresAt, claimedBy, claimedAt, attemptedAt)
  VALUES (?, ?, 'attempted', ?, ?, ?, ?, ?)`).run(id, choreId, iso(now - 30 * 60e3), iso(now + 4 * 3600e3), kid, iso(now - 20 * 60e3), iso(now - 60e3));
console.log('chore', id, choreId, 'attempted by', kid, '| earlier ones removed:', gone);
