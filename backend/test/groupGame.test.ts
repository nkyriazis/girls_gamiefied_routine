import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'fs';
import path from 'path';
import { DataConfig, Exercise, ExerciseSession } from '../../shared/types';
import { tempDir, uuid } from './helpers';

// The group game (📚, #26): an answer counts once, for the question on screen and the player whose
// turn it is; a finished game stays on the screens for its results, until «Επιστροφή» or the window passes.
const dir = tempDir();
const icon = { type: 'emoji' as const, value: 'x' };
const cfg: DataConfig = {
  users: [{ id: 'u1', name: 'Ηλέκτρα', avatar: icon, color: 'red' }, { id: 'u2', name: 'Ιφιγένεια', avatar: icon, color: 'blue' }],
  tasks: [], routines: [], routineTasks: [], routineAssignments: [], flows: [], schedules: [], rewards: [],
  settings: { timezone: 'Europe/Athens' }
};
const exercises: Exercise[] = [
  { id: 'mc', type: 'multiple-choice', category: 'Μαθηματικά', title: 'Πρόσθεση', question: '12 + 15;', options: ['25', '27'], correctIndex: 1, stars: 5 },
  { id: 'tf', type: 'true-false', category: 'Γλώσσα', title: 'Σωστό/Λάθος', question: 'Ναι;', correctValue: true, stars: 3 }
] as Exercise[];
writeFileSync(path.join(dir, 'data.json'), JSON.stringify(cfg));
writeFileSync(path.join(dir, 'exercises.json'), JSON.stringify({ exercises }));
process.env.DATA_FILE = path.join(dir, 'data.json');
process.env.EXERCISES_FILE = path.join(dir, 'exercises.json');
process.env.DB_FILE = path.join(dir, 'routine.db');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { reloadConfig } = require('../src/config') as typeof import('../src/config');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = require('../src/db') as typeof import('../src/db');
if (reloadConfig()?.type !== 'updated') throw new Error('test config rejected');
const { store } = db;

const MINUTE = 60_000;
const ago = (minutes: number) => new Date(Date.now() - minutes * MINUTE).toISOString();

/** A fresh scene: no games, both kids at 100, and one running game of these questions. */
function game(exerciseIds = ['mc', 'tf'], extra: Partial<ExerciseSession> = {}): ExerciseSession {
  store.exerciseSessions.deleteWhere('1');
  store.setStars('u1', 100);
  store.setStars('u2', 100);
  return newGame(1, exerciseIds, extra);
}
function newGame(n: number, exerciseIds = ['mc', 'tf'], extra: Partial<ExerciseSession> = {}): ExerciseSession {
  const session: ExerciseSession = {
    id: uuid(n), playerIds: ['u1', 'u2'], categories: [], totalRounds: 1, currentRound: 1,
    questionsPerRound: exerciseIds.length, currentQuestionIndex: 0, exerciseIds,
    answers: { u1: [], u2: [] }, startedAt: ago(10), totalStarsEarned: { u1: 0, u2: 0 }, ...extra
  };
  store.exerciseSessions.put(session);
  return session;
}
const answer = (id: string, userId: string, exerciseId: string, value: unknown) => db.submitExerciseAnswer(id, userId, exerciseId, value);
const right: Record<string, unknown> = { mc: 1, tf: true };
const onScreen = async () => (await db.appState()).exerciseSessions.map(s => s.id);

test('the same answer sent twice pays once, and the repeat is refused with nothing stored', () => {
  const { id } = game();
  assert.equal(answer(id, 'u1', 'mc', 1).earnedStars, 5);
  assert.throws(() => answer(id, 'u1', 'mc', 1), /σειρά|turn/i);
  assert.equal(store.getStars('u1'), 105);
  const session = store.exerciseSessions.get(id)!;
  assert.equal(session.answers.u1.length, 1);
  assert.equal(session.totalStarsEarned.u1, 5);
});

test('an answer to a question that is not on screen is refused, and pays nothing', () => {
  const { id } = game();
  assert.throws(() => answer(id, 'u1', 'tf', true), /ερώτηση|question/i);
  assert.equal(store.getStars('u1'), 100);
  assert.deepEqual(store.exerciseSessions.get(id)!.answers.u1, []);
});

test('a player cannot answer out of turn, so surplus answers never skip anyone', () => {
  const { id } = game();
  assert.throws(() => answer(id, 'u2', 'mc', 1), /σειρά|turn/i, 'Ηλέκτρα plays first');
  answer(id, 'u1', 'mc', 1);
  for (let i = 0; i < 4; i++) assert.throws(() => answer(id, 'u1', 'mc', 1));
  answer(id, 'u2', 'mc', 1);
  // Q2: Ηλέκτρα's turn again, not Ιφιγένεια's
  assert.throws(() => answer(id, 'u2', 'tf', true), /σειρά|turn/i);
  answer(id, 'u1', 'tf', true);
  const last = answer(id, 'u2', 'tf', true);
  assert.ok(last.session.completedAt, 'both played both questions: the game is over');
  assert.deepEqual(last.session.totalStarsEarned, { u1: 8, u2: 8 });
  assert.deepEqual([store.getStars('u1'), store.getStars('u2')], [108, 108]);
  assert.throws(() => answer(id, 'u2', 'tf', true), /completed/);
});

test('a finished game stays on the screens with its results, a long finished one does not', async () => {
  const { id } = game();
  for (const q of ['mc', 'tf']) for (const u of ['u1', 'u2']) answer(id, u, q, right[q]);
  assert.ok(store.exerciseSessions.get(id)!.completedAt);
  assert.deepEqual(await onScreen(), [id], 'just finished: «Μπράβο! 🎉» on every screen');

  store.exerciseSessions.put({ ...store.exerciseSessions.get(id)!, completedAt: ago(db.GAME_RESULTS_MINUTES - 1) });
  assert.deepEqual(await onScreen(), [id]);
  store.exerciseSessions.put({ ...store.exerciseSessions.get(id)!, completedAt: ago(db.GAME_RESULTS_MINUTES + 1) });
  assert.deepEqual(await onScreen(), [], 'past the window: gone');
});

test('running games come first, then finished ones newest first', async () => {
  const done = { answers: { u1: [], u2: [] }, currentQuestionIndex: 2 };
  game(['mc', 'tf'], { ...done, completedAt: ago(20) });
  newGame(2, ['mc', 'tf'], { ...done, completedAt: ago(5) });
  newGame(3);
  newGame(4, ['mc', 'tf'], { ...done, completedAt: ago(90) });
  assert.deepEqual(await onScreen(), [uuid(3), uuid(2), uuid(1)]);
});

test('«Επιστροφή» on a finished game hides it and keeps its record; on a running game it cancels it', async () => {
  game(['mc', 'tf'], { currentQuestionIndex: 2, completedAt: ago(1) });
  db.closeExerciseSession(uuid(1));
  const kept = store.exerciseSessions.get(uuid(1));
  assert.ok(kept?.dismissedAt, 'the finished game is kept, marked dismissed');
  assert.deepEqual(await onScreen(), []);

  newGame(2);
  db.closeExerciseSession(uuid(2));
  assert.equal(store.exerciseSessions.get(uuid(2)), undefined, 'a running game is cancelled as before');
});

test('the minute check finds a game whose results window just ended, once', () => {
  game(['mc', 'tf'], { currentQuestionIndex: 2, completedAt: ago(db.GAME_RESULTS_MINUTES + 0.5) });
  newGame(2, ['mc', 'tf'], { currentQuestionIndex: 2, completedAt: ago(db.GAME_RESULTS_MINUTES + 0.5), dismissedAt: ago(5) });
  newGame(3, ['mc', 'tf'], { currentQuestionIndex: 2, completedAt: ago(db.GAME_RESULTS_MINUTES - 0.5) });
  const now = new Date();
  const lastCheck = new Date(now.getTime() - MINUTE);
  assert.deepEqual(db.gameResultsLeaving(lastCheck, now).map(s => s.id), [uuid(1)], 'not the dismissed one, not the one still showing');
  assert.deepEqual(db.gameResultsLeaving(now, new Date(now.getTime() + 1000)).map(s => s.id), [], 'the next check: already gone');
});
