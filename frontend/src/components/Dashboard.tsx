import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { motion, LayoutGroup } from 'framer-motion';
import { MOCK_USERS } from '../data/mockData';
import { InlineRoutinePlayer } from './InlineRoutinePlayer';

interface ActiveRoutine {
  userId: string;
  routineId: string;
}

export const Dashboard: React.FC = () => {
  const [time, setTime] = useState(new Date());
  const [activeRoutines, setActiveRoutines] = useState<ActiveRoutine[]>([]);

  // Main Clock & Auto-Trigger Logic
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTime(now);

      const currentTimeStr = format(now, 'HH:mm');
      
      setActiveRoutines(prev => {
        const newRoutines = [...prev];
        let changed = false;

        MOCK_USERS.forEach(user => {
          user.routines.forEach(routine => {
            if (routine.scheduleTime === currentTimeStr) {
              // Check if already active
              if (!newRoutines.find(ar => ar.userId === user.id && ar.routineId === routine.id)) {
                 // For simplicity: If user is NOT in activeRoutines, add them.
                 if (!newRoutines.find(ar => ar.userId === user.id)) {
                   newRoutines.push({ userId: user.id, routineId: routine.id });
                   changed = true;
                 }
              }
            }
          });
        });
        
        return changed ? newRoutines : prev;
      });

    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // TESTING ONLY: Trigger Morning Routine after 3 seconds
  useEffect(() => {
    const timeout = setTimeout(() => {
      const now = new Date();
      const currentTimeStr = format(now, 'HH:mm');
      console.log('⚡ SIMULATING SCHEDULE MATCH for', currentTimeStr);
      
      // Mutate mock data for testing
      const elektra = MOCK_USERS.find(u => u.name === 'Ηλέκτρα');
      const morning = elektra?.routines.find(r => r.title === 'Πρωινή Ρουτίνα');
      if (morning) {
        morning.scheduleTime = currentTimeStr;
      }
    }, 3000);
    return () => clearTimeout(timeout);
  }, []);

  const startRoutine = (userId: string, routineId: string) => {
    setActiveRoutines(prev => {
      if (!prev.find(ar => ar.userId === userId)) {
        return [...prev, { userId, routineId }];
      }
      return prev;
    });
  };

  const endRoutine = (userId: string) => {
    setActiveRoutines(prev => prev.filter(ar => ar.userId !== userId));
  };

  // Grid Logic
  const activeCount = activeRoutines.length;
  const gridClass = activeCount === 0 ? 'idle' : activeCount === 1 ? 'single' : activeCount === 2 ? 'dual' : 'grid';

  return (
    <div className={`dashboard-container ${gridClass}`}>
      <LayoutGroup>
        {/* Header / Clock Area */}
        <motion.header 
          layout
          className="dashboard-header"
        >
          <motion.h1 layout className="clock">{format(time, 'h:mm a')}</motion.h1>
          <motion.p layout className="date">{format(time, 'EEEE, d MMMM', { locale: el })}</motion.p>
        </motion.header>

        {/* Active Stage (The Grid) */}
        <div className="stage-area">
          {activeRoutines.map(ar => (
            <motion.div 
              layout
              key={ar.userId}
              className="stage-lane"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <InlineRoutinePlayer 
                userId={ar.userId}
                routineId={ar.routineId}
                onComplete={() => endRoutine(ar.userId)}
                onExit={() => endRoutine(ar.userId)}
              />
            </motion.div>
          ))}
        </div>

        {/* Inactive Dock */}
        <motion.div layout className="dock-area">
          {MOCK_USERS.filter(u => !activeRoutines.find(ar => ar.userId === u.id)).map(user => (
            <motion.div 
              layout
              key={user.id}
              className="dock-card"
              style={{ borderColor: user.color }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="dock-avatar" style={{ background: user.color }}>{user.avatar}</div>
              <div className="dock-info">
                <h3>{user.name}</h3>
                <div className="dock-routines">
                  {user.routines.map(r => (
                    <button 
                      key={r.id}
                      className="btn-start-routine"
                      onClick={() => startRoutine(user.id, r.id)}
                      style={{ '--hover-color': user.color } as React.CSSProperties}
                    >
                      {r.title}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </LayoutGroup>

      <style>{`
        .dashboard-container {
          height: 100vh;
          display: flex;
          flex-direction: column;
          padding: 1rem;
          overflow: hidden;
          transition: all 0.5s ease;
        }

        /* Layout States */
        .dashboard-container.idle .dashboard-header {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }
        .dashboard-container.idle .clock { font-size: 8rem; }
        
        .dashboard-container:not(.idle) .dashboard-header {
          flex: 0 0 auto;
          flex-direction: row;
          justify-content: space-between;
          padding: 0 2rem;
        }
        .dashboard-container:not(.idle) .clock { font-size: 2rem; }
        .dashboard-container:not(.idle) .date { font-size: 1rem; }

        /* Stage Area */
        .stage-area {
          flex: 1;
          display: grid;
          gap: 1rem;
          padding: 1rem 0;
          min-height: 0; /* Fix flex overflow */
        }

        .dashboard-container.single .stage-area { grid-template-columns: 1fr; }
        .dashboard-container.dual .stage-area { grid-template-columns: 1fr 1fr; }
        .dashboard-container.grid .stage-area { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }

        .stage-lane {
          height: 100%;
          width: 100%;
          min-height: 0;
        }

        /* Dock Area */
        .dock-area {
          flex: 0 0 auto;
          display: flex;
          gap: 1rem;
          justify-content: center;
          padding-top: 1rem;
          border-top: 1px solid var(--glass-border);
        }

        .dock-card {
          background: var(--glass-bg);
          backdrop-filter: blur(10px);
          border: 1px solid var(--glass-border);
          border-radius: 1.5rem;
          padding: 1rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          width: 300px;
        }

        .dock-avatar {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
        }

        .dock-info h3 { margin-bottom: 0.5rem; }

        .dock-routines {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .btn-start-routine {
          background: rgba(255,255,255,0.1);
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
          font-size: 0.8rem;
          transition: background 0.2s;
        }

        .btn-start-routine:hover {
          background: var(--hover-color);
          color: black;
        }
      `}</style>
    </div>
  );
};
