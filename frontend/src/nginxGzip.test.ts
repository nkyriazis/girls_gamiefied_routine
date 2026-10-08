// npm test (frontend): nginx sends scripts, styles and JSON gzipped, and never touches media or /ws (#100).
// nginx:alpine leaves gzip off, so the Pi sent the kids' 720 kB entry and Monaco's 4 MB raw. The image's
// builder writes a .gz beside every script and style in dist/assets (gzip_static serves those, so the Pi
// compresses nothing big per request); what isn't precompressed (/api JSON, index.html) goes through gzip
// at level 5. Media is already compressed and keeps its byte ranges; the WebSocket has its own deflate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const conf = readFileSync(new URL('../nginx.conf', import.meta.url), 'utf8').replace(/#.*$/gm, '');
const dockerfile = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8').replace(/#.*$/gm, '');

// The server block's own directives: everything outside its location blocks
const serverLevel = conf.replace(/location[^{]*\{[^}]*\}/g, '');
const directive = (text: string, name: string) => new RegExp(`(?:^|[;{\\s])${name}\\s+([^;]+);`).exec(text)?.[1].trim();

test('gzip is on for the whole server, with the precompressed files first', () => {
  assert.equal(directive(serverLevel, 'gzip'), 'on', 'no `gzip on;` at the server level of frontend/nginx.conf');
  assert.equal(directive(serverLevel, 'gzip_static'), 'on', 'no `gzip_static on;`: nginx would compress Monaco on every request');
  assert.equal(directive(serverLevel, 'gzip_comp_level'), '5');
  assert.equal(directive(serverLevel, 'gzip_min_length'), '1024');
  assert.equal(directive(serverLevel, 'gzip_vary'), 'on', 'without Vary a cache could hand gzip to a client that never asked');
});

const types = () => (directive(serverLevel, 'gzip_types') ?? '').split(/\s+/);

test('gzip_types names the scripts, styles, JSON and SVG', () => {
  for (const t of ['application/javascript', 'text/css', 'application/json', 'image/svg+xml'])
    assert.ok(types().includes(t), `gzip_types leaves out ${t}`);
});

test('gzip_types names no media: mp3, wav, png, ico and uploads go as they are', () => {
  for (const t of types())
    assert.doesNotMatch(t, /^(audio|video|font)\/|^image\/(?!svg\+xml$)|^application\/(octet-stream|zip|gzip|pdf)$|^\*$/,
      `gzip_types names ${t}, which is already compressed (or everything)`);
});

test('the WebSocket is never gzipped: /ws turns gzip off', () => {
  const ws = /location\s+\/ws\s*\{([^}]*)\}/.exec(conf)?.[1];
  assert.ok(ws, 'no `location /ws { … }` in frontend/nginx.conf');
  assert.equal(directive(ws, 'gzip'), 'off');
});

test("the image's builder writes the .gz files gzip_static serves, after the build and keeping the originals", () => {
  const build = dockerfile.indexOf('RUN npm run build');
  const gz = /RUN [^\n]*gzip -9 -k -n[^\n]*/.exec(dockerfile);
  assert.ok(build >= 0, 'frontend/Dockerfile has no `RUN npm run build`');
  assert.ok(gz, 'frontend/Dockerfile writes no .gz files (gzip -9 -k -n)');
  assert.ok(gz.index > build, 'the .gz files are written before the build that makes the files');
  assert.match(gz[0], /dist\/assets/, 'only dist/assets: sw.js and workbox stay as Workbox wrote them');
  assert.match(gz[0], /-size \+1k/, 'files under 1 kB are not worth a .gz (gzip_min_length 1024)');
});
