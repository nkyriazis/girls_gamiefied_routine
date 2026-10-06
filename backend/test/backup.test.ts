import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, utimesSync, writeFileSync } from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { newestBackup, sameFilesystem, takeBackup } from '../src/backup';
import { Store } from '../src/store';
import { tempDir } from './helpers';

// A data folder as on the Pi: routine.db (open, in WAL mode), data.json, exercises.json, uploads/
function setup() {
  const live = tempDir();
  const store = new Store(path.join(live, 'routine.db'));
  store.setStars('u1', 143);
  store.setStars('u2', 215);
  writeFileSync(path.join(live, 'data.json'), '{ "users": [] }\n');
  writeFileSync(path.join(live, 'exercises.json'), '{ "exercises": [] }\n');
  mkdirSync(path.join(live, 'uploads', 'avatars'), { recursive: true });
  writeFileSync(path.join(live, 'uploads', 'avatars', 'u1.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2]));
  const dir = path.join(tempDir(), 'backups');
  const options = (now = new Date(2026, 9, 6, 3, 17, 0), keep = 14) => ({
    dbFile: path.join(live, 'routine.db'), dataFile: path.join(live, 'data.json'),
    exercisesFile: path.join(live, 'exercises.json'), uploadsDir: path.join(live, 'uploads'), dir, keep, now
  });
  return { live, store, dir, options };
}

const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

test('a backup holds a consistent copy of the database, the config files and uploads', () => {
  const { store, dir, options } = setup();
  const result = takeBackup(options());

  assert.equal(result.folder, path.join(dir, '2026-10-06_031700'));
  assert.equal(result.integrity, 'ok');
  assert.deepEqual(result.stars, { u1: 143, u2: 215 });
  const copy = new DatabaseSync(path.join(result.folder, 'routine.db'), { readOnly: true });
  const rows = copy.prepare('SELECT userId, stars FROM user_stars ORDER BY userId').all();
  assert.deepEqual(rows.map(r => [r.userId, r.stars]), [['u1', 143], ['u2', 215]]);
  copy.close();
  // One file: VACUUM INTO leaves no -wal to carry along
  assert.equal(existsSync(path.join(result.folder, 'routine.db-wal')), false);
  assert.equal(readFileSync(path.join(result.folder, 'data.json'), 'utf-8'), '{ "users": [] }\n');
  assert.ok(existsSync(path.join(result.folder, 'exercises.json')));
  assert.ok(existsSync(path.join(result.folder, 'uploads', 'avatars', 'u1.png')));
  store.close();
});

test('SHA256SUMS lists every file in sha256sum -c format, and verifies', () => {
  const { options } = setup();
  const { folder, files } = takeBackup(options());
  const lines = readFileSync(path.join(folder, 'SHA256SUMS'), 'utf-8').trim().split('\n');
  const listed = lines.map(line => {
    const m = /^([0-9a-f]{64}) {2}(.+)$/.exec(line);
    assert.ok(m, line);
    assert.equal(sha(path.join(folder, m![2])), m![1]);
    return m![2];
  });
  assert.deepEqual(listed.sort(), ['data.json', 'exercises.json', 'routine.db', 'uploads/avatars/u1.png']);
  assert.equal(files, 4);
});

test('rotation keeps the newest N complete backups and leaves anything else alone', () => {
  const { dir, options } = setup();
  mkdirSync(dir, { recursive: true });
  mkdirSync(path.join(dir, 'pre-restore-20261001-120000')); // not ours
  writeFileSync(path.join(dir, 'notes.txt'), 'mine');
  mkdirSync(path.join(dir, '.partial-2026-10-01_031700')); // a backup that died half-way

  const days = [1, 2, 3, 4].map(d => takeBackup(options(new Date(2026, 9, d, 3, 17, 0), 2)));
  const left = readdirSync(dir).sort();
  assert.deepEqual(left, ['2026-10-03_031700', '2026-10-04_031700', 'notes.txt', 'pre-restore-20261001-120000']);
  assert.deepEqual(days[3].removed, ['2026-10-02_031700']);
});

test('a backup that never completed is not counted as the newest', () => {
  const { dir, options } = setup();
  assert.equal(newestBackup(dir), null);
  const { folder } = takeBackup(options());
  mkdirSync(path.join(dir, '.partial-2026-10-07_031700'));
  mkdirSync(path.join(dir, '2026-10-08_031700')); // no SHA256SUMS: not a backup this made
  const newest = newestBackup(dir);
  assert.equal(newest?.folder, folder);

  // Its age comes from when it completed
  const old = new Date(Date.now() - 3 * 86400_000);
  utimesSync(path.join(folder, 'SHA256SUMS'), old, old);
  assert.ok(Date.now() - newestBackup(dir)!.at.getTime() > 2 * 86400_000);
});

test('a backup on the same filesystem as the database says so', () => {
  const { live, dir, options } = setup();
  const result = takeBackup(options());
  assert.equal(result.sameFilesystem, true);
  assert.equal(sameFilesystem(dir, path.join(live, 'routine.db')), true);
  // /proc is always another filesystem
  assert.equal(sameFilesystem('/proc', path.join(live, 'routine.db')), false);
});

test('a missing database fails the backup and leaves nothing half-made', () => {
  const { live, dir, options } = setup();
  assert.throws(() => takeBackup({ ...options(), dbFile: path.join(live, 'missing.db') }), /missing\.db/);
  assert.deepEqual(existsSync(dir) ? readdirSync(dir) : [], []);
});
