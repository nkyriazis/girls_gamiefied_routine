// Every widget the owl can point at, by name. A widget carries its name with
// {...help('store.balance')}; a tour step names it in `el`. Both sides are typed, and
// `npm run check-help` checks that every name here is placed on a widget and explained by
// some tour, so renaming a class or dropping a widget can't quietly empty a tour.

export const ANCHORS = [
  // The owl itself
  'help.owl',
  // Home screen
  'home.clock', 'home.kid', 'home.exercises', 'home.chores', 'home.bonus', 'home.game',
  // Routines and alarms on screen
  'routine.timeline', 'routine.task', 'routine.done', 'routine.exit', 'alarm.dismiss',
  // A kid's own screen, and its popups
  'store.balance', 'store.earn', 'store.rewards', 'store.give', 'store.activity', 'store.close',
  'activity.list', 'transfer.to', 'transfer.amount', 'transfer.send',
  // Exercises of the day (her screen and the drawer)
  'exercises.kid', 'exercises.card', 'exercises.more',
  // Chores and bonus activities
  'chores.card', 'chores.claim', 'chores.done', 'chores.waiting', 'chores.empty',
  // One exercise, and the ways to answer one
  'exercise.ask', 'exercise.answer', 'exercise.stars', 'exercise.exit', 'exercise.show',
  'answer.options', 'answer.truefalse', 'answer.match-left', 'answer.match-right', 'answer.order', 'answer.order-submit',
  'answer.blank', 'answer.words', 'answer.number', 'answer.numpad',
  // The group game
  'game.players', 'game.subjects', 'game.length', 'game.start',
  'game.turn', 'game.progress', 'game.question', 'game.answer', 'game.exit', 'game.scores', 'game.finish',
  // A word problem, step by step
  'problem.phases', 'problem.story', 'problem.prompt', 'problem.hint', 'problem.check', 'problem.show',
  'problem.brushes', 'problem.phrase', 'problem.paint', 'problem.brush-extra',
  'problem.choices', 'problem.numbers', 'problem.keypad', 'problem.order',
  'calc.chips', 'calc.pad', 'calc.build', 'calc.lines',
] as const;

export type HelpAnchor = typeof ANCHORS[number];

/** Spread on a widget: <div {...help('store.balance')}> */
export const help = (anchor: HelpAnchor) => ({ 'data-help': anchor });

export const anchorSelector = (anchor: HelpAnchor) => `[data-help="${anchor}"]`;
