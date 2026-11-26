import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, writeFileSync } from 'fs';
import path from 'path';
import { zipSync } from 'fflate';
import { DataConfig } from '../../shared/types';
import { Lesson, LessonRun, LessonStepResult, lessonProblems, lessonSummary } from '../../shared/lessons';
import { tempDir } from './helpers';

// The lessons library (lessons.ts): a package imports whole or not at all, and a kid's steps follow the script.
// A wrong try lights the evidence; the second shows the answer and moves on; a starred step pays once, ever;
// a step that isn't where she is changes nothing. Through server.inject, on this file's own data and library.
const dir = tempDir();
const cfg: DataConfig = {
  users: [{ id: 'u1', name: 'Α', avatar: { type: 'emoji', value: '👧' }, color: 'gold', grade: 5 },
    { id: 'u2', name: 'Β', avatar: { type: 'emoji', value: '👧' }, color: 'gold', grade: 5, adhd: true }], tasks: [], routines: [], routineTasks: [],
  routineAssignments: [], flows: [], schedules: [], rewards: [], chores: [], settings: { timezone: 'Europe/Athens' }
};
writeFileSync(path.join(dir, 'data.json'), JSON.stringify(cfg));
writeFileSync(path.join(dir, 'exercises.json'), JSON.stringify({ exercises: [] }));
process.env.DATA_FILE = path.join(dir, 'data.json');
process.env.EXERCISES_FILE = path.join(dir, 'exercises.json');
process.env.DB_FILE = path.join(dir, 'routine.db');
process.env.LESSONS_DIR = path.join(dir, 'lessons');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { reloadConfig } = require('../src/config') as typeof import('../src/config');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { server } = require('../src/server') as typeof import('../src/server');
{ const r = reloadConfig(); if (r?.type !== 'updated') throw new Error('test config rejected: ' + JSON.stringify(r).slice(0, 400)); }
before(() => server.ready());

const lesson: Lesson = {
  format: 2, id: 'test-e-1', grade: 5, subject: 'Ιστορία', title: 'Δοκιμή', source: 'βιβλίο, σελ. 1',
  pieces: [{ id: 'p1', title: 'Ένα', sentences: ['Πρώτη πρόταση.', 'Δεύτερη πρόταση.'], key: 1 }],
  script: [
    { do: 'intro' },
    { do: 'choose', question: 'Πώς;', options: [{ value: 'listen', label: 'Άκου', icon: '🦉' }, { value: 'read', label: 'Διάβασε', icon: '👀' }] },
    { do: 'read', piece: 'p1' },
    { do: 'ask', piece: 'p1', question: { type: 'multiple-choice', question: 'Ποια;', options: ['α', 'β', 'γ'], correctIndex: 1, evidence: [1] }, star: true },
    { do: 'ask', piece: 'p1', question: { type: 'sort', question: 'Κουτιά', bins: ['Α', 'Β'], items: [{ text: 'x', bin: 0 }, { text: 'y', bin: 1 }] }, star: true },
    { do: 'end' },
  ],
};

const BOUNDARY = '----lesson-test';
async function importZip(files: Record<string, Uint8Array>) {
  const zip = Buffer.from(zipSync(files));
  const payload = Buffer.concat([Buffer.from(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="l.zip"\r\nContent-Type: application/zip\r\n\r\n`),
    zip, Buffer.from(`\r\n--${BOUNDARY}--\r\n`)]);
  return server.inject({ method: 'POST', url: '/api/admin/lessons', payload, headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` } });
}
const json = (l: unknown) => new TextEncoder().encode(JSON.stringify(l));
const step = async (stop: number, answer?: unknown) =>
  (await server.inject({ method: 'POST', url: '/api/lessons/test-e-1/step', payload: answer === undefined ? { userId: 'u1', stop } : { userId: 'u1', stop, answer } })).json() as LessonStepResult;
const stars = async () => ((await server.inject({ method: 'GET', url: '/api/users' })).json() as { id: string; stars: number }[])[0].stars;

test('the example lesson has no problems; a broken one says what', () => {
  assert.deepEqual(lessonProblems(lesson), []);
  const broken: Lesson = { ...lesson, script: [{ do: 'ask', piece: 'p1', question: { type: 'true-false', question: '?', correctValue: true, evidence: [5] } }] };
  const problems = lessonProblems(broken);
  assert.ok(problems.some(p => p.includes('before it is read')));
  assert.ok(problems.some(p => p.includes('evidence 5')));
  assert.ok(problems.some(p => p.includes('last step must be end')));
  // A hard word must be written as the text has it (it is marked there), and the book's pages must be in the package
  const words: Lesson = { ...lesson, pieces: [{ ...lesson.pieces[0], glossary: [{ term: 'προτάσεις', meaning: 'x' }], easy: { 7: 'y' } }],
    script: [{ do: 'book', when: 'before' }, ...lesson.script] };
  const more = lessonProblems(words);
  assert.ok(more.some(p => p.includes('«προτάσεις» is in none')));
  assert.ok(more.some(p => p.includes('easy 7')));
  assert.ok(more.some(p => p.includes('book step needs pages')));
  assert.deepEqual(lessonProblems({ ...words, pieces: [{ ...lesson.pieces[0], glossary: [{ term: 'πρόταση', meaning: 'x' }] }],
    pages: [{ file: 'pages/p1.jpg', page: '45' }] }, new Set(['pages/p1.jpg'])), []);
  // A question about a picture shows it in place of the text: the picture must be in the package
  const looking: Lesson = { ...lesson, script: lesson.script.map(s => s.do === 'ask' ? { ...s, picture: 'images/map.jpg' } : s) };
  assert.ok(lessonProblems(looking).some(p => p.includes('picture images/map.jpg is not in the package')));
  assert.deepEqual(lessonProblems(looking, new Set(['images/map.jpg'])), []);
});

test('a package that is not a lesson is refused, and nothing is written', async () => {
  const bad = await importZip({ 'lesson.json': json({ ...lesson, script: [{ do: 'end' }, { do: 'end' }] }) });
  assert.equal(bad.statusCode, 400);
  assert.match(bad.json().error, /^Το μάθημα/);
  assert.equal(existsSync(path.join(dir, 'lessons', 'test-e-1')), false);
  const notZip = await server.inject({ method: 'POST', url: '/api/admin/lessons', payload: Buffer.from(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="x.zip"\r\n\r\nhello\r\n--${BOUNDARY}--\r\n`), headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` } });
  assert.equal(notZip.statusCode, 400);
});

test('a kid plays the script: choice, a wrong try with its evidence, the answer shown after two, a star once', async () => {
  const ok = await importZip({ 'lesson.json': json(lesson) });
  assert.equal(ok.statusCode, 200, ok.body);
  const before = await stars();

  assert.equal((await step(0)).run.stop, 1);
  assert.equal((await step(5)).run.stop, 1, 'a step that is not hers changes nothing');
  const chose = await step(1, 'listen');
  assert.deepEqual(chose.run.choices, { mode: 'listen' });
  assert.equal((await step(2)).run.stop, 3);

  const wrong = await step(3, 0);
  assert.equal(wrong.correct, false);
  assert.deepEqual(wrong.evidence, { piece: 'p1', sentences: [1] });
  assert.equal(wrong.run.stop, 3);
  const again = await step(3, 2);
  assert.equal(again.shown, 1, 'the second wrong try shows the right answer');
  assert.equal(again.run.stop, 4, 'and moves on');
  assert.equal(again.starsAwarded, 1, 'the effort still pays its star');

  const sorted = await step(4, [0, 1]);
  assert.equal(sorted.correct, true);
  assert.equal(sorted.run.stop, 5);
  assert.ok(sorted.run.completedAt);
  assert.equal(await stars(), before + 2);

  // Again from the start: the stars stay and nothing pays twice
  const restarted = (await server.inject({ method: 'POST', url: '/api/lessons/test-e-1/restart', payload: { userId: 'u1' } })).json() as LessonRun;
  assert.equal(restarted.stop, 0);
  assert.equal(restarted.round, 2);
  for (const [s, a] of [[0], [1, 'read'], [2], [3, 1], [4, [0, 1]]] as [number, unknown?][]) await step(s, a);
  assert.equal(await stars(), before + 2);
});

// One package, two paths: the ADHD switch (ConfigUser.adhd) plays the steps masked `for: 'adhd'`, every other kid the
// `plain` ones; unmasked steps are on both. Her place is always a step on her path, and only it pays.
const masked: Lesson = {
  ...lesson, id: 'test-e-2',
  script: [
    { do: 'intro' },
    { do: 'move', icon: '🤸', text: 'Σήκω!', warmup: true, for: 'adhd' },
    { do: 'read', piece: 'p1' },
    { do: 'ask', piece: 'p1', question: { type: 'true-false', question: 'Σωστό;', correctValue: true, evidence: [0] }, think: 'adhd', star: true },
    { do: 'move', icon: '🧘', text: 'Ανάσες.', for: 'adhd' },
    { do: 'ask', piece: 'p1', question: { type: 'multiple-choice', question: 'Ποια;', options: ['α', 'β', 'γ'], correctIndex: 1, evidence: [1] }, star: true, for: 'plain' },
    { do: 'end' },
  ],
};

test('each kid plays her own path of one package; the checks hold each path whole', async () => {
  assert.deepEqual(lessonProblems(masked), []);
  assert.deepEqual(lessonSummary(masked, '').stars, { adhd: 1, plain: 2 });
  // A path missing a piece's reading, or an intro masked away, is refused
  const holed: Lesson = { ...masked, script: masked.script.map(s => s.do === 'read' ? { ...s, for: 'adhd' as const } : s.do === 'intro' ? { ...s, for: 'plain' as const } : s) };
  const problems = lessonProblems(holed);
  assert.ok(problems.some(p => p.includes('piece p1 is never read on the plain path')));
  assert.ok(problems.some(p => p.includes('is on every path')));

  assert.equal((await importZip({ 'lesson.json': json(masked) })).statusCode, 200);
  const go = async (userId: string, stop: number, answer?: unknown) =>
    (await server.inject({ method: 'POST', url: '/api/lessons/test-e-2/step', payload: answer === undefined ? { userId, stop } : { userId, stop, answer } })).json() as LessonStepResult;

  // Plain (u1): no moves; both questions
  assert.equal((await go('u1', 0)).run.stop, 2, 'the warm-up is passed over');
  assert.equal((await go('u1', 2)).run.stop, 3);
  assert.equal((await go('u1', 3, true)).run.stop, 5, 'the break is passed over');
  const plainEnd = await go('u1', 5, 1);
  assert.equal(plainEnd.run.stop, 6);
  assert.ok(plainEnd.run.completedAt);
  assert.deepEqual(plainEnd.run.paid, [3, 5]);

  // ADHD (u2): the moves; the plain-only question is passed over
  assert.equal((await go('u2', 0)).run.stop, 1);
  assert.equal((await go('u2', 1)).run.stop, 2);
  assert.equal((await go('u2', 2)).run.stop, 3);
  assert.equal((await go('u2', 3, true)).run.stop, 4);
  const adhdEnd = await go('u2', 4);
  assert.equal(adhdEnd.run.stop, 6, 'the plain-only question is passed over');
  assert.ok(adhdEnd.run.completedAt);
  assert.deepEqual(adhdEnd.run.paid, [3]);
  assert.equal((await go('u2', 5, 1)).starsAwarded, 0, 'a step off her path pays nothing');
});
