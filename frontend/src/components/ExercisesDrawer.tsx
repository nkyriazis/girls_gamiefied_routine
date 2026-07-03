import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SmartIcon } from './SmartIcon';
import { useGame } from '../context/GameContext';
import { AssignmentPlayer } from './AssignmentPlayer';
import type { ExerciseAssignmentWithExercise, User } from '@shared/types';

interface ExercisesDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

const CATEGORY_ICONS: Record<string, string> = {
    'Μαθηματικά': '🔢',
    'Γλώσσα': '📖',
};

const TYPE_LABELS: Record<string, string> = {
    'multiple-choice': 'Επίλεξε τη σωστή απάντηση',
    'true-false': 'Σωστό ή Λάθος',
    'match-pairs': 'Σύνδεσε τα ζευγάρια',
    'ordering': 'Βάλε στη σειρά',
    'fill-blank': 'Συμπλήρωσε τα κενά',
    'number-input': 'Γράψε τον αριθμό',
};

export const ExercisesDrawer: React.FC<ExercisesDrawerProps> = ({ isOpen, onClose }) => {
    const { users, exerciseAssignments } = useGame();
    const [playing, setPlaying] = useState<{ assignment: ExerciseAssignmentWithExercise, user: User } | null>(null);

    // Keep the player in sync with fresh assignment state (e.g. after answer broadcast)
    const playingAssignment = playing
        ? exerciseAssignments.find(a => a.id === playing.assignment.id) || playing.assignment
        : null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        key="backdrop"
                        className="exercises-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    <motion.div
                        key="drawer"
                        className="exercises-drawer"
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    >
                        <div className="exercises-header">
                            <h2>✏️ Ασκήσεις της Ημέρας</h2>
                            <button className="close-btn" onClick={onClose}>✕</button>
                        </div>

                        <div className="exercises-content">
                            {users.map(user => {
                                const userAssignments = exerciseAssignments.filter(a => a.userId === user.id);
                                if (userAssignments.length === 0) return null;

                                const completedCount = userAssignments.filter(a => a.status === 'completed').length;
                                const allDone = completedCount === userAssignments.length;

                                return (
                                    <section key={user.id} className="user-section">
                                        <div className="user-header" style={{ '--user-color': user.color } as React.CSSProperties}>
                                            <SmartIcon value={user.avatar || '👧'} size={36} />
                                            <h3>{user.name}</h3>
                                            <span className={`progress-pill ${allDone ? 'done' : ''}`}>
                                                {allDone ? 'Όλα έτοιμα! 🎉' : `${completedCount} / ${userAssignments.length}`}
                                            </span>
                                        </div>

                                        <div className="assignment-list">
                                            {userAssignments.map(assignment => {
                                                const ex = assignment.exercise;
                                                if (!ex) return null;
                                                const isDone = assignment.status === 'completed';

                                                return (
                                                    <motion.button
                                                        key={assignment.id}
                                                        className={`assignment-card ${isDone ? 'completed' : ''}`}
                                                        onClick={() => !isDone && setPlaying({ assignment, user })}
                                                        disabled={isDone}
                                                        whileTap={!isDone ? { scale: 0.97 } : {}}
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                    >
                                                        <div className="assignment-icon">
                                                            {CATEGORY_ICONS[ex.category] || '📚'}
                                                        </div>
                                                        <div className="assignment-info">
                                                            <h4>{ex.title}</h4>
                                                            <span className="assignment-meta">
                                                                {ex.category} · {TYPE_LABELS[ex.type] || ex.type}
                                                            </span>
                                                        </div>
                                                        <div className="assignment-status">
                                                            {isDone ? (
                                                                <span className="done-badge">✓ ⭐{assignment.starsAwarded ?? ex.stars}</span>
                                                            ) : (
                                                                <span className="star-badge">⭐ {ex.stars}</span>
                                                            )}
                                                        </div>
                                                    </motion.button>
                                                );
                                            })}
                                        </div>
                                    </section>
                                );
                            })}

                            {exerciseAssignments.length === 0 && (
                                <div className="empty-state">
                                    <span className="empty-icon">✏️</span>
                                    <p>Δεν υπάρχουν ασκήσεις σήμερα.</p>
                                    <p className="hint">Νέες ασκήσεις εμφανίζονται κάθε μέρα!</p>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    <AnimatePresence key="player">
                        {playing && playingAssignment && (
                            <AssignmentPlayer
                                assignment={playingAssignment}
                                user={playing.user}
                                onClose={() => setPlaying(null)}
                            />
                        )}
                    </AnimatePresence>
                </>
            )}

            <style key="styles">{`
        .exercises-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 100;
        }

        .exercises-drawer {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: min(420px, 92vw);
          background: linear-gradient(160deg, #16213e 0%, #1a1a2e 100%);
          z-index: 101;
          display: flex;
          flex-direction: column;
          box-shadow: -4px 0 20px rgba(0, 0, 0, 0.3);
        }

        .exercises-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .exercises-header h2 {
          margin: 0;
          font-size: 1.5rem;
        }

        .exercises-drawer .close-btn {
          background: transparent;
          border: none;
          color: white;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0.5rem;
          opacity: 0.7;
        }

        .exercises-content {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          padding-bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
          -webkit-overflow-scrolling: touch;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .user-section {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .user-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 0.75rem;
          border-radius: 1rem;
          background: rgba(255, 255, 255, 0.04);
          border-left: 4px solid var(--user-color, gold);
        }

        .user-header h3 {
          margin: 0;
          font-size: 1.2rem;
          flex: 1;
        }

        .progress-pill {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 1rem;
          padding: 0.25rem 0.75rem;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .progress-pill.done {
          background: rgba(6, 214, 160, 0.2);
          color: #06d6a0;
        }

        .assignment-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .assignment-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 1rem;
          color: white;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s;
        }

        .assignment-card:hover:not(:disabled) {
          border-color: rgba(255, 214, 10, 0.5);
          background: rgba(255, 214, 10, 0.05);
        }

        .assignment-card.completed {
          opacity: 0.6;
          cursor: default;
          border-color: rgba(6, 214, 160, 0.4);
          background: rgba(6, 214, 160, 0.05);
        }

        .assignment-icon {
          font-size: 2rem;
          flex-shrink: 0;
        }

        .assignment-info {
          flex: 1;
          min-width: 0;
        }

        .assignment-info h4 {
          margin: 0 0 0.2rem 0;
          font-size: 1.05rem;
        }

        .assignment-meta {
          font-size: 0.8rem;
          opacity: 0.6;
        }

        .assignment-status {
          flex-shrink: 0;
          font-weight: bold;
        }

        .star-badge {
          color: #ffd60a;
          font-size: 1rem;
        }

        .done-badge {
          color: #06d6a0;
          font-size: 0.95rem;
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

        .empty-state .hint {
          font-size: 0.85rem;
          opacity: 0.7;
        }
      `}</style>
        </AnimatePresence>
    );
};
