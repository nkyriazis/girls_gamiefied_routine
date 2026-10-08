import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../context/GameContext';
import { api, ApiError } from '../api';
import { AssignmentPlayer } from './AssignmentPlayer';
import { help } from '../help/anchors';
import type { ExerciseAssignmentWithExercise, User } from '@shared/types';
import { MAX_SET_ASIDE, extraRefusals, finishOneFirst } from '@shared/extraProblems';
import { sfx, sound } from '../sound/sfx';
import { paysNow } from '@shared/forgiveness';

// One kid's exercises: today's set and «Κι άλλο πρόβλημα» for more stars. On her own
// screen (the store, from her avatar) and in the exercises drawer. The player opens
// over everything, through a portal, so it isn't caught inside a scaled modal.
// An extra problem she leaves with ✕ stays a card («Έξτρα») until she finishes it or the
// day ends, and the button draws a new one (#67): at most MAX_SET_ASIDE wait at once.

const CATEGORY_ICONS: Record<string, string> = {
  'Μαθηματικά': '🔢',
  'Γλώσσα': '📖',
  'Προβλήματα': '🧩',
};

const TYPE_LABELS: Record<string, string> = {
  'multiple-choice': 'Επίλεξε τη σωστή απάντηση',
  'true-false': 'Σωστό ή Λάθος',
  'match-pairs': 'Σύνδεσε τα ζευγάρια',
  'ordering': 'Βάλε στη σειρά',
  'fill-blank': 'Συμπλήρωσε τα κενά',
  'number-input': 'Γράψε τον αριθμό',
  'problem': 'Πρόβλημα σε βήματα',
};

export const UserExercises: React.FC<{ user: User; header?: React.ReactNode }> = ({ user, header }) => {
  const { exerciseAssignments, config } = useGame();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [started, setStarted] = useState<ExerciseAssignmentWithExercise | null>(null);
  const [asking, setAsking] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const extraLimit = config.settings.extraProblemsPerDay ?? 10;

  const mine = exerciseAssignments.filter(a => a.userId === user.id);
  const daily = mine.filter(a => !a.extra);
  const extras = mine.filter(a => a.extra);
  const extrasDone = extras.filter(a => a.status === 'completed');
  const extrasWaiting = extras.filter(a => a.status === 'pending');
  const canAsk = !!user.grade && extraLimit > 0;
  const atLimit = extras.length >= extraLimit;
  const tooMany = extrasWaiting.length >= MAX_SET_ASIDE;
  const completed = daily.filter(a => a.status === 'completed').length;

  // One more problem, on top of the daily set: always a new one (one she left is a card above)
  const askForProblem = async () => {
    if (asking) return;
    setAsking(true);
    try {
      const a = await api.startExtraProblem(user.id);
      setStarted(a);
      setPlayingId(a.id);
    } catch (err) {
      // The server refused: say why, under the button (never a browser alert())
      console.error('Could not start a problem:', err);
      sfx('nope');
      const why = err instanceof ApiError ? err.message : '';
      const text = why.startsWith('No problems for this kid') ? 'Δεν υπάρχουν ακόμα προβλήματα για την τάξη σου.'
        : why === 'No more extra problems today' ? 'Για σήμερα φτάνει! Αύριο κι άλλα.'
        : (Object.values(extraRefusals) as string[]).includes(why) ? why
        : 'Κάτι πήγε στραβά. Δοκίμασε ξανά.';
      setRefusal(text);
      setTimeout(() => setRefusal(current => current === text ? null : current), 3500);
    } finally {
      setAsking(false);
    }
  };

  // The player follows the broadcast state (a just-started extra may not be in it yet)
  const playing = playingId ? mine.find(a => a.id === playingId) ?? (started?.id === playingId ? started : null) : null;

  return (
    <section className="user-exercises">
      {header ?? null}
      {daily.length > 0 && (
        <div className="ue-summary">
          {completed === daily.length ? 'Τα σημερινά τελείωσαν! 🎉' : `Σήμερα: ${completed} από ${daily.length}`}
        </div>
      )}
      <div className="assignment-list">
        {daily.map(assignment => (
          <AssignmentCard key={assignment.id} assignment={assignment} user={user} anchor={help('exercises.card')} onPlay={setPlayingId} />
        ))}
      </div>

      {(canAsk || extrasWaiting.length > 0) && (
        <div className="extra-problems">
          {extrasDone.length > 0 && (
            <span className="extra-done">
              🧩 Έξτρα σήμερα: {extrasDone.length} · ⭐{extrasDone.reduce((n, a) => n + (a.starsAwarded ?? 0), 0)}
            </span>
          )}
          {/* The ones she left with ✕: hers until she finishes them or the day ends, drawn even if a
              parent has since turned extras off or cleared her class */}
          {extrasWaiting.map(assignment => (
            <AssignmentCard key={assignment.id} assignment={assignment} user={user} anchor={help('exercises.extra')} extra onPlay={setPlayingId} />
          ))}
          {canAsk && (
            <motion.button
              className="extra-btn"
              data-extra={user.id}
              // The owl tells her to tap it only while she can: at the day's limit or with
              // MAX_SET_ASIDE waiting it has no anchor, so the step is skipped and its own words say why
              {...(atLimit || tooMany ? {} : help('exercises.more'))}
              {...sound('open')}
              disabled={asking || atLimit || tooMany}
              whileTap={{ scale: 0.97 }}
              onClick={askForProblem}
            >
              {atLimit
                ? <>Για σήμερα φτάνει! 🎉</>
                : tooMany
                  ? <>{finishOneFirst}</>
                  : <>🧩 Κι άλλο πρόβλημα <span className="extra-count">{extras.length}/{extraLimit}</span></>}
            </motion.button>
          )}
          <AnimatePresence>
            {refusal && (
              <motion.div className="ue-refusal" role="alert"
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0, x: [0, -8, 8, -5, 5, 0] }} exit={{ opacity: 0 }}>
                {refusal}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {createPortal(
        <AnimatePresence>
          {playing && <AssignmentPlayer assignment={playing} user={user} onClose={() => setPlayingId(null)} />}
        </AnimatePresence>,
        document.body
      )}

      <style>{`
        .user-exercises { display: flex; flex-direction: column; gap: 0.75rem; }
        .ue-summary { font-size: 0.95rem; opacity: 0.75; }
        .assignment-list { display: flex; flex-direction: column; gap: 0.6rem; }
        .extra-problems { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.25rem; }
        .extra-done { font-size: 0.9rem; opacity: 0.75; padding-left: 0.25rem; }
        .extra-btn { padding: 0.9rem 1rem; border-radius: 16px; border: 2px dashed rgba(255, 214, 10, 0.6);
          background: rgba(255, 214, 10, 0.08); color: white; font-size: 1.05rem; font-weight: bold; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 0.6rem; }
        .extra-btn:disabled { opacity: 0.55; cursor: default; }
        .ue-refusal { font-size: 0.95rem; font-weight: 600; text-align: center; color: #ff6b6b;
          background: rgba(255,107,107,0.12); padding: 0.4rem 0.75rem; border-radius: 0.75rem; }
        .extra-count { font-size: 0.85rem; font-weight: normal; opacity: 0.8; }
        .assignment-card { display: flex; align-items: center; gap: 1rem; background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 0.8rem 1rem; color: white; cursor: pointer;
          text-align: left; transition: all 0.2s; }
        .assignment-card:hover:not(:disabled) { border-color: rgba(255, 214, 10, 0.5); background: rgba(255, 214, 10, 0.05); }
        .assignment-card.extra-card { border-style: dashed; border-color: rgba(255, 214, 10, 0.45); }
        .assignment-card.completed { opacity: 0.6; cursor: default; border-color: rgba(6, 214, 160, 0.4); background: rgba(6, 214, 160, 0.05); }
        .assignment-icon { font-size: 1.8rem; flex-shrink: 0; }
        .assignment-info { flex: 1; min-width: 0; }
        .assignment-info h4 { margin: 0 0 0.2rem 0; font-size: 1.05rem; }
        .assignment-meta { font-size: 0.8rem; opacity: 0.6; }
        .revision-pill { display: inline-block; margin-left: 0.5rem; padding: 0.1rem 0.55rem; border-radius: 999px; vertical-align: 0.1em;
          font-size: 0.72rem; font-weight: 600; color: #d9c2ff; background: rgba(155, 93, 229, 0.22); border: 1px solid rgba(155, 93, 229, 0.5); }
        .assignment-status { flex-shrink: 0; font-weight: bold; }
        .star-badge { color: #ffd60a; font-size: 1rem; }
        .done-badge { color: #06d6a0; font-size: 0.95rem; }
        .missed-badge { color: rgba(255, 255, 255, 0.55); font-size: 0.95rem; }
      `}</style>
    </section>
  );
};

// One card: a daily exercise, or an extra problem she left (`extra`: «Έξτρα» and the step she is at).
// `anchor` is the owl's {...help(…)}, written where the card is placed so check-help sees it
const AssignmentCard: React.FC<{
  assignment: ExerciseAssignmentWithExercise; user: User; anchor: ReturnType<typeof help>; extra?: boolean; onPlay: (id: string) => void;
}> = ({ assignment, user, anchor, extra = false, onPlay }) => {
  const ex = assignment.exercise;
  if (!ex) return null;
  const isDone = assignment.status === 'completed';
  // What it pays now (less after mistakes), or what it paid
  const pays = paysNow(assignment, ex, user);
  // The step she is at, once past the first (a card at its start says nothing about steps)
  const step = ex.type === 'problem' && !isDone && (assignment.stepIndex ?? 0) > 0
    ? `βήμα ${(assignment.stepIndex ?? 0) + 1} από ${ex.steps.length}` : null;
  return (
    <motion.button
      data-assignment={assignment.id}
      {...(extra ? { 'data-extra-card': assignment.userId } : {})}
      {...anchor}
      {...sound('open')}
      className={`assignment-card ${isDone ? 'completed' : ''} ${extra ? 'extra-card' : ''}`}
      onClick={() => !isDone && onPlay(assignment.id)}
      disabled={isDone}
      whileTap={!isDone ? { scale: 0.97 } : {}}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="assignment-icon">{CATEGORY_ICONS[ex.category] || '📚'}</div>
      <div className="assignment-info">
        <h4>
          {ex.title}
          {/* From a lower grade's pool, when hers has nothing in this category (#49) */}
          {assignment.revision && <span className="revision-pill" {...help('exercises.revision')}>Επανάληψη</span>}
        </h4>
        <span className="assignment-meta">
          {extra
            ? ['Έξτρα', step].filter(Boolean).join(' · ')
            : <>{ex.category} · {TYPE_LABELS[ex.type] || ex.type}{step && ` · ${step}`}</>}
        </span>
      </div>
      <div className="assignment-status">
        {/* Done and paid ✓; done and paid nothing (the answer shown): no ✓ */}
        {isDone
          ? pays > 0 ? <span className="done-badge">✓ ⭐{pays}</span> : <span className="missed-badge">○ ⭐0</span>
          : <span className="star-badge">⭐ {pays}</span>}
      </div>
    </motion.button>
  );
};
