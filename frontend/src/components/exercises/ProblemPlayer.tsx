import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type {
  ExerciseAssignmentWithExercise, ProblemExercise, ProblemPhase, ProblemRole, ProblemStep
} from '@shared/types';
import { api } from '../../api';
import { useAppSounds } from '../../hooks/useAppSounds';

// A word problem, one step at a time, the way the Ε' book teaches it (ch. 1.3):
// read (what we know, what we seek), plan, solve, check. The server checks each
// step and remembers where the kid is, so a reload carries on from the same step.

const PHASES: { id: ProblemPhase; icon: string; label: string }[] = [
  { id: 'read', icon: '🔍', label: 'Διαβάζω' },
  { id: 'plan', icon: '🧭', label: 'Σχεδιάζω' },
  { id: 'solve', icon: '🧮', label: 'Λύνω' },
  { id: 'check', icon: '✅', label: 'Ελέγχω' },
];

const ROLE_LABEL: Record<Exclude<ProblemRole, 'extra'>, string> = { known: 'Το ξέρω', sought: 'Το ψάχνω' };

type Part = { text: string } | { text: string; mark: number; role: ProblemRole };

// "Έχει [25 ευρώ|known]." → plain text and marked phrases, in order.
function parseStory(story: string): Part[] {
  const parts: Part[] = [];
  const re = /\[([^\]|]+)\|(known|sought|extra)\]/g;
  let last = 0;
  let mark = 0;
  for (const m of story.matchAll(re)) {
    if (m.index! > last) parts.push({ text: story.slice(last, m.index) });
    parts.push({ text: m[1], mark: mark++, role: m[2] as ProblemRole });
    last = m.index! + m[0].length;
  }
  if (last < story.length) parts.push({ text: story.slice(last) });
  return parts;
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
  const stepIndex = Math.max(localStep, assignment.stepIndex ?? 0);
  const step = exercise.steps[Math.min(stepIndex, exercise.steps.length - 1)];

  const [busy, setBusy] = useState(false);
  // The last wrong try, for the step it was made on: moving on leaves it behind
  const [lastWrong, setLastWrong] = useState<{ step: number; parts?: number[] } | null>(null);
  const wrong = lastWrong?.step === stepIndex ? lastWrong : null;
  const [praise, setPraise] = useState(false);

  const story = useMemo(() => parseStory(exercise.story), [exercise.story]);
  // Once the tag step is solved, the story keeps its colours for the steps after it.
  const tagIndex = exercise.steps.findIndex(s => s.kind === 'tag');
  const tagged = tagIndex >= 0 && stepIndex > tagIndex;

  const submit = async (value: unknown) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await api.answerExerciseAssignment(assignment.id, { step: stepIndex, value });
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

  // Right under the question, so it is on screen whatever the step's size
  const hint = (
    <AnimatePresence>
      {wrong && (
        <motion.div className="problem-hint" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          <strong>Όχι ακόμα. </strong>
          {step.hint ? <>💡 {step.hint}</> : 'Διάβασε ξανά την ιστορία και ξαναδοκίμασε.'}
        </motion.div>
      )}
      {praise && (
        <motion.div className="problem-praise" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}>
          ✔ Σωστά!
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="problem">
      <ol className="problem-phases" aria-label="Βήματα">
        {PHASES.map(p => (
          <li key={p.id} className={p.id === step.phase ? 'on' : ''}>
            <span aria-hidden>{p.icon}</span> {p.label}
          </li>
        ))}
        <li className="problem-count">Βήμα {Math.min(stepIndex + 1, exercise.steps.length)} από {exercise.steps.length}</li>
      </ol>

      {step.kind === 'tag' && <div className="problem-prompt">{step.prompt}</div>}
      {step.kind === 'tag' && hint}

      {step.kind === 'tag' ? (
        <TagStep key={`tag-${stepIndex}`} story={story} wrong={wrong?.parts} disabled={busy} onSubmit={submit} onEdit={() => setLastWrong(null)} />
      ) : (
        <div className="problem-story">
          {step.story ?? story.map((p, i) => 'mark' in p && tagged && p.role !== 'extra'
            ? <mark key={i} className={`role-${p.role}`}>{p.text}</mark>
            : <React.Fragment key={i}>{p.text}</React.Fragment>)}
        </div>
      )}

      {step.kind !== 'tag' && <div className="problem-prompt">{step.prompt}</div>}
      {step.kind !== 'tag' && hint}

      <StepBody key={`body-${stepIndex}`} step={step} wrong={wrong?.parts} disabled={busy} onSubmit={submit} onEdit={() => setLastWrong(null)} />


      <style>{`
        .problem { width: 100%; display: flex; flex-direction: column; gap: 1.1rem; text-align: left; }
        .problem-phases { list-style: none; display: flex; flex-wrap: wrap; gap: 0.5rem; padding: 0; margin: 0; justify-content: center; }
        .problem-phases li { padding: 0.35rem 0.9rem; border-radius: 2rem; background: rgba(255,255,255,0.06); opacity: 0.55; font-size: 1rem; }
        .problem-phases li.on { opacity: 1; background: rgba(160,160,255,0.25); border: 1px solid rgba(160,160,255,0.7); font-weight: bold; }
        .problem-phases .problem-count { opacity: 0.8; background: none; }
        .problem-story { font-size: 1.35rem; line-height: 1.9; background: rgba(255,255,255,0.06); border-radius: 1.2rem; padding: 1rem 1.4rem; }
        .problem-story mark { color: inherit; border-radius: 0.4rem; padding: 0.05rem 0.3rem; }
        .role-known { background: rgba(46,213,115,0.3); box-shadow: inset 0 -3px 0 #2ed573; }
        .role-sought { background: rgba(255,200,0,0.28); box-shadow: inset 0 -3px 0 #ffc800; }
        .problem-prompt { font-size: 1.5rem; font-weight: bold; color: #a0a0ff; text-align: center; }
        .problem-hint { background: rgba(255,200,0,0.14); border: 1px solid rgba(255,200,0,0.5); border-radius: 1rem; padding: 0.8rem 1.1rem; font-size: 1.15rem; }
        .problem-praise { position: fixed; inset: 0; margin: auto; width: fit-content; height: fit-content; padding: 1.5rem 3rem; border-radius: 1.5rem;
          background: rgba(46,213,115,0.95); font-size: 2.2rem; font-weight: bold; z-index: 6000; pointer-events: none; }
        .problem-check { align-self: center; font-size: 1.3rem; font-weight: bold; padding: 0.8rem 2.2rem; border-radius: 1.2rem; border: none;
          background: #2ed573; color: #073; cursor: pointer; }
        .problem-check:disabled { opacity: 0.45; cursor: not-allowed; }
        .is-wrong { outline: 3px solid #ff4757 !important; outline-offset: 2px; }
      `}</style>
    </div>
  );
};

interface StepProps {
  wrong?: number[];
  disabled: boolean;
  onSubmit: (value: unknown) => void;
  onEdit: () => void;
}

// Tap the marked phrases with a brush: "Το ξέρω" or "Το ψάχνω". What stays unpainted isn't needed.
const TagStep: React.FC<StepProps & { story: Part[] }> = ({ story, wrong, disabled, onSubmit, onEdit }) => {
  const marks = story.filter(p => 'mark' in p).length;
  const [brush, setBrush] = useState<Exclude<ProblemRole, 'extra'>>('known');
  const [roles, setRoles] = useState<ProblemRole[]>(() => Array(marks).fill('extra'));
  const paint = (mark: number) => {
    onEdit();
    setRoles(r => r.map((role, i) => (i !== mark ? role : role === brush ? 'extra' : brush)));
  };
  return (
    <>
      <div className="tag-brushes" role="radiogroup" aria-label="Πινέλο">
        {(['known', 'sought'] as const).map(b => (
          <button key={b} type="button" role="radio" aria-checked={brush === b}
            className={`tag-brush role-${b} ${brush === b ? 'on' : ''}`} onClick={() => setBrush(b)}>
            {b === 'known' ? '🟢' : '🟡'} {ROLE_LABEL[b]}
          </button>
        ))}
        <span className="tag-legend">Ό,τι δεν χρειάζεται, το αφήνεις άβαφο.</span>
      </div>
      <div className="problem-story">
        {story.map((p, i) => 'mark' in p ? (
          <button key={i} type="button" disabled={disabled} onClick={() => paint(p.mark)}
            className={`tag-phrase ${roles[p.mark] !== 'extra' ? `role-${roles[p.mark]}` : ''} ${wrong?.includes(p.mark) ? 'is-wrong' : ''}`}>
            {p.text}
          </button>
        ) : <React.Fragment key={i}>{p.text}</React.Fragment>)}
      </div>
      <button type="button" className="problem-check" disabled={disabled} onClick={() => onSubmit(roles)}>Έλεγχος ✓</button>
      <style>{`
        .tag-brushes { display: flex; gap: 0.7rem; align-items: center; justify-content: center; flex-wrap: wrap; }
        .tag-brush { font-size: 1.2rem; padding: 0.6rem 1.2rem; border-radius: 1rem; border: 2px solid transparent; color: white; cursor: pointer; opacity: 0.6; }
        .tag-brush.on { opacity: 1; border-color: white; font-weight: bold; }
        .tag-legend { opacity: 0.7; font-size: 1rem; }
        .tag-phrase { font: inherit; color: inherit; background: rgba(255,255,255,0.1); border: 1px dashed rgba(255,255,255,0.5);
          border-radius: 0.4rem; padding: 0.05rem 0.35rem; cursor: pointer; line-height: 1.5; }
        .tag-phrase.role-known, .tag-phrase.role-sought { border-style: solid; border-color: transparent; }
      `}</style>
    </>
  );
};

const StepBody: React.FC<StepProps & { step: ProblemStep }> = ({ step, ...rest }) => {
  switch (step.kind) {
    case 'tag': return null; // drawn in the story itself
    case 'choice': return <ChoiceStep options={step.options} {...rest} />;
    case 'numbers': return <NumbersStep rows={step.rows} {...rest} />;
    case 'order': return <OrderStep items={step.items} {...rest} />;
  }
};

const ChoiceStep: React.FC<StepProps & { options: string[] }> = ({ options, disabled, onSubmit }) => {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="choice-list">
      {options.map((option, i) => (
        <motion.button key={i} type="button" className={`choice-btn ${picked === i ? 'picked' : ''}`} disabled={disabled}
          whileTap={!disabled ? { scale: 0.98 } : {}} onClick={() => { setPicked(i); onSubmit(i); }}>
          <span className="choice-letter">{String.fromCharCode(0x391 + i)}</span>{option}
        </motion.button>
      ))}
      <style>{`
        .choice-list { display: flex; flex-direction: column; gap: 0.8rem; }
        .choice-btn { display: flex; align-items: center; gap: 1rem; text-align: left; font-size: 1.25rem; color: white; cursor: pointer;
          background: rgba(255,255,255,0.08); border: 2px solid rgba(255,255,255,0.12); border-radius: 1.2rem; padding: 0.9rem 1.2rem; }
        .choice-btn.picked { border-color: rgba(160,160,255,0.8); }
        .choice-btn:disabled { cursor: default; }
        .choice-letter { flex-shrink: 0; width: 2.2rem; height: 2.2rem; border-radius: 50%; display: grid; place-items: center;
          background: rgba(255,255,255,0.12); color: gold; font-weight: bold; }
      `}</style>
    </div>
  );
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '↵'];

// One box per row and one keypad; the keypad types into the selected box, ↵ moves to the next.
const NumbersStep: React.FC<StepProps & { rows: { label: string; unit?: string }[] }> = ({ rows, wrong, disabled, onSubmit, onEdit }) => {
  const [values, setValues] = useState<string[]>(() => rows.map(() => ''));
  const [active, setActive] = useState(0);
  const complete = values.every(v => v !== '');
  const key = (k: string) => {
    if (disabled) return;
    if (k === '↵') { setActive(a => (a + 1) % rows.length); return; }
    onEdit();
    setValues(vs => vs.map((v, i) => (i !== active ? v : k === '⌫' ? v.slice(0, -1) : v.length < 6 ? v + k : v)));
  };
  return (
    <div className="numbers-step">
      <div className="numbers-rows">
        {rows.map((row, i) => (
          <div key={i} className="numbers-row">
            <span className="numbers-label">{row.label}</span>
            <button type="button" className={`numbers-box ${active === i ? 'active' : ''} ${wrong?.includes(i) ? 'is-wrong' : ''}`}
              onClick={() => setActive(i)} aria-label={`${row.label} ${values[i]}`}>
              {values[i] ? Number(values[i]).toLocaleString('el-GR') : ' '}
            </button>
            {row.unit && <span className="numbers-unit">{row.unit}</span>}
          </div>
        ))}
      </div>
      <div className="numbers-pad">
        {KEYS.map(k => (
          <motion.button key={k} type="button" className="numbers-key" disabled={disabled} whileTap={!disabled ? { scale: 0.92 } : {}}
            onClick={() => key(k)}>{k}</motion.button>
        ))}
      </div>
      <button type="button" className="problem-check" disabled={disabled || !complete}
        onClick={() => onSubmit(values.map(Number))}>Έλεγχος ✓</button>
      <style>{`
        .numbers-step { display: grid; grid-template-columns: 1fr; gap: 1rem; }
        @media (min-width: 800px) {
          .numbers-step { grid-template-columns: 1fr 17rem; align-items: center; }
          .numbers-step .numbers-pad { grid-template-columns: repeat(3, 1fr); }
          .numbers-step .problem-check { grid-column: 1 / -1; justify-self: center; }
        }
        .numbers-rows { display: flex; flex-direction: column; gap: 0.6rem; }
        .numbers-row { display: flex; align-items: center; gap: 0.8rem; font-size: 1.25rem; justify-content: flex-end; }
        .numbers-label { flex: 1; text-align: right; }
        .numbers-box { min-width: 6.5rem; min-height: 3rem; font-size: 1.5rem; font-weight: bold; color: white; border-radius: 0.8rem;
          background: rgba(0,0,0,0.3); border: 2px solid rgba(255,255,255,0.25); cursor: pointer; }
        .numbers-box.active { border-color: gold; box-shadow: 0 0 0 3px rgba(255,215,0,0.25); }
        .numbers-unit { min-width: 5rem; opacity: 0.8; }
        .numbers-pad { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.5rem; }
        .numbers-key { font-size: 1.5rem; padding: 0.65rem 0; border-radius: 0.8rem; border: none; color: white; background: rgba(255,255,255,0.12); cursor: pointer; }
        @media (max-width: 600px) { .numbers-pad { grid-template-columns: repeat(3, 1fr); } .numbers-row { flex-wrap: wrap; } }
      `}</style>
    </div>
  );
};

// Tap the items in order; tap a numbered one to take it (and the ones after it) back.
const OrderStep: React.FC<StepProps & { items: string[] }> = ({ items, wrong, disabled, onSubmit, onEdit }) => {
  const shuffled = useMemo(() => shuffle(items), [items]);
  const [order, setOrder] = useState<string[]>([]);
  const tap = (item: string) => {
    onEdit();
    const at = order.indexOf(item);
    setOrder(at >= 0 ? order.slice(0, at) : [...order, item]);
  };
  return (
    <div className="order-step">
      {shuffled.map(item => {
        const at = order.indexOf(item);
        return (
          <button key={item} type="button" disabled={disabled} onClick={() => tap(item)}
            className={`order-item ${at >= 0 ? 'placed' : ''} ${at >= 0 && wrong?.includes(at) ? 'is-wrong' : ''}`}>
            <span className="order-num">{at >= 0 ? at + 1 : ''}</span>{item}
          </button>
        );
      })}
      <button type="button" className="problem-check" disabled={disabled || order.length !== items.length} onClick={() => onSubmit(order)}>Έλεγχος ✓</button>
      <style>{`
        .order-step { display: flex; flex-direction: column; gap: 0.7rem; }
        .order-item { display: flex; align-items: center; gap: 1rem; text-align: left; font-size: 1.2rem; color: white; cursor: pointer;
          background: rgba(255,255,255,0.08); border: 2px dashed rgba(255,255,255,0.25); border-radius: 1.2rem; padding: 0.8rem 1.1rem; }
        .order-item.placed { border-style: solid; border-color: rgba(160,160,255,0.8); }
        .order-num { flex-shrink: 0; width: 2.2rem; height: 2.2rem; border-radius: 50%; display: grid; place-items: center;
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
