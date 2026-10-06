// The forgiveness ladder (#48): how much mistakes cost a kid, set per kid by a parent
// (ConfigUser.forgiveness). The server pays with these and the screen shows the same
// numbers, so what she sees in the header is what she gets.
//
//   forgiving (the default): as many tries as she likes. The hint after the 1st wrong try,
//     the wrong parts outlined from the 2nd, «Δείξε μου» (the step worked) from the 3rd.
//   unforgiving: two tries per step, then the step is shown worked and the problem moves on.
//
// A problem pays its stars minus one for each step with a counted wrong try (a step costs at
// most one, however many tries): at least 1 on forgiving, at least 0 on unforgiving. A plain
// exercise loses its star at the first wrong try on both rungs; unforgiving closes it after
// one try for true/false and two for the rest.
//
// Type imports only, so the backend (CommonJS) and the frontend (Vite) can both load it.

import type { Exercise, ExerciseAssignment, Forgiveness, ProblemExercise, ProblemReading, ProblemStep, User } from './types';

export const DEFAULT_FORGIVENESS: Forgiveness = 'forgiving';

/**
 * Does a wrong try on this step cost a star? Not yet on the free steps: a painting
 * (the reading step on the painting rungs) and a calculation are read by checkers that
 * are still too strict (#50), so the reading ladder doesn't cost stars. Temporary:
 * revisit with #50.
 */
export function stepCounts(step: ProblemStep, reading: ProblemReading = 'marked'): boolean {
  if (step.kind === 'paint' || step.kind === 'calc') return false;
  if (step.kind === 'tag') return reading === 'marked';
  return true;
}

/** What a problem pays with these wrong tries per step (so far, or in the end). */
export function problemStars(
  exercise: ProblemExercise, mistakes: number[] | undefined, reading: ProblemReading | undefined, rung: Forgiveness | undefined
): number {
  const lost = exercise.steps.filter((step, i) => (mistakes?.[i] ?? 0) > 0 && stepCounts(step, reading)).length;
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
 * what it pays if the rest goes right.
 */
export function paysNow(
  a: Pick<ExerciseAssignment, 'status' | 'attempts' | 'starsAwarded' | 'mistakes'>, exercise: Exercise,
  user?: Pick<User, 'problemReading' | 'forgiveness'>
): number {
  if (a.status === 'completed') return a.starsAwarded ?? exercise.stars;
  return exercise.type === 'problem'
    ? problemStars(exercise, a.mistakes, user?.problemReading, user?.forgiveness)
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

/** What a problem step shows after `tries` wrong tries. A step whose tries don't count plays the forgiving way. */
export function stepHelp(rung: Forgiveness | undefined, counts: boolean, tries: number): StepHelp {
  if ((rung ?? DEFAULT_FORGIVENESS) === 'unforgiving' && counts) {
    const worked = tries >= 2;
    return { hint: tries >= 1, outline: worked, canShow: false, worked };
  }
  return { hint: tries >= 1, outline: tries >= 2, canShow: tries >= 3, worked: false };
}
