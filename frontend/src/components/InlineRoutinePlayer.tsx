import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type User, type Routine, type RoutineRun } from '@shared/types';
import { RewardOverlay } from './RewardOverlay';
import { useAppSounds } from '../hooks/useAppSounds';
import { api } from '../api';
import { help } from '../help/anchors';
import { SmartIcon } from './SmartIcon';
import { sfx, sound } from '../sound/sfx';

interface InlineRoutinePlayerProps {
  user: User;
  routine: Routine;
  run: RoutineRun; // server state: current task, when it started, whether all are done
  onClose: () => void; // reward shown, or the kid pressed ✕ and said «Ναι»
}

const REWARD_MS = 5000;
// An icon the CSS sizes: its box is --icon (an emoji is 3/4 of it)
const ICON_BOX: React.CSSProperties = { width: 'var(--icon)', height: 'var(--icon)', fontSize: 'calc(var(--icon) * 0.75)' };

export const InlineRoutinePlayer: React.FC<InlineRoutinePlayerProps> = ({
  user,
  routine,
  run,
  onClose
}) => {
  const { playComplete, playAlarm } = useAppSounds();
  const [justEarnedStars, setJustEarnedStars] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // ✕ asks first: closing ends the routine for good (the flow waiting on it moves on).
  // The question stays until it is answered; it is this screen's own, not the server's.
  const [asking, setAsking] = useState(false);

  const currentTaskIndex = run.taskIndex;
  const currentTask = routine?.tasks[currentTaskIndex];
  const totalTasks = routine?.tasks.length || 0;
  const isCompleted = !!run.finishedAt;

  // The countdown runs from the server's task start, so every device (and a
  // reloaded one) shows the same time.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  const duration = currentTask?.durationSeconds || 0;
  const elapsed = Math.floor((now - Date.parse(run.taskStartedAt)) / 1000);
  const timeLeft = Math.min(duration, Math.max(0, duration - elapsed));

  const timeUp = !isCompleted && !!currentTask && timeLeft === 0;
  useEffect(() => {
    if (timeUp) playAlarm();
  }, [timeUp, playAlarm]);

  // All tasks done: show the reward, then close the routine
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    if (!run.finishedAt) return;
    playComplete();
    const timeout = setTimeout(() => onCloseRef.current(), Math.max(0, REWARD_MS - (Date.now() - Date.parse(run.finishedAt))));
    return () => clearTimeout(timeout);
  }, [run.finishedAt, playComplete]);

  const handleNextTask = async () => {
    if (!currentTask) return;
    try {
      const result = await api.completeTask(run.id, currentTask.id);
      if (result.success) {
        sfx('correct');
        if (result.starsAwarded > 0) sfx('stars', { delay: 350 });  // as her stars fly up
        setJustEarnedStars(result.starsAwarded);
        setTimeout(() => setJustEarnedStars(null), 2000);
      }
    } catch (err) {
      console.error('Failed to complete task:', err);
    }
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
            starsEarned={run.totalStars ?? 0}
            onClose={onClose}
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
          <SmartIcon value={user.avatar} style={ICON_BOX} />
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
        <button className="btn-exit" aria-label="Κλείσιμο" {...help('routine.exit')} {...sound('open')} onClick={() => setAsking(true)}>✕</button>
      </div>

      <AnimatePresence>
        {asking && !isCompleted && (
          <motion.div
            className="exit-ask"
            role="dialog"
            aria-label="Να κλείσει η ρουτίνα;"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <p className="exit-ask-text">Να κλείσει η ρουτίνα;</p>
            <div className="exit-ask-buttons">
              <button className="btn-ask btn-ask-yes" {...sound('close')} onClick={onClose}>Ναι</button>
              <button className="btn-ask btn-ask-no" {...sound('unselect')} onClick={() => setAsking(false)}>Όχι</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="player-body">
        {/* Timeline (Compact) */}
        <div className="timeline-compact" {...help('routine.timeline')}>
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
              {...help('routine.task')}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", bounce: 0.3 }}
            >
              <div className="task-icon">
                {currentTask && <SmartIcon value={currentTask.icon} style={ICON_BOX} />}
              </div>
              <h2 className="task-name">{currentTask?.title}</h2>
              {/* Time up: said in words, calmly (a late task still counts: it gets its lateStars) */}
              {timeUp ? (
                <p className="late-note"><span>Πέρασε η ώρα!</span> Τελείωσέ το και πάτα «Έτοιμο!»</p>
              ) : (
                <div className={`timer ${timeLeft < 10 ? 'warning' : ''}`}>
                  {formatTime(timeLeft)}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {!isCompleted && (
          <button className="btn-done" {...help('routine.done')} onClick={handleNextTask}>
            Έτοιμο!
          </button>
        )}
      </div>

      <style>{`
        /* Sized to its cell (the .routine-slot is a size container): clamp(least, cqmin,
           full size). From a cell of about 590 px up (one or two items at 1280x800 and
           bigger) every size is at its full value; below, it shrinks with the cell, down to
           an 800x480 screen with three items (224x416) or a phone row (358x260). */
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
          padding: clamp(0.5rem, 4.1cqmin, 1.5rem);
          gap: clamp(0.5rem, 4.1cqmin, 1.5rem);
          background: rgba(0,0,0,0.3);
        }

        .user-badge {
          width: clamp(32px, 10.2cqmin, 60px);
          height: clamp(32px, 10.2cqmin, 60px);
          flex-shrink: 0;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2.5rem;
          --icon: clamp(26px, 8.2cqmin, 48px);
          box-shadow: 0 0 15px rgba(0,0,0,0.3);
        }

        .user-name-header {
          font-size: clamp(1rem, 5.5cqmin, 2rem);
          font-weight: 900;
          color: white;
          margin-right: clamp(0rem, 2.8cqmin, 1rem);
          letter-spacing: 1px;
          text-shadow: 0 2px 4px rgba(0,0,0,0.5);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
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
          flex-shrink: 0;
          background: transparent;
          color: white;
          font-size: 1.2rem;
          opacity: 0.5;
        }

        /* The ✕'s question covers the card (under the reward, which never shows with it) */
        .exit-ask {
          position: absolute;
          inset: 0;
          z-index: 15;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: clamp(0.75rem, 5.5cqmin, 2rem);
          padding: 1rem;
          background: rgba(10, 8, 30, 0.94);
          backdrop-filter: blur(6px);
          border-radius: 2rem;
          text-align: center;
        }

        .exit-ask-text {
          margin: 0;
          font-size: clamp(1.25rem, 6.8cqmin, 2.5rem);
          font-weight: 900;
          color: white;
          text-wrap: balance;
        }

        .exit-ask-buttons {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: clamp(0.75rem, 4.1cqmin, 1.5rem);
        }

        .btn-ask {
          font-size: clamp(1.1rem, 5.5cqmin, 2rem);
          font-weight: 900;
          min-height: 48px;
          min-width: clamp(80px, 24cqmin, 160px);
          padding: clamp(0.5rem, 2.2cqmin, 0.8rem) clamp(1rem, 5.5cqmin, 2rem);
          border-radius: 1.5rem;
        }

        /* «Όχι» keeps the routine going: the bright one */
        .btn-ask-no {
          background: var(--theme-color);
          color: #000;
          box-shadow: 0 0 20px var(--theme-color);
        }

        .btn-ask-yes {
          background: transparent;
          color: white;
          border: 2px solid rgba(255, 255, 255, 0.7);
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
          max-width: 100%;
          padding: 0 1rem; /* a long title wraps clear of the timeline's dots */
        }

        .task-icon {
          font-size: clamp(2rem, 13.6cqmin, 5rem);
          --icon: clamp(28px, 8.2cqmin, 48px);
          margin-bottom: clamp(0.25rem, 1.4cqmin, 0.5rem);
          animation: bounce 2s infinite;
        }

        .task-name {
          font-size: clamp(1rem, 5.5cqmin, 2rem);
          margin-bottom: clamp(0.25rem, 2.8cqmin, 1rem);
          /* A long title wraps in a narrow card, never past its edges */
          text-wrap: balance;
          overflow-wrap: break-word;
        }

        .timer {
          font-size: clamp(1.75rem, 10.9cqmin, 4rem);
          font-weight: 800;
          font-variant-numeric: tabular-nums;
          margin-bottom: clamp(0.5rem, 5.5cqmin, 2rem);
        }

        .timer.warning {
          color: var(--color-danger);
          animation: pulse 1s infinite;
        }

        .late-note {
          margin: 0 0 clamp(0.5rem, 5.5cqmin, 2rem);
          font-size: clamp(1rem, 5cqmin, 1.75rem);
          font-weight: 800;
          line-height: 1.3;
          color: #ffc94d;
          text-wrap: balance;
          overflow-wrap: break-word;
        }

        .late-note span {
          display: block;
        }

        .btn-done {
          background: var(--theme-color);
          color: #000;
          font-size: clamp(1rem, 4.1cqmin, 1.5rem);
          padding: clamp(0.5rem, 2.2cqmin, 0.8rem) clamp(1rem, 8.2cqmin, 3rem);
          min-height: 44px; /* big enough for a finger in the smallest card */
          border-radius: 1.5rem;
          font-weight: 800;
          box-shadow: 0 0 20px var(--theme-color);
        }

        .floating-stars {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: clamp(2.5rem, 13.6cqmin, 5rem);
          font-weight: 900;
          color: #FFD700;
          text-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
          z-index: 20;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
};
