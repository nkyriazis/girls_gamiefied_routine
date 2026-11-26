import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'fs';
import path from 'path';
import { unzipSync } from 'fflate';
import type { ConfigUser } from '../../shared/types';
import {
  Lesson, LessonRun, LessonStepResult, LessonSummary, SHOW_ANSWER_AFTER, asExercise, checkOwn, lessonProblems, lessonSummary, nextStop, profileOf, rightAnswer
} from '../../shared/lessons';
import { LESSONS_DIR } from './paths';
import { check, lessonSchema, summarize } from './schemas';
import { awardStars, checkExerciseAnswer, logAction, store, sync } from './db';
import { config } from './config';

// ============================================================================
// The lessons library (shared/lessons.ts). A lesson is a folder under LESSONS_DIR (on the data volume,
// in the daily backup): lesson.json and its images. The parents' page imports a package (a zip from
// tools/lessons); the kids open a lesson from their exercises. A kid's place in it is a row of
// lesson_runs, moved only here: each call names the stop it acts on, so a repeat from a second screen
// or a double tap is a no-op. A piece pays one star the first time its questions are done.
// ============================================================================

export class LessonError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

const FILE_NAME = /^((images|pages)\/[A-Za-z0-9._-]+\.(png|jpe?g|webp)|audio\/[a-f0-9]{8,40}\.mp3)$/;

interface Entry { lesson: Lesson; summary: LessonSummary }
let library = new Map<string, Entry>();

/** Read every lesson folder. A folder that doesn't read is left out, and said so in the log. */
export function loadLibrary(): void {
  const next = new Map<string, Entry>();
  if (existsSync(LESSONS_DIR)) {
    for (const name of readdirSync(LESSONS_DIR)) {
      const file = path.join(LESSONS_DIR, name, 'lesson.json');
      if (!existsSync(file)) continue;
      try {
        const lesson = JSON.parse(readFileSync(file, 'utf-8')) as Lesson;
        const invalid = check(lessonSchema, lesson, 'invalid lesson');
        if (invalid) throw new Error(summarize(invalid.errors));
        next.set(lesson.id, { lesson, summary: lessonSummary(lesson, statSync(file).mtime.toISOString()) });
      } catch (err) {
        console.error(`Lesson ${name} is left out of the library: ${(err as Error).message}`);
      }
    }
  }
  library = next;
}
loadLibrary();

export function lessonSummaries(): LessonSummary[] {
  return [...library.values()].map(e => e.summary)
    .sort((a, b) => a.subject.localeCompare(b.subject, 'el') || (Number(a.chapter) || 0) - (Number(b.chapter) || 0) || a.title.localeCompare(b.title, 'el'));
}

export function getLesson(id: string): Lesson {
  const entry = library.get(id);
  if (!entry) throw new LessonError('Δεν υπάρχει αυτό το μάθημα.', 404);
  return entry.lesson;
}

/** An image of a lesson, as a path on disk (only the names the package may hold). */
export function lessonFile(id: string, file: string): string | null {
  if (!library.has(id) || !FILE_NAME.test(file)) return null;
  const full = path.join(LESSONS_DIR, id, file);
  return existsSync(full) ? full : null;
}

/** Import a package: check it whole, then put it in place of any lesson with its id. */
export function importLesson(zip: Uint8Array): { lesson: LessonSummary; replaced: boolean } {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(zip);
  } catch {
    throw new LessonError('Αυτό δεν είναι πακέτο μαθήματος (δεν ανοίγει ως zip).');
  }
  const raw = files['lesson.json'];
  if (!raw) throw new LessonError('Το πακέτο δεν έχει lesson.json.');
  let lesson: Lesson;
  try {
    lesson = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw new LessonError('Το lesson.json του πακέτου δεν διαβάζεται.');
  }
  const invalid = check(lessonSchema, lesson, 'invalid lesson');
  if (invalid) throw new LessonError(`Το μάθημα δεν είναι σωστό: ${summarize(invalid.errors)}`);
  const images = Object.keys(files).filter(f => FILE_NAME.test(f));
  const problems = lessonProblems(lesson, new Set(images));
  if (problems.length) throw new LessonError(`Το μάθημα δεν παίζεται: ${problems.slice(0, 3).join('; ')}`);

  mkdirSync(LESSONS_DIR, { recursive: true });
  const target = path.join(LESSONS_DIR, lesson.id);
  const partial = path.join(LESSONS_DIR, `.partial-${lesson.id}`);
  rmSync(partial, { recursive: true, force: true });
  mkdirSync(path.join(partial, 'images'), { recursive: true });
  mkdirSync(path.join(partial, 'audio'), { recursive: true });
  mkdirSync(path.join(partial, 'pages'), { recursive: true });
  writeFileSync(path.join(partial, 'lesson.json'), JSON.stringify(lesson, null, 2));
  for (const f of images) writeFileSync(path.join(partial, f), files[f]);
  const replaced = existsSync(target);
  if (replaced) rmSync(target, { recursive: true, force: true });
  renameSync(partial, target);
  loadLibrary();

  // A kid's place that no longer fits the new version starts over (her stars stay)
  const steps = lesson.script.length;
  for (const run of store.lessonRuns.all('lessonId = ?', lesson.id)) {
    if (run.stop >= steps) store.lessonRuns.put({ ...run, stop: 0, mistakes: {}, updatedAt: new Date().toISOString() });
  }
  logAction('LESSON_IMPORTED', { id: lesson.id, title: lesson.title, pieces: lesson.pieces.length, images: images.length, replaced });
  sync.changed();
  return { lesson: library.get(lesson.id)!.summary, replaced };
}

/** Take a lesson out of the library. The kids' places in it go too; the stars they earned stay. */
export function deleteLesson(id: string): void {
  getLesson(id);
  rmSync(path.join(LESSONS_DIR, id), { recursive: true, force: true });
  store.lessonRuns.deleteWhere('lessonId = ?', id);
  loadLibrary();
  logAction('LESSON_DELETED', { id });
  sync.changed();
}

export function lessonRuns(): LessonRun[] {
  return store.lessonRuns.all().filter(r => library.has(r.lessonId));
}

function kid(userId: string): ConfigUser {
  const user = config().users.find(u => u.id === userId);
  if (!user) throw new LessonError('Unknown kid');
  return user;
}

function runOf(userId: string, lessonId: string): LessonRun {
  const id = `${userId}:${lessonId}`;
  const run = store.lessonRuns.get(id);
  if (run) return run;
  const now = new Date().toISOString();
  return { id, userId, lessonId, stop: 0, mistakes: {}, paid: [], startedAt: now, updatedAt: now, round: 1 };
}


/**
 * Act on step `stop` of her run: a step with nothing to answer moves on; a choice records what she picked; a question
 * moves on when right, and a wrong try is counted, with the sentences to light, until SHOW_ANSWER_AFTER: then the
 * right answer comes back and the step moves on anyway (feedback, not a wall; its star is still paid, for the effort).
 * A step that isn't where she is changes nothing and says where she is. She goes along her own path (`profileOf`: the
 * steps masked for the other kind of child are passed over, never paid), so her place is always a step on it, even
 * when a parent flipped her switch mid-lesson.
 */
export function lessonStep(lessonId: string, userId: string, stop: number, answer?: unknown): LessonStepResult {
  const profile = profileOf(kid(userId));
  const lesson = getLesson(lessonId);
  const script = lesson.script;
  return store.transaction(() => {
    const stored = runOf(userId, lessonId);
    const run = { ...stored, stop: nextStop(lesson, stored.stop, profile) };
    if (stop !== run.stop || stop >= script.length - 1) return { run, starsAwarded: 0 };
    const now = new Date().toISOString();
    const step = script[stop];
    let choices = run.choices;
    let shown: unknown;
    let correct: boolean | undefined;
    if (step.do === 'choose') {
      const value = step.options.find(o => o.value === answer)?.value;
      if (!value) throw new LessonError('Unknown choice');
      choices = { ...run.choices, mode: value };
    }
    if (step.do === 'ask') {
      const q = step.question;
      correct = checkOwn(q, answer) ?? checkExerciseAnswer(asExercise(lesson, q, String(stop))!, answer);
      if (!correct) {
        const tries = (run.mistakes[stop] ?? 0) + 1;
        const mistakes: Record<string, number> = { ...run.mistakes, [stop]: tries };
        logAction('LESSON_WRONG', { lessonId, userId, stop, tries });
        if (tries < SHOW_ANSWER_AFTER) {
          const next = { ...run, mistakes, updatedAt: now };
          store.lessonRuns.put(next);
          return { run: next, correct: false, evidence: step.piece ? { piece: step.piece, sentences: q.type === 'find-sentence' ? [] : q.evidence ?? [] } : undefined, starsAwarded: 0 };
        }
        run.mistakes = mistakes;
        shown = rightAnswer(q);
      }
    }
    // Moving on: a step marked with a star pays it, once ever
    const pays = 'star' in step && !!step.star && !run.paid.includes(stop);
    const to = nextStop(lesson, stop + 1, profile);
    const next: LessonRun = {
      ...run, stop: to, updatedAt: now, choices,
      paid: pays ? [...run.paid, stop] : run.paid,
      ...(to === script.length - 1 ? { completedAt: run.completedAt ?? now } : {}),
    };
    store.lessonRuns.put(next);
    if (pays) awardStars(userId, 1);
    if (to === script.length - 1) logAction('LESSON_FINISHED', { lessonId, userId, profile, round: run.round, mistakes: run.mistakes });
    return { run: next, correct, shown, starsAwarded: pays ? 1 : 0 };
  });
}

/** «Ξανά από την αρχή»: back to the start. The stars she earned stay, and a step never pays twice. */
export function restartLesson(lessonId: string, userId: string): LessonRun {
  kid(userId);
  getLesson(lessonId);
  const run = runOf(userId, lessonId);
  const next = { ...run, stop: 0, mistakes: {}, round: run.round + (run.stop > 0 ? 1 : 0), updatedAt: new Date().toISOString() };
  store.lessonRuns.put(next);
  logAction('LESSON_RESTARTED', { lessonId, userId, round: next.round });
  return next;
}
