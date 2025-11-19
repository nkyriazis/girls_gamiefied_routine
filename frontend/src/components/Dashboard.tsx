import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { MOCK_USERS } from '../data/mockData';
import { MOCK_FLOWS, type Flow } from '../data/flows';
import { InlineRoutinePlayer } from './InlineRoutinePlayer';
import { GlobalAlarm } from './GlobalAlarm';

export const Dashboard: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Flow State
  const [activeFlow, setActiveFlow] = useState<Flow | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  
  // Active Routines (triggered by flow)
  const [activeRoutines, setActiveRoutines] = useState<{userId: string, routineId: string}[]>([]);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Flow Trigger Logic (Test Mode: Trigger after 3s)
  useEffect(() => {
    const timeout = setTimeout(() => {
      // Trigger Morning Flow
      const flow = MOCK_FLOWS.find(f => f.id === 'morning-flow');
      if (flow) {
        setActiveFlow(flow);
        setCurrentStepIndex(0);
      }
    }, 3000);
    return () => clearTimeout(timeout);
  }, []);

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
        {activeRoutines.map((ar) => (
          <motion.div 
            key={`${ar.userId}-${ar.routineId}`}
            className="routine-slot"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", bounce: 0.3 }}
          >
            <InlineRoutinePlayer 
              userId={ar.userId}
              routineId={ar.routineId}
              onComplete={() => handleRoutineComplete(ar.userId)}
              onExit={() => handleRoutineExit(ar.userId)}
            />
          </motion.div>
        ))}
      </div>

      {/* Dock (Inactive Users) */}
      {activeCount === 0 && (
        <motion.div 
          className="dock"
          initial={{ y: 100 }}
          animate={{ y: 0 }}
        >
          {MOCK_USERS.map(user => (
            <motion.div 
              key={user.id}
              className="dock-item"
              whileHover={{ scale: 1.1, y: -10 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                // Manual trigger (optional, for now just logs)
                console.log('Manual trigger for', user.name);
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
