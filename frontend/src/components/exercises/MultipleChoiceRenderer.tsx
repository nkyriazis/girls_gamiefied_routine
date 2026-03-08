import React from 'react';
import { motion } from 'framer-motion';
import type { MultipleChoiceExercise } from '@shared/types';

interface Props {
  exercise: MultipleChoiceExercise;
  onAnswer: (index: number) => void;
  disabled?: boolean;
}

export const MultipleChoiceRenderer: React.FC<Props> = ({ exercise, onAnswer, disabled }) => {
  return (
    <div className="options-grid">
      {exercise.options.map((option, index) => (
        <motion.button
          key={index}
          className="option-btn"
          onClick={() => onAnswer(index)}
          disabled={disabled}
          whileHover={!disabled ? { scale: 1.02, backgroundColor: "rgba(255,255,255,0.15)" } : {}}
          whileTap={!disabled ? { scale: 0.98 } : {}}
        >
          <div className="option-letter">{String.fromCharCode(65 + index)}</div>
          <div className="option-text">{option}</div>
        </motion.button>
      ))}

      <style>{`
        .options-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          width: 100%;
        }

        .option-btn {
          background: rgba(255, 255, 255, 0.08);
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-radius: 1.5rem;
          padding: 1.5rem;
          color: white;
          font-size: 1.3rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 1.5rem;
          text-align: left;
          transition: border-color 0.2s;
        }

        .option-btn:hover:not(:disabled) {
          border-color: rgba(255, 255, 255, 0.3);
        }

        .option-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .option-letter {
          background: rgba(255, 255, 255, 0.1);
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 1.1rem;
          flex-shrink: 0;
          color: gold;
        }

        .option-text {
          flex: 1;
        }

        @media (max-width: 600px) {
          .options-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};
