import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type { MathVerticalExercise, Exercise } from '@shared/types';

interface InteractiveMultiplicationProps {
    exercise: Exercise;
    content: MathVerticalExercise;
    onSubmit: (answer: { finalAnswer: number; steps: any }) => void;
    errorsRemaining: number | null;
    challengeMode: 'untimed' | 'timed';
    timeoutSeconds?: number;
}

// Helper to get digits
function getDigits(num: number): number[] {
    return num.toString().split('').map(d => parseInt(d));
}

export const InteractiveMultiplication: React.FC<InteractiveMultiplicationProps> = ({
    exercise,
    content,
    onSubmit,
    errorsRemaining,
    challengeMode,
    timeoutSeconds
}) => {
    const { num1, num2, requirePartialProducts, showHelpers } = content;
    
    // Get digits of multiplier (num2)
    const multiplierDigits = getDigits(num2).reverse(); // Reverse for right-to-left
    const multiplicandDigits = getDigits(num1);
    
    // State for partial products (one row per digit of multiplier)
    const [partialProducts, setPartialProducts] = useState<(number | null)[][]>(
        multiplierDigits.map(() => Array(multiplicandDigits.length + multiplierDigits.length).fill(null))
    );
    const [carries, setCarries] = useState<(number | null)[][]>(
        multiplierDigits.map(() => Array(multiplicandDigits.length).fill(null))
    );
    const [currentRow, setCurrentRow] = useState(0);
    const [currentCol, setCurrentCol] = useState(multiplicandDigits.length - 1);
    const [feedback, setFeedback] = useState('');
    const [needsCarry, setNeedsCarry] = useState(false);
    const [finalSum, setFinalSum] = useState<(number | null)[]>(Array(multiplicandDigits.length + multiplierDigits.length).fill(null));
    const [isAddingProducts, setIsAddingProducts] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [timeLeft, setTimeLeft] = useState<number | null>(
        challengeMode === 'timed' && timeoutSeconds ? timeoutSeconds : null
    );
    
    // Timer effect
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
    
    // Calculate expected product for current cell
    const getExpectedProduct = (): { digit: number, carry: number } => {
        const multiplierDigit = multiplierDigits[currentRow];
        const multiplicandDigit = multiplicandDigits[currentCol];
        const prevCarry = currentCol < multiplicandDigits.length - 1 ? (carries[currentRow][currentCol + 1] || 0) : 0;
        
        const product = multiplierDigit * multiplicandDigit + prevCarry;
        return {
            digit: product % 10,
            carry: Math.floor(product / 10)
        };
    };
    
    // Handle digit input for partial products
    const handleDigitInput = (value: string) => {
        if (isAddingProducts) return; // Don't accept input during final sum phase
        
        const digit = parseInt(value);
        if (isNaN(digit) || digit < 0 || digit > 9) return;
        
        const expected = getExpectedProduct();
        
        if (digit === expected.digit) {
            // Correct!
            const newProducts = [...partialProducts];
            const offset = currentRow; // Offset for alignment
            newProducts[currentRow][currentCol + offset] = digit;
            setPartialProducts(newProducts);
            
            setFeedback('Σωστό!');
            
            // Check if we need a carry
            if (expected.carry > 0 && currentCol > 0) {
                setNeedsCarry(true);
            } else {
                // Move to next cell
                moveToNextCell();
            }
        } else {
            setFeedback(`Λάθος! ${errorsRemaining !== null ? `Απομένουν ${errorsRemaining - 1} προσπάθειες.` : 'Δοκίμασε ξανά!'}`);
            setTimeout(() => setFeedback(''), 2000);
        }
    };
    
    // Handle carry input
    const handleCarryInput = (value: string) => {
        const digit = parseInt(value);
        if (isNaN(digit) || digit < 0 || digit > 9) return;
        
        const expected = getExpectedProduct();
        
        if (digit === expected.carry) {
            const newCarries = [...carries];
            newCarries[currentRow][currentCol] = digit;
            setCarries(newCarries);
            setNeedsCarry(false);
            setFeedback('Σωστό κρατούμενο!');
            moveToNextCell();
        } else {
            setFeedback('Λάθος κρατούμενο!');
            setTimeout(() => setFeedback(''), 2000);
        }
    };
    
    // Move to next cell in current partial product row
    const moveToNextCell = () => {
        setTimeout(() => {
            setFeedback('');
            
            if (currentCol > 0) {
                // More columns in this row
                setCurrentCol(currentCol - 1);
            } else {
                // This row is complete
                if (currentRow < multiplierDigits.length - 1) {
                    // Move to next row
                    setCurrentRow(currentRow + 1);
                    setCurrentCol(multiplicandDigits.length - 1);
                } else {
                    // All partial products done, now add them
                    if (requirePartialProducts) {
                        startAddingProducts();
                    } else {
                        completeExercise();
                    }
                }
            }
        }, 500);
    };
    
    // Start the final addition phase
    const startAddingProducts = () => {
        setIsAddingProducts(true);
        setFeedback('Τώρα πρόσθεσε όλα τα μερικά γινόμενα!');
        setTimeout(() => setFeedback(''), 2000);
    };
    
    // Complete the exercise
    const completeExercise = () => {
        setIsComplete(true);
        const finalAnswer = num1 * num2;
        setFeedback(`Μπράβο! ${num1} × ${num2} = ${finalAnswer}`);
        
        setTimeout(() => {
            onSubmit({
                finalAnswer,
                steps: { partialProducts, carries, completed: true }
            });
        }, 2000);
    };
    
    const currentMultiplier = multiplierDigits[currentRow];
    const currentMultiplicand = multiplicandDigits[currentCol];
    
    return (
        <div className="interactive-multiplication">
            <h3>{exercise.title}</h3>
            
            {challengeMode === 'timed' && timeLeft !== null && (
                <div className="timer-display">
                    <span>⏱️</span>
                    <span>{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
                </div>
            )}
            
            {showHelpers && !isAddingProducts && (
                <div className="helper-text">
                    💡 Πολλαπλασίασε κάθε ψηφίο του {num1} με το {currentMultiplier}
                </div>
            )}
            
            <div className="vertical-multiplication">
                {/* Original numbers */}
                <div className="number-row">
                    {multiplicandDigits.map((d, idx) => (
                        <div key={idx} className="digit-cell">{d}</div>
                    ))}
                </div>
                <div className="number-row">
                    <div className="operation-cell">×</div>
                    {getDigits(num2).map((d, idx) => (
                        <div key={idx} className="digit-cell">{d}</div>
                    ))}
                </div>
                <div className="math-line"></div>
                
                {/* Partial products */}
                {multiplierDigits.map((multiplier, rowIdx) => (
                    <div key={rowIdx} className="partial-product-row">
                        {Array(rowIdx).fill(0).map((_, idx) => (
                            <div key={`space-${idx}`} className="digit-cell empty"></div>
                        ))}
                        {partialProducts[rowIdx].slice(rowIdx).map((digit, colIdx) => {
                            const isActive = !isAddingProducts && rowIdx === currentRow && colIdx === currentCol + rowIdx;
                            return (
                                <div 
                                    key={colIdx} 
                                    className={`digit-cell ${isActive ? 'active' : ''} ${digit !== null ? 'filled' : ''}`}
                                >
                                    {digit !== null ? digit : (isActive ? '?' : '')}
                                </div>
                            );
                        })}
                    </div>
                ))}
                
                {isAddingProducts && (
                    <>
                        <div className="math-line"></div>
                        <div className="final-sum-row">
                            {finalSum.map((digit, idx) => (
                                <div key={idx} className="digit-cell">
                                    {digit !== null ? digit : '?'}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
            
            {!isComplete && (
                <div className="input-area">
                    <div className="instruction">
                        {needsCarry ? (
                            'Γράψε το κρατούμενο'
                        ) : isAddingProducts ? (
                            'Πρόσθεσε τα μερικά γινόμενα'
                        ) : (
                            `${currentMultiplicand} × ${currentMultiplier} = ?`
                        )}
                    </div>
                    <div className="number-pad">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(num => (
                            <motion.button
                                key={num}
                                className="number-btn"
                                onClick={() => needsCarry ? handleCarryInput(num.toString()) : handleDigitInput(num.toString())}
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
                .interactive-multiplication {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    padding: 1rem 0;
                    color: white;
                }
                
                .interactive-multiplication h3 {
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
                
                .vertical-multiplication {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 0.3rem;
                    padding: 1rem;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 1rem;
                    margin: 0 auto;
                    max-width: 400px;
                }
                
                .number-row,
                .partial-product-row,
                .final-sum-row {
                    display: flex;
                    gap: 0.5rem;
                }
                
                .digit-cell {
                    width: 45px;
                    height: 45px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.6rem;
                    font-weight: 700;
                }
                
                .digit-cell.empty {
                    opacity: 0;
                }
                
                .digit-cell.active {
                    background: rgba(76, 201, 240, 0.3);
                    border: 2px solid #4cc9f0;
                    border-radius: 8px;
                    animation: pulse 1s infinite;
                }
                
                .digit-cell.filled {
                    background: rgba(6, 214, 160, 0.1);
                    border: 1px solid rgba(6, 214, 160, 0.3);
                    border-radius: 8px;
                }
                
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
                
                .operation-cell {
                    width: 45px;
                    height: 45px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.6rem;
                    font-weight: 700;
                    color: #4cc9f0;
                }
                
                .math-line {
                    width: 100%;
                    height: 2px;
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
