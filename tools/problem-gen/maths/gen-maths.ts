// Generate the plain maths pools from the families (see ../README.md, «Plain maths»):
//
//   node tools/problem-gen/maths/gen-maths.ts            write backend/exercise-pools/*-maths.json
//   node tools/problem-gen/maths/gen-maths.ts --check    generate and report, write nothing
//   node tools/problem-gen/maths/gen-maths.ts --families a,b --target 40 --out DIR
//                                                        only these families, into DIR (audit.ts --dir DIR checks them)
//
// Each family gets its share of the grade's items (by weight) and is seeded by its id, so the
// output is the same on every run until a family changes. An item that repeats one already
// made, or whose right option is the only longest one, is dropped and the family tries again.

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { hash, rng } from '../lib.ts';
import { CURRICULUM, sourceOf } from './curriculum.ts';
import { MATHS_GRADES, MATHS_TARGET, type MathsGrade } from './grades.ts';
import { leaks, type Draft, type PlainExercise } from './lib.ts';
import { revealTooLong } from './check.ts';
import { mathsLevel } from '../difficulty.ts';
import { TOPICS } from '../../../shared/curriculum.ts';

const arg = (name: string) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const ONLY = arg('--families')?.split(',');
const TARGET = Number(arg('--target') ?? MATHS_TARGET);
const POOLS = arg('--out') ?? path.join(import.meta.dirname, '../../../backend/exercise-pools');

/** What makes two items the same: everything she reads and answers. */
const sameness = (d: Draft) => JSON.stringify({ ...d, title: undefined, options: 'options' in d ? [...d.options].sort() : undefined, correctIndex: undefined });

function generate(g: MathsGrade, target: number) {
  const out: PlainExercise[] = [];
  const seen = new Set<string>();
  const report: { id: string; made: number; wanted: number }[] = [];
  const total = g.families.reduce((s, f) => s + (f.weight ?? 1), 0);

  const makers = g.families.map(f => ({ f, r: rng(hash(`${g.prefix}-math:${f.id}`)), n: 0 }));
  const take = (m: (typeof makers)[number], wanted: number) => {
    let made = 0;
    for (let tries = 0; made < wanted && tries < wanted * 200; tries++) {
      const d = m.f.make(m.r);
      if (!d || leaks(d) || revealTooLong(d as PlainExercise) || seen.has(sameness(d))) continue;
      seen.add(sameness(d));
      m.n++;
      made++;
      const chapter = CURRICULUM[g.grade].toc.find(c => c.ch === m.f.chapter)!;
      const { type, title, ...rest } = d;
      out.push({
        id: `${g.prefix}-math-${m.f.id}-${String(m.n).padStart(3, '0')}`,
        type,
        category: 'Μαθηματικά',
        title,
        ...rest,
        stars: 1,
        source: sourceOf(g.grade, m.f.chapter),
        chapter: m.f.chapter,
        topic: m.f.topic,
        difficulty: mathsLevel(g.grade, d),
        generatorParams: { family: m.f.id, unit: chapter.unit, skill: m.f.skill },
      } as PlainExercise);
    }
    return made;
  };

  // Shares by weight (largest remainders), then any shortfall spread over the families with room
  const exact = makers.map(m => (target * (m.f.weight ?? 1)) / total);
  const shares = exact.map(Math.floor);
  const order = exact.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; shares.reduce((a, b) => a + b, 0) < target; k++) shares[order[k % order.length][1]]++;
  makers.forEach((m, i) => report.push({ id: m.f.id, made: take(m, shares[i]), wanted: shares[i] }));
  for (let pass = 0; out.length < target && pass < 5; pass++) {
    for (const m of makers) {
      if (out.length >= target) break;
      report.find(x => x.id === m.f.id)!.made += take(m, 1);
    }
  }
  // Family by family, in the order the families are listed
  const rank = new Map(g.families.map((f, i) => [f.id, i]));
  out.sort((a, b) => rank.get(a.generatorParams.family)! - rank.get(b.generatorParams.family)! || a.id.localeCompare(b.id));
  return { items: out, report };
}

const check = process.argv.includes('--check');
let failed = false;
mkdirSync(POOLS, { recursive: true });
for (const g of MATHS_GRADES) {
  const families = ONLY ? g.families.filter(f => ONLY.includes(f.id)) : g.families;
  if (!families.length) continue;
  const ids = new Set<string>();
  for (const f of families) {
    if (f.grade !== g.grade) throw new Error(`${f.id}: grade ${f.grade} in the ${g.prefix} list`);
    if (ids.has(f.id)) throw new Error(`duplicate family id ${f.id}`);
    ids.add(f.id);
    const chapter = g.toc.find(c => c.ch === f.chapter);
    if (!chapter || !g.units.includes(chapter.unit)) throw new Error(`${f.id}: chapter ${f.chapter} is not in units ${g.units.join(', ')} of the ${g.label} book`);
    if (!TOPICS.maths.includes(f.topic)) throw new Error(`${f.id}: topic «${f.topic}» is not one of shared/curriculum.ts TOPICS.maths`);
  }
  const { items, report } = generate({ ...g, families }, TARGET);
  console.log(`\n${g.prefix}: ${items.length}/${TARGET} maths items from ${families.length} families`);
  for (const x of report) console.log(`  ${x.made < x.wanted ? '!' : ' '} ${x.id.padEnd(24)} ${String(x.made).padStart(3)} (share ${x.wanted})`);
  if (items.length < TARGET) failed = true;
  if (!check) {
    const file = path.join(POOLS, g.file);
    writeFileSync(file, JSON.stringify({ description: g.description, grades: [g.grade], exercises: items }, null, 1) + '\n');
    console.log(`  wrote ${path.relative(process.cwd(), file)}`);
  }
}
if (failed) {
  console.error('\nnot enough distinct items: add variety to the families marked !');
  process.exit(1);
}
