// Dev only: old history, for a scene about Ιστορικό's pages or STATE's window (#34). A busy family from
// 31 to <days> days ago, older than STATE's 30 days: a purchase a day (given, every 7th revoked) and a
// gift every other day (approved, every 10th rejected), both kids in turn, decided half a day after.
// Their ids start with cafe0000-, so `undo` takes exactly them away again.
//   dev.sh history 120        add them (again: the same ids, replaced)
//   dev.sh history undo       remove them
// Ιστορικό reads them on its next page; the kids' screens on their next load (this writes past the server).
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const db = new DatabaseSync('/app/routine.db');
const PREFIX = 'cafe0000-0000-4000-8000-';
const arg = process.argv[2];
if (arg === 'undo') {
  const s = db.prepare('DELETE FROM spendings WHERE id LIKE ?').run(PREFIX + '%').changes;
  const t = db.prepare('DELETE FROM star_transfers WHERE id LIKE ?').run(PREFIX + '%').changes;
  console.log('removed', s, 'purchases and', t, 'gifts');
  process.exit(0);
}
const days = Number(arg);
if (!Number.isInteger(days) || days <= 31) { console.error('usage: history <days, over 31> | history undo'); process.exit(1); }
const { users, rewards } = JSON.parse(fs.readFileSync('/app/data.json', 'utf8'));
const kids = users.map(u => u.id);
if (kids.length < 2 || !rewards.length) { console.error('needs two kids and a reward in data.json'); process.exit(1); }
const ago = d => new Date(Date.now() - d * 864e5).toISOString();
const id = n => PREFIX + String(n).padStart(12, '0');
const spend = db.prepare(`INSERT OR REPLACE INTO spendings (id, userId, rewardId, cost, createdAt, status, resolvedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`);
const give = db.prepare(`INSERT OR REPLACE INTO star_transfers (id, fromUserId, toUserId, amount, createdAt, status, resolvedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`);
let s = 0, t = 0;
db.exec('BEGIN');
for (let d = 31; d <= days; d++) {
  const kid = kids[d % 2], other = kids[(d + 1) % 2], reward = rewards[d % rewards.length];
  spend.run(id(2 * d), kid, reward.id, reward.cost, ago(d + 0.5), d % 7 ? 'done' : 'revoked', ago(d)); s++;
  if (d % 2 === 0) { give.run(id(2 * d + 1), kid, other, 5, ago(d + 0.6), d % 10 ? 'approved' : 'rejected', ago(d + 0.1)); t++; }
}
db.exec('COMMIT');
console.log('added', s, 'purchases and', t, 'gifts, from', ago(days).slice(0, 10), 'to', ago(31).slice(0, 10), `(ids ${PREFIX}…)`);
