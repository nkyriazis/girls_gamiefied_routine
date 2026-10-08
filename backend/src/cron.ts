import { CronExpressionParser } from 'cron-parser';
import type { ConfigWarning, DataConfig } from '../../shared/types';

// One reading of cron for the whole backend: schedules (routines, flows, alarms) and chores both match
// with cronMatchesAt, in settings.timezone. This is the only file that parses a cron to decide when
// something happens (node-cron only ticks every minute and runs BACKUP_CRON). It is also the only
// validator of one (#89): data.schema.json checks a cron's characters only, so «99 20 * * *» passes it;
// cronError reads it the same way the scheduler will. config.ts refuses a save that brings in a cron it
// can't read and loads a file that has one with a warning (unreadableCrons); the form's raw cron field
// asks the server (POST /api/admin/validate-cron).
//
// The rules are cron-parser's, i.e. standard cron:
// - a field is a list of values, ranges and steps: "1-3,5", "0-30/10", "5/10", "*/15";
// - a step counts from the start of its field: "*/7" on day of month is the 1st, 8th, 15th..., "*/2" on
//   month is January, March...;
// - day of week 0 and 7 are both Sunday ("5-7" is Friday to Sunday);
// - when both day of month and day of week are restricted, either one matching is enough ("0 9 1 * 1" is
//   the 1st of the month and every Monday).
// Daylight saving time, in the zone given: a time inside the skipped hour never happens that night
// ("30 3 * * *" in Europe/Athens on the last Sunday of March), the first minute after the gap is an
// ordinary minute ("0 4 * * *" fires at 04:00); a time inside the repeated hour (last Sunday of October)
// matches twice, once in each offset.

/** True when the minute containing `date` is one the cron names, read in `timezone`. Throws on an invalid expression. */
export function cronMatchesAt(expr: string, date: Date, timezone: string): boolean {
  const minute = new Date(Math.floor(date.getTime() / 60_000) * 60_000);
  return CronExpressionParser.parse(expr, { tz: timezone }).includesDate(minute);
}

/** The next time the cron names, strictly after `from`, read in `timezone`. Throws on an invalid expression. */
export function nextCronRun(expr: string, timezone: string, from: Date = new Date()): Date {
  return CronExpressionParser.parse(expr, { tz: timezone, currentDate: from }).next().toDate();
}

/** Why the scheduler can't read `expr` (cron-parser's reason), or null when it can. The zone never changes the answer. */
export function cronError(expr: string): string | null {
  try {
    CronExpressionParser.parse(expr, { tz: 'UTC' });
    return null;
  } catch (err) {
    return (err as Error).message;
  }
}

/** Every schedule's cron and chore's availabilityCron in `data` that the scheduler can't read. */
export function unreadableCrons(data: DataConfig): ConfigWarning[] {
  const crons = [
    ...(data.schedules ?? []).map((s, i) => ({ path: `/schedules/${i}/cron`, kind: 'schedule' as const, id: s.id, cron: s.cron })),
    ...(data.chores ?? []).map((c, i) => ({ path: `/chores/${i}/availabilityCron`, kind: 'chore' as const, id: c.id, cron: c.availabilityCron })),
  ];
  return crons.flatMap(c => {
    const error = cronError(c.cron);
    return error === null ? [] : [{ ...c, error }];
  });
}
