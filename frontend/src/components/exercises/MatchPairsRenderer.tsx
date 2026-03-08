import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { MatchPairsExercise } from '@shared/types';

interface Props {
  exercise: MatchPairsExercise;
  onAnswer: (pairs: { left: string; right: string }[]) => void;
  disabled?: boolean;
}

interface IndexedItem {
  idx: number;   // unique index within its column
  text: string;  // display text
}

export const MatchPairsRenderer: React.FC<Props> = ({ exercise, onAnswer, disabled }) => {
  const [selectedLeftIdx, setSelectedLeftIdx] = useState<number | null>(null);
  // Track matched pairs by their indices: { leftIdx, rightIdx }
  const [matchedPairs, setMatchedPairs] = useState<{ leftIdx: number; rightIdx: number }[]>([]);

  // Build indexed items, shuffled once
  const leftItems: IndexedItem[] = useMemo(() =>
    exercise.pairs.map((p, i) => ({ idx: i, text: p.left })),
  [exercise.pairs]);

  const rightItems: IndexedItem[] = useMemo(() => {
    const items = exercise.pairs.map((p, i) => ({ idx: i, text: p.right }));
    // Fisher-Yates shuffle
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }, [exercise.pairs]);

  const handleLeftClick = (leftIdx: number) => {
    if (disabled || matchedPairs.some(m => m.leftIdx === leftIdx)) return;
    setSelectedLeftIdx(selectedLeftIdx === leftIdx ? null : leftIdx);
  };

  const handleRightClick = (rightIdx: number) => {
    if (disabled || selectedLeftIdx === null || matchedPairs.some(m => m.rightIdx === rightIdx)) return;

    const newPairs = [...matchedPairs, { leftIdx: selectedLeftIdx, rightIdx }];
    setMatchedPairs(newPairs);
    setSelectedLeftIdx(null);

    // If all matched, submit the actual text pairs for backend validation
    if (newPairs.length === exercise.pairs.length) {
      const answerPairs = newPairs.map(p => ({
        left: exercise.pairs[p.leftIdx].left,
        right: exercise.pairs[p.rightIdx].right,
      }));
      onAnswer(answerPairs);
    }
  };

  return (
    <div className="match-container">
      <div className="match-column">
        {leftItems.map(item => {
          const isMatched = matchedPairs.some(m => m.leftIdx === item.idx);
          const isSelected = selectedLeftIdx === item.idx;
          return (
            <motion.button
              key={`left-${item.idx}`}
              className={`match-item left ${isMatched ? 'matched' : ''} ${isSelected ? 'selected' : ''}`}
              onClick={() => handleLeftClick(item.idx)}
              disabled={disabled || isMatched}
              whileTap={!disabled && !isMatched ? { scale: 0.95 } : {}}
            >
              {item.text}
              {isMatched && <span className="matched-indicator">✓</span>}
            </motion.button>
          );
        })}
      </div>

      <div className="match-column">
        {rightItems.map(item => {
          const isMatched = matchedPairs.some(m => m.rightIdx === item.idx);
          const canMatch = selectedLeftIdx !== null;
          return (
            <motion.button
              key={`right-${item.idx}`}
              className={`match-item right ${isMatched ? 'matched' : ''} ${canMatch && !isMatched ? 'can-match' : ''}`}
              onClick={() => handleRightClick(item.idx)}
              disabled={disabled || isMatched || selectedLeftIdx === null}
              whileTap={!disabled && !isMatched && selectedLeftIdx !== null ? { scale: 0.95 } : {}}
              animate={canMatch && !isMatched ? { scale: [1, 1.02, 1] } : {}}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              {item.text}
              {isMatched && <span className="matched-indicator">✓</span>}
            </motion.button>
          );
        })}
      </div>

      <style>{`
        .match-container {
          display: flex;
          gap: 4rem;
          justify-content: center;
          width: 100%;
        }

        .match-column {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          flex: 1;
          max-width: 300px;
        }

        .match-item {
          background: rgba(255, 255, 255, 0.08);
          border: 2px solid rgba(255, 255, 255, 0.1);
          padding: 1.2rem;
          border-radius: 1rem;
          color: white;
          font-size: 1.1rem;
          cursor: pointer;
          position: relative;
          transition: all 0.2s;
          font-family: inherit;
        }

        .match-item.selected {
          border-color: gold;
          background: rgba(255, 215, 0, 0.2);
          box-shadow: 0 0 15px rgba(255, 215, 0, 0.3);
        }

        .match-item.can-match {
          border-color: rgba(255, 215, 0, 0.5);
          cursor: copy;
        }

        .match-item.matched {
          opacity: 0.5;
          background: rgba(46, 213, 115, 0.1);
          border-color: rgba(46, 213, 115, 0.3);
          cursor: default;
        }

        .matched-indicator {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: #2ed573;
          font-weight: bold;
        }

        @media (max-width: 600px) {
          .match-container {
            gap: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
};
