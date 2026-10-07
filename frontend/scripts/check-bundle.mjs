// The build's own check (#35), last step of `npm run build`, so CI and the image build run it too.
// The parent's JSON editors (Monaco) must come from the Pi, never the internet, and must stay out of
// what every device downloads:
//  - nothing in dist loads from cdn.jsdelivr.net (Monaco once did, so the editors died with the internet)
//  - Monaco's files (the lazy JsonEditor chunk, jsonMode, the workers, codicon) exist and are neither
//    linked nor preloaded by index.html, nor imported by the kids' entry (directly or through a chunk it
//    imports), nor precached by the service worker. build.rollupOptions.output.manualChunks did exactly
//    that once: it put react in the Monaco chunk, so the kids' entry imported all of Monaco.
//  - the DOMPurify that runs in Monaco is the installed dompurify package (the override in package.json),
//    not the copy monaco vendors (vite.config.ts redirects it).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const assets = path.join(dist, 'assets');
const read = f => fs.readFileSync(path.join(dist, f), 'utf8');
const failures = [];
const fail = msg => failures.push(msg);

const files = fs.readdirSync(dist, { recursive: true }).filter(f => fs.statSync(path.join(dist, f)).isFile());
const texts = files.filter(f => /\.(js|mjs|css|html|webmanifest)$/.test(f));

// 1. No CDN. One URL may stay: @monaco-editor/loader's own default (its config/index.js), dead code
// once monaco.ts hands the loader the bundled Monaco (loader.config({ monaco })), so it never fetches.
const loaderDefault = fs.readFileSync(path.join(root, 'node_modules/@monaco-editor/loader/lib/es/config/index.js'), 'utf8')
    .match(/https:\/\/cdn\.jsdelivr\.net\/[^'"]+/)?.[0];
for (const f of texts) {
    const urls = (read(f).match(/https?:\/\/cdn\.jsdelivr\.net[^'"`\s)]*/g) ?? []).filter(u => u !== loaderDefault);
    if (urls.length) fail(`${f} loads from cdn.jsdelivr.net: ${[...new Set(urls)].join(', ')}`);
}

// 2. Monaco's files, by name
const assetNames = fs.readdirSync(assets);
const isMonaco = f => /^(JsonEditor|jsonMode|codicon)-|\.worker-/.test(path.basename(f));
const monaco = assetNames.filter(isMonaco);
if (!monaco.some(f => /^JsonEditor-.*\.js$/.test(f))) fail('no assets/JsonEditor-*.js: the JSON editor is not its own lazy chunk');
if (!monaco.some(f => /^json\.worker-.*\.js$/.test(f))) fail('no assets/json.worker-*.js: the JSON worker is not bundled');
if (!monaco.some(f => /^editor\.worker-.*\.js$/.test(f))) fail('no assets/editor.worker-*.js: the editor worker is not bundled');

// 3. index.html loads none of them, and the kids' entry imports none of them, nor any chunk with Monaco in it
const html = read('index.html');
for (const f of monaco) if (html.includes(f)) fail(`index.html loads or preloads assets/${f}`);
for (const [, f] of html.matchAll(/(?:src|href)="\/?(assets\/[^"]+\.js)"/g))
    if (!isMonaco(f) && read(f).includes('monaco-editor')) fail(`index.html loads or preloads ${f}, which has Monaco in it`);
const entries = [...html.matchAll(/<script[^>]+type="module"[^>]+src="\/?(assets\/[^"]+\.js)"/g)].map(m => m[1]);
if (entries.length === 0) fail('index.html has no module entry script');
const staticImports = f => [...read(f).matchAll(/(?:import|export)\s*(?:[\w$*{}\s,]+from\s*)?["'](\.\/[^"']+\.js)["']/g)]
    .map(m => path.posix.join(path.posix.dirname(f), m[1]));
const seen = new Set(), queue = [...entries];
while (queue.length) {
    const f = queue.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    queue.push(...staticImports(f));
}
for (const f of seen) {
    if (isMonaco(f)) fail(`the kids' entry imports ${f}`);
    else if (read(f).includes('monaco-editor')) fail(`the kids' entry imports ${f}, which has Monaco in it`);
}

// 4. The service worker precaches none of them
const sw = files.find(f => f === 'sw.js');
if (!sw) fail('no sw.js');
else {
    const precached = [...read(sw).matchAll(/url:"([^"]+)"/g)].map(m => m[1]);
    if (precached.length === 0) fail('sw.js has no precache entries (has its format changed?)');
    for (const u of precached) if (isMonaco(u)) fail(`sw.js precaches ${u}`);
}

// 5. The DOMPurify that runs is the installed package's
const purify = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/dompurify/package.json'), 'utf8')).version;
const versions = new Set();
for (const f of assetNames.filter(f => f.endsWith('.js'))) {
    const js = fs.readFileSync(path.join(assets, f), 'utf8');
    // DOMPurify's factory: `DOMPurify.version = '3.4.16'; DOMPurify.removed = [];` (minified: e.version="…",e.removed=[])
    for (const m of js.matchAll(/([\w$]+)\.version\s*=\s*["'`](\d+\.\d+\.\d+)["'`]\s*[,;]\s*\1\.removed\s*=\s*\[\]/g)) versions.add(m[2]);
}
if (versions.size === 0) fail('found no DOMPurify in the build (Monaco renders its hovers through it)');
for (const v of versions) if (v !== purify) fail(`the build carries DOMPurify ${v}, not the installed ${purify}`);

if (failures.length) {
    console.error(`check-bundle: ${failures.length} problem(s)\n` + failures.map(f => `  - ${f}`).join('\n'));
    process.exit(1);
}
const size = f => fs.statSync(path.join(assets, f)).size;
console.log(`check-bundle: ok. Monaco in ${monaco.length} lazy files (${(monaco.reduce((s, f) => s + size(f), 0) / 1e6).toFixed(2)} MB), ` +
    `not precached, not in the kids' entry (${[...seen].join(', ')}); DOMPurify ${[...versions].join(', ')}; no CDN.`);
