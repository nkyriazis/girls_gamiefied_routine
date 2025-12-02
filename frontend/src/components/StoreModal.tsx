import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SmartIcon } from './SmartIcon';
import { api } from '../api';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import type { User, Reward, Spending, StarTransfer } from '@shared/types';
import { useAppSounds } from '../hooks/useAppSounds';
import { useTouchDevice } from '../hooks/useTouchDevice';

interface StoreModalProps {
  user: User;
  rewards: Reward[];
  spendings: Spending[];
  starTransfers: StarTransfer[];
  allUsers: User[];
  onClose: () => void;
}

export const StoreModal: React.FC<StoreModalProps> = ({ user, rewards, spendings, starTransfers, allUsers, onClose }) => {
  const { playClick, playSuccess } = useAppSounds();
  const isTouchDevice = useTouchDevice();
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [justPurchased, setJustPurchased] = useState<{ reward: Reward; cost: number } | null>(null);
  const [showActivity, setShowActivity] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferAmount, setTransferAmount] = useState<number>(1);
  const [selectedRecipient, setSelectedRecipient] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState(false);

  const mySpendings = spendings.filter((s) => s.userId === user.id);
  const pendingSpendings = mySpendings.filter(s => s.status === 'pending');
  const historySpendings = mySpendings.filter(s => s.status === 'done');

  // Calculate pending outgoing transfers
  const myPendingOutgoingTransfers = starTransfers.filter(t => t.fromUserId === user.id && t.status === 'pending');
  const pendingOutgoingAmount = myPendingOutgoingTransfers.reduce((sum, t) => sum + t.amount, 0);
  const availableBalance = user.stars - pendingOutgoingAmount;

  // Incoming pending transfers
  const myPendingIncomingTransfers = starTransfers.filter(t => t.toUserId === user.id && t.status === 'pending');

  // Other users for transfer
  const otherUsers = allUsers.filter(u => u.id !== user.id);

  const handleBuy = async (reward: Reward) => {
    if (availableBalance < reward.cost) {
      alert(`Δεν έχεις αρκετά αστέρια! Χρειάζεσαι ⭐${reward.cost}, έχεις διαθέσιμα ⭐${availableBalance}`);
      return;
    }

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

  const handleTransfer = async () => {
    if (!selectedRecipient || transferAmount <= 0 || transferAmount > availableBalance) return;

    setIsTransferring(true);
    playClick();

    try {
      await api.createTransfer(user.id, selectedRecipient, transferAmount);
      playSuccess();
      setTransferSuccess(true);
      
      setTimeout(() => {
        setTransferSuccess(false);
        setShowTransfer(false);
        setTransferAmount(1);
        setSelectedRecipient('');
      }, 2000);
    } catch (err) {
      console.error(err);
      alert((err as Error).message || 'Error creating transfer');
    } finally {
      setIsTransferring(false);
    }
  };

  const handleCancelTransfer = async (transferId: string) => {
    try {
      await api.cancelTransfer(transferId);
      playClick();
    } catch (err) {
      console.error(err);
      alert('Error cancelling transfer');
    }
  };

  return (
    <>
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
            <h2>{user.name}</h2>
            <div className="balance-section">
              <motion.div
                className="user-balance"
                key={user.stars}
                initial={{ scale: 1 }}
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.3 }}
              >
                ⭐ {user.stars}
              </motion.div>
              {pendingOutgoingAmount > 0 && (
                <div className="pending-balance-hint">
                  (Διαθέσιμα: ⭐ {availableBalance})
                </div>
              )}
            </div>
          </div>

          <div className="store-content">
            <div className="rewards-section">
              <div className="rewards-header">
                <h3>Εξαργύρωση</h3>
                <div className="header-buttons">
                  {otherUsers.length > 0 && (
                    <button
                      className="transfer-btn"
                      onClick={() => setShowTransfer(true)}
                    >
                      🎁 Δώσε Αστέρια
                    </button>
                  )}
                  {(mySpendings.length > 0 || myPendingOutgoingTransfers.length > 0 || myPendingIncomingTransfers.length > 0) && (
                    <button
                      className="activity-toggle-btn"
                      onClick={() => setShowActivity(!showActivity)}
                    >
                      📋 Δραστηριότητα
                    </button>
                  )}
                </div>
              </div>
              <div className="rewards-grid">
                {rewards.map(reward => {
                  const canAfford = availableBalance >= reward.cost;
                  const isPurchasing = purchasingId === reward.id;
                  return (
                    <motion.div
                      key={reward.id}
                      className={`reward-item ${!canAfford ? 'disabled' : ''} ${isPurchasing ? 'purchasing' : ''}`}
                      onClick={() => canAfford && !isPurchasing && handleBuy(reward)}
                      whileHover={!isTouchDevice && canAfford && !isPurchasing ? { scale: 1.05 } : {}}
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
          </div>

          <button className="close-btn" onClick={onClose}>Κλείσιμο</button>
        </motion.div>

        {/* Activity Popup */}
        <AnimatePresence>
          {showActivity && (
            <motion.div
              className="activity-popup-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowActivity(false)}
            >
              <motion.div
                className="activity-popup"
                initial={{ scale: 0.8, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.8, y: 50 }}
                onClick={e => e.stopPropagation()}
              >
                <div className="activity-popup-header">
                  <h3>Δραστηριότητα</h3>
                  <button className="popup-close-btn" onClick={() => setShowActivity(false)}>✕</button>
                </div>

                {mySpendings.length === 0 && myPendingOutgoingTransfers.length === 0 && myPendingIncomingTransfers.length === 0 && (
                  <div className="empty-state">Καμία δραστηριότητα</div>
                )}

                {/* Pending Incoming Transfers */}
                {myPendingIncomingTransfers.length > 0 && (
                  <>
                    <h4>🎁 Εισερχόμενες Μεταφορές (Αναμονή)</h4>
                    <div className="pending-list">
                      {myPendingIncomingTransfers.map(transfer => (
                        <div key={transfer.id} className="pending-item transfer-incoming">
                          <div className="pending-icon">🎁</div>
                          <div className="pending-info">
                            <span className="pending-title">⭐ {transfer.amount} από {transfer.fromUser?.name || 'Unknown'}</span>
                            <span className="pending-date">
                              {format(new Date(transfer.createdAt), 'd MMM HH:mm', { locale: el })}
                            </span>
                          </div>
                          <div className="pending-status">⏳ Αναμονή έγκρισης</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Pending Outgoing Transfers */}
                {myPendingOutgoingTransfers.length > 0 && (
                  <>
                    <h4 style={{ marginTop: '1rem' }}>📤 Εξερχόμενες Μεταφορές (Αναμονή)</h4>
                    <div className="pending-list">
                      {myPendingOutgoingTransfers.map(transfer => (
                        <div key={transfer.id} className="pending-item transfer-outgoing">
                          <div className="pending-icon">📤</div>
                          <div className="pending-info">
                            <span className="pending-title">⭐ {transfer.amount} προς {transfer.toUser?.name || 'Unknown'}</span>
                            <span className="pending-date">
                              {format(new Date(transfer.createdAt), 'd MMM HH:mm', { locale: el })}
                            </span>
                          </div>
                          <button 
                            className="cancel-transfer-btn"
                            onClick={() => handleCancelTransfer(transfer.id)}
                          >
                            Ακύρωση
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {pendingSpendings.length > 0 && (
                  <>
                    <h4 style={{ marginTop: '1rem' }}>Εκκρεμείς Εξαργυρώσεις</h4>
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
                  </>
                )}

                {historySpendings.length > 0 && (
                  <>
                    <h4 style={{ marginTop: '1.5rem' }}>Ιστορικό Εξαργυρώσεων</h4>
                    <div className="pending-list history">
                      {historySpendings.slice(0, 10).map(spending => (
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
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Transfer Dialog */}
        <AnimatePresence>
          {showTransfer && (
            <motion.div
              className="activity-popup-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isTransferring && setShowTransfer(false)}
            >
              <motion.div
                className="activity-popup transfer-dialog"
                initial={{ scale: 0.8, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.8, y: 50 }}
                onClick={e => e.stopPropagation()}
              >
                {transferSuccess ? (
                  <div className="transfer-success">
                    <div className="success-icon">🎉</div>
                    <h3>Επιτυχία!</h3>
                    <p>Το αίτημα μεταφοράς στάλθηκε.</p>
                    <p className="success-hint">Περιμένει έγκριση από γονέα.</p>
                  </div>
                ) : (
                  <>
                    <div className="activity-popup-header">
                      <h3>🎁 Δώσε Αστέρια</h3>
                      <button className="popup-close-btn" onClick={() => setShowTransfer(false)}>✕</button>
                    </div>

                    <div className="transfer-form">
                      <div className="form-field">
                        <label>Προς:</label>
                        <select 
                          value={selectedRecipient} 
                          onChange={(e) => setSelectedRecipient(e.target.value)}
                        >
                          <option value="">Επέλεξε παραλήπτη</option>
                          {otherUsers.map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-field">
                        <label>Ποσό:</label>
                        <div className="amount-input">
                          <button 
                            className="amount-btn"
                            onClick={() => setTransferAmount(Math.max(1, transferAmount - 1))}
                            disabled={transferAmount <= 1}
                          >
                            -
                          </button>
                          <input 
                            type="number" 
                            min="1" 
                            max={availableBalance}
                            value={transferAmount}
                            onChange={(e) => setTransferAmount(Math.min(availableBalance, Math.max(1, parseInt(e.target.value) || 1)))}
                          />
                          <button 
                            className="amount-btn"
                            onClick={() => setTransferAmount(Math.min(availableBalance, transferAmount + 1))}
                            disabled={transferAmount >= availableBalance}
                          >
                            +
                          </button>
                        </div>
                        <span className="available-hint">Διαθέσιμα: ⭐ {availableBalance}</span>
                      </div>

                      <button 
                        className="send-transfer-btn"
                        onClick={handleTransfer}
                        disabled={!selectedRecipient || transferAmount <= 0 || transferAmount > availableBalance || isTransferring}
                      >
                        {isTransferring ? 'Αποστολή...' : `Στείλε ⭐ ${transferAmount}`}
                      </button>

                      <p className="transfer-hint">
                        Τα αστέρια θα δεσμευτούν μέχρι να εγκρίνει ο γονέας.
                      </p>
                    </div>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
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
          overflow: hidden;
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
          flex-direction: column;
          overflow: hidden;
          flex: 1;
        }

        .rewards-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          overflow: hidden;
        }

        .rewards-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .activity-toggle-btn {
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          color: white;
          padding: 0.75rem 1.25rem;
          border-radius: 0.5rem;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          user-select: none;
        }

        @media (hover: hover) and (pointer: fine) {
          .activity-toggle-btn:hover {
            background: rgba(255,255,255,0.2);
          }
        }

        .activity-popup-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.5);
          z-index: 3000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .activity-popup {
          background: #2a2a4a;
          width: 90%;
          max-width: 500px;
          max-height: 80vh;
          border-radius: 1.5rem;
          padding: 1.5rem;
          border: 2px solid rgba(255,255,255,0.1);
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
          display: flex;
          flex-direction: column;
          gap: 1rem;
          overflow: hidden;
        }

        .activity-popup-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.1);
          padding-bottom: 0.75rem;
        }

        .activity-popup-header h3 {
          margin: 0;
        }

        .popup-close-btn {
          background: transparent;
          border: none;
          color: white;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0.25rem 0.5rem;
          line-height: 1;
          opacity: 0.7;
          transition: opacity 0.2s;
        }

        .popup-close-btn:hover {
          opacity: 1;
        }

        .activity-popup h4 {
          margin: 0;
          font-size: 0.9rem;
          opacity: 0.7;
          letter-spacing: 0.5px;
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
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          user-select: none;
          min-height: 140px;
        }

        @media (hover: hover) and (pointer: fine) {
          .reward-item:hover:not(.disabled):not(.purchasing) {
            background: rgba(255,255,255,0.1);
          }
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
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          user-select: none;
          min-height: 48px;
        }

        @media (hover: hover) and (pointer: fine) {
          .close-btn:hover {
            background: rgba(255,255,255,0.2);
          }
        }

        /* Balance section */
        .balance-section {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.25rem;
        }

        .pending-balance-hint {
          font-size: 0.75rem;
          color: #ff9f43;
          opacity: 0.9;
        }

        /* Header buttons */
        .header-buttons {
          display: flex;
          gap: 0.5rem;
        }

        .transfer-btn {
          background: linear-gradient(135deg, #a55eea, #8854d0);
          border: none;
          color: white;
          padding: 0.75rem 1.25rem;
          border-radius: 0.5rem;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s;
          -webkit-tap-highlight-color: transparent;
        }

        .transfer-btn:hover {
          transform: scale(1.02);
          box-shadow: 0 4px 12px rgba(165, 94, 234, 0.4);
        }

        /* Transfer specific styles */
        .pending-item.transfer-incoming {
          border-left: 3px solid #2ecc71;
        }

        .pending-item.transfer-outgoing {
          border-left: 3px solid #e67e22;
        }

        .cancel-transfer-btn {
          background: rgba(231, 76, 60, 0.8);
          border: none;
          color: white;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .cancel-transfer-btn:hover {
          background: #e74c3c;
        }

        /* Transfer Dialog */
        .transfer-dialog {
          max-width: 400px;
        }

        .transfer-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-field label {
          font-size: 0.9rem;
          color: #aaa;
        }

        .form-field select {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 0.5rem;
          color: white;
          padding: 0.75rem;
          font-size: 1rem;
          cursor: pointer;
        }

        .form-field select:focus {
          outline: none;
          border-color: #a55eea;
        }

        .amount-input {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .amount-btn {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          font-size: 1.25rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .amount-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.2);
        }

        .amount-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .amount-input input {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 0.5rem;
          color: white;
          padding: 0.75rem;
          font-size: 1.25rem;
          text-align: center;
          width: 80px;
        }

        .amount-input input:focus {
          outline: none;
          border-color: #a55eea;
        }

        .available-hint {
          font-size: 0.85rem;
          color: #888;
        }

        .send-transfer-btn {
          background: linear-gradient(135deg, #a55eea, #8854d0);
          border: none;
          color: white;
          padding: 1rem;
          border-radius: 0.75rem;
          font-size: 1.1rem;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 0.5rem;
        }

        .send-transfer-btn:hover:not(:disabled) {
          transform: scale(1.02);
          box-shadow: 0 4px 12px rgba(165, 94, 234, 0.4);
        }

        .send-transfer-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .transfer-hint {
          font-size: 0.85rem;
          color: #888;
          text-align: center;
          margin: 0;
        }

        .transfer-success {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 2rem;
          gap: 1rem;
          text-align: center;
        }

        .success-icon {
          font-size: 4rem;
        }

        .transfer-success h3 {
          margin: 0;
          font-size: 1.5rem;
          color: #2ecc71;
        }

        .transfer-success p {
          margin: 0;
          color: #ccc;
        }

        .success-hint {
          font-size: 0.85rem !important;
          color: #888 !important;
        }

        @media (max-width: 768px) {
          .store-card {
            width: 95%;
            padding: 1.5rem;
          }
          .rewards-grid {
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
            gap: 0.75rem;
          }
          .activity-popup {
            width: 95%;
            max-height: 85vh;
          }
          .header-buttons {
            flex-direction: column;
            gap: 0.25rem;
          }
          .rewards-header {
            flex-direction: column;
            align-items: flex-start !important;
            gap: 0.5rem;
          }
        }
      `}</style>
    </>
  );
};
