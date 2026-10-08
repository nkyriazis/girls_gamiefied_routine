import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import { check, dataSchema, exercisePoolSchema, exercisesSchema, summarize } from '../src/schemas';

// Issue #31: a tagged oneOf (an exercise's `type`, a flow step's, a parallel action's) reports the
// mistake in the branch its tag names, once, not one error per branch AJV tried.

const backend = path.join(__dirname, '..');
const read = (file: string) => JSON.parse(readFileSync(path.join(backend, file), 'utf-8'));
const lines = (schema: typeof dataSchema, value: unknown) =>
  (check(schema, value, 'invalid')?.errors ?? []).map(e => `${e.instancePath} ${e.message}`);

const exercise = () => ({
  id: 'mc', type: 'multiple-choice', category: 'Μαθηματικά', title: 'Πρόσθεση',
  question: 'Πόσο κάνει 12 + 15;', options: ['25', '27'], correctIndex: 1, stars: 5,
});

test('a wrong field in an exercise is one error, at that field', () => {
  assert.deepEqual(lines(exercisesSchema, { exercises: [{ ...exercise(), correctIndex: 'δεύτερο' }] }),
    ['/exercises/0/correctIndex must be integer']);
});

test('a misspelled exercise type is one error, naming the tag', () => {
  const errors = check(exercisesSchema, { exercises: [{ ...exercise(), type: 'multiple-choise' }] }, 'invalid')!.errors;
  assert.equal(errors.length, 1);
  assert.equal(errors[0].instancePath, '/exercises/0');
  assert.match(errors[0].message!, /tag "type"/);
});

test('an exercise that is not an object is still refused', () => {
  assert.equal(lines(exercisesSchema, { exercises: ['math-mc-1'] }).length, 1);
  assert.equal(lines(exercisesSchema, { exercises: [null] }).length, 1);
});

const flows = (steps: unknown[]) => ({ ...read('data.example.json'), flows: [{ id: 'f', steps }] });

test('a wrong field in a flow step is one error, in its own branch', () => {
  assert.deepEqual(lines(dataSchema, flows([{ type: 'alarm', props: { title: 5 } }])),
    ['/flows/0/steps/0/props/title must be string']);
  assert.deepEqual(lines(dataSchema, flows([{ type: 'parallel', actions: [{ type: 'flow', flowId: 7 }] }])),
    ['/flows/0/steps/0/actions/0/flowId must be string']);
  assert.equal(lines(dataSchema, flows([{ type: 'alarms', props: {} }])).length, 1);
  assert.equal(lines(dataSchema, flows([{ type: 'parallel', actions: [{ type: 'flows', flowId: 'x' }] }])).length, 1);
});

test("an alarm's sound (a name or an upload) validates as before", () => {
  assert.deepEqual(lines(dataSchema, flows([{ type: 'alarm', props: { sound: 'melody' } }])), []);
  assert.deepEqual(lines(dataSchema, flows([{ type: 'alarm', props: { sound: { type: 'upload', value: 'a.mp3' } } }])), []);
  assert.ok(lines(dataSchema, flows([{ type: 'alarm', props: { sound: 'siren' } }])).length > 0);
});

test('the shipped examples and every pool still validate', () => {
  assert.deepEqual(lines(dataSchema, read('data.example.json')), []);
  assert.deepEqual(lines(exercisesSchema, read('exercises.example.json')), []);
  const pools = readdirSync(path.join(backend, 'exercise-pools')).filter(f => f.endsWith('.json'));
  assert.ok(pools.length > 0);
  for (const file of pools) assert.deepEqual(lines(exercisePoolSchema, read(`exercise-pools/${file}`)), [], file);
});

test("a save's 400 is a short line a toast can show: the first three errors, then how many more", () => {
  const exercises = [0, 1, 2, 3, 4].map(i => ({ ...exercise(), id: `e${i}`, stars: 'πέντε' }));
  assert.equal(summarize(check(exercisesSchema, { exercises: exercises.slice(0, 1) }, 'invalid')!.errors),
    '/exercises/0/stars must be integer');
  assert.equal(summarize(check(exercisesSchema, { exercises }, 'invalid')!.errors),
    '/exercises/0/stars must be integer; /exercises/1/stars must be integer; /exercises/2/stars must be integer (+2 more)');
  assert.equal(summarize(check(exercisesSchema, [], 'invalid')!.errors), '/ must be object');
});
