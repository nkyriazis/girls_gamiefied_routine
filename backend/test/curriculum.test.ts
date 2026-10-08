import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CURRICULUM, chaptersAhead, paceAt, positionOf, SUBJECTS } from '../../shared/curriculum';

// The books' chapters and the pace (#71): where a class likely is on a date, and what it has reached.

test('the pace goes by the date, not the month: on 8 October Γ΄ maths is at ch. 8, not 12', () => {
  assert.equal(paceAt(3, 'maths', '2026-10-08'), '8');
  assert.equal(paceAt(3, 'maths', '2026-10-15'), '9');
  assert.equal(paceAt(3, 'maths', '2026-10-31'), '12');
  assert.equal(paceAt(3, 'language', '2026-10-08'), '2.1');
  assert.equal(paceAt(5, 'maths', '2026-10-08'), '1.7');
  assert.equal(paceAt(5, 'language', '2026-10-08'), '2.3');
});

test('the pace runs across the new year, and holds the first chapter before school and the last in summer', () => {
  assert.equal(paceAt(3, 'maths', '2026-12-31'), '25');
  assert.equal(paceAt(3, 'maths', '2027-01-12'), '27');
  assert.equal(paceAt(3, 'maths', '2026-09-01'), '1');
  assert.equal(paceAt(3, 'maths', '2027-07-20'), '59');
  assert.equal(paceAt(3, 'maths', '2027-10-08'), '8', 'month-day only: every year alike');
});

test('a parent\'s place wins while it is one of the book\'s; anything else follows the pace', () => {
  assert.deepEqual(positionOf(3, 'maths', '12', '2026-10-08'), { id: '12', pace: false });
  assert.deepEqual(positionOf(3, 'maths', undefined, '2026-10-08'), { id: '8', pace: true });
  assert.deepEqual(positionOf(3, 'maths', '21', '2026-10-08'), { id: '8', pace: true }, 'the book has no ch. 21 here');
  assert.deepEqual(positionOf(3, 'language', '5.1', '2026-10-08'), { id: '2.1', pace: true }, 'a pinned lesson is no place');
});

test('reached is everything up to the place in book order, and a holiday lesson once its week has come', () => {
  const ahead = chaptersAhead(3, 'maths', '8', '2026-10-08');
  assert.deepEqual(['1', '7', '8', '9', '10', '12'].map(c => ahead(c)), [0, 0, 0, 1, 2, 4]);
  assert.equal(ahead(undefined), 0, 'an item with no chapter is open');
  assert.equal(ahead('99'), 0);
  const lang = (date: string) => chaptersAhead(3, 'language', '1.3', date);
  assert.equal(lang('2026-10-08')('5.1'), 1);
  assert.equal(lang('2026-10-26')('5.1'), 0, 'reached by its week, though the class is in unit 1');
  assert.equal(lang('2026-10-26')('5.3'), 1);
  assert.equal(lang('2026-10-26')('1.4'), 1);
});

test('every book runs in order: ids unique, starts never going back', () => {
  const inYear = (d: string) => ((Number(d.slice(0, 2)) + 3) % 12) * 100 + Number(d.slice(3));
  for (const grade of [3, 5] as const) for (const subject of SUBJECTS) {
    const list = CURRICULUM[grade][subject].chapters;
    assert.equal(new Set(list.map(c => c.id)).size, list.length);
    const along = list.filter(c => !c.pinned);
    along.forEach((c, i) => i && assert.ok(inYear(c.start) >= inYear(along[i - 1].start), `${grade} ${subject} ${c.id}`));
  }
});
