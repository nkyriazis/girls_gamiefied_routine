import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type User, type Routine } from '@shared/types';
import { RewardOverlay } from './RewardOverlay';
import { useAppSounds } from '../hooks/useAppSounds';
import { api } from '../api';
import { SmartIcon } from './SmartIcon';

interface InlineRoutinePlayerProps {
  user: User;
  routine: Routine;
  executionId?: string;
  onComplete: () => void;
  onExit: () => void;
}

export const InlineRoutinePlayer: React.FC<InlineRoutinePlayerProps> = ({
  user,
  routine,
  executionId,
  onComplete,
  onExit
}) => {
  const { playClick, playSuccess, playAlarm } = useAppSounds();
  const completionTimeoutRef = useRef<number | null>(null);

  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [justEarnedStars, setJustEarnedStars] = useState<number | null>(null);
  const [taskStartTime, setTaskStartTime] = useState<number>(() => Date.now());

  const currentTask = routine?.tasks[currentTaskIndex];
  const totalTasks = routine?.tasks.length || 0;

  useEffect(() => {
    if (currentTask) {
      setTimeLeft(currentTask.durationSeconds);
      setTaskStartTime(Date.now());
      setIsActive(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTask?.id]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isActive) {
      interval = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - taskStartTime) / 1000);
        const remaining = Math.max(0, (currentTask?.durationSeconds || 0) - elapsedSeconds);
        setTimeLeft(remaining);

        if (remaining === 0) {
          setIsActive(false);
          playAlarm();
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, taskStartTime, currentTask?.durationSeconds, playAlarm]);

  const handleNextTask = async () => {
    playClick();

    if (!executionId) {
      console.error('Missing executionId');
      // alert('Debug: Missing executionId'); // Uncomment for debugging
    }

    // Complete current task
    if (executionId && currentTask) {
      try {
        const duration = Math.round((Date.now() - taskStartTime) / 1000);
        const isOnTime = timeLeft > 0;
        const result = await api.completeTask(executionId, currentTask.id, duration, isOnTime);
        
        if (result.success) {
          setJustEarnedStars(result.starsAwarded);
          setTimeout(() => setJustEarnedStars(null), 2000);
        } else {
          console.error('Complete task failed:', result);
        }
      } catch (err) {
        console.error('Failed to complete task:', err);
      }
    }

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
    completionTimeoutRef.current = setTimeout(() => {
      onComplete();
    }, 5000);
  };

  const handleRewardClose = () => {
    // When user clicks the reward, clear the timeout and call onComplete immediately
    if (completionTimeoutRef.current) {
      clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = null;
    }
    onComplete();
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
            onClose={handleRewardClose}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {justEarnedStars && (
          <motion.div
            className="floating-stars"
            initial={{ opacity: 0, y: 0, scale: 0.5 }}
            animate={{ opacity: 1, y: -100, scale: 1.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
          >
            ⭐ +{justEarnedStars}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="player-header">
        <div className="user-badge" style={{ background: user.color }}>
          <SmartIcon value={user.avatar} />
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
              <div className="task-icon">
                {currentTask && <SmartIcon value={currentTask.icon} />}
              </div>
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
          overflow-y: auto;
          min-height: 0;
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
          .user-name-header { font-size: 1.2rem; }
          .user-badge { width: 40px; height: 40px; font-size: 1.5rem; }
          .player-header { padding: 0.8rem; gap: 0.8rem; }
          .task-name { font-size: 1.5rem; }
          .btn-done { font-size: 1.2rem; padding: 0.6rem 2rem; }
        }

        .floating-stars {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 5rem;
          font-weight: 900;
          color: #FFD700;
          text-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
          z-index: 100;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
};
