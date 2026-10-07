// Building blocks for the plain language items: the existing exercise types, and the rules
// a language item keeps to so it doesn't give its answer away (the generator fails on an item
// that breaks one; check.ts checks the same rules again, written apart).
//
// The items are written by hand, close to the book's own sentences (g3.ts): a family lists
// them with the lesson and page each comes from. The right option is listed first; the
// generator shuffles the options, seeded by the item's id.

import type { Draft } from '../maths/lib.ts';
import type { LanguageGrade } from './curriculum.ts';

export type { Draft };

export interface LanguageItem {
  /** Where it comes from: «2.2 τ23» (unit 2, lesson 2, workbook page 23; «2.0 β43» is the unit's Λεξιλόγιο). */
  at: string;
  draft: Draft;
}

export interface LanguageFamily {
  /** Short, unique within its grade, kebab-case: part of every item id. */
  id: string;
  grade: LanguageGrade;
  /** The rule check.ts derives the key from (its solvers are keyed by skill). */
  skill: string;
  items: LanguageItem[];
}

/** Skills whose options are one word spelt in different ways: their right option must not be the one closest to all the others. */
export const SPELLING_SKILLS = ['spell', 'capital'];

// ---------------------------------------------------------------------------
// The types (right option first; the generator shuffles)

const withBody = (body?: string) => (body ? { body } : {});

export const choose = (title: string, question: string, right: string, wrong: string[], body?: string): Draft =>
  ({ type: 'multiple-choice', title, ...withBody(body), question, options: [right, ...wrong], correctIndex: 0 });

/** Fill-blank with one gap, `{0}` in the text: a whole word, or a punctuation mark right after a word. */
export const gap = (title: string, body: string, textWithGaps: string, right: string, wrong: string[]): Draft =>
  ({ type: 'fill-blank', title, body, textWithGaps, options: [right, ...wrong], correctAnswers: [right] });

export const truth = (title: string, question: string, value: boolean): Draft =>
  ({ type: 'true-false', title, question, correctValue: value });

/** Ordering: `items` in the right order. */
export const order = (title: string, body: string, items: string[]): Draft =>
  ({ type: 'ordering', title, body, items: items.map((content, i) => ({ id: String.fromCharCode(97 + i), content })) });

// ---------------------------------------------------------------------------
// Rules an item keeps to

/** Edit distance between two strings (letters as code points). */
export function distance(a: string, b: string): number {
  const A = [...a], B = [...b];
  let prev = Array.from({ length: B.length + 1 }, (_, j) => j);
  for (let i = 1; i <= A.length; i++) {
    const row = [i];
    for (let j = 1; j <= B.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[B.length];
}

/**
 * What is wrong with an item's options, if anything: fewer than 3 or repeated options, the right
 * one the only longest (the options are shuffled, so its length is the only tell), and for the
 * spelling skills the right one closest to all the others (each wrong spelling one slip from the
 * right one: a vote letter by letter would find it).
 */
export function optionProblems(d: Draft, skill: string): string[] {
  const choice = d.type === 'multiple-choice' ? { options: d.options, right: d.options[d.correctIndex] }
    : d.type === 'fill-blank' ? { options: d.options, right: d.correctAnswers[0] } : undefined;
  if (!choice) return [];
  const { options, right } = choice;
  const out: string[] = [];
  if (options.length < 3) out.push(`${options.length} options: a language item has at least 3`);
  if (new Set(options).size !== options.length) out.push(`repeated options ${JSON.stringify(options)}`);
  if (options.every(o => o === right || [...o].length < [...right].length)) out.push(`the right option «${right}» is the only longest`);
  if (SPELLING_SKILLS.includes(skill)) {
    const total = (o: string) => options.reduce((s, x) => s + distance(o, x), 0);
    const best = Math.min(...options.map(total));
    if (total(right) === best && options.filter(o => total(o) === best).length === 1) {
      out.push(`the right option «${right}» is the one closest to all the others (${options.map(o => `${o} ${total(o)}`).join(', ')})`);
    }
  }
  return out;
}
