import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type {
  ExerciseAssignmentWithExercise, ProblemExercise, ProblemPaintStep, ProblemPhase, ProblemRole, ProblemStep
} from '@shared/types';
import { storyWords, usefulToAnswer } from '@shared/problems';
import { api } from '../../api';
import { useAppSounds } from '../../hooks/useAppSounds';
import { CalcBench, PaintWords } from './ProblemFreeSteps';
import { calcNudge, emptyCalc, paintFeedback, readLine, type CalcNote, type CalcValue, type PaintValue } from './problemFreeLogic';

// A word problem, one step at a time, the way the Ε' book teaches it (ch. 1.3):
// read (what we know, what we seek), plan, solve, check. The server checks each
// step and remembers where the kid is, so a reload carries on from the same step.
//
// The screen is a fixed frame whose slots every step fills the same way: phases,
// story, question, work area, hint, "Έλεγχος". On a landscape screen the story and
// question sit on the left and the work on the right; on a narrow one they stack.
// The story card keeps its size and the button never moves; only the work area
// scrolls if a step needs more room.

const PHASES: { id: ProblemPhase; icon: string; label: string }[] = [
  { id: 'read', icon: '🔍', label: 'Διαβάζω' },
  { id: 'plan', icon: '🧭', label: 'Σχεδιάζω' },
  { id: 'solve', icon: '🧮', label: 'Λύνω' },
  { id: 'check', icon: '✅', label: 'Ελέγχω' },
];

type Brush = Exclude<ProblemRole, 'extra'>;
const BRUSHES: { role: Brush; icon: string; label: string }[] = [
  { role: 'known', icon: '🟢', label: 'Το ξέρω' },
  { role: 'sought', icon: '🟡', label: 'Το ψάχνω' },
];

type Part = { text: string } | { text: string; mark: number; role: ProblemRole };

// "Έχει [25 ευρώ|known]." → plain text and marked phrases, in order.
function parseStory(story: string): Part[] {
  const parts: Part[] = [];
  let last = 0;
  let mark = 0;
  for (const m of story.matchAll(/\[([^\]|]+)\|(known|sought|extra)\]/g)) {
    if (m.index! > last) parts.push({ text: story.slice(last, m.index) });
    parts.push({ text: m[1], mark: mark++, role: m[2] as ProblemRole });
    last = m.index! + m[0].length;
  }
  if (last < story.length) parts.push({ text: story.slice(last) });
  return parts;
}

// What the kid has entered on the step on screen, before "Έλεγχος".
type Draft = { step: number; value: unknown };

function initialValue(step: ProblemStep, marks: number, words: number): unknown {
  switch (step.kind) {
    case 'tag': return Array<ProblemRole>(marks).fill('extra');
    case 'paint': return Array<null>(words).fill(null);
    case 'calc': return emptyCalc();
    case 'choice': return null;
    case 'numbers': return step.rows.map(() => '');
    case 'order': return [];
  }
}

function isReady(step: ProblemStep, value: unknown): boolean {
  switch (step.kind) {
    case 'tag': return true;
    case 'choice': return value !== null;
    case 'numbers': return (value as string[]).every(v => v !== '');
    case 'order': return (value as string[]).length === step.items.length;
    case 'paint': return (value as PaintValue).some(Boolean);
    case 'calc': { const v = value as CalcValue; return v.x !== null && v.op !== null && v.y !== null && v.result !== ''; }
  }
}

// What the server expects for the step
function answerOf(step: ProblemStep, value: unknown): unknown {
  if (step.kind === 'numbers') return (value as string[]).map(Number);
  if (step.kind === 'paint') {
    const v = value as PaintValue;
    const of = (b: string) => v.flatMap((x, i) => (x === b ? [i] : []));
    return { known: of('known'), sought: of('sought') };
  }
  if (step.kind === 'calc') {
    const v = value as CalcValue;
    return { lines: v.lines.map(({ x, op, y, result }) => ({ x, op, y, result })), slips: v.slips };
  }
  return value;
}

interface Props {
  assignment: ExerciseAssignmentWithExercise;
  exercise: ProblemExercise;
  onSolved: (stars: number) => void;
}

export const ProblemPlayer: React.FC<Props> = ({ assignment, exercise, onSolved }) => {
  const { playSuccess, playError } = useAppSounds();
  // The server's step, or ours if its STATE hasn't arrived yet
  const [localStep, setLocalStep] = useState(assignment.stepIndex ?? 0);
  const stepIndex = Math.min(Math.max(localStep, assignment.stepIndex ?? 0), exercise.steps.length - 1);
  const step = exercise.steps[stepIndex];

  const story = useMemo(() => parseStory(exercise.story), [exercise.story]);
  const marks = story.filter(p => 'mark' in p).length;
  const words = useMemo(() => storyWords(exercise.story), [exercise.story]);

  // Drafts and wrong marks belong to the step they were made on: moving on leaves them behind.
  const [lastWrong, setLastWrong] = useState<{ step: number; parts?: number[] } | null>(null);
  const wrong = lastWrong?.step === stepIndex ? lastWrong : null;
  const [draft, setDraft] = useState<Draft | null>(null);
  const value = draft?.step === stepIndex ? draft.value : initialValue(step, marks, words.length);
  const setValue = (v: unknown) => { setDraft({ step: stepIndex, value: v }); setLastWrong(null); setNote(null); };
  // Working it out: what the last calculation found, said in the hint slot
  const [note, setNoteState] = useState<{ step: number; note: CalcNote } | null>(null);
  const calcNote = note?.step === stepIndex ? note.note : null;
  const setNote = (n: CalcNote | null) => setNoteState(n ? { step: stepIndex, note: n } : null);
  const tries = assignment.mistakes?.[stepIndex] ?? 0;
  const [brush, setBrush] = useState<Brush>('known');
  const [busy, setBusy] = useState(false);
  const [praise, setPraise] = useState(false);

  // Once the tag step is solved, the story keeps its colours for the steps after it.
  const tagIndex = exercise.steps.findIndex(s => s.kind === 'tag' || s.kind === 'paint');
  const storyMode = step.kind === 'tag' ? 'tag' : step.kind === 'paint' ? 'paint' : tagIndex >= 0 && stepIndex > tagIndex ? 'tagged' : 'plain';

  const submit = async () => {
    if (busy || !isReady(step, value)) return;
    let answer = value;
    if (step.kind === 'calc') {
      // Each calculation is read back here; only the one that finds the answer goes to the server
      const read = readLine(step, value as CalcValue, usefulToAnswer(step));
      setDraft({ step: stepIndex, value: read.value });
      setNote(read.note);
      if (read.note.kind === 'math' || read.note.kind === 'nothing') { playError(); return; }
      if (read.note.kind !== 'answer') return;
      answer = read.value;
    }
    setBusy(true);
    try {
      const result = await api.answerExerciseAssignment(assignment.id, { step: stepIndex, value: answerOf(step, answer) });
      if (result.correct) {
        playSuccess();
        if (result.assignment.status === 'completed') {
          onSolved(result.starsAwarded);
          return;
        }
        setPraise(true);
        setTimeout(() => {
          setPraise(false);
          setLocalStep(result.assignment.stepIndex ?? stepIndex + 1);
          setBusy(false);
        }, 900);
      } else {
        playError();
        setLastWrong({ step: stepIndex, parts: result.wrong });
        setBusy(false);
      }
    } catch (err) {
      console.error('Answer submission failed:', err);
      setBusy(false);
    }
  };

  const paint = (mark: number) => {
    const roles = value as ProblemRole[];
    setValue(roles.map((role, i) => (i !== mark ? role : role === brush ? 'extra' : brush)));
  };

  return (
    <div className="problem">
      <ol className="problem-phases" aria-label="Βήματα">
        {PHASES.map(p => (
          <li key={p.id} className={p.id === step.phase ? 'on' : ''}>
            <span aria-hidden>{p.icon}</span> {p.label}
          </li>
        ))}
        <li className="problem-count">Βήμα {stepIndex + 1} από {exercise.steps.length}</li>
      </ol>

      <StoryCard parts={story} mode={storyMode} override={step.story} roles={value as ProblemRole[]}
        wrong={step.kind === 'tag' ? wrong?.parts : undefined} disabled={busy} onTap={paint}
        paint={step.kind === 'paint' ? {
          words, value: value as PaintValue, brush, onChange: setValue,
          ...paintMarks(step, wrong?.parts, tries),
        } : undefined} />

      <div className="problem-prompt">{step.prompt}</div>

      <div className="problem-work">
        {(step.kind === 'tag' || step.kind === 'paint') && (
          <div className="tag-brushes" role="radiogroup" aria-label="Πινέλο">
            {BRUSHES.map(b => (
              <button key={b.role} type="button" role="radio" aria-checked={brush === b.role}
                className={`tag-brush role-${b.role} ${brush === b.role ? 'on' : ''}`} onClick={() => setBrush(b.role)}>
                {b.icon} {b.label}
              </button>
            ))}
            <span className="tag-legend">{step.kind === 'paint'
              ? 'Διάλεξε πινέλο και σύρε το δάχτυλο πάνω στις λέξεις. Ξανά πάνω τους, και σβήνουν.'
              : 'Διάλεξε πινέλο και πάτα τις φράσεις της ιστορίας. Ό,τι δεν χρειάζεται, το αφήνεις άβαφο.'}</span>
          </div>
        )}
        {step.kind === 'choice' && (
          <ChoiceStep options={step.options} value={value as number | null} setValue={setValue} disabled={busy} />
        )}
        {step.kind === 'numbers' && (
          <NumbersStep key={stepIndex} rows={step.rows} value={value as string[]} setValue={setValue} wrong={wrong?.parts} disabled={busy} />
        )}
        {step.kind === 'calc' && (
          <CalcBench step={step} value={value as CalcValue} setValue={setValue} disabled={busy} />
        )}
        {step.kind === 'order' && (
          <OrderStep key={stepIndex} items={step.items} value={value as string[]} setValue={setValue} wrong={wrong?.parts} disabled={busy} />
        )}
      </div>

      <div className={`problem-hint ${wrong || (calcNote && calcNote.kind !== 'answer') ? 'on' : ''} ${calcNote && calcNote.kind === 'found' ? 'good' : ''}`} aria-live="polite">
        {wrong && (
          <motion.span key={`${stepIndex}-${lastWrong?.parts?.join()}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <strong>Όχι ακόμα. </strong>
            {step.kind === 'paint' && wrong.parts?.length ? paintFeedback(step, words, wrong.parts) + ' '
              : step.hint ? <>💡 {step.hint}</> : 'Διάβασε ξανά την ιστορία και ξαναδοκίμασε.'}
            {step.kind === 'paint' && tries >= 2 && ' Κοίτα τις λέξεις με το κίτρινο πλαίσιο.'}
          </motion.span>
        )}
        {!wrong && calcNote && calcNote.kind !== 'answer' && (
          <motion.span key={`${stepIndex}-${(value as CalcValue).lines.length}-${(value as CalcValue).slips}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {calcNote.text}
            {step.kind === 'calc' && calcNote.kind === 'nothing' && calcNudge(step, value as CalcValue) &&
              <> 💡 {calcNudge(step, value as CalcValue)}</>}
          </motion.span>
        )}
      </div>
      <button type="button" className="problem-check" disabled={busy || !isReady(step, value)} onClick={submit}>Έλεγχος ✓</button>

      <AnimatePresence>
        {praise && (
          <motion.div className="problem-praise" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}>
            ✔ Σωστά!
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .problem { flex: 1; min-height: 0; width: 100%; display: grid; gap: 0.7rem 1.5rem; text-align: left;
          grid-template-columns: minmax(0, 1fr) auto;
          grid-template-rows: auto auto auto minmax(0, 1fr) auto;
          grid-template-areas: "phases phases" "story story" "prompt prompt" "work work" "hint check"; }
        /* Landscape: read on the left, work on the right */
        @media (min-width: 900px) and (orientation: landscape) {
          .problem { grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
            grid-template-rows: auto auto auto minmax(0, 1fr) auto;
            grid-template-areas: "phases phases" "story work" "prompt work" "hint work" "hint check"; }
          .problem-prompt { text-align: left; min-height: 2.5em; } /* two lines, so the hint under it stays put */
          .problem-hint { align-self: start; }
          .problem-check { justify-self: end; }
          .problem-work > * { margin-block: auto; } /* centred while it fits, scrolls from the top when it doesn't */
        }
        .problem-phases { grid-area: phases; }
        .problem-story { grid-area: story; }
        .problem-prompt { grid-area: prompt; }
        .problem-work { grid-area: work; container-type: inline-size; }
        .problem-hint { grid-area: hint; }
        .problem-check { grid-area: check; align-self: end; }
        .problem-phases { list-style: none; display: flex; flex-wrap: wrap; gap: 0.5rem; padding: 0; margin: 0; justify-content: center; }
        .problem-phases li { padding: 0.3rem 0.9rem; border-radius: 2rem; border: 1px solid transparent; background: rgba(255,255,255,0.06); opacity: 0.55; font-size: 1rem; }
        .problem-phases li.on { opacity: 1; background: rgba(160,160,255,0.25); border-color: rgba(160,160,255,0.7); font-weight: bold; }
        .problem-phases .problem-count { opacity: 0.8; background: none; }
        .problem-prompt { font-size: 1.4rem; font-weight: bold; color: #a0a0ff; text-align: center; }
        .problem-work { min-height: 0; overflow-y: auto; padding: 0.2rem; display: flex; flex-direction: column; }
        .problem-work > * { margin-bottom: auto; } /* stacked: right under the question */
        .problem-hint { min-height: 3.6rem; display: flex; align-items: center; border-radius: 1rem; padding: 0.5rem 1rem; font-size: 1.1rem;
          border: 1px solid transparent; }
        .problem-hint.on { background: rgba(255,200,0,0.14); border-color: rgba(255,200,0,0.5); }
        .problem-hint.on.good { background: rgba(46,213,115,0.14); border-color: rgba(46,213,115,0.5); }
        .problem-check { font-size: 1.3rem; font-weight: bold; padding: 0.9rem 2.2rem; border-radius: 1.2rem; border: none;
          background: #2ed573; color: #073; cursor: pointer; white-space: nowrap; }
        .problem-check:disabled { opacity: 0.4; cursor: not-allowed; }
        .problem-praise { position: fixed; inset: 0; margin: auto; width: fit-content; height: fit-content; padding: 1.5rem 3rem; border-radius: 1.5rem;
          background: rgba(46,213,115,0.95); font-size: 2.2rem; font-weight: bold; z-index: 6000; pointer-events: none; }
        .is-wrong { outline: 3px solid #ff4757 !important; outline-offset: 2px; }
        .role-known { background: rgba(46,213,115,0.3); box-shadow: inset 0 -3px 0 #2ed573; }
        .role-sought { background: rgba(255,200,0,0.28); box-shadow: inset 0 -3px 0 #ffc800; }
        .tag-brushes { display: flex; gap: 0.7rem; align-items: center; justify-content: center; flex-wrap: wrap; }
        .tag-brush { font-size: 1.2rem; padding: 0.6rem 1.2rem; border-radius: 1rem; border: 2px solid transparent; color: white; cursor: pointer; opacity: 0.6; }
        .tag-brush.on { opacity: 1; border-color: white; font-weight: bold; }
        .tag-legend { flex-basis: 100%; text-align: center; opacity: 0.7; font-size: 1rem; }
      `}</style>
    </div>
  );
};

// The story, always the same size: the full story sits in the same cell (invisible
// when a step shows a shorter version), and the phrases keep one shape in every mode,
// only their colours change.
// After a wrong painting: the unneeded facts she painted in red; after two, the ones she
// missed get a dashed frame.
function paintMarks(step: ProblemPaintStep, wrong: number[] | undefined, tries: number) {
  const wrongWords = new Set<number>(), revealWords = new Set<number>();
  step.targets.forEach((t, i) => {
    if (!wrong?.includes(i)) return;
    if (t.role === 'extra') t.words.forEach(w => wrongWords.add(w));
    else if (tries >= 2) t.words.forEach(w => revealWords.add(w));
  });
  return { wrongWords, revealWords };
}

const StoryCard: React.FC<{
  parts: Part[]; mode: 'plain' | 'tagged' | 'tag' | 'paint'; override?: string; roles: ProblemRole[];
  wrong?: number[]; disabled: boolean; onTap: (mark: number) => void;
  paint?: Omit<React.ComponentProps<typeof PaintWords>, 'disabled'>;
}> = ({ parts, mode, override, roles, wrong, disabled, onTap, paint }) => {
  const full = paint ? [<PaintWords key="paint" {...paint} disabled={disabled} />] : parts.map((p, i) => {
    if (!('mark' in p)) return <React.Fragment key={i}>{p.text}</React.Fragment>;
    if (mode !== 'tag') {
      const role = mode === 'tagged' && p.role !== 'extra' ? `role-${p.role}` : '';
      return <span key={i} className={`story-phrase ${role}`}>{p.text}</span>;
    }
    const role = roles[p.mark];
    // An inline span, not a <button> (an inline-block), so the lines wrap as in the other modes
    const tap = () => { if (!disabled) onTap(p.mark); };
    return (
      <span key={i} role="button" tabIndex={0} aria-disabled={disabled} onClick={tap}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(); } }}
        className={`story-phrase tappable ${role !== 'extra' ? `role-${role}` : ''} ${wrong?.includes(p.mark) ? 'is-wrong' : ''}`}>
        {p.text}
      </span>
    );
  });
  return (
    <div className="problem-story">
      <div className={override ? 'story-layer hidden' : 'story-layer'} aria-hidden={!!override}>{full}</div>
      {override && <div className="story-layer">{override}</div>}
      <style>{`
        .problem-story { display: grid; font-size: 1.3rem; line-height: 1.75; background: rgba(255,255,255,0.06); border-radius: 1.2rem; padding: 0.8rem 1.3rem; }
        .story-layer { grid-area: 1 / 1; }
        .story-layer.hidden { visibility: hidden; }
        .story-phrase { border-radius: 0.3rem; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
        /* No padding, margin or border: a phrase takes exactly the space of plain text, so the
           story wraps the same in every mode. The tap frame is an outline, which takes no space. */
        .story-phrase.tappable { cursor: pointer; background: rgba(255,255,255,0.1); outline: 1px dashed rgba(255,255,255,0.55); outline-offset: 2px; }
        .story-phrase.tappable.role-known, .story-phrase.tappable.role-sought { outline: none; }
      `}</style>
    </div>
  );
};

interface StepProps<T> {
  value: T;
  setValue: (v: T) => void;
  disabled: boolean;
  wrong?: number[];
}

// Tap to pick, "Έλεγχος" to answer.
const ChoiceStep: React.FC<StepProps<number | null> & { options: string[] }> = ({ options, value, setValue, disabled }) => (
  <div className="choice-list">
    {options.map((option, i) => (
      <motion.button key={i} type="button" className={`choice-btn ${value === i ? 'picked' : ''}`} disabled={disabled}
        aria-pressed={value === i} whileTap={!disabled ? { scale: 0.98 } : {}} onClick={() => setValue(i)}>
        <span className="choice-letter">{String.fromCharCode(0x391 + i)}</span>{option}
      </motion.button>
    ))}
    <style>{`
      .choice-list { display: flex; flex-direction: column; gap: 0.7rem; }
      .choice-btn { display: flex; align-items: center; gap: 1rem; text-align: left; font-size: 1.2rem; color: white; cursor: pointer;
        background: rgba(255,255,255,0.08); border: 2px solid rgba(255,255,255,0.12); border-radius: 1.2rem; padding: 0.75rem 1.2rem; }
      .choice-btn.picked { border-color: gold; background: rgba(255,215,0,0.12); }
      .choice-btn:disabled { cursor: default; }
      .choice-letter { flex-shrink: 0; width: 2.1rem; height: 2.1rem; border-radius: 50%; display: grid; place-items: center;
        background: rgba(255,255,255,0.12); color: gold; font-weight: bold; }
    `}</style>
  </div>
);

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '↵'];

// One box per row and one keypad; the keypad types into the selected box, ↵ moves to the next.
const NumbersStep: React.FC<StepProps<string[]> & { rows: { label: string; unit?: string }[] }> = ({ rows, value, setValue, wrong, disabled }) => {
  const [active, setActive] = useState(0);
  const key = (k: string) => {
    if (disabled) return;
    if (k === '↵') { setActive(a => (a + 1) % rows.length); return; }
    setValue(value.map((v, i) => (i !== active ? v : k === '⌫' ? v.slice(0, -1) : v.length < 6 ? v + k : v)));
  };
  // Long labels ("Όλες οι ημέρες: 24 + 48 + 33 + 105 =") need the width: keypad under the rows
  const stacked = rows.some(row => row.label.length > 22);
  return (
    <div className={`numbers-step ${stacked ? 'stacked' : ''}`}>
      <div className="numbers-rows">
        {rows.map((row, i) => (
          <div key={i} className="numbers-row">
            <span className="numbers-label">{row.label}</span>
            <button type="button" className={`numbers-box ${active === i ? 'active' : ''} ${wrong?.includes(i) ? 'is-wrong' : ''}`}
              onClick={() => setActive(i)} aria-label={`${row.label} ${value[i]}`}>
              {value[i] ? Number(value[i]).toLocaleString('el-GR') : ' '}
            </button>
            <span className="numbers-unit">{row.unit}</span>
          </div>
        ))}
      </div>
      <div className="numbers-pad">
        {KEYS.map(k => (
          <motion.button key={k} type="button" className="numbers-key" disabled={disabled} whileTap={!disabled ? { scale: 0.92 } : {}}
            onClick={() => key(k)}>{k}</motion.button>
        ))}
      </div>
      <style>{`
        .numbers-step { display: grid; grid-template-columns: 1fr; gap: 1rem; align-items: center; }
        @container (min-width: 560px) {
          .numbers-step:not(.stacked) { grid-template-columns: 1fr 15rem; }
          .numbers-step:not(.stacked) .numbers-pad { grid-template-columns: repeat(3, 1fr); }
        }
        .numbers-step.stacked .numbers-key { padding: 0.45rem 0; }
        .numbers-rows { display: flex; flex-direction: column; gap: 0.5rem; }
        .numbers-row { display: flex; align-items: center; gap: 0.8rem; font-size: 1.2rem; justify-content: flex-end; }
        .numbers-label { flex: 1; text-align: right; }
        .numbers-box { min-width: 6.5rem; min-height: 2.9rem; font-size: 1.45rem; font-weight: bold; color: white; border-radius: 0.8rem;
          background: rgba(0,0,0,0.3); border: 2px solid rgba(255,255,255,0.25); cursor: pointer; }
        .numbers-box.active { border-color: gold; box-shadow: 0 0 0 3px rgba(255,215,0,0.25); }
        .numbers-unit { min-width: 5rem; opacity: 0.8; }
        .numbers-pad { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.45rem; }
        .numbers-key { font-size: 1.45rem; padding: 0.55rem 0; border-radius: 0.8rem; border: none; color: white; background: rgba(255,255,255,0.12); cursor: pointer; }
        @container (max-width: 420px) { .numbers-pad { grid-template-columns: repeat(3, 1fr); } .numbers-row { flex-wrap: wrap; } }
      `}</style>
    </div>
  );
};

// Tap the items in order; tap a numbered one to take it (and the ones after it) back.
const OrderStep: React.FC<StepProps<string[]> & { items: string[] }> = ({ items, value, setValue, wrong, disabled }) => {
  const shuffled = useMemo(() => shuffle(items), [items]);
  const tap = (item: string) => {
    const at = value.indexOf(item);
    setValue(at >= 0 ? value.slice(0, at) : [...value, item]);
  };
  return (
    <div className="order-step">
      {shuffled.map(item => {
        const at = value.indexOf(item);
        return (
          <button key={item} type="button" disabled={disabled} onClick={() => tap(item)}
            className={`order-item ${at >= 0 ? 'placed' : ''} ${at >= 0 && wrong?.includes(at) ? 'is-wrong' : ''}`}>
            <span className="order-num">{at >= 0 ? at + 1 : ''}</span>{item}
          </button>
        );
      })}
      <style>{`
        .order-step { display: flex; flex-direction: column; gap: 0.7rem; }
        .order-item { display: flex; align-items: center; gap: 1rem; text-align: left; font-size: 1.2rem; color: white; cursor: pointer;
          background: rgba(255,255,255,0.08); border: 2px dashed rgba(255,255,255,0.25); border-radius: 1.2rem; padding: 0.75rem 1.1rem; }
        .order-item.placed { border-style: solid; border-color: rgba(160,160,255,0.8); }
        .order-num { flex-shrink: 0; width: 2.1rem; height: 2.1rem; border-radius: 50%; display: grid; place-items: center;
          background: rgba(255,255,255,0.12); color: gold; font-weight: bold; }
      `}</style>
    </div>
  );
};

function shuffle<T>(xs: T[]): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  // Never start in the right order: that would give the answer away
  return out.every((x, i) => x === xs[i]) && out.length > 1 ? [...out.slice(1), out[0]] : out;
}
