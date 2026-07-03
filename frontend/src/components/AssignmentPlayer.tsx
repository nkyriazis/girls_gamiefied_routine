import React, { useState } from 'react';
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

interface AssignmentPlayerProps {
  assignment: ExerciseAssignmentWithExercise;
  user: User;
  onClose: () => void;
}

export const AssignmentPlayer: React.FC<AssignmentPlayerProps> = ({ assignment, user, onClose }) => {
  const { playSuccess, playError } = useAppSounds();
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [attemptKey, setAttemptKey] = useState(0); // remounts the renderer for a clean retry

  const exercise = assignment.exercise;
  if (!exercise) return null;

  const handleAnswer = async (answer: any) => {
    if (submitting || feedback) return;
    setSubmitting(true);
    try {
      const result = await api.answerExerciseAssignment(assignment.id, answer);
      setFeedback(result.correct ? 'correct' : 'incorrect');
      if (result.correct) {
        playSuccess();
        // Star earned — celebrate briefly, then return to the list
        setTimeout(() => onClose(), 1800);
      } else {
        playError();
        // Wrong — reset for another try
        setTimeout(() => {
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

  const renderExercise = () => {
    switch (exercise.type) {
      case 'multiple-choice':
        return <MultipleChoiceRenderer exercise={exercise} onAnswer={handleAnswer} disabled={submitting} />;
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

  return (
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
        <div className="assignment-reward">⭐ {exercise.stars}</div>
        <button className="exit-game-btn" onClick={onClose}>✕</button>
      </div>

      <div className="assignment-stage">
        <div className="assignment-content" key={attemptKey}>
          <h1 className="assignment-title">{exercise.title}</h1>
          {exercise.body && <p className="assignment-body">{exercise.body}</p>}
          {exercise.figure && (
            <div className="assignment-figure">
              <SmartIcon value={exercise.figure} size={220} style={{ borderRadius: '1rem' }} />
            </div>
          )}
          {'question' in exercise && exercise.question && (
            <div className="assignment-question">{exercise.question}</div>
          )}
          <div className="assignment-renderer">{renderExercise()}</div>
        </div>
      </div>

      <AnimatePresence>
        {feedback && (
          <motion.div
            className={`feedback-overlay ${feedback}`}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
          >
            <div className="feedback-icon">{feedback === 'correct' ? '✨' : '❌'}</div>
            <div className="feedback-text">
              {feedback === 'correct' ? `+⭐${exercise.stars}` : 'Δοκίμασε ξανά!'}
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
          z-index: 5000;
          color: white;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .assignment-header {
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

        .assignment-stage {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 2rem;
          overflow-y: auto;
        }

        .assignment-content {
          width: 100%;
          max-width: 900px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 1.5rem;
        }

        .assignment-title {
          font-size: 2rem;
          margin: 0;
          text-shadow: 0 4px 10px rgba(0,0,0,0.5);
        }

        .assignment-body {
          font-size: 1.15rem;
          opacity: 0.8;
          margin: 0;
          max-width: 700px;
        }

        .assignment-question {
          font-size: 1.6rem;
          font-weight: bold;
          color: #a0a0ff;
        }

        .assignment-renderer {
          width: 100%;
          max-width: 700px;
        }

        .feedback-overlay {
          position: fixed;
          inset: 0;
          margin: auto;
          width: fit-content;
          height: fit-content;
          z-index: 6000;
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
  );
};
