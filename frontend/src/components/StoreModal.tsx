import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SmartIcon } from './SmartIcon';
import { api, ApiError } from '../api';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import type { User, Reward, Spending, StarTransfer } from '@shared/types';
import { sfx, sound } from '../sound/sfx';
import { useTouchDevice } from '../hooks/useTouchDevice';
import { useGame } from '../context/GameContext';
import { UserExercises } from './UserExercises';
import { help } from '../help/anchors';
import { HelpScreen } from '../help/HelpProvider';
import { activityTour, storeTour, transferTour } from './StoreModal.help';

interface StoreModalProps {
  user: User;
  rewards: Reward[];
  spendings: Spending[];
  starTransfers: StarTransfer[];
  allUsers: User[];
  onClose: () => void;
}

export const StoreModal: React.FC<StoreModalProps> = ({ user, rewards, spendings, starTransfers, allUsers, onClose }) => {
  const isTouchDevice = useTouchDevice();
  // Earning stars sits next to spending them: her exercises of the day and «Κι άλλο πρόβλημα»
  const { exerciseAssignments, config } = useGame();
  const canEarn = exerciseAssignments.some(a => a.userId === user.id) || (!!user.grade && (config.settings.extraProblemsPerDay ?? 10) > 0);
  // A revision card among hers: the tour's edition that explains its pill
  const revision = exerciseAssignments.some(a => a.userId === user.id && a.revision && !a.extra);
  // An extra problem she left with ✕: the edition that explains its card (#67)
  const extra = exerciseAssignments.some(a => a.userId === user.id && a.extra && a.status === 'pending');
  // A retry of an item shown worked among hers: the edition that explains its pill (#136)
  const retry = exerciseAssignments.some(a => a.userId === user.id && a.retryOf && !a.extra);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  // A purchase asks first, inside the reward's own card: a kid can't undo it (only a parent can)
  const [askingId, setAskingId] = useState<string | null>(null);
  const [justPurchased, setJustPurchased] = useState<{ reward: Reward; cost: number } | null>(null);
  const [showActivity, setShowActivity] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferAmount, setTransferAmount] = useState<number>(1);
  const [selectedRecipient, setSelectedRecipient] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  const mySpendings = spendings.filter((s) => s.userId === user.id);
  const pendingSpendings = mySpendings.filter(s => s.status === 'pending');
  const historySpendings = mySpendings.filter(s => s.status === 'done');

  // Stars promised in her pending gifts stay hers but can't be spent: the server says what is available
  const myPendingOutgoingTransfers = starTransfers.filter(t => t.fromUserId === user.id && t.status === 'pending');
  const availableBalance = user.available;

  // Incoming pending transfers
  const myPendingIncomingTransfers = starTransfers.filter(t => t.toUserId === user.id && t.status === 'pending');
  // What the activity popup lists (a revoked purchase isn't shown, so it doesn't count)
  const hasActivity = pendingSpendings.length + historySpendings.length
    + myPendingOutgoingTransfers.length + myPendingIncomingTransfers.length > 0;

  // Other users for transfer
  const otherUsers = allUsers.filter(u => u.id !== user.id);
  // Records name the kids and the reward by id
  const nameOf = (userId: string) => allUsers.find(u => u.id === userId)?.name;
  const rewardOf = (rewardId: string) => rewards.find(r => r.id === rewardId);

  // A purchase or gift the server refused (a gift made on another screen took the stars first, say).
  // It shows where she is looking: under the balance, or in the gift form or the activity popup
  // while one is open. Never a browser alert().
  const refuse = (text: string) => {
    sfx('nope');
    setRefusal(text);
    setTimeout(() => setRefusal(current => current === text ? null : current), 3500);
  };

  const handleBuy = async (reward: Reward) => {
    if (availableBalance < reward.cost) return refuse('Δεν έχεις αρκετά διαθέσιμα αστέρια');

    setPurchasingId(reward.id);

    try {
      await api.spendStars(user.id, reward.id);

      // Show purchase animation
      setJustPurchased({ reward, cost: reward.cost });
      sfx('spend');

      setTimeout(() => {
        setJustPurchased(null);
      }, 2000);
    } catch (err) {
      console.error(err);
      refuse(err instanceof ApiError && err.status === 400 ? 'Δεν έχεις αρκετά διαθέσιμα αστέρια' : 'Κάτι πήγε στραβά. Δοκίμασε ξανά.');
    } finally {
      setPurchasingId(null);
    }
  };

  const handleTransfer = async () => {
    if (!selectedRecipient || transferAmount <= 0 || transferAmount > availableBalance) return;

    setIsTransferring(true);

    try {
      await api.createTransfer(user.id, selectedRecipient, transferAmount);
      sfx('send');
      setTransferSuccess(true);
      
      setTimeout(() => {
        setTransferSuccess(false);
        setShowTransfer(false);
        setTransferAmount(1);
        setSelectedRecipient('');
      }, 2000);
    } catch (err) {
      console.error(err);
      refuse(err instanceof ApiError && err.status === 400 ? 'Δεν έχεις αρκετά διαθέσιμα αστέρια' : 'Κάτι πήγε στραβά. Δοκίμασε ξανά.');
    } finally {
      setIsTransferring(false);
    }
  };

  const handleCancelTransfer = async (transferId: string) => {
    try {
      await api.cancelTransfer(transferId);
    } catch (err) {
      console.error(err);
      // 400: a parent decided on it meanwhile
      refuse(err instanceof ApiError && err.status === 400 ? 'Αυτό το δώρο δεν ακυρώνεται πια.' : 'Κάτι πήγε στραβά. Δοκίμασε ξανά.');
    }
  };

  return (
    <HelpScreen tour={storeTour(user.id, revision, extra, retry)}>
      <motion.div
        className="store-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        {...sound('close')}
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
          className={`store-card ${canEarn ? 'with-earn' : ''}`}
          initial={{ scale: 0.8, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="store-header">
            <h2>{user.name}</h2>
            <div className="balance-section">
              <motion.div
                className="user-balance"
                {...help('store.balance')}
                key={user.stars}
                initial={{ scale: 1 }}
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.3 }}
              >
                ⭐ {user.stars}
              </motion.div>
              {availableBalance < user.stars && (
                <div className="pending-balance-hint">
                  (Διαθέσιμα: ⭐ {availableBalance})
                </div>
              )}
              <AnimatePresence>
                {refusal && !showTransfer && !showActivity && (
                  <motion.div className="store-refusal" role="alert"
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0, x: [0, -8, 8, -5, 5, 0] }} exit={{ opacity: 0 }}>
                    {refusal}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className={`store-content ${canEarn ? 'with-earn' : ''}`}>
            {canEarn && (
              <div className="earn-section" {...help('store.earn')}>
                <h3>Κέρδισε αστέρια</h3>
                <UserExercises user={user} />
              </div>
            )}
            <div className="rewards-section">
              <div className="rewards-header">
                <h3>Εξαργύρωση</h3>
                <div className="header-buttons">
                  {otherUsers.length > 0 && (
                    <button
                      className="transfer-btn"
                      {...help('store.give')}
                      {...sound('open')}
                      onClick={() => setShowTransfer(true)}
                    >
                      🎁 Δώσε Αστέρια
                    </button>
                  )}
                  {hasActivity && (
                    <button
                      className="activity-toggle-btn"
                      {...help('store.activity')}
                      {...sound(showActivity ? 'close' : 'open')}
                      onClick={() => setShowActivity(!showActivity)}
                    >
                      📋 Δραστηριότητα
                    </button>
                  )}
                </div>
              </div>
              <div className="rewards-grid" {...help('store.rewards')}>
                {rewards.map(reward => {
                  const canAfford = availableBalance >= reward.cost;
                  const isPurchasing = purchasingId === reward.id;
                  const isAsking = askingId === reward.id && canAfford && !isPurchasing;
                  const tappable = canAfford && !isPurchasing && !isAsking;
                  return (
                    <motion.div
                      key={reward.id}
                      className={`reward-item ${!canAfford ? 'disabled' : ''} ${isPurchasing ? 'purchasing' : ''} ${isAsking ? 'asking' : ''}`}
                      {...sound(isAsking ? 'none' : tappable ? 'select' : 'nope')}
                      onClick={() => tappable && setAskingId(reward.id)}
                      whileHover={!isTouchDevice && tappable ? { scale: 1.05 } : {}}
                      whileTap={tappable ? { scale: 0.95 } : {}}
                      animate={isPurchasing ? {
                        scale: [1, 1.1, 0.9, 1],
                        rotate: [0, -5, 5, 0]
                      } : {}}
                      transition={{ duration: 0.3 }}
                    >
                      {isAsking ? (
                        <div className="buy-ask" role="dialog" aria-label={`Να πάρεις «${reward.title}»;`}>
                          <p className="buy-ask-text">Να πάρεις «{reward.title}» για ⭐ {reward.cost};</p>
                          <div className="buy-ask-buttons">
                            {/* handleBuy plays 'spend' (or 'nope' if the server refuses) */}
                            <button className="buy-ask-btn buy-ask-yes" {...sound('none')}
                              onClick={e => { e.stopPropagation(); setAskingId(null); void handleBuy(reward); }}>Ναι</button>
                            <button className="buy-ask-btn buy-ask-no" {...sound('unselect')}
                              onClick={e => { e.stopPropagation(); setAskingId(null); }}>Όχι</button>
                          </div>
                        </div>
                      ) : (
                        <>
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
                        </>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>

          <button className="close-btn" onClick={onClose} {...help('store.close')} {...sound('close')}>Κλείσιμο</button>
        </motion.div>

        {/* Activity Popup */}
        <AnimatePresence>
          {showActivity && (
            <motion.div
              className="activity-popup-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              {...sound('close')}
              onClick={() => setShowActivity(false)}
            >
              <motion.div
                className="activity-popup"
                initial={{ scale: 0.8, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.8, y: 50 }}
                onClick={e => e.stopPropagation()}
                {...help('activity.list')}
              >
                <HelpScreen tour={activityTour(user.id)}>
                <div className="activity-popup-header">
                  <h3>Δραστηριότητα</h3>
                  <button className="popup-close-btn" {...sound('close')} onClick={() => setShowActivity(false)}>✕</button>
                </div>

                <AnimatePresence>
                  {refusal && (
                    <motion.div className="store-refusal activity-refusal" role="alert"
                      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0, x: [0, -8, 8, -5, 5, 0] }} exit={{ opacity: 0 }}>
                      {refusal}
                    </motion.div>
                  )}
                </AnimatePresence>

                {!hasActivity && (
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
                            <span className="pending-title">⭐ {transfer.amount} από {nameOf(transfer.fromUserId) || 'άλλο παιδί'}</span>
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
                            <span className="pending-title">⭐ {transfer.amount} προς {nameOf(transfer.toUserId) || 'άλλο παιδί'}</span>
                            <span className="pending-date">
                              {format(new Date(transfer.createdAt), 'd MMM HH:mm', { locale: el })}
                            </span>
                          </div>
                          <button 
                            className="cancel-transfer-btn"
                            {...sound('unselect')}
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
                            <SmartIcon value={rewardOf(spending.rewardId)?.icon || '❓'} />
                          </div>
                          <div className="pending-info">
                            <span className="pending-title">{rewardOf(spending.rewardId)?.title}</span>
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
                            <SmartIcon value={rewardOf(spending.rewardId)?.icon || '❓'} />
                          </div>
                          <div className="pending-info">
                            <span className="pending-title">{rewardOf(spending.rewardId)?.title}</span>
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
                </HelpScreen>
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
              {...sound('close')}
              onClick={() => !isTransferring && setShowTransfer(false)}
            >
              <motion.div
                className="activity-popup transfer-dialog"
                initial={{ scale: 0.8, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.8, y: 50 }}
                onClick={e => e.stopPropagation()}
              >
                <HelpScreen tour={transferSuccess ? null : transferTour(user.id)}>
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
                      <button className="popup-close-btn" {...sound('close')} onClick={() => setShowTransfer(false)}>✕</button>
                    </div>

                    <div className="transfer-form">
                      <div className="form-field" {...help('transfer.to')}>
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
                        <div className="amount-input" {...help('transfer.amount')}>
                          <button 
                            className="amount-btn"
                            {...sound('unselect')}
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
                            {...sound('select')}
                            onClick={() => setTransferAmount(Math.min(availableBalance, transferAmount + 1))}
                            disabled={transferAmount >= availableBalance}
                          >
                            +
                          </button>
                        </div>
                        <span className="available-hint">Διαθέσιμα: ⭐ {availableBalance}</span>
                      </div>

                      <AnimatePresence>
                        {refusal && (
                          <motion.div className="store-refusal" role="alert"
                            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0, x: [0, -8, 8, -5, 5, 0] }} exit={{ opacity: 0 }}>
                            {refusal}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <button 
                        className="send-transfer-btn"
                        {...help('transfer.send')}
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
                </HelpScreen>
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
          z-index: var(--z-modal);
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
          z-index: calc(var(--z-modal) + 10);
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

        /* Earning next to spending: side by side in landscape, stacked (and scrolling) otherwise */
        .store-content.with-earn { overflow-y: auto; gap: 1.5rem; }
        .store-content.with-earn .rewards-section { flex: none; overflow: visible; }
        .earn-section { display: flex; flex-direction: column; gap: 0.75rem; }
        .earn-section h3 { margin: 0; }
        @media (min-width: 900px) and (orientation: landscape) {
          .store-card.with-earn { max-width: 1150px; }
          .store-content.with-earn { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); overflow: hidden; }
          .store-content.with-earn .earn-section, .store-content.with-earn .rewards-section { min-height: 0; overflow-y: auto; padding-right: 0.3rem; }
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
          z-index: calc(var(--z-modal) + 10);
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

        /* The question before a purchase, in the reward's card: two buttons a finger can hit
           (48 px), side by side (one over the other only in a card too narrow for both), so the
           card stays about its own height and fits the grid's visible rows down to 800x480 */
        .reward-item.asking {
          background: rgba(255,215,0,0.12);
          border-color: rgba(255,215,0,0.6);
          padding: 0.6rem;
          cursor: default;
          justify-content: center;
        }
        .buy-ask {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 0.5rem;
          width: 100%;
          text-align: center;
        }
        .buy-ask-text {
          margin: 0;
          font-size: 0.85rem;
          font-weight: 700;
          overflow-wrap: anywhere;
        }
        .buy-ask-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }
        .buy-ask-btn {
          flex: 1 1 3rem;
          min-height: 48px;
          padding: 0.4rem 0.5rem;
          border: none;
          border-radius: 0.8rem;
          font-size: 1rem;
          font-weight: 800;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        .buy-ask-yes {
          background: transparent;
          color: white;
          border: 2px solid rgba(255,255,255,0.7);
        }
        /* «Όχι» keeps her stars: the bright one, as in the routine's question */
        .buy-ask-no {
          background: gold;
          color: #1a1a2e;
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
        .store-refusal {
          font-size: 0.95rem;
          font-weight: 600;
          color: #ff6b6b;
          background: rgba(255,107,107,0.12);
          padding: 0.3rem 0.75rem;
          border-radius: 0.75rem;
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

        .transfer-form .store-refusal,
        .activity-refusal {
          text-align: center;
        }
        .activity-refusal {
          margin-bottom: 0.75rem;
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
    </HelpScreen>
  );
};
