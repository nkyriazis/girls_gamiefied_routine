import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chownSync, existsSync, readFileSync, statSync, writeFileSync } from 'fs';
import path from 'path';
import { ConfigFile, ExercisesConfig, seedConfig } from '../src/config';
import { DataConfig } from '../../shared/types';
import { dataSchema, exercisesSchema } from '../src/schemas';
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
  const cfg = new ConfigFile<DataConfig>(file, dataSchema, EMPTY);
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
  const cfg = new ConfigFile<DataConfig>(file, dataSchema, EMPTY);
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

// A new install has no data.json: the backend starts from the examples. A live one that lost its
// file must not quietly run the family on the example config, so the parents see the error instead.
function install() {
  const dir = tempDir();
  const examples = tempDir();
  writeFileSync(path.join(examples, 'data.example.json'), JSON.stringify(valid('Example')));
  writeFileSync(path.join(examples, 'exercises.example.json'), JSON.stringify(EXERCISES));
  const files = [
    { file: path.join(dir, 'data.json'), example: path.join(examples, 'data.example.json') },
    { file: path.join(dir, 'exercises.json'), example: path.join(examples, 'exercises.example.json') }
  ];
  return { dir, files };
}
const EXERCISES: ExercisesConfig = { categories: [], exercises: [] };

test('seedConfig: a new install (no history) gets both files from the examples', () => {
  const { files } = install();
  const result = seedConfig(false, files);
  assert.deepEqual(result, { seeded: files.map(f => f.file), missing: [] });
  for (const { file, example } of files) assert.equal(readFileSync(file, 'utf-8'), readFileSync(example, 'utf-8'));
  const cfg = new ConfigFile<DataConfig>(files[0].file, dataSchema, EMPTY);
  assert.equal(cfg.reload(), 'updated');
  assert.equal(cfg.get().users[0].name, 'Example');
});

test('seedConfig: with history it creates nothing, and a missing file is an error for the parents', () => {
  const { files } = install();
  assert.deepEqual(seedConfig(true, files), { seeded: [], missing: files.map(f => f.file) });
  for (const { file } of files) assert.equal(existsSync(file), false);

  const data = new ConfigFile<DataConfig>(files[0].file, dataSchema, EMPTY);
  assert.equal(data.reload(), 'invalid');
  assert.match(data.error!.message, /Cannot read data\.json/);
  // exercises.json is treated the same way: never silently empty
  const exercises = new ConfigFile<ExercisesConfig>(files[1].file, exercisesSchema, EXERCISES);
  assert.equal(exercises.reload(), 'invalid');
  assert.match(exercises.error!.message, /Cannot read exercises\.json/);
});

test('seedConfig: never overwrites a file that exists', () => {
  const { files } = install();
  writeFileSync(files[0].file, JSON.stringify(valid('Family')));
  assert.deepEqual(seedConfig(false, files), { seeded: [files[1].file], missing: [] });
  assert.equal(JSON.parse(readFileSync(files[0].file, 'utf-8')).users[0].name, 'Family');
});

test('seedConfig: the new file belongs to its directory\'s owner, not to the container\'s root', t => {
  if (process.getuid?.() !== 0) return t.skip('needs root (the dev container runs as root, as the image does)');
  const { dir, files } = install();
  chownSync(dir, 1234, 2345);
  seedConfig(false, files);
  for (const { file } of files) {
    const st = statSync(file);
    assert.deepEqual([st.uid, st.gid], [1234, 2345]);
  }
});
