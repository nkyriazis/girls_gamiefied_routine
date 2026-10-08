import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chownSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
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
const MATH: ExercisesConfig = { categories: [{ id: 'math', label: 'Math' }], exercises: [] };

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

// ---------------------------------------------------------------------------
// Saving never writes over a file the server couldn't load (issue #45)
// ---------------------------------------------------------------------------

const aside = (file: string) => readdirSync(path.dirname(file)).filter(f => f.startsWith(`${path.basename(file)}.invalid-`));

test('after a start with an unreadable file, a plain save is refused and the file stays as it is', () => {
  const { file } = setup();
  writeFileSync(file, '{ "users": [] oops');
  const cfg = new ConfigFile<DataConfig>(file, dataSchema, EMPTY);
  assert.equal(cfg.reload(), 'invalid');
  assert.equal(cfg.problem()?.emptyFallback, true);

  // What the forms and the old Advanced editor did: save the live (empty) config back
  const refused = cfg.save(cfg.raw());
  assert.ok(refused);
  assert.match(refused!.message, /never loaded/);
  assert.equal(readFileSync(file, 'utf-8'), '{ "users": [] oops');
  assert.ok(cfg.error, 'the error stays, so the parents keep seeing the banner');
  assert.deepEqual(aside(file), []);
});

test('even the deliberate replace never writes the empty fallback over a file it never loaded', () => {
  const { file } = setup();
  writeFileSync(file, '{ broken');
  const cfg = new ConfigFile<DataConfig>(file, dataSchema, EMPTY);
  cfg.reload();
  assert.ok(cfg.save(EMPTY, { replace: true }));
  assert.equal(readFileSync(file, 'utf-8'), '{ broken');
});

test('the broken text can be fixed and saved with replace; the broken file is kept beside', () => {
  const { file } = setup();
  writeFileSync(file, '{ broken Bob');
  const cfg = new ConfigFile<DataConfig>(file, dataSchema, EMPTY);
  cfg.reload();
  assert.equal(cfg.text(), '{ broken Bob');

  assert.equal(cfg.save(valid('Bob'), { replace: true }), null);
  assert.equal(cfg.get().users[0].name, 'Bob');
  assert.equal(cfg.error, null);
  assert.equal(cfg.problem(), null);
  assert.equal(JSON.parse(readFileSync(file, 'utf-8')).users[0].name, 'Bob');
  const kept = aside(file);
  assert.equal(kept.length, 1);
  assert.equal(readFileSync(path.join(path.dirname(file), kept[0]), 'utf-8'), '{ broken Bob');

  // Loaded now: an ordinary save works again
  assert.equal(cfg.save(valid('Carol')), null);
});

test('over an invalid file with the last valid config live: refused, unless replace asks', () => {
  const { file, cfg } = setup();
  cfg.reload();
  writeFileSync(file, '{ "users": [ edited by hand');
  assert.equal(cfg.reload(), 'invalid');
  assert.equal(cfg.problem()?.emptyFallback, false);

  assert.ok(cfg.save(valid('Bob')));
  assert.equal(readFileSync(file, 'utf-8'), '{ "users": [ edited by hand');

  assert.equal(cfg.save(valid('Bob'), { replace: true }), null);
  assert.equal(JSON.parse(readFileSync(file, 'utf-8')).users[0].name, 'Bob');
  assert.equal(aside(file).length, 1);
});

test('a file seeded from its example counts as loaded and saves normally', () => {
  const { files } = install();
  seedConfig(false, files);
  const cfg = new ConfigFile<ExercisesConfig>(files[1].file, exercisesSchema, EXERCISES);
  assert.equal(cfg.reload(), 'updated');
  assert.equal(cfg.problem(), null);
  assert.equal(cfg.save(MATH), null);
});

test('a missing file with history (data.json or exercises.json) is never loaded: saving is refused, replace may recreate it', () => {
  const { files } = install();
  seedConfig(true, files);
  const cfg = new ConfigFile<DataConfig>(files[0].file, dataSchema, EMPTY);
  assert.equal(cfg.reload(), 'invalid');
  assert.equal(cfg.problem()?.emptyFallback, true);
  assert.ok(cfg.save(valid('Alice')));
  assert.ok(cfg.save(EMPTY, { replace: true }), 'never the empty config, even with replace');
  assert.equal(existsSync(files[0].file), false);
  // The Advanced editor's replace with real content puts the file back (nothing to keep beside)
  assert.equal(cfg.save(valid('Alice'), { replace: true }), null);
  assert.equal(JSON.parse(readFileSync(files[0].file, 'utf-8')).users[0].name, 'Alice');
  assert.deepEqual(aside(files[0].file), []);

  const exercises = new ConfigFile<ExercisesConfig>(files[1].file, exercisesSchema, EXERCISES);
  assert.equal(exercises.reload(), 'invalid');
  assert.equal(exercises.problem()?.emptyFallback, true);
  assert.ok(exercises.save(EXERCISES), 'the empty exercises over a missing file with history: refused');
  assert.equal(existsSync(files[1].file), false);
});

test('the empty config never goes over a loaded file that has content, with or without replace', () => {
  // A tab or form that saves before the first state arrived holds the empty config, not the family's
  const { file, cfg } = setup();
  cfg.reload();
  for (const replace of [false, true]) {
    const refused = cfg.save(EMPTY, { replace });
    assert.ok(refused, `replace=${replace}`);
    assert.match(refused!.message, /empty/);
  }
  assert.equal(JSON.parse(readFileSync(file, 'utf-8')).users[0].name, 'Alice');
  assert.equal(cfg.get().users[0].name, 'Alice');
  assert.equal(cfg.error, null);

  // Over the last valid config, while the file on disk is broken: refused as well
  writeFileSync(file, '{ "users": [ edited by hand');
  cfg.reload();
  assert.ok(cfg.save(EMPTY, { replace: true }));
  assert.equal(readFileSync(file, 'utf-8'), '{ "users": [ edited by hand');
  assert.deepEqual(aside(file), []);
});

test('a file that is itself the empty config can be saved as the empty config', () => {
  const { files } = install(); // exercises.example.json is the empty exercises config
  seedConfig(false, files);
  const cfg = new ConfigFile<ExercisesConfig>(files[1].file, exercisesSchema, EXERCISES);
  assert.equal(cfg.reload(), 'updated');
  assert.equal(cfg.save(EXERCISES), null);
  assert.equal(cfg.save(MATH), null);
  assert.ok(cfg.save(EXERCISES), 'not once it has content');
});

// ---------------------------------------------------------------------------
// A save names the version it edited; a stale one is refused (issue #33)
// ---------------------------------------------------------------------------

test('the version follows the live text: it changes on a save and on a valid reload from disk', () => {
  const { file, cfg } = setup();
  cfg.reload();
  const v1 = cfg.version();
  assert.match(v1, /^[0-9a-f]{12}$/);
  assert.equal(cfg.reload(), 'unchanged');
  assert.equal(cfg.version(), v1);

  assert.equal(cfg.save(valid('Bob'), { version: v1 }), null);
  const v2 = cfg.version();
  assert.notEqual(v2, v1);

  writeFileSync(file, JSON.stringify(valid('Carol')));
  assert.equal(cfg.reload(), 'updated');
  assert.notEqual(cfg.version(), v2);

  // An invalid file on disk keeps the live version (and the live config)
  const v3 = cfg.version();
  writeFileSync(file, '{ not json');
  assert.equal(cfg.reload(), 'invalid');
  assert.equal(cfg.version(), v3);
});

test('the value and its version are read together', () => {
  const { cfg } = setup();
  cfg.reload();
  const { value, version } = cfg.current();
  assert.equal(value, cfg.get());
  assert.equal(version, cfg.version());
});

test('a save that names an older version is refused as a conflict and writes nothing', () => {
  const { file, cfg } = setup();
  cfg.reload();
  const opened = cfg.version();
  assert.equal(cfg.save(valid('Bob'), { version: opened }), null); // another screen's save
  const text = readFileSync(file, 'utf-8');

  const refused = cfg.save(valid('Alice again'), { version: opened });
  assert.ok(refused);
  assert.equal(refused.conflict, true);
  assert.equal(readFileSync(file, 'utf-8'), text);
  assert.equal(cfg.get().users[0].name, 'Bob');

  // ...with replace too: replace overrides an invalid file, never a newer version
  assert.equal(cfg.save(valid('Alice again'), { version: opened, replace: true })?.conflict, true);
  assert.equal(readFileSync(file, 'utf-8'), text);
});

test('a save with no version is not checked (scripts, the fix-a-broken-file editor)', () => {
  const { file, cfg } = setup();
  cfg.reload();
  assert.equal(cfg.save(valid('Bob')), null);
  assert.equal(cfg.save(valid('Carol')), null);
  assert.equal(JSON.parse(readFileSync(file, 'utf-8')).users[0].name, 'Carol');
});
