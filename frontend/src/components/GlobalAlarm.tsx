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
            {typeof user.avatar === 'string' ? (
              <div className="user-avatar-emoji">{user.avatar}</div>
            ) : user.avatar.type === 'emoji' ? (
              <div className="user-avatar-emoji">{user.avatar.value}</div>
            ) : user.avatar.type === 'image' ? (
              <img src={`/uploads/${user.avatar.value}`} alt={user.name} className="user-avatar-img" />
            ) : null}
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
          container-type: size;
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
          justify-content: center;
          gap: 2cqmin;
          padding: 4cqmin;
          width: 100%;
          height: 100%;
        }

        .alarm-icon {
          font-size: 20cqmin;
          filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.8));
          line-height: 1;
        }

        .global-alarm-container h1 {
          font-size: 8cqmin;
          margin: 0;
          text-shadow: 0 0 20px rgba(0, 0, 0, 0.3);
          font-weight: 900;
          line-height: 1.2;
        }

        .alarm-user-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1cqmin;
        }

        .user-avatar-emoji {
          font-size: 18cqmin;
          filter: drop-shadow(0 0 15px rgba(255, 255, 255, 0.8));
          line-height: 1;
        }

        .user-avatar-img {
          width: 20cqmin;
          height: 20cqmin;
          border-radius: 50%;
          object-fit: cover;
          border: 4px solid white;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .user-name {
          font-size: 6cqmin;
          font-weight: 900;
          margin: 0;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
        }

        .global-alarm-container p {
          font-size: 5cqmin;
          opacity: 0.9;
          margin: 0;
        }

        .btn-dismiss-global {
          background: rgba(255, 255, 255, 0.95);
          color: #ff0055;
          font-size: 5cqmin;
          padding: 2cqmin 6cqmin;
          border-radius: 100px;
          font-weight: 900;
          border: none;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 1cqmin;
        }

        .btn-dismiss-global:hover {
          transform: scale(1.05);
          box-shadow: 0 6px 30px rgba(0, 0, 0, 0.4);
        }

        .btn-dismiss-global:active {
          transform: scale(0.95);
        }
      `}</style>
    </div>
  );
};
