// How hard an item is, 1 (easy) to 3 (hard) (#71): the rule's numbers, committed here, and the
// generators' side of it. A kid's ConfigUser.difficulty is the most she gets while there is
// enough (backend/src/exercisePool.ts). audit.ts derives every item's difficulty again from the
// item as written, with its own code and these numbers, and fails on a difference.
//
//   - Plain maths: the largest number she reads or writes (anywhere but the title), against the
//     grade's range: up to SIZE[grade][0] easy, up to SIZE[grade][1] middling, past it hard.
//   - Word problems: points for that number (0, 1, 2) and for the work (0, 1, 2): its steps (3 or
//     fewer, 4, 5 or more), or, with a calc step, the operations on its way to the answer (1, 2,
//     3 or more); the numbers are its story's and the answers she writes. 0–1 points easy, 2
//     middling, 3–4 hard.
//   - Language: by the item's skill (LANGUAGE_LEVEL): recognising (a part of speech, a tense, the
//     alphabet) easy, choosing a form (a person, a word of the family, a punctuation mark) middling,
//     agreement, spelling, moods, sayings and definitions hard.
// npm test (backend dailyMix.test.ts) prints how the shipped items spread over the three.

import type { Draft as ProblemDraft } from './lib.ts';
import type { Draft as PlainDraft } from './maths/lib.ts';
import { pathToAnswer } from '../../shared/problems.ts';

export type Level = 1 | 2 | 3;
export type Grade = 3 | 5;

/** Up to the first easy, up to the second middling, past it hard. */
export const SIZE: Record<Grade, [number, number]> = { 3: [100, 1_000], 5: [1_000, 100_000] };
/** A problem's work: steps up to the first 0 points, up to the second 1, more 2. */
export const STEPS: [number, number] = [3, 4];
/** With a calc step, the operations on the way to the answer: up to the first 0 points, up to the second 1, more 2. */
export const OPERATIONS: [number, number] = [1, 2];
/** A problem's points (size + work) up to the first easy, up to the second middling, more hard. */
export const POINTS: [number, number] = [1, 2];

export const LANGUAGE_LEVEL: Record<string, Level> = {
  pos: 1, gender: 1, alpha: 1, week: 1, capital: 1, opposite: 1, tense: 1, time: 1, compound: 1,
  person: 2, family: 2, synonym: 2, meaning: 2, punct: 2, san: 2, retense: 2, negation: 2, numeral: 2, adverb: 2,
  agree: 3, spell: 3, saying: 3, mood: 3, define: 3,
};

/** 0, 1 or 2: where `n` falls between the two bounds. */
export const points = (n: number, [a, b]: [number, number]) => (n <= a ? 0 : n <= b ? 1 : 2);

/** Every number in a text, «1.229» as 1229. */
const numbersIn = (text: string) => (text.match(/\d{1,3}(?:\.\d{3})+|\d+/g) ?? []).map(x => Number(x.replace(/\./g, '')));

/** A plain maths item, as the family made it. */
export function mathsLevel(grade: Grade, d: PlainDraft): Level {
  const { title: _title, ...shown } = d;
  return (points(Math.max(0, ...numbersIn(JSON.stringify(shown))), SIZE[grade]) + 1) as Level;
}

/** A word problem, as the family or the world made it. */
export function problemLevel(grade: Grade, d: Pick<ProblemDraft, 'story' | 'steps'>): Level {
  const numbers = numbersIn(d.story.replace(/\[([^\]|]+)\|\w+\]/g, '$1'));
  let operations: number | undefined;
  for (const s of d.steps) {
    if (s.kind === 'numbers') numbers.push(...s.rows.map(r => r.answer));
    if (s.kind === 'calc') {
      numbers.push(...s.quantities.map(q => q.value));
      operations = pathToAnswer(s).size;
    }
  }
  const work = operations === undefined ? points(d.steps.length, STEPS) : points(operations, OPERATIONS);
  return (points(points(Math.max(...numbers), SIZE[grade]) + work, POINTS) + 1) as Level;
}

export function languageLevel(skill: string): Level {
  const level = LANGUAGE_LEVEL[skill];
  if (!level) throw new Error(`no difficulty for the language skill «${skill}»: add it to difficulty.ts LANGUAGE_LEVEL`);
  return level;
}
