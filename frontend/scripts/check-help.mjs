// npm run check-help: fails when the owl's help and the screens drift apart.
//  1. Every anchor in src/help/anchors.ts is placed on a widget ({...help('x')}) and
//     explained by some tour (el: 'x' in a *.help.ts), and nothing names an unknown one.
//  2. Every screen (a component that lays itself over the page: position fixed, a
//     z-index of 100 or more) is a <HelpScreen>, or is listed below with the reason.
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(import.meta.dirname, '../src');

// Screens explained by another screen's tour, or with nothing to explain
const NOT_SCREENS = {
  'components/InlineRoutinePlayer.tsx': 'explained by the routine tour (Dashboard.help.ts)',
  'components/GlobalAlarm.tsx': 'explained by the routine tour (Dashboard.help.ts)',
  'components/RewardOverlay.tsx': 'a celebration, gone in a moment',
  'help/HelpProvider.tsx': 'the owl itself',
};

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(e.name)) files.push(p);
  }
})(SRC);
const rel = f => path.relative(SRC, f).split(path.sep).join('/');
const read = f => fs.readFileSync(f, 'utf8');

const registry = read(path.join(SRC, 'help/anchors.ts'));
const block = registry.slice(registry.indexOf('ANCHORS = ['), registry.indexOf('] as const')).replace(/\/\/.*$/gm, '');
const anchors = new Set([...block.matchAll(/'([^']+)'/g)].map(m => m[1]));

const placed = new Map(), explained = new Map();
const note = (map, name, where) => map.set(name, [...(map.get(name) ?? []), where]);
for (const f of files) {
  const src = read(f);
  if (rel(f) === 'help/anchors.ts') continue;
  if (f.endsWith('.help.ts')) for (const m of src.matchAll(/\bel: '([^']+)'/g)) note(explained, m[1], rel(f));
  else for (const m of src.matchAll(/\bhelp\('([^']+)'\)/g)) note(placed, m[1], rel(f));
}

const problems = [];
for (const a of anchors) {
  if (!placed.has(a)) problems.push(`anchor "${a}" is on no widget (add {...help('${a}')} or drop it from anchors.ts)`);
  if (!explained.has(a)) problems.push(`anchor "${a}" is in no tour (explain it in a *.help.ts)`);
}
for (const [map, what] of [[placed, 'placed in'], [explained, 'named by a tour in']]) {
  for (const [a, where] of map) if (!anchors.has(a)) problems.push(`unknown anchor "${a}" ${what} ${where.join(', ')}`);
}

for (const f of files) {
  if (!f.endsWith('.tsx')) continue;
  const src = read(f);
  const overlay = [...src.matchAll(/position:\s*fixed[^}]*?z-index:\s*(\d+)/g)].some(m => Number(m[1]) >= 100);
  if (overlay && !src.includes('<HelpScreen') && !NOT_SCREENS[rel(f)]) {
    problems.push(`${rel(f)} lays itself over the page but isn't a <HelpScreen> (give it a tour, or list it in NOT_SCREENS)`);
  }
}

if (problems.length) {
  console.error(`check-help: ${problems.length} problem(s)\n` + problems.map(p => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log(`check-help: ${anchors.size} anchors, all placed and explained; every screen has help`);
