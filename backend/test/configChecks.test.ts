import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { ConfigWarning, DataConfig } from '../../shared/types';
import { tempDir } from './helpers';

// What data.schema.json can't see (#104): two items with the same id, a link to something that isn't there,
// a blank name or title, a colour that isn't one. Each is a warning only: the Advanced editor's pre-check
// lists it, a save that brings it in goes through, a file on disk with it loads, and the parents' page lists
// it (AppState.configWarnings, /api/admin/validation-status) until it is fixed. Unreadable crons (#89,
// cronConfig.test.ts) are the one check that refuses a save.
const dir = tempDir();
const icon = { type: 'emoji' as const, value: 'x' };
const cfg: DataConfig = {
  users: [
    { id: 'u1', name: 'Ηλέκτρα', avatar: icon, color: 'var(--color-accent)' },
    { id: 'u2', name: 'Ιφιγένεια', avatar: icon, color: 'rebeccapurple' },
  ],
  tasks: [{ id: 't1', title: 'Δόντια', icon, stars: 1 }, { id: 't2', title: 'Ντύσιμο', icon, stars: 1 }],
  routines: [{ id: 'r1', title: 'Πρωινό', themeColor: 'var(--color-primary)', icon }],
  routineTasks: [
    { id: 'rt1', routineId: 'r1', taskId: 't1', order: 1, durationSeconds: 60 },
    { id: 'rt2', routineId: 'r1', taskId: 't2', order: 2, durationSeconds: 60 },
  ],
  routineAssignments: [
    { id: 'a1', userId: 'u1', routineId: 'r1' },
    { id: 'a2', userId: 'u2', routineId: 'r1' },
  ],
  flows: [
    {
      id: 'f1', steps: [
        { type: 'alarm', props: {} },
        { type: 'parallel', actions: [
          { type: 'routine', userId: 'u1', routineId: 'a1' }, { type: 'routine', userId: 'u2', routineId: 'a2' }, { type: 'flow', flowId: 'f2' },
        ] },
      ],
    },
    { id: 'f2', steps: [{ type: 'alarm', props: {} }] },
  ],
  schedules: [
    { id: 's1', cron: '0 7 * * *', type: 'flow', targetId: 'f1' },
    { id: 's2', cron: '0 20 * * *', type: 'routine', targetId: 'a1' },
    { id: 's3', cron: '0 21 * * *', type: 'flow', targetId: 'alarm' },
  ],
  rewards: [{ id: 'park', title: 'Πάρκο', cost: 10, icon }, { id: 'film', title: 'Ταινία', cost: 20, icon }],
  chores: [{ id: 'dishes', title: 'Πιάτα', icon, defaultStars: 5, availabilityCron: '0 18 * * *', expirationHours: 4, eligibleUsers: ['u1', 'u2'] }],
  settings: { timezone: 'Europe/Athens' },
};

const DATA = path.join(dir, 'data.json');
writeFileSync(DATA, JSON.stringify(cfg));
writeFileSync(path.join(dir, 'exercises.json'), JSON.stringify({ exercises: [] }));
process.env.DATA_FILE = DATA;
process.env.EXERCISES_FILE = path.join(dir, 'exercises.json');
process.env.DB_FILE = path.join(dir, 'routine.db');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { configProblems, isColour } = require('../src/configChecks') as typeof import('../src/configChecks');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { reloadConfig, configError, config } = require('../src/config') as typeof import('../src/config');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = require('../src/db') as typeof import('../src/db');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { server } = require('../src/server') as typeof import('../src/server');
if (reloadConfig()?.type !== 'updated') throw new Error('test config rejected: ' + JSON.stringify(configError()));
before(() => server.ready());

const edit = (change: (d: DataConfig) => void): DataConfig => {
  const d = structuredClone(cfg);
  change(d);
  return d;
};
// A flow of one parallel step that starts these flows
const flowOf = (id: string, starts: string[], before: DataConfig['flows'][number]['steps'] = []): DataConfig['flows'][number] =>
  ({ id, steps: [...before, { type: 'parallel', actions: starts.map(flowId => ({ type: 'flow' as const, flowId })) }] });
const actions = (d: DataConfig) => (d.flows[0].steps[1] as { actions: { routineId?: string; flowId?: string }[] }).actions;
const brief = (w: ConfigWarning) => `${w.kind} ${w.path} ${'value' in w ? w.value : w.cron}`;

test('the clean config, and the dev data.json, have none', () => {
  assert.deepEqual(configProblems(cfg), []);
  const dev = JSON.parse(readFileSync(path.join(__dirname, '..', 'data.json'), 'utf-8')) as DataConfig;
  assert.deepEqual(configProblems(dev).map(brief), []);
});

const cases: [string, (d: DataConfig) => void, string][] = [
  // the same id twice in one list: the second one is named
  ['two kids with one id', d => { d.users.push({ ...d.users[1], id: 'u1', name: 'Τρίτη' }); }, 'duplicate-id /users/2/id u1'],
  ['two tasks with one id', d => { d.tasks[1].id = 't1'; d.routineTasks[1].taskId = 't1'; }, 'duplicate-id /tasks/1/id t1'],
  ['two routineTasks with one id', d => { d.routineTasks[1].id = 'rt1'; }, 'duplicate-id /routineTasks/1/id rt1'],
  ['two assignments with one id', d => { d.routineAssignments[1].id = 'a1'; actions(d)[1].routineId = 'a1'; }, 'duplicate-id /routineAssignments/1/id a1'],
  ['two flows with one id', d => { d.flows[1].id = 'f1'; actions(d).pop(); }, 'duplicate-id /flows/1/id f1'],
  ['two schedules with one id', d => { d.schedules[1].id = 's1'; }, 'duplicate-id /schedules/1/id s1'],
  ['two rewards with one id', d => { d.rewards[1].id = 'park'; }, 'duplicate-id /rewards/1/id park'],
  ['two chores with one id', d => { d.chores!.push({ ...d.chores![0], title: 'Άλλη' }); }, 'duplicate-id /chores/1/id dishes'],
  ['a flow with an assignment\'s id (one namespace)', d => { d.flows[1].id = 'a2'; actions(d)[2].flowId = 'a2'; }, 'duplicate-id /flows/1/id a2'],
  // links to nothing
  ['an assignment to a missing kid', d => { d.routineAssignments[0].userId = 'u3'; }, 'missing-link /routineAssignments/0/userId u3'],
  ['an assignment of a missing routine', d => { d.routineAssignments[0].routineId = 'r9'; }, 'missing-link /routineAssignments/0/routineId r9'],
  ['a routine task of a missing task', d => { d.routineTasks[0].taskId = 't-missing'; }, 'missing-link /routineTasks/0/taskId t-missing'],
  ['a routine task of a missing routine', d => { d.routineTasks[0].routineId = 'r9'; }, 'missing-link /routineTasks/0/routineId r9'],
  ['a schedule of nothing', d => { d.schedules[0].targetId = 'no-such-flow'; }, 'missing-link /schedules/0/targetId no-such-flow'],
  ['a flow step\'s routine of a missing assignment', d => { actions(d)[1].routineId = 'u2-assign-mornin'; }, 'missing-link /flows/0/steps/1/actions/1/routineId u2-assign-mornin'],
  ['a flow step\'s flow that is missing', d => { actions(d)[2].flowId = 'f9'; }, 'missing-link /flows/0/steps/1/actions/2/flowId f9'],
  ['a chore for a missing kid', d => { d.chores![0].eligibleUsers = ['u1', 'u3']; }, 'missing-link /chores/0/eligibleUsers/1 u3'],
  // blank
  ['a kid named with spaces', d => { d.users[1].name = '  '; }, 'blank /users/1/name   '],
  ['a task with a blank title', d => { d.tasks[0].title = ' '; }, 'blank /tasks/0/title  '],
  ['a routine with a blank title', d => { d.routines[0].title = '\t'; }, 'blank /routines/0/title \t'],
  ['a reward with a blank title', d => { d.rewards[0].title = ' '; }, 'blank /rewards/0/title  '],
  ['a chore with a blank title', d => { d.chores![0].title = ' '; }, 'blank /chores/0/title  '],
  // colours
  ['a kid\'s colour typo', d => { d.users[1].color = 'var(--color-secondry)'; }, 'colour /users/1/color var(--color-secondry)'],
  ['a routine\'s colour typo', d => { d.routines[0].themeColor = 'bleu'; }, 'colour /routines/0/themeColor bleu'],
  // flow cycles (#121): one warning per cycle, at the action that closes it
  ['a flow that starts itself (loop → loop)', d => { d.flows.push(flowOf('loop', ['loop'])); }, 'flow-cycle /flows/2/steps/0/actions/0/flowId loop'],
  ['two flows that start each other (ping → pong → ping)', d => { d.flows.push(flowOf('ping', ['pong']), flowOf('pong', ['ping'])); },
    'flow-cycle /flows/3/steps/0/actions/0/flowId ping'],
  // the reserved id «alarm» (#121): a schedule or push with it always rings the plain alarm
  ['an assignment with the id «alarm»', d => { d.routineAssignments.push({ id: 'alarm', userId: 'u1', routineId: 'r1' }); },
    'reserved-id /routineAssignments/2/id alarm'],
  ['a flow with the id «alarm»', d => { d.flows.push({ id: 'alarm', steps: [{ type: 'alarm', props: {} }] }); }, 'reserved-id /flows/2/id alarm'],
];

for (const [name, change, expected] of cases) {
  test(`${name}: one problem, said in Greek`, () => {
    const found = configProblems(edit(change));
    assert.deepEqual(found.map(brief), [expected]);
    assert.match(found[0].message, /[α-ω]/);
  });
}

test('a duplicate kid names both kids and what they share', () => {
  const [w] = configProblems(edit(d => { d.users.push({ ...d.users[0], name: 'Τρίτη' }); }));
  assert.match(w.message, /Ηλέκτρα/);
  assert.match(w.message, /Τρίτη/);
  assert.match(w.message, /αστέρια/);
});

test('a chore whose every kid is missing can be done by nobody, and says so', () => {
  const [w] = configProblems(edit(d => { d.chores![0].eligibleUsers = ['u3']; }));
  assert.match(w.message, /κανένα παιδί/);
});

test('a flow cycle names its path and says only that the action closing it starts nothing', () => {
  const [self] = configProblems(edit(d => { d.flows.push(flowOf('loop', ['loop'])); }));
  assert.match(self.message, /«loop», βήμα 1, ξεκινά τον εαυτό της \(loop → loop\)/);
  assert.match(self.message, /αυτή η ενέργεια δεν ξεκινά τίποτα/);
  const [pair] = configProblems(edit(d => { d.flows.push(flowOf('ping', ['pong']), flowOf('pong', ['ping'])); }));
  assert.match(pair.message, /\(ping → pong → ping\)/);
  assert.match(pair.message, /η ενέργεια που κλείνει τον κύκλο δεν ξεκινά τίποτα/);
  assert.doesNotMatch(pair.message, /βήμα δεν ξεκινά/); // the step's other actions run
});

test('three flows in a ring are one warning; a second back edge is a second', () => {
  const ring = configProblems(edit(d => { d.flows.push(flowOf('a', ['b']), flowOf('b', ['c']), flowOf('c', ['a'])); }));
  assert.deepEqual(ring.map(brief), ['flow-cycle /flows/4/steps/0/actions/0/flowId a']);
  assert.match(ring[0].message, /\(a → b → c → a\)/);
  const two = configProblems(edit(d => { d.flows.push(flowOf('a', ['b']), flowOf('b', ['a', 'b'])); }));
  assert.deepEqual(two.map(brief), ['flow-cycle /flows/3/steps/0/actions/0/flowId a', 'flow-cycle /flows/3/steps/0/actions/1/flowId b']);
});

test('no flow cycle: a diamond, or a flow that starts itself again after an alarm', () => {
  // two paths to one flow
  assert.deepEqual(configProblems(edit(d => { d.flows.push(flowOf('top', ['l', 'r']), flowOf('l', ['end']), flowOf('r', ['end']), flowOf('end', [])); })), []);
  // A: alarm, then A rings again after each dismissal (the runtime restarts it, #121)
  assert.deepEqual(configProblems(edit(d => { d.flows.push(flowOf('again', ['again'], [{ type: 'alarm', props: {} }])); })), []);
  // A starts B, which waits at an alarm, and only then starts A: a restart, not a cycle
  assert.deepEqual(configProblems(edit(d => {
    d.flows.push(flowOf('a', ['b']), flowOf('b', ['a'], [{ type: 'parallel', actions: [{ type: 'flow', flowId: 'f2' }] }]));
  })), []);
});

test('an assignment and a flow both «alarm»: two reserved ids, no duplicate', () => {
  const found = configProblems(edit(d => {
    d.routineAssignments.push({ id: 'alarm', userId: 'u1', routineId: 'r1' });
    d.flows.push({ id: 'alarm', steps: [{ type: 'alarm', props: {} }] });
  }));
  assert.deepEqual(found.map(brief), ['reserved-id /routineAssignments/2/id alarm', 'reserved-id /flows/2/id alarm']);
  assert.match(found[0].message, /απλή ειδοποίηση/);
});

test('colours: theme tokens, hex, CSS functions and named colours pass; typos do not', () => {
  for (const c of ['var(--color-accent)', 'var( --color-text-muted )', '#fff', '#FF0050', '#ff005080', '#abcd', 'rgb(1 2 3)',
    'rgba(0, 0, 0, .5)', 'hsl(10 50% 50%)', 'oklch(70% 0.1 200)', 'color-mix(in srgb, red, blue)', 'red', 'RebeccaPurple',
    'transparent', 'currentColor', 'var(--color-nope, #fff)']) {
    assert.equal(isColour(c), true, c);
  }
  for (const c of ['var(--color-secondry)', 'var(--glass-bg)', 'var(--color-nope)', '#ff000', '#ggg', 'rde', '', ' ', 'red;',
    'rgb(', 'rgb(1 2 3', 'url(x)', 'var(--color-accent']) {
    assert.equal(isColour(c), false, c);
  }
});

async function post(url: string, body: unknown) {
  const res = await server.inject({ method: 'POST', url, payload: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
  return { status: res.statusCode, body: res.json() as Record<string, unknown> };
}
const live = (): DataConfig => JSON.parse(readFileSync(DATA, 'utf-8'));
// The scene of the PR's evidence, smaller: one of each
const bad = edit(d => {
  d.users[1].color = 'var(--color-secondry)';
  d.users.push({ id: 'u1', name: 'Τρίτη', avatar: icon, color: 'red' });
  d.users.push({ id: 'u4', name: '  ', avatar: icon, color: 'red' });
  d.schedules[0].targetId = 'no-such-flow';
});
const BAD = ['duplicate-id /users/2/id u1', 'missing-link /schedules/0/targetId no-such-flow', 'blank /users/3/name   ',
  'colour /users/1/color var(--color-secondry)'];
const warnings = async () => (await db.appState()).configWarnings.map(brief);

test("the Advanced editor's pre-check lists them as warnings, and the file is valid", async () => {
  const res = await post('/api/admin/validate', bad);
  assert.equal(res.body.valid, true);
  assert.equal(res.body.errors, undefined);
  assert.deepEqual((res.body.warnings as ConfigWarning[]).map(brief), BAD);
  assert.deepEqual((await post('/api/admin/validate', cfg)).body, { valid: true, warnings: [] });
});

test('a save that brings them in goes through, and the parents are told', async () => {
  const res = await post('/api/admin/data?source=advanced', bad);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(live(), bad);
  assert.deepEqual(await warnings(), BAD);
  const status = (await server.inject({ method: 'GET', url: '/api/admin/validation-status' })).json();
  assert.equal(status.config, null);
  assert.deepEqual(status.warnings.map(brief), BAD);
});

test('fixing them saves and clears them', async () => {
  assert.equal((await post('/api/admin/data?source=advanced', cfg)).status, 200);
  assert.deepEqual(await warnings(), []);
});

test('a data.json on disk with them loads (no error) and lists every one', async () => {
  writeFileSync(DATA, JSON.stringify(bad, null, 2));
  assert.deepEqual(reloadConfig(), { type: 'updated' });
  assert.equal(configError(), null);
  assert.equal(config().users.length, 4);
  assert.deepEqual(await warnings(), BAD);
});
