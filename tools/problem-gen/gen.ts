// Generate the problem pools from the families:
//
//   node tools/problem-gen/gen.ts            write backend/exercise-pools/*-generated.json
//   node tools/problem-gen/gen.ts --check    generate and report, write nothing
//   node tools/problem-gen/gen.ts --tells    also print, per family, what the dropped choices gave away
//   node tools/problem-gen/gen.ts --families a,b --target 40 --out DIR
//                                            only these families, 40 per grade, into DIR (for
//                                            trying out new families; audit.ts --dir DIR checks them)
//
// Each family gets an equal share of the grade's target. Each problem is seeded on its own,
// by its family and number (g3:total-cost:16, then g3:total-cost:16:1, … when a draft is dropped),
// so the output is the same on every run until a family changes, and a dropped draft changes only
// its own problem, not the ones after it. A draft is dropped when its story repeats, when its
// known numbers (the [..|known] marks) repeat a problem of its family (the same calculation in
// another story), or when a choice gives its answer away by length (lib.ts, lengthTell); the
// family tries again, and a family that can't fill its share leaves the rest to the others.

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ProblemExercise } from '../../shared/types.ts';
import { builder, hash, READ_PROMPT_E5, READ_PROMPT_G3, rng, type Family } from './lib.ts';
import { G3_FAMILIES } from './families/g3/index.ts';
import { E5_FAMILIES } from './families/e5/index.ts';

const arg = (name: string) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const ONLY = arg('--families')?.split(',');
const TARGET = Number(arg('--target') ?? 500);
const POOLS = arg('--out') ?? path.join(import.meta.dirname, '../../backend/exercise-pools');

const GRADES = [
  {
    grade: 3 as const, prefix: 'g3', stars: 3, families: G3_FAMILIES, readPrompt: READ_PROMPT_G3,
    file: 'g-dimotikou-generated.json',
    description: 'Γ΄ Δημοτικού: προβλήματα σε βήματα, παραγόμενα από το tools/problem-gen (οικογένειες προβλημάτων από το βιβλίο των Μαθηματικών, ενότητες 1–3). Μην τα διορθώνετε εδώ: αλλάξτε την οικογένεια και ξανατρέξτε το gen.ts.',
  },
  {
    grade: 5 as const, prefix: 'e5', stars: 4, families: E5_FAMILIES, readPrompt: READ_PROMPT_E5,
    file: 'e-dimotikou-generated.json',
    description: 'Ε΄ Δημοτικού: προβλήματα με τη μέθοδο του κεφ. 1.3, παραγόμενα από το tools/problem-gen (οικογένειες προβλημάτων από το βιβλίο των Μαθηματικών, ενότητες 1–2). Μην τα διορθώνετε εδώ: αλλάξτε την οικογένεια και ξανατρέξτε το gen.ts.',
  },
];

/** The numbers a story gives (its [..|known] marks), sorted: two problems with the same are the same sum. */
const knownNumbers = (story: string) => [...story.matchAll(/\[([^\]|]+)\|known\]/g)]
  .flatMap(m => m[1].match(/\d{1,3}(?:\.\d{3})+|\d+/g) ?? []).map(x => x.replace(/\./g, '')).sort().join(',');

type Drops = { repeated: number; sameNumbers: number; tells: number };

function generate(families: Family[], prefix: string, stars: number, readPrompt: string, target: number) {
  const out: ProblemExercise[] = [];
  const stories = new Set<string>();
  const report: { id: string; made: number; wanted: number; drops: Drops; tells: string[] }[] = [];
  const makers = families.map(f => ({ f, n: 0, retry: 0, numbers: new Set<string>(), drops: { repeated: 0, sameNumbers: 0, tells: 0 }, tells: [] as string[] }));

  const take = (m: (typeof makers)[number], wanted: number) => {
    let made = 0;
    for (let tries = 0; made < wanted && tries < wanted * 40; tries++) {
      const r = rng(hash(`${prefix}:${m.f.id}:${m.n + 1}${m.retry ? `:${m.retry}` : ''}`));
      const b = builder(r, readPrompt);
      let draft;
      try { draft = m.f.make(r, b); } catch (e) { throw new Error(`${m.f.id} (${prefix}): ${(e as Error).message}`); }
      m.retry++;
      if (!draft) continue;
      if (stories.has(draft.story)) { m.drops.repeated++; continue; }
      const numbers = knownNumbers(draft.story);
      if (numbers && m.numbers.has(numbers)) { m.drops.sameNumbers++; continue; }
      if (b.tells.length) { m.drops.tells++; if (m.tells.length < 3) m.tells.push(b.tells[0]); continue; }
      stories.add(draft.story);
      if (numbers) m.numbers.add(numbers);
      m.n++;
      m.retry = 0;
      made++;
      out.push({
        id: `${prefix}-gen-${m.f.id}-${String(m.n).padStart(3, '0')}`,
        type: 'problem',
        category: 'Προβλήματα',
        title: draft.title,
        source: m.f.source,
        story: draft.story,
        steps: draft.steps,
        stars,
        generatorParams: { family: m.f.id, unit: m.f.unit },
      });
    }
    return made;
  };

  // An equal share each, then the shortfall spread over the families that still have room
  const share = Math.floor(target / families.length);
  let extra = target - share * families.length;
  for (const m of makers) {
    const wanted = share + (extra-- > 0 ? 1 : 0);
    report.push({ id: m.f.id, made: take(m, wanted), wanted, drops: m.drops, tells: m.tells });
  }
  for (let pass = 0; out.length < target && pass < 5; pass++) {
    for (const m of makers) {
      if (out.length >= target) break;
      const got = take(m, Math.ceil((target - out.length) / makers.length));
      report.find(x => x.id === m.f.id)!.made += got;
    }
  }
  return { problems: out, report };
}

const check = process.argv.includes('--check');
let failed = false;
mkdirSync(POOLS, { recursive: true });
for (const g of GRADES) {
  if (ONLY) g.families = g.families.filter(f => ONLY.includes(f.id));
  if (!g.families.length) continue;
  const ids = new Set<string>();
  for (const f of g.families) {
    if (f.grade !== g.grade) throw new Error(`${f.id}: grade ${f.grade} in the ${g.prefix} list`);
    if (ids.has(f.id)) throw new Error(`duplicate family id ${f.id}`);
    ids.add(f.id);
  }
  const { problems, report } = generate(g.families, g.prefix, g.stars, g.readPrompt, TARGET);
  console.log(`\n${g.prefix}: ${problems.length}/${TARGET} problems from ${g.families.length} families`);
  for (const x of report) {
    const d = x.drops;
    console.log(`  ${x.made < x.wanted ? '!' : ' '} ${x.id.padEnd(32)} ${String(x.made).padStart(3)} (share ${x.wanted})` +
      `${d.repeated + d.sameNumbers + d.tells ? `  dropped: ${[d.repeated && `${d.repeated} same story`, d.sameNumbers && `${d.sameNumbers} same numbers`, d.tells && `${d.tells} options that tell`].filter(Boolean).join(', ')}` : ''}`);
    if (process.argv.includes('--tells')) for (const t of x.tells) console.log(`      ${t}`);
  }
  if (problems.length < TARGET) failed = true;
  if (!check) {
    const file = path.join(POOLS, g.file);
    writeFileSync(file, JSON.stringify({ description: g.description, grades: [g.grade], exercises: problems }, null, 1) + '\n');
    console.log(`  wrote ${path.relative(process.cwd(), file)}`);
  }
}
if (failed) {
  console.error('\nnot enough distinct problems: add variety to the families marked !');
  process.exit(1);
}
