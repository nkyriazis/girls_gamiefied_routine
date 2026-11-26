// Long-text lessons: a chapter of a reading subject (Ιστορία, Γεωγραφία, ΚΠΑ…), prepared on the dev machine from
// the book into a package (the lesson-package skill, tools/lessons), imported on the Pi from the parents' page into
// the library, and played by a kid when asked to. Why it plays the way it does: docs/research/adhd-long-text-study.md.
//
// A lesson is content (pieces: short runs of the book's sentences, its pictures, its hard words) and a script: the
// steps she goes through, each a block of the library (read a piece, answer, move, explain…). The script is the
// delivery the preparing agent designed for this chapter; the player and the server only run it. One module for the
// server (checks answers, keeps her place), the player (draws the blocks) and the packing tool's check.

import type {
  Exercise, FillBlankExercise, MatchPairsExercise, MultipleChoiceExercise, OrderingExercise, SchoolGrade, TrueFalseExercise
} from './types';

export const LESSON_FORMAT = 2;

// --- Content ---

export interface LessonPiece {
  id: string;
  title: string;
  sentences: string[];
  /** The sentence that says what matters most: marked for her while she reads (a highlight chosen for her) */
  key?: number;
  image?: { file: string; caption?: string };
  /** Hard words, each as it is written in a sentence (marked there; a tap says what it means) */
  glossary?: { term: string; meaning: string }[];
  /** «Πιο απλά»: a hard sentence (by index) said in plain words, a whole sentence, nothing added */
  easy?: Record<string, string>;
}

/** A page of the book, as an image in the package (pages/…), with the number printed on it */
export interface LessonPage { file: string; page: string }

// --- Questions: the exercise shapes the players already draw, and the lessons' own ---

type Shape<E extends Exercise> = Omit<E, 'id' | 'category' | 'title' | 'stars' | 'body' | 'figure' | 'userIds' | 'template'
  | 'generatorParams' | 'source' | 'chapter' | 'topic' | 'difficulty'>;

export type LessonQuestion = { prompt?: string; evidence?: number[] } & (
  | Shape<MultipleChoiceExercise>
  | Shape<TrueFalseExercise>
  | Shape<FillBlankExercise>
  | Shape<OrderingExercise>
  | Shape<MatchPairsExercise>
  // Tap the sentence of the piece that says it (any of `sentences`); `main`: the one that says what matters most
  | { type: 'find-sentence'; question: string; sentences: number[]; main?: boolean }
  // Put each card in one of two boxes (then / now, cause / effect…); the answer is a box per item, in order
  | { type: 'sort'; question: string; bins: [string, string]; items: { text: string; bin: 0 | 1 }[] }
  // Tap the place on a picture: regions in percent of the picture, the right one by index
  | { type: 'spot'; question: string; image: string; regions: { x: number; y: number; w: number; h: number; label?: string }[]; correct: number }
);

// --- The script ---

export type LessonMode = 'listen' | 'read';

/**
 * Who a step is for. One package plays two ways: a kid with the ADHD switch on (ConfigUser.adhd) plays the `adhd`
 * path, every other kid the `plain` one. A step with no `for` is on both; the agent preparing the lesson masks the
 * rest (a movement break `for: 'adhd'`, a question only a plain reader needs `for: 'plain'`), and `think` the same way.
 * The pieces (the book's text) are the same on both paths.
 */
export type LessonProfile = 'adhd' | 'plain';
export const LESSON_PROFILES: LessonProfile[] = ['adhd', 'plain'];
export const profileOf = (user: { adhd?: boolean }): LessonProfile => user.adhd ? 'adhd' : 'plain';

export type LessonStep = LessonStepBody & { for?: LessonProfile };

type LessonStepBody =
  /** What is coming: the title, how many pieces, what she earns */
  | { do: 'intro' }
  /** Two ways to go on, hers to pick (the owl reads every piece aloud, or only when she taps 🔊) */
  | { do: 'choose'; question: string; options: [LessonChoice, LessonChoice] }
  /** Get up and move: a warm-up before, a break between pieces */
  | { do: 'move'; icon: string; text: string; warmup?: boolean }
  /** Read a piece (heard, in listen mode), with its key sentence marked */
  | { do: 'read'; piece: string; star?: boolean }
  /** A question, with the piece beside it; `think`: she answers in her head first, then the options appear (true:
   *  on both paths, or only on that one) */
  | { do: 'ask'; piece?: string; question: LessonQuestion; think?: boolean | LessonProfile; review?: boolean; star?: boolean;
      /** A picture of the package (images/…) shown in place of the piece's text: the question is about what it shows */
      picture?: string }
  /** The book's own pages: a look before (what the chapter is), or after (find in it what she learned) */
  | { do: 'book'; when: 'before' | 'after' }
  /** Say it in her own words to someone: a prompt, starters to help, and «Το εξήγησα» */
  | { do: 'explain'; piece?: string; prompt: string; stems?: string[]; star?: boolean }
  | { do: 'end' };

export interface LessonChoice { value: LessonMode; label: string; icon: string }

export interface Lesson {
  format: typeof LESSON_FORMAT;
  id: string;
  grade: SchoolGrade;
  subject: string;
  icon?: string;
  chapter?: string;
  title: string;
  source: string;
  pieces: LessonPiece[];
  /** The chapter's pages in the book, for the `book` steps */
  pages?: LessonPage[];
  script: LessonStep[];
  /** For the parent: open questions from the book to talk about afterwards (no right answer for a screen) */
  talk?: string[];
  /** What the owl says → its clip in the package (written by tools/lessons/voice.sh) */
  audio?: Record<string, string>;
}

/** What the owl says on the book's pages, before and after */
export const BOOK_SAYS = {
  before: 'Αυτές είναι οι σελίδες του βιβλίου σου. Ρίξε μια ματιά: τον τίτλο, τις εικόνες. Μετά θα τις διαβάσουμε κομμάτι κομμάτι.',
  after: 'Τώρα κοίτα ξανά τις σελίδες του βιβλίου σου. Βρες μέσα τους όσα έμαθες!',
} as const;

/** After this many wrong tries a question shows its answer and moves on (feedback, not a wall) */
export const SHOW_ANSWER_AFTER = 2;

/** What STATE carries of a lesson in the library: enough to list it, not its text. */
export interface LessonSummary {
  id: string;
  grade: SchoolGrade;
  subject: string;
  icon?: string;
  chapter?: string;
  title: string;
  source: string;
  pieces: number;
  steps: number;
  /** Stars to earn on each path */
  stars: Record<LessonProfile, number>;
  talk: string[];
  importedAt: string;
}

/** A kid's place in a lesson: one per kid and lesson, kept when she finishes (she may play it again). */
export interface LessonRun {
  id: string; // `${userId}:${lessonId}`
  userId: string;
  lessonId: string;
  stop: number; // the script step she is at
  mistakes: Record<string, number>; // per step, wrong tries
  paid: number[]; // steps that paid their star; never twice
  choices?: Record<string, string>; // what she picked (mode: listen | read)
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  round: number; // 1 the first time through, +1 for each «Ξανά από την αρχή»
}

/** What a step answers: her run after it, whether she was right; after a wrong try the sentences to light, and once
 *  her tries are up the right answer (the step has moved on). */
export interface LessonStepResult {
  run: LessonRun;
  correct?: boolean;
  evidence?: { piece: string; sentences: number[] };
  shown?: unknown;
  starsAwarded: number;
}

/** Whether a step is on her path */
export const plays = (step: LessonStep, profile: LessonProfile) => !step.for || step.for === profile;
/** Whether a question asks her to think first, on her path */
export const thinks = (step: LessonStep, profile: LessonProfile) => step.do === 'ask' && (step.think === true || step.think === profile);
/** The first step at or after `from` that is on her path (the end is on every path) */
export function nextStop(lesson: Pick<Lesson, 'script'>, from: number, profile: LessonProfile): number {
  let i = from;
  while (i < lesson.script.length - 1 && !plays(lesson.script[i], profile)) i++;
  return i;
}

export const pieceOf = (lesson: Pick<Lesson, 'pieces'>, id: string | undefined) =>
  id === undefined ? undefined : lesson.pieces.find(p => p.id === id);

/** A question in the exercise shape its renderer draws (and checkExerciseAnswer checks); null for the lessons' own. */
export function asExercise(lesson: Pick<Lesson, 'id' | 'title'>, question: LessonQuestion, key: string): Exercise | null {
  if (question.type === 'find-sentence' || question.type === 'sort' || question.type === 'spot') return null;
  const shape: Record<string, unknown> = { ...question };
  for (const k of ['prompt', 'evidence']) delete shape[k];
  return { ...shape, id: `${lesson.id}:${key}`, category: 'lesson', title: lesson.title, stars: 0 } as Exercise;
}

/** The right answer, in the shape an answer is sent (to show it when her tries are up). */
export function rightAnswer(question: LessonQuestion): unknown {
  switch (question.type) {
    case 'multiple-choice': return question.correctIndex;
    case 'true-false': return question.correctValue;
    case 'fill-blank': return question.correctAnswers;
    case 'ordering': return question.items.map(i => i.id);
    case 'match-pairs': return question.pairs;
    case 'find-sentence': return question.sentences[0];
    case 'sort': return question.items.map(i => i.bin);
    case 'spot': return question.correct;
  }
}

/** Whether an answer is right, for the lessons' own question types (the others: checkExerciseAnswer). */
export function checkOwn(question: LessonQuestion, answer: unknown): boolean | null {
  switch (question.type) {
    case 'find-sentence': return typeof answer === 'number' && question.sentences.includes(answer);
    case 'spot': return answer === question.correct;
    case 'sort': return Array.isArray(answer) && answer.length === question.items.length && answer.every((b, i) => b === question.items[i].bin);
    default: return null;
  }
}

/** Every text the owl may say in a lesson: the pieces' sentences, titles and hard words, the questions, the prompts. */
export function spokenLines(lesson: Lesson): string[] {
  const lines: string[] = [lesson.title];
  for (const p of lesson.pieces) {
    lines.push(p.title, ...p.sentences);
    for (const g of p.glossary ?? []) lines.push(`${g.term}: ${g.meaning}`);
    lines.push(...Object.values(p.easy ?? {}));
  }
  for (const s of lesson.script) {
    if (s.do === 'ask') {
      const q = s.question;
      lines.push('question' in q ? q.question : q.prompt ?? '');
      if (q.type === 'multiple-choice') lines.push(...q.options);
    } else if (s.do === 'explain') lines.push(s.prompt);
    else if (s.do === 'move') lines.push(s.text);
    else if (s.do === 'choose') lines.push(s.question);
    else if (s.do === 'book') lines.push(BOOK_SAYS[s.when]);
  }
  return [...new Set(lines.filter(Boolean))];
}

/** Everything that would make a lesson unplayable, in words (empty: it plays). The schema checks the shape. */
export function lessonProblems(lesson: Lesson, files: Set<string> = new Set()): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  lesson.pieces.forEach((p, i) => {
    if (ids.has(p.id)) problems.push(`pieces[${i}]: id ${p.id} used twice`);
    ids.add(p.id);
    if (p.image && !files.has(p.image.file)) problems.push(`pieces[${i}]: image ${p.image.file} is not in the package`);
    if (p.key !== undefined && p.key >= p.sentences.length) problems.push(`pieces[${i}]: key ${p.key} is no sentence`);
    for (const g of p.glossary ?? []) if (!p.sentences.some(s => s.includes(g.term))) problems.push(`pieces[${i}]: hard word «${g.term}» is in none of its sentences (write it as the text does)`);
    for (const k of Object.keys(p.easy ?? {})) if (!(Number(k) >= 0 && Number(k) < p.sentences.length)) problems.push(`pieces[${i}]: easy ${k} is no sentence`);
  });
  // Each path is a whole lesson of its own: every piece read, and asked about only once read
  for (const profile of LESSON_PROFILES) {
    const read = new Set<string>();
    lesson.script.forEach((s, i) => {
      if (!plays(s, profile)) return;
      if (s.do === 'read') read.add(s.piece);
      if ((s.do === 'ask' || s.do === 'explain') && s.piece && !read.has(s.piece))
        problems.push(`script[${i}] (${s.do}): asks on piece ${s.piece} before it is read${s.for ? '' : ` (${profile} path)`}`);
    });
    for (const p of lesson.pieces) if (!read.has(p.id)) problems.push(`piece ${p.id} is never read on the ${profile} path`);
    if (!lesson.script.some(s => s.do === 'ask' && plays(s, profile))) problems.push(`the ${profile} path has no question`);
  }
  lesson.script.forEach((s, i) => {
    const where = `script[${i}] (${s.do})`;
    const piece = 'piece' in s ? pieceOf(lesson, s.piece) : undefined;
    if ('piece' in s && s.piece !== undefined && !piece) problems.push(`${where}: no piece ${s.piece}`);
    if (s.for && (s.do === 'intro' || s.do === 'choose' || s.do === 'end')) problems.push(`${where}: is on every path (no "for")`);
    if (s.do !== 'ask') return;
    if (s.picture && !files.has(s.picture)) problems.push(`${where}: picture ${s.picture} is not in the package`);
    const q = s.question;
    const n = piece?.sentences.length ?? 0;
    for (const e of q.evidence ?? []) if (e < 0 || e >= n) problems.push(`${where}: evidence ${e} is no sentence of its piece`);
    switch (q.type) {
      case 'multiple-choice':
        if (q.correctIndex >= q.options.length) problems.push(`${where}: correctIndex past the options`);
        if (new Set(q.options).size !== q.options.length) problems.push(`${where}: two options are the same`);
        break;
      case 'fill-blank': {
        const gaps = [...q.textWithGaps.matchAll(/\{(\d+)\}/g)].length;
        if (gaps !== q.correctAnswers.length) problems.push(`${where}: ${gaps} gaps, ${q.correctAnswers.length} answers`);
        for (const a of q.correctAnswers) if (!q.options.includes(a)) problems.push(`${where}: answer «${a}» not in the word bank`);
        break;
      }
      case 'ordering':
        if (new Set(q.items.map(it => it.id)).size !== q.items.length) problems.push(`${where}: two items share an id`);
        break;
      case 'match-pairs':
        if (new Set(q.pairs.map(p => p.left)).size !== q.pairs.length) problems.push(`${where}: two pairs share a left side`);
        if (new Set(q.pairs.map(p => p.right)).size !== q.pairs.length) problems.push(`${where}: two pairs share a right side`);
        break;
      case 'find-sentence':
        if (!piece) problems.push(`${where}: find-sentence needs a piece`);
        for (const x of q.sentences) if (x < 0 || x >= n) problems.push(`${where}: sentence ${x} is no sentence of its piece`);
        break;
      case 'sort':
        if (!q.items.some(it => it.bin === 0) || !q.items.some(it => it.bin === 1)) problems.push(`${where}: both boxes need a card`);
        break;
      case 'spot':
        if (!files.has(q.image)) problems.push(`${where}: image ${q.image} is not in the package`);
        if (q.correct >= q.regions.length) problems.push(`${where}: correct past the regions`);
        break;
    }
  });
  for (const pg of lesson.pages ?? []) if (!files.has(pg.file)) problems.push(`page ${pg.page}: ${pg.file} is not in the package`);
  if (lesson.script.some(s => s.do === 'book') && !lesson.pages?.length) problems.push('script: a book step needs pages');
  if (lesson.script[lesson.script.length - 1]?.do !== 'end') problems.push('script: the last step must be end');
  if (lesson.script.filter(s => s.do === 'end').length !== 1) problems.push('script: exactly one end');
  for (const [text, file] of Object.entries(lesson.audio ?? {})) if (!files.has(file)) problems.push(`audio for «${text.slice(0, 30)}…»: ${file} is not in the package`);
  return problems;
}

export const lessonStars = (lesson: Pick<Lesson, 'script'>, profile: LessonProfile) =>
  lesson.script.filter(s => 'star' in s && s.star && plays(s, profile)).length;

export function lessonSummary(lesson: Lesson, importedAt: string): LessonSummary {
  return {
    id: lesson.id, grade: lesson.grade, subject: lesson.subject, icon: lesson.icon, chapter: lesson.chapter,
    title: lesson.title, source: lesson.source, pieces: lesson.pieces.length, steps: lesson.script.length,
    stars: { adhd: lessonStars(lesson, 'adhd'), plain: lessonStars(lesson, 'plain') }, talk: lesson.talk ?? [], importedAt,
  };
}
