import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cronMatchesAt, nextCronRun } from '../src/cron';

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
