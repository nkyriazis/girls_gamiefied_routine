// Γ΄ Δημοτικού problem families. Add a family here (or to a set) to include it in the pool.
import type { Family } from '../../lib.ts';
import { change } from './change.ts';
import { remainder } from './remainder.ts';
import { G3_SET_A } from './set-a.ts';
import { G3_SET_B } from './set-b.ts';
import { share } from './share.ts';

export const G3_FAMILIES: Family[] = [change, share, remainder, ...G3_SET_A, ...G3_SET_B];
