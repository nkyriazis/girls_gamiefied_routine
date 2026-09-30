// Write the world problems into a pool: node tools/problem-gen/world/gen-world.ts [n]
// (Γ΄: paint the story freehand, then work it out her own way)
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { hash, rng } from '../lib.ts';
import { problem, stockWorld } from './world.ts';

const N = Number(process.argv[2] ?? 200);
const r = rng(hash('g3-world'));
const out: object[] = [];
const seen = new Set<string>();
for (let tries = 0; out.length < N && tries < N * 50; tries++) {
  const w = stockWorld(r);
  const p = w && problem(r, w, { calc: true });
  if (!p || seen.has(p.story)) continue;
  seen.add(p.story);
  out.push({
    id: `g3-world-${String(out.length + 1).padStart(3, '0')}`, type: 'problem', category: 'Προβλήματα',
    title: w.title, source: 'Μαθηματικά Γ΄, ενότητες 1–3 (πρόσθεση, αφαίρεση, πολλαπλασιασμός)', story: p.story, steps: p.steps, stars: 3,
    generatorParams: { world: 'stock', sought: p.sought },
  });
}
const file = path.join(import.meta.dirname, '../../../backend/exercise-pools/g-dimotikou-world.json');
writeFileSync(file, JSON.stringify({
  description: 'Γ΄ Δημοτικού: προβλήματα από το μοντέλο κόσμου του tools/problem-gen/world · βάφεις μόνη σου την ιστορία και το λύνεις με τον δικό σου τρόπο. Μην τα διορθώνετε εδώ.',
  grades: [3], exercises: out,
}, null, 1) + '\n');
console.log(`${out.length} problems → ${path.relative(process.cwd(), file)}`);
