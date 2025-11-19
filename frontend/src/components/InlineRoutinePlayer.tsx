import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MOCK_USERS } from '../data/mockData';
import { RewardOverlay } from './RewardOverlay';
import { useAppSounds } from '../hooks/useAppSounds';

interface InlineRoutinePlayerProps {
  userId: string;
  routineId: string;
  onComplete: () => void;
  onExit: () => void;
}

export const InlineRoutinePlayer: React.FC<InlineRoutinePlayerProps> = ({ 
  userId, 
  routineId, 
  onComplete,
  onExit
}) => {
  const { playClick, playSuccess, playAlarm } = useAppSounds();
  
  const user = MOCK_USERS.find(u => u.id === userId);
  const routine = user?.routines.find(r => r.id === routineId);

  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const currentTask = routine?.tasks[currentTaskIndex];
  const totalTasks = routine?.tasks.length || 0;

  useEffect(() => {
    if (currentTask) {
      setTimeLeft(currentTask.durationSeconds);
      setIsActive(true);
    }
  }, [currentTask]);

  useEffect(() => {
    let interval: any;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false);
      playAlarm();
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, playAlarm]);

  const handleNextTask = () => {
    playClick();
    if (currentTaskIndex < totalTasks - 1) {
      setCurrentTaskIndex(prev => prev + 1);
    } else {
      handleRoutineComplete();
    }
  };

  const handleRoutineComplete = () => {
    setIsCompleted(true);
    playSuccess();
    // Show reward for a few seconds then notify parent
    setTimeout(() => {
      onComplete();
    }, 5000);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!user || !routine) return <div>Error loading routine</div>;

  return (
    <div className="inline-player" style={{ '--theme-color': routine.themeColor } as React.CSSProperties}>
      <AnimatePresence>
        {isCompleted && (
          <RewardOverlay 
            starsEarned={50} 
            onClose={onComplete} 
          />
        )}
      </AnimatePresence>

      <div className="player-header">
        <div className="user-badge" style={{ background: user.color }}>
          {user.avatar}
        </div>
        <div className="user-name-header">
          {user.name}
        </div>
        <div className="progress-container">
          <div className="progress-bar">
            <motion.div 
              className="progress-fill"
              initial={{ width: 0 }}
              animate={{ width: `${((currentTaskIndex) / totalTasks) * 100}%` }}
            />
          </div>
        </div>
        <button className="btn-exit" onClick={onExit}>✕</button>
      </div>

      <div className="player-body">
        {/* Timeline (Compact) */}
        <div className="timeline-compact">
           {routine.tasks.map((task, index) => {
            const status = index < currentTaskIndex ? 'past' : index === currentTaskIndex ? 'current' : 'future';
            return (
              <div key={task.id} className={`dot ${status}`} />
            );
          })}
        </div>

        <AnimatePresence mode='wait'>
          {!isCompleted && (
            <motion.div 
              key={currentTask?.id}
              className="active-task-container"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", bounce: 0.3 }}
            >
              <div className="task-icon">{currentTask?.icon}</div>
              <h2 className="task-name">{currentTask?.title}</h2>
              <div className={`timer ${timeLeft < 10 ? 'warning' : ''}`}>
                {formatTime(timeLeft)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!isCompleted && (
          <button className="btn-done" onClick={handleNextTask}>
            Έτοιμο!
          </button>
        )}
      </div>

      <style>{`
        .inline-player {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: rgba(0,0,0,0.2);
          border-radius: 2rem;
          overflow: hidden;
          border: 1px solid var(--glass-border);
          position: relative;
        }

        .player-header {
          display: flex;
          align-items: center;
          padding: 1.5rem;
          gap: 1.5rem;
          background: rgba(0,0,0,0.3);
        }

        .user-badge {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2.5rem;
          box-shadow: 0 0 15px rgba(0,0,0,0.3);
        }

        .user-name-header {
          font-size: 2rem;
          font-weight: 900;
          color: white;
          margin-right: 1rem;
          text-transform: uppercase;
          letter-spacing: 1px;
          text-shadow: 0 2px 4px rgba(0,0,0,0.5);
        }

        .progress-container {
          flex: 1;
        }

        .progress-bar {
          height: 6px;
          background: rgba(255,255,255,0.1);
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: var(--theme-color);
        }

        .btn-exit {
          background: transparent;
          color: white;
          font-size: 1.2rem;
          opacity: 0.5;
        }

        .player-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          position: relative;
        }

        .timeline-compact {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: white;
          opacity: 0.2;
        }

        .dot.current {
          background: var(--theme-color);
          opacity: 1;
          transform: scale(1.5);
        }

        .dot.past {
          background: var(--theme-color);
          opacity: 0.5;
        }

        .active-task-container {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .task-icon {
          font-size: 5rem; /* Scaled down slightly for split view */
          margin-bottom: 0.5rem;
          animation: bounce 2s infinite;
        }

        .task-name {
          font-size: 2rem;
          margin-bottom: 1rem;
          white-space: nowrap;
        }

        .timer {
          font-size: 4rem;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
          margin-bottom: 2rem;
        }

        .timer.warning {
          color: var(--color-danger);
          animation: pulse 1s infinite;
        }

        .btn-done {
          background: var(--theme-color);
          color: #000;
          font-size: 1.5rem;
          padding: 0.8rem 3rem;
          border-radius: 1.5rem;
          font-weight: 800;
          box-shadow: 0 0 20px var(--theme-color);
        }

        /* Responsive adjustments for grid */
        @media (max-width: 800px) {
          .task-icon { font-size: 3rem; }
          .timer { font-size: 3rem; }
        }
      `}</style>
    </div>
  );
};
