import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { type Flow, type FlowInstance } from '@shared/types';
import { api } from '../api';
import { InlineRoutinePlayer } from './InlineRoutinePlayer';
import { GlobalAlarm } from './GlobalAlarm';
import { SmartIcon } from './SmartIcon';
import { StoreModal } from './StoreModal';
import { useGame } from '../context/GameContext';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { useTouchDevice } from '../hooks/useTouchDevice';

export const Dashboard: React.FC = () => {
  const { users, flows, rewards, spendings, lastEvent } = useGame();
  const isTouchDevice = useTouchDevice();
  const [currentTime, setCurrentTime] = useState(new Date());
  const { isInstallable, promptInstall } = useInstallPrompt();

  // Store State
  const [storeUserId, setStoreUserId] = useState<string | null>(null);
  const storeUser = users.find(u => u.id === storeUserId) || null;

  // Flow State - supports multiple simultaneous flows
  const [activeFlows, setActiveFlows] = useState<FlowInstance[]>([]);

  // Active Routines (triggered by flow)
  const [activeRoutines, setActiveRoutines] = useState<{ userId: string, routineId: string, executionId?: string }[]>([]);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Refs for state access in callbacks
  const flowsRef = useRef<Flow[]>([]);

  useEffect(() => {
    flowsRef.current = flows;
  }, [flows]);

  // Handle Game Events
  useEffect(() => {
    if (!lastEvent) return;

    const { type, payload } = lastEvent;

    if (type === 'ALARM_START') {
      // Trigger alarm by creating a temporary flow
      const alarmFlow = {
        id: 'temp-alarm',
        triggerTime: '',
        steps: [{ type: 'alarm' as const, props: { sound: 'melody' } }]
      };
      setActiveFlows(prev => {
        // Prevent duplicates - remove any existing flow with this ID
        const filtered = prev.filter(f => f.flowId !== 'temp-alarm');
        return [...filtered, { flowId: 'temp-alarm', flow: alarmFlow as any, stepIndex: 0 }];
      });
    } else if (type === 'ROUTINE_START') {
      const { userId, routineId, executionId } = payload;
      setActiveRoutines(prev => {
        // Prevent duplicates - remove any existing routine for this user
        const filtered = prev.filter(r => !(r.userId === userId && r.routineId === routineId));
        return [...filtered, { userId, routineId, executionId }];
      });
    } else if (type === 'FLOW_START') {
      const { flowId, steps } = payload;
      // Use ref to get latest flows
      const flow = flowsRef.current.find(f => f.id === flowId) || { id: flowId, triggerTime: '', steps };
      setActiveFlows(prev => {
        // Prevent duplicates - remove any existing flow with this ID
        const filtered = prev.filter(f => f.flowId !== flowId);
        return [...filtered, { flowId, flow, stepIndex: 0 }];
      });

      // Execute the first step if it's a parallel step
      const firstStep = steps[0];
      if (firstStep && firstStep.type === 'parallel' && firstStep.actions) {
        firstStep.actions.forEach((a: any) => {
          if (a.type === 'routine') {
            api.pushNow(a.routineId).catch(console.error);
          } else if (a.type === 'flow') {
            api.pushNow(a.flowId).catch(console.error);
          }
        });
      }
    }
  }, [lastEvent]);

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

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Flow Trigger Logic (Test Mode: Trigger after 3s) - REMOVED
  // Real implementation will listen to WebSockets or manual triggers

  const handleStepComplete = (flowId: string) => {
    setActiveFlows(prev => {
      const flowInstance = prev.find(f => f.flowId === flowId);
      if (!flowInstance) return prev;

      const nextIndex = flowInstance.stepIndex + 1;
      if (nextIndex < flowInstance.flow.steps.length) {
        // Advance to next step
        const updatedFlows = prev.map(f =>
          f.flowId === flowId ? { ...f, stepIndex: nextIndex } : f
        );

        // Execute next step actions if it's a parallel step
        const nextStep = flowInstance.flow.steps[nextIndex];
        if (nextStep.type === 'parallel' && nextStep.actions) {
          nextStep.actions.forEach(a => {
            if (a.type === 'routine') {
              // Push the routine assignment ID to trigger it
              api.pushNow(a.routineId).catch(console.error);
            } else if (a.type === 'flow') {
              // Push the flow ID to trigger it
              api.pushNow(a.flowId).catch(console.error);
            }
          });
        }

        return updatedFlows;
      } else {
        // Flow Complete - remove from array
        return prev.filter(f => f.flowId !== flowId);
      }
    });
  };

  const handleRoutineExit = (userId: string) => {
    setActiveRoutines(prev => prev.filter(r => r.userId !== userId));
  };

  const handleRoutineComplete = (userId: string) => {
    handleRoutineExit(userId);
  };

  // Determine View Mode - count both alarms and routines
  const activeAlarms = activeFlows.filter(af => af.flow.steps[af.stepIndex]?.type === 'alarm');
  const totalActiveCount = activeAlarms.length + activeRoutines.length;
  const viewMode = totalActiveCount === 0 ? 'IDLE' : totalActiveCount === 1 ? 'SINGLE' : totalActiveCount === 2 ? 'DUAL' : 'GRID';

  return (
    <div className="dashboard">
      {!hasInteracted && (
        <div className="interaction-overlay" onClick={() => setHasInteracted(true)}>
          <div className="start-btn">Click to Start</div>
        </div>
      )}

      <AnimatePresence>
        {storeUser && (
          <StoreModal
            user={storeUser}
            rewards={rewards}
            spendings={spendings}
            onClose={() => setStoreUserId(null)}
          />
        )}
      </AnimatePresence>

      {/* Background Animation */}
      <div className="bg-gradient" />

      {/* Main Stage */}
      <div className={`stage ${viewMode.toLowerCase()}`}>
        <AnimatePresence>
          {totalActiveCount === 0 && (
            <motion.div
              className="clock-container"
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

        {/* Active Alarms - rendered inline in stage */}
        {activeAlarms.map((af) => (
          <motion.div
            key={`alarm-${af.flowId}`}
            className="routine-slot"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", bounce: 0.3 }}
          >
            <GlobalAlarm
              flowId={af.flowId}
              onDismiss={handleStepComplete}
            />
          </motion.div>
        ))}

        {/* Active Routines Grid */}
        {activeRoutines.map((ar) => {
          const user = users.find(u => u.id === ar.userId);
          const routine = user?.routines.find(r => r.id === ar.routineId);

          if (!user || !routine) return null;

          return (
            <motion.div
              key={`${ar.userId}-${ar.routineId}`}
              className="routine-slot"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", bounce: 0.3 }}
            >
              <InlineRoutinePlayer
                user={user}
                routine={routine}
                executionId={ar.executionId}
                onComplete={() => handleRoutineComplete(ar.userId)}
                onExit={() => handleRoutineExit(ar.userId)}
              />
            </motion.div>
          );
        })}
      </div>

      {/* Install PWA Button */}
      {isInstallable && (
        <motion.button
          className="install-pwa-btn"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={!isTouchDevice ? { scale: 1.05 } : {}}
          whileTap={{ scale: 0.95 }}
          onClick={promptInstall}
        >
          📲 Install App
        </motion.button>
      )}

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
              whileHover={!isTouchDevice ? { scale: 1.05, y: -5 } : {}}
              whileTap={{ scale: 0.95 }}
              onClick={() => setStoreUserId(user.id)}
            >
              <div className="dock-avatar" style={{ background: user.color }}>
                <SmartIcon value={user.avatar} size={80} />
              </div>
              <span className="dock-name">{user.name}</span>
              <span className="dock-stars">⭐ {user.stars}</span>
            </motion.div>
          ))}
        </motion.div>
      )}

      <style>{`
        .dashboard {
          height: 100vh; /* Fallback */
          height: 100dvh;
          width: 100vw;
          overflow: hidden;
          position: relative;
          display: flex;
          flex-direction: column;
          color: white;
          isolation: isolate;
        }

        .interaction-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.7);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(5px);
          cursor: pointer;
        }

        .start-btn {
          font-size: 3rem;
          font-weight: 900;
          color: white;
          padding: 2rem 4rem;
          border: 4px solid white;
          border-radius: 2rem;
          letter-spacing: 4px;
          animation: pulse 2s infinite;
        }

        .bg-gradient {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
          z-index: -1;
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

        .stage.single .routine-slot { width: 100%; height: 100%; max-width: 600px; }
        .stage.dual .routine-slot { width: 50%; height: 100%; }
        .stage.grid { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }

        .routine-slot {
          height: 100%;
          width: 100%;
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

        @media (max-width: 768px) {
          .time-display { font-size: 6rem; }
          .date-display { font-size: 1.5rem; }
          .stage { padding: 1rem; gap: 1rem; }
          .stage.grid { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; }
          .stage.dual { flex-direction: column; }
          .stage.dual .routine-slot { width: 100%; height: 50%; }
        }

        .dock {
          height: 120px;
          background: rgba(255,255,255,0.1);
          backdrop-filter: blur(20px);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 3rem;
          padding: 0 2rem;
          overflow: visible;
          width: 100%;
          z-index: 100;
          position: relative;
        }

        .dock::-webkit-scrollbar {
          display: none;
        }

        .dock-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          padding: 10px 0;
          z-index: 101;
          position: relative;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          user-select: none;
        }

        .dock-avatar {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 4rem;
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        }

        .dock-name {
          font-size: 1rem;
          font-weight: 600;
        }
        
        .dock-stars {
          font-size: 0.8rem;
          color: gold;
        }

        .install-pwa-btn {
          position: fixed;
          top: 1rem;
          right: 1rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 2rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
          z-index: 1000;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          user-select: none;
        }
      `}</style>
    </div>
  );
};
