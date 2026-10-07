// Issue #49 part 3a: does the language audit catch a wrong key? For every Γ΄ language item, move its key
// to every other place it could be and audit the pool with that one item changed:
//   multiple choice: correctIndex to each other option;
//   fill-blank: correctAnswers to each other option of the bank;
//   true-false: the other value;
//   ordering: each pair of neighbours swapped.
// A move is caught when the audit reports an error on that item's id. Run from the repo root:
//   docker run --rm -u $(id -u):$(id -g) -v $PWD:/w -w /w node:24-alpine node .evidence/49-language/after-audit-mutations.ts
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Exercise } from '../../shared/types.ts';
import { auditLanguage, generatedLanguage } from '../../tools/problem-gen/language/check.ts';

type Pool = { file: string; grades: number[]; exercises: Exercise[] };
const DIR = 'backend/exercise-pools';
const pools: Pool[] = readdirSync(DIR).filter(f => f.endsWith('.json'))
  .map(file => ({ file, ...JSON.parse(readFileSync(path.join(DIR, file), 'utf-8')) }));

const base = auditLanguage(pools).errors;
console.log(`audit of the pool as written: ${base.length} errors`);

function moves(ex: Exercise): { what: string; ex: Exercise }[] {
  const out: { what: string; ex: Exercise }[] = [];
  if (ex.type === 'multiple-choice') ex.options.forEach((o, i) => { if (i !== ex.correctIndex) out.push({ what: `key → «${o}»`, ex: { ...ex, correctIndex: i } }); });
  if (ex.type === 'fill-blank') ex.options.forEach(o => { if (o !== ex.correctAnswers[0]) out.push({ what: `key → «${o}»`, ex: { ...ex, correctAnswers: [o] } }); });
  if (ex.type === 'true-false') out.push({ what: `key → ${!ex.correctValue}`, ex: { ...ex, correctValue: !ex.correctValue } });
  if (ex.type === 'ordering') {
    for (let i = 0; i + 1 < ex.items.length; i++) {
      const items = [...ex.items];
      [items[i], items[i + 1]] = [items[i + 1], items[i]];
      out.push({ what: `swap «${ex.items[i].content}» and «${ex.items[i + 1].content}»`, ex: { ...ex, items } });
    }
  }
  return out;
}

const items = generatedLanguage(pools);
let total = 0, caught = 0, itemsAll = 0;
const missed: string[] = [];
for (const { pool, ex } of items) {
  let all = true;
  for (const m of moves(ex)) {
    total++;
    const changed = pools.map(p => (p !== pool ? p : { ...p, exercises: p.exercises.map(e => (e === ex ? m.ex : e)) }));
    const errs = auditLanguage(changed).errors.filter(e => e.startsWith(`${ex.id}: `));
    if (errs.length) {
      caught++;
      console.log(`  ✔ ${ex.id} ${m.what}: ${errs[0].slice(ex.id.length + 2)}`);
    } else {
      all = false;
      missed.push(`${ex.id} ${m.what}`);
      console.log(`  ✘ ${ex.id} ${m.what}: not caught`);
    }
  }
  if (all) itemsAll++;
}
console.log(`\n${items.length} items, ${total} moved keys: ${caught} caught, ${total - caught} missed; ${itemsAll} of ${items.length} items have every move caught`);
if (missed.length) { console.log(`missed:\n  ${missed.join('\n  ')}`); process.exit(1); }
