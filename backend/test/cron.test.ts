import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cronError, cronMatchesAt, nextCronRun } from '../src/cron';

const ATHENS = 'Europe/Athens';
const at = (iso: string) => new Date(iso);
const matches = (expr: string, iso: string, tz = ATHENS) => cronMatchesAt(expr, at(iso), tz);

test('a field is a list of ranges, values and steps', () => {
  // 2026-10-05 is a Monday; 18:00 in Athens is 15:00Z
  assert.equal(matches('0 18 * * 1-3,5', '2026-10-05T15:00:00Z'), true); // Monday
  assert.equal(matches('0 18 * * 1-3,5', '2026-10-09T15:00:00Z'), true); // Friday
  assert.equal(matches('0 18 * * 1-3,5', '2026-10-08T15:00:00Z'), false); // Thursday
  assert.equal(matches('0-30/10 18 * * *', '2026-10-07T15:20:00Z'), true);
  assert.equal(matches('0-30/10 18 * * *', '2026-10-07T15:40:00Z'), false);
  assert.equal(matches('5/10 18 * * *', '2026-10-07T15:25:00Z'), true);
  assert.equal(matches('*/10 18 * * *', '2026-10-07T15:20:00Z'), true);
});

test('Sunday is 0 and 7; day of month or day of week, either one', () => {
  assert.equal(matches('* * * * 7', '2026-10-11T06:00:00Z'), true); // Sunday
  assert.equal(matches('* * * * 0', '2026-10-11T06:00:00Z'), true);
  assert.equal(matches('* * * * 7', '2026-10-12T06:00:00Z'), false); // Monday
  assert.equal(matches('0 9 1 * 1', '2026-10-05T06:00:00Z'), true); // Monday the 5th
  assert.equal(matches('0 9 1 * 1', '2026-10-01T06:00:00Z'), true); // Thursday the 1st
  assert.equal(matches('0 9 1 * 1', '2026-10-06T06:00:00Z'), false); // Tuesday the 6th
});

test('a step counts from the start of its field: day of month and month start at 1', () => {
  // Master's chore matcher read */n as value % n === 0 (the 7th, 14th...); cron counts from 1 (the 1st, 8th...).
  assert.equal(matches('0 9 */7 * *', '2026-10-08T06:00:00Z'), true); // Thursday the 8th
  assert.equal(matches('0 9 */7 * *', '2026-10-07T06:00:00Z'), false); // Wednesday the 7th
  assert.equal(matches('0 9 */2 * *', '2026-10-07T06:00:00Z'), true); // the 7th: odd days
  assert.equal(matches('0 9 1 */2 *', '2026-11-01T07:00:00Z'), true); // November: odd months
  assert.equal(matches('0 9 1 */2 *', '2026-12-01T07:00:00Z'), false);
  assert.equal(matches('0 9 * * 5-7', '2026-10-11T06:00:00Z'), true); // a range ending in 7 includes Sunday
});

test('any instant inside the minute matches: a late tick still counts', () => {
  assert.equal(matches('0 18 * * *', '2026-10-07T15:00:00.000Z'), true);
  assert.equal(matches('0 18 * * *', '2026-10-07T15:00:01.500Z'), true);
  assert.equal(matches('0 18 * * *', '2026-10-07T15:00:59.999Z'), true);
  assert.equal(matches('0 18 * * *', '2026-10-07T15:01:00.000Z'), false);
});

test('the time is read in the zone given', () => {
  assert.equal(matches('0 18 * * *', '2026-10-07T15:00:00Z', ATHENS), true);
  assert.equal(matches('0 18 * * *', '2026-10-07T15:00:00Z', 'UTC'), false);
  assert.equal(matches('0 18 * * *', '2026-10-07T18:00:00Z', 'UTC'), true);
});

const minutes = (expr: string, fromIso: string, toIso: string) => {
  const hits: string[] = [];
  for (let t = Date.parse(fromIso); t < Date.parse(toIso); t += 60_000) {
    if (cronMatchesAt(expr, new Date(t), ATHENS)) hits.push(new Date(t).toISOString());
  }
  return hits;
};

test('spring forward (Athens, 2027-03-28): the skipped hour never happens, 04:00 does', () => {
  // 03:00 +02:00 becomes 04:00 +03:00 at 01:00Z
  assert.deepEqual(minutes('30 3 * * *', '2027-03-27T22:00:00Z', '2027-03-28T05:00:00Z'), []);
  assert.deepEqual(minutes('0 4 * * *', '2027-03-27T22:00:00Z', '2027-03-28T05:00:00Z'), ['2027-03-28T01:00:00.000Z']);
});

test('fall back (Athens, 2026-10-25): a time in the repeated hour matches twice', () => {
  assert.deepEqual(minutes('30 3 * * *', '2026-10-24T22:00:00Z', '2026-10-25T05:00:00Z'),
    ['2026-10-25T00:30:00.000Z', '2026-10-25T01:30:00.000Z']);
  assert.deepEqual(minutes('0 7 * * *', '2026-10-24T22:00:00Z', '2026-10-25T08:00:00Z'), ['2026-10-25T05:00:00.000Z']);
});

test('an expression that is not a cron throws', () => {
  assert.throws(() => cronMatchesAt('61 * * * *', new Date(), ATHENS));
  assert.throws(() => nextCronRun('0 25 * * *', ATHENS));
});

test('nextCronRun: the next time, strictly after', () => {
  assert.equal(nextCronRun('0 18 * * 1-3,5', ATHENS, at('2026-10-07T15:00:00Z')).toISOString(), '2026-10-09T15:00:00.000Z');
  assert.equal(nextCronRun('0 18 * * *', ATHENS, at('2026-10-07T14:59:30Z')).toISOString(), '2026-10-07T15:00:00.000Z');
});

test('cronError: null for a cron the scheduler reads, its reason for one it can\'t (#89)', () => {
  // All of these pass data.schema.json's pattern (digits, *, -, comma and / in five fields)
  for (const expr of ['61 18 * * *', '0 25 * * *', '5-1 * * * *', '99 20 * * *', '*/0 * * * *', '0 0 31 2 *']) {
    assert.equal(typeof cronError(expr), 'string', expr);
    assert.throws(() => cronMatchesAt(expr, new Date(), ATHENS), expr); // the same reading
  }
  assert.match(cronError('5-1 * * * *')!, /5-1/);
  for (const expr of ['0 7 * * 1-5', '0-30/10 7 * * *', '0 0 * * 7', '*/15 * * * *', '0 9 1 * 1']) {
    assert.equal(cronError(expr), null, expr);
  }
});
