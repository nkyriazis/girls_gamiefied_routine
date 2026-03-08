import React, { useState } from 'react';
import { motion, Reorder } from 'framer-motion';
import type { OrderingExercise } from '@shared/types';

interface Props {
  exercise: OrderingExercise;
  onAnswer: (itemIds: string[]) => void;
  disabled?: boolean;
}

export const OrderingRenderer: React.FC<Props> = ({ exercise, onAnswer, disabled }) => {
  const [items, setItems] = useState(() => 
    [...exercise.items].sort(() => Math.random() - 0.5)
  );

  const handleSubmit = () => {
    onAnswer(items.map(i => i.id));
  };

  return (
    <div className="ordering-container">
      <Reorder.Group axis="y" values={items} onReorder={setItems} className="reorder-list">
        {items.map(item => (
          <Reorder.Item 
            key={item.id} 
            value={item}
            dragListener={!disabled}
            className={`reorder-item ${disabled ? 'disabled' : ''}`}
          >
            <div className="drag-handle">☰</div>
            <div className="item-text">{item.content}</div>
          </Reorder.Item>
        ))}
      </Reorder.Group>

      <motion.button
        className="submit-order-btn"
        onClick={handleSubmit}
        disabled={disabled}
        whileHover={!disabled ? { scale: 1.05 } : {}}
        whileTap={!disabled ? { scale: 0.95 } : {}}
      >
        Έλεγχος Σειράς
      </motion.button>

      <style>{`
        .ordering-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2rem;
          width: 100%;
        }

        .reorder-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          width: 100%;
          max-width: 400px;
        }

        .reorder-item {
          background: rgba(255, 255, 255, 0.08);
          border: 2px solid rgba(255, 255, 255, 0.1);
          padding: 1.2rem;
          border-radius: 1rem;
          cursor: grab;
          display: flex;
          align-items: center;
          gap: 1.5rem;
          user-select: none;
        }

        .reorder-item.disabled {
          cursor: default;
          opacity: 0.6;
        }

        .drag-handle {
          opacity: 0.4;
          font-size: 1.2rem;
        }

        .item-text {
          font-size: 1.2rem;
          font-weight: 500;
        }

        .submit-order-btn {
          background: #a0a0ff;
          color: #1a1a3a;
          border: none;
          padding: 1rem 2.5rem;
          border-radius: 2rem;
          font-size: 1.2rem;
          font-weight: bold;
          cursor: pointer;
        }

        .submit-order-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};
