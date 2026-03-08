import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../context/GameContext';
import { api } from '../api';
import type { Exercise, ExerciseSession, User } from '@shared/types';
import { useAppSounds } from '../hooks/useAppSounds';
import { SmartIcon } from './SmartIcon';

// Sub-components for exercise types
import { MultipleChoiceRenderer } from './exercises/MultipleChoiceRenderer';
import { TrueFalseRenderer } from './exercises/TrueFalseRenderer';
import { MatchPairsRenderer } from './exercises/MatchPairsRenderer';
import { OrderingRenderer } from './exercises/OrderingRenderer';
import { FillBlankRenderer } from './exercises/FillBlankRenderer';

interface ExerciseGameProps {
  session: ExerciseSession;
  onClose: () => void;
}

export const ExerciseGame: React.FC<ExerciseGameProps> = ({ session, onClose }) => {
  const { users, activeExerciseSessions } = useGame();
  const { playSuccess, playError, playComplete } = useAppSounds();
  
  // Get the latest session state from context
  const currentSession = useMemo(() => 
    activeExerciseSessions.find(s => s.id === session.id) || session,
  [activeExerciseSessions, session]);

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [submittingUser, setSubmittingUser] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ userId: string, correct: boolean } | null>(null);

  // Load all exercises needed for this session
  useEffect(() => {
    const loadExercises = async () => {
      try {
        const allExercises = await api.getExercises();
        const sessionExercises = currentSession.exerciseIds.map((id: string) => 
          allExercises.find(e => e.id === id)
        ).filter(Boolean) as Exercise[];
        setExercises(sessionExercises);
      } catch (err) {
        console.error('Failed to load session exercises:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadExercises();
  }, [currentSession.exerciseIds]);

  const currentExerciseIndex = (currentSession.currentRound - 1) * currentSession.questionsPerRound + currentSession.currentQuestionIndex;
  const currentExercise = exercises[currentExerciseIndex];
  
  const players = useMemo(() => 
    currentSession.playerIds.map((id: string) => users.find(u => u.id === id)).filter(Boolean) as User[],
  [currentSession.playerIds, users]);

  // Overall question index (answers accumulate across rounds)
  const overallQuestionIndex = (currentSession.currentRound - 1) * currentSession.questionsPerRound + currentSession.currentQuestionIndex;

  const nextPlayerId = useMemo(() => {
    return currentSession.playerIds.find(pid => {
      const answers = currentSession.answers[pid] || [];
      return answers.length <= overallQuestionIndex;
    }) || currentSession.playerIds[0];
  }, [currentSession, overallQuestionIndex]);

  const handleAnswer = async (answer: any) => {
    if (submittingUser || feedback) return;
    
    setSubmittingUser(nextPlayerId);
    try {
      const result = await api.submitExerciseAnswer(currentSession.id, nextPlayerId, currentExercise.id, answer);
      
      setFeedback({ userId: nextPlayerId, correct: result.correct });
      if (result.correct) {
        playSuccess();
      } else {
        playError();
      }

      // Clear feedback after 1.5s
      setTimeout(() => {
        setFeedback(null);
        setSubmittingUser(null);
        // Note: we use result.correct here because feedback state might have changed
        if (currentSession.completedAt) {
          playComplete();
        }
      }, 1500);

    } catch (err) {
      console.error('Answer submission failed:', err);
      setSubmittingUser(null);
    }
  };

  if (isLoading) return <div className="game-loading">Προετοιμασία ερωτήσεων...</div>;
  if (!currentExercise && !currentSession.completedAt) return <div className="game-error">Σφάλμα φόρτωσης άσκησης.</div>;

  // Final Results Screen
  if (currentSession.completedAt) {
    return (
      <motion.div 
        className="game-container results-screen"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="results-card">
          <h1>Μπράβο! 🎉</h1>
          <h3>Το παιχνίδι ολοκληρώθηκε!</h3>
          
          <div className="final-scores">
            {players.map((player: User) => (
              <div key={player.id} className="player-result">
                <div className="player-avatar">
                   <SmartIcon value={player.avatar} />
                </div>
                <div className="player-info">
                  <span className="player-name">{player.name}</span>
                  <span className="player-stars">⭐ {currentSession.totalStarsEarned[player.id] || 0}</span>
                </div>
              </div>
            ))}
          </div>

          <motion.button 
            className="finish-btn"
            onClick={onClose}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Επιστροφή στο Ταμπλό
          </motion.button>
        </div>
      </motion.div>
    );
  }

  const renderExercise = () => {
    switch (currentExercise.type) {
      case 'multiple-choice':
        return <MultipleChoiceRenderer exercise={currentExercise as any} onAnswer={(ans: number) => handleAnswer(ans)} disabled={!!submittingUser} />;
      case 'true-false':
        return <TrueFalseRenderer exercise={currentExercise as any} onAnswer={(ans: boolean) => handleAnswer(ans)} disabled={!!submittingUser} />;
      case 'match-pairs':
        return <MatchPairsRenderer exercise={currentExercise as any} onAnswer={(ans: any[]) => handleAnswer(ans)} disabled={!!submittingUser} />;
      case 'ordering':
        return <OrderingRenderer exercise={currentExercise as any} onAnswer={(ans: string[]) => handleAnswer(ans)} disabled={!!submittingUser} />;
      case 'fill-blank':
        return <FillBlankRenderer exercise={currentExercise as any} onAnswer={(ans: string[]) => handleAnswer(ans)} disabled={!!submittingUser} />;
      default:
        return <div>Τύπος άσκησης μη διαθέσιμος</div>;
    }
  };

  return (
    <div className="game-container">
      {/* Header Info */}
      <div className="game-header">
        <div className="game-progress">
          <div className="round-indicator">Γύρος {currentSession.currentRound} / {currentSession.totalRounds}</div>
          <div className="question-indicator">Ερώτηση {currentSession.currentQuestionIndex + 1} / {currentSession.questionsPerRound}</div>
        </div>
        
        <div className="players-scores">
          {players.map((player: User) => (
            <div key={player.id} className={`player-puck ${nextPlayerId === player.id ? 'active-turn' : ''}`}>
              <span className="player-puck-name">{player.name}</span>
              <span className="player-puck-stars">⭐ {currentSession.totalStarsEarned[player.id] || 0}</span>
            </div>
          ))}
        </div>

        <button className="exit-game-btn" onClick={onClose}>✕ Έξοδος</button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div 
          key={currentExercise.id}
          className="exercise-stage"
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -300, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <div className="exercise-content">
            <h1 className="exercise-title">{currentExercise.title}</h1>
            {currentExercise.body && <p className="exercise-body">{currentExercise.body}</p>}
            
            {currentExercise.figure && (
              <div className="exercise-figure">
                <SmartIcon value={currentExercise.figure} size={300} style={{ borderRadius: '1rem' }} />
              </div>
            )}

            {'question' in currentExercise && currentExercise.question && (
              <div className="exercise-question">
                {currentExercise.question}
              </div>
            )}

            <div className="renderer-container">
               {renderExercise()}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Answer Feedback Overlay */}
      <AnimatePresence>
        {feedback && (
          <motion.div 
            className={`feedback-overlay ${feedback.correct ? 'correct' : 'incorrect'}`}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
          >
            <div className="feedback-icon">
              {feedback.correct ? '✨' : '❌'}
            </div>
            <div className="feedback-text">
              {feedback.correct ? '+⭐' + currentExercise.stars : 'Προσπάθησε ξανά!'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .game-container {
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

        .game-header {
          padding: 1.5rem 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(255, 255, 255, 0.05);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .game-progress {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .round-indicator {
          font-weight: bold;
          color: gold;
        }

        .question-indicator {
          font-size: 0.9rem;
          opacity: 0.7;
        }

        .players-scores {
          display: flex;
          gap: 1rem;
        }

        .player-puck {
          background: rgba(255, 255, 255, 0.1);
          padding: 0.5rem 1rem;
          border-radius: 2rem;
          display: flex;
          gap: 0.75rem;
          align-items: center;
          border: 2px solid rgba(255,255,255,0.1);
          transition: all 0.3s;
          opacity: 0.6;
        }

        .player-puck.active-turn {
          border-color: gold;
          background: rgba(255, 215, 0, 0.15);
          transform: scale(1.1);
          opacity: 1;
          box-shadow: 0 0 15px rgba(255, 215, 0, 0.2);
        }

        .player-puck-stars {
          color: gold;
          font-weight: bold;
        }

        .exit-game-btn {
          background: rgba(255, 71, 87, 0.2);
          border: 2px solid rgba(255, 71, 87, 0.5);
          color: white;
          padding: 0.5rem 1.2rem;
          flex-shrink: 0;
          border-radius: 1rem;
          cursor: pointer;
          font-size: 1.2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          font-weight: bold;
        }

        .exit-game-btn:active {
          background: #ff4757;
          transform: scale(0.95);
        }

        .exercise-stage {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 2rem;
          max-width: 1000px;
          margin: 0 auto;
          width: 100%;
        }

        .exercise-content {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 1.5rem;
        }

        .exercise-title {
          font-size: 2.2rem;
          margin: 0;
          color: #fff;
          text-shadow: 0 4px 10px rgba(0,0,0,0.5);
        }

        .exercise-body {
          font-size: 1.2rem;
          opacity: 0.8;
          max-width: 800px;
        }

        .exercise-figure {
          max-width: 400px;
          border-radius: 1rem;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          border: 4px solid rgba(255,255,255,0.1);
        }

        .exercise-figure img {
          width: 100%;
          display: block;
        }

        .exercise-question {
          font-size: 1.8rem;
          font-weight: bold;
          margin: 1rem 0;
          color: #a0a0ff;
        }

        .renderer-container {
          width: 100%;
          max-width: 800px;
          min-height: 200px;
        }

        /* Results Screen */
        .results-screen {
          justify-content: center;
          align-items: center;
        }

        .results-card {
          background: rgba(255, 255, 255, 0.05);
          padding: 4rem;
          border-radius: 3rem;
          border: 2px solid gold;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2rem;
          box-shadow: 0 0 100px rgba(255, 215, 0, 0.2);
        }

        .results-card h1 {
          font-size: 4rem;
          margin: 0;
          background: linear-gradient(to bottom, #fff, gold);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .final-scores {
          display: flex;
          gap: 3rem;
          margin: 2rem 0;
        }

        .player-result {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .player-result .player-avatar {
          font-size: 5rem;
          background: rgba(255,255,255,0.1);
          width: 120px;
          height: 120px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 4px solid rgba(255,255,255,0.2);
        }

        .player-info {
          display: flex;
          flex-direction: column;
        }

        .player-name {
          font-size: 1.5rem;
          font-weight: bold;
        }

        .player-stars {
          font-size: 2rem;
          color: gold;
          font-weight: bold;
        }

        .finish-btn {
          background: gold;
          color: black;
          border: none;
          padding: 1.2rem 3rem;
          border-radius: 2rem;
          font-size: 1.4rem;
          font-weight: bold;
          cursor: pointer;
        }

        /* Feedback Overlay */
        .feedback-overlay {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
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

        .game-loading {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          color: white;
          z-index: 5000;
        }
      `}</style>
    </div>
  );
};
