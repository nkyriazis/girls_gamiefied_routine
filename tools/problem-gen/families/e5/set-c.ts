// Families written for set c (see tools/problem-gen/README.md). One file per family.
import type { Family } from '../../lib.ts';
import { backwardsMoney } from './backwards-money.ts';
import { bigTable } from './big-table.ts';
import { budget } from './budget.ts';
import { coinsNotes } from './coins-notes.ts';
import { growthChain } from './growth-chain.ts';
import { missingInfo } from './missing-info.ts';
import { patternSum } from './pattern-sum.ts';
import { placeValue } from './place-value.ts';
import { roundEstimate } from './round-estimate.ts';
import { roundTable } from './round-table.ts';
import { sumDifference } from './sum-difference.ts';

export const E5_SET_C: Family[] = [
  bigTable, roundEstimate, patternSum, roundTable, coinsNotes, growthChain,
  budget, placeValue, backwardsMoney, sumDifference, missingInfo,
];
