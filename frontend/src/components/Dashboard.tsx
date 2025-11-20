import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { type User } from '../data/mockData';
import { type Flow } from '../data/flows';
import { api } from '../api';
import { InlineRoutinePlayer } from './InlineRoutinePlayer';
import { GlobalAlarm } from './GlobalAlarm';

export const Dashboard: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [users, setUsers] = useState<User[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Flow State
  const [activeFlow, setActiveFlow] = useState<Flow | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  
  // Active Routines (triggered by flow)
  const [activeRoutines, setActiveRoutines] = useState<{userId: string, routineId: string}[]>([]);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersData, flowsData] = await Promise.all([
          api.getUsers(),
          api.getFlows()
        ]);
        setUsers(usersData);
        setFlows(flowsData);
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();

    // WebSocket connection
    const websocket = new WebSocket(`ws://${window.location.host}/ws`);
    websocket.onopen = () => {
      console.log('WebSocket connected');
    };
    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log('WebSocket message:', message);

      if (message.type === 'ALARM_START') {
        // Trigger alarm by creating a temporary flow
        const alarmFlow = {
          id: 'temp-alarm',
          triggerTime: '',
          steps: [{ type: 'alarm' as const, props: { sound: 'melody' } }]
        };
        setActiveFlow(alarmFlow as any);
        setCurrentStepIndex(0);
      } else if (message.type === 'ROUTINE_START') {
        const { userId, routineId } = message.payload;
        setActiveRoutines(prev => [...prev, { userId, routineId }]);
      } else if (message.type === 'FLOW_START') {
        const { flowId, steps } = message.payload;
        const flow = flows.find(f => f.id === flowId) || { id: flowId, triggerTime: '', steps };
        setActiveFlow(flow);
        setCurrentStepIndex(0);
        // Execute first step if it's an alarm
        if (steps[0]?.type === 'alarm') {
          // Alarm will be shown by the component
        }
      }
    };
    setWs(websocket);

    // Check for URL push parameter
    const urlParams = new URLSearchParams(window.location.search);
    const pushId = urlParams.get('push');
    if (pushId) {
      api.pushNow(pushId).catch(err => console.error('Push failed:', err));
      // Clear the URL parameter
      window.history.replaceState({}, '', window.location.pathname);
    }

    return () => {
      websocket.close();
    };
  }, []);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Flow Trigger Logic (Test Mode: Trigger after 3s) - REMOVED
  // Real implementation will listen to WebSockets or manual triggers

  const handleStepComplete = () => {
    if (!activeFlow) return;
    
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < activeFlow.steps.length) {
      setCurrentStepIndex(nextIndex);
      
      // Execute next step actions immediately if it's a parallel routine step
      const nextStep = activeFlow.steps[nextIndex];
      if (nextStep.type === 'parallel' && nextStep.actions) {
        const newRoutines = nextStep.actions
          .filter(a => a.type === 'routine')
          .map(a => ({ userId: a.userId, routineId: a.routineId }));
        
        setActiveRoutines(prev => [...prev, ...newRoutines]);
      }
    } else {
      // Flow Complete
      setActiveFlow(null);
      setCurrentStepIndex(0);
    }
  };

  const handleRoutineExit = (userId: string) => {
    setActiveRoutines(prev => prev.filter(r => r.userId !== userId));
  };

  const handleRoutineComplete = (userId: string) => {
    handleRoutineExit(userId);
  };

  // Determine View Mode
  const activeCount = activeRoutines.length;
  const viewMode = activeCount === 0 ? 'IDLE' : activeCount === 1 ? 'SINGLE' : activeCount === 2 ? 'DUAL' : 'GRID';

  const currentStep = activeFlow?.steps[currentStepIndex];

  return (
    <div className="dashboard">
      {!hasInteracted && (
        <div className="interaction-overlay" onClick={() => setHasInteracted(true)}>
          <div className="start-btn">Click to Start</div>
        </div>
      )}

      <AnimatePresence>
        {activeFlow && currentStep?.type === 'alarm' && (
          <GlobalAlarm onDismiss={handleStepComplete} />
        )}
      </AnimatePresence>

      {/* Background Animation */}
      <div className="bg-gradient" />

      {/* Main Stage */}
      <div className={`stage ${viewMode.toLowerCase()}`}>
        <AnimatePresence>
          {activeCount === 0 && (
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
                onComplete={() => handleRoutineComplete(ar.userId)}
                onExit={() => handleRoutineExit(ar.userId)}
              />
            </motion.div>
          );
        })}
      </div>

      {/* Dock (Inactive Users) */}
      {activeCount === 0 && (
        <motion.div 
          className="dock"
          initial={{ y: 100 }}
          animate={{ y: 0 }}
        >
          {users.map(user => (
            <motion.div 
              key={user.id}
              className="dock-item"
              whileHover={{ scale: 1.1, y: -10 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                // Trigger the user's first routine assignment
                const firstRoutine = user.routines[0];
                if (firstRoutine) {
                  api.pushNow(firstRoutine.id).catch(err => console.error('Push failed:', err));
                }
              }}
            >
              <div className="dock-avatar" style={{ background: user.color }}>
                {user.avatar}
              </div>
              <span className="dock-name">{user.name}</span>
            </motion.div>
          ))}
        </motion.div>
      )}

      <style>{`
        .dashboard {
          height: 100vh;
          width: 100vw;
          overflow: hidden;
          position: relative;
          display: flex;
          flex-direction: column;
          color: white;
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
          text-transform: uppercase;
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

        .dock {
          height: 120px;
          background: rgba(255,255,255,0.1);
          backdrop-filter: blur(20px);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 3rem;
          padding-bottom: 1rem;
        }

        .dock-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
        }

        .dock-avatar {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        }

        .dock-name {
          font-size: 1rem;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
};
