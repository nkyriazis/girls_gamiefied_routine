import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ComprehensionExercise, Exercise } from '@shared/types';

interface ComprehensionGameProps {
    exercise: Exercise;
    content: ComprehensionExercise;
    onSubmit: (answer: number) => void;
    attemptsLeft: number;
}

type Phase = 'reading' | 'question' | 'answered';

export const ComprehensionGame: React.FC<ComprehensionGameProps> = ({
    exercise,
    content,
    onSubmit,
    attemptsLeft
}) => {
    const [phase, setPhase] = useState<Phase>('reading');
    const [readingTimeLeft, setReadingTimeLeft] = useState<number | null>(
        content.readingTimeSeconds || null
    );
    const [questionTimeLeft, setQuestionTimeLeft] = useState<number | null>(
        content.questionTimeSeconds || null
    );
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [showPassage, setShowPassage] = useState(true);
    
    // Reading timer
    useEffect(() => {
        if (phase === 'reading' && readingTimeLeft !== null && readingTimeLeft > 0) {
            const timer = setTimeout(() => {
                setReadingTimeLeft(readingTimeLeft - 1);
            }, 1000);
            return () => clearTimeout(timer);
        } else if (phase === 'reading' && readingTimeLeft === 0) {
            handleReadingComplete();
        }
    }, [phase, readingTimeLeft]);
    
    // Question timer
    useEffect(() => {
        if (phase === 'question' && questionTimeLeft !== null && questionTimeLeft > 0) {
            const timer = setTimeout(() => {
                setQuestionTimeLeft(questionTimeLeft - 1);
            }, 1000);
            return () => clearTimeout(timer);
        } else if (phase === 'question' && questionTimeLeft === 0) {
            // Time's up - auto-submit with no answer (will be wrong)
            onSubmit(-1);
            setPhase('answered');
        }
    }, [phase, questionTimeLeft]);
    
    const handleReadingComplete = () => {
        setShowPassage(false);
        setPhase('question');
    };
    
    const handleAnswerSelect = (index: number) => {
        setSelectedAnswer(index);
    };
    
    const handleSubmit = () => {
        if (selectedAnswer !== null) {
            onSubmit(selectedAnswer);
            setPhase('answered');
        }
    };
    
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    
    return (
        <div className="comprehension-game">
            <AnimatePresence mode="wait">
                {phase === 'reading' && (
                    <motion.div
                        key="reading"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="reading-phase"
                    >
                        <div className="phase-header">
                            <h3>📖 Διάβασε το κείμενο</h3>
                            {readingTimeLeft !== null && (
                                <div className="timer">
                                    <span>⏱️</span>
                                    <span className={readingTimeLeft <= 10 ? 'warning' : ''}>
                                        {formatTime(readingTimeLeft)}
                                    </span>
                                </div>
                            )}
                        </div>
                        
                        <div className="passage-container">
                            <p className="passage-text">{content.passage}</p>
                        </div>
                        
                        {readingTimeLeft === null && (
                            <motion.button
                                className="continue-btn"
                                onClick={handleReadingComplete}
                                whileTap={{ scale: 0.95 }}
                            >
                                Συνέχεια ➡️
                            </motion.button>
                        )}
                    </motion.div>
                )}
                
                {phase === 'question' && (
                    <motion.div
                        key="question"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="question-phase"
                    >
                        <div className="phase-header">
                            <h3>❓ Απάντησε στην ερώτηση</h3>
                            {questionTimeLeft !== null && (
                                <div className="timer">
                                    <span>⏱️</span>
                                    <span className={questionTimeLeft <= 10 ? 'warning' : ''}>
                                        {formatTime(questionTimeLeft)}
                                    </span>
                                </div>
                            )}
                        </div>
                        
                        <div className="question-text">
                            {content.question}
                        </div>
                        
                        <div className="options-container">
                            {content.options.map((option, index) => (
                                <motion.button
                                    key={index}
                                    className={`option-btn ${selectedAnswer === index ? 'selected' : ''}`}
                                    onClick={() => handleAnswerSelect(index)}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <span className="option-label">{String.fromCharCode(65 + index)}</span>
                                    <span className="option-text">{option}</span>
                                </motion.button>
                            ))}
                        </div>
                        
                        <div className="action-footer">
                            <div className="attempts-info">
                                Προσπάθειες: {attemptsLeft}/3
                            </div>
                            <motion.button
                                className="submit-btn"
                                onClick={handleSubmit}
                                disabled={selectedAnswer === null}
                                whileTap={{ scale: 0.95 }}
                            >
                                Έλεγχος ✓
                            </motion.button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            <style>{`
                .comprehension-game {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    padding: 1rem 0;
                    color: white;
                    min-height: 400px;
                }
                
                .phase-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }
                
                .phase-header h3 {
                    font-size: 1.3rem;
                    margin: 0;
                }
                
                .timer {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 1.3rem;
                    font-weight: 700;
                    color: #ffd60a;
                    background: rgba(255, 214, 10, 0.1);
                    padding: 8px 16px;
                    border-radius: 10px;
                    border: 2px solid rgba(255, 214, 10, 0.3);
                }
                
                .timer .warning {
                    color: #ef476f;
                    animation: pulse-color 1s infinite;
                }
                
                @keyframes pulse-color {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.6; }
                }
                
                .reading-phase,
                .question-phase {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                }
                
                .passage-container {
                    flex: 1;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin-bottom: 1rem;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                
                .passage-text {
                    font-size: 1.1rem;
                    line-height: 1.8;
                    color: rgba(255, 255, 255, 0.95);
                    margin: 0;
                }
                
                .continue-btn {
                    align-self: center;
                    padding: 12px 32px;
                    font-size: 1.1rem;
                    font-weight: 600;
                    background: linear-gradient(135deg, #06d6a0 0%, #05a878 100%);
                    border: none;
                    border-radius: 12px;
                    color: white;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 4px 15px rgba(6, 214, 160, 0.3);
                }
                
                .continue-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(6, 214, 160, 0.4);
                }
                
                .question-text {
                    font-size: 1.2rem;
                    font-weight: 600;
                    padding: 1.5rem;
                    background: rgba(76, 201, 240, 0.1);
                    border-radius: 12px;
                    margin-bottom: 1.5rem;
                    border: 2px solid rgba(76, 201, 240, 0.3);
                    text-align: center;
                }
                
                .options-container {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                    margin-bottom: 1.5rem;
                }
                
                .option-btn {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1rem 1.25rem;
                    background: rgba(255, 255, 255, 0.08);
                    border: 2px solid rgba(255, 255, 255, 0.15);
                    border-radius: 12px;
                    color: white;
                    font-size: 1rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-align: left;
                }
                
                .option-btn:hover {
                    background: rgba(255, 255, 255, 0.12);
                    border-color: rgba(76, 201, 240, 0.5);
                }
                
                .option-btn.selected {
                    background: rgba(76, 201, 240, 0.2);
                    border-color: #4cc9f0;
                    box-shadow: 0 0 15px rgba(76, 201, 240, 0.3);
                }
                
                .option-label {
                    flex-shrink: 0;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(76, 201, 240, 0.2);
                    border-radius: 8px;
                    font-weight: 700;
                    font-size: 1rem;
                }
                
                .option-btn.selected .option-label {
                    background: #4cc9f0;
                    color: #1a1a2e;
                }
                
                .option-text {
                    flex: 1;
                    line-height: 1.4;
                }
                
                .action-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-top: 1rem;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                }
                
                .attempts-info {
                    font-size: 0.9rem;
                    color: rgba(255, 255, 255, 0.7);
                }
                
                .submit-btn {
                    padding: 12px 32px;
                    font-size: 1.1rem;
                    font-weight: 600;
                    background: linear-gradient(135deg, #06d6a0 0%, #05a878 100%);
                    border: none;
                    border-radius: 12px;
                    color: white;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 4px 15px rgba(6, 214, 160, 0.3);
                }
                
                .submit-btn:disabled {
                    opacity: 0.4;
                    cursor: not-allowed;
                }
                
                .submit-btn:not(:disabled):hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(6, 214, 160, 0.4);
                }
            `}</style>
        </div>
    );
};
