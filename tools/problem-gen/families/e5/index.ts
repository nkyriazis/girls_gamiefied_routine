// Ε΄ Δημοτικού problem families. Add a family here (or to a set) to include it in the pool.
import type { Family } from '../../lib.ts';
import { equalize } from './equalize.ts';
import { parts } from './parts.ts';
import { E5_SET_C } from './set-c.ts';
import { E5_SET_D } from './set-d.ts';
import { unitRate } from './unit-rate.ts';

export const E5_FAMILIES: Family[] = [parts, unitRate, equalize, ...E5_SET_C, ...E5_SET_D];
