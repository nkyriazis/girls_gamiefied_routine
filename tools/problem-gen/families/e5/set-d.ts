// Families written for set d (see tools/problem-gen/README.md). One file per family.
import type { Family } from '../../lib.ts';
import { arrangeRows } from './arrange-rows.ts';
import { busesNeeded } from './buses-needed.ts';
import { compareOffers } from './compare-offers.ts';
import { distanceTime } from './distance-time.ts';
import { divisibility } from './divisibility.ts';
import { divisionCheck } from './division-check.ts';
import { groupTickets } from './group-tickets.ts';
import { packRoundUp } from './pack-round-up.ts';
import { production } from './production.ts';
import { togetherAgain } from './together-again.ts';
import { tripCosts } from './trip-costs.ts';

export const E5_SET_D: Family[] = [
  togetherAgain, packRoundUp, busesNeeded, arrangeRows, production, tripCosts,
  divisionCheck, distanceTime, compareOffers, divisibility, groupTickets,
];
