// The forgiveness ladder (#48): how much mistakes cost a kid, set per kid by a parent
// (ConfigUser.forgiveness). The server pays with these and the screen shows the same
// numbers, so what she sees in the header is what she gets.
//
//   forgiving (the default): as many tries as she likes. The hint after the 1st wrong try,
//     the wrong parts outlined from the 2nd, «Δείξε μου» (the step worked) from the 3rd.
//   unforgiving: two tries per step, then the step is shown worked and the problem moves on.
//
// A problem pays its stars minus one for each step with a counted wrong try (a step costs at
// most one, however many tries): at least 1 on forgiving, at least 0 on unforgiving. Every
// step's wrong tries count since #50 part 4, a wrong painting and a calc slip too; on a calc
// step only the slips in the arithmetic (wrongTryCounts). A plain exercise loses its star at
// the first wrong try on both rungs; unforgiving closes it after one try for true/false and
// two for the rest.
//
// A retry (#136, ExerciseAssignment.retryOf), an item of the kind she was shown worked, plays by
// unforgiving's rules whatever her rung (rungOf): no «Δείξε μου», two counted tries a step, then it
// is shown worked; a plain one closes after its tries. So she can't tap through it, and never sticks.
//
// Type imports only, so the backend (CommonJS) and the frontend (Vite) can both load it.

import type { Exercise, ExerciseAssignment, Forgiveness, ProblemExercise, ProblemStep, User } from './types';
import type { CalcSlip } from './problems';

export const DEFAULT_FORGIVENESS: Forgiveness = 'forgiving';

/**
 * Does this wrong try cost a star? Every step's does, but on a calc step only a slip in the
 * arithmetic: a wrong result ('math') or the smaller number first ('order'). A right result
 * that means nothing in the story ('nothing') brings hints only, because some right ways read
 * as nothing (a net change: g3-world-010, 072). The server asks it for every wrong try that
 * comes in, a calc slip and a wrong answer alike (answerProblemStep), so a step's recorded
 * mistakes are its counted ones, and the screen's help ladder follows them.
 */
export function wrongTryCounts(step: ProblemStep, slip?: CalcSlip): boolean {
  if (step.kind === 'calc' && slip) return slip !== 'nothing';
  return true;
}

/** The rung an assignment plays on: hers, but unforgiving on a retry (#136). */
export function rungOf(user: Pick<User, 'forgiveness'> | undefined, a: Pick<ExerciseAssignment, 'retryOf'>): Forgiveness {
  return a.retryOf ? 'unforgiving' : user?.forgiveness ?? DEFAULT_FORGIVENESS;
}

/** What a problem pays with these counted wrong tries per step (so far, or in the end). */
export function problemStars(exercise: ProblemExercise, mistakes: number[] | undefined, rung: Forgiveness | undefined): number {
  const lost = exercise.steps.filter((_, i) => (mistakes?.[i] ?? 0) > 0).length;
  const floor = (rung ?? DEFAULT_FORGIVENESS) === 'unforgiving' ? 0 : 1;
  return Math.min(exercise.stars, Math.max(floor, exercise.stars - lost));
}

/** What a plain exercise pays after this many wrong tries: its stars less one each, down to 0 (all are ⭐1 now). */
export const plainStars = (stars: number, wrongTries: number) => Math.max(0, stars - wrongTries);

/** How many tries a plain exercise gets before it closes. */
export function plainTries(rung: Forgiveness | undefined, type: Exercise['type']): number {
  if ((rung ?? DEFAULT_FORGIVENESS) === 'forgiving') return Infinity;
  return type === 'true-false' ? 1 : 2;
}

/**
 * What an assignment pays now, for the header and the cards: what it paid once done, else
 * what it pays if the rest goes right, on the rung it plays on (rungOf).
 */
export function paysNow(
  a: Pick<ExerciseAssignment, 'status' | 'attempts' | 'starsAwarded' | 'mistakes' | 'retryOf'>, exercise: Exercise,
  user?: Pick<User, 'forgiveness'>
): number {
  if (a.status === 'completed') return a.starsAwarded ?? exercise.stars;
  return exercise.type === 'problem'
    ? problemStars(exercise, a.mistakes, rungOf(user, a))
    : plainStars(exercise.stars, a.attempts);
}

export interface StepHelp {
  /** The hint slot speaks */
  hint: boolean;
  /** The wrong parts are outlined */
  outline: boolean;
  /** «Δείξε μου» is offered */
  canShow: boolean;
  /** The step is shown worked, and the problem moves on */
  worked: boolean;
}

/**
 * What a problem step shows after `tries` wrong tries, `counted` of them costing a star (a
 * calc step's slips that mean nothing don't: they bring help, but don't end the step). `kind`
 * is the step as she plays it: on unforgiving, a painting's frames show from the 1st wrong try,
 * so she sees what was wrong before her last one.
 */
export function stepHelp(rung: Forgiveness | undefined, kind: ProblemStep['kind'], tries: number, counted = tries): StepHelp {
  if ((rung ?? DEFAULT_FORGIVENESS) === 'unforgiving') {
    const worked = counted >= 2;
    return { hint: tries >= 1, outline: worked || (kind === 'paint' && tries >= 1), canShow: false, worked };
  }
  return { hint: tries >= 1, outline: tries >= 2, canShow: tries >= 3, worked: false };
}
