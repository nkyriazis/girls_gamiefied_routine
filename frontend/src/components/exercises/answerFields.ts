import type { CalcValue } from './problemFreeLogic';
import type { SoundName } from '../../sound/sfx';

// Where each tap goes in a problem's answer boxes (#52): the calc line `x op y = result`
// and the numbers step's boxes. She taps a box to select it and fills it; every input says
// where it went and the sound it makes, and an input with nowhere to go is refused (the box
// wiggles, «nope»), never ignored. Pure, with type-only imports, so `npm test` runs it.

/** What an input sounds like. A refused one is always «nope». */
export type FieldSound = Extract<SoundName, 'place' | 'select' | 'key' | 'erase' | 'nope' | 'tap'>;

export interface FieldEdit<V, F> {
  value: V;
  /** The selected box after the input */
  focus: F;
  sound: FieldSound;
  /** Set when the input has nowhere to go: the box that wiggles. Nothing changed. */
  refused?: F;
}

// ---------------------------------------------------------------------------
// The calc line

export type CalcField = 'x' | 'op' | 'y' | 'result';
export const CALC_FIELDS: readonly CalcField[] = ['x', 'op', 'y', 'result'];

export type CalcInput =
  | { kind: 'tap'; field: CalcField }
  /** A number she has: the story's, or one she found */
  | { kind: 'chip'; n: number }
  | { kind: 'op'; op: NonNullable<CalcValue['op']> }
  | { kind: 'digit'; d: string }
  /** ⌫ */
  | { kind: 'erase' }
  /** C */
  | { kind: 'clear' };

const RESULT_DIGITS = 7;

const isEmpty = (v: CalcValue, f: CalcField) => (f === 'result' ? v.result === '' : v[f] === null);
const emptied = (v: CalcValue, f: CalcField): CalcValue => (f === 'result' ? { ...v, result: '' } : { ...v, [f]: null });

/** After a fill: the first empty box, in order x, op, y, result; the result when none is. */
export const nextCalcFocus = (v: CalcValue): CalcField => CALC_FIELDS.find(f => isEmpty(v, f)) ?? 'result';

/**
 * One input on the calc line. A chip goes into the selected x or y, or else the first
 * empty of the two; an operator always into op; a digit into the result (the only box
 * that takes digits: typed trial numbers in x and y are #50), from op or the result.
 * ⌫ erases in the selected box, or steps back to the last filled one before it (never past
 * the start of the line); C empties the selected box.
 */
export function calcInput(v: CalcValue, focus: CalcField, input: CalcInput): FieldEdit<CalcValue, CalcField> {
  const refuse = (at: CalcField = focus): FieldEdit<CalcValue, CalcField> => ({ value: v, focus, sound: 'nope', refused: at });
  const filled = (value: CalcValue, sound: FieldSound): FieldEdit<CalcValue, CalcField> => ({ value, focus: nextCalcFocus(value), sound });
  switch (input.kind) {
    case 'tap':
      return { value: v, focus: input.field, sound: 'select' };
    case 'chip': {
      const to = focus === 'x' || focus === 'y' ? focus : (['x', 'y'] as const).find(f => isEmpty(v, f));
      return to ? filled({ ...v, [to]: input.n }, 'place') : refuse();
    }
    case 'op':
      return filled({ ...v, op: input.op }, 'select');
    case 'digit':
      if (focus === 'x' || focus === 'y') return refuse();
      if (v.result.length >= RESULT_DIGITS) return refuse('result');
      return { value: { ...v, result: v.result + input.d }, focus: 'result', sound: 'key' };
    case 'erase': {
      // The selected box, or the nearest filled one before it; nothing filled up to the start: refused
      const back = CALC_FIELDS.slice(0, CALC_FIELDS.indexOf(focus) + 1).reverse().find(f => !isEmpty(v, f));
      if (!back) return refuse();
      const value = back === 'result' ? { ...v, result: v.result.slice(0, -1) } : emptied(v, back);
      return { value, focus: back, sound: 'erase' };
    }
    case 'clear':
      return isEmpty(v, focus) ? refuse() : { value: emptied(v, focus), focus, sound: 'erase' };
  }
}

/**
 * The selected box after «Έλεγχος» (which happens outside the line): an accepted line
 * starts the next one at x; a line sent back («Ξαναμέτρα…») puts the focus on its result.
 */
export function calcFocusAfterCheck(before: { lines: number; slips: number }, v: CalcValue, focus: CalcField): CalcField {
  if (v.lines.length !== before.lines) return 'x';
  if (v.slips !== before.slips) return 'result';
  return focus;
}

// ---------------------------------------------------------------------------
// The numbers step: one box per row, the keypad types into the selected one. Focus moves
// on with ↵ or a tap, never by itself: typing can't tell when a number is finished.

export type NumbersInput = { kind: 'tap'; box: number } | { kind: 'key'; key: string };

const BOX_DIGITS = 6;

export function numbersInput(v: string[], focus: number, input: NumbersInput): FieldEdit<string[], number> {
  if (input.kind === 'tap') return { value: v, focus: input.box, sound: 'select' };
  const set = (s: string) => v.map((x, i) => (i === focus ? s : x));
  const box = v[focus];
  switch (input.key) {
    case '↵': return { value: v, focus: (focus + 1) % v.length, sound: 'tap' };
    case '⌫': return { value: box ? set(box.slice(0, -1)) : v, focus, sound: 'erase' };
    case 'C': return box ? { value: set(''), focus, sound: 'erase' } : { value: v, focus, sound: 'nope', refused: focus };
    default:
      return box.length < BOX_DIGITS ? { value: set(box + input.key), focus, sound: 'key' } : { value: v, focus, sound: 'nope', refused: focus };
  }
}
