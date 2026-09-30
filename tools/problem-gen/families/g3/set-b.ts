// Families written for set b (see tools/problem-gen/README.md). One file per family.
import type { Family } from '../../lib.ts';
import { ages } from './ages.ts';
import { buyAndChange } from './buy-and-change.ts';
import { cheaperOption } from './cheaper-option.ts';
import { coins } from './coins.ts';
import { collectionGoal } from './collection-goal.ts';
import { daysToGoal } from './days-to-goal.ts';
import { estimateFirst } from './estimate-first.ts';
import { exchangeRate } from './exchange-rate.ts';
import { missingInfo } from './missing-info.ts';
import { orderThePlan } from './order-the-plan.ts';
import { pagesPerDay } from './pages-per-day.ts';

export const G3_SET_B: Family[] = [
  pagesPerDay, buyAndChange, ages, coins, estimateFirst, collectionGoal,
  orderThePlan, missingInfo, cheaperOption, daysToGoal, exchangeRate,
];
