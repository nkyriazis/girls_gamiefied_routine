// Dev only: a group game (📚) running now, with these players and these questions, in one round.
//   dev.sh game u1,u2 math-mc-1,math-tp-1,lang-tf-1
// Any game still running is taken off first; finished ones stay. The screens pick it up on their
// next load (this writes past the server, so nothing is pushed).
const { DatabaseSync } = require('node:sqlite');
const { randomUUID } = require('node:crypto');
const [players, questions] = process.argv.slice(2).map(a => a?.split(','));
if (!players || !questions) throw new Error('usage: game.js <kid,kid> <exerciseId,exerciseId,...>');
const db = new DatabaseSync('/app/routine.db');
const gone = db.prepare('DELETE FROM exercise_sessions WHERE completedAt IS NULL').run().changes;
const id = randomUUID();
db.prepare(`INSERT INTO exercise_sessions (id, playerIds, categories, totalRounds, currentRound, questionsPerRound,
  currentQuestionIndex, exerciseIds, answers, startedAt, completedAt, totalStarsEarned) VALUES (?, ?, '[]', 1, 1, ?, 0, ?, ?, ?, NULL, ?)`)
  .run(id, JSON.stringify(players), questions.length, JSON.stringify(questions),
    JSON.stringify(Object.fromEntries(players.map(p => [p, []]))), new Date().toISOString(),
    JSON.stringify(Object.fromEntries(players.map(p => [p, 0]))));
console.log('game', id, players.join(' '), '|', questions.join(' '), '| running games removed:', gone);
