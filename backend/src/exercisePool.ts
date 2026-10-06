import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import { Exercise, SchoolGrade } from '../../shared/types';
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
// (or that runs out within the day) passes its slot to the next one in the mix, so
// a kid with no problems gets maths, language, maths. Categories outside the mix
// come after it.
// ----------------------------------------------------------------------------

export const DAILY_MIX = ['Προβλήματα', 'Μαθηματικά', 'Γλώσσα'] as const;

/** The categories these exercises have, in mix order (DAILY_MIX first, then the rest by name). */
export function mixOrder(exercises: Exercise[]): string[] {
  const present = new Set(exercises.map(e => e.category));
  const mix: readonly string[] = DAILY_MIX;
  return [...mix.filter(c => present.has(c)), ...[...present].filter(c => !mix.includes(c)).sort()];
}

/** How many of a day's `count` slots each category gets, when none runs out. */
export function mixSlots(exercises: Exercise[], count: number): Map<string, number> {
  const order = mixOrder(exercises);
  const slots = new Map<string, number>();
  for (let i = 0; i < count && order.length; i++) slots.set(order[i % order.length], (slots.get(order[i % order.length]) ?? 0) + 1);
  return slots;
}

/** Never-seen exercises first, in random order; then the ones seen longest ago. Returned so that pop() takes the freshest. */
export function freshLast(list: Exercise[], seen: Map<string, string>): Exercise[] {
  const unseen = list.filter(e => !seen.has(e.id)).sort(() => Math.random() - 0.5);
  const old = list.filter(e => seen.has(e.id)).sort((a, b) => seen.get(a.id)!.localeCompare(seen.get(b.id)!));
  return [...unseen, ...old].reverse();
}

/** A day's set of `count`, in mix order; `seen` is when she last had each exercise. Says which came from revision. */
export function drawDailySet(pools: UserPools, count: number, seen: Map<string, string>): { drawn: Exercise[]; revision: string[] } {
  const buckets = mixOrder([...pools.own, ...pools.revision]).map(category => {
    const own = pools.own.filter(e => e.category === category);
    const from = own.length ? own : pools.revision.filter(e => e.category === category);
    return { items: freshLast(from, seen), revision: !own.length };
  });
  const drawn: Exercise[] = [];
  const revision: string[] = [];
  // k turns through the mix; a slot whose category is empty goes to the next one
  for (let k = 0; drawn.length < count && buckets.some(b => b.items.length); k++) {
    const bucket = buckets[k % buckets.length];
    const ex = bucket.items.pop();
    if (!ex) continue;
    drawn.push(ex);
    if (bucket.revision) revision.push(ex.id);
  }
  return { drawn, revision };
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
