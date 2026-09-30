// Families written for set a (see tools/problem-gen/README.md). One file per family.
import type { Family } from '../../lib.ts';
import { busStops } from './bus-stops.ts';
import { compareDifference } from './compare-difference.ts';
import { doubleHalf } from './double-half.ts';
import { equalGroups } from './equal-groups.ts';
import { lengthCm } from './length-cm.ts';
import { numberless } from './numberless.ts';
import { startUnknown } from './start-unknown.ts';
import { tableReading } from './table-reading.ts';
import { totalCost } from './total-cost.ts';
import { twoDigitTimes } from './two-digit-times.ts';
import { twoPurchases } from './two-purchases.ts';

export const G3_SET_A: Family[] = [
  twoPurchases, totalCost, compareDifference, startUnknown, busStops, equalGroups,
  twoDigitTimes, tableReading, lengthCm, numberless, doubleHalf,
];
