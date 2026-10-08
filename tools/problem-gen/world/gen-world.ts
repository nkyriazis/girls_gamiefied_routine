// Write the world problems into a pool: node tools/problem-gen/world/gen-world.ts [n]
// (Γ΄: paint the story freehand, then work it out her own way)
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { hash, rng } from '../lib.ts';
import { problem, stockWorld } from './world.ts';
import { problemLevel } from '../difficulty.ts';
import type { ProblemCalcStep, ProblemStep } from '../../../shared/types.ts';

// The chapter a world needs is the latest of its operations' (Γ΄ book, #71): + ch. 2, × within the
// tables ch. 5, : ch. 6, − ch. 10, × with a factor past 10 ch. 11, counting the operation that gives the
// answer as she does it (36 + ? = 50 is a subtraction). That operation is its topic.
const TOPIC = { '+': 'Πρόσθεση', '−': 'Αφαίρεση', '×': 'Πολλαπλασιασμός', ':': 'Διαίρεση' } as const;
function chapterAndTopic(steps: ProblemStep[]): { chapter: string; topic: string } {
  const calc = steps.find((s): s is ProblemCalcStep => s.kind === 'calc')!;
  const value = (id: string) => calc.quantities.find(q => q.id === id)!.value;
  const opChapter = (op: '+' | '−' | '×' | ':', a: string, b: string) =>
    op === '+' ? 2 : op === ':' ? 6 : op === '−' ? 10 : Math.max(value(a), value(b)) > 10 ? 11 : 5;
  // The operation she does last: the relation with the answer in it, turned round when the answer is one of its terms
  const rel = calc.relations.find(x => [x.out, x.a, x.b].includes(calc.sought))!;
  const inverse = { '+': '−', '−': '+', '×': ':', ':': '×' } as const;
  const op = rel.out === calc.sought ? rel.op : (rel.op === '+' || rel.op === '×' || rel.a === calc.sought) ? inverse[rel.op] : rel.op;
  // and the answer's own operation, turned round (a × b with b sought is a division)
  const chapter = Math.max(...calc.relations.map(x => opChapter(x.op, x.a, x.b)), opChapter(op, rel.a, rel.b));
  return { chapter: String(chapter), topic: TOPIC[op] };
}

const N = Number(process.argv[2] ?? 200);
const r = rng(hash('g3-world'));
const out: object[] = [];
const seen = new Set<string>();
for (let tries = 0; out.length < N && tries < N * 50; tries++) {
  const w = stockWorld(r);
  const id = `g3-world-${String(out.length + 1).padStart(3, '0')}`;
  const p = w && problem(r, w, { calc: true, id });
  if (!p || seen.has(p.story)) continue;
  seen.add(p.story);
  out.push({
    id, type: 'problem', category: 'Προβλήματα',
    title: w.title, source: 'Μαθηματικά Γ΄, ενότητες 1–3 (πρόσθεση, αφαίρεση, πολλαπλασιασμός)',
    ...chapterAndTopic(p.steps), difficulty: problemLevel(3, p), story: p.story, steps: p.steps, stars: 3,
    generatorParams: { world: 'stock', sought: p.sought },
  });
}
const file = path.join(import.meta.dirname, '../../../backend/exercise-pools/g-dimotikou-world.json');
writeFileSync(file, JSON.stringify({
  description: 'Γ΄ Δημοτικού: προβλήματα από το μοντέλο κόσμου του tools/problem-gen/world · βάφεις εσύ την ιστορία και το λύνεις με τον δικό σου τρόπο. Μην τα διορθώνετε εδώ.',
  grades: [3], exercises: out,
}, null, 1) + '\n');
console.log(`${out.length} problems → ${path.relative(process.cwd(), file)}`);
