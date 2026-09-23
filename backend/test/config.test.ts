import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { ConfigFile, DataConfig } from '../src/config';
import { dataSchema } from '../src/schemas';
import { tempDir } from './helpers';

const EMPTY: DataConfig = {
  users: [], tasks: [], routines: [], routineTasks: [], routineAssignments: [],
  flows: [], schedules: [], rewards: [], settings: { timezone: 'Europe/Athens' }
};
const valid = (name: string): DataConfig => ({
  ...EMPTY, users: [{ id: 'u1', name, avatar: { type: 'emoji', value: 'x' }, color: 'red' }]
});

function setup() {
  const file = path.join(tempDir(), 'data.json');
  writeFileSync(file, JSON.stringify(valid('Alice')));
  const cfg = new ConfigFile<DataConfig>(file, dataSchema, EMPTY, false);
  return { file, cfg };
}

test('loads, caches, and reports unchanged files', () => {
  const { cfg } = setup();
  assert.equal(cfg.reload(), 'updated');
  assert.equal(cfg.get().users[0].name, 'Alice');
  assert.equal(cfg.reload(), 'unchanged');
});

test('an invalid file on disk keeps the last valid config live', () => {
  const { file, cfg } = setup();
  cfg.reload();
  writeFileSync(file, JSON.stringify({ users: 'broken' }));
  assert.equal(cfg.reload(), 'invalid');
  assert.equal(cfg.get().users[0].name, 'Alice');
  assert.ok(cfg.error);

  writeFileSync(file, '{ not json');
  assert.equal(cfg.reload(), 'invalid');
  assert.equal(cfg.get().users[0].name, 'Alice');

  // Restoring the live version clears the error
  writeFileSync(file, JSON.stringify(valid('Alice')));
  assert.equal(cfg.reload(), 'updated');
  assert.equal(cfg.error, null);
});

test('an invalid file at startup yields the empty fallback, not a crash', () => {
  const { file } = setup();
  writeFileSync(file, '{ not json');
  const cfg = new ConfigFile<DataConfig>(file, dataSchema, EMPTY, false);
  assert.equal(cfg.reload(), 'invalid');
  assert.deepEqual(cfg.get().users, []);
});

test('save validates, writes, and updates the cache; the cache is frozen', () => {
  const { file, cfg } = setup();
  cfg.reload();
  assert.ok(cfg.save({ users: 'broken' }));
  assert.equal(JSON.parse(readFileSync(file, 'utf-8')).users[0].name, 'Alice');

  assert.equal(cfg.save(valid('Bob')), null);
  assert.equal(cfg.get().users[0].name, 'Bob');
  assert.equal(JSON.parse(readFileSync(file, 'utf-8')).users[0].name, 'Bob');
  assert.equal(cfg.reload(), 'unchanged');

  assert.throws(() => { cfg.get().users.push(valid('X').users[0]); }, TypeError);
  const copy = cfg.raw();
  copy.users.push(valid('X').users[0]);
  assert.equal(cfg.get().users.length, 1);
});
