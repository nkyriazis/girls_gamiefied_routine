import type { ProblemCalcStep } from '@shared/types';
import { applyOp, nextCalculation, readCalculation, type CalcLine, type CalcOp, type PaintTarget } from '@shared/problems';

// What the free steps of a problem say back to her (ProblemFreeSteps.tsx draws them).

export type Brush = 'known' | 'sought' | 'extra';
/** One brush (or none) per word of the story. */
export type PaintValue = (Brush | null)[];

/** What to say after a wrong painting: which kind of mistake, in her words. */
export function paintFeedback(targets: PaintTarget[], words: string[], wrong: number[], painted: PaintValue): string {
  const say: string[] = [];
  const knowns = targets.filter(t => t.role === 'known');
  const missed = targets.filter((t, i) => t.role === 'known' && wrong.includes(i)).length;
  const phrase = (t: PaintTarget) => words.slice(t.span[0], t.span[1] + 1).join(' ').replace(/[.,;]$/, '');
  const extras = targets.filter((t, i) => t.role === 'extra' && wrong.includes(i));
  const asNeeded = (t: PaintTarget) => t.words.some(w => painted[w] === 'known' || painted[w] === 'sought');
  if (targets.some((t, i) => t.role === 'sought' && wrong.includes(i))) say.push('Ποια είναι η ερώτηση; Βάψ’ τη με το 🟡.');
  if (missed) say.push(`Βρήκες ${knowns.length - missed} από τα ${knowns.length} που χρειαζόμαστε.`);
  for (const t of extras.filter(asNeeded)) say.push(`Το «${phrase(t)}» δεν το χρειαζόμαστε.`);
  // "paint-all": an unneeded fact left unpainted (without saying which)
  const left = extras.filter(t => !asNeeded(t)).length;
  if (left) say.push(left === 1 ? 'Κάτι που δεν χρειαζόμαστε έμεινε άβαφο: βάψ’ το με το ⚪.' : `${left} πράγματα που δεν χρειαζόμαστε έμειναν άβαφα: βάψ’ τα με το ⚪.`);
  if (wrong.includes(-1)) say.push('Έβαψες πολλά: βάψε μόνο ό,τι χρειάζεται.');
  return say.join(' ');
}

export interface CalcValue {
  lines: (CalcLine & { label: string; onPath: boolean })[];
  slips: number;
  x: number | null;
  op: CalcOp | null;
  y: number | null;
  result: string;
}
export const emptyCalc = (): CalcValue => ({ lines: [], slips: 0, x: null, op: null, y: null, result: '' });

export type CalcNote = { kind: 'math' | 'nothing' | 'found' | 'off-path' | 'answer'; text: string };

export const lower = (s: string) => s[0].toLowerCase() + s.slice(1);
export const fmt = (n: number) => n.toLocaleString('el-GR');

/** Read the calculation she built: a mistake, nothing, or what it found. */
export function readLine(step: ProblemCalcStep, v: CalcValue, path: Set<string>): { note: CalcNote; value: CalcValue } {
  const { x, op, y } = v;
  const result = Number(v.result);
  if (x === null || op === null || y === null) return { note: { kind: 'nothing', text: '' }, value: v };
  if (applyOp(op, x, y) !== result) {
    return { note: { kind: 'math', text: `Ξαναμέτρα: ${fmt(x)} ${op} ${fmt(y)} δεν κάνει ${fmt(result)}.` }, value: { ...v, slips: v.slips + 1 } };
  }
  const q = readCalculation(step, x, op, y);
  if (!q) {
    return {
      note: { kind: 'nothing', text: `Σωστός λογαριασμός, αλλά στην ιστορία δεν σημαίνει κάτι. Ποιοι αριθμοί πάνε μαζί;` },
      value: { ...v, slips: v.slips + 1 },
    };
  }
  const line = { x, op, y, result, label: q.label, onPath: path.has(q.id) };
  const value = { ...v, lines: [...v.lines, line], x: null, op: null, y: null, result: '' };
  if (q.id === step.sought) return { note: { kind: 'answer', text: `Αυτό ψάχναμε: ${lower(q.label)}!` }, value };
  if (!line.onPath) {
    return { note: { kind: 'off-path', text: `Σωστά, βρήκες: ${lower(q.label)}. Εμείς όμως ψάχνουμε κάτι άλλο: ξαναδιάβασε την ερώτηση.` }, value };
  }
  return { note: { kind: 'found', text: `✔ Βρήκες: ${lower(q.label)}. Συνέχισε!` }, value };
}

/** After a few slips, when the last calculation meant nothing, say which one to try (not its result). */
export function calcNudge(step: ProblemCalcStep, v: CalcValue): string | null {
  if (v.slips < 3) return null;
  const have = new Set([...step.given.map(id => step.quantities.find(q => q.id === id)!.value), ...v.lines.map(l => l.result)]);
  const next = nextCalculation(step, have);
  return next ? `Δοκίμασε: ${fmt(next.x)} ${next.op} ${fmt(next.y)}` : null;
}

