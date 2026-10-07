import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { DataConfig } from '../../shared/types';
import { UPLOAD_MAX_BYTES, UPLOAD_MAX_MB } from '../../shared/uploads';
import { tempDir } from './helpers';

// Uploads (#107): one file up to UPLOAD_MAX_BYTES is kept byte for byte; a bigger one is refused with
// 413 and a message, and nothing of it stays in uploads/ (it used to be cut at 1 MiB and answered 200).
// Called through server.inject, against this file's own data.json, database and uploads folder.
const dir = tempDir();
const uploads = path.join(dir, 'uploads');
mkdirSync(uploads);
const cfg: DataConfig = {
  users: [], tasks: [], routines: [], routineTasks: [], routineAssignments: [], flows: [], schedules: [],
  rewards: [], chores: [], settings: { timezone: 'Europe/Athens' }
};
writeFileSync(path.join(dir, 'data.json'), JSON.stringify(cfg));
writeFileSync(path.join(dir, 'exercises.json'), JSON.stringify({ exercises: [] }));
process.env.DATA_FILE = path.join(dir, 'data.json');
process.env.EXERCISES_FILE = path.join(dir, 'exercises.json');
process.env.DB_FILE = path.join(dir, 'routine.db');
process.env.UPLOADS_DIR = uploads;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { reloadConfig } = require('../src/config') as typeof import('../src/config');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { server } = require('../src/server') as typeof import('../src/server');
if (reloadConfig()?.type !== 'updated') throw new Error('test config rejected');
before(() => server.ready());

const BOUNDARY = '----routine-test-boundary';

/** A multipart body as the page's FormData sends it: one `file` part, or (no file) one plain field. */
function multipart(file?: { name: string; bytes: Buffer }) {
  const part = file
    ? `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: audio/mpeg\r\n\r\n`
    : `--${BOUNDARY}\r\nContent-Disposition: form-data; name="note"\r\n\r\nhello`;
  return Buffer.concat([Buffer.from(part), file?.bytes ?? Buffer.alloc(0), Buffer.from(`\r\n--${BOUNDARY}--\r\n`)]);
}

async function upload(file?: { name: string; bytes: Buffer }) {
  const res = await server.inject({
    method: 'POST', url: '/api/admin/upload', payload: multipart(file),
    headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` }
  });
  return { status: res.statusCode, body: res.json() as { success?: boolean; filename?: string; error?: string } };
}

/** Bytes that differ along the file, so a cut or a shifted copy shows */
const song = (size: number) => Buffer.from(Array.from({ length: size }, (_, i) => (i * 31 + (i >> 10)) & 0xff));

test('a file of exactly the limit is kept, byte for byte', async () => {
  const bytes = song(UPLOAD_MAX_BYTES);
  const { status, body } = await upload({ name: 'alarm-song.mp3', bytes });
  assert.equal(status, 200, JSON.stringify(body));
  assert.equal(body.success, true);
  assert.match(body.filename!, /-alarm-song\.mp3$/);
  assert.ok(readFileSync(path.join(uploads, body.filename!)).equals(bytes), 'the stored file is the one sent');
});

test('a file one byte over the limit is refused with 413 and a message, and nothing of it is kept', async () => {
  const was = readdirSync(uploads);
  const { status, body } = await upload({ name: 'long-song.mp3', bytes: song(UPLOAD_MAX_BYTES + 1) });
  assert.equal(status, 413, JSON.stringify(body));
  assert.equal(body.success, undefined);
  assert.match(body.error!, /^long-song\.mp3: /, 'it names the file');
  assert.ok(body.error!.includes(`${UPLOAD_MAX_MB} MB`), `it names the limit: ${body.error}`);
  assert.deepEqual(readdirSync(uploads), was, 'no cut copy left in uploads/');
});

test('a request with no file is still a 400', async () => {
  const was = readdirSync(uploads);
  const { status, body } = await upload();
  assert.equal(status, 400, JSON.stringify(body));
  assert.equal(body.error, 'No file uploaded');
  assert.deepEqual(readdirSync(uploads), was);
});
