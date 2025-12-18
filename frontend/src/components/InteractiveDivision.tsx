import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type { MathVerticalExercise, Exercise } from '@shared/types';

interface InteractiveDivisionProps {
    exercise: Exercise;
    content: MathVerticalExercise;
    onSubmit: (answer: { finalAnswer: number; steps: any }) => void;
    errorsRemaining: number | null;
    challengeMode: 'untimed' | 'timed';
    timeoutSeconds?: number;
}

export const InteractiveDivision: React.FC<InteractiveDivisionProps> = ({
    exercise,
    content,
    onSubmit,
    errorsRemaining,
    challengeMode,
    timeoutSeconds
}) => {
    const { num1: dividend, num2: divisor, requireLongDivisionSteps, showHelpers } = content;
    
    // Long division state
    const [quotient, setQuotient] = useState<(number | null)[]>([]);
    const [currentPosition, setCurrentPosition] = useState(0);
    const [workingNumber, setWorkingNumber] = useState(0);
    const [subtractionsNeeded, setSubtractionsNeeded] = useState<{ position: number, value: number }[]>([]);
    const [feedback, setFeedback] = useState('');
    const [isComplete, setIsComplete] = useState(false);
    const [timeLeft, setTimeLeft] = useState<number | null>(
        challengeMode === 'timed' && timeoutSeconds ? timeoutSeconds : null
    );
    
    const dividendStr = dividend.toString();
    const expectedQuotient = Math.floor(dividend / divisor);
    const expectedRemainder = dividend % divisor;
    
    // Timer
    React.useEffect(() => {
        if (challengeMode === 'timed' && timeLeft !== null && timeLeft > 0 && !isComplete) {
            const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearTimeout(timer);
        } else if (timeLeft === 0) {
            handleTimeout();
        }
    }, [timeLeft, challengeMode, isComplete]);
    
    const handleTimeout = () => {
        setFeedback('Ο χρόνος τελείωσε!');
        setTimeout(() => {
            onSubmit({ finalAnswer: -1, steps: { timeout: true } });
        }, 2000);
    };
    
    // Initialize working number with first digit(s) that are >= divisor
    React.useEffect(() => {
        if (currentPosition === 0) {
            let working = 0;
            let pos = 0;
            while (working < divisor && pos < dividendStr.length) {
                working = working * 10 + parseInt(dividendStr[pos]);
                pos++;
            }
            setWorkingNumber(working);
            setCurrentPosition(pos);
        }
    }, []);
    
    // Calculate how many times divisor goes into working number
    const getExpectedQuotientDigit = (): number => {
        return Math.floor(workingNumber / divisor);
    };
    
    // Handle quotient digit input
    const handleQuotientInput = (value: string) => {
        const digit = parseInt(value);
        if (isNaN(digit) || digit < 0 || digit > 9) return;
        
        const expected = getExpectedQuotientDigit();
        
        if (digit === expected) {
            // Correct!
            const newQuotient = [...quotient, digit];
            setQuotient(newQuotient);
            
            if (requireLongDivisionSteps) {
                // Need to do subtraction
                const product = digit * divisor;
                setSubtractionsNeeded([...subtractionsNeeded, { position: currentPosition, value: product }]);
            }
            
            // Calculate remainder and bring down next digit
            const remainder = workingNumber - (digit * divisor);
            
            if (currentPosition < dividendStr.length) {
                // Bring down next digit
                const nextDigit = parseInt(dividendStr[currentPosition]);
                const newWorking = remainder * 10 + nextDigit;
                setWorkingNumber(newWorking);
                setCurrentPosition(currentPosition + 1);
                setFeedback(`Σωστό! Κατέβασε το ${nextDigit}`);
                setTimeout(() => setFeedback(''), 1500);
            } else {
                // Division complete
                completeExercise(remainder);
            }
        } else {
            setFeedback(`Λάθος! ${errorsRemaining !== null ? `Απομένουν ${errorsRemaining - 1} προσπάθειες.` : 'Δοκίμασε ξανά!'}`);
            setTimeout(() => setFeedback(''), 2000);
        }
    };
    
    const completeExercise = (remainder: number) => {
        setIsComplete(true);
        const quotientValue = parseInt(quotient.join(''));
        const message = remainder > 0 
            ? `Μπράβο! ${dividend} ÷ ${divisor} = ${quotientValue} με υπόλοιπο ${remainder}`
            : `Μπράβο! ${dividend} ÷ ${divisor} = ${quotientValue}`;
        setFeedback(message);
        
        setTimeout(() => {
            onSubmit({
                finalAnswer: quotientValue,
                steps: { quotient, remainder, subtractionsNeeded, completed: true }
            });
        }, 2500);
    };
    
    return (
        <div className="interactive-division">
            <h3>{exercise.title}</h3>
            
            {challengeMode === 'timed' && timeLeft !== null && (
                <div className="timer-display">
                    <span>⏱️</span>
                    <span>{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
                </div>
            )}
            
            {showHelpers && (
                <div className="helper-text">
                    💡 Πόσες φορές το {divisor} χωράει στο {workingNumber};
                </div>
            )}
            
            <div className="long-division-container">
                {/* Division bracket and quotient */}
                <div className="division-setup">
                    <div className="quotient-row">
                        {quotient.map((digit, idx) => (
                            <div key={idx} className="quotient-digit filled">
                                {digit}
                            </div>
                        ))}
                        {!isComplete && (
                            <div className="quotient-digit active">?</div>
                        )}
                    </div>
                    <div className="division-bracket">
                        <div className="divisor">{divisor}</div>
                        <div className="bracket">)</div>
                        <div className="dividend">
                            {dividendStr.split('').map((digit, idx) => (
                                <span 
                                    key={idx} 
                                    className={`dividend-digit ${idx < currentPosition ? 'used' : ''}`}
                                >
                                    {digit}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
                
                {/* Working area showing subtractions */}
                {requireLongDivisionSteps && subtractionsNeeded.length > 0 && (
                    <div className="work-area">
                        {subtractionsNeeded.map((sub, idx) => (
                            <div key={idx} className="subtraction-step">
                                <div className="subtract-value">- {sub.value}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            {!isComplete && (
                <div className="input-area">
                    <div className="instruction">
                        Πόσες φορές το {divisor} χωράει στο {workingNumber};
                    </div>
                    <div className="number-pad">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(num => (
                            <motion.button
                                key={num}
                                className="number-btn"
                                onClick={() => handleQuotientInput(num.toString())}
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
                .interactive-division {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    padding: 1rem 0;
                    color: white;
                }
                
                .interactive-division h3 {
                    text-align: center;
                    font-size: 1.3rem;
                }
                
                .timer-display {
                    text-align: center;
                    font-size: 1.3rem;
                    font-weight: 700;
                    color: #ffd60a;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                }
                
                .helper-text {
                    text-align: center;
                    font-size: 0.85rem;
                    color: rgba(255, 255, 255, 0.7);
                    padding: 8px;
                    background: rgba(76, 201, 240, 0.1);
                    border-radius: 8px;
                }
                
                .long-division-container {
                    display: flex;
                    flex-direction: column;
                    padding: 1rem;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 1rem;
                    margin: 0 auto;
                    max-width: 400px;
                }
                
                .division-setup {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                
                .quotient-row {
                    display: flex;
                    gap: 0.5rem;
                    margin-bottom: 0.5rem;
                }
                
                .quotient-digit {
                    width: 45px;
                    height: 45px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.6rem;
                    font-weight: 700;
                }
                
                .quotient-digit.active {
                    background: rgba(76, 201, 240, 0.3);
                    border: 2px solid #4cc9f0;
                    border-radius: 8px;
                    animation: pulse 1s infinite;
                }
                
                .quotient-digit.filled {
                    background: rgba(6, 214, 160, 0.1);
                    border: 1px solid rgba(6, 214, 160, 0.3);
                    border-radius: 8px;
                }
                
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
                
                .division-bracket {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 1.6rem;
                    font-weight: 700;
                }
                
                .divisor {
                    padding: 0.5rem;
                    border-right: 3px solid #4cc9f0;
                }
                
                .bracket {
                    font-size: 2rem;
                    color: #4cc9f0;
                }
                
                .dividend {
                    display: flex;
                    gap: 0.3rem;
                    padding: 0.5rem;
                    border-top: 3px solid #4cc9f0;
                }
                
                .dividend-digit {
                    width: 30px;
                    text-align: center;
                }
                
                .dividend-digit.used {
                    color: rgba(255, 255, 255, 0.5);
                }
                
                .work-area {
                    margin-top: 1rem;
                    padding-left: 2rem;
                }
                
                .subtraction-step {
                    margin: 0.5rem 0;
                    font-size: 1.2rem;
                }
                
                .subtract-value {
                    color: rgba(255, 255, 255, 0.7);
                }
                
                .input-area {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    align-items: center;
                }
                
                .instruction {
                    font-size: 1rem;
                    text-align: center;
                    padding: 8px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 8px;
                }
                
                .number-pad {
                    display: grid;
                    grid-template-columns: repeat(5, 1fr);
                    gap: 0.5rem;
                    max-width: 320px;
                }
                
                .number-btn {
                    width: 55px;
                    height: 55px;
                    font-size: 1.4rem;
                    font-weight: 700;
                    background: rgba(255, 255, 255, 0.15);
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-radius: 10px;
                    color: white;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .number-btn:hover {
                    background: rgba(255, 255, 255, 0.25);
                    border-color: #4cc9f0;
                }
                
                .feedback {
                    padding: 12px;
                    border-radius: 10px;
                    text-align: center;
                    font-size: 1rem;
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
