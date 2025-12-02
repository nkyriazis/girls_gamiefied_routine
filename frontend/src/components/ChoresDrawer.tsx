import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SmartIcon } from './SmartIcon';
import { useGame } from '../context/GameContext';
import { api } from '../api';
import type { Chore, ChoreInstance, User } from '@shared/types';

interface ChoresDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

// Helper to format time remaining
function formatTimeRemaining(expiresAt: string): string {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();

    if (diffMs <= 0) return 'Έληξε';

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
        return `${hours}ω ${minutes}λ`;
    }
    return `${minutes}λ`;
}

// Get status badge info
function getStatusBadge(status: ChoreInstance['status']): { text: string; color: string } {
    switch (status) {
        case 'available':
            return { text: 'Διαθέσιμο', color: '#4cc9f0' };
        case 'claimed':
            return { text: 'Σε εξέλιξη', color: '#ffd60a' };
        case 'attempted':
            return { text: 'Αναμονή επιβεβαίωσης', color: '#fb8500' };
        case 'confirmed':
            return { text: 'Ολοκληρώθηκε! ✓', color: '#06d6a0' };
        case 'rejected':
            return { text: 'Απορρίφθηκε', color: '#ef476f' };
        case 'expired':
            return { text: 'Έληξε', color: '#adb5bd' };
        default:
            return { text: status, color: '#adb5bd' };
    }
}

interface ChoreWithInstance {
    chore: Chore;
    instance: ChoreInstance;
    eligibleUsers: User[];
    claimedByUser?: User;
}

export const ChoresDrawer: React.FC<ChoresDrawerProps> = ({ isOpen, onClose }) => {
    const { users, chores, choreInstances, refreshChores } = useGame();

    // Group active chore instances with their chore definitions
    const activeChores = useMemo(() => {
        const result: ChoreWithInstance[] = [];

        for (const instance of choreInstances) {
            // Skip expired instances
            if (instance.status === 'expired') continue;

            const chore = chores.find(c => c.id === instance.choreId);
            if (!chore) continue;

            // Get eligible users for this chore
            const eligibleUsers = chore.eligibleUsers && chore.eligibleUsers.length > 0
                ? users.filter(u => chore.eligibleUsers!.includes(u.id))
                : users;

            // Get the user who claimed it (if any)
            const claimedByUser = instance.claimedBy
                ? users.find(u => u.id === instance.claimedBy)
                : undefined;

            result.push({ chore, instance, eligibleUsers, claimedByUser });
        }

        // Sort: available first, then claimed, then attempted, then completed
        const statusOrder: Record<string, number> = {
            'available': 0,
            'claimed': 1,
            'attempted': 2,
            'confirmed': 3,
            'rejected': 4
        };

        return result.sort((a, b) =>
            (statusOrder[a.instance.status] ?? 99) - (statusOrder[b.instance.status] ?? 99)
        );
    }, [chores, choreInstances, users]);

    const handleClaim = async (instanceId: string, userId: string) => {
        try {
            await api.claimChore(instanceId, userId);
            await refreshChores();
        } catch (error) {
            console.error('Failed to claim chore:', error);
        }
    };

    const handleAttempt = async (instanceId: string) => {
        try {
            await api.attemptChore(instanceId);
            await refreshChores();
        } catch (error) {
            console.error('Failed to mark chore as done:', error);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="chores-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    {/* Drawer */}
                    <motion.div
                        className="chores-drawer"
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    >
                        <div className="chores-header">
                            <h2>🧹 Δουλειές</h2>
                            <button className="close-btn" onClick={onClose}>✕</button>
                        </div>

                        <div className="chores-content">
                            {activeChores.length === 0 ? (
                                <div className="empty-state">
                                    <span className="empty-icon">🧹</span>
                                    <p>Δεν υπάρχουν διαθέσιμες δουλειές αυτή τη στιγμή.</p>
                                    <p className="hint">Νέες δουλειές εμφανίζονται σύμφωνα με το πρόγραμμα!</p>
                                </div>
                            ) : (
                                <div className="chore-list">
                                    {activeChores.map(({ chore, instance, eligibleUsers, claimedByUser }) => {
                                        const badge = getStatusBadge(instance.status);
                                        const isAvailable = instance.status === 'available';
                                        const isClaimed = instance.status === 'claimed';
                                        const isAttempted = instance.status === 'attempted';
                                        const isCompleted = instance.status === 'confirmed' || instance.status === 'rejected';

                                        return (
                                            <motion.div
                                                key={instance.id}
                                                className={`chore-card ${instance.status}`}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                            >
                                                <div className="chore-main">
                                                    <div className="chore-icon">
                                                        <SmartIcon value={chore.icon} size={48} />
                                                    </div>
                                                    <div className="chore-info">
                                                        <h4>{chore.title}</h4>
                                                        <div className="chore-meta">
                                                            <span className="stars">⭐ {instance.starsAwarded ?? chore.defaultStars}</span>
                                                            {!isCompleted && (
                                                                <span className="expires">⏱ {formatTimeRemaining(instance.expiresAt)}</span>
                                                            )}
                                                            {claimedByUser && !isAvailable && (
                                                                <span className="claimed-by" style={{ color: claimedByUser.color }}>
                                                                    {claimedByUser.name}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="chore-status" style={{ color: badge.color }}>
                                                            {badge.text}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Available: Show user buttons to claim */}
                                                {isAvailable && (
                                                    <div className="chore-actions">
                                                        <span className="action-label">Ποιος το αναλαμβάνει;</span>
                                                        <div className="user-buttons">
                                                            {eligibleUsers.map(user => (
                                                                <button
                                                                    key={user.id}
                                                                    className="user-claim-btn"
                                                                    onClick={() => handleClaim(instance.id, user.id)}
                                                                    style={{ '--user-color': user.color } as React.CSSProperties}
                                                                >
                                                                    <SmartIcon value={user.avatar} size={28} />
                                                                    <span>{user.name}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Claimed: Show "I did it" button with user context */}
                                                {isClaimed && claimedByUser && (
                                                    <div className="chore-actions">
                                                        <button
                                                            className="done-btn"
                                                            onClick={() => handleAttempt(instance.id)}
                                                            style={{ '--user-color': claimedByUser.color } as React.CSSProperties}
                                                        >
                                                            <SmartIcon value={claimedByUser.avatar} size={24} />
                                                            <span>{claimedByUser.name}: Το έκανα! ✓</span>
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Attempted: Show waiting indicator */}
                                                {isAttempted && (
                                                    <div className="chore-actions">
                                                        <span className="waiting-text">⏳ Περιμένει επιβεβαίωση από γονέα</span>
                                                    </div>
                                                )}
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}

            <style>{`
        .chores-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 100;
        }

        .chores-drawer {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: min(420px, 92vw);
          background: var(--color-surface, #1a1a2e);
          z-index: 101;
          display: flex;
          flex-direction: column;
          box-shadow: -4px 0 20px rgba(0, 0, 0, 0.3);
        }

        .chores-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .chores-header h2 {
          margin: 0;
          font-size: 1.5rem;
        }

        .close-btn {
          background: transparent;
          border: none;
          color: white;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0.5rem;
          opacity: 0.7;
          transition: opacity 0.2s;
        }

        .close-btn:hover {
          opacity: 1;
        }

        .chores-content {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          padding-bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
          -webkit-overflow-scrolling: touch;
        }

        .chore-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding-bottom: 1rem;
        }

        .chore-card {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 1rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .chore-card.available {
          border-color: rgba(76, 201, 240, 0.4);
          background: rgba(76, 201, 240, 0.05);
        }

        .chore-card.claimed {
          border-color: rgba(255, 214, 10, 0.4);
          background: rgba(255, 214, 10, 0.05);
        }

        .chore-card.attempted {
          border-color: rgba(251, 133, 0, 0.4);
          background: rgba(251, 133, 0, 0.05);
        }

        .chore-card.confirmed {
          border-color: rgba(6, 214, 160, 0.4);
          background: rgba(6, 214, 160, 0.05);
        }

        .chore-card.rejected {
          border-color: rgba(239, 71, 111, 0.3);
          background: rgba(239, 71, 111, 0.05);
          opacity: 0.7;
        }

        .chore-main {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
        }

        .chore-icon {
          flex-shrink: 0;
        }

        .chore-info {
          flex: 1;
          min-width: 0;
        }

        .chore-info h4 {
          margin: 0 0 0.25rem 0;
          font-size: 1.1rem;
        }

        .chore-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem 1rem;
          font-size: 0.85rem;
          margin-bottom: 0.25rem;
        }

        .chore-meta .stars {
          color: #ffd60a;
        }

        .chore-meta .expires {
          color: rgba(255, 255, 255, 0.6);
        }

        .chore-meta .claimed-by {
          font-weight: 600;
        }

        .chore-status {
          font-size: 0.8rem;
          font-weight: 600;
        }

        .chore-actions {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .action-label {
          display: block;
          font-size: 0.85rem;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 0.75rem;
        }

        .user-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .user-claim-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(255, 255, 255, 0.1);
          border: 2px solid var(--user-color);
          border-radius: 2rem;
          padding: 0.5rem 1rem;
          color: white;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 0.9rem;
        }

        .user-claim-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: scale(1.05);
        }

        .user-claim-btn:active {
          transform: scale(0.95);
        }

        .done-btn {
          width: 100%;
          padding: 0.75rem 1rem;
          border-radius: 10px;
          border: 2px solid var(--user-color, #06d6a0);
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: transform 0.1s;
          background: #06d6a0;
          color: #0d1b2a;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .done-btn:hover {
          transform: scale(1.02);
        }

        .done-btn:active {
          transform: scale(0.98);
        }

        .waiting-text {
          display: block;
          text-align: center;
          font-size: 0.9rem;
          color: rgba(255, 255, 255, 0.7);
        }

        .empty-state {
          text-align: center;
          padding: 3rem 1rem;
          color: rgba(255, 255, 255, 0.6);
        }

        .empty-state .empty-icon {
          font-size: 4rem;
          display: block;
          margin-bottom: 1rem;
          opacity: 0.5;
        }

        .empty-state p {
          margin: 0.5rem 0;
        }

        .empty-state .hint {
          font-size: 0.85rem;
          opacity: 0.7;
        }
      `}</style>
        </AnimatePresence>
    );
};
