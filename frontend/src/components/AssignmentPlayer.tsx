import React, { useContext, useEffect, useEffectEvent, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';
import type { ExerciseAssignmentWithExercise, User } from '@shared/types';
import { useAppSounds } from '../hooks/useAppSounds';
import { SmartIcon } from './SmartIcon';

import { MultipleChoiceRenderer } from './exercises/MultipleChoiceRenderer';
import { TrueFalseRenderer } from './exercises/TrueFalseRenderer';
import { MatchPairsRenderer } from './exercises/MatchPairsRenderer';
import { OrderingRenderer } from './exercises/OrderingRenderer';
import { FillBlankRenderer } from './exercises/FillBlankRenderer';
import { NumberInputRenderer } from './exercises/NumberInputRenderer';
import { ProblemPlayer } from './exercises/ProblemPlayer';
import { help } from '../help/anchors';
import { HelpButton, HelpScreen } from '../help/HelpProvider';
import { HelpCovered } from '../help/context';
import { answerTour, exerciseTour } from './AssignmentPlayer.help';
import { sfx, sound } from '../sound/sfx';
import { paysNow } from '@shared/forgiveness';
import { answerText } from './exercises/answerText';

interface AssignmentPlayerProps {
  assignment: ExerciseAssignmentWithExercise;
  user: User;
  onClose: () => void;
}

// What the overlay says: what was paid, «try again», or the right answer (the exercise is over).
// 'paid': a problem whose last step was shown worked is over: what it paid, in the calm blue, no «Σωστά!»
type Feedback = { kind: 'correct'; stars: number } | { kind: 'incorrect' } | { kind: 'answer'; text: string } | { kind: 'paid'; stars: number };

// «Η σωστή απάντηση: …» has no reading timer (#72): «Εντάξει» or ✕ closes it, at her own pace. Only a
// kiosk left alone with it on screen closes it, after this long in sight, the same way and in silence.
const ANSWER_HOLD_MS = 120_000;

export const AssignmentPlayer: React.FC<AssignmentPlayerProps> = ({ assignment, user, onClose }) => {
  const { playSuccess, playError } = useAppSounds();
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [attemptKey, setAttemptKey] = useState(0); // remounts the renderer for a clean retry

  // The timers this screen starts (a celebration's close, «Δοκίμασε ξανά»'s reset) go with it: ✕ during
  // «+⭐1» left one behind that closed the next exercise opened within 1.8 s
  const timers = useRef<number[]>([]);
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(t => window.clearTimeout(t));
  }, []);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };

  // The right answer's safety close counts only while she can see it. A routine or an alarm over the
  // screen (Dashboard's <HelpCover covered>, #51) keeps the player as it was, so the count stops there
  // and starts again from 0 when the cover goes: the answer is still up when her routine ends.
  const covered = useContext(HelpCovered);
  const answerUp = feedback?.kind === 'answer';
  const closeUnread = useEffectEvent(() => onClose());
  useEffect(() => {
    if (!answerUp || covered) return;
    const t = window.setTimeout(() => closeUnread(), ANSWER_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [answerUp, covered]);

  // The header's ⭐ is what the exercise pays now (shared/forgiveness.ts): after a mistake it
  // drops with a small pulse, silently (no «−1», no red, no sound)
  const pays = assignment.exercise ? paysNow(assignment, assignment.exercise, user) : 0;
  const [shownPays, setShownPays] = useState({ value: pays, pulse: 0 });
  if (shownPays.value !== pays) setShownPays({ value: pays, pulse: shownPays.pulse + (pays < shownPays.value ? 1 : 0) });

  const exercise = assignment.exercise;
  if (!exercise) return null;
  // On the forgiving rung, after a wrong try, she may see the right answer (it pays nothing now anyway)
  const canShow = exercise.type !== 'problem' && (user.forgiveness ?? 'forgiving') === 'forgiving'
    && assignment.status === 'pending' && assignment.attempts > 0;
  // A problem gets the whole stage as a fixed frame (title in the header), so nothing moves between its steps
  const isProblem = exercise.type === 'problem';

  const handleAnswer = async (answer: unknown) => {
    if (submitting || feedback) return;
    setSubmitting(true);
    try {
      const result = await api.answerExerciseAssignment(assignment.id, answer);
      if (result.correct) {
        setFeedback({ kind: 'correct', stars: result.starsAwarded });
        playSuccess();
        if (result.starsAwarded > 0) sfx('stars', { delay: 350 });
        // Celebrate briefly, then return to the list
        later(onClose, 1800);
      } else if (result.assignment.status === 'completed') {
        // Unforgiving, and her tries are used: the right answer, until she closes it
        playError();
        setFeedback({ kind: 'answer', text: answerText(exercise) });
      } else {
        setFeedback({ kind: 'incorrect' });
        playError();
        // Wrong — reset for another try
        later(() => {
          setFeedback(null);
          setSubmitting(false);
          setAttemptKey(k => k + 1);
        }, 1500);
      }
    } catch (err) {
      console.error('Answer submission failed:', err);
      setSubmitting(false);
    }
  };

  // «Δείξε μου»: the right answer, and the exercise is over; it stays until she closes it
  const reveal = async () => {
    if (submitting || feedback) return;
    setSubmitting(true);
    try {
      await api.revealExerciseAssignment(assignment.id);
      setFeedback({ kind: 'answer', text: answerText(exercise) });
    } catch (err) {
      console.error('Could not show the answer:', err);
      setSubmitting(false);
    }
  };

  // A problem checks its own steps; this only celebrates the last one, with what it paid
  // (or, when the screen worked it, only says what it paid).
  const handleSolved = (stars: number, shown: boolean) => {
    setFeedback(shown ? { kind: 'paid', stars } : { kind: 'correct', stars });
    later(onClose, 1800);
  };

  const renderExercise = () => {
    switch (exercise.type) {
      case 'problem':
        return <ProblemPlayer assignment={assignment} exercise={exercise} onSolved={handleSolved} reading={user.problemReading} forgiveness={user.forgiveness} />;
      case 'multiple-choice':
        return <MultipleChoiceRenderer exercise={exercise} onAnswer={handleAnswer} disabled={submitting} seed={assignment.id} />;
      case 'true-false':
        return <TrueFalseRenderer exercise={exercise} onAnswer={handleAnswer} disabled={submitting} />;
      case 'match-pairs':
        return <MatchPairsRenderer exercise={exercise} onAnswer={handleAnswer} disabled={submitting} />;
      case 'ordering':
        return <OrderingRenderer exercise={exercise} onAnswer={handleAnswer} disabled={submitting} />;
      case 'fill-blank':
        return <FillBlankRenderer exercise={exercise} onAnswer={handleAnswer} disabled={submitting} />;
      case 'number-input':
        return <NumberInputRenderer exercise={exercise} onAnswer={handleAnswer} disabled={submitting} />;
      default:
        return <div>Τύπος άσκησης μη διαθέσιμος</div>;
    }
  };

  // The owl sits in the header; a problem says what each of its steps needs itself. While the right
  // answer is up, the owl explains only its card (the exercise below is over).
  const tour = isProblem ? null
    : feedback?.kind === 'answer' ? answerTour(user.id)
    : exerciseTour(user.id, exercise.type, user.forgiveness, canShow);
  return (
    <HelpScreen tour={tour} inline>
    <motion.div
      className="assignment-player"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="assignment-header">
        <div className="assignment-user" style={{ '--user-color': user.color } as React.CSSProperties}>
          <SmartIcon value={user.avatar || '👧'} size={40} />
          <span>{user.name}</span>
        </div>
        <h1 className="assignment-header-title">{exercise.title}</h1>
        <motion.div key={shownPays.pulse} className="assignment-reward" {...help('exercise.stars')}
          initial={shownPays.pulse ? { scale: 1.45 } : false} animate={{ scale: 1 }} transition={{ duration: 0.45 }}>⭐ {pays}</motion.div>
        <HelpButton inline />
        <button className="exit-game-btn" onClick={onClose} {...help('exercise.exit')} {...sound('close')}>✕</button>
      </div>

      <div className={`assignment-stage ${isProblem ? 'problem-mode' : ''}`}>
        {isProblem ? (
          <div className="assignment-content">{renderExercise()}</div>
        ) : (
          // The question on the left, the answer on the right (stacked on narrow screens)
          <div className="assignment-split" key={attemptKey}>
            <div className="assignment-ask" {...help('exercise.ask')}>
              {exercise.body && <p className="assignment-body">{exercise.body}</p>}
              {exercise.figure && (
                <div className="assignment-figure">
                  <SmartIcon value={exercise.figure} size={200} style={{ borderRadius: '1rem' }} />
                </div>
              )}
              {'question' in exercise && exercise.question && (
                <div className="assignment-question">{exercise.question}</div>
              )}
            </div>
            <div className="assignment-renderer" {...help('exercise.answer')}>
              {renderExercise()}
              {canShow && (
                <button type="button" className="exercise-show" {...help('exercise.show')} {...sound('open')} disabled={submitting} onClick={reveal}>
                  💡 Δείξε μου τη σωστή απάντηση
                </button>
              )}
            </div>
          </div>
        )}

        {/* The right answer stays until «Εντάξει» or ✕. The backdrop under it, over the stage only (the
            header's ✕ and owl stay free), takes stray touches in silence: the exercise below is over, and
            a brush of the screen while she reads closes nothing. The card itself does nothing on a tap. */}
        {feedback?.kind === 'answer' && (
          <div className="answer-backdrop">
            <motion.div
              className="feedback-overlay answer"
              {...help('exercise.revealed')}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <div className="feedback-icon">💡</div>
              <div className="feedback-text">
                Η σωστή απάντηση:<br /><span className="feedback-answer">{feedback.text}</span>
              </div>
              <button type="button" className="answer-ok" onClick={onClose} {...sound('close')}>Εντάξει</button>
            </motion.div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {feedback && feedback.kind !== 'answer' && (
          <motion.div
            className={`feedback-overlay ${feedback.kind}`}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
          >
            <div className="feedback-icon">{feedback.kind === 'correct' ? '✨' : feedback.kind === 'paid' ? '🏁' : '❌'}</div>
            <div className="feedback-text">
              {feedback.kind === 'correct' ? (feedback.stars > 0 ? `+⭐${feedback.stars}` : '✔ Σωστά!')
                : feedback.kind === 'paid' ? (feedback.stars > 0 ? `+⭐${feedback.stars}` : '⭐0')
                : 'Δοκίμασε ξανά!'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .assignment-player {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: radial-gradient(circle at center, #2a2a4a 0%, #000 100%);
          z-index: var(--z-player);
          color: white;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        /* Above the answer's backdrop (.answer-backdrop, z-index 10): ✕, the owl and its «Να σου δείξω;»,
           which hangs below the header over the stage, stay free to tap */
        .assignment-header {
          position: relative;
          z-index: 11;
          padding: 1rem 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(255, 255, 255, 0.05);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .assignment-user {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 1.2rem;
          font-weight: bold;
          padding: 0.4rem 1rem;
          border-radius: 2rem;
          border: 2px solid var(--user-color, gold);
          background: rgba(255, 255, 255, 0.05);
        }

        .assignment-reward {
          margin-right: 1rem;
          font-size: 1.4rem;
          font-weight: bold;
          color: gold;
        }

        .exit-game-btn {
          background: rgba(255, 71, 87, 0.2);
          border: 2px solid rgba(255, 71, 87, 0.5);
          color: white;
          padding: 0.5rem 1.2rem;
          border-radius: 1rem;
          cursor: pointer;
          font-size: 1.2rem;
          font-weight: bold;
        }

        .assignment-header-title {
          flex: 1;
          margin: 0 1.5rem;
          font-size: 1.5rem;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* A fixed frame: the stage never scrolls as a whole, only the part that needs to */
        .assignment-stage {
          position: relative;
          flex: 1;
          min-height: 0;
          display: flex;
          padding: 1rem 1.5rem;
          overflow: hidden;
        }

        .assignment-content {
          flex: 1;
          display: flex;
          min-height: 0;
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
        }

        .assignment-split {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          min-height: 0;
          overflow-y: auto;
          text-align: center;
        }

        .assignment-ask, .assignment-renderer {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.25rem;
        }

        /* Stacked: question and answer stay together, centred while they fit */
        .assignment-ask {
          margin-top: auto;
        }

        .assignment-renderer {
          margin-bottom: auto;
        }

        .assignment-renderer {
          width: 100%;
        }

        /* Stacked: «Δείξε μου» (it costs the exercise) well apart from whatever she taps to answer above it,
           on every plain type: the check, the OK of the numpad, the last option (#50 part 6).
           Side by side, the renderer's auto margins already keep them apart. */
        .exercise-show {
          margin-top: 1.5rem;
        }

        @media (min-width: 900px) and (orientation: landscape) {
          .assignment-split {
            flex-direction: row;
            align-items: stretch;
            overflow: hidden;
            gap: 2.5rem;
          }
          .assignment-ask {
            flex: 1;
            margin: 0;
            justify-content: center;
          }
          .assignment-renderer {
            flex: 1.2;
            margin: 0;
            min-height: 0;
            overflow-y: auto;
            padding: 0.25rem;
          }
          /* centred while it fits, scrolls from the top when it doesn't */
          .assignment-renderer > * {
            margin: auto 0;
          }
        }

        .assignment-body {
          font-size: 1.2rem;
          opacity: 0.85;
          margin: 0;
          max-width: 700px;
        }

        .assignment-question {
          font-size: 1.8rem;
          font-weight: bold;
          color: #a0a0ff;
        }

        .feedback-overlay {
          position: fixed;
          inset: 0;
          margin: auto;
          width: fit-content;
          height: fit-content;
          z-index: calc(var(--z-player) + 10);
          padding: 3rem 5rem;
          border-radius: 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          pointer-events: none;
        }

        .feedback-overlay.correct {
          background: rgba(46, 213, 115, 0.95);
          box-shadow: 0 0 50px rgba(46, 213, 115, 0.5);
        }

        .feedback-overlay.incorrect {
          background: rgba(255, 71, 87, 0.95);
          box-shadow: 0 0 50px rgba(255, 71, 87, 0.5);
        }

        .feedback-overlay.answer, .feedback-overlay.paid {
          background: rgba(60, 70, 160, 0.97);
          box-shadow: 0 0 50px rgba(120, 130, 255, 0.4);
          max-width: min(80vw, 900px);
          text-align: center;
        }

        /* Over the stage, under the header; it dims the exercise that is over */
        .answer-backdrop {
          position: absolute;
          inset: 0;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(0.5rem, 2vmin, 1rem);
          background: rgba(0, 0, 0, 0.35);
        }

        /* The answer card fits the stage on a phone and a small kiosk too: it scales with the screen,
           and a long answer scrolls inside it while «Εντάξει» stays in sight */
        .feedback-overlay.answer {
          position: relative;
          inset: auto;
          margin: 0;
          z-index: auto;
          height: auto;
          max-height: 100%;
          max-width: min(92vw, 900px);
          padding: clamp(1rem, 6vh, 3rem) clamp(1.25rem, 5vw, 5rem);
          gap: clamp(0.5rem, 2vh, 1rem);
          pointer-events: auto;
        }
        .feedback-overlay.answer .feedback-icon {
          flex-shrink: 0;
          font-size: clamp(2.5rem, min(12vw, 10vh), 5rem);
          line-height: 1;
        }
        .feedback-overlay.answer .feedback-text {
          min-height: 0;
          overflow-y: auto;
          font-size: clamp(1.5rem, min(6vw, 5vh), 2.5rem);
        }
        .answer-ok {
          flex-shrink: 0;
          min-height: 48px;
          padding: 0.5rem 2.5rem;
          border-radius: 1.2rem;
          font-size: clamp(1.15rem, 3vmin, 1.5rem);
          font-weight: bold;
          cursor: pointer;
          color: #1e2470;
          background: white;
          border: none;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
        }

        /* a match is one pair per line (answerText.ts): keep its line breaks */
        .feedback-answer {
          color: gold;
          white-space: pre-line;
        }

        .exercise-show {
          align-self: center;
          font-size: 1.15rem;
          font-weight: bold;
          padding: 0.8rem 1.4rem;
          border-radius: 1.2rem;
          cursor: pointer;
          color: white;
          background: rgba(255, 200, 0, 0.18);
          border: 2px solid rgba(255, 200, 0, 0.6);
        }

        .feedback-icon {
          font-size: 5rem;
        }

        .feedback-text {
          font-size: 2.5rem;
          font-weight: bold;
          text-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }
      `}</style>
    </motion.div>
    </HelpScreen>
  );
};
