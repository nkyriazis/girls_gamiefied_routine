// Dev only: set kids' balances and clear what waits for a parent on them (pending gifts to or from
// them, pending rewards), so a scene about stars starts clean.
//   dev.sh stars u1 100 u2 20
// The screens pick it up on their next load (this writes past the server, so nothing is pushed).
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/app/routine.db');
const args = process.argv.slice(2);
if (!args.length || args.length % 2) { console.error('usage: stars <kid> <stars> [<kid> <stars>...]'); process.exit(1); }
for (let i = 0; i < args.length; i += 2) {
  const [userId, stars] = [args[i], Number(args[i + 1])];
  if (!Number.isInteger(stars)) { console.error(`not a whole number: ${args[i + 1]}`); process.exit(1); }
  db.prepare('INSERT INTO user_stars (userId, stars) VALUES (?, ?) ON CONFLICT(userId) DO UPDATE SET stars = excluded.stars').run(userId, stars);
  const gifts = db.prepare("DELETE FROM star_transfers WHERE status = 'pending' AND (fromUserId = ? OR toUserId = ?)").run(userId, userId).changes;
  const rewards = db.prepare("DELETE FROM spendings WHERE status = 'pending' AND userId = ?").run(userId).changes;
  console.log(userId, 'stars', stars, 'pending gifts cleared', gifts, 'pending rewards cleared', rewards);
}
