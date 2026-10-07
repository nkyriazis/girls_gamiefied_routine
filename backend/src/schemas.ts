import { readFileSync } from 'fs';
import path from 'path';
import Ajv, { ErrorObject, ValidateFunction } from 'ajv';

// JSON schemas for config (data.json, exercises.json) and the state snapshot
// (legacy state.json / admin state editor). Loaded once; a missing or broken
// schema fails startup instead of silently disabling validation.

export const SCHEMA_DIR = process.env.SCHEMA_DIR || process.cwd();

const ajv = new Ajv({ allErrors: true, validateFormats: false, discriminator: true });

// Each schema is registered under its file name, so schemas can $ref each
// other (exercises.schema.json reuses data.schema.json's icon definition).
function load(file: string): { schema: object; validate: ValidateFunction } {
  const schema = JSON.parse(readFileSync(path.join(SCHEMA_DIR, file), 'utf-8'));
  ajv.addSchema(schema, file);
  return { schema, validate: ajv.getSchema(file)! };
}

export const dataSchema = load('data.schema.json');
export const exercisesSchema = load('exercises.schema.json');
export const stateSchema = load('state.schema.json');
export const exercisePoolSchema = load('exercise-pool.schema.json');

export interface ValidationError {
  message: string;
  errors: ErrorObject[];
}

/** Validate `value`; returns null when valid, otherwise the error to report. */
export function check(
  { validate }: { validate: ValidateFunction },
  value: unknown,
  message: string
): ValidationError | null {
  return validate(value) ? null : { message, errors: validate.errors ?? [] };
}

/**
 * The errors as one short line, for a refusal a parent reads in a toast: `<path> <message>` for the
 * first `max`, then how many more. The full list is what the editors' pre-checks show under the editor.
 */
export function summarize(errors: ErrorObject[], max = 3): string {
  const shown = errors.slice(0, max).map(e => `${e.instancePath || '/'} ${e.message}`);
  const more = errors.length - shown.length;
  return shown.join('; ') + (more > 0 ? ` (+${more} more)` : '');
}
