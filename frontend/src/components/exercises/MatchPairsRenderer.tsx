import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { MatchPairsExercise } from '@shared/types';
import { answerPairs, emptyMatching, isComplete, pairOf, rightOrder, tapLeft, tapRight } from '@shared/matchPairs';
import { help } from '../../help/anchors';
import { sound } from '../../sound/sfx';

interface Props {
  exercise: MatchPairsExercise;
  onAnswer: (pairs: { left: string; right: string }[]) => void;
  disabled?: boolean;
}

// A pair's marker, by its left item's row: the same colour while she moves pairs around. No red or green,
// which would read as wrong or right before the check.
const PAIR_COLOURS = ['#4dabf7', '#ff922b', '#e599f7', '#f8f9fa', '#22b8cf', '#c0895e'];
const pairColour = (left: number) => PAIR_COLOURS[left % PAIR_COLOURS.length];

// The pairs are checked only on «Έλεγχος Ζευγαριών», once every item is matched (#86): she looks at the
// finished columns first, and a tap on a matched item takes its pair back (shared/matchPairs.ts).
export const MatchPairsRenderer: React.FC<Props> = ({ exercise, onAnswer, disabled }) => {
  const [matching, setMatching] = useState(emptyMatching);
  const complete = isComplete(matching, exercise.pairs.length);
  const { selected } = matching;

  // The right column in an order fixed by the exercise: after a wrong try (a remount) it stays as she read it
  const order = useMemo(() => rightOrder(exercise), [exercise]);

  const check = () => {
    if (!disabled && complete) onAnswer(answerPairs(matching, exercise));
  };

  return (
    <div className="match-container">
      <div className="match-columns">
        <div className="match-column" {...help('answer.match-left')}>
          {exercise.pairs.map((p, i) => {
            const pair = pairOf(matching, 'left', i);
            const isSelected = selected === i;
            return (
              <motion.button
                key={`left-${i}`}
                className={`match-item left ${pair ? 'matched' : ''} ${isSelected ? 'selected' : ''}`}
                style={pair ? ({ '--pair': pairColour(i) } as React.CSSProperties) : undefined}
                // Selecting it, letting it go, or taking its pair back
                {...sound(pair || isSelected ? 'unselect' : 'select')}
                onClick={() => !disabled && setMatching(m => tapLeft(m, i))}
                disabled={disabled}
                whileTap={!disabled ? { scale: 0.95 } : {}}
              >
                {p.left}
                {pair && <span className="pair-dot" aria-hidden="true" />}
              </motion.button>
            );
          })}
        </div>

        <div className="match-column" {...help('answer.match-right')}>
          {order.map(j => {
            const pair = pairOf(matching, 'right', j);
            const canMatch = selected !== null;
            return (
              <motion.button
                key={`right-${j}`}
                className={`match-item right ${pair ? 'matched' : ''} ${canMatch ? 'can-match' : ''}`}
                style={pair ? ({ '--pair': pairColour(pair.left) } as React.CSSProperties) : undefined}
                // Onto the selected left (even from another pair), or its pair taken back
                {...sound(canMatch ? 'place' : 'unselect')}
                onClick={() => !disabled && setMatching(m => tapRight(m, j))}
                disabled={disabled || (!canMatch && !pair)}
                whileTap={!disabled && (canMatch || pair) ? { scale: 0.95 } : {}}
                animate={canMatch && !pair ? { scale: [1, 1.02, 1] } : {}}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                {pair && <span className="pair-dot" aria-hidden="true" />}
                {exercise.pairs[j].right}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Always there, so nothing moves when the last pair is matched */}
      <motion.button
        className="match-check"
        {...help('answer.match-check')}
        onClick={check}
        disabled={disabled || !complete}
        whileHover={!disabled && complete ? { scale: 1.05 } : {}}
        whileTap={!disabled && complete ? { scale: 0.95 } : {}}
      >
        Έλεγχος Ζευγαριών
      </motion.button>

      <style>{`
        .match-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2rem;
          width: 100%;
        }

        .match-columns {
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

        .match-item:disabled {
          cursor: default;
        }

        /* A tapped item stays enabled now: the focus ring (index.css) would hide its pair's colour */
        .match-item:focus:not(:focus-visible) {
          outline: none;
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
          border-color: var(--pair);
          background: rgba(255, 255, 255, 0.12);
        }

        .pair-dot {
          position: absolute;
          top: 50%;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--pair);
          transform: translateY(-50%);
        }

        .match-item.left .pair-dot { right: 10px; }
        .match-item.right .pair-dot { left: 10px; }

        .match-check {
          background: #a0a0ff;
          color: #1a1a3a;
          border: none;
          padding: 1rem 2.5rem;
          border-radius: 2rem;
          font-size: 1.2rem;
          font-weight: bold;
          font-family: inherit;
          cursor: pointer;
        }

        .match-check:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @media (max-width: 600px) {
          .match-columns {
            gap: 1.5rem;
          }
        }

        /* Short screens (#129): smaller rows, still a finger's 44 px and more */
        @media (max-height: 520px) {
          .match-container { gap: 1rem; }
          .match-column { gap: 0.6rem; }
          .match-item { padding: 0.8rem; }
          .match-check { padding: 0.7rem 2.5rem; }
        }
      `}</style>
    </div>
  );
};
