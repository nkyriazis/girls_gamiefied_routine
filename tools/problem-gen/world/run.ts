// Try the world model: node world/run.ts [n]
// Prints a sample, one world asked several ways, what a child's calculations mean,
// and how far lazy strategies get on these problems and on the current pools.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { hash, rng } from '../lib.ts';
import { meaning, problem, stockWorld, type Made } from './world.ts';

const N = Number(process.argv[2] ?? 500);
const r = rng(hash('world-proto'));
const made: Made[] = [];
const seen = new Set<string>();
for (let tries = 0; made.length < N && tries < N * 50; tries++) {
  const w = stockWorld(r);
  if (!w) continue;
  const p = problem(r, w);
  if (!p || seen.has(p.story)) continue;
  seen.add(p.story);
  made.push(p);
}

const show = (p: Made) => {
  console.log(`  ${p.story}`);
  for (const s of p.steps.slice(1)) {
    if (s.kind === 'choice') console.log(`    ${s.prompt} ${s.options.map((o, i) => (i === s.correctIndex ? `[${o}]` : o)).join(' | ')}`);
    if (s.kind === 'numbers') console.log(`    ${s.rows.map(x => `${x.label} ${x.answer}`).join(' ; ')}`);
  }
};
console.log(`${made.length} problems\n\n== sample`);
for (const p of made.slice(0, 14)) { show(p); console.log(); }

// One world, every question it can ask
console.log('== one world, several questions');
for (let t = 0; t < 400; t++) {
  const w = stockWorld(rng(1000 + t));
  if (!w || w.asks.size < 5 || w.qs.size < 7) continue;
  const rr = rng(7);
  const got = new Map<string, Made>();
  for (let k = 0; k < 200 && got.size < 4; k++) {
    const p = problem(rr, w);
    if (p && !got.has(p.sought)) got.set(p.sought, p);
  }
  if (got.size < 4) continue;
  for (const p of got.values()) show(p), console.log();
  break;
}

// A child's calculations, read back by the model
console.log('== what her calculations mean');
const p0 = made.find(p => p.derivation.length === 2 && p.stated.size >= 5 && p.world.qs.has('d') && p.world.qs.has('z'))!;
show(p0);
const vals = [...p0.stated].map(q => p0.world.qs.get(q)!.value);
// Every calculation she might try, on the numbers of the story and what she finds
const pool0 = new Set(vals), said = new Set<string>();
for (let round = 0; round < 3; round++) for (const x of [...pool0]) for (const y of [...pool0]) for (const op of ['+', '−', '×', ':'] as const) {
  if (x === y || (op === '+' || op === '×') && x < y) continue;
  const m = meaning(p0.world, x, op, y);
  if (!m || said.has(m.id)) continue;
  said.add(m.id); pool0.add(m.value);
  console.log(`    ${x} ${op} ${y} = ${m.value} → «${m.label}»${m.id === p0.sought ? '  ← the answer' : p0.needed.has(m.id) ? '' : ''}`);
}
console.log(`    anything else, e.g. ${vals[0]} + ${vals[vals.length - 1]} → nothing in this story`);

// Lazy strategies, on the marked phrases the tag step shows
type Phrase = { text: string; role: string; last: boolean };
const MARK = /\[([^\]|]+)\|(known|sought|extra)\]/g;
function phrases(story: string): Phrase[] {
  const sentences = story.split(/(?<=[.;])\s+(?=[\[Α-ΩΆ-Ώ])/);
  return sentences.flatMap((s, i) => [...s.matchAll(MARK)].map(m => ({ text: m[1], role: m[2], last: i === sentences.length - 1 })));
}
const digit = /\d/;
const lazy: Record<string, (p: Phrase) => string> = {
  'numbers known, last sentence sought': p => (p.last && !digit.test(p.text) ? 'sought' : p.last ? 'sought' : 'known'),
  'numbers known, number-less sought': p => (digit.test(p.text) ? 'known' : 'sought'),
  '… and ages, times, pages extra': p => (/χρονών|ώρα|πρωί|απόγευμα|λεπτά|σελίδες|στενά/.test(p.text) ? 'extra' : digit.test(p.text) ? 'known' : 'sought'),
  'questions sought, rest known': p => (/^(πόσ|Πόσ|για πόσ|Για πόσ)/.test(p.text) ? 'sought' : 'known'),
  '… and ages, times, pages extra ': p => (/^(πόσ|Πόσ|για πόσ|Για πόσ)/.test(p.text) ? 'sought' : /χρονών|ώρα|πρωί|απόγευμα|λεπτά|σελίδες|στενά|παιδιά|παιχνίδια/.test(p.text) ? 'extra' : 'known'),
};
function score(stories: string[]) {
  const out: Record<string, string> = {};
  // Only the problems with something to leave out: with none, "all known" is simply right
  const withExtra = stories.filter(s => phrases(s).some(p => p.role === 'extra'));
  for (const [name, f] of Object.entries(lazy)) {
    const ok = withExtra.filter(s => phrases(s).every(p => f(p) === p.role)).length;
    out[name] = `${Math.round((100 * ok) / withExtra.length)}%`;
  }
  const ph = stories.map(phrases);
  out['question last'] = `${Math.round((100 * ph.filter(x => x.some(p => p.last && p.role === 'sought')).length) / ph.length)}%`;
  out['ends with ;'] = `${Math.round((100 * stories.filter(s => s.trim().endsWith(';')).length) / stories.length)}%`;
  const k = ph.flat().filter(p => p.role === 'known');
  out['knowns without digits'] = `${Math.round((100 * k.filter(p => !digit.test(p.text)).length) / k.length)}%`;
  out['no extra at all'] = `${Math.round((100 * ph.filter(x => !x.some(p => p.role === 'extra')).length) / ph.length)}%`;
  const e = ph.flat().filter(p => p.role === 'extra');
  out['extras of the answer\'s kind'] = '';
  return out;
}
const pool = (f: string) => (JSON.parse(readFileSync(path.join(import.meta.dirname, '../../../backend/exercise-pools', f), 'utf-8')).exercises as { story: string; steps: { kind: string }[] }[])
  .filter(e => e.steps[0]?.kind === 'tag').map(e => e.story);
const cols = { 'Γ΄ now': score(pool('g-dimotikou-generated.json')), 'Ε΄ now': score(pool('e-dimotikou-generated.json')), 'world': score(made.map(p => p.story)) };
console.log('\n== lazy strategies (share of the problems with an unneeded fact that they tag perfectly)');
for (const row of Object.keys(cols.world)) {
  if (row.startsWith('extras of')) continue;
  console.log(`  ${row.padEnd(34)} ${Object.values(cols).map(c => c[row].padStart(8)).join('')}`);
}
console.log(`  ${''.padEnd(34)} ${Object.keys(cols).map(c => c.padStart(8)).join('')}`);

// The same sentence, needed in one problem and extra in another
const role = new Map<string, Set<string>>();
for (const p of made) for (const ph of phrases(p.story)) {
  const key = ph.text.replace(/\d[\d.]*/g, '#');
  if (!role.has(key)) role.set(key, new Set());
  role.get(key)!.add(ph.role);
}
const both = [...role.values()].filter(s => s.has('known') && s.has('extra')).length;
const sameKind = made.filter(p => [...p.stated].some(q => !p.needed.has(q) && p.world.qs.get(q)!.unit === p.world.qs.get(p.sought)!.unit)).length;
console.log(`  world: an unneeded fact of the same kind as the answer (ευρώ with ευρώ…): ${Math.round(100 * sameKind / made.length)}%`);
const bySlot = new Map<string, Set<string>>();
for (const p of made) for (const q of p.stated) {
  const slot = q.replace(/\d/g, '#');
  if (!bySlot.has(slot)) bySlot.set(slot, new Set());
  bySlot.get(slot)!.add(p.needed.has(q) ? 'known' : 'extra');
}
console.log(`  world: kinds of fact that are needed in some problems and not in others: ${[...bySlot].filter(([, s]) => s.size === 2).map(([k]) => k).join(' ')} (of ${[...bySlot.keys()].join(' ')})`);
console.log(`\n  phrase shapes that are needed in some problems and extra in others: ${both} of ${role.size}`);

// Painting freehand: the story as words, what each word belongs to, and a tolerant check.
// A fact counts as found when its core words are painted (the number, or «διπλάσια»);
// extra words around it are fine; painting an unneeded fact as known is a mistake.
type Word = { w: string; q?: string; role?: string; core: boolean };
function words(p: Made): Word[] {
  const out: Word[] = [];
  for (const piece of p.pieces) {
    const core = piece.role === 'sought' ? piece.text.split(' ').slice(0, piece.text.startsWith('για') || piece.text.startsWith('Για') ? 3 : 2) : (piece.core ?? '').split(' ');
    for (const w of piece.text.split(/\s+/).filter(Boolean)) {
      out.push({ w, q: piece.q, role: piece.role, core: !!piece.role && core.includes(w.replace(/[.;,]$/, '')) });
    }
  }
  return out;
}
function grade(ws: Word[], known: Set<number>, sought: Set<number>) {
  const notes: string[] = [];
  const qs = new Map<string, { role: string; idx: number[] }>();
  ws.forEach((x, i) => { if (x.q && x.core) { if (!qs.has(x.q)) qs.set(x.q, { role: x.role!, idx: [] }); qs.get(x.q)!.idx.push(i); } });
  let found = 0, need = 0;
  for (const [, { role, idx }] of qs) {
    const brush = role === 'sought' ? sought : known;
    const hit = idx.every(i => brush.has(i));
    if (role === 'known') { need++; if (hit) found++; }
    if (role === 'sought' && !hit) notes.push('δεν βρήκες τι ψάχνουμε');
    if (role === 'extra' && idx.some(i => known.has(i))) notes.push(`«${idx.map(i => ws[i].w).join(' ')}» δεν το χρειαζόμαστε`);
  }
  if (found < need) notes.push(`βρήκες ${found} από τα ${need} που χρειαζόμαστε`);
  // Painting everything isn't finding: at most twice as many words as the phrases need
  const phraseWords = ws.filter(x => x.role === 'known').length;
  if (known.size > 2 * phraseWords + 2) notes.push('έβαψες πολλά: βάψε μόνο ό,τι χρειάζεται');
  return notes.length ? notes.join('· ') : 'σωστά!';
}
const demo = made.find(p => p.derivation.length === 2 && [...p.stated].some(q => !p.needed.has(q)))!;
const ws = words(demo);
console.log('\n== painting freehand');
console.log(`  ${ws.map(x => x.w).join(' ')}`);
const all = (f: (x: Word) => boolean) => new Set(ws.map((x, i) => (f(x) ? i : -1)).filter(i => i >= 0));
const sloppy = (role: string) => {
  // her brush: the phrase, plus a word or two around it, sometimes missing the noun
  const s = new Set<number>();
  ws.forEach((x, i) => { if (x.role === role) { s.add(i); if (i > 0 && i % 2) s.add(i - 1); } });
  return s;
};
const tries: [string, Set<number>, Set<number>][] = [
  ['sloppy but right', sloppy('known'), sloppy('sought')],
  ['every number known', all(x => /\d|διπλάσι|μισά|^(δύο|τρ|τέσσερ|πέντε|έξι|επτά|οκτώ|εννέα|δέκα)/.test(x.w)), sloppy('sought')],
  ['the whole story', all(() => true), sloppy('sought')],
];
for (const [name, k, s] of tries) console.log(`  ${name.padEnd(20)} → ${grade(ws, k, s)}`);

// For the audit: the same shape as the pools
import { writeFileSync, mkdirSync } from 'node:fs';
const outDir = path.join(import.meta.dirname, '../.out/world');
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'world.json'), JSON.stringify({ description: 'prototype', grades: [3], exercises: made.map((p, i) => ({
  id: `g3-world-${i}`, type: 'problem', category: 'Προβλήματα', title: 'Πρόβλημα', story: p.story, steps: p.steps, stars: 3,
})) }, null, 1));
