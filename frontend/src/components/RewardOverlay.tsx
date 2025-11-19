import React from 'react';
import { motion } from 'framer-motion';

interface RewardOverlayProps {
  starsEarned: number;
  onClose: () => void;
}

export const RewardOverlay: React.FC<RewardOverlayProps> = ({ starsEarned, onClose }) => {
  // Generate random particles
  const particles = Array.from({ length: 20 }).map((_, i) => ({
    id: i,
    x: Math.random() * 100 - 50,
    y: Math.random() * 100 - 50,
    scale: Math.random() * 0.5 + 0.5,
  }));

  return (
    <motion.div 
      className="reward-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div 
        className="reward-card"
        initial={{ scale: 0.5, y: 100 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0.5 }}
      >
        <h1>🎉 Μπράβο! 🎉</h1>
        
        <div className="stars-container">
          <motion.div 
            className="big-star"
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          >
            ⭐
          </motion.div>
          <motion.div 
            className="stars-text"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            +{starsEarned}
          </motion.div>
        </div>

        {particles.map(p => (
          <motion.div
            key={p.id}
            className="particle"
            initial={{ x: 0, y: 0, opacity: 1 }}
            animate={{ x: p.x * 10, y: p.y * 10, opacity: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            ✨
          </motion.div>
        ))}

        <button onClick={onClose} className="btn-close">Τέλεια!</button>
      </motion.div>

      <style>{`
        .reward-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
          border-radius: 2rem;
        }

        .reward-card {
          background: var(--glass-bg);
          backdrop-filter: blur(20px);
          border: 2px solid var(--color-accent);
          padding: 4rem;
          border-radius: 3rem;
          text-align: center;
          position: relative;
          overflow: hidden;
          box-shadow: 0 0 50px var(--color-accent);
        }

        .reward-card h1 {
          font-size: 3rem;
          margin-bottom: 2rem;
          color: white;
        }

        .stars-container {
          position: relative;
          height: 200px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 2rem;
        }

        .big-star {
          font-size: 10rem;
          position: absolute;
          filter: drop-shadow(0 0 20px gold);
        }

        .stars-text {
          font-size: 4rem;
          font-weight: 900;
          color: white;
          text-shadow: 2px 2px 0 #000;
          z-index: 1;
        }

        .particle {
          position: absolute;
          top: 50%;
          left: 50%;
          font-size: 2rem;
          pointer-events: none;
        }

        .btn-close {
          background: var(--color-accent);
          color: #000;
          font-size: 1.5rem;
          padding: 1rem 3rem;
          border-radius: 2rem;
          font-weight: bold;
          margin-top: 2rem;
          transition: transform 0.1s;
        }

        .btn-close:hover {
          transform: scale(1.05);
          box-shadow: 0 0 20px var(--color-accent);
        }
      `}</style>
    </motion.div>
  );
};
