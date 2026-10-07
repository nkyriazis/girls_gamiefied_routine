// npm test (frontend): the routine and task forms (#36) change only what the parent edited,
// in the three lists a routine lives in, and refuse what would strand a kid or a schedule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { DataConfig, RoutineRun } from '@shared/types';
import { newId } from './model.ts';
import {
    addTask, applyRoutine, dropsLockedKid, formatMinutes, kidNotes, moveTask, newRoutine, parseMinutes, removeRoutine, routineDraft,
    routineIsValid, routineLock, routineWarnings, runningKids, taskIsValid, taskLock, taskWarnings, tidyTask,
} from './routines.ts';

const emoji = (value: string) => ({ type: 'emoji' as const, value });

// The dev data.json's routines, as piserve has them too: ids typed by hand, orders 1..n
const base = (): DataConfig => ({
    users: [
        { id: 'u1', name: 'Ηλέκτρα', avatar: emoji('🦊'), color: 'var(--color-accent)' },
        { id: 'u2', name: 'Ιφιγένεια', avatar: emoji('🐱'), color: 'var(--color-secondary)' },
    ],
    tasks: [
        { id: 't-brush', title: 'Πλύσιμο Δοντιών', icon: emoji('🪥'), stars: 10 },
        { id: 't-wash', title: 'Πλύσιμο Προσώπου', icon: emoji('🧼'), stars: 10 },
        { id: 't-pajamas', title: 'Πιτζάμες', icon: emoji('👚'), stars: 10 },
        { id: 't-story', title: 'Παραμύθι', icon: emoji('📖'), stars: 10 },
        { id: 't-read', title: 'Διάβασμα', icon: emoji('📚'), stars: 5 },
    ],
    routines: [
        { id: 'r-morning', title: 'Πρωινή Ρουτίνα', themeColor: 'var(--color-primary)', icon: emoji('☀️') },
        { id: 'r-evening', title: 'Βραδινή Ρουτίνα', themeColor: 'var(--color-secondary)', icon: emoji('🌙') },
    ],
    routineTasks: [
        { id: 'rt-1', routineId: 'r-morning', taskId: 't-brush', order: 1, durationSeconds: 120 },
        { id: 'rt-2', routineId: 'r-morning', taskId: 't-wash', order: 2, durationSeconds: 60 },
        { id: 'rt-5', routineId: 'r-evening', taskId: 't-pajamas', order: 1, durationSeconds: 180 },
        { id: 'rt-6', routineId: 'r-evening', taskId: 't-brush', order: 2, durationSeconds: 100 },
        { id: 'rt-7', routineId: 'r-evening', taskId: 't-story', order: 3, durationSeconds: 600 },
    ],
    routineAssignments: [
        { id: 'u1-assign-morning', userId: 'u1', routineId: 'r-morning' },
        { id: 'u1-assign-evening', userId: 'u1', routineId: 'r-evening' },
        { id: 'u2-assign-morning', userId: 'u2', routineId: 'r-morning' },
    ],
    flows: [
        { id: 'morning-flow', steps: [{ type: 'parallel', actions: [{ type: 'flow', flowId: 'u2-morning-flow' }] }] },
        { id: 'u2-morning-flow', steps: [{ type: 'parallel', actions: [{ type: 'routine', userId: 'u2', routineId: 'u2-assign-morning' }] }] },
    ],
    schedules: [
        { id: 'sch-morning', cron: '0 7 * * 1-5', type: 'flow', targetId: 'morning-flow' },
        { id: 'sch-evening', cron: '0 20 * * *', type: 'routine', targetId: 'u1-assign-evening' },
    ],
    rewards: [],
    settings: { timezone: 'Europe/Athens' },
});

const run = (routineId: string, userId: string): RoutineRun => ({ id: `run-${routineId}`, userId, routineId, taskIndex: 1, taskStartedAt: '2026-10-07T18:00:00Z' });

// --- ids ---

test('newId gives a new id each call, even within the same millisecond', () => {
    const ids = Array.from({ length: 50 }, () => newId('rt'));
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) assert.match(id, /^rt-[a-z0-9-]+$/); // the schema's id pattern
});

test('newId avoids the ids it is told are taken', () => {
    const id = newId('rt');
    const next = newId('rt', [id, `${id}-2`]);
    assert.ok(![id, `${id}-2`].includes(next));
});

// --- reading a routine ---

test('routineDraft: the tasks in order with their seconds, and the kids who have it', () => {
    const d = routineDraft(base(), 'r-evening');
    assert.equal(d.title, 'Βραδινή Ρουτίνα');
    assert.deepEqual(d.tasks, [
        { rtId: 'rt-5', taskId: 't-pajamas', seconds: 180 },
        { rtId: 'rt-6', taskId: 't-brush', seconds: 100 },
        { rtId: 'rt-7', taskId: 't-story', seconds: 600 },
    ]);
    assert.deepEqual(d.kids, ['u1']);
});

test('routineDraft sorts by order, gaps and ties as hand-written data may have them (ties keep the file order)', () => {
    const c = base();
    c.routineTasks = [
        { id: 'a', routineId: 'r-evening', taskId: 't-story', order: 9, durationSeconds: 1 },
        { id: 'b', routineId: 'r-evening', taskId: 't-pajamas', order: 2, durationSeconds: 1 },
        { id: 'c', routineId: 'r-evening', taskId: 't-brush', order: 2, durationSeconds: 1 },
    ];
    assert.deepEqual(routineDraft(c, 'r-evening').tasks.map(t => t.rtId), ['b', 'c', 'a']);
});

// --- saving a routine: the three lists, in one patch ---

test('an untouched routine saves exactly as it was: the same objects in the same places', () => {
    const c = base();
    const out = applyRoutine(c, routineDraft(c, 'r-evening'), false);
    assert.deepEqual(out, { routines: c.routines, routineTasks: c.routineTasks, routineAssignments: c.routineAssignments });
    out.routineTasks.forEach((rt, i) => assert.equal(rt, c.routineTasks[i]));
    out.routineAssignments.forEach((a, i) => assert.equal(a, c.routineAssignments[i]));
});

test('reordering renumbers only that routine\'s rows, in place; the other routine\'s rows are the same objects', () => {
    const c = base();
    const d = moveTask(routineDraft(c, 'r-evening'), 2, -1); // Παραμύθι before Πλύσιμο Δοντιών
    const out = applyRoutine(c, d, false);
    assert.deepEqual(out.routineTasks.map(rt => `${rt.id}:${rt.taskId}:${rt.order}`),
        ['rt-1:t-brush:1', 'rt-2:t-wash:2', 'rt-5:t-pajamas:1', 'rt-7:t-story:2', 'rt-6:t-brush:3']);
    for (const i of [0, 1, 2]) assert.equal(out.routineTasks[i], c.routineTasks[i]);
    assert.equal(out.routineTasks[3].durationSeconds, 600);
});

test('a changed duration changes that row only; a duration nobody touched stays to the second', () => {
    const c = base();
    const d = routineDraft(c, 'r-evening');
    d.tasks[0] = { ...d.tasks[0], seconds: parseMinutes('2') };
    const out = applyRoutine(c, d, false);
    assert.deepEqual(out.routineTasks.find(rt => rt.id === 'rt-5'), { ...c.routineTasks[2], durationSeconds: 120 });
    assert.equal(out.routineTasks.find(rt => rt.id === 'rt-6'), c.routineTasks[3]); // 100 s, shown 1,7′
});

test('a gap in the orders stays when nothing moves (untouched rows exact); a move renumbers 1..n', () => {
    const c = base();
    c.routineTasks = c.routineTasks.map(rt => (rt.id === 'rt-7' ? { ...rt, order: 30 } : rt));
    const same = applyRoutine(c, routineDraft(c, 'r-evening'), false);
    assert.deepEqual(same.routineTasks, c.routineTasks);
    const moved = applyRoutine(c, moveTask(routineDraft(c, 'r-evening'), 0, 1), false);
    assert.deepEqual(moved.routineTasks.filter(rt => rt.routineId === 'r-evening').map(rt => rt.order), [1, 2, 3]);
});

test('added tasks get new row ids, unique within one save and against every row', () => {
    const c = base();
    let d = routineDraft(c, 'r-morning');
    d = addTask(c, d, 't-read');
    d = addTask(c, d, 't-story');
    const out = applyRoutine(c, d, false);
    const rows = out.routineTasks.filter(rt => rt.routineId === 'r-morning');
    assert.deepEqual(rows.map(rt => [rt.taskId, rt.order]), [['t-brush', 1], ['t-wash', 2], ['t-read', 3], ['t-story', 4]]);
    const ids = out.routineTasks.map(rt => rt.id);
    assert.equal(new Set(ids).size, ids.length);
    // the morning rows stay where they were, before the evening ones
    assert.deepEqual(out.routineTasks.map(rt => rt.routineId), ['r-morning', 'r-morning', 'r-morning', 'r-morning', 'r-evening', 'r-evening', 'r-evening']);
});

test('an added task takes its time from another routine, else 5 minutes', () => {
    const c = base();
    assert.equal(addTask(c, routineDraft(c, 'r-morning'), 't-story').tasks.at(-1)!.seconds, 600);
    assert.equal(addTask(c, routineDraft(c, 'r-morning'), 't-read').tasks.at(-1)!.seconds, 300);
});

test('a removed task drops its row; the rest stay as they were (their orders still rise)', () => {
    const c = base();
    const d = routineDraft(c, 'r-evening');
    const out = applyRoutine(c, { ...d, tasks: d.tasks.filter(t => t.taskId !== 't-pajamas') }, false);
    assert.deepEqual(out.routineTasks.map(rt => rt.id), ['rt-1', 'rt-2', 'rt-6', 'rt-7']);
    assert.equal(out.routineTasks[2], c.routineTasks[3]);
    assert.equal(out.routineTasks[3], c.routineTasks[4]);
});

test('rows written out of order or interleaved in the file: an untouched save leaves the file as it is', () => {
    const c = base();
    c.routineTasks = [c.routineTasks[4], c.routineTasks[0], c.routineTasks[2], c.routineTasks[1], c.routineTasks[3]];
    const out = applyRoutine(c, { ...routineDraft(c, 'r-evening'), title: 'Βράδυ' }, false);
    assert.equal(out.routineTasks, c.routineTasks);
    // a move fills the routine's places in the file in its new order
    const moved = applyRoutine(c, moveTask(routineDraft(c, 'r-evening'), 0, 1), false);
    assert.deepEqual(moved.routineTasks.map(rt => `${rt.id}:${rt.order}`), ['rt-6:1', 'rt-1:1', 'rt-5:2', 'rt-2:2', 'rt-7:3']);
});

test('ticking a kid adds an assignment with a readable id; existing ones keep theirs', () => {
    const c = base();
    const out = applyRoutine(c, { ...routineDraft(c, 'r-evening'), kids: ['u1', 'u2'] }, false);
    assert.equal(out.routineAssignments[1], c.routineAssignments[1]);
    assert.deepEqual(out.routineAssignments.at(-1), { id: 'u2-r-evening', userId: 'u2', routineId: 'r-evening' });
});

test('a new assignment id never matches an assignment, a flow, a schedule\'s target, a flow\'s routine or "alarm"', () => {
    const c = base();
    c.routines.push({ id: 'alarm', title: 'x', themeColor: 'red', icon: emoji('x') });
    c.flows.push({ id: 'u2-r-evening', steps: [] });
    c.schedules.push({ id: 's', cron: '0 1 * * *', type: 'routine', targetId: 'u2-r-evening-2' });
    c.flows.push({ id: 'f', steps: [{ type: 'routine', routineId: 'u2-r-evening-3' }] });
    c.routineAssignments.push({ id: 'u2-r-evening-4', userId: 'u1', routineId: 'r-morning' });
    const out = applyRoutine(c, { ...routineDraft(c, 'r-evening'), kids: ['u1', 'u2'] }, false);
    assert.equal(out.routineAssignments.at(-1)!.id, 'u2-r-evening-5');
    // a kid in a routine called "alarm"…, and two kids in one save, never clash either
    const two = applyRoutine(c, { ...routineDraft(c, 'alarm'), kids: ['u1', 'u2'] }, false);
    const ids = two.routineAssignments.map(a => a.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(!ids.includes('alarm'));
});

test('unticking a kid drops her assignment of that routine only', () => {
    const c = base();
    const out = applyRoutine(c, { ...routineDraft(c, 'r-morning'), kids: ['u1'] }, false);
    assert.deepEqual(out.routineAssignments.map(a => a.id), ['u1-assign-morning', 'u1-assign-evening']);
});

test('a new routine: its own id, its rows and its kids appended; nothing else touched', () => {
    const c = base();
    let d = newRoutine(c);
    assert.ok(!c.routines.some(r => r.id === d.id));
    d = addTask(c, { ...d, title: ' Απόγευμα ', kids: ['u2'] }, 't-read');
    const out = applyRoutine(c, d, true);
    assert.deepEqual(out.routines.at(-1), { id: d.id, title: 'Απόγευμα', themeColor: d.themeColor, icon: d.icon });
    assert.deepEqual(out.routineTasks.slice(0, 5), c.routineTasks);
    assert.deepEqual(out.routineTasks.at(-1), { id: out.routineTasks.at(-1)!.id, routineId: d.id, taskId: 't-read', order: 1, durationSeconds: 300 });
    assert.deepEqual(out.routineAssignments.at(-1), { id: `u2-${d.id}`, userId: 'u2', routineId: d.id });
});

test('removeRoutine drops the routine, its rows and its assignments', () => {
    const c = base();
    const out = removeRoutine(c, 'r-evening');
    assert.deepEqual(out.routines.map(r => r.id), ['r-morning']);
    assert.deepEqual(out.routineTasks.map(rt => rt.id), ['rt-1', 'rt-2']);
    assert.deepEqual(out.routineAssignments.map(a => a.id), ['u1-assign-morning', 'u2-assign-morning']);
});

// --- what the forms refuse ---

test('a task a routine uses can\'t be deleted; the reason names the routines', () => {
    const c = base();
    assert.match(taskLock(c, 't-brush')!, /Πρωινή Ρουτίνα, Βραδινή Ρουτίνα/);
    assert.equal(taskLock(c, 't-read'), null);
});

test('a kid a schedule or a flow starts the routine for, or who is in it now, can\'t be unticked; the note says why', () => {
    const c = base();
    const evening = kidNotes(c, [], routineDraft(c, 'r-evening'));
    assert.equal(evening.length, 1);
    assert.equal(evening[0].locked, true);
    assert.match(evening[0].text, /^Ηλέκτρα: .*20:00 κάθε μέρα/);
    const morning = kidNotes(c, [], routineDraft(c, 'r-morning'));
    assert.deepEqual(morning.map(n => [n.userId, n.locked]), [['u1', false], ['u2', true]]);
    assert.match(morning[0].text, /χωρίς ώρα — πρόσθεσε στο Πρόγραμμα/);
    assert.match(morning[1].text, /u2-morning-flow/);
    const running = kidNotes(c, [run('u1-assign-morning', 'u1')], routineDraft(c, 'r-morning'));
    assert.equal(running[0].locked, true);
    assert.match(running[0].text, /τώρα/);
});

test('a newly ticked kid is noted without a time', () => {
    const c = base();
    const notes = kidNotes(c, [], { ...routineDraft(c, 'r-evening'), kids: ['u1', 'u2'] });
    assert.deepEqual(notes[1], { userId: 'u2', locked: false, text: 'Ιφιγένεια: χωρίς ώρα — πρόσθεσε στο Πρόγραμμα.' });
});

test('a save that unticks a kid locked meanwhile (a schedule added, a run started) is refused', () => {
    const c = base();
    const d = { ...routineDraft(c, 'r-morning'), kids: ['u2'] }; // Ηλέκτρα unticked: nothing starts hers
    assert.equal(dropsLockedKid(c, [], d), false);
    assert.equal(dropsLockedKid(c, [run('u1-assign-morning', 'u1')], d), true);
    c.schedules.push({ id: 's', cron: '0 8 * * 6', type: 'routine', targetId: 'u1-assign-morning' });
    assert.equal(dropsLockedKid(c, [], d), true);
});

test('a routine can\'t be deleted while a schedule or flow starts it, or a kid is in it', () => {
    const c = base();
    assert.match(routineLock(c, [], 'r-evening')!, /: Ηλέκτρα \(/);
    assert.match(routineLock(c, [], 'r-morning')!, /: Ιφιγένεια \(/); // her morning: the flow
    c.schedules = []; c.flows = [];
    assert.equal(routineLock(c, [], 'r-evening'), null);
    assert.match(routineLock(c, [run('u1-assign-evening', 'u1')], 'r-evening')!, /Ηλέκτρα/);
});

test('runningKids: who has the routine on screen now', () => {
    const c = base();
    assert.deepEqual(runningKids(c, [run('u2-assign-morning', 'u2'), run('u1-assign-evening', 'u1')], 'r-morning'), ['u2']);
});

// --- validity: the rules apply to what the parent changes ---

test('a routine needs a name, an icon, a colour, a task, and whole durations of at least a second', () => {
    const c = base();
    const d = routineDraft(c, 'r-evening');
    assert.equal(routineIsValid(d, d, c, false), true);
    assert.equal(routineIsValid({ ...d, title: ' ' }, d, c, false), false);
    assert.equal(routineIsValid({ ...d, icon: emoji('') }, d, c, false), false);
    assert.equal(routineIsValid({ ...d, themeColor: '' }, d, c, false), false);
    assert.equal(routineIsValid({ ...d, tasks: [] }, d, c, false), false);
    assert.equal(routineIsValid({ ...d, tasks: [{ ...d.tasks[0], seconds: NaN }, ...d.tasks.slice(1)] }, d, c, false), false);
    assert.equal(routineIsValid({ ...d, tasks: [{ ...d.tasks[0], seconds: 0 }, ...d.tasks.slice(1)] }, d, c, false), false);
    assert.equal(routineIsValid(newRoutine(c), undefined, c, false), false); // no name, no task yet
});

test('the same task can\'t be added twice', () => {
    const c = base();
    const d = routineDraft(c, 'r-evening');
    assert.equal(routineIsValid({ ...d, tasks: [...d.tasks, { taskId: 't-story', seconds: 60 }] }, d, c, false), false);
});

test('an oddity already in the data (a task twice, a task id that doesn\'t exist) is a warning, and other changes save', () => {
    const c = base();
    c.routineTasks.push({ id: 'rt-8', routineId: 'r-evening', taskId: 't-brush', order: 4, durationSeconds: 60 });
    c.routineTasks.push({ id: 'rt-9', routineId: 'r-evening', taskId: 't-stroy', order: 5, durationSeconds: 60 });
    const d = routineDraft(c, 'r-evening');
    assert.equal(routineIsValid({ ...d, title: 'Βράδυ' }, d, c, false), true);
    const warnings = routineWarnings(d, c, false);
    assert.equal(warnings.length, 2);
    assert.match(warnings.join(' '), /Πλύσιμο Δοντιών/);
    assert.match(warnings.join(' '), /t-stroy/);
    assert.ok(warnings.every(w => w.endsWith('με το ✕.')));
});

test('while it runs, the warnings say the ✕ waits for the run to end (every ✕ is disabled then)', () => {
    const c = base();
    c.routineTasks.push({ id: 'rt-8', routineId: 'r-evening', taskId: 't-brush', order: 4, durationSeconds: 60 });
    c.routineTasks.push({ id: 'rt-9', routineId: 'r-evening', taskId: 't-stroy', order: 5, durationSeconds: 60 });
    const warnings = routineWarnings(routineDraft(c, 'r-evening'), c, true);
    assert.equal(warnings.length, 2);
    assert.ok(warnings.every(w => w.endsWith('με το ✕ όταν τελειώσει.')));
});

test('while it runs, the task list is locked (add, remove, reorder); name, colour and durations still save', () => {
    const c = base();
    const d = routineDraft(c, 'r-evening');
    assert.equal(routineIsValid(moveTask(d, 0, 1), d, c, true), false);
    assert.equal(routineIsValid(addTask(c, d, 't-read'), d, c, true), false);
    assert.equal(routineIsValid({ ...d, tasks: d.tasks.slice(1) }, d, c, true), false);
    assert.equal(routineIsValid({ ...d, title: 'Βράδυ', tasks: d.tasks.map(t => ({ ...t, seconds: 90 })) }, d, c, true), true);
});

test('a task needs a name, an icon and whole stars; late stars no more than on time', () => {
    const t = { id: 't', title: 'Πιτζάμες', icon: emoji('👚'), stars: 10 };
    assert.equal(taskIsValid(t), true);
    assert.equal(taskIsValid({ ...t, title: '' }), false);
    assert.equal(taskIsValid({ ...t, icon: emoji('') }), false);
    assert.equal(taskIsValid({ ...t, stars: 1.5 }), false);
    assert.equal(taskIsValid({ ...t, stars: -1 }), false);
    assert.equal(taskIsValid({ ...t, stars: 0 }), true);
    assert.equal(taskIsValid({ ...t, lateStars: 5 }), true);
    assert.equal(taskIsValid({ ...t, lateStars: 11 }), false);
    assert.equal(taskIsValid({ ...t, lateStars: NaN }), false);
});

test('late stars over the on-time stars, already in the data, is a warning and doesn\'t block a rename', () => {
    const odd = { id: 't', title: 'Πιτζάμες', icon: emoji('👚'), stars: 10, lateStars: 15 };
    assert.equal(taskIsValid({ ...odd, title: 'Πυτζάμες' }, odd), true);
    assert.equal(taskIsValid({ ...odd, stars: 12 }, odd), false); // touched: the rule applies
    assert.equal(taskWarnings(odd).length, 1);
    assert.equal(taskWarnings({ ...odd, lateStars: 5 }).length, 0);
});

test('tidyTask trims the name and leaves out late stars at 0, as the hand-written tasks do', () => {
    const t = { id: 't', title: ' Πιτζάμες ', icon: emoji('👚'), stars: 10, lateStars: 0 };
    assert.deepEqual(tidyTask(t), { id: 't', title: 'Πιτζάμες', icon: emoji('👚'), stars: 10 });
    assert.equal(tidyTask({ ...t, lateStars: 3 }).lateStars, 3);
});

// --- minutes ---

test('durations show in minutes, rounded to a tenth, with a comma; typed minutes save as whole seconds', () => {
    assert.equal(formatMinutes(120), '2');
    assert.equal(formatMinutes(100), '1,7');
    assert.equal(formatMinutes(90), '1,5');
    assert.equal(parseMinutes('1,5'), 90);
    assert.equal(parseMinutes('1.5'), 90);
    assert.equal(parseMinutes('0,01'), 1); // at least a second
    assert.ok(Number.isNaN(parseMinutes('')));
    assert.ok(Number.isNaN(parseMinutes('0')));
    assert.ok(Number.isNaN(parseMinutes('-2')));
    assert.ok(Number.isNaN(parseMinutes('δύο')));
});
