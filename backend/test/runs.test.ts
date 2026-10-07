import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'fs';
import path from 'path';
import { DataConfig } from '../../shared/types';
import { Store } from '../src/store';
import { tempDir } from './helpers';

// db.ts opens the database and config named by the environment when it loads,
// so point them at a temp dir first and load it afterwards.
const dir = tempDir();
const icon = { type: 'emoji' as const, value: 'x' };
const cfg: DataConfig = {
  users: [{ id: 'u1', name: 'A', avatar: icon, color: 'red' }, { id: 'u2', name: 'B', avatar: icon, color: 'blue' }],
  tasks: [{ id: 't1', title: 'T1', icon, stars: 10, lateStars: 1 }, { id: 't2', title: 'T2', icon, stars: 5 }],
  routines: [{ id: 'r', title: 'R', themeColor: 'red', icon }],
  routineTasks: [
    { id: 'rt1', routineId: 'r', taskId: 't1', order: 1, durationSeconds: 60 },
    { id: 'rt2', routineId: 'r', taskId: 't2', order: 2, durationSeconds: 60 }
  ],
  routineAssignments: [{ id: 'a1', userId: 'u1', routineId: 'r' }, { id: 'a2', userId: 'u2', routineId: 'r' }],
  flows: [
    { id: 'f1', steps: [{ type: 'alarm', props: {} }, { type: 'parallel', actions: [{ type: 'routine', userId: 'u1', routineId: 'a1' }] }] },
    { id: 'f2', steps: [{ type: 'alarm', props: {} }, { type: 'parallel', actions: [{ type: 'routine', userId: 'u2', routineId: 'a2' }] }] },
    { id: 'both', steps: [{ type: 'parallel', actions: [{ type: 'flow', flowId: 'f1' }, { type: 'flow', flowId: 'f2' }] }] },
    // One alarm for both kids
    { id: 'together', steps: [{ type: 'alarm', props: {} }, { type: 'parallel', actions: [
      { type: 'routine', userId: 'u1', routineId: 'a1' }, { type: 'routine', userId: 'u2', routineId: 'a2' }] }] },
    // An alarm before sub-flows: their routines are its kids'
    { id: 'wake', steps: [{ type: 'alarm', props: {} }, { type: 'parallel', actions: [{ type: 'flow', flowId: 'routines' }] }] },
    { id: 'routines', steps: [
      { type: 'parallel', actions: [{ type: 'routine', userId: 'u1', routineId: 'a1' }] },
      { type: 'parallel', actions: [{ type: 'routine', userId: 'u2', routineId: 'a2' }] }] },
    // Two alarms: each is for the kids up to the next one
    { id: 'twice', steps: [
      { type: 'alarm', props: {} }, { type: 'parallel', actions: [{ type: 'routine', userId: 'u1', routineId: 'a1' }] },
      { type: 'alarm', props: {} }, { type: 'parallel', actions: [{ type: 'routine', userId: 'u2', routineId: 'a2' }] }] },
    // A sub-flow that starts itself (a config mistake) mustn't hang the server
    { id: 'cycle', steps: [{ type: 'alarm', props: {} }, { type: 'parallel', actions: [{ type: 'flow', flowId: 'cycle-b' }] }] },
    { id: 'cycle-b', steps: [{ type: 'parallel', actions: [{ type: 'flow', flowId: 'cycle-b' }, { type: 'routine', userId: 'u2', routineId: 'a2' }] }] }
  ],
  schedules: [], rewards: [], settings: { timezone: 'Europe/Athens' }
};
writeFileSync(path.join(dir, 'data.json'), JSON.stringify(cfg));
writeFileSync(path.join(dir, 'exercises.json'), JSON.stringify({ exercises: [] }));
process.env.DATA_FILE = path.join(dir, 'data.json');
process.env.EXERCISES_FILE = path.join(dir, 'exercises.json');
process.env.DB_FILE = path.join(dir, 'routine.db');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { reloadConfig } = require('../src/config') as typeof import('../src/config');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = require('../src/db') as typeof import('../src/db');
const change = reloadConfig();
if (change?.type !== 'updated') throw new Error(`test config rejected: ${JSON.stringify(change)}`);
const { store } = db;

const flowRun = (flowId: string) => store.flowRuns.all('flowId = ?', flowId)[0];
const routineRun = (userId: string) => store.routineRuns.all('userId = ?', userId)[0];
function reset() {
  store.flowRuns.deleteWhere('1');
  store.routineRuns.deleteWhere('1');
}

test('a flow runs on the server: alarms, parallel routines, sub-flows, then it ends', () => {
  reset();
  assert.deepEqual(db.triggerAction('both'), { success: true, type: 'flow', id: 'both' });
  assert.equal(flowRun('both').stepIndex, 0);
  assert.equal(flowRun('f1').parentRunId, flowRun('both').id);
  assert.equal(flowRun('f1').stepIndex, 0); // alarm, waiting
  assert.equal(store.routineRuns.count(), 0);

  // Triggering it again restarts it (no duplicates)
  const firstId = flowRun('both').id;
  db.triggerAction('both');
  assert.notEqual(flowRun('both').id, firstId);
  assert.equal(store.flowRuns.count(), 3);

  const f1 = flowRun('f1').id;
  assert.equal(db.dismissAlarm(f1, 0), true);
  assert.equal(db.dismissAlarm(f1, 0), false, 'a second device dismissing again is a no-op');
  assert.equal(flowRun('f1').stepIndex, 1);
  const run = routineRun('u1');
  assert.equal(run.flowRunId, f1);
  assert.equal(run.taskIndex, 0);

  assert.deepEqual(db.completeTask(run.id, 't2'), { success: false, error: 'Not the current task' });
  assert.deepEqual(db.completeTask(run.id, 't1'), { success: true, starsAwarded: 10 });
  assert.deepEqual(db.completeTask(run.id, 't1'), { success: false, error: 'Not the current task' }, 'double tap');
  assert.equal(routineRun('u1').taskIndex, 1);
  assert.deepEqual(db.completeTask(run.id, 't2'), { success: true, starsAwarded: 5 });
  assert.ok(routineRun('u1').finishedAt);
  assert.ok(store.routineExecutions.get(run.id)?.completedAt);
  assert.equal(store.routineExecutions.get(run.id)?.totalStars, 15);

  // The finished routine stays on screen (reward) until a client closes it
  assert.ok(flowRun('f1'));
  assert.equal(db.closeRoutine(run.id), true);
  assert.equal(db.closeRoutine(run.id), false);
  assert.equal(flowRun('f1'), undefined, 'f1 ended with its last step');
  assert.ok(flowRun('both'), 'still waiting for f2');

  // Closing a routine early (the kid pressed ✕) also moves the flow on
  db.dismissAlarm(flowRun('f2').id, 0);
  db.closeRoutine(routineRun('u2').id);
  assert.equal(store.flowRuns.count(), 0);
});

test('a user has one routine at a time; a late task earns lateStars', () => {
  reset();
  assert.deepEqual(db.triggerAction('a1'), { success: true, type: 'assignment', id: 'a1' });
  const run = routineRun('u1');
  assert.deepEqual(db.triggerAction('a1'), { success: true, skipped: true, type: 'assignment', id: 'a1', runningId: run.id });
  store.routineRuns.put({ ...run, taskStartedAt: new Date(Date.now() - 120_000).toISOString() });
  assert.deepEqual(db.completeTask(run.id, 't1'), { success: true, starsAwarded: 1 });
});

test('a flow whose routines are all busy moves on at once', () => {
  reset();
  db.triggerAction('a1'); // u1 busy
  db.triggerAction('f1');
  db.dismissAlarm(flowRun('f1').id, 0);
  assert.equal(flowRun('f1'), undefined);
});

test('push "alarm" shows a plain alarm until dismissed', () => {
  reset();
  db.triggerAction('alarm');
  const run = flowRun('alarm');
  assert.equal(run.steps[0].type, 'alarm');
  db.dismissAlarm(run.id, 0);
  assert.equal(store.flowRuns.count(), 0);
});

test('runs are in the client state and in the database (a restart resumes them)', async () => {
  reset();
  db.triggerAction('both');
  db.dismissAlarm(flowRun('f1').id, 0);
  db.completeTask(routineRun('u1').id, 't1');

  const state = await db.appState();
  assert.deepEqual(state.flowRuns.map(r => [r.flowId, r.stepIndex]).sort(), [["both", 0], ["f1", 1], ["f2", 0]]);
  assert.deepEqual(state.routineRuns.map(r => [r.userId, r.taskIndex, r.totalStars]), [['u1', 1, 10]]);

  const reopened = new Store(process.env.DB_FILE!); // what a restarted server reads
  assert.deepEqual(reopened.routineRuns.all(), store.routineRuns.all());
  assert.deepEqual(reopened.flowRuns.all(), store.flowRuns.all());
  reopened.close();
});

test('a routine left open on an earlier day is closed: on the next trigger and by the minute cron', () => {
  reset();
  const yesterday = new Date(Date.now() - 36 * 3600_000).toISOString();
  const backdate = (userId: string) => {
    const run = routineRun(userId);
    store.routineExecutions.put({ ...store.routineExecutions.get(run.id)!, startedAt: yesterday });
    return run;
  };

  // Left open inside a flow, then tomorrow's trigger: the old run closes, its flow moves on, a new one starts
  db.triggerAction('f1');
  db.dismissAlarm(flowRun('f1').id, 0);
  const old = backdate('u1');
  assert.equal(db.closeStaleRoutines('u2'), 0, 'other users are untouched');
  assert.deepEqual(db.triggerAction('a1'), { success: true, type: 'assignment', id: 'a1' });
  assert.notEqual(routineRun('u1').id, old.id);
  assert.equal(flowRun('f1'), undefined, 'the flow waiting for the stale routine ended');

  // The cron closes stale runs without a trigger; today's runs stay
  backdate('u1');
  db.triggerAction('a2');
  assert.equal(db.closeStaleRoutines(), 1);
  assert.equal(routineRun('u1'), undefined);
  assert.ok(routineRun('u2'));
  assert.equal(store.recentLogs(50).filter(l => l.type === 'ROUTINE_CLOSED_STALE').length, 2);
});

test('an alarm nobody dismissed stops after settings.alarmMinutes, with the rest of its flow', () => {
  reset();
  const hour = 3600_000;
  db.triggerAction('both');
  db.dismissAlarm(flowRun('f2').id, 0); // u2 woke up: its routine runs
  assert.equal(db.expireAlarms(new Date(Date.now() + hour - 60_000)), 0, 'still within the hour');
  assert.equal(db.expireAlarms(new Date(Date.now() + hour)), 1);
  assert.equal(flowRun('f1'), undefined, 'the late alarm is gone');
  assert.equal(routineRun('u1'), undefined, "and its routine doesn't start late");
  assert.ok(routineRun('u2'), 'what was already under way goes on');
  assert.ok(flowRun('both'), 'the parent waits for what is still running');
  db.closeRoutine(routineRun('u2').id);
  assert.equal(store.flowRuns.count(), 0);

  // Runs recorded before stepStartedAt existed count from when they started
  db.triggerAction('alarm');
  const { stepStartedAt: _, ...old } = flowRun('alarm');
  store.flowRuns.put({ ...old, startedAt: new Date(Date.now() - 2 * hour).toISOString() });
  assert.equal(db.expireAlarms(), 1);
  assert.equal(store.recentLogs(50).filter(l => l.type === 'ALARM_EXPIRED').length, 2);
});

// Whom each alarm on screen is for, as clients get it
const alarmsFor = async () => Object.fromEntries((await db.appState()).flowRuns
  .filter(r => r.steps[r.stepIndex]?.type === 'alarm').map(r => [r.flowId, r.userIds]));

test('the server says whom an alarm is for: the kids of the routines after it', async () => {
  reset();
  db.triggerAction('together');
  db.triggerAction('both');
  db.triggerAction('wake');
  db.triggerAction('cycle');
  db.triggerAction('alarm');
  assert.deepEqual(await alarmsFor(), {
    together: ['u1', 'u2'], // a flow for both kids: one alarm, both named
    f1: ['u1'], f2: ['u2'], // the sub-flows' own alarms
    wake: ['u1', 'u2'], // through its sub-flow, every step of it
    cycle: ['u2'], // the sub-flow that starts itself is counted once
    alarm: [] // push 'alarm': for everyone
  });

  reset();
  db.triggerAction('twice');
  assert.deepEqual(await alarmsFor(), { twice: ['u1'] }, 'up to the next alarm');
  db.dismissAlarm(flowRun('twice').id, 0);
  db.closeRoutine(routineRun('u1').id);
  assert.deepEqual(await alarmsFor(), { twice: ['u2'] }, 'the second alarm is for the kid after it');
});

test('she is in her routine and dismisses her alarm: her routine goes on, nothing new starts', () => {
  reset();
  db.triggerAction('a1');
  const mine = routineRun('u1').id;
  db.completeTask(mine, 't1');
  const executions = store.routineExecutions.count();
  db.triggerAction('f1');
  assert.equal(db.dismissAlarm(flowRun('f1').id, 0), true);
  assert.equal(store.routineRuns.count(), 1);
  assert.equal(routineRun('u1').id, mine, 'the same run, not a second one');
  assert.equal(routineRun('u1').taskIndex, 1, 'where she was');
  assert.equal(store.routineExecutions.count(), executions, 'no second execution');
  assert.equal(flowRun('f1'), undefined, 'the flow moved on and ended');
});
