// Issue #37: do the human docs describe today's system? Read-only, on the working tree.
//   node .evidence/37/docs-check.mjs > .evidence/37/<phase>-docs.txt      (exit 1 when anything is found)
// 1. Claims about the design before SQLite (#14/#15), MCP (#55) and the old parent screen, by doc and line.
// 2. Every file path, npm script and /api route a doc names, checked against the tree, package.json and server.ts.
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
process.chdir(repo);
const tracked = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);
const exists = p => fs.existsSync(p) || tracked.some(f => f === p || f.startsWith(p.replace(/\/$/, '') + '/'));
// Human docs: every tracked .md outside archived/generated folders, and .cursorrules
const docs = tracked.filter(f => (/\.md$/.test(f) || f === '.cursorrules') && !/^(docs\/pr-|tools\/problem-gen\/\.)/.test(f)
  && f !== '.github/pull_request_template.md').concat(['index.md', '.cursorrules'].filter(f => fs.existsSync(f) && !tracked.includes(f)));

// What was true before #14/#15 (SQLite, server-driven STATE), #55 (no MCP) and the parent redesign, and isn't now
const stale = [
  [/globalState|readDb\(|writeDb\(|debounce|Debounced|state\.json\.tmp|persistState|loadState\(/i, 'in-memory state + debounced state.json writes (now SQLite, written through)'],
  [/state\.json(?!\W*(legacy|once|import))/i, 'state.json as where state lives (now routine.db; state.json is a one-time import)'],
  [/File-based persistence|JSON files \(file-based|file-based database|Why File-Based|copy 2 files/i, 'JSON-file persistence'],
  [/SYNC_STATE|ROUTINE_START|STARS_AWARDED|Initial load\W+REST/i, 'old WebSocket events / REST initial load (now one STATE message)'],
  [/\bMCP\b|\/mcp\b|MCP_API_KEY|ngrok/i, 'MCP / ngrok (retired in #55)'],
  [/docker-compose\.prod\.yml|node:20/i, 'compose file / Node image that no longer exist'],
  [/\?parent=true|"Dashboard" tab|Trigger Actions|State tab|Config tab|Uploads section/i, 'parent screen before Σήμερα/Ιστορικό/Ρυθμίσεις/Προχωρημένα'],
  [/"Validate" button|New "Validate"/i, 'a Validate button the JSON editor does not have'],
  [/No automated tests|verify_api\.js|Lines \d+-\d+/i, 'tests/files/line numbers that no longer match'],
  [/gh CLI|ghcr\.io\/cli\/cli/i, 'build.sh runs curl, not the gh CLI'],
  [/alarm will be silent/i, 'a failed upload now rings the melody'],
  [/minimal setup to get React working in Vite/i, 'the Vite template README'],
];

const out = [];
let findings = 0;
const say = s => out.push(s);
say(`$ git log -1 --format='%h %s'    # ${execSync('git branch --show-current', { encoding: 'utf8' }).trim()}`);
say('  ' + execSync("git log -1 --format='%h %s'", { encoding: 'utf8' }).trim());
say('');
say('1. Claims that describe the old design');
for (const doc of docs) {
  const lines = fs.readFileSync(doc, 'utf8').split('\n');
  const hits = [];
  lines.forEach((l, i) => {
    // CLAUDE.md is the architecture doc and is current: its legacy-import lines and the "No MCP" decision are right
    if (doc === 'CLAUDE.md' && /Legacy|legacy|No MCP|retired in #55|until migrated|old state\.json shape|Import state\.json/.test(l)) return;
    for (const [re, why] of stale) if (re.test(l)) { hits.push(`  ${doc}:${i + 1}  ${l.trim().slice(0, 110)}\n      -> ${why}`); break; }
  });
  const keep = hits;
  if (keep.length) { say(`  -- ${doc} (${keep.length})`); keep.forEach(say); findings += keep.length; }
}

// 2. Names a doc uses that should exist
const routes = new Set();
const server = fs.readFileSync('backend/src/server.ts', 'utf8');
for (const m of server.matchAll(/(?:server|fastify)\.(get|post|put|delete|patch)(?:<[^>]*>)?\(\s*'([^']+)'/g)) routes.add(`${m[1].toUpperCase()} ${m[2]}`);
const norm = p => p.replace(/\{[^}]*\}|<[^>]*>|:[A-Za-z]+|\.\.\.?/g, ':p').replace(/\/$/, '');
const routeShapes = new Set([...routes].map(r => norm(r.split(' ')[1])));
const scripts = {
  backend: Object.keys(JSON.parse(fs.readFileSync('backend/package.json', 'utf8')).scripts),
  frontend: Object.keys(JSON.parse(fs.readFileSync('frontend/package.json', 'utf8')).scripts),
};
const allScripts = new Set([...scripts.backend, ...scripts.frontend, 'test', 'install']);
// Files that exist only at runtime or are named as examples
const runtime = /(^|\/)(routine\.db(-wal|-shm)?|state\.json|logs\.jsonl|\.env|uploads\/?|backups(\/daily)?\/?|dist(\/.*)?|dev-dist\/?|materials\/?|node_modules\/?|<.*>.*|.*\.invalid-.*|.*\.partial-.*|pre-restore.*|SHA256SUMS|sw\.js|esm\/.*|dompurify\/.*|[\w-]*(after|before|probe)[\w-]*\.mjs|exercises\.json|data\.json)$/;
say('');
say('2. Files, npm scripts and routes the docs name that do not exist');
// The tools' READMEs name their own output folders and models; they are kept current per issue (part 1 still reads them)
for (const doc of docs.filter(d => !d.startsWith('tools/'))) {
  const text = fs.readFileSync(doc, 'utf8');
  const miss = new Set();
  // Paths in backticks or links: a/b.ext, a/b/, x.ts
  for (const m of text.matchAll(/`([^`\s]+)`|\]\(([^)\s#]+)\)/g)) {
    let p = (m[1] ?? m[2]).replace(/^\.\//, '').replace(/[),.:;]+$/, '');
    if (/^https?:|^\/|^@|^#|[*{}$=]|^-/.test(p)) continue;
    if (!/\.(ts|tsx|js|mjs|json|md|yml|yaml|sh|ps1|conf|css|py)$|\/$/.test(p) && !/^[\w.-]+\/[\w./-]+$/.test(p)) continue;
    if (runtime.test(p) || /^[a-z]+:\/\//.test(p) || /^\w+\/\w+$/.test(p) && !exists(p) && /^(Europe|image|audio|routine)\//.test(p)) continue;
    if (/^\.\w+$|^[A-Z_]+\/|^\d|\/\d+$|^[\w.-]+\.(io|com|gr|org)\//.test(p)) continue;   // ".ts", CHORE_X/Y, 0-30/10, hosts
    const roots = ['', 'frontend/', 'backend/', 'frontend/src/', 'frontend/src/components/', 'backend/src/', path.dirname(doc) + '/'];
    const found = roots.some(r => exists(path.normalize(r + p))) || tracked.some(f => f.endsWith('/' + p.replace(/\/$/, '')) || f.includes('/' + p));
    if (!found) miss.add(`file   ${p}`);
  }
  // npm run <script>
  for (const m of text.matchAll(/npm run ([\w:-]+)/g)) if (!allScripts.has(m[1])) miss.add(`script npm run ${m[1]}`);
  // Routes: METHOD /api/... or /api/... in backticks
  for (const m of text.matchAll(/(?:(GET|POST|PUT|DELETE|PATCH)\s+)?`?(\/api\/[A-Za-z0-9_\-/{}:<>.,]+)/g)) {
    const raw = m[2].replace(/[.,]+$/, '');
    if (/\*$|\/\.\.\.$/.test(raw) || raw === '/api' || raw === '/api/') continue;
    const variants = raw.includes('{') && raw.includes(',')
      ? raw.replace(/\{([^}]*,[^}]*)\}/, (_, alts) => `\u0000${alts}\u0000`).split('\u0000').reduce((acc, part, i) => i % 2 ? acc.flatMap(a => part.split(',').map(x => a + x)) : acc.map(a => a + part), [''])
      : [raw];
    for (const v of variants) {
      const shape = norm(v);
      const loose = new RegExp('^' + v.replace(/\.\.\./g, '\u0001').replace(/\{[^}]*\}|<[^>]*>|:[A-Za-z]+/g, ':p').replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\u0001/g, '.+') + '$');
      if (routeShapes.has(shape) || [...routeShapes].some(r => r.startsWith(shape + '/') || loose.test(r))) continue;
      miss.add(`route  ${m[1] ? m[1] + ' ' : ''}${v}`);
    }
  }
  if (miss.size) { say(`  -- ${doc} (${miss.size})`); [...miss].forEach(x => say('  ' + x)); findings += miss.size; }
}
say('');
say(findings ? `${findings} findings` : 'nothing found: the docs name only what exists, and no old design');
console.log(out.join('\n'));
process.exit(findings ? 1 : 0);
