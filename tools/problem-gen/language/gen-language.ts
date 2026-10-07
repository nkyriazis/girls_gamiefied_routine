// Write the plain language pools from the families (see ../README.md, «Plain language»):
//
//   node tools/problem-gen/language/gen-language.ts            write backend/exercise-pools/*-language.json
//   node tools/problem-gen/language/gen-language.ts --check    build and report, write nothing
//   node tools/problem-gen/language/gen-language.ts --out DIR  into DIR (audit.ts --dir DIR checks them)
//
// The items are written by hand (g3.ts); this gives them their ids, source and generatorParams
// and shuffles their options, seeded by the id, so the output is the same on every run until
// an item changes. An item that breaks a rule of lib.ts (too few options, the right one the
// only longest, a spelling whose right form is the closest to all the others, a «Δείξε μου»
// over the screen's limit) stops the run: fix the item, nothing is dropped silently.

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { hash, rng } from '../lib.ts';
import type { PlainExercise } from '../maths/lib.ts';
import { revealMax, revealed } from '../maths/check.ts';
import { lessonAt, parsePlace, sourceOf, type LanguageGrade } from './curriculum.ts';
import { optionProblems, type Draft, type LanguageFamily } from './lib.ts';
import { G3_LANGUAGE } from './g3.ts';

interface LanguageGradeSpec {
  grade: LanguageGrade;
  /** Item ids are `<prefix>-lang-<family>-NNN`. */
  prefix: string;
  /** The pool file in backend/exercise-pools/. */
  file: string;
  description: string;
  families: LanguageFamily[];
}

export const LANGUAGE_GRADES: LanguageGradeSpec[] = [
  {
    grade: 3, prefix: 'g3', file: 'g-dimotikou-language.json', families: G3_LANGUAGE,
    description: 'Γ΄ Δημοτικού: γλώσσα από τις ενότητες 1–3 του βιβλίου «Τα απίθανα μολύβια», γραμμένη στο tools/problem-gen/language (κάθε άσκηση με το μάθημα και τη σελίδα της στο source) και ελεγμένη από το audit.ts. Μην τη διορθώνετε εδώ: αλλάξτε το g3.ts και ξανατρέξτε το gen-language.ts.',
  },
];

const arg = (name: string) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const POOLS = arg('--out') ?? path.join(import.meta.dirname, '../../../backend/exercise-pools');

function shuffled(d: Draft, seed: string): Draft {
  const r = rng(hash(seed));
  if (d.type === 'multiple-choice') {
    const right = d.options[d.correctIndex];
    const options = r.shuffle(d.options);
    return { ...d, options, correctIndex: options.indexOf(right) };
  }
  if (d.type === 'fill-blank') return { ...d, options: r.shuffle(d.options) };
  return d;
}

function build(g: LanguageGradeSpec): PlainExercise[] {
  const ids = new Set<string>();
  const out: PlainExercise[] = [];
  const problems: string[] = [];
  for (const f of g.families) {
    if (f.grade !== g.grade) throw new Error(`${f.id}: grade ${f.grade} in the ${g.prefix} list`);
    if (ids.has(f.id)) throw new Error(`duplicate family id ${f.id}`);
    ids.add(f.id);
    f.items.forEach((item, i) => {
      const id = `${g.prefix}-lang-${f.id}-${String(i + 1).padStart(3, '0')}`;
      const place = parsePlace(item.at);
      if (!lessonAt(g.grade, place)) problems.push(`${id}: ${item.at} is no lesson page of the book`);
      const d = shuffled(item.draft, id);
      for (const p of optionProblems(d, f.skill)) problems.push(`${id}: ${p}`);
      const ex = { ...d } as PlainExercise;
      const shown = revealed(ex);
      if (shown.length > revealMax(ex)) problems.push(`${id}: «Δείξε μου» would show ${shown.length} characters («${shown}»), over ${revealMax(ex)}`);
      const { type, title, ...rest } = d;
      out.push({
        id, type, category: 'Γλώσσα', title, ...rest, stars: 1,
        source: sourceOf(g.grade, item.at),
        generatorParams: { family: f.id, unit: place.unit, skill: f.skill },
      } as PlainExercise);
    });
  }
  if (problems.length) throw new Error(`${g.prefix}: items to fix\n  ${problems.join('\n  ')}`);
  return out;
}

const check = process.argv.includes('--check');
mkdirSync(POOLS, { recursive: true });
for (const g of LANGUAGE_GRADES) {
  const items = build(g);
  const types = new Map<string, number>();
  for (const ex of items) types.set(ex.type, (types.get(ex.type) ?? 0) + 1);
  console.log(`\n${g.prefix}: ${items.length} language items from ${g.families.length} families; ${[...types].map(([t, n]) => `${t} ${n}`).join(', ')}`);
  for (const f of g.families) console.log(`   ${f.id.padEnd(22)} ${String(f.items.length).padStart(3)}  ${f.skill}`);
  if (!check) {
    const file = path.join(POOLS, g.file);
    writeFileSync(file, JSON.stringify({ description: g.description, grades: [g.grade], exercises: items }, null, 1) + '\n');
    console.log(`  wrote ${path.relative(process.cwd(), file)}`);
  }
}
