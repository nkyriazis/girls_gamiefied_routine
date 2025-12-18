import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { MathVerticalExercise, Exercise } from '@shared/types';

interface InteractiveVerticalMathProps {
    exercise: Exercise;
    content: MathVerticalExercise;
    onSubmit: (answer: { finalAnswer: number; steps: any }) => void;
    errorsRemaining: number | null;
    challengeMode: 'untimed' | 'timed';
    timeoutSeconds?: number;
}

// Helper to calculate the correct answer
function calculateAnswer(num1: number, num2: number, operation: '+' | '-' | '*' | '/'): number {
    switch (operation) {
        case '+': return num1 + num2;
        case '-': return num1 - num2;
        case '*': return num1 * num2;
        case '/': return Math.floor(num1 / num2);
        default: return 0;
    }
}

// Helper to get digits array (right-aligned)
function getDigits(num: number): number[] {
    return num.toString().split('').map(d => parseInt(d));
}

// Calculate carries for addition
function calculateCarries(num1: number, num2: number): number[] {
    const digits1 = getDigits(num1).reverse();
    const digits2 = getDigits(num2).reverse();
    const carries: number[] = [];
    let carry = 0;
    
    const maxLen = Math.max(digits1.length, digits2.length);
    for (let i = 0; i < maxLen; i++) {
        const d1 = digits1[i] || 0;
        const d2 = digits2[i] || 0;
        const sum = d1 + d2 + carry;
        carry = Math.floor(sum / 10);
        if (carry > 0 && i < maxLen - 1) {
            carries.push(carry);
        } else if (carry > 0) {
            carries.push(carry);
        }
    }
    
    return carries.reverse();
}

export const InteractiveVerticalMath: React.FC<InteractiveVerticalMathProps> = ({
    exercise,
    content,
    onSubmit,
    errorsRemaining,
    challengeMode,
    timeoutSeconds
}) => {
    const { num1, num2, operation, requireCarries, showHelpers } = content;
    
    // Get digit arrays
    const digits1 = getDigits(num1);
    const digits2 = getDigits(num2);
    const maxLen = Math.max(digits1.length, digits2.length);
    
    // Pad arrays for alignment
    const paddedDigits1 = Array(maxLen - digits1.length).fill(null).concat(digits1);
    const paddedDigits2 = Array(maxLen - digits2.length).fill(null).concat(digits2);
    
    // State for interactive input
    const [currentColumn, setCurrentColumn] = useState(maxLen - 1); // Start from rightmost column
    const [columnResults, setColumnResults] = useState<(number | null)[]>(Array(maxLen + 1).fill(null));
    const [carries, setCarries] = useState<(number | null)[]>(Array(maxLen).fill(null));
    const [timeLeft, setTimeLeft] = useState<number | null>(challengeMode === 'timed' && timeoutSeconds ? timeoutSeconds : null);
    const [feedback, setFeedback] = useState<string>('');
    const [isComplete, setIsComplete] = useState(false);
    
    // Timer for timed challenges
    useEffect(() => {
        if (challengeMode === 'timed' && timeLeft !== null && timeLeft > 0 && !isComplete) {
            const timer = setTimeout(() => {
                setTimeLeft(timeLeft - 1);
            }, 1000);
            return () => clearTimeout(timer);
        } else if (timeLeft === 0) {
            // Time's up - fail the exercise
            handleTimeout();
        }
    }, [timeLeft, challengeMode, isComplete]);
    
    const handleTimeout = () => {
        setFeedback('Ο χρόνος τελείωσε!');
        setTimeout(() => {
            onSubmit({ finalAnswer: -1, steps: { timeout: true } });
        }, 2000);
    };
    
    // Calculate what the correct values should be for current step
    const getExpectedForColumn = (colIdx: number): { sum: number, carry: number } => {
        const d1 = paddedDigits1[colIdx] || 0;
        const d2 = paddedDigits2[colIdx] || 0;
        const prevCarry = colIdx < maxLen - 1 && carries[colIdx + 1] ? carries[colIdx + 1]! : 0;
        
        let sum = 0;
        let carry = 0;
        
        if (operation === '+') {
            sum = d1 + d2 + prevCarry;
            carry = Math.floor(sum / 10);
        } else if (operation === '-') {
            // Handle borrowing
            let result = d1 - d2 - prevCarry;
            if (result < 0) {
                result += 10;
                carry = 1; // Need to borrow
            }
            sum = result;
        } else if (operation === '*') {
            // For multiplication, this gets more complex
            // For now, just do simple column multiplication
            sum = (d1 || 0) * num2 + prevCarry;
            carry = Math.floor(sum / 10);
        }
        
        return { sum: sum % 10, carry };
    };
    
    // Handle column result input
    const handleColumnInput = (value: string) => {
        if (value === '' || isNaN(parseInt(value))) {
            return;
        }
        
        const digit = parseInt(value);
        if (digit < 0 || digit > 9) return;
        
        const expected = getExpectedForColumn(currentColumn);
        
        if (digit === expected.sum) {
            // Correct!
            const newColumnResults = [...columnResults];
            newColumnResults[currentColumn] = digit;
            setColumnResults(newColumnResults);
            
            // If requires carries and there's a carry, prompt for it
            if (requireCarries && expected.carry > 0) {
                setFeedback('Σωστό! Τώρα βάλε το κρατούμενο.');
            } else {
                setFeedback('Μπράβο!');
                // Move to next column
                if (currentColumn > 0) {
                    setTimeout(() => {
                        setCurrentColumn(currentColumn - 1);
                        setFeedback('');
                    }, 500);
                } else {
                    // Check if there's a final carry
                    if (expected.carry > 0) {
                        setTimeout(() => {
                            setCurrentColumn(-1); // Signal for final carry
                            setFeedback('');
                        }, 500);
                    } else {
                        handleComplete();
                    }
                }
            }
        } else {
            // Incorrect
            if (challengeMode === 'timed') {
                setFeedback(`Λάθος! Δοκίμασε ξανά. (Σκέψου: ${paddedDigits1[currentColumn] || 0} ${operation} ${paddedDigits2[currentColumn] || 0})`);
            } else {
                setFeedback(`Λάθος! ${errorsRemaining !== null ? `Απομένουν ${errorsRemaining - 1} προσπάθειες.` : ''}`);
                // In untimed mode, still allow retry but track errors
                setTimeout(() => setFeedback(''), 2000);
            }
        }
    };
    
    // Handle carry input
    const handleCarryInput = (value: string) => {
        if (value === '' || isNaN(parseInt(value))) {
            return;
        }
        
        const digit = parseInt(value);
        if (digit < 0 || digit > 9) return;
        
        const expected = getExpectedForColumn(currentColumn);
        
        if (digit === expected.carry) {
            // Correct carry!
            const newCarries = [...carries];
            newCarries[currentColumn] = digit;
            setCarries(newCarries);
            setFeedback('Σωστό κρατούμενο!');
            
            // Move to next column
            if (currentColumn > 0) {
                setTimeout(() => {
                    setCurrentColumn(currentColumn - 1);
                    setFeedback('');
                }, 500);
            } else {
                handleComplete();
            }
        } else {
            setFeedback('Λάθος κρατούμενο!');
            setTimeout(() => setFeedback(''), 2000);
        }
    };
    
    const handleComplete = () => {
        setIsComplete(true);
        const finalAnswer = calculateAnswer(num1, num2, operation);
        setFeedback(`Τέλειωσες! Το αποτέλεσμα είναι ${finalAnswer}`);
        
        setTimeout(() => {
            onSubmit({
                finalAnswer,
                steps: {
                    columnResults,
                    carries,
                    completed: true
                }
            });
        }, 1500);
    };
    
    const needsCarryInput = requireCarries && 
                            columnResults[currentColumn] !== null && 
                            getExpectedForColumn(currentColumn).carry > 0 &&
                            carries[currentColumn] === null;
    
    return (
        <div className="interactive-vertical-math">
            <h3>{exercise.title}</h3>
            
            {challengeMode === 'timed' && timeLeft !== null && (
                <div className="timer-display">
                    <span className="timer-icon">⏱️</span>
                    <span className="timer-value">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
                </div>
            )}
            
            {showHelpers && (
                <div className="helper-text">
                    💡 Συμπλήρωσε κάθε στήλη από δεξιά προς τα αριστερά
                </div>
            )}
            
            <div className="vertical-math-interactive">
                {/* Carries row (if required) */}
                {requireCarries && (
                    <div className="carries-row">
                        {Array(maxLen).fill(0).map((_, idx) => (
                            <div key={idx} className={`carry-cell ${idx === currentColumn && needsCarryInput ? 'active' : ''}`}>
                                {carries[idx] !== null ? carries[idx] : (idx === currentColumn && needsCarryInput ? '?' : '')}
                            </div>
                        ))}
                    </div>
                )}
                
                {/* First number row */}
                <div className="number-row">
                    {paddedDigits1.map((digit, idx) => (
                        <div key={idx} className="digit-cell">
                            {digit !== null ? digit : ' '}
                        </div>
                    ))}
                </div>
                
                {/* Operation and second number row */}
                <div className="number-row">
                    <div className="operation-cell">{operation}</div>
                    {paddedDigits2.slice(1).map((digit, idx) => (
                        <div key={idx + 1} className="digit-cell">
                            {digit !== null ? digit : ' '}
                        </div>
                    ))}
                </div>
                
                {/* Line */}
                <div className="math-line"></div>
                
                {/* Result row with interactive inputs */}
                <div className="result-row">
                    {columnResults.map((result, idx) => (
                        <div key={idx} className={`result-cell ${idx === currentColumn && !needsCarryInput ? 'active' : ''}`}>
                            {result !== null ? result : (idx === currentColumn && !needsCarryInput ? '?' : '')}
                        </div>
                    ))}
                </div>
            </div>
            
            {/* Input area */}
            {!isComplete && (
                <div className="input-area">
                    <div className="instruction">
                        {needsCarryInput ? 
                            'Γράψε το κρατούμενο:' : 
                            currentColumn >= 0 ? 
                                `Στήλη ${maxLen - currentColumn}: ${paddedDigits1[currentColumn] || 0} ${operation} ${paddedDigits2[currentColumn] || 0} = ?` :
                                'Γράψε το τελικό κρατούμενο:'
                        }
                    </div>
                    <div className="number-pad">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(num => (
                            <motion.button
                                key={num}
                                className="number-btn"
                                onClick={() => needsCarryInput ? handleCarryInput(num.toString()) : handleColumnInput(num.toString())}
                                whileTap={{ scale: 0.9 }}
                            >
                                {num}
                            </motion.button>
                        ))}
                    </div>
                </div>
            )}
            
            {feedback && (
                <motion.div 
                    className={`feedback ${feedback.includes('Λάθος') ? 'error' : 'success'}`}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    {feedback}
                </motion.div>
            )}
            
            <style>{`
                .interactive-vertical-math {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                    padding: 1rem 0;
                }
                
                .interactive-vertical-math h3 {
                    text-align: center;
                    font-size: 1.3rem;
                    margin-bottom: 0.5rem;
                }
                
                .timer-display {
                    text-align: center;
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #ffd60a;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                }
                
                .helper-text {
                    text-align: center;
                    font-size: 0.9rem;
                    color: rgba(255, 255, 255, 0.7);
                    padding: 0.5rem;
                    background: rgba(76, 201, 240, 0.1);
                    border-radius: 0.5rem;
                }
                
                .vertical-math-interactive {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 0.3rem;
                    max-width: 400px;
                    margin: 0 auto;
                    padding: 1rem;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 1rem;
                }
                
                .carries-row,
                .number-row,
                .result-row {
                    display: flex;
                    gap: 0.5rem;
                }
                
                .carry-cell,
                .digit-cell,
                .result-cell,
                .operation-cell {
                    width: 50px;
                    height: 50px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.8rem;
                    font-weight: 700;
                    color: white;
                }
                
                .carry-cell {
                    font-size: 1.2rem;
                    color: rgba(255, 255, 255, 0.5);
                }
                
                .carry-cell.active,
                .result-cell.active {
                    background: rgba(76, 201, 240, 0.3);
                    border: 2px solid #4cc9f0;
                    border-radius: 0.5rem;
                    animation: pulse 1s infinite;
                }
                
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
                
                .operation-cell {
                    color: #4cc9f0;
                }
                
                .math-line {
                    width: 100%;
                    height: 3px;
                    background: white;
                    margin: 0.3rem 0;
                }
                
                .input-area {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    align-items: center;
                }
                
                .instruction {
                    font-size: 1.1rem;
                    color: rgba(255, 255, 255, 0.9);
                    text-align: center;
                }
                
                .number-pad {
                    display: grid;
                    grid-template-columns: repeat(5, 1fr);
                    gap: 0.5rem;
                    max-width: 350px;
                }
                
                .number-btn {
                    width: 60px;
                    height: 60px;
                    font-size: 1.5rem;
                    font-weight: 700;
                    background: rgba(255, 255, 255, 0.15);
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-radius: 0.75rem;
                    color: white;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .number-btn:hover {
                    background: rgba(255, 255, 255, 0.25);
                    border-color: #4cc9f0;
                }
                
                .feedback {
                    padding: 1rem;
                    border-radius: 0.75rem;
                    text-align: center;
                    font-size: 1.1rem;
                    font-weight: 600;
                }
                
                .feedback.success {
                    background: rgba(6, 214, 160, 0.2);
                    color: #06d6a0;
                    border: 1px solid #06d6a0;
                }
                
                .feedback.error {
                    background: rgba(239, 71, 111, 0.2);
                    color: #ef476f;
                    border: 1px solid #ef476f;
                }
            `}</style>
        </div>
    );
};
