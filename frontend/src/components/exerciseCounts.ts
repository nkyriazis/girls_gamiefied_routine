import type { ExerciseAssignment, User } from '@shared/types';

// What the ✏️ badge and the exercises drawer count (#47): a kid's daily set. The problems she
// asks for on top of it («Κι άλλο πρόβλημα») are apart: an open one has its own «▶ Συνέχισε».

type Assignment = Pick<ExerciseAssignment, 'userId' | 'status' | 'extra'>;
export interface DailyCount { total: number; done: number; waiting: number }

export function dailyCount(assignments: Assignment[], userId: string): DailyCount {
  const daily = assignments.filter(a => a.userId === userId && !a.extra);
  const done = daily.filter(a => a.status === 'completed').length;
  return { total: daily.length, done, waiting: daily.length - done };
}

/** The badge: every kid's daily set still to do. */
export const waitingCount = (assignments: Assignment[]) =>
  assignments.filter(a => !a.extra && a.status === 'pending').length;

/** The kids the drawer draws: those with a set today, and those with a grade while extras are allowed. */
export const kidsShown = <U extends Pick<User, 'id' | 'grade'>>(users: U[], assignments: Assignment[], extraLimit: number) =>
  users.filter(u => dailyCount(assignments, u.id).total > 0 || (!!u.grade && extraLimit > 0));

/** The pill next to a kid's name. */
export const pillText = ({ total, done }: DailyCount) =>
  total === 0 ? 'Καμία άσκηση σήμερα' : done === total ? 'Όλα έτοιμα! 🎉' : `${done} / ${total}`;
