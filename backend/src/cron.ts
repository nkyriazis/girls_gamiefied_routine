import { CronExpressionParser } from 'cron-parser';

// One reading of cron for the whole backend: schedules (routines, flows, alarms) and chores both match
// with cronMatchesAt, in settings.timezone. This is the only file that parses a cron to decide when
// something happens (node-cron only ticks every minute and runs BACKUP_CRON).
//
// The rules are cron-parser's, i.e. standard cron:
// - a field is a list of values, ranges and steps: "1-3,5", "0-30/10", "5/10", "*/15";
// - day of week 0 and 7 are both Sunday;
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
