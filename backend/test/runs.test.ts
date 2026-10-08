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
  routineAssignments: [
    { id: 'a1', userId: 'u1', routineId: 'r' }, { id: 'a2', userId: 'u2', routineId: 'r' },
    // The reserved id (a config mistake, #121): 'alarm' still means the plain alarm
    { id: 'alarm', userId: 'u1', routineId: 'r' }
  ],
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
    { id: 'cycle-b', steps: [{ type: 'parallel', actions: [{ type: 'flow', flowId: 'cycle-b' }, { type: 'routine', userId: 'u2', routineId: 'a2' }] }] },
    // #121: flows that start each other at once, and one that starts itself again after its alarm
    { id: 'loop', steps: [{ type: 'parallel', actions: [{ type: 'flow', flowId: 'loop' }] }] },
    { id: 'ping', steps: [{ type: 'parallel', actions: [{ type: 'flow', flowId: 'pong' }] }] },
    { id: 'pong', steps: [{ type: 'parallel', actions: [{ type: 'flow', flowId: 'ping' }] }] },
    { id: 'again', steps: [{ type: 'alarm', props: {} }, { type: 'parallel', actions: [{ type: 'flow', flowId: 'again' }] }] }
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
  store.routineExecutions.deleteWhere('1'); // a flow skips a routine finished today (#58)
  store.taskExecutions.deleteWhere('1');
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

// The FLOW_CYCLE entries logged since `since` (an ISO time), oldest first
const cycles = (since: string) => db.readLastLogs(100).filter(l => l.type === 'FLOW_CYCLE' && l.timestamp >= since).reverse()
  .map(l => l.details as { flowId: string; chain: string[] });

test('#121: push «alarm» with an assignment «alarm» rings the plain alarm, not her routine', () => {
  reset();
  assert.deepEqual(db.triggerAction('alarm'), { success: true, type: 'flow', id: 'alarm' });
  assert.equal(routineRun('u1'), undefined);
  assert.equal(flowRun('alarm').steps[0].type, 'alarm');
});

test('#121: a flow that starts itself (loop → loop) starts nothing, ends, and logs FLOW_CYCLE', () => {
  reset();
  const since = new Date().toISOString();
  assert.deepEqual(db.triggerAction('loop'), { success: true, type: 'flow', id: 'loop', nothingStarted: true, cycle: true });
  assert.equal(store.flowRuns.count(), 0);
  assert.deepEqual(cycles(since).map(c => [c.flowId, c.chain]), [['loop', ['loop', 'loop']]]);
});

test('#121: ping → pong → ping: pong does not start ping again, both end, from either end', () => {
  reset();
  const since = new Date().toISOString();
  assert.deepEqual(db.triggerAction('ping'), { success: true, type: 'flow', id: 'ping', nothingStarted: true, cycle: true });
  assert.deepEqual(db.triggerAction('pong'), { success: true, type: 'flow', id: 'pong', nothingStarted: true, cycle: true });
  assert.equal(store.flowRuns.count(), 0);
  assert.deepEqual(cycles(since).map(c => c.chain), [['ping', 'pong', 'ping'], ['pong', 'ping', 'pong']]);
});

test('#121: a flow whose routines are all busy ended at once too, with no cycle', () => {
  reset();
  db.triggerAction('a1'); // u1 busy
  db.triggerAction('a2'); // u2 busy
  assert.deepEqual(db.triggerAction('routines'), { success: true, type: 'flow', id: 'routines', nothingStarted: true, cycle: false });
});

test('#121: a step whose sub-flow starts itself still starts its other actions', () => {
  reset();
  const since = new Date().toISOString();
  db.triggerAction('cycle');
  db.dismissAlarm(flowRun('cycle').id, 0);
  // cycle-b: its own start is refused, its routine starts, and it waits for that routine
  assert.equal(routineRun('u2').routineId, 'a2');
  assert.equal(flowRun('cycle-b').parentRunId, flowRun('cycle').id);
  assert.deepEqual(cycles(since).map(c => c.flowId), ['cycle-b']);
  db.closeRoutine(routineRun('u2').id);
  assert.equal(store.flowRuns.count(), 0);
});

test('#121: a flow that starts itself after its alarm (again: alarm, then again) rings again after each dismissal', () => {
  reset();
  const since = new Date().toISOString();
  db.triggerAction('again');
  for (let i = 0; i < 3; i++) {
    const run = flowRun('again');
    assert.equal(db.dismissAlarm(run.id, 0), true);
    const next = flowRun('again');
    assert.notEqual(next.id, run.id);
    assert.equal(next.stepIndex, 0); // its alarm, waiting
    assert.equal(store.flowRuns.count(), 1);
  }
  assert.deepEqual(cycles(since), []);
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

// #58: a flow doesn't start a routine the kid already finished today
// u1 did her routine by hand: started, both tasks done, closed
function doneByHand() {
  db.triggerAction('a1');
  const run = routineRun('u1');
  db.completeTask(run.id, 't1');
  db.completeTask(run.id, 't2');
  db.closeRoutine(run.id);
}
const executionsOf = (userId: string) => store.routineExecutions.all('userId = ?', userId).length;
const starsOf = (userId: string) => db.usersWithStars().find(u => u.id === userId)!.stars;
const skips = () => store.recentLogs(50).filter(l => l.type === 'FLOW_ROUTINE_SKIPPED').map(l => l.details);

test('#58: her flow reaches a routine she finished today: her alarm rings, dismissing it starts nothing', () => {
  reset();
  doneByHand();
  const stars = starsOf('u1');
  const before = skips().length;
  db.triggerAction('f1');
  assert.ok(flowRun('f1'), 'her alarm rings: an alarm is never hidden (#25)');
  assert.equal(db.dismissAlarm(flowRun('f1').id, 0), true);
  assert.equal(routineRun('u1'), undefined, 'the routine does not start again');
  assert.equal(executionsOf('u1'), 1, 'no second execution');
  assert.equal(starsOf('u1'), stars, 'no second stars');
  assert.equal(flowRun('f1'), undefined, 'the flow moved on and ended');
  const [skip, ...more] = skips().slice(before) as { userId: string; reason: string }[];
  assert.equal(more.length, 0);
  assert.deepEqual([skip.userId, skip.reason], ['u1', 'done-today'], 'logged as FLOW_ROUTINE_SKIPPED');
});

test('#58: a flow for both kids with one done: the alarm names both, only the other one\'s routine starts', async () => {
  reset();
  doneByHand();
  db.triggerAction('together');
  assert.deepEqual(await alarmsFor(), { together: ['u1', 'u2'] }, 'the alarm is unchanged');
  db.dismissAlarm(flowRun('together').id, 0);
  assert.equal(routineRun('u1'), undefined);
  assert.ok(routineRun('u2'));
  assert.equal(executionsOf('u1'), 1);
  db.closeRoutine(routineRun('u2').id);
  assert.equal(flowRun('together'), undefined);
});

test('#58: finished yesterday does not count: her flow starts it again', () => {
  reset();
  doneByHand();
  const [execution] = store.routineExecutions.all('userId = ?', 'u1');
  store.routineExecutions.put({ ...execution, startedAt: new Date(Date.now() - 36 * 3600_000).toISOString() });
  db.triggerAction('f1');
  db.dismissAlarm(flowRun('f1').id, 0);
  assert.ok(routineRun('u1'));
  assert.equal(executionsOf('u1'), 2);
});

test('#58: started today but left unfinished (✕) does not count: her flow starts it', () => {
  reset();
  db.triggerAction('a1');
  db.completeTask(routineRun('u1').id, 't1');
  db.closeRoutine(routineRun('u1').id);
  db.triggerAction('f1');
  db.dismissAlarm(flowRun('f1').id, 0);
  assert.ok(routineRun('u1'));
  assert.equal(executionsOf('u1'), 2);
});

test('#58: a routine started by itself (push, its own schedule, «Ξεκίνα τώρα») still starts after she finished it', () => {
  reset();
  doneByHand();
  assert.deepEqual(db.triggerAction('a1'), { success: true, type: 'assignment', id: 'a1' });
  assert.equal(executionsOf('u1'), 2);
});

test('#58: "today" begins at local midnight in settings.timezone', () => {
  assert.equal(db.dayStart('Europe/Athens', new Date('2026-10-08T12:00:00Z')), '2026-10-07T21:00:00.000Z', 'summer, UTC+3');
  assert.equal(db.dayStart('Europe/Athens', new Date('2026-10-07T22:30:00Z')), '2026-10-07T21:00:00.000Z', '01:30 local: already the 8th');
  assert.equal(db.dayStart('Europe/Athens', new Date('2026-12-01T12:00:00Z')), '2026-11-30T22:00:00.000Z', 'winter, UTC+2');
  assert.equal(db.dayStart('Europe/Athens', new Date('2026-03-29T12:00:00Z')), '2026-03-28T22:00:00.000Z', 'the clocks go forward at 03:00, after midnight');
  assert.equal(db.dayStart('UTC', new Date('2026-10-08T12:00:00Z')), '2026-10-08T00:00:00.000Z');
});

// #63: a parent ends a kid's routine from /parent («Τέλος»). The same close as her ✕ (the flow moves on,
// a later flow today starts it again, as above), and the kids' screens hear that it was a parent's,
// so her lane can say so instead of the card just vanishing.
function heard(): { events: { type: string; payload?: unknown }[]; stop: () => void } {
  const events: { type: string; payload?: unknown }[] = [];
  const client = { readyState: 1, send: (data: string) => { const m = JSON.parse(data); if (m.type !== 'STATE') events.push(m); } };
  db.sync.connect(client);
  return { events, stop: () => db.sync.disconnect(client) };
}

test('#63: a parent ends her routine: the same close, and the kids\' screens hear it was a parent', () => {
  reset();
  db.triggerAction('f1');
  db.dismissAlarm(flowRun('f1').id, 0);
  const run = routineRun('u1');
  const { events, stop } = heard();
  assert.equal(db.closeRoutine(run.id, 'parent'), true);
  assert.equal(routineRun('u1'), undefined);
  assert.equal(flowRun('f1'), undefined, 'her flow moved on, as after her ✕');
  assert.deepEqual(events, [{ type: 'ROUTINE_ENDED_BY_PARENT', payload: { runId: run.id, userId: 'u1', routineId: 'a1' } }]);
  assert.equal(db.closeRoutine(run.id, 'parent'), false, 'a second tap, or her ✕ racing it, is a no-op');
  assert.equal(events.length, 1, 'and says nothing');
  stop();
});

test('#63: her own ✕ (or the reward closing) says nothing more than the new state', () => {
  reset();
  db.triggerAction('a1');
  const { events, stop } = heard();
  db.closeRoutine(routineRun('u1').id);
  assert.deepEqual(events, []);
  stop();
});
