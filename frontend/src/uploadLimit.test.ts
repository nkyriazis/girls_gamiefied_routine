// npm test (frontend): nginx lets an upload of the app's limit through, and only the upload (#107).
// nginx answers anything over client_max_body_size with its own 413 before the backend sees it, and
// its default is 1m: an alarm song over 1 MiB never arrived. The upload's location allows the file
// plus room for the multipart headers; every other request keeps nginx's 1m guard.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { UPLOAD_MAX_BYTES, uploadFailed, uploadTooBig } from '../../shared/uploads.ts';

const conf = readFileSync(new URL('../nginx.conf', import.meta.url), 'utf8').replace(/#.*$/gm, '');

const bytes = (size: string) => {
  const [, n, unit] = /^(\d+)([kKmMgG]?)$/.exec(size) ?? assert.fail(`not an nginx size: ${size}`);
  return Number(n) * { '': 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3 }[unit.toLowerCase() as '' | 'k' | 'm' | 'g'];
};

// The block of `location = /api/admin/upload`, which wins over `location /api` for that exact path
const uploadBlock = () => /location\s*=\s*\/api\/admin\/upload\s*\{([^}]*)\}/.exec(conf)?.[1];

test('the upload has its own location in nginx.conf, proxied to the backend', () => {
  const block = uploadBlock();
  assert.ok(block, 'no `location = /api/admin/upload { … }` in frontend/nginx.conf');
  assert.match(block, /proxy_pass\s+http:\/\/backend:3000;/);
});

test('nginx lets a file of the limit through, with room for the multipart headers', () => {
  const size = /client_max_body_size\s+(\S+);/.exec(uploadBlock() ?? '')?.[1];
  assert.ok(size, 'the upload location sets no client_max_body_size: nginx refuses anything over 1m');
  assert.ok(bytes(size) >= UPLOAD_MAX_BYTES + 64 * 1024,
    `client_max_body_size ${size} is not above UPLOAD_MAX_BYTES (${UPLOAD_MAX_BYTES}) plus the headers`);
});

test('no other request gets the bigger body: client_max_body_size is set only for the upload', () => {
  assert.equal(conf.match(/client_max_body_size/g)?.length, 1, 'client_max_body_size appears outside the upload location');
});

// What the page says (api.ts uploadFile → uploadFailed), for each way an upload can fail
test('a failed upload reads the same from the backend, from nginx and from a lost connection', () => {
  const backend413 = uploadTooBig('song.mp3');
  assert.equal(uploadFailed('song.mp3', { status: 413, error: backend413 }), backend413, "the backend's own message");
  assert.equal(uploadFailed('song.mp3', { status: 413 }), backend413, "nginx's HTML 413 gets the limit's message");
  assert.match(backend413, /^song\.mp3: πάνω από 10 MB, δεν ανέβηκε\./);
  assert.match(uploadFailed('song.mp3', 'no answer'), /^song\.mp3: δεν ανέβηκε, δεν ήρθε απάντηση\. Έλεγξε τη σύνδεση/);
  assert.equal(uploadFailed('song.mp3', { status: 502 }), 'song.mp3: το ανέβασμα απέτυχε (HTTP 502).');
});
