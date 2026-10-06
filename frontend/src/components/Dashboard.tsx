import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { type AlarmProps, type FlowRun, type Routine, type RoutineRun, type User } from '@shared/types';
import { api } from '../api';
import { InlineRoutinePlayer } from './InlineRoutinePlayer';
import { GlobalAlarm } from './GlobalAlarm';
import { alarmSoundKey, useAlarmSound } from '../hooks/useAlarmSound';
import { SmartIcon } from './SmartIcon';
import { StoreModal } from './StoreModal';
import { ChoresDrawer } from './ChoresDrawer';
import { useGame } from '../context/GameContext';
import { useTouchDevice } from '../hooks/useTouchDevice';
import { ExerciseSetup } from './ExerciseSetup';
import { ExerciseGame } from './ExerciseGame';
import { ExercisesDrawer } from './ExercisesDrawer';
import { waitingCount } from './exerciseCounts';
import { help } from '../help/anchors';
import { sound } from '../sound/sfx';
import { HelpCover, HelpScreen } from '../help/HelpProvider';
import { homeTour, routineTour } from './Dashboard.help';

// Toast for a chore outcome (from a server event)
interface ChoreNotification {
  id: string;
  type: 'expired' | 'confirmed' | 'rejected';
  choreTitle: string;
  userId?: string;
  starsAwarded?: number;
}

const TOAST_MS = 5000;

// `order`: where it goes on screen, by kid (the config's order; an alarm for everyone first)
type ActiveItem =
  | { type: 'alarm'; key: string; order: number; userIds: string[]; run: FlowRun; props: AlarmProps }
  | { type: 'routine'; key: string; order: number; run: RoutineRun; user: User; routine: Routine };
type AlarmItem = Extract<ActiveItem, { type: 'alarm' }>;
const CHORE_TOAST_TYPE = { CHORE_CONFIRMED: 'confirmed', CHORE_REJECTED: 'rejected', CHORE_EXPIRED: 'expired' } as const;

export const Dashboard: React.FC = () => {
  const {
    users, rewards, spendings, starTransfers, chores, choreInstances,
    exerciseSessions, exerciseAssignments, flowRuns, routineRuns, subscribe
  } = useGame();
  const [choreNotifications, setChoreNotifications] = useState<ChoreNotification[]>([]);
  const dismissChoreNotification = useCallback((id: string) => {
    setChoreNotifications(prev => prev.filter(n => n.id !== id));
  }, []);
  const isTouchDevice = useTouchDevice();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Store State
  const [storeUserId, setStoreUserId] = useState<string | null>(null);
  const storeUser = users.find(u => u.id === storeUserId) || null;

  // Chores Drawer State
  const [choresOpen, setChoresOpen] = useState(false);
  
  // Bonus Activities Drawer State
  const [bonusOpen, setBonusOpen] = useState(false);

  // Exercise State
  const [setupOpen, setSetupOpen] = useState(false);

  // Daily Exercises Drawer State
  const [dailyExercisesOpen, setDailyExercisesOpen] = useState(false);

  const [hasInteracted, setHasInteracted] = useState(false);
  const [timeWarning, setTimeWarning] = useState<string | null>(null);

  // Count active chores (available, claimed, attempted) - filtered by category
  const activeChoresCount = useMemo(() => {
    return choreInstances.filter(ci => {
      if (!['available', 'claimed', 'attempted'].includes(ci.status)) return false;
      const chore = chores.find(c => c.id === ci.choreId);
      return chore && (chore.category || 'chore') === 'chore';
    }).length;
  }, [choreInstances, chores]);

  // The daily sets still to do (the drawer counts the same; extra problems are apart)
  const pendingExercisesCount = useMemo(() => waitingCount(exerciseAssignments), [exerciseAssignments]);

  // Count active bonus activities
  const activeBonusCount = useMemo(() => {
    return choreInstances.filter(ci => {
      if (!['available', 'claimed', 'attempted'].includes(ci.status)) return false;
      const chore = chores.find(c => c.id === ci.choreId);
      return chore && chore.category === 'bonus';
    }).length;
  }, [choreInstances, chores]);

  // Chore toasts (server events)
  useEffect(() => subscribe(event => {
    // A chore was confirmed, rejected or expired
    const { instanceId, choreTitle, userId } = event.payload;
    const notification: ChoreNotification = {
      id: `${event.type}-${instanceId}`,
      type: CHORE_TOAST_TYPE[event.type],
      choreTitle: choreTitle || '',
      userId,
      starsAwarded: event.type === 'CHORE_CONFIRMED' ? event.payload.starsAwarded : undefined
    };
    setChoreNotifications(prev => [...prev.filter(n => n.id !== notification.id), notification]);
    setTimeout(() => dismissChoreNotification(notification.id), TOAST_MS);
  }), [subscribe, dismissChoreNotification]);

  // Check for URL push parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const pushId = urlParams.get('push');
    if (pushId) {
      api.pushNow(pushId).catch(err => console.error('Push failed:', err));
      // Clear the URL parameter
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Check time synchronization
  useEffect(() => {
    const checkTime = async () => {
      try {
        const debug = await api.getScheduleDebug();
        const serverTime = new Date(debug.serverTime);
        const clientTime = new Date();
        const diff = Math.abs(serverTime.getTime() - clientTime.getTime());

        console.log(`[TimeSync] Server: ${serverTime.toISOString()} | Client: ${clientTime.toISOString()} | Diff: ${diff}ms`);

        // More than 2 minutes apart: say so, for a parent (not which clock is wrong; either may be)
        if (diff > 2 * 60 * 1000) {
          const msg = `Η ώρα αυτής της οθόνης διαφέρει από τον server κατά ${Math.round(diff / 60000)} λεπτά`;
          setTimeWarning(msg);
          console.warn(`[TimeSync] ${msg}`);
        }
      } catch (e) {
        console.error('Failed to check time sync', e);
      }
    };

    checkTime();
  }, []);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Running flows and routines come from the server; this only lays them out
  // and reports what the kids do.
  const sortedActiveItems = React.useMemo(() => {
    const order = (userId: string) => users.findIndex(u => u.id === userId);
    const busy = new Set(routineRuns.map(r => r.userId));

    // An alarm is never hidden. The server says whom it is for (none: everyone). While
    // a kid's alarm is up it takes her routine's place, so it can't be missed: her
    // routine stays on the server and comes back as it was once she dismisses it.
    const alarms: AlarmItem[] = flowRuns.flatMap(run => {
      const step = run.steps[run.stepIndex];
      if (step?.type !== 'alarm') return [];
      const userIds = run.userIds ?? [];
      const at = userIds.find(id => busy.has(id)) ?? userIds[0];
      return [{ type: 'alarm' as const, key: `alarm-${run.id}`, order: at ? order(at) : -1, userIds, run, props: step.props }];
    });
    const covered = new Set(alarms.flatMap(alarm => alarm.userIds));
    // A run whose kid or routine is gone from the config shows nothing, so it doesn't count
    const routines: ActiveItem[] = routineRuns.flatMap(run => {
      const user = users.find(u => u.id === run.userId);
      const routine = user?.routines.find(r => r.id === run.routineId);
      if (!user || !routine || covered.has(run.userId)) return [];
      return [{ type: 'routine' as const, key: `routine-${run.id}`, order: order(run.userId), run, user, routine }];
    });

    return [...alarms, ...routines].sort((a, b) => a.order - b.order);
  }, [flowRuns, routineRuns, users]);

  // One alarm sound for every alarm card on screen (the first one's)
  const firstAlarm = sortedActiveItems.find((item): item is AlarmItem => item.type === 'alarm');
  useAlarmSound(firstAlarm ? alarmSoundKey(firstAlarm.props) : null);

  // The stage's grid: in landscape up to 3 items in one row, 4 as 2x2; in portrait one
  // column (the CSS picks by orientation). Every track shrinks, so every item fits.
  const totalActiveCount = sortedActiveItems.length;
  const stageCols = totalActiveCount <= 3 ? totalActiveCount : Math.ceil(totalActiveCount / 2);
  const stageGrid = {
    '--items': totalActiveCount,
    '--cols': stageCols,
    '--rows': Math.ceil(totalActiveCount / Math.max(1, stageCols)),
  } as React.CSSProperties;

  // The owl explains the home screen, or the routines on it (once the screen is started)
  const tour = !hasInteracted ? null : totalActiveCount === 0 ? homeTour() : routineTour();

  return (
    <HelpScreen tour={tour}>
    <div className="dashboard">
      {!hasInteracted && (
        <div className="interaction-overlay" {...sound('open')} onClick={() => setHasInteracted(true)}>
          <div className="start-btn">Πάτα για να ξεκινήσουμε!</div>
        </div>
      )}

      {/* What a kid can open. A routine or alarm covers it all (the stage below), and it
          waits there as it was: an answer half done, the store, the group game. Meanwhile
          the owl explains what is on top, not what is hidden. */}
      <HelpCover covered={totalActiveCount > 0}>
      <AnimatePresence>
        {storeUser && (
          <StoreModal
            user={storeUser}
            rewards={rewards}
            spendings={spendings}
            starTransfers={starTransfers}
            allUsers={users}
            onClose={() => setStoreUserId(null)}
          />
        )}
      </AnimatePresence>

      {/* Floating Chores Button */}
      {totalActiveCount === 0 && (
        <motion.button
          className="chores-fab"
          {...help('home.chores')}
          {...sound('open')}
          onClick={() => setChoresOpen(true)}
          initial={{ x: 100 }}
          animate={{ x: 0 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          🧹
          {activeChoresCount > 0 && (
            <span className="chores-fab-badge">
              {activeChoresCount}
            </span>
          )}
        </motion.button>
      )}

      {/* Floating Bonus Activities Button */}
      {totalActiveCount === 0 && (
        <motion.button
          className="bonus-fab"
          {...help('home.bonus')}
          {...sound('open')}
          onClick={() => setBonusOpen(true)}
          initial={{ x: 100 }}
          animate={{ x: 0 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          🌟
          {activeBonusCount > 0 && (
            <span className="bonus-fab-badge">
              {activeBonusCount}
            </span>
          )}
        </motion.button>
      )}

      {/* Floating School Exercises Button */}
      {totalActiveCount === 0 && (
        <motion.button
          className="exercise-fab"
          {...help('home.game')}
          {...sound('open')}
          onClick={() => setSetupOpen(true)}
          initial={{ x: 100 }}
          animate={{ x: 0 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          📚
        </motion.button>
      )}

      {/* Floating Daily Exercises Button */}
      {totalActiveCount === 0 && (
        <motion.button
          className="daily-exercises-fab"
          {...help('home.exercises')}
          {...sound('open')}
          onClick={() => setDailyExercisesOpen(true)}
          initial={{ x: 100 }}
          animate={{ x: 0 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          ✏️
          {pendingExercisesCount > 0 && (
            <span className="daily-exercises-fab-badge">
              {pendingExercisesCount}
            </span>
          )}
        </motion.button>
      )}

      {/* Chores Drawer */}
      <ChoresDrawer
        isOpen={choresOpen}
        onClose={() => setChoresOpen(false)}
        category="chore"
      />

      {/* Bonus Activities Drawer */}
      <ChoresDrawer
        isOpen={bonusOpen}
        onClose={() => setBonusOpen(false)}
        category="bonus"
      />

      {/* Daily Exercises Drawer */}
      <ExercisesDrawer
        isOpen={dailyExercisesOpen}
        onClose={() => setDailyExercisesOpen(false)}
      />

      {/* Exercise Overlays */}
      <AnimatePresence>
        {setupOpen && (
          <ExerciseSetup
            users={users}
            onClose={() => setSetupOpen(false)}
            onStart={(p, c, r, q) => {
              api.startExerciseSession(p, c, r, q);
              setSetupOpen(false);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {exerciseSessions.length > 0 && (
          <ExerciseGame
            session={exerciseSessions[0]}
            onClose={() => api.cancelExerciseSession(exerciseSessions[0].id)}
          />
        )}
      </AnimatePresence>
      </HelpCover>

      {/* Toast Notifications for Chores */}
      <div className="toast-container">
        <AnimatePresence>
          {choreNotifications.map(notification => {
            const user = users.find(u => u.id === notification.userId);
            return (
              <motion.div
                key={notification.id}
                className={`toast toast-${notification.type}`}
                initial={{ opacity: 0, x: 100, y: 0 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, x: 100 }}
                {...sound('close')}
                onClick={() => dismissChoreNotification(notification.id)}
              >
                {notification.type === 'expired' && (
                  <>
                    <span className="toast-icon">⏰</span>
                    <span className="toast-text">
                      {user ? `${user.name}: ` : ''}
                      «{notification.choreTitle}» έληξε!
                    </span>
                  </>
                )}
                {notification.type === 'confirmed' && (
                  <>
                    <span className="toast-icon">✓</span>
                    <span className="toast-text">
                      {user ? `${user.name}: ` : ''}
                      «{notification.choreTitle}» +{notification.starsAwarded}⭐
                    </span>
                  </>
                )}
                {notification.type === 'rejected' && (
                  <>
                    <span className="toast-icon">✗</span>
                    <span className="toast-text">
                      {user ? `${user.name}: ` : ''}
                      «{notification.choreTitle}» απορρίφθηκε
                    </span>
                  </>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Main Stage: the clock, or the routines and alarms in a layer over everything */}
      <div className={`routines-layer ${totalActiveCount > 0 ? 'covering' : ''}`}>
      <div
        className={`stage${totalActiveCount > 0 ? ' items' : ''}${totalActiveCount === 1 ? ' one' : ''}`}
        style={totalActiveCount > 0 ? stageGrid : undefined}
      >
        <AnimatePresence>
          {totalActiveCount === 0 && (
            <motion.div
              className="clock-container"
              {...help('home.clock')}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <h1 className="time-display">
                {format(currentTime, 'HH:mm')}
              </h1>
              <p className="date-display">
                {format(currentTime, 'EEEE, d MMMM', { locale: el })}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Items (Alarms & Routines) Sorted by User Lane */}
        {sortedActiveItems.map((item) => {
          if (item.type === 'alarm') {
            const { run } = item;
            const alarmUsers = users.filter(u => item.userIds.includes(u.id));
            return (
              <motion.div
                key={item.key}
                className="routine-slot"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: "spring", bounce: 0.3 }}
              >
                <GlobalAlarm
                  flowId={run.id}
                  users={alarmUsers}
                  alarmProps={item.props}
                  onDismiss={() => api.dismissAlarm(run.id, run.stepIndex).catch(console.error)}
                />
              </motion.div>
            );
          } else {
            const { run, user, routine } = item;
            return (
              <motion.div
                key={item.key}
                className="routine-slot"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: "spring", bounce: 0.3 }}
              >
                <InlineRoutinePlayer
                  key={run.id}
                  user={user}
                  routine={routine}
                  run={run}
                  onClose={() => api.closeRoutine(run.id).catch(console.error)}
                />
              </motion.div>
            );
          }
        })}
      </div>
      </div>

      {/* Dock (Inactive Users) */}
      {totalActiveCount === 0 && (
        <motion.div
          className="dock"
          initial={{ y: 100 }}
          animate={{ y: 0 }}
        >
          {users.map(user => (
            <motion.div
              key={user.id}
              className="dock-item"
              {...help('home.kid')}
              whileHover={!isTouchDevice ? { scale: 1.05, y: -5 } : {}}
              whileTap={{ scale: 0.95 }}
            >
              <div className="dock-avatar" style={{ background: user.color }} {...sound('open')} onClick={() => setStoreUserId(user.id)}>
                {/* 80% of the avatar, an emoji's glyph too (SmartIcon's size={80} is the kiosk's) */}
                <SmartIcon value={user.avatar} size={80} style={{ width: '80%', height: '80%', fontSize: 'calc(var(--dock-avatar) * 0.6)' }} />
                <span className="dock-stars">⭐ {user.stars}</span>
              </div>
              <span className="dock-name">{user.name}</span>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* The screen's clock and the server's disagree: for a parent, rare. A tap hides it, so it
          never stays over a game's round or a kid's badge. No tour step: a kid can't fix a clock. */}
      <AnimatePresence>
        {timeWarning && (
          <motion.button
            className="time-warning"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            {...sound('close')}
            onClick={() => setTimeWarning(null)}
          >
            ⚠️ {timeWarning}
          </motion.button>
        )}
      </AnimatePresence>

      <style>{`
        .dashboard {
          height: 100vh; /* Fallback */
          height: 100dvh;
          width: 100vw;
          overflow: hidden; /* Fallback */
          overflow: clip; /* not even a script (a tour's scrollIntoView) can scroll it */
          position: relative;
          /* The dock's size, from its content: the avatar (100 px down to 800 px tall, never
             under a finger's 44 px) + 1rem over it + the gap and the name's line + 0.625rem */
          --dock-avatar: clamp(48px, 12.5dvh, 100px);
          --dock-h: calc(var(--dock-avatar) + 3.5rem);
          /* The side buttons' column (60 px each, every --fab-step), its second at --fab-at:
             at 800 px tall and more the middle of the screen, as always; on shorter screens
             it moves up and closes up, between the top right corner and the dock. That corner
             holds the chore toasts (3.5rem each, 0.5rem apart, from top 1rem): --fab-top leaves
             room for one toast and a gap. More toasts stack over the
             column for their 5 s, as they always did on short screens. */
          --fab: 60px;
          --fab-top: 5.25rem;
          --fab-step: min(80px, (100dvh - var(--dock-h) - 1rem - var(--fab-top) - var(--fab)) / 3);
          --fab-at: min(50%, 100dvh - var(--dock-h) - 1rem - var(--fab) - 2 * var(--fab-step));
          display: flex;
          flex-direction: column;
          color: white;
          /* No stacking context here (no isolation, no z-index): the overlays inside, the
             exercise player portalled to <body> and the owl share one scale (layers.css) */
          background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
        }

        .interaction-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.7);
          z-index: var(--z-start);
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(5px);
          cursor: pointer;
        }

        /* Whole and centred on any screen: a phone (390 px) as well as the kiosk */
        .start-btn {
          font-size: clamp(1.75rem, 6vw, 3rem);
          font-weight: 900;
          color: white;
          padding: clamp(1.25rem, 4vw, 2rem) clamp(1.5rem, 6vw, 4rem);
          border: 4px solid white;
          border-radius: 2rem;
          letter-spacing: 2px;
          text-align: center;
          max-width: min(40rem, calc(100vw - 2rem));
          box-sizing: border-box;
          animation: pulse 2s infinite;
        }

        .stage {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          gap: 2rem;
          position: relative;
          overflow: visible;
        }

        .routines-layer {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        /* Routines and alarms own the screen: a layer over everything a kid can open.
           The stage inside lays them out the same way. */
        .routines-layer.covering {
          position: fixed;
          inset: 0;
          z-index: var(--z-routines);
          overflow: hidden;
          background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
        }

        /* Every item gets a share of the screen: minmax(0, 1fr) tracks (a plain 1fr won't
           shrink below a card's content) in a stage that may shrink too. Landscape: one row
           of up to 3, then 2 rows; portrait: one column. Each slot is a size container, so
           its card sizes to the cell (cqmin), up to its full size. */
        .stage.items {
          display: grid;
          grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
          grid-template-rows: repeat(var(--rows), minmax(0, 1fr));
          min-height: 0;
          min-width: 0;
          align-items: stretch;
          justify-items: stretch;
        }
        @media (orientation: portrait) {
          .stage.items {
            grid-template-columns: minmax(0, 1fr);
            grid-template-rows: repeat(var(--items), minmax(0, 1fr));
          }
        }

        .routine-slot {
          height: 100%;
          width: 100%;
          min-width: 0;
          min-height: 0;
          container-type: size; /* its card sizes to it (cqmin) */
        }
        .stage.one .routine-slot { max-width: 600px; justify-self: center; }
        /* The clock still fading out as the first item comes in stays out of the grid's
           cells: in the flow it would take the only one, and the item would wait in a
           0 px row until the clock was gone. It fades behind the item. */
        .stage.items > .clock-container {
          position: absolute;
          inset: 0;
          z-index: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }

        .clock-container {
          text-align: center;
          z-index: 1;
        }

        .time-display {
          font-size: 12rem;
          font-weight: 200;
          line-height: 1;
          text-shadow: 0 0 30px rgba(255,255,255,0.2);
          font-variant-numeric: tabular-nums;
        }

        .date-display {
          font-size: 3rem;
          opacity: 0.7;
          text-transform: capitalize;
        }

        .time-warning {
          position: fixed;
          top: 1rem;
          left: 1rem;
          max-width: calc(100vw - 2rem);
          background: rgba(255, 50, 50, 0.9);
          color: white;
          font: inherit;
          font-weight: bold;
          text-align: left;
          padding: 0.75rem 1.25rem;
          border-radius: 0.5rem;
          z-index: var(--z-toasts);
          backdrop-filter: blur(5px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.2);
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }

        @media (max-width: 768px) {
          .time-display { font-size: 6rem; }
          .date-display { font-size: 1.5rem; }
          .stage { padding: 1rem; gap: 1rem; }
        }

        /* As tall as what it holds (--dock-h), so nothing hangs off it: the last child of a
           100dvh column, whatever hung under it was under the screen's edge */
        .dock {
          height: var(--dock-h);
          flex: none;
          background: rgba(255,255,255,0.1);
          backdrop-filter: blur(20px);
          display: flex;
          align-items: flex-start;
          justify-content: center;
          gap: 1rem;
          padding: 1rem 2rem 0.625rem;
          overflow: hidden;
          width: 100%;
          z-index: var(--z-dock);
          position: relative;
        }

        .dock::-webkit-scrollbar {
          display: none;
        }

        .dock-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.375rem;
          padding: 0 1rem; /* room for the star badge, inside the item (a tour lights all of it) */
          cursor: pointer;
          z-index: 1;
          position: relative;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          user-select: none;
        }

        .dock-avatar {
          position: relative;
          width: var(--dock-avatar);
          height: var(--dock-avatar);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 4rem;
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        }

        .dock-name {
          font-size: 1rem;
          line-height: 1.5rem;
          font-weight: 600;
        }

        /* Her balance, a badge on her avatar like the side buttons' counts: gold, readable
           across the room */
        .dock-stars {
          position: absolute;
          top: -0.5rem;
          right: -1rem;
          background: linear-gradient(135deg, #ffd60a, #fb8500);
          color: #1a1a2e;
          font-size: clamp(0.95rem, calc(var(--dock-avatar) * 0.18), 1.1rem);
          font-weight: 800;
          font-variant-numeric: tabular-nums;
          line-height: 1;
          padding: 0.3rem 0.55rem;
          border-radius: 1rem;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(0,0,0,0.35);
        }

        /* The side buttons. top is each one's top edge: framer-motion's transform (x) replaces
           any translate here. Spaced by --fab-step from --fab-at (see .dashboard). */
        /* Floating Chores Button */
        .chores-fab {
          position: fixed;
          right: 1.5rem;
          top: var(--fab-at);
          width: var(--fab);
          height: var(--fab);
          min-width: var(--fab);
          min-height: var(--fab);
          padding: 0;
          border-radius: 50%;
          background: linear-gradient(135deg, #4cc9f0, #4361ee);
          border: none;
          font-size: 2rem;
          cursor: pointer;
          box-shadow: 0 4px 20px rgba(76, 201, 240, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: var(--z-dock);
        }

        .chores-fab-badge {
          position: absolute;
          top: -5px;
          right: -5px;
          background: #ef476f;
          color: white;
          font-size: 0.8rem;
          font-weight: 700;
          padding: 0.2rem 0.5rem;
          border-radius: 1rem;
          min-width: 1.5rem;
          text-align: center;
        }

        /* Floating Bonus Activities Button */
        .bonus-fab {
          position: fixed;
          right: 1.5rem;
          top: calc(var(--fab-at) + var(--fab-step));
          width: var(--fab);
          height: var(--fab);
          min-width: var(--fab);
          min-height: var(--fab);
          padding: 0;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border: none;
          font-size: 2rem;
          cursor: pointer;
          box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: var(--z-dock);
        }

        .bonus-fab-badge {
          position: absolute;
          top: -5px;
          right: -5px;
          background: #ef476f;
          color: white;
          font-size: 0.8rem;
          font-weight: 700;
          padding: 0.2rem 0.5rem;
          border-radius: 1rem;
          min-width: 1.5rem;
          text-align: center;
        }

        /* Floating School Exercises Button */
        .exercise-fab {
          position: fixed;
          right: 1.5rem;
          top: calc(var(--fab-at) + 2 * var(--fab-step));
          width: var(--fab);
          height: var(--fab);
          min-width: var(--fab);
          min-height: var(--fab);
          padding: 0;
          border-radius: 50%;
          background: linear-gradient(135deg, #f72585, #7209b7);
          border: none;
          font-size: 2rem;
          cursor: pointer;
          box-shadow: 0 4px 20px rgba(247, 37, 133, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: var(--z-dock);
        }

        /* Floating Daily Exercises Button */
        .daily-exercises-fab {
          position: fixed;
          right: 1.5rem;
          top: calc(var(--fab-at) - var(--fab-step));
          width: var(--fab);
          height: var(--fab);
          min-width: var(--fab);
          min-height: var(--fab);
          padding: 0;
          border-radius: 50%;
          background: linear-gradient(135deg, #ffd60a, #fb8500);
          border: none;
          font-size: 2rem;
          cursor: pointer;
          box-shadow: 0 4px 20px rgba(255, 214, 10, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: var(--z-dock);
        }

        .daily-exercises-fab-badge {
          position: absolute;
          top: -5px;
          right: -5px;
          background: #ef476f;
          color: white;
          font-size: 0.8rem;
          font-weight: 700;
          padding: 0.2rem 0.5rem;
          border-radius: 1rem;
          min-width: 1.5rem;
          text-align: center;
        }

        /* Toast Notifications */
        .toast-container {
          position: fixed;
          top: 1rem;
          right: 1rem;
          z-index: var(--z-toasts);
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          max-width: 90vw;
        }

        .toast {
          background: rgba(26, 26, 46, 0.95);
          backdrop-filter: blur(10px);
          border-radius: 0.75rem;
          padding: 0.75rem 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          cursor: pointer;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .toast-expired {
          border-color: rgba(239, 71, 111, 0.5);
        }

        .toast-confirmed {
          border-color: rgba(6, 214, 160, 0.5);
        }

        .toast-rejected {
          border-color: rgba(239, 71, 111, 0.5);
        }

        .toast-icon {
          font-size: 1.25rem;
        }

        .toast-text {
          font-size: 0.9rem;
        }
      `}</style>
    </div>
    </HelpScreen>
  );
};
