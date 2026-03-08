import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { FillBlankExercise } from '@shared/types';

interface Props {
  exercise: FillBlankExercise;
  onAnswer: (answers: string[]) => void;
  disabled?: boolean;
}

export const FillBlankRenderer: React.FC<Props> = ({ exercise, onAnswer, disabled }) => {
  const gapCount = exercise.correctAnswers.length;
  const [filledGaps, setFilledGaps] = useState<(string | null)[]>(new Array(gapCount).fill(null));
  const [activeGapIndex, setActiveGapIndex] = useState(0);

  // Shuffle options once on mount
  const shuffledOptions = useMemo(() =>
    [...(exercise.options || exercise.correctAnswers)].sort(() => Math.random() - 0.5),
  [exercise.options, exercise.correctAnswers]);

  // Which options are still available (not yet placed in a gap)
  const usedWords = filledGaps.filter(Boolean) as string[];

  const handleWordTap = (word: string) => {
    if (disabled) return;
    
    // Find the next empty gap (starting from activeGapIndex)
    let targetGap = filledGaps.findIndex((g, i) => i >= activeGapIndex && g === null);
    if (targetGap === -1) {
      // All gaps from activeGapIndex are filled, try from start
      targetGap = filledGaps.findIndex(g => g === null);
    }
    if (targetGap === -1) return; // All gaps filled

    const newGaps = [...filledGaps];
    newGaps[targetGap] = word;
    setFilledGaps(newGaps);

    // Move active gap to next empty
    const nextEmpty = newGaps.findIndex((g, i) => i > targetGap && g === null);
    setActiveGapIndex(nextEmpty !== -1 ? nextEmpty : targetGap);

    // Auto-submit when all gaps filled
    if (newGaps.every(g => g !== null)) {
      onAnswer(newGaps as string[]);
    }
  };

  const handleGapTap = (gapIndex: number) => {
    if (disabled) return;
    const word = filledGaps[gapIndex];
    if (word) {
      // Remove word from gap, make it available again
      const newGaps = [...filledGaps];
      newGaps[gapIndex] = null;
      setFilledGaps(newGaps);
      setActiveGapIndex(gapIndex);
    } else {
      setActiveGapIndex(gapIndex);
    }
  };

  // Parse "Το {0} είναι ένα κόκκινο {1}." into segments
  const segments = exercise.textWithGaps.split(/\{(\d+)\}/);

  return (
    <div className="fillblank-container">
      {/* Sentence with tappable gaps */}
      <div className="fb-sentence">
        {segments.map((segment: string, index: number) => {
          if (index % 2 === 1) {
            const gapIndex = parseInt(segment);
            const filled = filledGaps[gapIndex];
            const isActive = activeGapIndex === gapIndex;
            return (
              <motion.button
                key={`gap-${index}`}
                className={`fb-gap ${filled ? 'filled' : ''} ${isActive ? 'active' : ''}`}
                onClick={() => handleGapTap(gapIndex)}
                disabled={disabled}
                whileTap={{ scale: 0.95 }}
              >
                {filled || '___'}
              </motion.button>
            );
          }
          return <span key={index}>{segment}</span>;
        })}
      </div>

      {/* Word bank */}
      <div className="fb-word-bank">
        {shuffledOptions.map((word, i) => {
          const isUsed = usedWords.includes(word);
          return (
            <motion.button
              key={`word-${i}`}
              className={`fb-word ${isUsed ? 'used' : ''}`}
              onClick={() => handleWordTap(word)}
              disabled={disabled || isUsed}
              whileHover={!disabled && !isUsed ? { scale: 1.05 } : {}}
              whileTap={!disabled && !isUsed ? { scale: 0.9 } : {}}
            >
              {word}
            </motion.button>
          );
        })}
      </div>

      <style>{`
        .fillblank-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2.5rem;
          width: 100%;
        }

        .fb-sentence {
          font-size: 1.6rem;
          line-height: 3;
          text-align: center;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 0.3rem;
        }

        .fb-gap {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 120px;
          padding: 0.4rem 1.2rem;
          background: rgba(255, 255, 255, 0.08);
          border: 2px dashed rgba(255, 215, 0, 0.4);
          border-radius: 0.8rem;
          color: rgba(255, 255, 255, 0.3);
          font-size: 1.4rem;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s;
        }

        .fb-gap.active {
          border-color: gold;
          background: rgba(255, 215, 0, 0.1);
          box-shadow: 0 0 12px rgba(255, 215, 0, 0.2);
        }

        .fb-gap.filled {
          color: white;
          background: rgba(255, 215, 0, 0.15);
          border-style: solid;
          border-color: gold;
          font-weight: bold;
        }

        .fb-word-bank {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          justify-content: center;
          max-width: 600px;
        }

        .fb-word {
          background: rgba(255, 255, 255, 0.12);
          border: 2px solid rgba(255, 255, 255, 0.2);
          color: white;
          padding: 0.8rem 1.8rem;
          border-radius: 2rem;
          font-size: 1.2rem;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s;
        }

        .fb-word:hover:not(:disabled) {
          background: rgba(255, 215, 0, 0.2);
          border-color: gold;
        }

        .fb-word.used {
          opacity: 0.25;
          cursor: default;
          transform: scale(0.9);
        }
      `}</style>
    </div>
  );
};
