import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type { NumberInputExercise } from '@shared/types';

interface Props {
  exercise: NumberInputExercise;
  onAnswer: (value: number) => void;
  disabled?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'];

export const NumberInputRenderer: React.FC<Props> = ({ onAnswer, disabled }) => {
  const [value, setValue] = useState('');

  const handleKey = (key: string) => {
    if (disabled) return;
    if (key === '⌫') {
      setValue(prev => prev.slice(0, -1));
    } else if (key === 'OK') {
      if (value.length > 0) onAnswer(Number(value));
    } else if (value.length < 6) {
      setValue(prev => prev + key);
    }
  };

  return (
    <div className="number-input">
      <div className="number-display">{value || ' '}</div>
      <div className="numpad">
        {KEYS.map(key => (
          <motion.button
            key={key}
            className={`numpad-key ${key === 'OK' ? 'ok' : ''} ${key === '⌫' ? 'back' : ''}`}
            onClick={() => handleKey(key)}
            disabled={disabled || (key === 'OK' && value.length === 0)}
            whileTap={!disabled ? { scale: 0.92 } : {}}
          >
            {key}
          </motion.button>
        ))}
      </div>

      <style>{`
        .number-input {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
          width: 100%;
        }

        .number-display {
          background: rgba(255, 255, 255, 0.08);
          border: 2px solid rgba(255, 255, 255, 0.15);
          border-radius: 1.5rem;
          padding: 1rem 2rem;
          min-width: 220px;
          min-height: 4.5rem;
          font-size: 2.5rem;
          font-weight: bold;
          text-align: center;
          color: gold;
          letter-spacing: 0.2rem;
        }

        .numpad {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.75rem;
          width: 100%;
          max-width: 320px;
        }

        .numpad-key {
          background: rgba(255, 255, 255, 0.08);
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-radius: 1.25rem;
          padding: 1rem;
          color: white;
          font-size: 1.6rem;
          font-weight: bold;
          cursor: pointer;
          transition: border-color 0.2s;
          min-height: 64px;
        }

        .numpad-key:hover:not(:disabled) {
          border-color: rgba(255, 255, 255, 0.3);
        }

        .numpad-key:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .numpad-key.ok {
          background: linear-gradient(135deg, #06d6a0, #04a57b);
          color: #0d1b2a;
        }

        .numpad-key.back {
          color: #ef476f;
        }
      `}</style>
    </div>
  );
};
