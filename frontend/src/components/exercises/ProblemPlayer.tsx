import React, { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type {
  ExerciseAssignmentWithExercise, Forgiveness, ProblemExercise, ProblemPhase, ProblemReading, ProblemRole, ProblemStep
} from '@shared/types';
import { readCalculation, storyWords, targetsFromMarks, usefulToAnswer, workedAnswer, type CalcLine, type PaintTarget } from '@shared/problems';
import { stepCounts, stepHelp } from '@shared/forgiveness';
import { api } from '../../api';
import { CalcBench, PaintWords } from './ProblemFreeSteps';
import { help } from '../../help/anchors';
import { HelpScreen } from '../../help/HelpProvider';
import { problemTour, type ProblemHelpKind } from './ProblemPlayer.help';
import { optionLetter, useSeededOrder, useShuffled, shuffle as draw } from './shuffle';
import { calcNudge, emptyCalc, paintFeedback, readLine, type Brush, type CalcNote, type CalcValue, type PaintValue } from './problemFreeLogic';
import { sfx, sound } from '../../sound/sfx';
import { numbersInput, type NumbersInput } from './answerFields';
import { ANSWER_BOX_CSS, wiggle } from './answerBox';

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

const BRUSHES: { role: Brush; icon: string; label: string }[] = [
  { role: 'known', icon: '🟢', label: 'Το ξέρω' },
  { role: 'sought', icon: '🟡', label: 'Το ψάχνω' },
  { role: 'extra', icon: '⚪', label: 'Δεν χρειάζεται' }, // only on "paint-all"
];

// The reading step (tag or paint) plays on the kid's rung: tapping the marked phrases,
// or painting the story freehand.
const isRead = (s: ProblemStep) => s.kind === 'tag' || s.kind === 'paint';
type Kind = ProblemStep['kind'];

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

function initialValue(kind: Kind, step: ProblemStep, marks: number, words: number): unknown {
  switch (kind) {
    case 'tag': return Array<ProblemRole>(marks).fill('extra');
    case 'paint': return Array<null>(words).fill(null);
    case 'calc': return emptyCalc();
    case 'choice': return null;
    case 'numbers': return step.kind === 'numbers' ? step.rows.map(() => '') : [];
    case 'order': return [];
  }
}

function isReady(kind: Kind, step: ProblemStep, value: unknown): boolean {
  switch (kind) {
    case 'tag': return true;
    case 'choice': return value !== null;
    case 'numbers': return (value as string[]).every(v => v !== '');
    case 'order': return step.kind === 'order' && (value as string[]).length === step.items.length;
    case 'paint': return (value as PaintValue).some(Boolean);
    case 'calc': { const v = value as CalcValue; return v.x !== null && v.op !== null && v.y !== null && v.result !== ''; }
  }
}

// What the server expects for the step
function answerOf(kind: Kind, value: unknown): unknown {
  if (kind === 'numbers') return (value as string[]).map(Number);
  if (kind === 'paint') {
    const v = value as PaintValue;
    const of = (b: string) => v.flatMap((x, i) => (x === b ? [i] : []));
    return { known: of('known'), sought: of('sought'), extra: of('extra') };
  }
  if (kind === 'calc') {
    const v = value as CalcValue;
    return { lines: v.lines.map(({ x, op, y, result }) => ({ x, op, y, result })), slips: v.slips };
  }
  return value;
}

// The step worked (workedAnswer, as the server takes it) as the screen shows it
function workedValue(kind: Kind, step: ProblemStep, answer: unknown, words: number, draft: unknown): unknown {
  switch (kind) {
    case 'paint': {
      const v = answer as { known: number[]; sought: number[]; extra: number[] };
      const out: PaintValue = Array(words).fill(null);
      for (const b of ['known', 'sought', 'extra'] as const) for (const w of v[b]) out[w] = b;
      return out;
    }
    case 'numbers': return (answer as number[]).map(String);
    case 'calc': {
      if (step.kind !== 'calc') return answer;
      const path = usefulToAnswer(step);
      const lines = (answer as { lines: CalcLine[] }).lines.map(l => {
        const q = readCalculation(step, l.x, l.op, l.y)!;
        return { ...l, label: q.label, onPath: path.has(q.id) };
      });
      return { ...emptyCalc(), lines, slips: (draft as CalcValue | undefined)?.slips ?? 0 };
    }
    default: return answer;
  }
}

interface Props {
  assignment: ExerciseAssignmentWithExercise;
  exercise: ProblemExercise;
  onSolved: (stars: number) => void;
  /** The kid's rung on the reading ladder */
  reading?: ProblemReading;
  /** …and on the forgiveness ladder (shared/forgiveness.ts) */
  forgiveness?: Forgiveness;
}

export const ProblemPlayer: React.FC<Props> = ({ assignment, exercise, onSolved, reading = 'marked', forgiveness }) => {
  // The server's step, or ours if its STATE hasn't arrived yet
  const [localStep, setLocalStep] = useState(assignment.stepIndex ?? 0);
  const stepIndex = Math.min(Math.max(localStep, assignment.stepIndex ?? 0), exercise.steps.length - 1);
  const step = exercise.steps[stepIndex];

  const story = useMemo(() => parseStory(exercise.story), [exercise.story]);
  const marks = story.filter(p => 'mark' in p).length;
  const words = useMemo(() => storyWords(exercise.story), [exercise.story]);
  // The reading step: as marked phrases, or painted (its targets, or ones from the marks)
  const readIndex = exercise.steps.findIndex(isRead);
  const kind: Kind = isRead(step) ? (reading === 'marked' ? 'tag' : 'paint') : step.kind;
  const targets: PaintTarget[] = useMemo(() => {
    const r = exercise.steps.find(isRead);
    return r?.kind === 'paint' ? r.targets : targetsFromMarks(exercise.story);
  }, [exercise]);
  const unneeded = reading === 'paint-all';
  // The owl explains the step on screen, as she plays it on her rung
  const helpKind: ProblemHelpKind = kind === 'paint' && unneeded ? 'paint-all' : kind;
  const extras = story.flatMap(p => ('mark' in p && p.role === 'extra' ? [p.text] : []));

  // Drafts and wrong marks belong to the step they were made on: moving on leaves them behind.
  const [lastWrong, setLastWrong] = useState<{ step: number; parts?: number[]; tries: number; picked?: unknown } | null>(null);
  const wrong = lastWrong?.step === stepIndex ? lastWrong : null;
  const [draft, setDraft] = useState<Draft | null>(null);
  const typed = draft?.step === stepIndex ? draft.value : initialValue(kind, step, marks, words.length);
  const setValue = (v: unknown) => { setDraft({ step: stepIndex, value: v }); setLastWrong(null); setNote(null); };
  // Working it out: what the last calculation found, said in the hint slot
  const [note, setNoteState] = useState<{ step: number; note: CalcNote } | null>(null);
  const calcNote = note?.step === stepIndex ? note.note : null;
  const setNote = (n: CalcNote | null) => setNoteState(n ? { step: stepIndex, note: n } : null);
  // Wrong tries on this step: the server's (its reply first, the STATE after it), or the
  // calculations taken back on a calc step. They decide what the step shows, on her rung:
  // the hint, the wrong parts outlined, «Δείξε μου», or the step worked (shared/forgiveness.ts).
  const tries = step.kind === 'calc' ? (typed as CalcValue).slips
    : Math.max(assignment.mistakes?.[stepIndex] ?? 0, lastWrong?.step === stepIndex ? lastWrong.tries : 0);
  const ladder = stepHelp(forgiveness, stepCounts(step, reading), tries);
  const [showStep, setShowStep] = useState<number | null>(null);
  const shown = ladder.worked || showStep === stepIndex;
  const worked = useMemo(() => workedAnswer(exercise, stepIndex, reading), [exercise, stepIndex, reading]);
  const value = shown ? workedValue(kind, step, worked, words.length, typed) : typed;
  // Her wrong parts, once the rung outlines them (not over a step shown worked: red on the
  // right answer would say it is wrong; a choice outlines her wrong pick, another option)
  const outlined = ladder.outline && !shown ? wrong?.parts : undefined;
  const [brush, setBrush] = useState<Brush>('known');
  const [busy, setBusy] = useState(false);
  const [praise, setPraise] = useState(false);

  // Once the tag step is solved, the story keeps its colours for the steps after it.
  // …the unneeded ones greyed out: she sees what the story said that didn't matter
  const storyMode = kind === 'tag' ? 'tag' : kind === 'paint' ? 'paint' : readIndex >= 0 && stepIndex > readIndex ? 'tagged' : 'plain';
  // Right after reading, on the forgiving rungs, say which facts weren't needed
  const unneededNote = !unneeded && readIndex >= 0 && stepIndex === readIndex + 1 && extras.length > 0
    ? `${extras.length === 1 ? 'Δεν το χρειαζόμαστε' : 'Δεν τα χρειαζόμαστε'}: ${extras.map(e => `«${e}»`).join(', ')}.` : null;

  const submit = async () => {
    if (busy || (!shown && !isReady(kind, step, value))) return;
    let answer: unknown = answerOf(kind, value);
    // Shown worked: the step as it is solved, and on («Συνέχεια»)
    if (shown) answer = step.kind === 'calc' ? { ...(worked as object), slips: (typed as CalcValue).slips } : worked;
    else if (step.kind === 'calc') {
      // Each calculation is read back here; only the one that finds the answer goes to the server
      const read = readLine(step, value as CalcValue, usefulToAnswer(step));
      setDraft({ step: stepIndex, value: read.value });
      setNote(read.note);
      if (read.note.kind === 'math' || read.note.kind === 'nothing') { sfx('wrong'); return; }
      // Something found on the way to the answer is a small yes; a right sum that leads elsewhere, a nod
      if (read.note.kind === 'found') { sfx('correct', { volume: 0.7 }); return; }
      if (read.note.kind !== 'answer') { sfx('select'); return; }
      answer = answerOf(kind, read.value);
    }
    setBusy(true);
    try {
      const result = await api.answerExerciseAssignment(assignment.id, { step: stepIndex, value: answer });
      if (result.correct) {
        // The last step solves the whole problem: that's the big one
        sfx(result.assignment.status === 'completed' ? 'done' : 'correct');
        if (result.assignment.status === 'completed') {
          sfx('stars', { delay: 700 });
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
        sfx('wrong');
        setLastWrong({ step: stepIndex, parts: result.wrong, tries: result.assignment.mistakes?.[stepIndex] ?? tries + 1, picked: value });
        setBusy(false);
      }
    } catch (err) {
      console.error('Answer submission failed:', err);
      setBusy(false);
    }
  };

  const paint = (mark: number) => {
    const roles = value as ProblemRole[];
    sfx(roles[mark] === brush ? 'unselect' : 'paint');
    setValue(roles.map((role, i) => (i !== mark ? role : role === brush ? 'extra' : brush)));
  };

  return (
    <HelpScreen tour={problemTour(assignment.userId, helpKind)} inline>
    <div className="problem">
      <ol className="problem-phases" aria-label="Βήματα" {...help('problem.phases')}>
        {PHASES.map(p => (
          <li key={p.id} className={p.id === step.phase ? 'on' : ''}>
            <span aria-hidden>{p.icon}</span> {p.label}
          </li>
        ))}
        <li className="problem-count">Βήμα {stepIndex + 1} από {exercise.steps.length}</li>
      </ol>

      <StoryCard parts={story} mode={storyMode} override={step.story} roles={value as ProblemRole[]}
        wrong={kind === 'tag' ? outlined : undefined} disabled={busy || shown} onTap={paint}
        paint={kind === 'paint' ? {
          words, value: value as PaintValue, brush, onChange: setValue,
          ...paintMarks(targets, outlined, value as PaintValue),
        } : undefined} />

      <div className="problem-prompt" {...help('problem.prompt')}>{step.prompt}</div>

      <div className="problem-work">
        {(kind === 'tag' || kind === 'paint') && (
          <div className="tag-brushes" role="radiogroup" aria-label="Πινέλο" {...help('problem.brushes')}>
            {BRUSHES.filter(b => b.role !== 'extra' || (kind === 'paint' && unneeded)).map(b => (
              <button key={b.role} type="button" role="radio" aria-checked={brush === b.role}
                className={`tag-brush role-${b.role} ${brush === b.role ? 'on' : ''}`} {...sound('select')} onClick={() => setBrush(b.role)}
                {...(b.role === 'extra' ? help('problem.brush-extra') : {})}>
                {b.icon} {b.label}
              </button>
            ))}
            <span className="tag-legend">{kind === 'tag'
              ? 'Διάλεξε πινέλο και πάτα τις φράσεις της ιστορίας. Ό,τι δεν χρειάζεται, το αφήνεις άβαφο.'
              : unneeded
                ? 'Σύρε το δάχτυλο πάνω στις λέξεις. Βάψε και ό,τι δεν χρειάζεται, με το ⚪. Ξανά πάνω τους, και σβήνουν.'
                : 'Διάλεξε πινέλο και σύρε το δάχτυλο πάνω στις λέξεις. Ξανά πάνω τους, και σβήνουν.'}</span>
          </div>
        )}
        {step.kind === 'choice' && (
          <ChoiceStep options={step.options} value={value as number | null} setValue={setValue} disabled={busy || shown} seed={`${assignment.id}:${stepIndex}`}
            wrong={shown && typeof wrong?.picked === 'number' ? [wrong.picked] : undefined} />
        )}
        {step.kind === 'numbers' && (
          <NumbersStep key={stepIndex} rows={step.rows} value={value as string[]} setValue={setValue} wrong={outlined} disabled={busy || shown} />
        )}
        {step.kind === 'calc' && (
          <CalcBench step={step} value={value as CalcValue} setValue={setValue} disabled={busy || shown} note={calcNote?.kind} />
        )}
        {step.kind === 'order' && (
          <OrderStep key={stepIndex} items={step.items} value={value as string[]} setValue={setValue} wrong={outlined} disabled={busy || shown} />
        )}
      </div>

      <div {...help('problem.hint')} className={`problem-hint ${shown || wrong || (calcNote && calcNote.kind !== 'answer') || unneededNote ? 'on' : ''} ${!shown && ((calcNote && calcNote.kind === 'found') || (unneededNote && !wrong && !calcNote)) ? 'good' : ''}`} aria-live="polite">
        {shown && (
          <motion.span key={`${stepIndex}-shown`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            💡 <strong>Έτσι λύνεται.</strong> Κοίτα το καλά και πάτα «Συνέχεια».
          </motion.span>
        )}
        {!shown && wrong && (
          <motion.span key={`${stepIndex}-${lastWrong?.parts?.join()}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <strong>Όχι ακόμα. </strong>
            {kind === 'paint' && wrong.parts?.length ? paintFeedback(targets, words, wrong.parts, value as PaintValue) + ' '
              : step.hint ? <>💡 {step.hint}</> : 'Διάβασε ξανά την ιστορία και ξαναδοκίμασε.'}
            {kind === 'paint' && ladder.outline && ' Κοίτα τις λέξεις με το κίτρινο πλαίσιο.'}
          </motion.span>
        )}
        {!shown && !wrong && calcNote && calcNote.kind !== 'answer' && (
          <motion.span key={`${stepIndex}-${(value as CalcValue).lines.length}-${(value as CalcValue).slips}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {calcNote.text}
            {step.kind === 'calc' && calcNote.kind === 'nothing' && calcNudge(step, value as CalcValue) &&
              <> 💡 {calcNudge(step, value as CalcValue)}</>}
          </motion.span>
        )}
        {!shown && !wrong && !calcNote && unneededNote && (
          <motion.span key={`${stepIndex}-unneeded`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>⚪ {unneededNote}</motion.span>
        )}
      </div>
      <div className="problem-actions">
        {ladder.canShow && !shown && (
          <button type="button" className="problem-show" {...help('problem.show')} {...sound('open')} disabled={busy}
            onClick={() => { setShowStep(stepIndex); setNote(null); }}>💡 Δείξε μου</button>
        )}
        <button type="button" className="problem-check" {...help('problem.check')} disabled={busy || (!shown && !isReady(kind, step, value))} onClick={submit}>
          {shown ? 'Συνέχεια →' : 'Έλεγχος ✓'}
        </button>
      </div>

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
          .problem-actions { justify-self: end; }
          .problem-work > * { margin-block: auto; } /* centred while it fits, scrolls from the top when it doesn't */
        }
        .problem-phases { grid-area: phases; }
        .problem-story { grid-area: story; }
        .problem-prompt { grid-area: prompt; }
        .problem-work { grid-area: work; container-type: inline-size; }
        .problem-hint { grid-area: hint; }
        .problem-actions { grid-area: check; align-self: end; display: flex; gap: 0.7rem; justify-content: flex-end; flex-wrap: wrap; }
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
        .problem-show { font-size: 1.2rem; font-weight: bold; padding: 0.9rem 1.4rem; border-radius: 1.2rem; cursor: pointer; white-space: nowrap;
          color: white; background: rgba(255,200,0,0.18); border: 2px solid rgba(255,200,0,0.6); }
        .problem-praise { position: fixed; inset: 0; margin: auto; width: fit-content; height: fit-content; padding: 1.5rem 3rem; border-radius: 1.5rem;
          background: rgba(46,213,115,0.95); font-size: 2.2rem; font-weight: bold; z-index: calc(var(--z-player) + 10); pointer-events: none; }
        .is-wrong { outline: 3px solid #ff4757 !important; outline-offset: 2px; }
        .role-known { background: rgba(46,213,115,0.3); box-shadow: inset 0 -3px 0 #2ed573; }
        .role-sought { background: rgba(255,200,0,0.28); box-shadow: inset 0 -3px 0 #ffc800; }
        .role-extra { color: rgba(255,255,255,0.45); text-decoration: line-through; text-decoration-color: rgba(255,255,255,0.5); }
        .tag-brush.role-extra { color: white; text-decoration: none; background: rgba(255,255,255,0.12); }
        .tag-brushes { display: flex; gap: 0.7rem; align-items: center; justify-content: center; flex-wrap: wrap; }
        .tag-brush { font-size: 1.2rem; padding: 0.6rem 1.2rem; border-radius: 1rem; border: 2px solid transparent; color: white; cursor: pointer; opacity: 0.6; }
        .tag-brush.on { opacity: 1; border-color: white; font-weight: bold; }
        .tag-legend { flex-basis: 100%; text-align: center; opacity: 0.7; font-size: 1rem; }
      `}</style>
    </div>
    </HelpScreen>
  );
};

// The story, always the same size: the full story sits in the same cell (invisible
// when a step shows a shorter version), and the phrases keep one shape in every mode,
// only their colours change.
// After the second wrong painting (when the rung outlines): the unneeded facts she painted as
// needed in red, the ones she missed in a dashed frame (on "paint-all", an unneeded one left
// unpainted too).
function paintMarks(targets: PaintTarget[], wrong: number[] | undefined, painted: PaintValue) {
  const wrongWords = new Set<number>(), revealWords = new Set<number>();
  targets.forEach((t, i) => {
    if (!wrong?.includes(i)) return;
    const asNeeded = t.role === 'extra' && t.words.some(w => painted[w] === 'known' || painted[w] === 'sought');
    const into = asNeeded ? wrongWords : revealWords;
    t.words.forEach(w => into.add(w));
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
      const role = mode === 'tagged' ? `role-${p.role}` : '';
      return <span key={i} className={`story-phrase ${role}`}>{p.text}</span>;
    }
    const role = roles[p.mark];
    // An inline span, not a <button> (an inline-block), so the lines wrap as in the other modes
    const tap = () => { if (!disabled) onTap(p.mark); };
    return (
      <span key={i} role="button" tabIndex={0} aria-disabled={disabled} {...sound('none')} onClick={tap}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(); } }}
        {...help('problem.phrase')} className={`story-phrase tappable ${role !== 'extra' ? `role-${role}` : ''} ${wrong?.includes(p.mark) ? 'is-wrong' : ''}`}>
        {p.text}
      </span>
    );
  });
  return (
    <div className="problem-story" {...help('problem.story')}>
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

// Tap to pick, "Έλεγχος" to answer. The options in an order fixed by the assignment and
// step, so they stay put after a wrong try, a reload or on a second device; the answer is
// still the option's own index.
const ChoiceStep: React.FC<StepProps<number | null> & { options: string[]; seed: string }> = ({ options, value, setValue, disabled, wrong, seed }) => {
  const order = useSeededOrder(options.length, seed);
  return (
  <div className="choice-list" {...help('problem.choices')}>
    {order.map((i, place) => (
      <motion.button key={i} type="button" className={`choice-btn ${value === i ? 'picked' : ''} ${wrong?.includes(i) ? 'is-wrong' : ''}`} disabled={disabled}
        aria-pressed={value === i} whileTap={!disabled ? { scale: 0.98 } : {}} {...sound('select')} onClick={() => setValue(i)}>
        <span className="choice-letter">{optionLetter(place)}</span>{options[i]}
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
};

// C (empty this box) comes last: under ⌫, so the digits and ↵ stay where they were
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '↵', 'C'];

// One box per row and one keypad; the keypad types into the selected box, ↵ moves to the next
// (answerFields.ts says where each input goes).
const NumbersStep: React.FC<StepProps<string[]> & { rows: { label: string; unit?: string }[] }> = ({ rows, value, setValue, wrong, disabled }) => {
  const [active, setActive] = useState(0);
  const boxes = useRef<(HTMLButtonElement | null)[]>([]);
  const input = (i: NumbersInput) => {
    if (disabled) return;
    const e = numbersInput(value, active, i);
    sfx(e.sound);
    if (e.refused !== undefined) { wiggle(boxes.current[e.refused]); return; }
    setActive(e.focus);
    if (e.value !== value) setValue(e.value);
  };
  // Long labels ("Όλες οι ημέρες: 24 + 48 + 33 + 105 =") need the width: keypad under the rows
  const stacked = rows.some(row => row.label.length > 22);
  return (
    <div className={`numbers-step ${stacked ? 'stacked' : ''}`}>
      <div className="numbers-rows" {...help('problem.numbers')}>
        {rows.map((row, i) => (
          <div key={i} className="numbers-row">
            <span className="numbers-label">{row.label}</span>
            <button type="button" ref={el => { boxes.current[i] = el; }} disabled={disabled}
              className={`numbers-box answer-box ${active === i ? 'focused' : ''} ${wrong?.includes(i) ? 'is-wrong' : ''}`}
              aria-pressed={active === i} {...sound('none')} onClick={() => input({ kind: 'tap', box: i })} aria-label={`${row.label} ${value[i]}`}>
              {value[i] ? Number(value[i]).toLocaleString('el-GR') : ' '}
            </button>
            <span className="numbers-unit">{row.unit}</span>
          </div>
        ))}
      </div>
      <div className="numbers-pad" {...help('problem.keypad')}>
        {KEYS.map(k => (
          <motion.button key={k} type="button" className={`numbers-key answer-key ${k === 'C' ? 'clear' : ''}`} disabled={disabled} whileTap={!disabled ? { scale: 0.92 } : {}}
            {...sound('none')} onClick={() => input({ kind: 'key', key: k })}>{k}</motion.button>
        ))}
      </div>
      <style>{`
        .numbers-step { display: grid; grid-template-columns: 1fr; gap: 1rem; align-items: center; }
        @container (min-width: 560px) {
          .numbers-step:not(.stacked) { grid-template-columns: 1fr 15rem; }
          .numbers-step:not(.stacked) .numbers-pad { grid-template-columns: repeat(3, 1fr); }
          .numbers-step:not(.stacked) .numbers-key.clear { grid-column: 1; }
        }
        .numbers-step.stacked .numbers-key { padding: 0.45rem 0; }
        .numbers-rows { display: flex; flex-direction: column; gap: 0.5rem; }
        .numbers-row { display: flex; align-items: center; gap: 0.8rem; font-size: 1.2rem; justify-content: flex-end; }
        .numbers-label { flex: 1; text-align: right; }
        .numbers-box { min-width: 6.5rem; min-height: 2.9rem; font-size: 1.45rem; font-weight: bold; color: white; border-radius: 0.8rem;
          background: rgba(0,0,0,0.3); border: 2px solid rgba(255,255,255,0.25); cursor: pointer; }
        .numbers-unit { min-width: 5rem; opacity: 0.8; }
        .numbers-pad { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.45rem; }
        .numbers-key { font-size: 1.45rem; padding: 0.55rem 0; border-radius: 0.8rem; border: none; color: white; background: rgba(255,255,255,0.12); cursor: pointer; }
        .numbers-key.clear { grid-column: 4; } /* under ⌫ */
        @container (max-width: 420px) { .numbers-pad { grid-template-columns: repeat(3, 1fr); } .numbers-key.clear { grid-column: 1; } .numbers-row { flex-wrap: wrap; } }
        ${ANSWER_BOX_CSS}
      `}</style>
    </div>
  );
};

// Tap the items in order; tap a numbered one to take it (and the ones after it) back.
const OrderStep: React.FC<StepProps<string[]> & { items: string[] }> = ({ items, value, setValue, wrong, disabled }) => {
  // Drawn once for these items: a STATE brings the same step again as a new array
  const shuffled = useShuffled(items, items.join('\n'), shuffle);
  const tap = (item: string) => {
    const at = value.indexOf(item);
    setValue(at >= 0 ? value.slice(0, at) : [...value, item]);
  };
  return (
    <div className="order-step" {...help('problem.order')}>
      {shuffled.map(item => {
        const at = value.indexOf(item);
        return (
          <button key={item} type="button" disabled={disabled} {...sound(at >= 0 ? 'unselect' : 'place')} onClick={() => tap(item)}
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

function shuffle<T>(xs: readonly T[]): T[] {
  const out = draw(xs);
  // Never start in the right order: that would give the answer away
  return out.every((x, i) => x === xs[i]) && out.length > 1 ? [...out.slice(1), out[0]] : out;
}
