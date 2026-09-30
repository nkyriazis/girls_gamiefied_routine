import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../context/GameContext';
import { api } from '../api';
import { AssignmentPlayer } from './AssignmentPlayer';
import { help } from '../help/anchors';
import type { ExerciseAssignmentWithExercise, User } from '@shared/types';

// One kid's exercises: today's set and «Κι άλλο πρόβλημα» for more stars. On her own
// screen (the store, from her avatar) and in the exercises drawer. The player opens
// over everything, through a portal, so it isn't caught inside a scaled modal.

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
  const extraLimit = config.settings.extraProblemsPerDay ?? 10;

  const mine = exerciseAssignments.filter(a => a.userId === user.id);
  const daily = mine.filter(a => !a.extra);
  const extras = mine.filter(a => a.extra);
  const extrasDone = extras.filter(a => a.status === 'completed');
  const openExtra = extras.find(a => a.status === 'pending');
  const canAsk = !!user.grade && extraLimit > 0;
  const completed = daily.filter(a => a.status === 'completed').length;

  // One more problem, on top of the daily set: the open one if there is one, else a fresh one
  const askForProblem = async () => {
    if (asking) return;
    setAsking(true);
    try {
      const a = await api.startExtraProblem(user.id);
      setStarted(a);
      setPlayingId(a.id);
    } catch (err) {
      console.error('Could not start a problem:', err);
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
          {completed === daily.length ? 'Όλες οι σημερινές έτοιμες! 🎉' : `Σήμερα: ${completed} από ${daily.length}`}
        </div>
      )}
      <div className="assignment-list">
        {daily.map(assignment => {
          const ex = assignment.exercise;
          if (!ex) return null;
          const isDone = assignment.status === 'completed';
          return (
            <motion.button
              key={assignment.id}
              data-assignment={assignment.id}
              {...help('exercises.card')}
              className={`assignment-card ${isDone ? 'completed' : ''}`}
              onClick={() => !isDone && setPlayingId(assignment.id)}
              disabled={isDone}
              whileTap={!isDone ? { scale: 0.97 } : {}}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="assignment-icon">{CATEGORY_ICONS[ex.category] || '📚'}</div>
              <div className="assignment-info">
                <h4>{ex.title}</h4>
                <span className="assignment-meta">
                  {ex.category} · {TYPE_LABELS[ex.type] || ex.type}
                  {ex.type === 'problem' && !isDone && (assignment.stepIndex ?? 0) > 0 &&
                    ` · βήμα ${(assignment.stepIndex ?? 0) + 1} από ${ex.steps.length}`}
                </span>
              </div>
              <div className="assignment-status">
                {isDone
                  ? <span className="done-badge">✓ ⭐{assignment.starsAwarded ?? ex.stars}</span>
                  : <span className="star-badge">⭐ {ex.stars}</span>}
              </div>
            </motion.button>
          );
        })}
      </div>

      {canAsk && (
        <div className="extra-problems">
          {extrasDone.length > 0 && (
            <span className="extra-done">
              🧩 Έξτρα σήμερα: {extrasDone.length} · ⭐{extrasDone.reduce((n, a) => n + (a.starsAwarded ?? 0), 0)}
            </span>
          )}
          <motion.button
            className="extra-btn"
            data-extra={user.id}
            {...help('exercises.more')}
            disabled={asking || (!openExtra && extras.length >= extraLimit)}
            whileTap={{ scale: 0.97 }}
            onClick={askForProblem}
          >
            {openExtra
              ? <>▶ Συνέχισε το πρόβλημα</>
              : extras.length >= extraLimit
                ? <>Για σήμερα φτάνει! 🎉</>
                : <>🧩 Κι άλλο πρόβλημα <span className="extra-count">{extras.length}/{extraLimit}</span></>}
          </motion.button>
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
        .extra-count { font-size: 0.85rem; font-weight: normal; opacity: 0.8; }
        .assignment-card { display: flex; align-items: center; gap: 1rem; background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 0.8rem 1rem; color: white; cursor: pointer;
          text-align: left; transition: all 0.2s; }
        .assignment-card:hover:not(:disabled) { border-color: rgba(255, 214, 10, 0.5); background: rgba(255, 214, 10, 0.05); }
        .assignment-card.completed { opacity: 0.6; cursor: default; border-color: rgba(6, 214, 160, 0.4); background: rgba(6, 214, 160, 0.05); }
        .assignment-icon { font-size: 1.8rem; flex-shrink: 0; }
        .assignment-info { flex: 1; min-width: 0; }
        .assignment-info h4 { margin: 0 0 0.2rem 0; font-size: 1.05rem; }
        .assignment-meta { font-size: 0.8rem; opacity: 0.6; }
        .assignment-status { flex-shrink: 0; font-weight: bold; }
        .star-badge { color: #ffd60a; font-size: 1rem; }
        .done-badge { color: #06d6a0; font-size: 0.95rem; }
      `}</style>
    </section>
  );
};
