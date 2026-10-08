import type { Exercise, Forgiveness } from '@shared/types';
import { answerTour, exerciseTour } from '../components/AssignmentPlayer.help';
import { choresTour } from '../components/ChoresDrawer.help';
import { homeTour, routineTour } from '../components/Dashboard.help';
import { gameResultsTour, gameTour } from '../components/ExerciseGame.help';
import { exercisesTour } from '../components/ExercisesDrawer.help';
import { gameSetupTour } from '../components/ExerciseSetup.help';
import { activityTour, storeTour, transferTour } from '../components/StoreModal.help';
import { problemTour, type ProblemHelpKind } from '../components/exercises/ProblemPlayer.help';
import type { Tour } from './tour';

// Every tour the owl can play, in every variant: what the voice is recorded from
// (scripts/help-lines.mjs). A new tour, or a new kind of exercise, goes here too.

const EXERCISE_TYPES: Record<Exclude<Exercise['type'], 'problem'>, true> = {
  'multiple-choice': true, 'true-false': true, 'match-pairs': true, ordering: true, 'fill-blank': true, 'number-input': true,
};
const PROBLEM_KINDS: Record<ProblemHelpKind, true> = {
  tag: true, paint: true, 'paint-all': true, calc: true, choice: true, numbers: true, order: true,
};
const types = Object.keys(EXERCISE_TYPES) as Exclude<Exercise['type'], 'problem'>[];
// The forgiveness ladder: the intros say what mistakes cost on each rung
const RUNGS: Forgiveness[] = ['forgiving', 'unforgiving'];
// A revision card on screen or not, a retry (#136) or not, an extra problem left on screen or not: the editions of the store and the drawer
const BOTH = [false, true];
const EDITIONS = BOTH.flatMap(revision => BOTH.flatMap(retry => BOTH.map(extra => ({ revision, retry, extra }))));

export const allTours = (): Tour[] => [
  homeTour(), routineTour(),
  ...EDITIONS.map(e => storeTour('u', e.revision, e.extra, e.retry)), activityTour('u'), transferTour('u'),
  choresTour(false), choresTour(true), ...EDITIONS.map(e => exercisesTour(e.revision, e.extra, e.retry)),
  ...types.flatMap(t => RUNGS.map(r => exerciseTour('u', t, r))), ...types.map(t => exerciseTour('u', t, 'forgiving', true)), answerTour('u'),
  gameSetupTour(), gameTour(undefined), ...types.map(t => gameTour(t)), gameResultsTour(),
  ...(Object.keys(PROBLEM_KINDS) as ProblemHelpKind[]).flatMap(k => RUNGS.flatMap(r => [problemTour('u', k, r), problemTour('u', k, r, true)])),
];
