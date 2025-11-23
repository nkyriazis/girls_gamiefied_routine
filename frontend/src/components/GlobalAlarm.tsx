import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAppSounds } from '../hooks/useAppSounds';
import { type User } from '@shared/types';

interface GlobalAlarmProps {
  flowId: string;
  user: User | null;
  onDismiss: (flowId: string) => void;
}

export const GlobalAlarm: React.FC<GlobalAlarmProps> = ({ flowId, user, onDismiss }) => {
  const { playWakeUpLoop, stopWakeUpLoop, playClick } = useAppSounds();

  useEffect(() => {
    playWakeUpLoop();
    return () => stopWakeUpLoop();
  }, [playWakeUpLoop, stopWakeUpLoop]);

  const handleDismiss = () => {
    playClick();
    onDismiss(flowId);
  };

  return (
    <div className="global-alarm-container">
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
        {user && (
          <div className="alarm-user-info">
            {user.avatar.type === 'emoji' ? (
              <div className="user-avatar-emoji">{user.avatar.value}</div>
            ) : (
              <img src={`/uploads/${user.avatar.value}`} alt={user.name} className="user-avatar-img" />
            )}
            <p className="user-name" style={{ color: user.color }}>{user.name}</p>
          </div>
        )}
        <p>Καλημέρα! ☀️</p>

        <button className="btn-dismiss-global" onClick={handleDismiss}>
          Ξυπνήσαμε!
        </button>
      </motion.div>

      <style>{`
        .global-alarm-container {
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #ff0055, #ff5500, #ffa500);
          border-radius: 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 0 40px rgba(255, 0, 85, 0.6);
          animation: pulse-glow 2s infinite;
        }

        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 40px rgba(255, 0, 85, 0.6); }
          50% { box-shadow: 0 0 80px rgba(255, 0, 85, 0.9); }
        }

        .alarm-content {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
          padding: 2rem;
        }

        .alarm-icon {
          font-size: 8rem;
          filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.8));
        }

        .global-alarm-container h1 {
          font-size: 3.5rem;
          margin: 0;
          text-shadow: 0 0 20px rgba(0, 0, 0, 0.3);
          font-weight: 900;
        }

        .alarm-user-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .user-avatar-emoji {
          font-size: 6rem;
          filter: drop-shadow(0 0 15px rgba(255, 255, 255, 0.8));
        }

        .user-avatar-img {
          width: 8rem;
          height: 8rem;
          border-radius: 50%;
          object-fit: cover;
          border: 4px solid white;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .user-name {
          font-size: 2.5rem;
          font-weight: 900;
          margin: 0;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
        }

        .global-alarm-container p {
          font-size: 1.8rem;
          opacity: 0.9;
          margin: 0;
        }

        .btn-dismiss-global {
          background: rgba(255, 255, 255, 0.95);
          color: #ff0055;
          font-size: 2rem;
          padding: 1.2rem 3.5rem;
          border-radius: 2.5rem;
          font-weight: 900;
          border: none;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 1rem;
        }

        .btn-dismiss-global:hover {
          transform: scale(1.05);
          box-shadow: 0 6px 30px rgba(0, 0, 0, 0.4);
        }

        .btn-dismiss-global:active {
          transform: scale(0.95);
        }

        @media (max-width: 768px) {
          .alarm-icon {
            font-size: 5rem;
          }
          .global-alarm-container h1 {
            font-size: 2.5rem;
          }
          .global-alarm-container p {
            font-size: 1.3rem;
          }
          .btn-dismiss-global {
            font-size: 1.5rem;
            padding: 1rem 2.5rem;
          }
        }
      `}</style>
    </div>
  );
};
