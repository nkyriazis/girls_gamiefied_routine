import type { Exercise } from '@shared/types';
import { exerciseTour } from '../components/AssignmentPlayer.help';
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

export const allTours = (): Tour[] => [
  homeTour(), routineTour(),
  storeTour('u'), activityTour('u'), transferTour('u'),
  choresTour(false), choresTour(true), exercisesTour(),
  ...types.map(t => exerciseTour('u', t)),
  gameSetupTour(), gameTour(undefined), ...types.map(t => gameTour(t)), gameResultsTour(),
  ...(Object.keys(PROBLEM_KINDS) as ProblemHelpKind[]).map(k => problemTour('u', k)),
];
