// npm test (frontend): the problem player's answer boxes, where each tap goes (#52)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcFocusAfterCheck, calcInput, numbersInput, type CalcField, type CalcInput, type FieldEdit } from './answerFields.ts';
import type { CalcValue } from './problemFreeLogic.ts';

const line = (x: number | null, op: CalcValue['op'], y: number | null, result = ''): CalcValue =>
  ({ lines: [], slips: 0, x, op, y, result });
const empty = line(null, null, null);
const chip = (n: number): CalcInput => ({ kind: 'chip', n });
const op = (o: NonNullable<CalcValue['op']>): CalcInput => ({ kind: 'op', op: o });
const digit = (d: string): CalcInput => ({ kind: 'digit', d });
const tap = (field: CalcField): CalcInput => ({ kind: 'tap', field });
const ERASE: CalcInput = { kind: 'erase' };
const CLEAR: CalcInput = { kind: 'clear' };

/** Plays inputs from a line and focus; returns where it ends and how many inputs it took */
function play(inputs: CalcInput[], v: CalcValue = empty, focus: CalcField = 'x') {
  const edits: FieldEdit<CalcValue, CalcField>[] = [];
  for (const i of inputs) {
    const e = calcInput(v, focus, i);
    edits.push(e);
    v = e.value;
    focus = e.focus;
  }
  return { v, focus, edits, shown: [v.x, v.op, v.y, v.result] };
}

test('a tap on a box only moves the focus there', () => {
  const v = line(37, '−', null);
  for (const f of ['x', 'op', 'y', 'result'] as const) {
    assert.deepEqual(calcInput(v, 'y', tap(f)), { value: v, focus: f, sound: 'select' });
  }
});

test('a chip fills the focused x or y; with op or result focused, the first empty of x and y', () => {
  assert.deepEqual(play([chip(5)], line(37, '−', 8), 'x').shown, [5, '−', 8, '']);
  assert.deepEqual(play([chip(5)], line(37, '−', 8), 'y').shown, [37, '−', 5, '']);
  assert.deepEqual(play([chip(5)], line(null, '−', null), 'op').shown, [5, '−', null, '']);
  assert.deepEqual(play([chip(5)], line(37, null, null, '12'), 'result').shown, [37, null, 5, '12']);
  assert.equal(calcInput(empty, 'x', chip(5)).sound, 'place');
});

test('a chip with nowhere to go is refused: the focused box wiggles, «nope», nothing changes', () => {
  const v = line(37, '−', 8);
  for (const f of ['op', 'result'] as const) {
    assert.deepEqual(calcInput(v, f, chip(5)), { value: v, focus: f, sound: 'nope', refused: f });
  }
});

test('an operator always goes into op, even before the first number', () => {
  const e = calcInput(empty, 'x', op('+'));
  assert.deepEqual([e.value.op, e.focus, e.sound], ['+', 'x', 'select']);
  assert.equal(calcInput(line(3, '+', 4, '7'), 'result', op('×')).value.op, '×');
});

test('a digit goes into the result when op or result is focused, and the focus moves there', () => {
  let e = calcInput(empty, 'result', digit('1'));
  assert.deepEqual([e.value.result, e.focus, e.sound], ['1', 'result', 'key']);
  e = calcInput(line(18, ':', null), 'op', digit('3'));
  assert.deepEqual([e.value.result, e.focus, e.sound], ['3', 'result', 'key']);
  e = calcInput(line(1, '+', 1, '1234567'), 'result', digit('8'));
  assert.deepEqual([e.value.result, e.sound, e.refused], ['1234567', 'nope', 'result'], 'seven digits at most');
});

test('a digit while x or y is focused is refused there (typed numbers in x and y are #50)', () => {
  for (const f of ['x', 'y'] as const) {
    assert.deepEqual(calcInput(line(2, '+', null), f, digit('4')), { value: line(2, '+', null), focus: f, sound: 'nope', refused: f });
  }
});

test('after a fill the focus goes to the first empty box in order x, op, y, result; when none is empty, the result', () => {
  assert.deepEqual(play([chip(18)]).edits.map(e => e.focus), ['op']);
  assert.equal(play([chip(6)], line(null, ':', null), 'y').focus, 'x', 'the first empty, not the next one');
  assert.equal(play([chip(6)], line(18, ':', 7, '3'), 'y').focus, 'result');
  assert.equal(play([op('+')], line(18, ':', 7, '3'), 'op').focus, 'result');
});

test('⌫ erases in the focused box; on an empty box it steps back and erases there; repeated ⌫ empties the line', () => {
  let r = play([ERASE], line(55, '−', 37, '18'), 'result');
  assert.deepEqual([r.shown, r.focus, r.edits[0].sound], [[55, '−', 37, '1'], 'result', 'erase']);
  r = play([ERASE], line(55, '−', 37, '18'), 'op');
  assert.deepEqual([r.shown, r.focus], [[55, null, 37, '18'], 'op'], 'a filled x, op or y empties at once');
  r = play([ERASE], line(55, '−', null), 'y');
  assert.deepEqual([r.shown, r.focus], [[55, null, null, ''], 'op']);
  r = play([ERASE, ERASE, ERASE, ERASE, ERASE], line(55, '−', 37, '18'), 'result');
  assert.deepEqual([r.shown, r.focus], [[null, null, null, ''], 'x']);
  assert.deepEqual(calcInput(empty, 'x', ERASE), { value: empty, focus: 'x', sound: 'nope', refused: 'x' });
});

test('⌫ never goes past the start of the line: on an empty box with nothing filled before it, «nope»', () => {
  const v = line(null, '−', 55);
  assert.deepEqual(calcInput(v, 'x', ERASE), { value: v, focus: 'x', sound: 'nope', refused: 'x' }, 'the third box stays');
  const w = line(null, null, 55, '7');
  assert.deepEqual(calcInput(w, 'op', ERASE), { value: w, focus: 'op', sound: 'nope', refused: 'op' });
});

test('C empties the focused box only', () => {
  let r = play([CLEAR], line(55, '−', 37, '18'), 'result');
  assert.deepEqual([r.shown, r.focus, r.edits[0].sound], [[55, '−', 37, ''], 'result', 'erase']);
  r = play([CLEAR], line(55, '−', 37, '18'), 'x');
  assert.deepEqual(r.shown, [null, '−', 37, '18']);
  assert.deepEqual(calcInput(line(55, '−', null), 'y', CLEAR), { value: line(55, '−', null), focus: 'y', sound: 'nope', refused: 'y' });
});

test('the slip of the issue: 37, −, then the first box and 55 makes 55 − 37 = 18 in 7 inputs, then Έλεγχος (8 taps; 12 before, 9 for a kid who knew to ⌫ the operation)', () => {
  const r = play([chip(37), op('−'), tap('x'), chip(55), chip(37), digit('1'), digit('8')]);
  assert.deepEqual(r.shown, [55, '−', 37, '18']);
  assert.deepEqual(r.edits.map(e => e.focus), ['op', 'y', 'x', 'y', 'result', 'result', 'result']);
});

test('the old habit after the change: 37, −, ⌫, 55 now gives 37 ○ 55; making it 55 − 37 = 18 takes 11 inputs, then Έλεγχος (12 taps; 9 before)', () => {
  let r = play([chip(37), op('−'), ERASE, chip(55)]);
  assert.deepEqual([r.shown, r.focus], [[37, null, 55, ''], 'op']);
  r = play([tap('x'), chip(55), op('−'), tap('y'), chip(37), digit('1'), digit('8')], r.v, r.focus);
  assert.deepEqual(r.shown, [55, '−', 37, '18']);
  assert.ok(r.edits.every(e => !e.refused));
});

test('the usual path takes one input per item, as before: 18, :, 6, 3', () => {
  const r = play([chip(18), op(':'), chip(6), digit('3')]);
  assert.deepEqual(r.shown, [18, ':', 6, '3']);
  assert.ok(r.edits.every(e => !e.refused));
});

test('the result first: a tap on the result box and 1 writes 1 there', () => {
  assert.deepEqual(play([tap('result'), digit('1')]).shown, [null, null, null, '1']);
});

test('after Έλεγχος: an accepted line starts the next at x; a wrong sum puts the focus on its result', () => {
  const before = { lines: 0, slips: 0 };
  const found = { ...empty, lines: [{ x: 55, op: '−' as const, y: 37, result: 18, label: 'Ευρώ', onPath: true }] };
  assert.equal(calcFocusAfterCheck(before, found, 'result', 'found'), 'x');
  assert.equal(calcFocusAfterCheck(before, { ...line(55, '−', 37, '19'), slips: 1 }, 'result', 'math'), 'result');
  assert.equal(calcFocusAfterCheck(before, line(55, '−', 37, '19'), 'y', undefined), 'y', 'no check, no change');
  assert.equal(calcFocusAfterCheck(before, { ...line(37, '−', 55, '18'), slips: 1 }, 'result', 'order'), 'x', 'the smaller first: she swaps the numbers next (#50)');
});

test('after Έλεγχος of a right sum that means nothing in the story, the focus goes to x and the next chip is taken', () => {
  const before = { lines: 0, slips: 0 };
  const sent = { ...line(37, '+', 55, '92'), slips: 1 };
  const focus = calcFocusAfterCheck(before, sent, 'result', 'nothing');
  assert.equal(focus, 'x');
  const e = calcInput(sent, focus, chip(18));
  assert.deepEqual([e.value.x, e.sound, e.refused], [18, 'place', undefined]);
});

test('every input in every state makes a sound, and «nope» exactly when it is refused', () => {
  const states = [empty, line(37, null, null), line(37, '−', null), line(55, '−', 37), line(55, '−', 37, '18'),
    line(null, '+', null, '4'), line(1, '+', 1, '1234567')];
  const inputs: CalcInput[] = [chip(5), op('×'), digit('0'), ERASE, CLEAR, tap('x'), tap('op'), tap('y'), tap('result')];
  const SOUNDS = new Set(['place', 'select', 'key', 'erase', 'nope']);
  for (const v of states) for (const f of ['x', 'op', 'y', 'result'] as const) for (const i of inputs) {
    const e = calcInput(v, f, i);
    assert.ok(SOUNDS.has(e.sound), `${JSON.stringify(i)} on ${f} of ${JSON.stringify(v)}: ${e.sound}`);
    assert.equal(e.sound === 'nope', e.refused !== undefined);
    if (e.refused) assert.equal(e.value, v, 'a refused input changes nothing');
  }
});

// The numbers step: one box per row; the focus moves on with ↵ or a tap, never by itself

test('numbers: digits type into the selected box, ⌫ erases one, C empties it, ↵ moves on', () => {
  const v = ['8', '', '12'];
  assert.deepEqual(numbersInput(v, 1, { kind: 'key', key: '4' }), { value: ['8', '4', '12'], focus: 1, sound: 'key' });
  assert.deepEqual(numbersInput(v, 2, { kind: 'key', key: '⌫' }), { value: ['8', '', '1'], focus: 2, sound: 'erase' });
  assert.deepEqual(numbersInput(v, 2, { kind: 'key', key: 'C' }), { value: ['8', '', ''], focus: 2, sound: 'erase' });
  assert.deepEqual(numbersInput(v, 2, { kind: 'key', key: '↵' }), { value: v, focus: 0, sound: 'tap' });
  assert.deepEqual(numbersInput(v, 0, { kind: 'tap', box: 2 }), { value: v, focus: 2, sound: 'select' });
});

test('numbers: ⌫ on an empty box stays as it was; C on one, or a 7th digit, is refused', () => {
  assert.deepEqual(numbersInput(['8', ''], 1, { kind: 'key', key: '⌫' }), { value: ['8', ''], focus: 1, sound: 'erase' });
  assert.deepEqual(numbersInput(['8', ''], 1, { kind: 'key', key: 'C' }), { value: ['8', ''], focus: 1, sound: 'nope', refused: 1 });
  assert.deepEqual(numbersInput(['123456'], 0, { kind: 'key', key: '7' }), { value: ['123456'], focus: 0, sound: 'nope', refused: 0 });
});
