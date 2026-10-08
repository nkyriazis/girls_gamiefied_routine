// What each grade's maths book holds, as committed data: the chapters (from the student
// book's table of contents, tools/edu-materials) and the range the generated items keep to.
// The generator names a chapter from here as each item's `source`; the audit checks every
// source against this list, and every number against the range, without reading materials/.
//
// Keyed by grade, so Δ΄ or ΣΤ΄ is one more entry (and its families in grades.ts). The chapters
// themselves live in shared/curriculum.ts (#71), with the week a class likely starts each.

import { CURRICULUM as BOOKS } from '../../../shared/curriculum.ts';

export type Grade = 3 | 5;

export interface Chapter {
  /** As the book numbers it: "4" (Γ΄), "1.7" (Ε΄). */
  ch: string;
  unit: number;
  title: string;
}

export interface Curriculum {
  /** "Γ΄": how the book and the source name the grade. */
  label: string;
  /** The units the class has covered by autumn: an item may come only from these. */
  units: number[];
  /** No number on screen is larger. */
  maxNumber: number;
  /** A product of two factors both above this is past the grade's tables (Γ΄: 2-digit × 1-digit at most). */
  maxTable?: number;
  toc: Chapter[];
}

/** The book's chapters, from shared/curriculum.ts: the one table, which also holds when a class reaches each. */
const toc = (grade: Grade): Chapter[] => BOOKS[grade].maths.chapters.map(c => ({ ch: c.id, unit: c.unit, title: c.title }));

export const CURRICULUM: Record<Grade, Curriculum> = {
  3: {
    label: 'Γ΄',
    units: [1, 2, 3],
    maxNumber: 3_000,
    maxTable: 11,
    toc: toc(3),
  },
  5: {
    label: 'Ε΄',
    units: [1, 2],
    maxNumber: 999_999_999,
    toc: toc(5),
  },
};

/** «Μαθηματικά Γ΄, κεφ. 4: Πολλαπλασιασμός, προπαίδεια (Ι)»: how an item names its chapter. */
export function sourceOf(grade: Grade, ch: string): string {
  const c = CURRICULUM[grade].toc.find(x => x.ch === ch);
  if (!c) throw new Error(`no chapter ${ch} in the ${CURRICULUM[grade].label} book`);
  return `Μαθηματικά ${CURRICULUM[grade].label}, κεφ. ${c.ch}: ${c.title}`;
}

/** The chapter a source names, if it names one of this grade's book exactly as sourceOf writes it. */
export function chapterOf(grade: Grade, source: string): Chapter | undefined {
  return CURRICULUM[grade].toc.find(c => sourceOf(grade, c.ch) === source);
}
