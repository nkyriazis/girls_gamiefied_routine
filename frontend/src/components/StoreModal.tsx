import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SmartIcon } from './SmartIcon';
import { api } from '../api';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import type { User, Reward, Spending } from '@shared/types';
import { useAppSounds } from '../hooks/useAppSounds';

interface StoreModalProps {
  user: User;
  rewards: Reward[];
  spendings: Spending[];
  onClose: () => void;
}

export const StoreModal: React.FC<StoreModalProps> = ({ user, rewards, spendings, onClose }) => {
  const { playClick, playSuccess } = useAppSounds();
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [justPurchased, setJustPurchased] = useState<{ reward: Reward; cost: number } | null>(null);

  const mySpendings = spendings.filter((s) => s.userId === user.id);
  const pendingSpendings = mySpendings.filter(s => s.status === 'pending');
  const historySpendings = mySpendings.filter(s => s.status === 'done');

  const handleBuy = async (reward: Reward) => {
    if (user.stars < reward.cost) return;

    setPurchasingId(reward.id);
    playClick();

    try {
      await api.spendStars(user.id, reward.id);

      // Show purchase animation
      setJustPurchased({ reward, cost: reward.cost });
      playSuccess();

      setTimeout(() => {
        setJustPurchased(null);
      }, 2000);
    } catch (err) {
      console.error(err);
      alert('Error spending stars');
    } finally {
      setPurchasingId(null);
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
      <AnimatePresence>
        {justPurchased && (
          <motion.div
            className="purchase-celebration"
            initial={{ opacity: 0, scale: 0.5, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.5, y: -100 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              className="celebration-icon"
              animate={{
                rotate: [0, -10, 10, -10, 10, 0],
                scale: [1, 1.2, 1, 1.2, 1]
              }}
              transition={{ duration: 0.5 }}
            >
              <SmartIcon value={justPurchased.reward.icon} />
            </motion.div>
            <div className="celebration-text">
              {justPurchased.reward.title}
            </div>
            <div className="celebration-cost">
              -⭐ {justPurchased.cost}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="store-card"
        initial={{ scale: 0.8, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="store-header">
          <h2>Κατάστημα του {user.name}</h2>
          <motion.div
            className="user-balance"
            key={user.stars}
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 0.3 }}
          >
            ⭐ {user.stars}
          </motion.div>
        </div>

        <div className="store-content">
          <div className="rewards-section">
            <h3>Εξαργύρωση</h3>
            <div className="rewards-grid">
              {rewards.map(reward => {
                const canAfford = user.stars >= reward.cost;
                const isPurchasing = purchasingId === reward.id;
                return (
                  <motion.div
                    key={reward.id}
                    className={`reward-item ${!canAfford ? 'disabled' : ''} ${isPurchasing ? 'purchasing' : ''}`}
                    onClick={() => canAfford && !isPurchasing && handleBuy(reward)}
                    whileHover={canAfford && !isPurchasing ? { scale: 1.05 } : {}}
                    whileTap={canAfford && !isPurchasing ? { scale: 0.95 } : {}}
                    animate={isPurchasing ? {
                      scale: [1, 1.1, 0.9, 1],
                      rotate: [0, -5, 5, 0]
                    } : {}}
                    transition={{ duration: 0.3 }}
                  >
                    <motion.div
                      className="reward-icon"
                      animate={isPurchasing ? {
                        scale: [1, 1.3, 1],
                        rotate: [0, 360]
                      } : {}}
                      transition={{ duration: 0.5 }}
                    >
                      <SmartIcon value={reward.icon} />
                    </motion.div>
                    <div className="reward-info">
                      <span className="reward-title">{reward.title}</span>
                      <span className="reward-cost">⭐ {reward.cost}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div className="pending-section">
            <h3>Δραστηριότητα</h3>

            {mySpendings.length === 0 && (
              <div className="empty-state">Καμία δραστηριότητα</div>
            )}

            {pendingSpendings.length > 0 && (
              <div className="pending-list">
                {pendingSpendings.map(spending => (
                  <div key={spending.id} className="pending-item">
                    <div className="pending-icon">
                      <SmartIcon value={spending.reward?.icon || '❓'} />
                    </div>
                    <div className="pending-info">
                      <span className="pending-title">{spending.reward?.title}</span>
                      <span className="pending-date">
                        {format(new Date(spending.createdAt), 'd MMM HH:mm', { locale: el })}
                      </span>
                    </div>
                    <div className="pending-status">⏳</div>
                  </div>
                ))}
              </div>
            )}

            {historySpendings.length > 0 && (
              <>
                <h4 style={{ marginTop: '1rem', opacity: 0.7, margin: '1rem 0 0.5rem 0' }}>Ιστορικό</h4>
                <div className="pending-list history">
                  {historySpendings.slice(0, 5).map(spending => (
                    <div key={spending.id} className="pending-item done">
                      <div className="pending-icon">
                        <SmartIcon value={spending.reward?.icon || '❓'} />
                      </div>
                      <div className="pending-info">
                        <span className="pending-title">{spending.reward?.title}</span>
                        <span className="pending-date">
                          {format(new Date(spending.createdAt), 'd MMM HH:mm', { locale: el })}
                        </span>
                      </div>
                      <div className="pending-status">✅</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
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

        .purchase-celebration {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 3000;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          background: rgba(0,0,0,0.9);
          padding: 3rem;
          border-radius: 2rem;
          border: 3px solid gold;
          box-shadow: 0 0 50px rgba(255,215,0,0.5);
        }

        .celebration-icon {
          font-size: 6rem;
          filter: drop-shadow(0 0 20px gold);
        }

        .celebration-text {
          font-size: 2rem;
          font-weight: bold;
          color: white;
          text-shadow: 0 0 10px rgba(255,215,0,0.5);
        }

        .celebration-cost {
          font-size: 1.5rem;
          color: gold;
          font-weight: bold;
        }

        .store-card {
          background: #2a2a4a;
          width: 90%;
          max-width: 800px;
          border-radius: 2rem;
          padding: 2rem;
          border: 2px solid rgba(255,255,255,0.1);
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          max-height: 90vh;
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

        .store-content {
          display: flex;
          gap: 2rem;
          overflow: hidden;
          flex: 1;
        }

        .rewards-section {
          flex: 2;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          overflow: hidden;
        }

        .pending-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          background: rgba(0,0,0,0.2);
          border-radius: 1rem;
          padding: 1rem;
          min-width: 250px;
          overflow: hidden;
        }

        .empty-state {
          opacity: 0.5;
          font-style: italic;
          text-align: center;
          padding: 1rem;
        }

        h3 {
          margin: 0;
          font-size: 1.1rem;
          opacity: 0.8;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .rewards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 1rem;
          overflow-y: auto;
          padding: 0.5rem;
          flex: 1;
          min-height: 0;
          align-content: start;
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

        .reward-item:hover:not(.disabled):not(.purchasing) {
          background: rgba(255,255,255,0.1);
        }

        .reward-item.purchasing {
          background: rgba(255,215,0,0.2);
          border-color: gold;
          pointer-events: none;
        }

        .reward-item.disabled {
          opacity: 0.5;
          cursor: not-allowed;
          filter: grayscale(1);
        }

        .reward-icon {
          font-size: 2.5rem;
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

        .pending-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          overflow-y: auto;
          flex: 1;
          min-height: 0;
        }

        .pending-item {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          background: rgba(255,255,255,0.05);
          padding: 0.8rem;
          border-radius: 0.8rem;
        }

        .pending-icon {
          font-size: 1.5rem;
        }

        .pending-info {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .pending-title {
          font-weight: 600;
          font-size: 0.9rem;
        }

        .pending-date {
          font-size: 0.7rem;
          opacity: 0.5;
        }

        .pending-status {
          font-size: 1.2rem;
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

        @media (max-width: 768px) {
          .store-content {
            flex-direction: column;
          }
          .pending-section {
            max-height: 200px;
          }
        }
      `}</style>
    </motion.div>
  );
};
