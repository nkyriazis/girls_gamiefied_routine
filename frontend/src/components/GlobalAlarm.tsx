import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAppSounds } from '../hooks/useAppSounds';

interface GlobalAlarmProps {
  onDismiss: () => void;
}

export const GlobalAlarm: React.FC<GlobalAlarmProps> = ({ onDismiss }) => {
  const { playWakeUpLoop, stopWakeUpLoop, playClick } = useAppSounds();

  useEffect(() => {
    playWakeUpLoop();
    return () => stopWakeUpLoop();
  }, [playWakeUpLoop, stopWakeUpLoop]);

  const handleDismiss = () => {
    playClick();
    onDismiss();
  };

  return (
    <motion.div 
      className="global-alarm-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div 
        className="alarm-content"
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", bounce: 0.5 }}
      >
        <motion.div 
          className="alarm-icon"
          animate={{ 
            rotate: [0, -10, 10, -10, 10, 0],
            scale: [1, 1.1, 1, 1.1, 1]
          }}
          transition={{ repeat: Infinity, duration: 1 }}
        >
          ⏰
        </motion.div>
        
        <h1>Ώρα για ξύπνημα!</h1>
        <p>Καλημέρα κορίτσια! ☀️</p>

        <button className="btn-dismiss-global" onClick={handleDismiss}>
          Ξυπνήσαμε!
        </button>
      </motion.div>

      <style>{`
        .global-alarm-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0,0,0,0.9);
          backdrop-filter: blur(10px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .alarm-content {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2rem;
        }

        .alarm-icon {
          font-size: 10rem;
          filter: drop-shadow(0 0 30px gold);
        }

        h1 {
          font-size: 5rem;
          margin: 0;
          text-shadow: 0 0 20px rgba(255,255,255,0.5);
        }

        p {
          font-size: 2rem;
          opacity: 0.8;
        }

        .btn-dismiss-global {
          background: linear-gradient(45deg, #ff0055, #ff5500);
          color: white;
          font-size: 2.5rem;
          padding: 1.5rem 5rem;
          border-radius: 3rem;
          font-weight: 900;
          border: none;
          box-shadow: 0 0 50px rgba(255, 0, 85, 0.5);
          cursor: pointer;
          transition: transform 0.1s;
          margin-top: 2rem;
        }

        .btn-dismiss-global:active {
          transform: scale(0.95);
        }
      `}</style>
    </motion.div>
  );
};
