import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import type { ProblemCalcStep } from '@shared/types';
import type { CalcOp } from '@shared/problems';
import { fmt, lower, type Brush, type CalcValue, type PaintValue } from './problemFreeLogic';

// The two free steps of a problem: painting the story freehand (nothing marked on
// screen, word by word, with a finger drag) and working it out her own way (two
// numbers, an operation, the result; each calculation read back as she goes).

// ---------------------------------------------------------------------------
// Painting

/**
 * The story as words to paint. A press starts a stroke with the brush in hand, or an
 * eraser when the first word already has that colour; dragging carries it over the
 * words it passes. The words and single spaces are exactly the plain story, so the card
 * wraps as in every other step.
 */
export const PaintWords: React.FC<{
  words: string[]; value: PaintValue; brush: Brush; disabled: boolean;
  onChange: (v: PaintValue) => void;
  /** Words to outline: red for a mistake, dashed for what she missed. */
  wrongWords: Set<number>; revealWords: Set<number>;
}> = ({ words, value, brush, disabled, onChange, wrongWords, revealWords }) => {
  const stroke = useRef<{ paint: Brush | null; value: PaintValue } | null>(null);
  const wordAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest('[data-w]') as HTMLElement | null;
    return el ? Number(el.dataset.w) : null;
  };
  const apply = (w: number | null) => {
    const s = stroke.current;
    if (w === null || !s || s.value[w] === s.paint) return;
    s.value = s.value.map((b, i) => (i === w ? s.paint : b));
    onChange(s.value);
  };
  const down = (e: React.PointerEvent) => {
    if (disabled) return;
    const w = wordAt(e.clientX, e.clientY);
    if (w === null) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    stroke.current = { paint: value[w] === brush ? null : brush, value };
    apply(w);
  };
  const move = (e: React.PointerEvent) => { if (stroke.current) apply(wordAt(e.clientX, e.clientY)); };
  const up = () => { stroke.current = null; };
  return (
    <span className="paint-words" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      {words.map((w, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className={value[i - 1] && value[i - 1] === value[i] ? `role-${value[i]}` : ''}> </span>}
          <span data-w={i} className={`paint-word ${value[i] ? `role-${value[i]}` : ''} ${wrongWords.has(i) ? 'is-wrong' : ''} ${revealWords.has(i) ? 'is-missed' : ''}`}>{w}</span>
        </React.Fragment>
      ))}
      <style>{`
        .paint-words { touch-action: none; user-select: none; -webkit-user-select: none; cursor: crosshair; }
        .paint-word { border-radius: 0.2rem; }
        .paint-word.is-missed { outline: 2px dashed #ffc800; outline-offset: 2px; }
      `}</style>
    </span>
  );
};

// ---------------------------------------------------------------------------
// Working it out

const OPS: CalcOp[] = ['+', '−', '×', ':'];
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'C'];

/** Numbers she has (the story's and the ones she found), a line to build, a keypad. */
export const CalcBench: React.FC<{
  step: ProblemCalcStep; value: CalcValue; setValue: (v: CalcValue) => void; disabled: boolean;
}> = ({ step, value, setValue, disabled }) => {
  const byId = new Map(step.quantities.map(q => [q.id, q]));
  const story = step.given.map(id => byId.get(id)!);
  const pick = (n: number) => {
    if (disabled) return;
    if (value.x === null) setValue({ ...value, x: n });
    else if (value.op === null) setValue({ ...value, x: n });
    else setValue({ ...value, y: n });
  };
  const key = (k: string) => {
    if (disabled) return;
    if (k === 'C') { setValue({ ...value, x: null, op: null, y: null, result: '' }); return; }
    if (k === '⌫') {
      if (value.result) setValue({ ...value, result: value.result.slice(0, -1) });
      else if (value.y !== null) setValue({ ...value, y: null });
      else if (value.op !== null) setValue({ ...value, op: null });
      else setValue({ ...value, x: null });
      return;
    }
    if (value.y !== null && value.result.length < 7) setValue({ ...value, result: value.result + k });
  };
  const slot = (n: number | null, what: string) => <span className={`calc-slot ${n === null ? 'empty' : ''}`}>{n === null ? what : fmt(n)}</span>;
  return (
    <div className="calc">
      <ol className="calc-lines">
        {value.lines.map((l, i) => (
          <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className={l.onPath ? '' : 'off-path'}>
            <span className="calc-eq">{fmt(l.x)} {l.op} {fmt(l.y)} = <b>{fmt(l.result)}</b></span>
            <span className="calc-means">{l.label}</span>
          </motion.li>
        ))}
      </ol>
      <div className="calc-build" aria-label="Η πράξη σου">
        {slot(value.x, '?')}
        <span className={`calc-slot op ${value.op === null ? 'empty' : ''}`}>{value.op ?? '○'}</span>
        {slot(value.y, '?')}
        <span>=</span>
        <span className={`calc-slot result ${value.result ? '' : 'empty'} ${value.y !== null && !value.result ? 'active' : ''}`}>
          {value.result ? fmt(Number(value.result)) : '…'}
        </span>
      </div>
      <div className="calc-chips">
        {story.map(q => (
          <button key={q.id} type="button" className="calc-chip" disabled={disabled} onClick={() => pick(q.value)}>
            {fmt(q.value)} <small>{q.unit}</small>
          </button>
        ))}
        {value.lines.map((l, i) => (
          <button key={`l${i}`} type="button" className="calc-chip found" disabled={disabled} onClick={() => pick(l.result)}>
            {fmt(l.result)} <small>{lower(l.label)}</small>
          </button>
        ))}
      </div>
      <div className="calc-pad">
        {OPS.map(op => (
          <motion.button key={op} type="button" className={`calc-key op ${value.op === op ? 'on' : ''}`} disabled={disabled || value.x === null}
            whileTap={{ scale: 0.92 }} onClick={() => setValue({ ...value, op })}>{op}</motion.button>
        ))}
        {DIGITS.map(k => (
          <motion.button key={k} type="button" className="calc-key" disabled={disabled} whileTap={{ scale: 0.92 }} onClick={() => key(k)}>{k}</motion.button>
        ))}
      </div>
      <style>{`
        .calc { display: flex; flex-direction: column; gap: 0.7rem; }
        .calc-lines { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
        .calc-lines li { display: flex; gap: 0.8rem; align-items: baseline; font-size: 1.15rem; padding: 0.3rem 0.8rem;
          border-radius: 0.7rem; background: rgba(46,213,115,0.14); }
        .calc-lines li.off-path { background: rgba(255,255,255,0.06); opacity: 0.75; }
        .calc-means { opacity: 0.8; font-size: 1rem; }
        .calc-build { display: flex; align-items: center; justify-content: center; gap: 0.6rem; font-size: 1.5rem; }
        .calc-slot { min-width: 4.2rem; padding: 0.35rem 0.6rem; text-align: center; border-radius: 0.8rem; font-weight: bold;
          background: rgba(0,0,0,0.3); border: 2px solid rgba(255,255,255,0.25); }
        .calc-slot.op { min-width: 2.8rem; color: gold; }
        .calc-slot.empty { opacity: 0.55; font-weight: normal; }
        .calc-slot.result { min-width: 5.5rem; }
        .calc-slot.active { border-color: gold; box-shadow: 0 0 0 3px rgba(255,215,0,0.25); opacity: 1; }
        .calc-chips { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; }
        .calc-chip { font-size: 1.2rem; font-weight: bold; color: white; cursor: pointer; padding: 0.4rem 0.9rem; border-radius: 2rem;
          background: rgba(160,160,255,0.2); border: 2px solid rgba(160,160,255,0.55); }
        .calc-chip small { font-weight: normal; opacity: 0.8; font-size: 0.85rem; }
        .calc-chip.found { background: rgba(46,213,115,0.2); border-color: rgba(46,213,115,0.6); }
        .calc-pad { display: grid; grid-template-columns: repeat(8, 1fr); gap: 0.4rem; }
        .calc-key { font-size: 1.35rem; padding: 0.45rem 0; border-radius: 0.8rem; border: none; color: white; background: rgba(255,255,255,0.12); cursor: pointer; }
        .calc-key.op { color: gold; font-weight: bold; }
        .calc-key.op.on { background: rgba(255,215,0,0.3); }
        .calc-key:disabled { opacity: 0.35; }
        @container (max-width: 480px) { .calc-pad { grid-template-columns: repeat(4, 1fr); } }
      `}</style>
    </div>
  );
};
