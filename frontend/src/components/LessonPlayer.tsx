import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Exercise, User } from '@shared/types';
import {
  type Lesson, type LessonPiece, type LessonQuestion, type LessonRun, type LessonStep, BOOK_SAYS, asExercise, lessonStars, nextStop, pieceOf, profileOf, thinks, plays, type LessonProfile
} from '@shared/lessons';
import { api } from '../api';
import { SmartIcon } from './SmartIcon';
import { MultipleChoiceRenderer } from './exercises/MultipleChoiceRenderer';
import { TrueFalseRenderer } from './exercises/TrueFalseRenderer';
import { MatchPairsRenderer } from './exercises/MatchPairsRenderer';
import { OrderingRenderer } from './exercises/OrderingRenderer';
import { FillBlankRenderer } from './exercises/FillBlankRenderer';
import { help } from '../help/anchors';
import { HelpButton, HelpScreen } from '../help/HelpProvider';
import { lessonTour, type LessonHelpKind } from './LessonPlayer.help';
import { sfx, sound } from '../sound/sfx';

// A long-text lesson (shared/lessons.ts): the player runs the lesson's script, one step at a time, each step a block
// of this library. Reading: one short piece, its key sentence marked, the owl reading it line by line when she chose
// to listen (🔊 says any line again). Questions: the piece stays beside them; a wrong try lights the sentence that
// holds the answer and says so under the question; after the second the answer is shown and she goes on. No clock,
// no lives. The server keeps her place (each step names its index), so ✕ and a reload come back where she was.

interface Props {
  lessonId: string;
  user: User;
  run: LessonRun | undefined;
  onClose: () => void;
}

const fileUrl = (lessonId: string, file: string) => `/api/lessons/${lessonId}/files/${file}`;

// --- The owl's voice: a lesson's clips, one at a time ---

function useNarration(lesson: Lesson | null) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const run = useRef(0);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const stop = useCallback(() => {
    run.current++;
    audio.current?.pause();
    audio.current = null;
    setSpeaking(null);
  }, []);
  /** Say the lines in order; `onLine` hears which one is being said */
  const say = useCallback((lines: string[], onLine?: (i: number) => void) => {
    stop();
    const mine = run.current;
    const next = (i: number) => {
      if (mine !== run.current || !lesson) return;
      const file = lesson.audio?.[lines[i]];
      if (i >= lines.length) { setSpeaking(null); onLine?.(-1); return; }
      if (!file) { next(i + 1); return; }
      onLine?.(i);
      setSpeaking(lines[i]);
      const a = new Audio(fileUrl(lesson.id, file));
      audio.current = a;
      a.onended = () => window.setTimeout(() => next(i + 1), 250);
      a.onerror = () => next(i + 1);
      void a.play().catch(() => next(i + 1));
    };
    next(0);
  }, [lesson, stop]);
  useEffect(() => stop, [stop]);
  return { say, stop, speaking, has: (text: string) => !!lesson?.audio?.[text] };
}

type Narration = ReturnType<typeof useNarration>;

export const LessonPlayer: React.FC<Props> = ({ lessonId, user, run, onClose }) => {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [failed, setFailed] = useState(false);
  // Her place: where the server put her with this screen's last answer (the place she had when it opened, before
  // any). STATE moves ahead of a step's feedback (✔, the answer shown), so this screen follows its own answers.
  const [local, setLocal] = useState<LessonRun | undefined>(run);
  const current = local ?? run;
  // Her path through the package: the ADHD one (breaks, think first…) when her switch is on, else the plain one
  const profile = profileOf(user);
  const [busy, setBusy] = useState(false);
  const [starFlash, setStarFlash] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(t => window.clearTimeout(t)), []);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  const voice = useNarration(lesson);

  useEffect(() => {
    let live = true;
    api.getLesson(lessonId).then(l => { if (live) setLesson(l); }, () => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [lessonId]);

  if (failed) return <Shell user={user} title="Μάθημα" onClose={onClose} tour={null}><p className="lp-note">Το μάθημα δεν άνοιξε. Δοκίμασε ξανά.</p></Shell>;
  if (!lesson) return <Shell user={user} title="Μάθημα" onClose={onClose} tour={null}><p className="lp-note">Φόρτωση…</p></Shell>;

  const script = lesson.script;
  // Her place, on her path (the server's is too; this passes over steps masked for the other path at once)
  const stopIndex = nextStop(lesson, current?.stop ?? 0, profile);
  const step: LessonStep = script[Math.min(stopIndex, script.length - 1)];
  const listen = current?.choices?.mode === 'listen';

  /** Send this step's answer (or nothing: read, moved, explained); the result goes back to the block that asked. */
  const send = async (answer?: unknown) => {
    if (busy) return null;
    setBusy(true);
    try {
      const result = await api.lessonStep(lesson.id, user.id, stopIndex, answer);
      setBusy(false);
      return result;
    } catch {
      setBusy(false);
      sfx('nope');
      return null;
    }
  };
  /** Go on to where the server put her, with a star first when the step paid one */
  const advance = (next: LessonRun, stars: number) => {
    voice.stop();
    const go = () => { setStarFlash(false); setLocal(next); };
    if (stars > 0) {
      sfx('stars');
      setStarFlash(true);
      later(go, 1700);
    } else go();
    if (script[next.stop]?.do === 'end') sfx('done', { delay: stars > 0 ? 1700 : 0 });
  };
  const pass = async (answer?: unknown) => {
    const result = await send(answer);
    if (result) advance(result.run, result.starsAwarded);
  };
  const restart = async () => {
    if (busy) return;
    setBusy(true);
    try { setLocal(await api.restartLesson(lesson.id, user.id)); } finally { setBusy(false); }
  };

  const kind: LessonHelpKind = step.do === 'ask'
    ? (step.question.type === 'find-sentence' ? 'find' : step.question.type === 'sort' ? 'sort' : step.question.type === 'spot' ? 'spot' : step.picture ? 'picture' : thinks(step, profile) ? 'think' : 'question')
    : step.do;

  return (
    <Shell user={user} title={lesson.title} onClose={() => { voice.stop(); onClose(); }} tour={lessonTour(user.id, kind)}
      progress={<Progress lesson={lesson} stop={stopIndex} profile={profile} />} stars={current?.paid.length ?? 0}>
      <AnimatePresence mode="wait">
        <motion.div key={`${stopIndex}-${current?.round ?? 1}`} className="lp-stage" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3 }}>
          {step.do === 'intro' && <Intro lesson={lesson} profile={profile} busy={busy} onGo={() => pass()} />}
          {step.do === 'choose' && <Choose step={step} busy={busy} onPick={v => pass(v)} />}
          {step.do === 'move' && <Move step={step} busy={busy} lesson={lesson} stop={stopIndex} onDone={() => pass()} voice={voice} listen={listen} />}
          {step.do === 'read' && <Read lesson={lesson} piece={pieceOf(lesson, step.piece)!} voice={voice} listen={listen} busy={busy} onDone={() => pass()} />}
          {step.do === 'ask' && <Ask key={stopIndex} lesson={lesson} step={step} stopIndex={stopIndex} think={thinks(step, profile)} voice={voice} listen={listen} send={send} advance={advance} />}
          {step.do === 'book' && <Book lesson={lesson} when={step.when} busy={busy} voice={voice} listen={listen} onDone={() => pass()} />}
          {step.do === 'explain' && <Explain lesson={lesson} step={step} busy={busy} voice={voice} listen={listen} onDone={() => pass()} />}
          {step.do === 'end' && <End lesson={lesson} profile={profile} run={current} busy={busy} onAgain={restart} onClose={onClose} />}
        </motion.div>
      </AnimatePresence>
      <AnimatePresence>
        {starFlash && (
          <motion.div className="lp-flash star" role="status" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.2, opacity: 0 }}>
            <span className="lp-flash-star">+⭐1</span><span>Μπράβο!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </Shell>
  );
};

// --- The frame ---

const Shell: React.FC<{
  user: User; title: string; onClose: () => void; tour: ReturnType<typeof lessonTour> | null;
  progress?: React.ReactNode; stars?: number; children: React.ReactNode;
}> = ({ user, title, onClose, tour, progress, stars, children }) => (
  <HelpScreen tour={tour} inline>
    <motion.div className="lesson-player" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="lp-header">
        <div className="lp-user" style={{ '--user-color': user.color } as React.CSSProperties}>
          <SmartIcon value={user.avatar || '👧'} size={36} />
          <span>{user.name}</span>
        </div>
        <h1 className="lp-title">{title}</h1>
        {stars !== undefined && <div className="lp-earned">⭐ {stars}</div>}
        <HelpButton inline />
        <button className="lp-exit" onClick={onClose} {...help('lesson.exit')} {...sound('close')}>✕</button>
      </div>
      {progress}
      <div className="lp-body">{children}</div>
      <style>{STYLES}</style>
    </motion.div>
  </HelpScreen>
);

/** One dot per piece (in the order the script reads them) and ★ for the review: done, now, to come */
const Progress: React.FC<{ lesson: Lesson; stop: number; profile: LessonProfile }> = ({ lesson, stop, profile }) => {
  const reads = lesson.script.flatMap((s, i) => (s.do === 'read' && plays(s, profile) ? [i] : []));
  const firstReview = lesson.script.findIndex(s => s.do === 'ask' && s.review && plays(s, profile));
  const endAt = lesson.script.length - 1;
  const spanEnd = (k: number) => (k + 1 < reads.length ? reads[k + 1] : firstReview >= 0 ? firstReview : endAt) - 1;
  return (
    <div className="lp-progress" {...help('lesson.progress')}>
      {reads.map((r, k) => {
        const done = stop > spanEnd(k);
        const now = stop >= r && !done;
        return <span key={r} className={`lp-dot ${done ? 'done' : ''} ${now ? 'now' : ''}`}>{done ? '✓' : k + 1}</span>;
      })}
      {firstReview >= 0 && <span className={`lp-dot review ${stop >= firstReview && stop < endAt ? 'now' : ''} ${stop >= endAt ? 'done' : ''}`}>★</span>}
    </div>
  );
};

// --- The blocks ---

const Intro: React.FC<{ lesson: Lesson; profile: LessonProfile; busy: boolean; onGo: () => void }> = ({ lesson, profile, busy, onGo }) => {
  const moves = lesson.script.filter(s => s.do === 'move' && plays(s, profile)).length;
  return (
    <div className="lp-card lp-start">
      <div className="lp-big-icon">{lesson.icon ?? '📖'}</div>
      <div className="lp-subject">{lesson.subject}{lesson.chapter ? ` · κεφάλαιο ${lesson.chapter}` : ''}</div>
      <h2>{lesson.title}</h2>
      <ul className="lp-plan">
        <li>📖 {lesson.pieces.length} μικρά κομμάτια</li>
        <li>❓ Μετά από κάθε κομμάτι, λίγες ερωτήσεις</li>
        <li>⭐ {lessonStars(lesson, profile)} αστέρια να κερδίσεις</li>
        {moves > 0 && <li>🤸 Διαλείμματα για κίνηση</li>}
      </ul>
      <button type="button" className="lp-next" {...help('lesson.next')} {...sound('open')} disabled={busy} onClick={onGo}>Ξεκίνα →</button>
    </div>
  );
};

const Choose: React.FC<{ step: Extract<LessonStep, { do: 'choose' }>; busy: boolean; onPick: (v: string) => void }> = ({ step, busy, onPick }) => (
  <div className="lp-card lp-choose" {...help('lesson.choose')}>
    <h2>{step.question}</h2>
    <div className="lp-choices">
      {step.options.map(o => (
        <button key={o.value} type="button" className="lp-choice" {...sound('select')} disabled={busy} onClick={() => onPick(o.value)}>
          <span className="lp-choice-icon">{o.icon}</span>{o.label}
        </button>
      ))}
    </div>
    <p className="lp-note">Μπορείς πάντα να πατήσεις 🔊 σε μια πρόταση για να την ακούσεις.</p>
  </div>
);

const Move: React.FC<{ step: Extract<LessonStep, { do: 'move' }>; lesson: Lesson; stop: number; busy: boolean; voice: Narration; listen: boolean; onDone: () => void }> = ({ step, lesson, stop, busy, voice, listen, onDone }) => {
  const { say } = voice;
  useEffect(() => { if (listen) say([step.text]); }, [listen, step.text, say]);
  const piecesRead = lesson.script.slice(0, stop).filter(s => s.do === 'read').length;
  return (
    <div className="lp-card lp-break" {...help('lesson.break')}>
      <div className="lp-big-icon lp-bounce">{step.icon}</div>
      <h2>{step.warmup ? 'Πριν ξεκινήσουμε…' : 'Ώρα για κίνηση!'}</h2>
      <p className="lp-move">{step.text}</p>
      {!step.warmup && <p className="lp-note">Τελείωσες {piecesRead} από {lesson.pieces.length} κομμάτια. Μπράβο!</p>}
      <button type="button" className="lp-next" {...help('lesson.next')} {...sound('open')} disabled={busy} onClick={onDone}>Το έκανα! →</button>
    </div>
  );
};

/** A sentence with its hard words marked: a tap on one opens what it means (and the owl says it) */
const Words: React.FC<{ text: string; glossary: LessonPiece['glossary']; open: string | null; onWord: (term: string) => void; anchor: boolean }> = ({ text, glossary = [], open, onWord, anchor }) => {
  const terms = [...glossary].map(g => g.term).sort((a, b) => b.length - a.length);
  if (!terms.length) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let rest = text;
  let first = anchor;
  while (rest) {
    const hits = terms.map(t => ({ t, at: rest.indexOf(t) })).filter(h => h.at >= 0).sort((a, b) => a.at - b.at || b.t.length - a.t.length);
    if (!hits.length) { parts.push(rest); break; }
    const { t, at } = hits[0];
    if (at > 0) parts.push(rest.slice(0, at));
    parts.push(
      <button key={parts.length} type="button" className={`lp-hard ${open === t ? 'open' : ''}`} {...(first ? help('lesson.word') : {})} {...sound('select')} onClick={() => onWord(t)}>{t}</button>
    );
    first = false;
    rest = rest.slice(at + t.length);
  }
  return <>{parts}</>;
};

/** A piece: one sentence a line, the key one marked, hard words to tap, «💡 Πιο απλά» on hard sentences, 🔊 on each;
 *  in listen mode the owl reads it, the line being read lit */
const PieceText: React.FC<{
  lesson: Lesson; piece: LessonPiece; voice: Narration; reading?: number; lit?: number[]; greyed?: number[];
  pick?: (i: number) => void; compact?: boolean; showKey?: boolean; invite?: boolean;
}> = ({ lesson, piece, voice, reading = -1, lit = [], greyed = [], pick, compact, showKey = true, invite }) => {
  const [word, setWord] = useState<string | null>(null);
  const [easy, setEasy] = useState<number[]>([]);
  const firstHard = piece.sentences.findIndex(s => (piece.glossary ?? []).some(g => s.includes(g.term)));
  const firstEasy = piece.sentences.findIndex((_, i) => piece.easy?.[i]);
  const tapWord = (term: string) => {
    if (word === term) { setWord(null); return; }
    setWord(term);
    const g = piece.glossary?.find(x => x.term === term);
    if (g) voice.say([`${g.term}: ${g.meaning}`]);
  };
  const tapEasy = (i: number) => {
    const on = !easy.includes(i);
    setEasy(e => (on ? [...e, i] : e.filter(x => x !== i)));
    if (on && piece.easy?.[i]) voice.say([piece.easy[i]]);
  };
  return (
    <div className={`lp-piece ${compact ? 'compact' : ''} ${pick ? 'picking' : ''} ${invite ? 'invite' : ''}`} {...help('lesson.text')}>
      <div className="lp-piece-title">{lesson.pieces.indexOf(piece) + 1}. {piece.title}</div>
      <div className="lp-sentences">
        {piece.sentences.map((s, i) => {
          const cls = `lp-sentence ${showKey && piece.key === i ? 'key' : ''} ${lit.includes(i) ? 'lit' : ''} ${reading === i ? 'reading' : ''} ${greyed.includes(i) ? 'greyed' : ''}`;
          if (pick) return <button key={i} type="button" className={`${cls} pick`} {...sound('select')} disabled={greyed.includes(i)} onClick={() => pick(i)}>{s}</button>;
          const g = piece.glossary?.find(x => x.term === word && s.includes(x.term));
          return (
            <div key={i} className="lp-line">
              <div className={cls} {...(showKey && piece.key === i ? help('lesson.key') : {})}>
                {voice.has(s) && <button type="button" className="lp-ear" aria-label="Άκου" {...(i === 0 ? help('lesson.listen') : {})} {...sound('none')} onClick={() => voice.say([s])}>🔊</button>}
                <span><Words text={s} glossary={piece.glossary} open={word} onWord={tapWord} anchor={i === firstHard} /></span>
                {piece.easy?.[i] && (
                  <button type="button" className={`lp-easy-btn ${easy.includes(i) ? 'on' : ''}`} {...(i === firstEasy ? help('lesson.easy') : {})} {...sound('none')} onClick={() => tapEasy(i)}>💡 Πιο απλά</button>
                )}
              </div>
              <AnimatePresence>
                {g && (
                  <motion.div key="w" className="lp-meaning" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <b>{g.term}</b>: {g.meaning}
                  </motion.div>
                )}
                {easy.includes(i) && piece.easy?.[i] && (
                  <motion.div key="e" className="lp-easy" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    💡 {piece.easy[i]}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** The book's own pages: one at a time, ◀ ▶ between them, a tap zooms in where she taps */
const Book: React.FC<{ lesson: Lesson; when: 'before' | 'after'; busy: boolean; voice: Narration; listen: boolean; onDone: () => void }> = ({ lesson, when, busy, voice, listen, onDone }) => {
  const pages = lesson.pages ?? [];
  const [at, setAt] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const { say } = voice;
  useEffect(() => { if (listen) say([BOOK_SAYS[when]]); }, [listen, when, say]);
  const go = (d: number) => { setZoom(null); setAt(a => Math.max(0, Math.min(pages.length - 1, a + d))); };
  const page = pages[at];
  return (
    <div className="lp-book" {...help('lesson.book')}>
      <div className="lp-book-head">
        <h2>{when === 'before' ? '📖 Το βιβλίο σου' : '📖 Βρες τα στο βιβλίο'}</h2>
        <p className="lp-note">{when === 'before' ? 'Ρίξε μια ματιά στις σελίδες: τον τίτλο, τις εικόνες.' : 'Κοίτα ξανά τις σελίδες. Τι αναγνωρίζεις από όσα έμαθες;'} Πάτα πάνω στη σελίδα για να μεγαλώσει.</p>
      </div>
      <div className="lp-book-view">
        <button type="button" className="lp-book-nav" {...sound('page')} disabled={at === 0} onClick={() => go(-1)} aria-label="Προηγούμενη">◀</button>
        {page && (
          <button type="button" className={`lp-book-page ${zoom ? 'zoomed' : ''}`} {...sound('select')}
            onClick={e => {
              if (zoom) { setZoom(null); return; }
              const r = e.currentTarget.getBoundingClientRect();
              setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
            }}>
            <img src={fileUrl(lesson.id, page.file)} alt={`σελίδα ${page.page}`} style={zoom ? { transform: 'scale(2.2)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined} />
          </button>
        )}
        <button type="button" className="lp-book-nav" {...sound('page')} disabled={at >= pages.length - 1} onClick={() => go(1)} aria-label="Επόμενη">▶</button>
      </div>
      <div className="lp-book-foot">
        <span className="lp-note">Σελίδα {page?.page} · {at + 1} από {pages.length}</span>
        <button type="button" className="lp-next" {...sound('open')} disabled={busy} onClick={onDone}>Συνέχεια →</button>
      </div>
    </div>
  );
};

const Read: React.FC<{ lesson: Lesson; piece: LessonPiece; voice: Narration; listen: boolean; busy: boolean; onDone: () => void }> = ({ lesson, piece, voice, listen, busy, onDone }) => {
  const [reading, setReading] = useState(-1);
  // Once the owl has read it (or a moment after the piece shows, reading alone), the hard words pulse: tap them
  const [invite, setInvite] = useState(false);
  // Once per piece: `say` and `stop` are stable, the narration object around them is not
  const { say, stop } = voice;
  useEffect(() => {
    if (!listen) {
      const t = window.setTimeout(() => setInvite(true), 4000);
      return () => window.clearTimeout(t);
    }
    say([piece.title, ...piece.sentences], i => {
      setReading(i < 0 ? -1 : i - 1);
      if (i < 0) setInvite(true);
    });
    return () => stop();
  }, [listen, piece, say, stop]);
  return (
    <div className="lp-split reading">
      <PieceText lesson={lesson} piece={piece} voice={voice} reading={reading} invite={invite} />
      <div className="lp-side">
        {piece.image && (
          <figure className="lp-figure">
            <img src={fileUrl(lesson.id, piece.image.file)} alt="" />
            {piece.image.caption && <figcaption>{piece.image.caption}</figcaption>}
          </figure>
        )}
        {piece.key !== undefined && <p className="lp-key-note">⭐ Η πρόταση με το αστεράκι λέει το πιο σημαντικό.</p>}
        {(piece.glossary?.length ?? 0) > 0 && <p className="lp-key-note">Πάτα τις <span className="lp-hard-sample">υπογραμμισμένες</span> λέξεις για να δεις τι σημαίνουν.</p>}
        <button type="button" className="lp-next" {...help('lesson.next')} {...sound('page')} disabled={busy} onClick={onDone}>Διάβασα ✓</button>
      </div>
    </div>
  );
};

type Verdict = { kind: 'wrong'; text: string } | { kind: 'right' } | { kind: 'shown'; text: string };

/** The text of a right answer, to show it */
function answerWords(q: LessonQuestion, piece: LessonPiece | undefined): string {
  switch (q.type) {
    case 'multiple-choice': return q.options[q.correctIndex];
    case 'true-false': return q.correctValue ? 'Σωστό' : 'Λάθος';
    case 'fill-blank': return q.correctAnswers.reduce((t, a, i) => t.replace(`{${i}}`, a), q.textWithGaps);
    case 'ordering': return q.items.map((it, i) => `${i + 1}. ${it.content}`).join('\n');
    case 'match-pairs': return q.pairs.map(p => `${p.left} → ${p.right}`).join('\n');
    case 'find-sentence': return piece?.sentences[q.sentences[0]] ?? '';
    case 'sort': return q.bins.map((b, k) => `${b}: ${q.items.filter(it => it.bin === k).map(it => it.text).join(', ')}`).join('\n');
    case 'spot': return q.regions[q.correct]?.label ?? 'το σημείο με το πράσινο πλαίσιο';
  }
}

const Ask: React.FC<{
  lesson: Lesson; step: Extract<LessonStep, { do: 'ask' }>; stopIndex: number; think: boolean; voice: Narration; listen: boolean;
  send: (a: unknown) => Promise<import('@shared/lessons').LessonStepResult | null>;
  advance: (run: LessonRun, stars: number) => void;
}> = ({ lesson, step, stopIndex, think, voice, listen, send, advance }) => {
  const q = step.question;
  const piece = pieceOf(lesson, step.piece);
  const text = 'question' in q ? q.question : q.prompt ?? '';
  const [thought, setThought] = useState(!think);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [lit, setLit] = useState<number[]>([]);
  const [greyed, setGreyed] = useState<number[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState<{ run: LessonRun; stars: number } | null>(null);
  const [wrongSpot, setWrongSpot] = useState<number[]>([]);
  const { say } = voice;
  useEffect(() => { if (listen) say([text]); }, [listen, text, say]);

  const answer = async (a: unknown) => {
    if (verdict?.kind === 'right' || verdict?.kind === 'shown') return;
    const r = await send(a);
    if (!r) return;
    if (r.correct) {
      sfx('correct');
      setVerdict({ kind: 'right' });
      window.setTimeout(() => advance(r.run, r.starsAwarded), 1000);
    } else if (r.shown !== undefined) {
      sfx('wrong');
      if (q.type === 'find-sentence') setLit(q.sentences);
      else if (q.evidence) setLit(q.evidence);
      setVerdict({ kind: 'shown', text: answerWords(q, piece) });
      setPending({ run: r.run, stars: r.starsAwarded });
    } else {
      sfx('wrong');
      if (q.type === 'find-sentence' && typeof a === 'number') {
        setGreyed(g => [...g, a]);
        setVerdict({ kind: 'wrong', text: 'Όχι αυτή. Δοκίμασε άλλη πρόταση.' });
      } else if (q.type === 'spot' && typeof a === 'number') {
        setWrongSpot(w => [...w, a]);
        setVerdict({ kind: 'wrong', text: 'Όχι εκεί. Κοίτα ξανά την εικόνα.' });
      } else {
        const ev = r.evidence?.sentences ?? [];
        setLit(ev);
        setVerdict({ kind: 'wrong', text: ev.length ? 'Όχι ακόμα. Δες την πρόταση που φωτίστηκε αριστερά και δοκίμασε ξανά.'
          : step.picture ? 'Όχι ακόμα. Κοίτα ξανά την εικόνα και δοκίμασε ξανά.' : 'Όχι ακόμα. Δοκίμασε ξανά.' });
      }
      setAttempt(n => n + 1);
    }
  };

  const exercise = asExercise(lesson, q, String(stopIndex));
  const done = verdict?.kind === 'right' || verdict?.kind === 'shown';
  return (
    <div className={`lp-split asking ${piece || step.picture ? '' : 'alone'}`}>
      {step.picture ? (
        // The question is about what the picture shows: it takes the text's place
        <figure className="lp-figure lp-ask-picture" {...help('lesson.picture')}>
          <img src={fileUrl(lesson.id, step.picture)} alt="" />
        </figure>
      ) : piece && (
        <PieceText lesson={lesson} piece={piece} voice={voice} lit={lit} greyed={greyed} compact showKey={q.type !== 'find-sentence'}
          pick={q.type === 'find-sentence' && !done ? i => answer(i) : undefined} />
      )}
      <div className="lp-side">
        <div className="lp-ask" {...help('lesson.ask')}>
          {step.review && <div className="lp-review-pill">Επανάληψη</div>}
          <div className="lp-question">{voice.has(text) && <button type="button" className="lp-ear" aria-label="Άκου" {...sound('none')} onClick={() => voice.say([text])}>🔊</button>}{text}</div>
          {!thought ? (
            <div className="lp-think" {...help('lesson.think')}>
              <div className="lp-think-bubble">💭 Σκέψου την απάντηση στο μυαλό σου πρώτα.</div>
              <button type="button" className="lp-next" {...sound('open')} onClick={() => setThought(true)}>Το σκέφτηκα →</button>
            </div>
          ) : q.type === 'find-sentence' ? (
            <div className="lp-find-hint">👈 Πάτα μια πρόταση στο κείμενο.</div>
          ) : q.type === 'sort' ? (
            <Sort key={attempt} q={q} disabled={done} onAnswer={answer} />
          ) : q.type === 'spot' ? (
            <Spot lesson={lesson} q={q} disabled={done} wrong={wrongSpot} shown={verdict?.kind === 'shown'} onAnswer={answer} />
          ) : (
            <div className="lp-answer" {...help('lesson.answer')}>{exercise && render(exercise, answer, done, `${lesson.id}:${stopIndex}`, attempt)}</div>
          )}
          <AnimatePresence>
            {verdict && (
              <motion.div key={`${verdict.kind}-${attempt}`} className={`lp-verdict ${verdict.kind}`} role="status"
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0, x: verdict.kind === 'wrong' ? [0, -8, 8, -4, 4, 0] : 0 }} exit={{ opacity: 0 }}>
                {verdict.kind === 'right' && <>✔ Σωστά!</>}
                {verdict.kind === 'wrong' && <>{verdict.text}</>}
                {verdict.kind === 'shown' && (
                  <>
                    <div>💡 Η σωστή απάντηση:</div>
                    <div className="lp-shown">{verdict.text}</div>
                    <button type="button" className="lp-next" {...sound('open')} onClick={() => pending && advance(pending.run, pending.stars)}>Συνέχεια →</button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

function render(exercise: Exercise, onAnswer: (a: unknown) => void, disabled: boolean, seed: string, attempt: number) {
  switch (exercise.type) {
    case 'multiple-choice': return <MultipleChoiceRenderer key={attempt} exercise={exercise} onAnswer={onAnswer} disabled={disabled} seed={seed} />;
    case 'true-false': return <TrueFalseRenderer key={attempt} exercise={exercise} onAnswer={onAnswer} disabled={disabled} />;
    case 'match-pairs': return <MatchPairsRenderer key={attempt} exercise={exercise} onAnswer={onAnswer} disabled={disabled} />;
    case 'ordering': return <OrderingRenderer key={attempt} exercise={exercise} onAnswer={onAnswer} disabled={disabled} />;
    case 'fill-blank': return <FillBlankRenderer key={attempt} exercise={exercise} onAnswer={onAnswer} disabled={disabled} />;
    default: return null;
  }
}

/** Cards into two boxes: each card has a button for each box; «Έλεγχος» once every card has one */
const Sort: React.FC<{ q: Extract<LessonQuestion, { type: 'sort' }>; disabled: boolean; onAnswer: (a: number[]) => void }> = ({ q, disabled, onAnswer }) => {
  const [placed, setPlaced] = useState<(0 | 1 | null)[]>(() => q.items.map(() => null));
  const set = (i: number, b: 0 | 1) => setPlaced(p => p.map((x, j) => (j === i ? (x === b ? null : b) : x)));
  return (
    <div className="lp-sort" {...help('lesson.sort')}>
      <div className="lp-sort-head"><span>◀ {q.bins[0]}</span><span>{q.bins[1]} ▶</span></div>
      {q.items.map((it, i) => (
        <div key={it.text} className={`lp-sort-row at-${placed[i] ?? 'none'}`}>
          <button type="button" className={`lp-sort-bin ${placed[i] === 0 ? 'on' : ''}`} {...sound('place')} disabled={disabled} onClick={() => set(i, 0)}>◀</button>
          <div className="lp-sort-card">{it.text}</div>
          <button type="button" className={`lp-sort-bin ${placed[i] === 1 ? 'on' : ''}`} {...sound('place')} disabled={disabled} onClick={() => set(i, 1)}>▶</button>
        </div>
      ))}
      <button type="button" className="fb-check lp-check" disabled={disabled || placed.some(p => p === null)} onClick={() => onAnswer(placed as number[])}>Έλεγχος</button>
    </div>
  );
};

/** Tap the place on a picture: its regions are faint frames; a wrong one goes red, the right one green when shown */
const Spot: React.FC<{ lesson: Lesson; q: Extract<LessonQuestion, { type: 'spot' }>; disabled: boolean; wrong: number[]; shown: boolean; onAnswer: (i: number) => void }> = ({ lesson, q, disabled, wrong, shown, onAnswer }) => (
  <div className="lp-spot" {...help('lesson.spot')}>
    <img src={fileUrl(lesson.id, q.image)} alt="" />
    {q.regions.map((r, i) => (
      <button key={i} type="button" aria-label={r.label ?? `σημείο ${i + 1}`} {...sound('select')} disabled={disabled}
        className={`lp-spot-region ${wrong.includes(i) ? 'wrong' : ''} ${shown && i === q.correct ? 'right' : ''}`}
        style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` }} onClick={() => onAnswer(i)} />
    ))}
  </div>
);

const Explain: React.FC<{ lesson: Lesson; step: Extract<LessonStep, { do: 'explain' }>; busy: boolean; voice: Narration; listen: boolean; onDone: () => void }> = ({ lesson, step, busy, voice, listen, onDone }) => {
  const piece = pieceOf(lesson, step.piece);
  const { say } = voice;
  useEffect(() => { if (listen) say([step.prompt]); }, [listen, step.prompt, say]);
  return (
    <div className={`lp-split asking ${piece ? '' : 'alone'}`}>
      {piece && <PieceText lesson={lesson} piece={piece} voice={voice} compact />}
      <div className="lp-side">
        <div className="lp-card lp-explain" {...help('lesson.explain')}>
          <div className="lp-big-icon">🗣️</div>
          <h2>{step.prompt}</h2>
          <p className="lp-note">Βρες κάποιον από την οικογένεια και πες το δυνατά, με δικά σου λόγια.</p>
          {step.stems && step.stems.length > 0 && (
            <div className="lp-stems">{step.stems.map(s => <span key={s} className="lp-stem">{s}</span>)}</div>
          )}
          <button type="button" className="lp-next" {...sound('open')} disabled={busy} onClick={onDone}>Το εξήγησα ✓</button>
        </div>
      </div>
    </div>
  );
};

const End: React.FC<{ lesson: Lesson; profile: LessonProfile; run: LessonRun | undefined; busy: boolean; onAgain: () => void; onClose: () => void }> = ({ lesson, profile, run, busy, onAgain, onClose }) => (
  <div className="lp-card lp-end">
    <div className="lp-big-icon">🎉</div>
    <h2>Τέλος μαθήματος!</h2>
    <p className="lp-move">{lesson.title}: όλα τα κομμάτια και η επανάληψη.</p>
    <p className="lp-stars">⭐ {run?.paid.length ?? 0} από {lessonStars(lesson, profile)}</p>
    {(run?.round ?? 1) > 1 && <p className="lp-note">Τα αστέρια τα κέρδισες την πρώτη φορά. Τώρα το μάθημα μένει ακόμα καλύτερα!</p>}
    <div className="lp-end-buttons">
      <button type="button" className="lp-again" {...help('lesson.again')} {...sound('open')} disabled={busy} onClick={onAgain}>🔁 Ξανά από την αρχή</button>
      <button type="button" className="lp-next" {...sound('close')} onClick={onClose}>Κλείσιμο</button>
    </div>
  </div>
);

const STYLES = `
  .lesson-player { position: fixed; inset: 0; z-index: var(--z-player); color: white; display: flex; flex-direction: column;
    overflow: hidden; background: radial-gradient(circle at 30% 20%, #2b2f5a 0%, #12142b 70%, #000 100%); }
  .lp-header { position: relative; z-index: 11; display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 1.25rem;
    background: rgba(255,255,255,0.05); border-bottom: 1px solid rgba(255,255,255,0.1); }
  .lp-user { display: flex; align-items: center; gap: 0.5rem; font-weight: bold; padding: 0.3rem 0.9rem; border-radius: 2rem;
    border: 2px solid var(--user-color, gold); background: rgba(255,255,255,0.05); }
  .lp-title { flex: 1; margin: 0; font-size: 1.4rem; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lp-earned { font-size: 1.3rem; font-weight: bold; color: gold; }
  .lp-exit { background: rgba(255,71,87,0.2); border: 2px solid rgba(255,71,87,0.5); color: white; padding: 0.4rem 1.1rem;
    border-radius: 1rem; cursor: pointer; font-size: 1.2rem; font-weight: bold; min-height: 44px; }
  .lp-progress { display: flex; justify-content: center; gap: 0.5rem; padding: 0.6rem 1rem 0; flex-wrap: wrap; }
  .lp-dot { width: 2.1rem; height: 2.1rem; border-radius: 50%; display: grid; place-items: center; font-weight: bold; font-size: 0.95rem;
    background: rgba(255,255,255,0.08); border: 2px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.6); transition: all 0.3s; }
  .lp-dot.done { background: rgba(6,214,160,0.25); border-color: #06d6a0; color: #06d6a0; }
  .lp-dot.now { background: rgba(255,214,10,0.25); border-color: #ffd60a; color: white; transform: scale(1.15); box-shadow: 0 0 14px rgba(255,214,10,0.45); }
  .lp-dot.review { margin-left: 0.5rem; }
  .lp-body { position: relative; flex: 1; min-height: 0; display: flex; padding: 1rem 1.5rem 1.25rem; }
  .lp-stage { flex: 1; min-height: 0; display: flex; width: 100%; max-width: 1200px; margin: 0 auto; }
  .lp-card { margin: auto; text-align: center; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
    border-radius: 1.5rem; padding: clamp(1rem, 4vh, 2.5rem) clamp(1.25rem, 5vw, 3.5rem); max-width: 680px; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
  .lp-card h2 { margin: 0; font-size: clamp(1.5rem, 4.2vh, 2.2rem); }
  .lp-big-icon { font-size: clamp(3rem, 10vh, 5rem); line-height: 1; }
  .lp-bounce { animation: lp-bounce 1.2s ease-in-out infinite; }
  @keyframes lp-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
  .lp-subject { opacity: 0.75; font-size: 1.05rem; }
  .lp-plan { list-style: none; padding: 0; margin: 0.25rem 0 0.5rem; text-align: left; font-size: clamp(1.05rem, 2.8vh, 1.3rem); display: grid; gap: 0.4rem; }
  .lp-move { font-size: clamp(1.2rem, 3.5vh, 1.6rem); margin: 0; }
  .lp-note { opacity: 0.75; margin: 0; font-size: 1.05rem; }
  .lp-stars { font-size: 1.6rem; font-weight: bold; color: gold; margin: 0; }
  .lp-next, .lp-again { min-height: 52px; padding: 0.6rem 2rem; border-radius: 1.2rem; font-size: 1.25rem; font-weight: bold; cursor: pointer; border: none; }
  .lp-next { background: linear-gradient(135deg, #06d6a0, #0aa57f); color: #062b22; box-shadow: 0 6px 18px rgba(6,214,160,0.35); }
  .lp-again { background: rgba(255,255,255,0.1); color: white; border: 2px solid rgba(255,255,255,0.3); }
  .lp-next:disabled, .lp-again:disabled { opacity: 0.6; }
  .lp-end-buttons { display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; }
  .lp-choices { display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; margin: 0.5rem 0; }
  .lp-choice { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; width: 15rem; padding: 1.25rem 1rem; border-radius: 1.25rem;
    font-size: 1.15rem; font-weight: bold; color: white; cursor: pointer; background: rgba(255,255,255,0.08); border: 2px solid rgba(255,255,255,0.25); min-height: 44px; }
  .lp-choice:hover:not(:disabled) { border-color: #ffd60a; background: rgba(255,214,10,0.1); }
  .lp-choice-icon { font-size: 3rem; }
  .lp-split { flex: 1; min-height: 0; display: flex; gap: 2rem; align-items: stretch; }
  .lp-split.alone .lp-side { flex: 1; }
  .lp-piece { flex: 1.2; min-height: 0; overflow-y: auto; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 1.25rem; padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 0.9rem; }
  .lp-piece-title { font-size: 1.15rem; font-weight: bold; color: #ffd60a; }
  .lp-sentences { display: flex; flex-direction: column; gap: 0.55rem; font-size: clamp(1.2rem, 3.2vh, 1.55rem); line-height: 1.55; }
  .lp-piece.compact .lp-sentences { font-size: clamp(1.02rem, 2.5vh, 1.22rem); line-height: 1.45; gap: 0.4rem; }
  /* one sentence a line: her eyes find their place again after looking away */
  .lp-sentence { display: flex; gap: 0.5rem; align-items: flex-start; border-radius: 0.5rem; padding: 0.1rem 0.4rem;
    transition: background 0.3s, box-shadow 0.3s, opacity 0.3s; border-left: 4px solid transparent; }
  .lp-sentence.key { border-left-color: #ffd60a; background: rgba(255,214,10,0.08); }
  .lp-sentence.key > span::before { content: '⭐ '; }
  .lp-sentence.reading { background: rgba(0,180,216,0.22); box-shadow: 0 0 0 2px rgba(0,180,216,0.6); }
  .lp-sentence.lit { background: rgba(255,214,10,0.3); box-shadow: 0 0 0 2px rgba(255,214,10,0.8); }
  .lp-ear { flex-shrink: 0; background: none; border: none; cursor: pointer; font-size: 0.95em; opacity: 0.55; padding: 0 0.1rem; min-width: 32px; min-height: 32px; }
  .lp-ear:hover { opacity: 1; }
  .lp-piece.picking .lp-sentences { gap: 0.5rem; }
  .lp-sentence.pick { display: block; width: 100%; text-align: left; font: inherit; color: white; cursor: pointer; padding: 0.5rem 0.75rem;
    background: rgba(255,255,255,0.06); border: 2px dashed rgba(0,180,216,0.6); border-radius: 0.8rem; min-height: 44px; }
  .lp-sentence.pick:hover:not(:disabled) { background: rgba(0,180,216,0.15); }
  .lp-sentence.greyed { opacity: 0.35; text-decoration: line-through; }
  .lp-line { display: flex; flex-direction: column; gap: 0.3rem; }
  .lp-hard { font: inherit; color: inherit; background: none; border: none; padding: 0; cursor: pointer; border-bottom: 2px dotted #a6f0ff; }
  .lp-hard.open { background: rgba(0,180,216,0.25); border-radius: 0.3rem; }
  .lp-hard-sample { border-bottom: 2px dotted #a6f0ff; }
  .lp-piece.invite .lp-hard { animation: lp-pulse 1.1s ease-in-out 3; }
  @keyframes lp-pulse { 0%, 100% { background: transparent; } 50% { background: rgba(166,240,255,0.35); border-radius: 0.3rem; } }
  .lp-meaning { margin-left: 2.4rem; padding: 0.45rem 0.8rem; border-radius: 0.8rem; font-size: 0.85em; background: rgba(0,180,216,0.16); border: 1px solid rgba(0,180,216,0.55); }
  .lp-meaning b { color: #a6f0ff; }
  .lp-easy-btn { flex-shrink: 0; align-self: center; margin-left: auto; white-space: nowrap; font-size: 0.75em; font-weight: 600; cursor: pointer; padding: 0.2rem 0.6rem;
    min-height: 32px; border-radius: 999px; color: #ffe8a3; background: rgba(255,214,10,0.1); border: 1px solid rgba(255,214,10,0.5); }
  .lp-easy-btn.on { background: rgba(255,214,10,0.3); }
  .lp-easy { margin-left: 2.4rem; padding: 0.45rem 0.8rem; border-radius: 0.8rem; font-size: 0.92em; background: rgba(255,214,10,0.12); border: 1px dashed rgba(255,214,10,0.55); overflow: hidden; }
  .lp-book { flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; gap: 0.6rem; }
  .lp-book-head { text-align: center; }
  .lp-book-head h2 { margin: 0 0 0.25rem; font-size: clamp(1.4rem, 3.8vh, 2rem); }
  .lp-book-view { flex: 1; min-height: 0; display: flex; align-items: center; gap: 1rem; }
  .lp-book-nav { min-width: 56px; min-height: 56px; border-radius: 50%; font-size: 1.4rem; cursor: pointer; color: white; background: rgba(255,255,255,0.1); border: 2px solid rgba(255,255,255,0.3); }
  .lp-book-nav:disabled { opacity: 0.3; }
  .lp-book-page { height: 100%; padding: 0; border: none; background: white; border-radius: 0.5rem; overflow: hidden; cursor: zoom-in; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
  .lp-book-page.zoomed { cursor: zoom-out; }
  .lp-book-page img { display: block; height: 100%; width: auto; transition: transform 0.35s ease; }
  .lp-book-foot { display: flex; align-items: center; gap: 1.5rem; }
  .lp-glossary { display: grid; gap: 0.4rem; font-size: 1.05rem; padding-top: 0.6rem; border-top: 1px dashed rgba(255,255,255,0.2); }
  .lp-word b { color: #a6f0ff; }
  .lp-key-note { margin: 0; opacity: 0.8; font-size: 1rem; }
  .lp-side { flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.1rem; overflow-y: auto; padding: 0.25rem; }
  .lp-figure { margin: 0; max-width: 100%; display: flex; flex-direction: column; align-items: center; gap: 0.4rem; min-height: 0; }
  .lp-figure img { max-width: 100%; max-height: 44vh; border-radius: 1rem; box-shadow: 0 8px 24px rgba(0,0,0,0.45); object-fit: contain; }
  .lp-figure figcaption { font-size: 0.95rem; opacity: 0.8; text-align: center; }
  .lp-ask-picture { align-self: center; }
  .lp-ask-picture img { max-height: 62vh; }
  .lp-ask { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 1rem; text-align: center; }
  .lp-question { font-size: clamp(1.3rem, 3.5vh, 1.75rem); font-weight: bold; color: #c9c9ff; }
  .lp-question .lp-ear { font-size: 1.1rem; margin-right: 0.3rem; }
  .lp-think { display: flex; flex-direction: column; align-items: center; gap: 1rem; }
  .lp-think-bubble { font-size: 1.25rem; padding: 1rem 1.5rem; border-radius: 1.5rem; background: rgba(155,93,229,0.18); border: 2px dashed rgba(155,93,229,0.6); }
  .lp-find-hint { font-size: 1.2rem; opacity: 0.85; }
  .lp-answer { width: 100%; }
  .lp-answer .options-grid { grid-template-columns: 1fr; gap: 0.8rem; }
  .lp-answer .option-btn { padding: 0.9rem 1.2rem; font-size: 1.15rem; }
  .lp-verdict { padding: 0.7rem 1.1rem; border-radius: 1rem; font-size: 1.15rem; font-weight: 600; display: flex; flex-direction: column; gap: 0.5rem; align-items: center; }
  .lp-verdict.wrong { background: rgba(60,70,160,0.6); border: 2px solid rgba(160,170,255,0.6); }
  .lp-verdict.right { background: rgba(46,213,115,0.25); border: 2px solid #2ed573; color: #b8ffd4; font-size: 1.4rem; }
  .lp-verdict.shown { background: rgba(60,70,160,0.75); border: 2px solid rgba(160,170,255,0.7); }
  .lp-shown { color: gold; white-space: pre-line; font-size: 1.25rem; }
  .lp-review-pill { padding: 0.15rem 0.8rem; border-radius: 999px; font-size: 0.9rem; font-weight: 600; color: #d9c2ff;
    background: rgba(155,93,229,0.22); border: 1px solid rgba(155,93,229,0.5); }
  .lp-sort { width: 100%; display: flex; flex-direction: column; gap: 0.5rem; }
  .lp-sort-head { display: flex; justify-content: space-between; font-weight: bold; color: #ffd60a; padding: 0 0.25rem; }
  .lp-sort-row { display: flex; align-items: center; gap: 0.5rem; transition: transform 0.25s; }
  .lp-sort-row.at-0 { transform: translateX(-10px); }
  .lp-sort-row.at-1 { transform: translateX(10px); }
  .lp-sort-card { flex: 1; padding: 0.55rem 0.8rem; border-radius: 0.8rem; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); font-size: 1.05rem; }
  .lp-sort-row.at-0 .lp-sort-card { border-color: #4dabf7; background: rgba(77,171,247,0.15); }
  .lp-sort-row.at-1 .lp-sort-card { border-color: #ff922b; background: rgba(255,146,43,0.15); }
  .lp-sort-bin { min-width: 48px; min-height: 44px; border-radius: 0.8rem; font-size: 1.2rem; cursor: pointer; color: white; background: rgba(255,255,255,0.08); border: 2px solid rgba(255,255,255,0.25); }
  .lp-sort-bin.on { background: rgba(255,214,10,0.3); border-color: #ffd60a; }
  .lp-check { align-self: center; margin-top: 0.4rem; min-height: 48px; padding: 0.5rem 1.8rem; border-radius: 1rem; font-size: 1.15rem; font-weight: bold;
    border: none; cursor: pointer; background: #ffd60a; color: #3a2600; }
  .lp-check:disabled { opacity: 0.45; cursor: default; }
  .lp-spot { position: relative; display: inline-block; max-width: 100%; }
  .lp-spot img { display: block; max-width: 100%; max-height: 50vh; border-radius: 1rem; }
  .lp-spot-region { position: absolute; border: 2px dashed rgba(255,255,255,0.75); border-radius: 0.6rem; background: rgba(255,255,255,0.06); cursor: pointer; min-width: 32px; min-height: 32px; }
  .lp-spot-region:hover:not(:disabled) { background: rgba(255,214,10,0.25); border-color: #ffd60a; }
  .lp-spot-region.wrong { border: 3px solid #ff4757; background: rgba(255,71,87,0.25); }
  .lp-spot-region.right { border: 3px solid #2ed573; background: rgba(46,213,115,0.3); }
  .lp-explain { max-width: 560px; }
  .lp-stems { display: flex; flex-direction: column; gap: 0.5rem; width: 100%; }
  .lp-stem { padding: 0.5rem 0.9rem; border-radius: 0.8rem; background: rgba(0,180,216,0.12); border: 1px dashed rgba(0,180,216,0.6); font-size: 1.1rem; text-align: left; }
  .lp-flash { position: fixed; left: 50%; top: 50%; translate: -50% -50%; z-index: calc(var(--z-player) + 10); pointer-events: none;
    padding: 1.5rem 2.5rem; border-radius: 1.5rem; font-size: clamp(1.3rem, 4vh, 2rem); font-weight: bold; text-align: center;
    display: flex; flex-direction: column; gap: 0.4rem; box-shadow: 0 0 50px rgba(0,0,0,0.4); }
  .lp-flash.star { background: rgba(255,190,11,0.97); color: #3a2600; }
  .lp-flash-star { font-size: clamp(2.5rem, 8vh, 4rem); }
  @media (max-width: 899px), (orientation: portrait) {
    .lp-split { flex-direction: column; gap: 1rem; overflow-y: auto; }
    .lp-piece { flex: none; overflow: visible; }
    .lp-side { flex: none; overflow: visible; }
    .lp-figure img { max-height: 32vh; }
  }
  @media (max-height: 520px) {
    .lp-header { padding: 0.35rem 1rem; }
    .lp-progress { padding-top: 0.3rem; }
    .lp-dot { width: 1.7rem; height: 1.7rem; font-size: 0.8rem; }
    .lp-body { padding: 0.5rem 1rem 0.75rem; }
  }
`;
