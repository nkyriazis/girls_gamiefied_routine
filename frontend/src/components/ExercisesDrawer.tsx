import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SmartIcon } from './SmartIcon';
import { useGame } from '../context/GameContext';
import { api } from '../api';
import type { Exercise, ExerciseInstance, ExerciseDifficulty, SpellFillExercise, GrammarChoiceExercise, MathSimpleExercise, MathVerticalExercise, User } from '@shared/types';

interface ExercisesDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

// Helper to get difficulty badge
function getDifficultyBadge(difficulty: ExerciseDifficulty): { text: string; color: string } {
    switch (difficulty) {
        case 'easy':
            return { text: 'Εύκολο', color: '#06d6a0' };
        case 'medium':
            return { text: 'Μέτριο', color: '#ffd60a' };
        case 'hard':
            return { text: 'Δύσκολο', color: '#ef476f' };
        default:
            return { text: difficulty, color: '#adb5bd' };
    }
}

// Component for Spell-Fill Exercise
const SpellFillGame: React.FC<{
    exercise: Exercise;
    content: SpellFillExercise;
    onSubmit: (answer: string) => void;
    attemptsLeft: number;
}> = ({ exercise, content, onSubmit, attemptsLeft }) => {
    const [userWord, setUserWord] = useState(() => {
        // Initialize with underscores for hidden letters
        return content.word.split('').map((char, idx) =>
            content.hiddenIndices.includes(idx) ? '' : char
        );
    });

    const handleLetterChange = (index: number, value: string) => {
        const newWord = [...userWord];
        newWord[index] = value.toUpperCase();
        setUserWord(newWord);

        // Auto-focus next input
        if (value && index < userWord.length - 1) {
            const nextHiddenIndex = content.hiddenIndices.find(i => i > index);
            if (nextHiddenIndex !== undefined) {
                const nextInput = document.querySelector(`input[data-index="${nextHiddenIndex}"]`) as HTMLInputElement;
                if (nextInput) nextInput.focus();
            }
        }
    };

    const handleSubmit = () => {
        onSubmit(userWord.join(''));
    };

    return (
        <div className="spell-fill-game">
            <h3>{exercise.title}</h3>
            {content.hint && <p className="hint">💡 {content.hint}</p>}
            
            <div className="word-container">
                {content.word.split('').map((char, idx) => {
                    const isHidden = content.hiddenIndices.includes(idx);
                    return (
                        <div key={idx} className="letter-box">
                            {isHidden ? (
                                <input
                                    type="text"
                                    maxLength={1}
                                    value={userWord[idx] || ''}
                                    onChange={(e) => handleLetterChange(idx, e.target.value)}
                                    data-index={idx}
                                    className="letter-input"
                                    autoFocus={idx === content.hiddenIndices[0]}
                                />
                            ) : (
                                <span className="letter-fixed">{char}</span>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="game-footer">
                <span className="attempts">Προσπάθειες: {attemptsLeft}/3</span>
                <button className="submit-btn" onClick={handleSubmit}>
                    Έλεγχος ✓
                </button>
            </div>
        </div>
    );
};

// Component for Grammar Choice Exercise
const GrammarChoiceGame: React.FC<{
    exercise: Exercise;
    content: GrammarChoiceExercise;
    onSubmit: (answer: number) => void;
    attemptsLeft: number;
}> = ({ exercise, content, onSubmit, attemptsLeft }) => {
    const [selectedOption, setSelectedOption] = useState<number | null>(null);

    const handleSubmit = () => {
        if (selectedOption !== null) {
            onSubmit(selectedOption);
        }
    };

    return (
        <div className="grammar-choice-game">
            <h3>{exercise.title}</h3>
            <p className="question">{content.question}</p>

            <div className="options-container">
                {content.options.map((option, idx) => (
                    <motion.button
                        key={idx}
                        className={`option-btn ${selectedOption === idx ? 'selected' : ''}`}
                        onClick={() => setSelectedOption(idx)}
                        whileTap={{ scale: 0.95 }}
                    >
                        {option}
                    </motion.button>
                ))}
            </div>

            <div className="game-footer">
                <span className="attempts">Προσπάθειες: {attemptsLeft}/3</span>
                <button 
                    className="submit-btn" 
                    onClick={handleSubmit}
                    disabled={selectedOption === null}
                >
                    Έλεγχος ✓
                </button>
            </div>
        </div>
    );
};

// Component for Math Simple Exercise
const MathSimpleGame: React.FC<{
    exercise: Exercise;
    content: MathSimpleExercise;
    onSubmit: (answer: number) => void;
    attemptsLeft: number;
}> = ({ exercise, content, onSubmit, attemptsLeft }) => {
    const [answer, setAnswer] = useState('');

    const handleSubmit = () => {
        const numAnswer = parseFloat(answer);
        if (!isNaN(numAnswer)) {
            onSubmit(numAnswer);
        }
    };

    const operationSymbol = content.operation;

    return (
        <div className="math-simple-game">
            <h3>{exercise.title}</h3>

            <div className="math-equation">
                <span className="math-number">{content.num1}</span>
                <span className="math-op">{operationSymbol}</span>
                <span className="math-number">{content.num2}</span>
                <span className="math-eq">=</span>
                <input
                    type="number"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    className="math-answer-input"
                    placeholder="?"
                    autoFocus
                />
            </div>

            <div className="game-footer">
                <span className="attempts">Προσπάθειες: {attemptsLeft}/3</span>
                <button 
                    className="submit-btn" 
                    onClick={handleSubmit}
                    disabled={!answer}
                >
                    Έλεγχος ✓
                </button>
            </div>
        </div>
    );
};

// Component for Math Vertical Exercise (Touch-friendly vertical arithmetic)
const MathVerticalGame: React.FC<{
    exercise: Exercise;
    content: MathVerticalExercise;
    onSubmit: (answer: number) => void;
    attemptsLeft: number;
}> = ({ exercise, content, onSubmit, attemptsLeft }) => {
    const [answer, setAnswer] = useState('');

    const handleSubmit = () => {
        const numAnswer = parseFloat(answer);
        if (!isNaN(numAnswer)) {
            onSubmit(numAnswer);
        }
    };

    // Format numbers with padding for vertical alignment
    const num1Str = content.num1.toString();
    const num2Str = content.num2.toString();
    const maxLen = Math.max(num1Str.length, num2Str.length);

    return (
        <div className="math-vertical-game">
            <h3>{exercise.title}</h3>

            <div className="vertical-math-container">
                <div className="vertical-math-row">
                    {num1Str.padStart(maxLen, ' ').split('').map((digit, idx) => (
                        <span key={idx} className="vertical-digit">
                            {digit === ' ' ? '\u00A0' : digit}
                        </span>
                    ))}
                </div>
                <div className="vertical-math-row">
                    <span className="vertical-op">{content.operation}</span>
                    {num2Str.padStart(maxLen - 1, ' ').split('').map((digit, idx) => (
                        <span key={idx} className="vertical-digit">
                            {digit === ' ' ? '\u00A0' : digit}
                        </span>
                    ))}
                </div>
                <div className="vertical-math-line"></div>
                <div className="vertical-math-row answer-row">
                    <input
                        type="number"
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        className="vertical-answer-input"
                        placeholder="?"
                        autoFocus
                    />
                </div>
            </div>

            <div className="game-footer">
                <span className="attempts">Προσπάθειες: {attemptsLeft}/3</span>
                <button 
                    className="submit-btn" 
                    onClick={handleSubmit}
                    disabled={!answer}
                >
                    Έλεγχος ✓
                </button>
            </div>
        </div>
    );
};

// Main Exercise Player Component
const ExercisePlayer: React.FC<{
    exercise: Exercise;
    instance: ExerciseInstance;
    onComplete: () => void;
    onAbandon: () => void;
}> = ({ exercise, instance, onComplete, onAbandon }) => {
    const [feedback, setFeedback] = useState<{ type: 'correct' | 'incorrect' | null; message: string }>({ type: null, message: '' });

    const attemptsLeft = 3 - instance.attempts;

    const handleSubmit = async (answer: any) => {
        try {
            const result = await api.submitExercise(instance.id, answer);
            
            if (result.correct) {
                setFeedback({ type: 'correct', message: `Μπράβο! +${exercise.stars}⭐` });
                setTimeout(() => {
                    onComplete();
                }, 2000);
            } else {
                if (attemptsLeft === 1) {
                    setFeedback({ type: 'incorrect', message: 'Λυπάμαι, δεν είναι σωστό. Δοκίμασε άλλη άσκηση!' });
                    setTimeout(() => {
                        onAbandon();
                    }, 2500);
                } else {
                    setFeedback({ type: 'incorrect', message: `Δοκίμασε ξανά! Απομένουν ${attemptsLeft - 1} προσπάθειες.` });
                    setTimeout(() => {
                        setFeedback({ type: null, message: '' });
                    }, 2000);
                }
            }
        } catch (error) {
            console.error('Failed to submit exercise:', error);
            setFeedback({ type: 'incorrect', message: 'Σφάλμα. Δοκίμασε ξανά.' });
        }
    };

    return (
        <div className="exercise-player">
            <div className="exercise-header">
                <button className="back-btn" onClick={onAbandon}>
                    ← Πίσω
                </button>
                <div className="stars-badge">⭐ {exercise.stars}</div>
            </div>

            {!feedback.type && (
                <div className="exercise-game">
                    {exercise.content.type === 'spell-fill' && (
                        <SpellFillGame
                            exercise={exercise}
                            content={exercise.content}
                            onSubmit={handleSubmit}
                            attemptsLeft={attemptsLeft}
                        />
                    )}
                    {exercise.content.type === 'grammar-choice' && (
                        <GrammarChoiceGame
                            exercise={exercise}
                            content={exercise.content}
                            onSubmit={handleSubmit}
                            attemptsLeft={attemptsLeft}
                        />
                    )}
                    {exercise.content.type === 'math-simple' && (
                        <MathSimpleGame
                            exercise={exercise}
                            content={exercise.content}
                            onSubmit={handleSubmit}
                            attemptsLeft={attemptsLeft}
                        />
                    )}
                    {exercise.content.type === 'math-vertical' && (
                        <MathVerticalGame
                            exercise={exercise}
                            content={exercise.content}
                            onSubmit={handleSubmit}
                            attemptsLeft={attemptsLeft}
                        />
                    )}
                </div>
            )}

            {feedback.type && (
                <motion.div
                    className={`feedback-overlay ${feedback.type}`}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                >
                    <div className="feedback-icon">
                        {feedback.type === 'correct' ? '✓' : '✗'}
                    </div>
                    <div className="feedback-message">{feedback.message}</div>
                </motion.div>
            )}
        </div>
    );
};

export const ExercisesDrawer: React.FC<ExercisesDrawerProps> = ({ isOpen, onClose }) => {
    const { users, exercises, exerciseInstances, refreshExercises } = useGame();
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [activeExercise, setActiveExercise] = useState<{ exercise: Exercise, instance: ExerciseInstance } | null>(null);

    // Filter available exercises for selected user
    const availableExercises = useMemo(() => {
        if (!selectedUser) return [];
        
        return exercises.filter(ex => {
            // Check eligibility
            if (ex.eligibleUsers && ex.eligibleUsers.length > 0 && !ex.eligibleUsers.includes(selectedUser.id)) {
                return false;
            }

            // Check if user already completed this exercise
            const hasCompleted = exerciseInstances.some(
                inst => inst.exerciseId === ex.id && inst.userId === selectedUser.id && inst.status === 'completed'
            );

            return !hasCompleted;
        });
    }, [selectedUser, exercises, exerciseInstances]);

    // Group exercises by difficulty
    const groupedExercises = useMemo(() => {
        const groups: Record<ExerciseDifficulty, Exercise[]> = {
            easy: [],
            medium: [],
            hard: []
        };

        availableExercises.forEach(ex => {
            groups[ex.difficulty].push(ex);
        });

        return groups;
    }, [availableExercises]);

    const handleStartExercise = async (exercise: Exercise) => {
        if (!selectedUser) return;

        try {
            const instance = await api.startExercise(exercise.id, selectedUser.id);
            setActiveExercise({ exercise, instance });
        } catch (error) {
            console.error('Failed to start exercise:', error);
        }
    };

    const handleCompleteExercise = async () => {
        await refreshExercises();
        setActiveExercise(null);
    };

    const handleAbandonExercise = async () => {
        if (activeExercise) {
            try {
                await api.abandonExercise(activeExercise.instance.id);
            } catch (error) {
                console.error('Failed to abandon exercise:', error);
            }
        }
        await refreshExercises();
        setActiveExercise(null);
    };

    const handleClose = () => {
        setSelectedUser(null);
        setActiveExercise(null);
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="exercises-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                    />

                    {/* Drawer */}
                    <motion.div
                        className="exercises-drawer"
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    >
                        {!activeExercise ? (
                            <>
                                <div className="exercises-header">
                                    <h2>🎓 Εκπαιδευτικά Παιχνίδια</h2>
                                    <button className="close-btn" onClick={handleClose}>✕</button>
                                </div>

                                <div className="exercises-content">
                                    {!selectedUser ? (
                                        <>
                                            <p className="instruction">Διάλεξε ποιος θέλει να παίξει:</p>
                                            <div className="user-selection">
                                                {users.map(user => (
                                                    <motion.button
                                                        key={user.id}
                                                        className="user-select-btn"
                                                        onClick={() => setSelectedUser(user)}
                                                        whileTap={{ scale: 0.95 }}
                                                        style={{ '--user-color': user.color } as React.CSSProperties}
                                                    >
                                                        <SmartIcon value={user.avatar} size={60} />
                                                        <span className="user-name">{user.name}</span>
                                                    </motion.button>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="selected-user-banner" style={{ background: selectedUser.color }}>
                                                <SmartIcon value={selectedUser.avatar} size={40} />
                                                <span>{selectedUser.name}</span>
                                                <button className="change-user-btn" onClick={() => setSelectedUser(null)}>
                                                    Αλλαγή
                                                </button>
                                            </div>

                                            {availableExercises.length === 0 ? (
                                                <div className="empty-state">
                                                    <span className="empty-icon">🎉</span>
                                                    <p>Μπράβο! Ολοκλήρωσες όλες τις ασκήσεις!</p>
                                                </div>
                                            ) : (
                                                <>
                                                    {(['easy', 'medium', 'hard'] as ExerciseDifficulty[]).map(difficulty => {
                                                        const difficultyExercises = groupedExercises[difficulty];
                                                        if (difficultyExercises.length === 0) return null;

                                                        const badge = getDifficultyBadge(difficulty);

                                                        return (
                                                            <div key={difficulty} className="exercise-difficulty-section">
                                                                <h3 className="difficulty-header" style={{ color: badge.color }}>
                                                                    {badge.text}
                                                                </h3>
                                                                <div className="exercise-grid">
                                                                    {difficultyExercises.map(exercise => (
                                                                        <motion.button
                                                                            key={exercise.id}
                                                                            className="exercise-card"
                                                                            onClick={() => handleStartExercise(exercise)}
                                                                            whileTap={{ scale: 0.95 }}
                                                                        >
                                                                            <div className="exercise-icon">
                                                                                <SmartIcon value={exercise.icon} size={48} />
                                                                            </div>
                                                                            <div className="exercise-info">
                                                                                <div className="exercise-title">{exercise.title}</div>
                                                                                <div className="exercise-stars">⭐ {exercise.stars}</div>
                                                                            </div>
                                                                        </motion.button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>
                            </>
                        ) : (
                            <ExercisePlayer
                                exercise={activeExercise.exercise}
                                instance={activeExercise.instance}
                                onComplete={handleCompleteExercise}
                                onAbandon={handleAbandonExercise}
                            />
                        )}
                    </motion.div>
                </>
            )}

            <style>{`
        .exercises-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 100;
        }

        .exercises-drawer {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: min(500px, 95vw);
          background: linear-gradient(135deg, #1a1a2e 0%, #2e1a4e 100%);
          z-index: 101;
          display: flex;
          flex-direction: column;
          box-shadow: -4px 0 20px rgba(0, 0, 0, 0.3);
        }

        .exercises-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .exercises-header h2 {
          margin: 0;
          font-size: 1.5rem;
          color: white;
        }

        .close-btn {
          background: transparent;
          border: none;
          color: white;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0.5rem;
          opacity: 0.7;
          transition: opacity 0.2s;
        }

        .close-btn:hover {
          opacity: 1;
        }

        .exercises-content {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
          -webkit-overflow-scrolling: touch;
        }

        .instruction {
          text-align: center;
          font-size: 1.1rem;
          color: rgba(255, 255, 255, 0.9);
          margin-bottom: 1.5rem;
        }

        .user-selection {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .user-select-btn {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: rgba(255, 255, 255, 0.1);
          border: 2px solid var(--user-color);
          border-radius: 1rem;
          color: white;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 1.1rem;
        }

        .user-select-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: translateX(-5px);
        }

        .user-name {
          flex: 1;
          text-align: left;
          font-weight: 600;
        }

        .selected-user-banner {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          border-radius: 0.75rem;
          margin-bottom: 1.5rem;
          color: white;
          font-weight: 600;
          font-size: 1.1rem;
        }

        .change-user-btn {
          margin-left: auto;
          padding: 0.35rem 0.75rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 0.5rem;
          color: white;
          cursor: pointer;
          font-size: 0.85rem;
        }

        .exercise-difficulty-section {
          margin-bottom: 2rem;
        }

        .difficulty-header {
          font-size: 1.2rem;
          margin-bottom: 1rem;
          font-weight: 600;
        }

        .exercise-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 1rem;
        }

        .exercise-card {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 1rem;
          padding: 1rem;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          color: white;
        }

        .exercise-card:hover {
          background: rgba(255, 255, 255, 0.15);
          transform: translateY(-3px);
        }

        .exercise-icon {
          margin-bottom: 0.5rem;
        }

        .exercise-info {
          text-align: center;
        }

        .exercise-title {
          font-size: 0.95rem;
          margin-bottom: 0.25rem;
        }

        .exercise-stars {
          font-size: 0.9rem;
          color: #ffd60a;
        }

        /* Exercise Player */
        .exercise-player {
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: 1rem;
          color: white;
        }

        .exercise-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .back-btn {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 0.5rem;
          padding: 0.5rem 1rem;
          color: white;
          cursor: pointer;
          font-size: 1rem;
        }

        .stars-badge {
          background: linear-gradient(135deg, #ffd60a, #ff9800);
          padding: 0.5rem 1rem;
          border-radius: 1rem;
          font-weight: 700;
          font-size: 1.1rem;
        }

        .exercise-game {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .exercise-game h3 {
          text-align: center;
          font-size: 1.3rem;
          margin-bottom: 1rem;
        }

        .hint {
          text-align: center;
          font-size: 0.95rem;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 2rem;
        }

        /* Spell Fill Game */
        .spell-fill-game {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .word-container {
          display: flex;
          justify-content: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .letter-box {
          width: 50px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .letter-input {
          width: 100%;
          height: 100%;
          text-align: center;
          font-size: 2rem;
          font-weight: 700;
          background: rgba(255, 255, 255, 0.2);
          border: 2px solid #4cc9f0;
          border-radius: 0.5rem;
          color: white;
          text-transform: uppercase;
        }

        .letter-fixed {
          font-size: 2rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.6);
        }

        /* Grammar Choice Game */
        .grammar-choice-game {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .question {
          text-align: center;
          font-size: 1.2rem;
          line-height: 1.6;
        }

        .options-container {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .option-btn {
          padding: 1rem;
          background: rgba(255, 255, 255, 0.1);
          border: 2px solid rgba(255, 255, 255, 0.2);
          border-radius: 0.75rem;
          color: white;
          font-size: 1.1rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .option-btn:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        .option-btn.selected {
          background: rgba(76, 201, 240, 0.3);
          border-color: #4cc9f0;
        }

        /* Math Simple Game */
        .math-simple-game {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .math-equation {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          font-size: 2.5rem;
          font-weight: 700;
        }

        .math-number, .math-op, .math-eq {
          color: white;
        }

        .math-answer-input {
          width: 120px;
          height: 70px;
          text-align: center;
          font-size: 2rem;
          font-weight: 700;
          background: rgba(255, 255, 255, 0.2);
          border: 2px solid #4cc9f0;
          border-radius: 0.5rem;
          color: white;
        }

        /* Math Vertical Game */
        .math-vertical-game {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .vertical-math-container {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.5rem;
          max-width: 300px;
          margin: 0 auto;
        }

        .vertical-math-row {
          display: flex;
          gap: 0.5rem;
          font-size: 2.5rem;
          font-weight: 700;
        }

        .vertical-digit {
          width: 50px;
          text-align: center;
          color: white;
        }

        .vertical-op {
          width: 50px;
          text-align: center;
          color: #4cc9f0;
        }

        .vertical-math-line {
          width: 100%;
          height: 3px;
          background: white;
          margin: 0.5rem 0;
        }

        .answer-row {
          position: relative;
        }

        .vertical-answer-input {
          width: 100%;
          height: 70px;
          text-align: center;
          font-size: 2rem;
          font-weight: 700;
          background: rgba(255, 255, 255, 0.2);
          border: 2px solid #4cc9f0;
          border-radius: 0.5rem;
          color: white;
        }

        /* Game Footer */
        .game-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 1.5rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .attempts {
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.95rem;
        }

        .submit-btn {
          padding: 0.75rem 2rem;
          background: linear-gradient(135deg, #06d6a0, #04aa7b);
          border: none;
          border-radius: 0.75rem;
          color: white;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .submit-btn:not(:disabled):hover {
          transform: scale(1.05);
        }

        .submit-btn:not(:disabled):active {
          transform: scale(0.98);
        }

        /* Feedback Overlay */
        .feedback-overlay {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1.5rem;
        }

        .feedback-icon {
          font-size: 8rem;
        }

        .feedback-overlay.correct .feedback-icon {
          color: #06d6a0;
        }

        .feedback-overlay.incorrect .feedback-icon {
          color: #ef476f;
        }

        .feedback-message {
          font-size: 1.5rem;
          font-weight: 600;
          text-align: center;
        }

        .empty-state {
          text-align: center;
          padding: 3rem 1rem;
          color: rgba(255, 255, 255, 0.6);
        }

        .empty-state .empty-icon {
          font-size: 5rem;
          display: block;
          margin-bottom: 1rem;
        }

        .empty-state p {
          font-size: 1.2rem;
        }

        /* Remove number input spinners */
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>
        </AnimatePresence>
    );
};
