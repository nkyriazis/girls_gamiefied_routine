import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SmartIcon } from './SmartIcon';
import { useGame } from '../context/GameContext';
import { UserExercises } from './UserExercises';
import { help } from '../help/anchors';
import { HelpScreen } from '../help/HelpProvider';
import { exercisesTour } from './ExercisesDrawer.help';
import { sound } from '../sound/sfx';
import { dailyCount, kidsShown, pillText } from './exerciseCounts';

interface ExercisesDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

// Every kid's exercises of the day at a glance; each kid also has hers on her own screen.
export const ExercisesDrawer: React.FC<ExercisesDrawerProps> = ({ isOpen, onClose }) => {
    const { users, exerciseAssignments, config } = useGame();
    const extraLimit = config.settings.extraProblemsPerDay ?? 10;
    // A kid with a set today, or one who may ask for an extra problem; the empty state only when none
    const shown = kidsShown(users, exerciseAssignments, extraLimit);
    // A revision card on screen: the tour's edition that explains its pill
    const revision = exerciseAssignments.some(a => a.revision && !a.extra && shown.some(u => u.id === a.userId));
    // An extra problem left with ✕ on screen: the edition that explains its card (#67)
    const extra = exerciseAssignments.some(a => a.extra && a.status === 'pending' && shown.some(u => u.id === a.userId));
    // A retry of an item shown worked on screen: the edition that explains its pill (#136)
    const retry = exerciseAssignments.some(a => a.retryOf && !a.extra && shown.some(u => u.id === a.userId));

    return (
        <HelpScreen tour={isOpen ? exercisesTour(revision, extra, retry) : null}>
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        key="backdrop"
                        className="exercises-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        {...sound('close')}
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
                            <button className="close-btn" {...sound('close')} onClick={onClose}>✕</button>
                        </div>

                        <div className="exercises-content">
                            {shown.map(user => {
                                const count = dailyCount(exerciseAssignments, user.id);
                                return (
                                    <UserExercises key={user.id} user={user} header={
                                        <div className="user-header" {...help('exercises.kid')} style={{ '--user-color': user.color } as React.CSSProperties}>
                                            <SmartIcon value={user.avatar || '👧'} size={36} />
                                            <h3>{user.name}</h3>
                                            <span className={`progress-pill ${count.total === 0 ? 'none' : count.waiting === 0 ? 'done' : ''}`}>
                                                {pillText(count)}
                                            </span>
                                        </div>
                                    } />
                                );
                            })}

                            {shown.length === 0 && (
                                <div className="empty-state">
                                    <span className="empty-icon">✏️</span>
                                    <p>Δεν υπάρχουν ασκήσεις σήμερα.</p>
                                    <p className="hint">Νέες ασκήσεις εμφανίζονται κάθε μέρα!</p>
                                </div>
                            )}
                        </div>
                    </motion.div>

                </>
            )}

            <style key="styles">{`
        .exercises-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: var(--z-drawer);
        }

        .exercises-drawer {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: min(420px, 92vw);
          background: linear-gradient(160deg, #16213e 0%, #1a1a2e 100%);
          z-index: calc(var(--z-drawer) + 1);
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

        .progress-pill.none {
          background: transparent;
          font-weight: 500;
          opacity: 0.7;
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
        </HelpScreen>
    );
};
