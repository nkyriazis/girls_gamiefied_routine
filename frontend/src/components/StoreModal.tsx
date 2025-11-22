import React from 'react';
import { motion } from 'framer-motion';
import { SmartIcon } from './SmartIcon';
import { api } from '../api';

interface StoreModalProps {
  user: any;
  rewards: any[];
  onClose: () => void;
}

export const StoreModal: React.FC<StoreModalProps> = ({ user, rewards, onClose }) => {
  const handleBuy = async (reward: any) => {
    if (user.stars < reward.cost) return;
    try {
      await api.spendStars(user.id, reward.id);
      // Close or show success? For now, just close or let the parent update handle it.
      // Maybe show a quick success animation?
    } catch (err) {
      console.error(err);
      alert('Error spending stars');
    }
  };

  return (
    <motion.div 
      className="store-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div 
        className="store-card"
        initial={{ scale: 0.8, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="store-header">
          <h2>Κατάστημα του {user.name}</h2>
          <div className="user-balance">
            ⭐ {user.stars}
          </div>
        </div>

        <div className="rewards-grid">
          {rewards.map(reward => {
            const canAfford = user.stars >= reward.cost;
            return (
              <div 
                key={reward.id} 
                className={`reward-item ${!canAfford ? 'disabled' : ''}`}
                onClick={() => canAfford && handleBuy(reward)}
              >
                <div className="reward-icon">
                  <SmartIcon value={reward.icon} />
                </div>
                <div className="reward-info">
                  <span className="reward-title">{reward.title}</span>
                  <span className="reward-cost">⭐ {reward.cost}</span>
                </div>
              </div>
            );
          })}
        </div>

        <button className="close-btn" onClick={onClose}>Κλείσιμο</button>
      </motion.div>

      <style>{`
        .store-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.8);
          z-index: 2000;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(5px);
        }

        .store-card {
          background: #2a2a4a;
          width: 90%;
          max-width: 600px;
          border-radius: 2rem;
          padding: 2rem;
          border: 2px solid rgba(255,255,255,0.1);
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
          display: flex;
          flex-direction: column;
          gap: 2rem;
          max-height: 80vh;
        }

        .store-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.1);
          padding-bottom: 1rem;
        }

        .store-header h2 {
          margin: 0;
          font-size: 1.5rem;
        }

        .user-balance {
          font-size: 1.5rem;
          font-weight: bold;
          color: gold;
          background: rgba(255,215,0,0.1);
          padding: 0.5rem 1rem;
          border-radius: 1rem;
        }

        .rewards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 1rem;
          overflow-y: auto;
          padding: 0.5rem;
        }

        .reward-item {
          background: rgba(255,255,255,0.05);
          border-radius: 1rem;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid transparent;
        }

        .reward-item:hover {
          background: rgba(255,255,255,0.1);
          transform: translateY(-2px);
        }

        .reward-item.disabled {
          opacity: 0.5;
          cursor: not-allowed;
          filter: grayscale(1);
        }

        .reward-icon {
          font-size: 3rem;
        }

        .reward-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .reward-title {
          font-size: 0.9rem;
          font-weight: 600;
        }

        .reward-cost {
          color: gold;
          font-weight: bold;
        }

        .close-btn {
          background: rgba(255,255,255,0.1);
          border: none;
          color: white;
          padding: 1rem;
          border-radius: 1rem;
          font-size: 1rem;
          cursor: pointer;
          transition: background 0.2s;
        }

        .close-btn:hover {
          background: rgba(255,255,255,0.2);
        }
      `}</style>
    </motion.div>
  );
};
