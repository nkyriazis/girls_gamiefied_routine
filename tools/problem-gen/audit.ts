// Audit the problem pools, independently of the generator that wrote them:
//
//   node tools/problem-gen/audit.ts                    every problem in backend/exercise-pools
//   node tools/problem-gen/audit.ts --sample out.md 40  also write 40 random problems per grade, as text, for reading
//   node tools/problem-gen/audit.ts --dir DIR           audit the pools in DIR instead
//   node tools/problem-gen/audit.ts --all-errors        list every error and warning, not only the first 80 and 40
//
// Errors (exit 1):
//   - every equation in the story, prompts, hints, number rows (label + answer) and right
//     options holds (wrong options may hold wrong equations: they are wrong on purpose);
//   - a story with a tag step marks every number it has, and has at least one known,
//     one sought and one extra phrase (a painted one needs no extra); paint targets
//     are their marks, as words; in a calc step every relation holds by its numbers
//     and the answer can be reached from what the story gives, and every × has one factor
//     with the product's unit and the other (how many times) at most 10;
//   - options are distinct, indexes in range, order items distinct, answers whole numbers
//     within the grade's range;
//   - no leftover template text, doubled spaces, spaces before punctuation, unbalanced marks;
//   - no id or story twice;
//   - every story reads right (story-check.ts, every pool, generated and curated): a clitic or
//     «Αναρωτιέται» points at one person named before it (relatives and friends are people), no
//     two sentences in a row open with the same person or repeat «<noun> του <someone>», nothing
//     changes after «Τώρα» unless told «Νωρίτερα», a question with a singular verb and no subject
//     of its own names whom it means once two people are subjects, a gift counts on both sides,
//     world checks have 3 options, every price names its item in its sentence and fits the
//     item's range (per piece), notes and coins are real and «πληρώνει με» is real notes;
//   - no choice gives its answer away by length (lib.ts, lengthTell): no option stands out at either
//     end (the longest at most 30 % or 5 code points longer than the next, the shortest at most 30 %
//     or 5 shorter), and among options that are all numbers the right one is never the only one with
//     the most digits;
//   - the place rule (#50 part 5c): in a family (the world pool is one, a curated pool is one), the
//     right option of one prompt (lib.ts, promptKey: numbers and names aside, synonyms as one) with
//     the same number of options is not at one place by length (lib.ts, places: within 2 code points
//     counts as tied) more often than a fair die would allow (placeLimit: over it in less than 1
//     prompt in 100), from 6 choices on; from 3 to 5 a warning. A prompt (from 6 choices) under that
//     but over its share and one in 8 more is a warning: mostly a prompt whose wordings can't spread
//     the right option evenly without new content (gen.ts --places says which and how far they
//     get), sometimes only the seeds of the few problems that ask it. The
//     curated pools keep the rules per choice and per prompt they had before it: the right one is
//     never the only longest, nor the only shortest in more than half a prompt's choices from 3 on
//     (onlyShortest);
//   - no wrong option shows an answer still to come: a number from 10 up that a later numbers row
//     asks for, that the story doesn't give and the right option doesn't show («30 − 21» above
//     «9 + 3 + 9 = 21»; smaller numbers meet by chance, «4 παιδικά» beside a price of 4 €);
//   - every step has a hint of its own;
//   - a check step's numbers don't ask for a number its prompt already states («βγαίνουν όλα
//     μαζί 390;» with a row whose answer is 390);
//   - no number is compared with itself («Γιατί το 3 είναι μεγαλύτερο από το 3»);
//   - «÷» nowhere in any pool (the books write «:»);
//   - a generated family (not the world pool) never repeats a problem's known numbers (its
//     [..|known] marks): the same calculation in another story;
//   - check-gender's words in a hint or an option where the pools had none (gender-baseline.json:
//     family, place and word as they were before #50 part 5a; the ones already there are listed as
//     a warning).
// Warnings: the place rule's prompts with 3–5 choices and those its wordings can't spread evenly, a family with little variety (few distinct story skeletons), a story without
// a question, very long stories, check-gender's words already in the pools (one line per
// family and place), prompts, hints and row labels that show an answer still to work out (lib.ts,
// hintShows; one line per family, kind and place: many written hints work the row out, «12 × 2 = 24.»).
//
//   node tools/problem-gen/audit.ts --gender-baseline   write gender-baseline.json from the pools as they are
//
// The generated plain maths items (maths/gen-maths.ts) are audited by maths/check.ts, here too:
// each is re-solved from its own text (see the top of that file for what it checks). The plain
// language items (language/gen-language.ts) by language/check.ts: each key derived again from
// the lexicon and its skill's rule. --all-language puts every language item in the sample.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Exercise, ProblemExercise } from '../../shared/types.ts';
import { genderedWords } from '../../frontend/scripts/gendered.mjs';
import {
  hintShows, lengthTell, NAMES, onlyShortest, PLACE_MIN_CHOICES, PLACE_WARN_CHOICES, placeLimit, places, promptKey, rng,
  SHORTEST_MIN_CHOICES, SHORTEST_SHARE, shownText
} from './lib.ts';
import { auditMaths, mathsSample } from './maths/check.ts';
import { auditLanguage, languageSample } from './language/check.ts';
import { checkStory } from './story-check.ts';

// --dir DIR audits another folder (e.g. gen.ts --out DIR while trying out families)
const dirAt = process.argv.indexOf('--dir');
const POOLS = dirAt > 0 ? process.argv[dirAt + 1] : path.join(import.meta.dirname, '../../backend/exercise-pools');
const MAX_ANSWER: Record<number, number> = { 3: 10_000, 5: 100_000_000 };

type Pool = { file: string; grades: number[]; exercises: Exercise[] };
const pools: Pool[] = readdirSync(POOLS).filter(f => f.endsWith('.json')).sort()
  .map(file => ({ file, ...JSON.parse(readFileSync(path.join(POOLS, file), 'utf-8')) }));

const errors: string[] = [];
const warnings: string[] = [];
const err = (ex: ProblemExercise, msg: string) => errors.push(`${ex.id}: ${msg}`);

// The books write «:» for division, never «÷», in every pool and every type of exercise
for (const pool of pools) for (const ex of pool.exercises) {
  if (JSON.stringify(ex).includes('÷')) errors.push(`${ex.id}: «÷» (${pool.file}): the books write «56 : 8»`);
}

const MARK = /\[([^\]|]+)\|(known|sought|extra)\]/g;
const plain = (story: string) => story.replace(MARK, '$1');

// "76 − 35 = 41", "8 × 19 + 4 = 156", "(146 : 2) − 35 = 38"; numbers as written (1.229)
const NUM = String.raw`\d{1,3}(?:\.\d{3})+|\d+`;
const TERM = String.raw`\(?\s*(?:${NUM})\s*\)?`;
// Operators have a space on each side, as the books write them: a colon right after a word
// or number ("έχει 4: 328 : 4 = 82") is punctuation, not division. An equation starts at its first
// number: never inside one, nor after an operator, where a row names the term before it
// («όσοι ήταν − 166 + 152 =» is not «166 + 152 =»).
const EQUATION = new RegExp(String.raw`(?<![\d.]|\s[+−×:]\s*)(${TERM}(?:\s+[+−×:]\s+${TERM})+)\s*=\s*(${NUM})(?![\d.]*\d)`, 'g');

const toNumber = (s: string) => Number(s.replace(/\./g, ''));
function evaluate(expr: string): number {
  const js = expr.replace(/\d{1,3}(?:\.\d{3})+|\d+/g, m => String(toNumber(m)))
    .replace(/−/g, '-').replace(/×/g, '*').replace(/:/g, '/');
  if (!/^[\d\s+\-*/().]+$/.test(js)) throw new Error(`not arithmetic: ${expr}`);
  return Function(`"use strict"; return (${js});`)() as number;
}

function checkEquations(ex: ProblemExercise, where: string, text: string) {
  for (const m of text.matchAll(EQUATION)) {
    const got = evaluate(m[1]);
    const said = toNumber(m[2]);
    if (Math.abs(got - said) > 1e-9) err(ex, `${where}: «${m[0].trim()}» is false (${m[1].trim()} = ${got})`);
  }
}

function hygiene(ex: ProblemExercise, where: string, text: string) {
  if (/undefined|NaN|null|\[object|\$\{|\bInfinity\b/.test(text)) err(ex, `${where}: template leftovers in «${text}»`);
  if (/ {2}/.test(text)) err(ex, `${where}: doubled space in «${text}»`);
  if (/ [,.;·!]/.test(text)) err(ex, `${where}: space before punctuation in «${text}»`);
  if (/[,;]\S/.test(text.replace(MARK, '$1').replace(/\d[.,]\d/g, '').replace(/ό,τι/gi, 'ότι'))) err(ex, `${where}: no space after punctuation in «${text}»`);
}

const stories = new Map<string, string>();
const ids = new Set<string>();
const knownSets = new Map<string, string>();
// «το 3 είναι μεγαλύτερο από το 3», «το υπόλοιπο 5 είναι μικρότερο από τον διαιρέτη 5»
const SELF_COMPARE = new RegExp(String.raw`(${NUM})(\s+\S+){0,3}?\s+(?:μεγαλύτερ|μικρότερ|ίσ)\S*\s+(?:από|με)\s+(?:\S+\s+){0,3}?(${NUM})(?![\d.]*\d)`, 'g');
// check-gender's words as the pools had them: family, place (hint, option, story…) and word
const BASELINE_FILE = path.join(import.meta.dirname, 'gender-baseline.json');
const genderBaseline = new Set<string>(existsSync(BASELINE_FILE) ? JSON.parse(readFileSync(BASELINE_FILE, 'utf-8')) : []);
const genderHits: string[] = [];
const gendered = new Map<string, string[]>();
const families = new Map<string, { grade: number; skeletons: Set<string>; n: number; steps: number }>();
// Per curated pool and prompt (numbers and names aside): choices, and how many have the right option the only shortest
const shortest = new Map<string, { n: number; only: number; example: string }>();
// Per family, prompt key and number of options: the choices, and how often each place by length wins
const placeTally = new Map<string, { N: number; P: number[]; example: string }>();
// Per pool and number of options, the same
const poolPlaces = new Map<string, { N: number; P: number[] }>();
// Per family, kind and place (prompt, hint, row): what shows an answer still to work out (lib.ts, hintShows)
const laterAnswers = new Map<string, { n: number; example: string }>();
const kinds = new Map<string, number>();

// A story with numbers and names blanked out: how many really different stories a family has.
const skeleton = (story: string) => plain(story).replace(NAMES, '@').replace(/\d[\d.]*/g, '#');

for (const pool of pools) {
  for (const ex of pool.exercises) {
    if (ex.type !== 'problem') continue;
    const grade = pool.grades[0];
    if (ids.has(ex.id)) err(ex, 'duplicate id');
    ids.add(ex.id);
    if (stories.has(ex.story)) err(ex, `same story as ${stories.get(ex.story)}`);
    stories.set(ex.story, ex.id);

    const marks = [...ex.story.matchAll(MARK)];
    const open = (ex.story.match(/\[/g) ?? []).length, close = (ex.story.match(/\]/g) ?? []).length;
    if (open !== marks.length || close !== marks.length) err(ex, 'unbalanced or malformed [..|..] marks');
    hygiene(ex, 'story', plain(ex.story));
    checkEquations(ex, 'story', plain(ex.story));
    // A question mark, or asked as the books also do: «Να βρεις…», «Θέλουμε να βρούμε…»
    const asks = /[;;]/.test(plain(ex.story)) || /Να βρεις|Θέλουμε να βρούμε|αναρωτιέται/i.test(plain(ex.story));
    if (!asks && !ex.steps.some(s => s.story)) warnings.push(`${ex.id}: the story asks no question`);
    if (plain(ex.story).length > 420) warnings.push(`${ex.id}: long story (${plain(ex.story).length} characters)`);
    if (!/^[Α-ΩΆΈΉΊΌΎΏ\d«]/.test(plain(ex.story))) err(ex, 'story does not start with a capital letter');
    if (!/[.;!;»]$/.test(plain(ex.story))) err(ex, 'story does not end with punctuation');

    // Stories that read right, in every pool (#50 part 5b): a story that fails is a family bug
    for (const m of checkStory(ex)) err(ex, m);

    // A tag step always has something to leave out; a painted story may have nothing
    // unneeded (so she can't count on there being something)
    const hasTag = ex.steps.some(s => s.kind === 'tag');
    const paint = ex.steps.find(s => s.kind === 'paint');
    if (hasTag || paint) {
      const roles = marks.map(m => m[2]);
      for (const role of hasTag ? ['known', 'sought', 'extra'] : ['known', 'sought']) {
        if (!roles.includes(role)) err(ex, `${hasTag ? 'tag' : 'paint'} step, but no [..|${role}] phrase`);
      }
      const unmarked = ex.story.replace(MARK, '').match(/\d+/g);
      if (unmarked) err(ex, `numbers outside the marked phrases: ${unmarked.join(', ')}`);
    }

    // Painting: each target is its mark, as words of the plain story, core inside the span
    if (paint) {
      const words = plain(ex.story).split(/\s+/).filter(Boolean);
      if (paint.targets.length !== marks.length) err(ex, `paint: ${paint.targets.length} targets for ${marks.length} marks`);
      paint.targets.forEach((t, j) => {
        const m = marks[j];
        if (!m) return;
        if (t.role !== m[2]) err(ex, `paint target ${j}: ${t.role}, mark ${m[2]}`);
        const span = words.slice(t.span[0], t.span[1] + 1).join(' ').replace(/[.,;;]+$/, '');
        if (span !== m[1].replace(/[.,;;]+$/, '')) err(ex, `paint target ${j}: «${span}» is not the mark «${m[1]}»`);
        if (!t.words.length || t.words.some(w => w < t.span[0] || w > t.span[1])) err(ex, `paint target ${j}: core words outside «${m[1]}»`);
      });
    }

    // Family ids are unique within a grade (Γ΄ and Ε΄ both have a missing-info); the world pool is one family
    const params = ex.generatorParams as { family?: string; world?: string } | undefined;
    const curated = !params?.family && !params?.world;
    const fam = `${grade}:${params?.family ?? (params?.world ? 'world' : `(curated ${pool.file})`)}`;

    // An answer still to come, shown before it is asked: a later row's answer the story doesn't give
    const given = new Set((plain(ex.story).match(new RegExp(NUM, 'g')) ?? []).map(toNumber));
    const answerAt = new Map<number, number>();
    ex.steps.forEach((st, j) => { if (st.kind === 'numbers') for (const row of st.rows) if (!given.has(row.answer) && !answerAt.has(row.answer)) answerAt.set(row.answer, j); });
    const shows = (i: number, text: string, own: boolean) => (text.match(new RegExp(`(?<![\\d.])(?:${NUM})(?![\\d.]*\\d)`, 'g')) ?? [])
      .map(toNumber).filter(x => x >= 10 && answerAt.has(x) && (answerAt.get(x)! > i || (own && answerAt.get(x) === i)));

    ex.steps.forEach((step, i) => {
      const at = `step ${i} (${step.kind})`;
      // Working it out: every relation holds by its numbers, and the answer can be reached
      if (step.kind === 'calc') {
        const q = new Map(step.quantities.map(x => [x.id, x.value]));
        const ops: Record<string, (a: number, b: number) => number> = { '+': (a, b) => a + b, '−': (a, b) => a - b, '×': (a, b) => a * b, ':': (a, b) => a / b };
        for (const r of step.relations) {
          if (![r.out, r.a, r.b].every(id => q.has(id))) { err(ex, `${at}: relation ${r.out} = ${r.a} ${r.op} ${r.b} names a missing quantity`); continue; }
          if (ops[r.op](q.get(r.a)!, q.get(r.b)!) !== q.get(r.out)) err(ex, `${at}: ${r.out} = ${r.a} ${r.op} ${r.b} is false (${q.get(r.a)} ${r.op} ${q.get(r.b)} ≠ ${q.get(r.out)})`);
        }
        for (const x of step.quantities) if (!Number.isInteger(x.value) || x.value <= 0) err(ex, `${at}: ${x.id} = ${x.value}`);
        // A × is read back done as a run too (readLines: the same quantity added again and again): one
        // factor has the product's unit (the each, the stock) and the other, how many times, is at most 10
        const byId = new Map(step.quantities.map(x => [x.id, x]));
        for (const r of step.relations.filter(r => r.op === '×' && [r.out, r.a, r.b].every(id => byId.has(id)))) {
          const [P, a, b] = [r.out, r.a, r.b].map(id => byId.get(id)!);
          const same = [a, b].filter(f => f.unit !== undefined && f.unit === P.unit);
          if (same.length !== 1) err(ex, `${at}: ${r.out} = ${r.a} × ${r.b}: ${same.length} factors have the product's unit «${P.unit}», not one`);
          else if ((same[0] === a ? b : a).value > 10) err(ex, `${at}: ${r.out} = ${r.a} × ${r.b}: ${(same[0] === a ? b : a).value} times is more than 10`);
        }
        const known = new Set(step.given);
        for (let grew = true; grew;) {
          grew = false;
          for (const r of step.relations) {
            const missing = [r.out, r.a, r.b].filter(id => !known.has(id));
            if (missing.length === 1) { known.add(missing[0]); grew = true; }
          }
        }
        if (!known.has(step.sought)) err(ex, `${at}: the answer can't be reached from what the story gives`);
        if (step.given.includes(step.sought)) err(ex, `${at}: the answer is given`);
        step.quantities.forEach(x => hygiene(ex, `${at} label`, x.label));
      }
      // A wrong option with a number she works out later (and the story doesn't give) shows it
      // to her, beside the operation that makes it («30 − 21» above «9 + 3 + 9 = 21»)
      // (unless the right option shows it too: a plan that names the sum it then asks for)
      if (step.kind === 'choice') step.options.forEach((o, j) => {
        const right = shows(i, step.options[step.correctIndex] ?? '', false);
        if (j !== step.correctIndex) for (const x of shows(i, o, false)) if (!right.includes(x)) err(ex, `${at} wrong option «${o}» shows ${x}, the answer of step ${answerAt.get(x)}`);
      });
      kinds.set(step.kind, (kinds.get(step.kind) ?? 0) + 1);
      if (!step.hint?.trim()) err(ex, `${at}: no hint (a wrong try would say only «Διάβασε ξανά την ιστορία»)`);
      hygiene(ex, `${at} prompt`, step.prompt);
      checkEquations(ex, `${at} prompt`, step.prompt);
      if (step.hint) { hygiene(ex, `${at} hint`, step.hint); checkEquations(ex, `${at} hint`, step.hint); }
      if (step.story) { hygiene(ex, `${at} story`, step.story); checkEquations(ex, `${at} story`, step.story); }
      if (step.kind === 'choice') {
        const opts = step.options.map(o => o.trim());
        if (new Set(opts).size !== opts.length) err(ex, `${at}: repeated options ${JSON.stringify(opts)}`);
        if (step.correctIndex < 0 || step.correctIndex >= opts.length) err(ex, `${at}: correctIndex out of range`);
        else checkEquations(ex, `${at} right option`, opts[step.correctIndex]);
        opts.forEach(o => hygiene(ex, `${at} option`, o));
        if (opts.length < 2 || opts.length > 5) err(ex, `${at}: ${opts.length} options`);
        const inRange = step.correctIndex >= 0 && step.correctIndex < opts.length;
        const tell = inRange ? lengthTell(opts, step.correctIndex, { onlyLongest: curated }) : null;
        if (tell) err(ex, `${at}: gives its answer away by length: ${tell}`);
        if (inRange) {
          const key = `${fam} «${promptKey(step.prompt)}»`;
          if (curated) {
            const t = shortest.get(key) ?? { n: 0, only: 0, example: ex.id };
            t.n++;
            if (onlyShortest(opts, step.correctIndex)) t.only++;
            shortest.set(key, t);
          }
          const P = places(opts, step.correctIndex);
          for (const [map, k, example] of [[placeTally, `${key} n=${opts.length}`, `${ex.id} step ${i}`], [poolPlaces, `${pool.file.replace(/\.json$/, '')} n=${opts.length}`, '']] as const) {
            const t = (map as Map<string, { N: number; P: number[]; example?: string }>).get(k) ?? { N: 0, P: P.map(() => 0), example };
            t.N++;
            P.forEach((p, j) => (t.P[j] += p));
            (map as Map<string, { N: number; P: number[]; example?: string }>).set(k, t);
          }
        }
      }
      if (step.kind === 'numbers') {
        // A check that states the number it asks for: she types it back
        if (step.phase === 'check') {
          const said = new Set((step.prompt.match(new RegExp(NUM, 'g')) ?? []).map(toNumber));
          step.rows.forEach((row, j) => { if (said.has(row.answer)) err(ex, `${at} row ${j}: the prompt «${step.prompt}» states its answer ${row.answer}`); });
        }
        step.rows.forEach((row, j) => {
          if (!Number.isInteger(row.answer) || row.answer < 0) err(ex, `${at} row ${j}: answer ${row.answer} is not a whole number`);
          if (row.answer > MAX_ANSWER[grade]) err(ex, `${at} row ${j}: answer ${row.answer} beyond the grade's range`);
          if (String(row.answer).length > 6) err(ex, `${at} row ${j}: ${row.answer} does not fit the keypad (6 digits)`);
          hygiene(ex, `${at} row ${j}`, row.label);
          checkEquations(ex, `${at} row ${j}`, /=\s*$/.test(row.label) ? `${row.label} ${row.answer}` : row.label);
        });
      }
      if (step.kind === 'order') {
        if (new Set(step.items).size !== step.items.length) err(ex, `${at}: repeated items`);
        step.items.forEach(o => hygiene(ex, `${at} item`, o));
      }
    });

    // A prompt, a hint or a row label that shows an answer still to work out (lib.ts, hintShows): listed per
    // family, kind and place, for now
    const placesShown = new Set<string>();
    for (const s of hintShows(ex)) {
      if (placesShown.has(`${s.step} ${s.where}`)) continue;
      placesShown.add(`${s.step} ${s.where}`);
      const k = `${fam} ${ex.steps[s.step].kind} ${s.where.replace(/ \d+$/, '')}`;
      const l = laterAnswers.get(k) ?? { n: 0, example: `${ex.id} ${shownText(s)}` };
      l.n++;
      laterAnswers.set(k, l);
    }

    // Everything she reads, by where it is
    const read: [string, string][] = [['title', ex.title], ['story', plain(ex.story)], ...ex.steps.flatMap((st, i): [string, string][] => [
      ['prompt', st.prompt], ...(st.hint ? [['hint', st.hint] as [string, string]] : []), ...(st.story ? [['story', st.story] as [string, string]] : []),
      ...(st.kind === 'choice' ? st.options.map(o => ['option', o] as [string, string]) : []),
      ...(st.kind === 'order' ? st.items.map(o => ['item', o] as [string, string]) : []),
      ...(st.kind === 'numbers' ? st.rows.map(r => ['row', r.label] as [string, string]) : []),
    ].map(([w, t]): [string, string] => [`step ${i} ${w}`, t]))];
    for (const [where, text] of read) {
      // «το 3 είναι μεγαλύτερο από το 3»: a comparison of a number with itself is never what a step means
      for (const m of text.matchAll(SELF_COMPARE)) if (m[1] === m[3]) err(ex, `${where}: «${m[0]}» compares ${m[1]} with itself`);
      // check-gender's words: a hint or an option the pools didn't have is an error, the rest a warning
      const words = genderedWords(text);
      if (!words.length) continue;
      // Keyed by family, place and word: a regenerated story is the same template in other words
      const place = where.replace(/^step \d+ /, '');
      const fresh = words.filter(w => !genderBaseline.has(`${fam}|${place}|${w}`));
      for (const w of words) genderHits.push(`${fam}|${place}|${w}`);
      if ((place === 'hint' || place === 'option') && fresh.length) err(ex, `${where}: «${text}» says «${fresh.join('», «')}»: say it the same way to every child`);
      else gendered.set(`${fam} ${place}`, [...(gendered.get(`${fam} ${place}`) ?? []), ...words]);
    }
    // The same known numbers twice in a generated family: the same calculation in another story
    const params2 = ex.generatorParams as { family?: string } | undefined;
    if (params2?.family) {
      const nums = [...ex.story.matchAll(/\[([^\]|]+)\|known\]/g)].flatMap(m => m[1].match(new RegExp(NUM, 'g')) ?? []).map(x => x.replace(/\./g, '')).sort().join(',');
      const seen = knownSets.get(`${fam}:${nums}`);
      if (nums && seen) err(ex, `the same known numbers (${nums}) as ${seen}`);
      else if (nums) knownSets.set(`${fam}:${nums}`, ex.id);
    }
    const f = families.get(fam) ?? { grade, skeletons: new Set<string>(), n: 0, steps: 0 };
    f.n++;
    f.steps += ex.steps.length;
    f.skeletons.add(skeleton(ex.story));
    families.set(fam, f);
  }
}

// A curated prompt whose right option is mostly the only shortest: tapping the shortest wins it
for (const [key, t] of shortest) {
  if (t.n >= SHORTEST_MIN_CHOICES && t.only > SHORTEST_SHARE * t.n) {
    errors.push(`family ${key.slice(2)}: the right option is the only shortest in ${t.only} of ${t.n} choices (e.g. ${t.example})`);
  }
}

// The place rule: a prompt whose right option sits at one place by length more than a fair die would
// put it there. Tapping «the k-th by length» wins P[k] of its choices.
const PLACE_NAMES = (n: number) => (n === 2 ? ['shorter', 'longer'] : n === 3 ? ['shortest', 'middle', 'longest'] : ['shortest', ...Array.from({ length: n - 2 }, (_, k) => `${k + 2}nd shortest`.replace('3nd', '3rd').replace('4nd', '4th')), 'longest']);
for (const [key, t] of placeTally) {
  if (t.N < PLACE_WARN_CHOICES) continue;
  const n = t.P.length, top = Math.max(...t.P), k = t.P.indexOf(top), limit = placeLimit(t.N, n);
  // As even as a prompt asked by every problem gets (lib.ts, placeSeed): its share, and one in 8 more
  const even = Math.ceil(t.N / n) + Math.floor(t.N / 8);
  const msg = `family ${key.slice(2)}: the ${PLACE_NAMES(n)[k]} by length is right in ${+top.toFixed(1)} of ${t.N} choices`;
  if (top > limit + 1e-9) (t.N >= PLACE_MIN_CHOICES ? errors : warnings).push(`${msg} (a fair die: at most ${limit}; e.g. ${t.example})`);
  else if (t.N >= PLACE_MIN_CHOICES && top > even + 1e-9) warnings.push(`${msg}, over its share and one in 8 (${even}): gen.ts --places tells whether its wordings can spread it (e.g. ${t.example})`);
}

for (const [key, f] of families) {
  const id = key.slice(2);
  if (!id.startsWith('(') && f.skeletons.size < Math.min(Math.max(5, Math.ceil(f.n / 3)), f.n)) warnings.push(`family ${id}: only ${f.skeletons.size} different story shapes in ${f.n} problems`);
}

for (const [key, l] of laterAnswers) warnings.push(`${key.slice(2)}: ${l.n} show an answer still to work out (e.g. ${l.example})`);
for (const [where, words] of gendered) warnings.push(`${where}: check-gender's words already in the pools: ${[...new Set(words)].join(', ')} (${words.length})`);
if (process.argv.includes('--gender-baseline')) {
  writeFileSync(BASELINE_FILE, JSON.stringify([...new Set(genderHits)].sort(), null, 1) + '\n');
  console.log(`wrote ${new Set(genderHits).size} entries to ${path.relative(process.cwd(), BASELINE_FILE)}`);
}

// Report
for (const grade of [3, 5]) {
  const fs = [...families].filter(([, f]) => f.grade === grade);
  const total = fs.reduce((n, [, f]) => n + f.n, 0);
  console.log(`\nGrade ${grade}: ${total} problems in ${fs.length} families`);
  for (const [key, f] of fs) {
    const id = key.slice(2);
    console.log(`  ${id.padEnd(40)} ${String(f.n).padStart(3)} problems, ${String(f.skeletons.size).padStart(3)} story shapes, ${(f.steps / f.n).toFixed(1)} steps`);
  }
}
console.log(`\nSteps by kind: ${[...kinds].map(([k, n]) => `${k} ${n}`).join(', ')}`);
// Where the right option sits by length, per pool: what tapping «the k-th by length» wins
console.log('\nThe right option by length (within 2 code points tied), per pool: shortest … longest, and at random');
for (const [k, t] of [...poolPlaces].filter(([, t]) => t.N >= 10).sort(([a], [b]) => a.localeCompare(b))) {
  console.log(`  ${k.padEnd(28)} ${String(t.N).padStart(4)} choices  ${t.P.map(p => `${(100 * p / t.N).toFixed(1)}%`.padStart(6)).join(' ')}   (${(100 / t.P.length).toFixed(1)}% each)`);
}

// The plain maths items, re-solved from their text; the language items, keys derived again from the lexicon
const maths = auditMaths(pools);
const language = auditLanguage(pools);
for (const a of [maths, language]) {
  errors.push(...a.errors);
  warnings.push(...a.warnings);
  for (const line of a.report) console.log(line);
}
// A generated plain item belongs to one of the two audits
for (const pool of pools) {
  for (const ex of pool.exercises) {
    if (ex.type !== 'problem' && typeof ex.generatorParams?.skill === 'string' && !['Μαθηματικά', 'Γλώσσα'].includes(ex.category)) {
      errors.push(`${ex.id}: a generated plain item in category «${ex.category}»: neither audit reads it`);
    }
  }
}
console.log(`\n${errors.length} errors, ${warnings.length} warnings`);
const shown = process.argv.includes('--all-errors') ? errors.length : 80;
for (const e of errors.slice(0, shown)) console.log(`  ✘ ${e}`);
if (errors.length > shown) console.log(`  … and ${errors.length - shown} more (--all-errors lists them all)`);
for (const w of warnings.slice(0, process.argv.includes('--all-errors') ? warnings.length : 40)) console.log(`  ! ${w}`);

// A sample to read, as a kid would see it
const at = process.argv.indexOf('--sample');
if (at > 0) {
  const file = process.argv[at + 1];
  const n = Number(process.argv[at + 2] ?? 30);
  const r = rng(Date.now() & 0xffffffff);
  let md = '# Problems to read\n';
  for (const grade of [3, 5]) {
    const all = pools.filter(p => p.grades.includes(grade)).flatMap(p => p.exercises).filter((e): e is ProblemExercise => e.type === 'problem');
    md += `\n## Grade ${grade} (${n} of ${all.length})\n`;
    for (const ex of r.sample(all, n)) {
      md += `\n### ${ex.title} · ${ex.id}\n\n${ex.story.replace(MARK, (_m, t, role) => role === 'known' ? `**${t}**` : role === 'sought' ? `__?${t}?__` : `~~${t}~~`)}\n\n`;
      ex.steps.forEach((s, i) => {
        md += `${i + 1}. [${s.phase}/${s.kind}] ${s.prompt}${s.story ? ` (story: ${s.story})` : ''}\n`;
        if (s.kind === 'choice') s.options.forEach((o, j) => (md += `   - ${j === s.correctIndex ? '✔' : '✗'} ${o}\n`));
        if (s.kind === 'numbers') s.rows.forEach(row => (md += `   - ${row.label} **${row.answer}** ${row.unit ?? ''}\n`));
        if (s.kind === 'order') s.items.forEach((o, j) => (md += `   ${j + 1}) ${o}\n`));
        if (s.hint) md += `   - 💡 ${s.hint}\n`;
      });
    }
  }
  md += mathsSample(pools, r, n);
  md += languageSample(pools, r, process.argv.includes('--all-language') ? Infinity : n);
  writeFileSync(file, md);
  console.log(`\nwrote a sample to ${file}`);
}

process.exit(errors.length ? 1 : 0);
