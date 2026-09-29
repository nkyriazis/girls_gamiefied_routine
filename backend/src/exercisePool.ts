import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import { Exercise, SchoolGrade } from '../../shared/types';
import { config } from './config';
import { EXERCISE_POOLS_DIR } from './paths';
import { check, exercisePoolSchema } from './schemas';

// ============================================================================
// Daily Exercise Pool
//
// The exercises kids are assigned each day. They ship with the app as JSON
// files in backend/exercise-pools/ (validated by exercise-pool.schema.json);
// each file lists the school grades it serves, and a kid draws from every file
// that lists their grade (ConfigUser.grade in data.json). The files are part of
// the image, not of the data volume: new content arrives with an update.
// ============================================================================

export interface ExercisePoolProvider {
  /** Full pool of exercises a given user may be assigned. */
  getPoolForUser(userId: string): Promise<Exercise[]>;
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
  grades: SchoolGrade[];
  exercises: Exercise[];
}

/** Read and validate every pool file. Throws on an invalid file or a duplicate id. */
export function loadPools(dir = EXERCISE_POOLS_DIR): ExercisePool[] {
  const files = readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  const seen = new Map<string, string>();
  return files.map(file => {
    const pool = JSON.parse(readFileSync(path.join(dir, file), 'utf-8'));
    const error = check(exercisePoolSchema, pool, `Invalid exercise pool ${file}`);
    if (error) throw new Error(`${error.message}: ${JSON.stringify(error.errors)}`);
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

  async getPoolForUser(userId: string): Promise<Exercise[]> {
    const grade = config().users.find(u => u.id === userId)?.grade;
    if (!grade) return [];
    return this.all().filter(p => p.grades.includes(grade)).flatMap(p => p.exercises);
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
