import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backupRunner } from '../src/backupSchedule';

// The scheduler's guard against a backup that never ends (a hung NAS or USB disk, issue #45)

type Entry = { type: string; details: Record<string, unknown> };
const recorder = () => {
  const entries: Entry[] = [];
  return { entries, log: (type: string, details: unknown) => { entries.push({ type, details: details as Record<string, unknown> }); } };
};
const until = async (done: () => boolean, ms = 5000) => {
  for (const t0 = Date.now(); !done(); await new Promise(r => setTimeout(r, 20))) {
    if (Date.now() - t0 > ms) throw new Error('timed out waiting');
  }
};
// A child that never ends, and ignores SIGTERM, as a process stuck on a dead disk would
const HANG = ['-e', 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000)'];

test('a backup that runs past its deadline is killed, logged as failed, and the next run can start', async () => {
  const { entries, log } = recorder();
  const runner = backupRunner({ dir: '/backups', log, timeoutMs: 300, command: HANG });
  assert.equal(runner.run('daily'), true);
  assert.equal(runner.run('daily'), false, 'one at a time while it runs');
  assert.equal(entries[0].type, 'BACKUP_SKIPPED');

  await until(() => entries.some(e => e.type === 'BACKUP_FAILED'));
  const failed = entries.find(e => e.type === 'BACKUP_FAILED')!;
  assert.equal(failed.details.reason, 'timed out');
  assert.equal(failed.details.dir, '/backups');
  assert.equal(failed.details.why, 'daily');

  assert.equal(runner.run('next day'), true, 'the guard is reset: backups go on');
  await until(() => entries.filter(e => e.type === 'BACKUP_FAILED').length === 2);
  await new Promise(r => setTimeout(r, 200));
  assert.equal(entries.filter(e => e.type === 'BACKUP_FAILED').length, 2, 'a killed child is logged once');
});

test('a backup that ends in time is logged from its output, and its deadline is cleared', async () => {
  const { entries, log } = recorder();
  const result = { folder: '/backups/x', files: 3, bytes: 10, integrity: 'ok', stars: {}, removed: [], ms: 5, sameFilesystem: false };
  // A deadline with headroom: a loaded machine can take well over 300 ms just to start node (#125).
  // Then wait past it, so a deadline left running would have fired.
  const timeoutMs = 3000;
  const started = Date.now();
  const runner = backupRunner({ dir: '/backups', log, timeoutMs, command: ['-e', `console.log(${JSON.stringify(JSON.stringify(result))})`] });
  assert.equal(runner.run('daily'), true);
  await until(() => entries.length > 0, timeoutMs);
  await new Promise(r => setTimeout(r, Math.max(0, started + timeoutMs + 200 - Date.now())));
  assert.deepEqual(entries.map(e => e.type), ['BACKUP']);
  assert.equal(entries[0].details.folder, '/backups/x');
});
