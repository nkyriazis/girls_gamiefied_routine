import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import { ConfigUser, Exercise, SchoolGrade } from '../../shared/types';
import { chaptersAhead, hasCurriculum, positionOf, Subject, subjectOf, SUBJECTS } from '../../shared/curriculum';
import { pathToAnswer, storyWords } from '../../shared/problems';
import { config } from './config';
import { EXERCISE_POOLS_DIR } from './paths';
import { check, exercisePoolSchema } from './schemas';

// ============================================================================
// Daily Exercise Pool
//
// The exercises kids are assigned each day. They ship with the app as JSON
// files in backend/exercise-pools/ (validated by exercise-pool.schema.json).
// A file's `grades` are the school grades it is written for; its optional
// `revision` grades get it only for a category their own grade has nothing in
// (ConfigUser.grade in data.json picks the kid's grade). The files are part of
// the image, not of the data volume: new content arrives with an update.
// ============================================================================

/** What a kid may be assigned: the exercises written for her grade, and those it gets as revision. */
export interface UserPools {
  own: Exercise[];
  revision: Exercise[];
}

export interface ExercisePoolProvider {
  /** The exercises a given user may be assigned, her grade's own and its revision. */
  getPoolsForUser(userId: string): Promise<UserPools>;
  /** Resolve a pool exercise by id (across all users). */
  getExerciseById(exerciseId: string): Promise<Exercise | undefined>;
}

// How many exercises each child gets per day unless settings.exercisesPerDay says otherwise.
export const DEFAULT_EXERCISES_PER_DAY = 3;

export function exercisesPerDay(): number {
  return config().settings?.exercisesPerDay ?? DEFAULT_EXERCISES_PER_DAY;
}

export interface ExercisePool {
  file: string;
  description?: string;
  grades: SchoolGrade[];     // written for
  revision?: SchoolGrade[];  // served as revision, for a category these grades have nothing in
  exercises: Exercise[];
}

/** A grade's pools, from all of them: the ones written for it, and the ones it gets as revision. */
export function poolsForGrade(pools: ExercisePool[], grade: SchoolGrade | undefined): UserPools {
  if (!grade) return { own: [], revision: [] };
  return {
    own: pools.filter(p => p.grades.includes(grade)).flatMap(p => p.exercises),
    revision: pools.filter(p => p.revision?.includes(grade)).flatMap(p => p.exercises),
  };
}

// ----------------------------------------------------------------------------
// The daily set (#49). Slot by slot it follows DAILY_MIX: a problem, then maths,
// then language, and round again when exercisesPerDay is more than 3. Each slot
// takes the freshest item of its category: from the kid's own grade, or, when her
// grade has nothing in that category, from revision. A category she has nothing in
// (or that runs out within the day) passes its slot to the next one in the mix.
// Categories outside the mix come after it.
//
// A kid with problems starts every day with the problem. A kid without them goes
// round the categories she has, starting one further each day (`turn`, how many
// daily sets she has had), so a Δ΄ kid at 3 a day gets maths, language, maths one
// day and language, maths, language the next, not two maths always.
// ----------------------------------------------------------------------------

export const DAILY_MIX = ['Προβλήματα', 'Μαθηματικά', 'Γλώσσα'] as const;

/** The categories these exercises have, in mix order (DAILY_MIX first, then the rest by name). */
export function mixOrder(exercises: Exercise[]): string[] {
  const present = new Set(exercises.map(e => e.category));
  const mix: readonly string[] = DAILY_MIX;
  return [...mix.filter(c => present.has(c)), ...[...present].filter(c => !mix.includes(c)).sort()];
}

/** Where the day's round starts: at the problem if she has any, else one category further each daily set. */
export function mixStart(order: string[], turn: number): number {
  return order[0] === DAILY_MIX[0] || !order.length ? 0 : turn % order.length;
}

/** How many of a day's `count` slots each category gets on average, when none runs out (over the days `turn` goes round). */
export function mixSlots(exercises: Exercise[], count: number): Map<string, number> {
  const order = mixOrder(exercises);
  const turns = mixStart(order, 1) ? order.length : 1;
  const slots = new Map<string, number>();
  for (let turn = 0; turn < turns; turn++) {
    const start = mixStart(order, turn);
    for (let i = 0; i < count && order.length; i++) {
      const c = order[(start + i) % order.length];
      slots.set(c, (slots.get(c) ?? 0) + 1 / turns);
    }
  }
  return slots;
}

/** Never-seen exercises first, in random order; then the ones seen longest ago. Returned so that pop() takes the freshest. */
export function freshLast(list: Exercise[], seen: Map<string, string>): Exercise[] {
  const unseen = list.filter(e => !seen.has(e.id)).sort(() => Math.random() - 0.5);
  const old = list.filter(e => seen.has(e.id)).sort((a, b) => seen.get(a.id)!.localeCompare(seen.get(b.id)!));
  return [...unseen, ...old].reverse();
}

// ----------------------------------------------------------------------------
// What her class has reached, at her difficulty (#71). An item names its chapter or
// lesson (Exercise.chapter) and a difficulty, 1 to 3; the kid's gate says how many
// chapters past her class each one is (0: reached; from ConfigUser.progress, or the
// book's pace for today, shared/curriculum.ts) and the hardest she gets. Within a
// category the draw takes, best first:
//   1. reached, at her difficulty or easier, not had in the last NO_REPEAT_DAYS;
//   2. reached, one level harder, not had in that time;
//   3. reached, at most one level harder, the one she had longest ago (a repeat
//      beats a chapter her class hasn't reached);
//   4. reached, harder still, longest ago;
//   5. only when nothing of the category is reached: the nearest chapters past her place.
// Items with no chapter or difficulty (the revision pools) are reached and easy. The
// revision pools come in, as before, only for a category her grade has nothing in.
// ----------------------------------------------------------------------------

/** How long an item stays «had» for the draw's first two tiers. */
export const NO_REPEAT_DAYS = 30;

export interface DrawGate {
  /** How many chapters past her class an item is: 0 when reached. */
  ahead(e: Exercise): number;
  /** The hardest she gets while there is enough; 3 is all. */
  difficulty: 1 | 2 | 3;
}

/** No gate: everything reached, every difficulty (a grade with no books in shared/curriculum.ts). */
export const OPEN: DrawGate = { ahead: () => 0, difficulty: 3 };

/** Why an item was drawn past the first tier, for the log: «harder», «repeat», «ahead». */
export type Fallback = 'harder' | 'repeat' | 'ahead';

/** The tier an item falls in (0 best), given whether anything of its category is reached at all. */
function tier(e: Exercise, gate: DrawGate, seen: Map<string, string>, since: string, anyReached: boolean): number | undefined {
  const ahead = gate.ahead(e);
  if (ahead > 0) return anyReached ? undefined : 10 + ahead;
  const fresh = (seen.get(e.id) ?? '') < since;
  const level = e.difficulty ?? 1;
  if (level <= gate.difficulty) return fresh ? 0 : 2;
  if (level === gate.difficulty + 1) return fresh ? 1 : 2;
  return 3;
}

export const fallbackOf = (t: number): Fallback | undefined => (t === 0 ? undefined : t === 2 ? 'repeat' : t < 10 ? 'harder' : 'ahead');

/**
 * A kid's gate on `date` (YYYY-MM-DD, in settings.timezone): per book, her place (her progress if it is one
 * of the book's, else the pace's, then listed in `pace`), and her difficulty. A grade with no books in
 * shared/curriculum.ts has everything reached.
 */
export function drawGate(user: ConfigUser, date: string): { gate: DrawGate; progress?: Record<Subject, string>; pace?: Subject[] } {
  const difficulty = user.difficulty ?? 3;
  if (!hasCurriculum(user.grade)) return { gate: { ...OPEN, difficulty } };
  const grade = user.grade;
  const at = Object.fromEntries(SUBJECTS.map(s => [s, positionOf(grade, s, user.progress?.[s], date)])) as Record<Subject, { id: string; pace: boolean }>;
  const ahead = Object.fromEntries(SUBJECTS.map(s => [s, chaptersAhead(grade, s, at[s].id, date)])) as Record<Subject, (chapter?: string) => number>;
  return {
    gate: { ahead: e => ahead[subjectOf(e.category)](e.chapter), difficulty },
    progress: Object.fromEntries(SUBJECTS.map(s => [s, at[s].id])) as Record<Subject, string>,
    pace: SUBJECTS.filter(s => at[s].pace),
  };
}

/**
 * `list` in the order the draw takes it, as pop() would (the best last), each with its tier: by tier, then
 * freshest first (never seen at random, then seen longest ago). Items past her class are left out while any is reached.
 */
export function gateOrder(list: Exercise[], gate: DrawGate, seen: Map<string, string>, now = new Date()): { ex: Exercise; tier: number }[] {
  const since = new Date(now.getTime() - NO_REPEAT_DAYS * 86400_000).toISOString();
  const anyReached = list.some(e => gate.ahead(e) === 0);
  const tiers = new Map<number, Exercise[]>();
  for (const e of list) {
    const t = tier(e, gate, seen, since, anyReached);
    if (t !== undefined) tiers.set(t, [...(tiers.get(t) ?? []), e]);
  }
  // the nearest chapters past her place only: «ahead» keeps the smallest distance
  const ahead = [...tiers.keys()].filter(t => t >= 10).sort((a, b) => a - b).slice(1);
  for (const t of ahead) tiers.delete(t);
  return [...tiers.keys()].sort((a, b) => b - a).flatMap(t => freshLast(tiers.get(t)!, seen).map(ex => ({ ex, tier: t })));
}

/**
 * A day's set of `count`, in mix order; `seen` is when she last had each exercise, `turn` how many daily
 * sets she has had (where the round starts for a kid with no problems), `gate` what her class has reached
 * at her difficulty. Says which came from revision, and which past the first tier and why.
 */
export function drawDailySet(pools: UserPools, count: number, seen: Map<string, string>, turn = 0, gate: DrawGate = OPEN, now = new Date()):
  { drawn: Exercise[]; revision: string[]; fallback: Record<string, Fallback> } {
  const order = mixOrder([...pools.own, ...pools.revision]);
  const buckets = order.map(category => {
    const own = pools.own.filter(e => e.category === category);
    const from = own.length ? own : pools.revision.filter(e => e.category === category);
    return { items: gateOrder(from, gate, seen, now), revision: !own.length };
  });
  const drawn: Exercise[] = [];
  const revision: string[] = [];
  const fallback: Record<string, Fallback> = {};
  // k turns through the mix; a slot whose category is empty goes to the next one
  for (let k = mixStart(order, turn); drawn.length < count && buckets.some(b => b.items.length); k++) {
    const bucket = buckets[k % buckets.length];
    const next = bucket.items.pop();
    if (!next) continue;
    drawn.push(next.ex);
    if (bucket.revision) revision.push(next.ex.id);
    const why = fallbackOf(next.tier);
    if (why) fallback[next.ex.id] = why;
  }
  return { drawn, revision, fallback };
}

/** Read and validate every pool file. Throws on an invalid file or a duplicate id. */
export function loadPools(dir = EXERCISE_POOLS_DIR): ExercisePool[] {
  const files = readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  const seen = new Map<string, string>();
  return files.map(file => {
    const pool = JSON.parse(readFileSync(path.join(dir, file), 'utf-8'));
    const error = check(exercisePoolSchema, pool, `Invalid exercise pool ${file}`);
    if (error) throw new Error(`${error.message}: ${JSON.stringify(error.errors)}`);
    const both = (pool.revision as SchoolGrade[] | undefined)?.find(g => pool.grades.includes(g));
    if (both) throw new Error(`${file}: grade ${both} is listed both as written for and as revision`);
    for (const ex of pool.exercises as Exercise[]) {
      const problem = validateExercise(ex);
      if (problem) throw new Error(`${file}: ${ex.id}: ${problem}`);
      if (seen.has(ex.id)) throw new Error(`${file}: duplicate exercise id ${ex.id} (also in ${seen.get(ex.id)})`);
      seen.set(ex.id, file);
    }
    return { file, ...pool };
  });
}

// What the schema can't say: indexes in range, and problem stories that match their steps.
export function validateExercise(ex: Exercise): string | null {
  if (ex.type === 'multiple-choice' && ex.correctIndex >= ex.options.length) return 'correctIndex out of range';
  if (ex.type !== 'problem') return null;
  const marked = storyMarks(ex.story);
  for (const [i, step] of ex.steps.entries()) {
    if (step.kind === 'choice' && step.correctIndex >= step.options.length) return `step ${i}: correctIndex out of range`;
    if (step.kind === 'tag') {
      if (!marked.some(m => m.role === 'known') || !marked.some(m => m.role === 'sought'))
        return `step ${i}: the story needs at least one [..|known] and one [..|sought] phrase`;
    }
    if (step.kind === 'paint') {
      const words = storyWords(ex.story).length;
      if (step.targets.length !== marked.length || step.targets.some((t, j) => t.role !== marked[j].role))
        return `step ${i}: paint targets don't match the story's marks`;
      if (step.targets.some(t => t.span[0] > t.span[1] || t.span[1] >= words || t.words.some(w => w < t.span[0] || w > t.span[1])))
        return `step ${i}: paint target words out of range`;
      if (!step.targets.some(t => t.role === 'sought')) return `step ${i}: nothing to paint as sought`;
    }
    if (step.kind === 'calc') {
      const ids = new Set(step.quantities.map(q => q.id));
      const refs = [...step.given, step.sought, ...step.relations.flatMap(r => [r.out, r.a, r.b])];
      if (refs.some(id => !ids.has(id))) return `step ${i}: calc refers to a quantity it doesn't have`;
      if (!pathToAnswer(step).has(step.sought)) return `step ${i}: the answer can't be worked out from what the story gives`;
    }
  }
  return null;
}

/** The marked phrases of a problem story, in order: "[25 ευρώ|known]" → { text: "25 ευρώ", role: "known" }. */
export function storyMarks(story: string): { text: string; role: 'known' | 'sought' | 'extra' }[] {
  return [...story.matchAll(/\[([^\]|]+)\|(known|sought|extra)\]/g)].map(m => ({ text: m[1], role: m[2] as 'known' | 'sought' | 'extra' }));
}

class FilePoolProvider implements ExercisePoolProvider {
  private pools: ExercisePool[] | null = null;

  private all(): ExercisePool[] {
    return (this.pools ??= loadPools());
  }

  async getPoolsForUser(userId: string): Promise<UserPools> {
    return poolsForGrade(this.all(), config().users.find(u => u.id === userId)?.grade);
  }

  async getExerciseById(exerciseId: string): Promise<Exercise | undefined> {
    for (const pool of this.all()) {
      const found = pool.exercises.find(e => e.id === exerciseId);
      if (found) return found;
    }
    return undefined;
  }
}

// The active provider. Swap this instance to change where exercises come from.
export const exercisePoolProvider: ExercisePoolProvider = new FilePoolProvider();
