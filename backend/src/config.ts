import { createHash } from 'crypto';
import { chownSync, constants, copyFileSync, existsSync, readFileSync, renameSync, statSync, unwatchFile, watchFile, writeFileSync } from 'fs';
import path from 'path';
import { isDeepStrictEqual } from 'util';
import type { ErrorObject } from 'ajv';
import { ConfigWarning, CronWarning, DataConfig, Exercise, ExerciseCategoryDef } from '../../shared/types';
import { configProblems, refuses } from './configChecks';
import { DATA_EXAMPLE_FILE, DATA_FILE, EXERCISES_EXAMPLE_FILE, EXERCISES_FILE } from './paths';
import { check, dataSchema, exercisesSchema, summarize, ValidationError } from './schemas';

// ============================================================================
// Config (data.json + exercises.json), cached in memory.
//
// Files are read at startup, after an edit through the admin API, and when
// they change on disk — never per request. An invalid file on disk never
// replaces the cached config: the last valid version stays live and the error
// is reported, so a bad edit can't take the app (or its state) down.
//
// Saving never writes over a file the server couldn't load (issue #45). While
// the file on disk is invalid, save() refuses, so no read-modify-write editor
// (the forms) can put the live copy over the file being fixed. The one
// override is `replace`, sent only by the Advanced JSON editor: it replaces the
// invalid file deliberately, keeping it beside as <file>.invalid-<stamp>. Even
// then the empty fallback (live when the file was unreadable at startup) is
// never written: there the editor shows the file's own text to fix instead.
// A missing file counts as unreadable: on a live install (a database with
// history) a lost data.json or exercises.json is not created from the example
// (seedConfig below), so it is never loaded and saving is refused the same
// way. A file seeded from its example on a new install is loaded like any other.
//
// Nor does a save go over a version its writer never saw (issue #33). The
// version is a short hash of the live file's text: it moves on every save and
// every valid reload from disk. A writer sends the version it edited, and a
// save naming an older one is refused as a conflict (the route's 409), so the
// last save no longer silently wins. A save that names no version is not
// checked (scripts, and the editor fixing a file that doesn't parse).
//
// Some checks the schema can't express: a file's `rules` (data.json's are in
// configChecks.ts: crons the scheduler can't read, #89; duplicate ids, links
// to nothing, blank names and titles, colours, #104). Whatever they find in
// the live file is its `warnings`, which the parents' page shows
// (AppState.configWarnings). A file on disk that has any still loads
// (piserve's live file must never stop loading over a check added later).
// Only a cron refuses a save (configChecks.ts `refuses`): one the save brings
// in is refused like a schema error, while one already live (the same item
// with the same cron, never an array index) doesn't block a save that leaves
// it as it is, so one bad cron never locks out the others' fixes; fixing it
// is always a save. Every other problem is a warning only: the save goes
// through, and validate() hands them back for the Advanced editor to list.
// ============================================================================

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

const refusal = (message: string): ValidationError => ({ message, errors: [] });

/** Why save() wrote nothing. `conflict`: the writer edited an older version than the live one. */
export interface SaveRefusal extends ValidationError {
  conflict?: boolean;
}

/** The version of a file's text (or of the state's snapshot, #98): the first 12 hex characters of its sha256. */
export const versionOf = (text: string | null): string => createHash('sha256').update(text ?? '').digest('hex').slice(0, 12);

/** YYYY-MM-DD_HHMMSS in the process's time zone, like the backups' folders. */
function localStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

/** The same cron problem in two versions of a file: the same item, the same value. */
const problemKey = (w: CronWarning) => `${w.kind}\n${w.id}\n${w.cron}`;

/** A refused rule's problem in the shape of a schema error, so the editors list it and summarize() says it. */
const asSchemaError = (w: CronWarning): ErrorObject => ({
  instancePath: w.path, schemaPath: '#/cron', keyword: 'cron', params: { cron: w.cron },
  message: `η ώρα (cron) «${w.cron}» δεν διαβάζεται: ${w.error}`,
});

/** What is wrong with a config file, as the parents' screen shows it. */
export interface ConfigProblem extends ValidationError {
  file: string; // data.json or exercises.json
  emptyFallback: boolean; // never loaded since the start: the empty config is live, not the last valid one
}

/**
 * One cached, validated JSON config file. The cached value is deep-frozen:
 * callers that want to edit it take a copy via `raw()` and `save()` it.
 */
export class ConfigFile<T> {
  private value: T;
  private liveText: string | null = null;
  /** A valid version was read (or saved) since the start: `value` is the file's, not the fallback. */
  private loaded = false;
  error: ValidationError | null = null;
  /** Which text `error` is about: its version, or the read error when the file couldn't be read (#98). */
  errorOf: string | null = null;
  /** What the rules find in the live value: it loaded anyway (see the header). */
  warnings: ConfigWarning[] = [];

  constructor(
    readonly file: string,
    private readonly schema: typeof dataSchema,
    private readonly fallback: T,
    private readonly rules: (value: T) => ConfigWarning[] = () => []
  ) {
    this.value = deepFreeze(structuredClone(fallback));
  }

  get(): T {
    return this.value;
  }

  /** The live version: it changes whenever the live text does (a save, a valid reload from disk). */
  version(): string {
    return versionOf(this.liveText);
  }

  /** The live value and its version, read together, so they always belong to each other. */
  current(): { value: T; version: string } {
    return { value: this.value, version: this.version() };
  }

  /** A mutable deep copy of the cached value. */
  raw(): T {
    return structuredClone(this.value);
  }

  /** The current problem with the file, or null. */
  problem(): ConfigProblem | null {
    return this.error && { ...this.error, file: path.basename(this.file), emptyFallback: !this.loaded };
  }

  /**
   * What a save of `value` would meet. `error`: why it would be refused for its content, or null: the
   * schema, then the refusing rules' problems it brings in (one already live, the same item with the same
   * value, doesn't count). `warnings`: every other problem the rules find in it, which the save lets
   * through (none while the schema refuses it).
   */
  validate(value: unknown, message: string): { error: ValidationError | null; warnings: ConfigWarning[] } {
    const error = check(this.schema, value, message);
    if (error) return { error, warnings: [] };
    const live = new Set(this.warnings.filter(refuses).map(problemKey));
    const problems = this.rules(value as T);
    const brought = problems.filter(refuses).filter(w => !live.has(problemKey(w)));
    const refused = new Set<ConfigWarning>(brought);
    return {
      error: brought.length ? { message, errors: brought.map(asSchemaError) } : null,
      warnings: problems.filter(w => !refused.has(w)),
    };
  }

  /** The file's text as it is on disk now (to fix a file that doesn't parse), or null when missing. */
  text(): string | null {
    try {
      return readFileSync(this.file, 'utf-8');
    } catch {
      return null;
    }
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
      this.error = { message: `Cannot read ${path.basename(this.file)}: ${(err as Error).message}`, errors: [] };
      this.errorOf = this.error.message;
      return 'invalid';
    }
    if (text === this.liveText) {
      // Back to the live version after a broken edit: the error is resolved.
      if (!this.error) return 'unchanged';
      this.error = this.errorOf = null;
      return 'updated';
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      this.error = { message: `${path.basename(this.file)} is not valid JSON: ${(err as Error).message}`, errors: [] };
      this.errorOf = versionOf(text);
      return 'invalid';
    }
    const error = check(this.schema, parsed, `${path.basename(this.file)} failed schema validation`);
    if (error) {
      this.error = error;
      this.errorOf = versionOf(text);
      return 'invalid';
    }
    this.liveText = text;
    this.value = deepFreeze(parsed as T);
    this.warnings = this.rules(this.value);
    this.loaded = true;
    this.error = this.errorOf = null;
    return 'updated';
  }

  /**
   * Validate (the schema and the rules, see `validate`) and atomically write
   * a new version, then make it live. Refused (nothing written) while the
   * file on disk is invalid, unless `replace` asks to replace it; and never with the empty fallback over a file that
   * was never loaded, nor over a live config that has content. A replaced
   * invalid file is kept as <file>.invalid-<stamp>. When `version` is given
   * and the live version has moved past it, refused as a conflict.
   */
  save(value: unknown, { replace = false, version }: { replace?: boolean; version?: string } = {}): SaveRefusal | null {
    const name = path.basename(this.file);
    const { error } = this.validate(value, `${name} failed schema validation`);
    if (error) return error;
    if (version !== undefined && version !== this.version()) {
      return { ...refusal(`Το ${name} άλλαξε στο μεταξύ (από άλλη οθόνη ή στον δίσκο). Φόρτωσε ξανά και κάνε την αλλαγή σου πάλι.`), conflict: true };
    }
    if (!this.loaded && (!replace || isDeepStrictEqual(value, this.fallback))) {
      return refusal(`${name} was never loaded (it was missing or could not be read at startup), so saving would replace it ` +
        `with ${replace ? 'the empty config' : 'what is live, the empty config'}. Fix the file itself ` +
        `(Γονείς → Προχωρημένα shows its text) or restore it from a backup.`);
    }
    if (isDeepStrictEqual(value, this.fallback) && !isDeepStrictEqual(this.value, this.fallback)) {
      // What a screen holds before its first state arrives: never the family's config wiped by one tap
      return refusal(`Refused: this would replace ${name} with the empty config, which has nothing in it. ` +
        `A screen that saved before it had loaded the config sends exactly that; reload the page and try again.`);
    }
    if (this.error && !replace) {
      return refusal(`${name} on disk is not valid, so saving is off: it would replace the file being fixed. ` +
        `Fix the file, or replace it from Γονείς → Προχωρημένα. (${this.error.message})`);
    }
    if (this.error && existsSync(this.file)) {
      // Keep the invalid file beside, so a replace never loses what was in it
      copyFileSync(this.file, `${this.file}.invalid-${localStamp(new Date())}`);
    }
    const text = JSON.stringify(value, null, 2);
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, text);
    renameSync(tmp, this.file);
    this.liveText = text;
    this.value = deepFreeze(structuredClone(value as T));
    this.warnings = this.rules(this.value);
    this.loaded = true;
    this.error = this.errorOf = null;
    return null;
  }
}

/** The top-level keys whose values differ between two versions of a config file, for the action log. */
export function changedKeys(before: object, after: object): string[] {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return keys.filter(k => !isDeepStrictEqual((before as Record<string, unknown>)[k], (after as Record<string, unknown>)[k]));
}

// Both files are required: a missing one is an error the parents see, never a silent empty config.
export const dataConfig = new ConfigFile<DataConfig>(DATA_FILE, dataSchema, EMPTY_DATA, configProblems);
export const exercisesConfig = new ConfigFile<ExercisesConfig>(EXERCISES_FILE, exercisesSchema, EMPTY_EXERCISES);

const EXAMPLES = [
  { file: DATA_FILE, example: DATA_EXAMPLE_FILE },
  { file: EXERCISES_FILE, example: EXERCISES_EXAMPLE_FILE }
];

/**
 * First start: create each missing config file from its example, but only on a database with
 * no history. A live install that lost its file (history, no data.json) gets nothing: running
 * the family on the example would hide it, so the file stays missing and the parents see the
 * error until it is restored. Never overwrites a file. The new file belongs to its directory's
 * owner (the backend runs as root in the image; the host's files stay the host user's).
 */
export function seedConfig(hasHistory: boolean, files = EXAMPLES): { seeded: string[]; missing: string[] } {
  const seeded: string[] = [], missing: string[] = [];
  for (const { file, example } of files) {
    if (existsSync(file)) continue;
    if (hasHistory) {
      missing.push(file);
      continue;
    }
    try {
      copyFileSync(example, file, constants.COPYFILE_EXCL);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EEXIST') continue;
      throw err;
    }
    try {
      const dir = statSync(path.dirname(file));
      chownSync(file, dir.uid, dir.gid);
    } catch {
      // not root: the file is already ours
    }
    seeded.push(file);
  }
  return { seeded, missing };
}

/** The live data.json config. */
export function config(): DataConfig {
  return dataConfig.get();
}

/** The live exercises.json config. */
export function exercisesFile(): ExercisesConfig {
  return exercisesConfig.get();
}

/** Current config problem, if any: the app runs on the last valid config, or on the empty one if none was ever loaded. */
export function configError(): ConfigProblem | null {
  return dataConfig.problem() ?? exercisesConfig.problem();
}

/** What the checks find in the live data.json (configChecks.ts): it loaded, but these need fixing (#89, #104). */
export function configWarnings(): ConfigWarning[] {
  return dataConfig.warnings;
}

/**
 * What a reload found new in one file, for the action log (#98). `updated`: the live config changed, with
 * the top-level keys that differ; `restored`: the file went back to the live text after a broken edit, so
 * nothing live changed. `invalid`: a bad text not reported before (the poll sees it every time something
 * changes, so each bad text is reported once).
 */
export type FileReload =
  | { file: string; type: 'updated'; changed: string[]; restored?: true }
  | { file: string; type: 'invalid'; message: string };

export type ConfigChange = ({ type: 'updated' } | { type: 'invalid'; error: ValidationError }) & { files: FileReload[] };

// The bad text each file was last reported for (ConfigFile.errorOf)
const reportedInvalid = new Map<string, string>();

function reloadFile<T extends object>(config: ConfigFile<T>): { result: ReturnType<ConfigFile<T>['reload']>; report?: FileReload } {
  const file = path.basename(config.file);
  const before = config.get();
  const result = config.reload();
  if (config.errorOf === null) reportedInvalid.delete(file);
  if (result === 'updated') {
    const after = config.get();
    // The same object: the live text came back after a broken edit, and the live config never changed
    return { result, report: after === before ? { file, type: 'updated', changed: [], restored: true } : { file, type: 'updated', changed: changedKeys(before, after) } };
  }
  if (result === 'invalid' && config.error && config.errorOf !== null && reportedInvalid.get(file) !== config.errorOf) {
    reportedInvalid.set(file, config.errorOf);
    const { message, errors } = config.error;
    return { result, report: { file, type: 'invalid', message: errors.length ? `${message}: ${summarize(errors)}` : message } };
  }
  return { result };
}

/** Reload both files; reports whether anything changed or failed, and per file what is new (`files`). */
export function reloadConfig(): ConfigChange | null {
  const reloads = [reloadFile(dataConfig), reloadFile(exercisesConfig)];
  const results = reloads.map(r => r.result);
  const files = reloads.flatMap(r => (r.report ? [r.report] : []));
  const error = configError();
  if (results.includes('invalid') && error) return { type: 'invalid', error, files };
  if (results.includes('updated')) return { type: 'updated', files };
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
