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
    { id: 'both', steps: [{ type: 'parallel', actions: [{ type: 'flow', flowId: 'f1' }, { type: 'flow', flowId: 'f2' }] }] }
  ],
  schedules: [], rewards: [], settings: { timezone: 'Europe/Athens' }
};
writeFileSync(path.join(dir, 'data.json'), JSON.stringify(cfg));
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
