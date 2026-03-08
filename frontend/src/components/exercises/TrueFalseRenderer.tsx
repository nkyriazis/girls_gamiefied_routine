import React from 'react';
import { motion } from 'framer-motion';
import type { TrueFalseExercise } from '@shared/types';

interface Props {
  exercise: TrueFalseExercise;
  onAnswer: (value: boolean) => void;
  disabled?: boolean;
}

export const TrueFalseRenderer: React.FC<Props> = ({ onAnswer, disabled }) => {
  return (
    <div className="tf-container">
      <motion.button
        className="tf-btn true"
        onClick={() => onAnswer(true)}
        disabled={disabled}
        whileHover={!disabled ? { scale: 1.05 } : {}}
        whileTap={!disabled ? { scale: 0.95 } : {}}
      >
        <span className="tf-icon">✅</span>
        <span className="tf-label">Σωστό</span>
      </motion.button>

      <motion.button
        className="tf-btn false"
        onClick={() => onAnswer(false)}
        disabled={disabled}
        whileHover={!disabled ? { scale: 1.05 } : {}}
        whileTap={!disabled ? { scale: 0.95 } : {}}
      >
        <span className="tf-icon">❌</span>
        <span className="tf-label">Λάθος</span>
      </motion.button>

      <style>{`
        .tf-container {
          display: flex;
          gap: 3rem;
          justify-content: center;
          width: 100%;
        }

        .tf-btn {
          flex: 1;
          max-width: 250px;
          padding: 2.5rem;
          border-radius: 2rem;
          border: none;
          color: white;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          font-size: 1.5rem;
          font-weight: bold;
          transition: filter 0.2s;
        }

        .tf-btn.true {
          background: linear-gradient(135deg, #2ed573 0%, #7bed9f 100%);
          box-shadow: 0 10px 20px rgba(46, 213, 115, 0.3);
        }

        .tf-btn.false {
          background: linear-gradient(135deg, #ff4757 0%, #ff6b81 100%);
          box-shadow: 0 10px 20px rgba(255, 71, 87, 0.3);
        }

        .tf-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          filter: grayscale(0.5);
        }

        .tf-icon {
          font-size: 3rem;
        }

        @media (max-width: 600px) {
          .tf-container {
            gap: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
};
