// The grades with generated maths: each one's range and book (curriculum.ts), its families
// and the pool it writes. Δ΄ or ΣΤ΄ is one more entry here, with its CURRICULUM entry.

import { CURRICULUM, type Curriculum, type Grade } from './curriculum.ts';
import type { MathsFamily } from './lib.ts';
import { G3_MATHS } from './g3.ts';
import { E5_MATHS } from './e5.ts';

export interface MathsGrade extends Curriculum {
  grade: Grade;
  /** Item ids are `<prefix>-math-<family>-NNN`. */
  prefix: string;
  /** The pool file in backend/exercise-pools/. */
  file: string;
  description: string;
  families: MathsFamily[];
}

/** Items per grade: four months of one a day. */
export const MATHS_TARGET = 120;

export const MATHS_GRADES: MathsGrade[] = [
  {
    grade: 3, ...CURRICULUM[3], prefix: 'g3', file: 'g-dimotikou-maths.json', families: G3_MATHS,
    description: 'Γ΄ Δημοτικού: μαθηματικά από τις ενότητες 1–3 του βιβλίου, παραγόμενα από το tools/problem-gen/maths (μία οικογένεια ανά είδος άσκησης του τετραδίου εργασιών, με το κεφάλαιο στο source). Μην τα διορθώνετε εδώ: αλλάξτε την οικογένεια και ξανατρέξτε το gen-maths.ts.',
  },
  {
    grade: 5, ...CURRICULUM[5], prefix: 'e5', file: 'e-dimotikou-maths.json', families: E5_MATHS,
    description: 'Ε΄ Δημοτικού: μαθηματικά από τις ενότητες 1–2 του βιβλίου, παραγόμενα από το tools/problem-gen/maths (μία οικογένεια ανά είδος άσκησης του τετραδίου εργασιών, με το κεφάλαιο στο source). Μην τα διορθώνετε εδώ: αλλάξτε την οικογένεια και ξανατρέξτε το gen-maths.ts.',
  },
];
