import { readFileSync, renameSync, unwatchFile, watchFile, writeFileSync } from 'fs';
import path from 'path';
import { Chore, Exercise, ExerciseCategoryDef, Flow, IconValue, Reward } from '../../shared/types';
import { DATA_FILE, EXERCISES_FILE } from './paths';
import { check, dataSchema, exercisesSchema, ValidationError } from './schemas';

// ============================================================================
// Config (data.json + exercises.json), cached in memory.
//
// Files are read at startup, after an edit through the admin API/MCP, and when
// they change on disk — never per request. An invalid file on disk never
// replaces the cached config: the last valid version stays live and the error
// is reported, so a bad edit can't take the app (or its state) down.
// ============================================================================

export interface ConfigUser {
  id: string;
  name: string;
  avatar: IconValue;
  color: string;
}

export interface ConfigTask {
  id: string;
  title: string;
  icon: IconValue;
  stars: number;
  lateStars?: number;
}

export interface ConfigRoutine {
  id: string;
  title: string;
  themeColor: string;
  icon: IconValue;
}

export interface RoutineTask {
  id: string;
  routineId: string;
  taskId: string;
  order: number;
  durationSeconds: number;
}

export interface RoutineAssignment {
  id: string;
  userId: string;
  routineId: string;
  themeColor?: string;
}

export interface Schedule {
  id: string;
  cron: string;
  type: 'routine' | 'flow';
  targetId: string;
}

/** data.json, as described by data.schema.json. */
export interface DataConfig {
  users: ConfigUser[];
  tasks: ConfigTask[];
  routines: ConfigRoutine[];
  routineTasks: RoutineTask[];
  routineAssignments: RoutineAssignment[];
  flows: Flow[];
  schedules: Schedule[];
  rewards: Reward[];
  chores?: Chore[];
  settings: { timezone: string };
}

/** exercises.json, as described by exercises.schema.json. */
export interface ExercisesConfig {
  categories?: ExerciseCategoryDef[];
  exercises: Exercise[];
}

const EMPTY_DATA: DataConfig = {
  users: [], tasks: [], routines: [], routineTasks: [], routineAssignments: [],
  flows: [], schedules: [], rewards: [], chores: [], settings: { timezone: 'Europe/Athens' }
};
const EMPTY_EXERCISES: ExercisesConfig = { categories: [], exercises: [] };

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

/**
 * One cached, validated JSON config file. The cached value is deep-frozen:
 * callers that want to edit it take a copy via `raw()` and `save()` it.
 */
export class ConfigFile<T> {
  private value: T;
  private text: string | null = null;
  error: ValidationError | null = null;

  constructor(
    readonly file: string,
    private readonly schema: typeof dataSchema,
    private readonly fallback: T,
    private readonly optional: boolean
  ) {
    this.value = deepFreeze(structuredClone(fallback));
  }

  get(): T {
    return this.value;
  }

  /** A mutable deep copy of the cached value. */
  raw(): T {
    return structuredClone(this.value);
  }

  /**
   * Re-read the file. Returns 'unchanged', 'updated', or 'invalid' (the
   * cached value is kept and `error` explains why).
   */
  reload(): 'unchanged' | 'updated' | 'invalid' {
    let text: string;
    try {
      text = readFileSync(this.file, 'utf-8');
    } catch (err) {
      if (this.optional && (err as NodeJS.ErrnoException).code === 'ENOENT') {
        text = JSON.stringify(this.fallback);
      } else {
        this.error = { message: `Cannot read ${path.basename(this.file)}: ${(err as Error).message}`, errors: [] };
        return 'invalid';
      }
    }
    if (text === this.text) {
      // Back to the live version after a broken edit: the error is resolved.
      if (!this.error) return 'unchanged';
      this.error = null;
      return 'updated';
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      this.error = { message: `${path.basename(this.file)} is not valid JSON: ${(err as Error).message}`, errors: [] };
      return 'invalid';
    }
    const error = check(this.schema, parsed, `${path.basename(this.file)} failed schema validation`);
    if (error) {
      this.error = error;
      return 'invalid';
    }
    this.text = text;
    this.value = deepFreeze(parsed as T);
    this.error = null;
    return 'updated';
  }

  /** Validate and atomically write a new version, then make it live. */
  save(value: unknown): ValidationError | null {
    const error = check(this.schema, value, `${path.basename(this.file)} failed schema validation`);
    if (error) return error;
    const text = JSON.stringify(value, null, 2);
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, text);
    renameSync(tmp, this.file);
    this.text = text;
    this.value = deepFreeze(structuredClone(value as T));
    this.error = null;
    return null;
  }
}

export const dataConfig = new ConfigFile<DataConfig>(DATA_FILE, dataSchema, EMPTY_DATA, false);
export const exercisesConfig = new ConfigFile<ExercisesConfig>(EXERCISES_FILE, exercisesSchema, EMPTY_EXERCISES, true);

/** The live data.json config. */
export function config(): DataConfig {
  return dataConfig.get();
}

/** The live exercises.json config. */
export function exercisesFile(): ExercisesConfig {
  return exercisesConfig.get();
}

/** Current config problem, if any (the app keeps running on the last valid config). */
export function configError(): ValidationError | null {
  return dataConfig.error ?? exercisesConfig.error;
}

export type ConfigChange = { type: 'updated' } | { type: 'invalid'; error: ValidationError };

/** Reload both files; reports whether anything changed or failed. */
export function reloadConfig(): ConfigChange | null {
  const results = [dataConfig.reload(), exercisesConfig.reload()];
  const error = configError();
  if (results.includes('invalid') && error) return { type: 'invalid', error };
  if (results.includes('updated')) return { type: 'updated' };
  return null;
}

const WATCH_INTERVAL_MS = 2000;

/**
 * Watch both files for edits on disk. Uses stat polling on just these two
 * paths: cheap, survives editors that replace files, and works on bind mounts.
 */
export function watchConfig(onChange: (change: ConfigChange) => void): () => void {
  const files = [dataConfig.file, exercisesConfig.file];
  const listener = () => {
    const change = reloadConfig();
    if (change) onChange(change);
  };
  files.forEach(file => watchFile(file, { interval: WATCH_INTERVAL_MS }, listener));
  return () => files.forEach(file => unwatchFile(file, listener));
}
