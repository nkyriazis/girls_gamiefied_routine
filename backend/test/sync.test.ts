import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { setImmediate as tick } from 'timers/promises';
import { Sync, Client } from '../src/sync';
import { Store } from '../src/store';
import { AppState, ServerMessage } from '../../shared/types';
import { tempDir, uuid } from './helpers';

class FakeClient implements Client {
  readyState = 1;
  received: ServerMessage[] = [];
  send(data: string) { this.received.push(JSON.parse(data)); }
  states() { return this.received.flatMap(m => (m.type === 'STATE' ? [m.payload] : [])); }
}

// A tiny AppState whose only varying part is the number of spendings.
function stateWith(n: number): AppState {
  return {
    config: { users: [], tasks: [], routines: [], routineTasks: [], routineAssignments: [], flows: [], schedules: [], rewards: [], settings: { timezone: 'UTC' } },
    configError: null, users: [], starTransfers: [], choreInstances: [], exerciseSessions: [], exerciseAssignments: [], flowRuns: [], routineRuns: [],
    spendings: Array.from({ length: n }, (_, i) => ({ id: String(i), userId: 'u', rewardId: 'r', cost: 1, createdAt: '', status: 'pending' as const }))
  };
}

async function settle() {
  for (let i = 0; i < 5; i++) await tick();
}

test('a connecting client gets the current state', async () => {
  let n = 3;
  const sync = new Sync(() => stateWith(n));
  const client = new FakeClient();
  sync.connect(client);
  await settle();
  assert.deepEqual(client.states().map(s => s.spendings.length), [3]);
  n = 4;
  sync.changed();
  await settle();
  assert.deepEqual(client.states().map(s => s.spendings.length), [3, 4]);
});

test('changes in the same turn go out as one snapshot, to open clients only', async () => {
  let n = 0;
  let builds = 0;
  const sync = new Sync(() => { builds++; return stateWith(n); });
  const open = new FakeClient();
  const closed = Object.assign(new FakeClient(), { readyState: 3 });
  sync.connect(open);
  sync.connect(closed);
  await settle();
  builds = 0;
  n = 1; sync.changed();
  n = 2; sync.changed();
  n = 3; sync.changed();
  await settle();
  assert.equal(builds, 1);
  assert.deepEqual(open.states().map(s => s.spendings.length), [0, 3]);
  assert.equal(closed.received.length, 0);
});

test('a change during a slow build is followed by a snapshot of the final state; builds never overlap', async () => {
  let n = 0;
  let running = 0;
  let maxRunning = 0;
  let release: () => void = () => {};
  const sync = new Sync(async () => {
    running++;
    maxRunning = Math.max(maxRunning, running);
    const snapshot = n; // read at the start, like the real build
    await new Promise<void>(resolve => { release = resolve; });
    running--;
    return stateWith(snapshot);
  });
  const client = new FakeClient();
  sync.connect(client);
  await settle();
  n = 1; sync.changed(); // lands while the first build is still waiting
  release(); await settle();
  n = 2; sync.changed();
  release(); await settle();
  release(); await settle();
  assert.equal(maxRunning, 1);
  const counts = client.states().map(s => s.spendings.length);
  assert.equal(counts[counts.length - 1], 2, `last snapshot must be the final state, got ${counts}`);
});

test('a disconnected client gets nothing more; events and heartbeats go out immediately', async () => {
  const sync = new Sync(() => stateWith(0));
  const a = new FakeClient();
  const b = new FakeClient();
  sync.connect(a);
  sync.connect(b);
  await settle();
  sync.disconnect(b);
  sync.notify({ type: 'CHORE_EXPIRED', payload: { instanceId: 'i', choreId: 'c' } });
  sync.heartbeat();
  assert.deepEqual(a.received.slice(-2).map(m => m.type), ['CHORE_EXPIRED', 'HEARTBEAT']); // synchronous, before any tick
  assert.equal(b.received.some(m => m.type !== 'STATE'), false);
});

test('the store reports every runtime-state write, and only those', () => {
  let changes = 0;
  const store = new Store(path.join(tempDir(), 'test.db'), () => { changes++; });
  const spending = { id: uuid(1), userId: 'u1', rewardId: 'r', cost: 5, createdAt: 't', status: 'pending' as const };

  const expect = (n: number, what: string) => { assert.equal(changes, n, what); changes = 0; };
  store.spendings.put(spending); expect(1, 'put');
  store.spendings.insertNew(spending); expect(0, 'insertNew that inserts nothing');
  store.setStars('u1', 7); expect(1, 'setStars');
  store.choreInstances.deleteWhere('id = ?', 'missing'); expect(0, 'delete that deletes nothing');
  store.spendings.deleteWhere('id = ?', uuid(1)); expect(1, 'delete');
  store.appendLog({ id: uuid(2), timestamp: 't', type: 'X', details: {} }); expect(0, 'action log');
  store.replaceState({
    userStars: {}, routineExecutions: [], taskExecutions: [], spendings: [], starTransfers: [],
    choreInstances: [], exerciseSessions: [], exerciseAssignments: []
  });
  assert.ok(changes > 0, 'replaceState');
});
