import React from 'react';
import { motion } from 'framer-motion';
import { help } from '../help/anchors';
import { SmartIcon } from './SmartIcon';
import { type User, type AlarmProps } from '@shared/types';

interface GlobalAlarmProps {
  flowId: string;
  users: User[]; // the kids it is for (none: everyone)
  alarmProps?: AlarmProps;
  onDismiss: (flowId: string) => void;
}

export const GlobalAlarm: React.FC<GlobalAlarmProps> = ({ flowId, users, alarmProps = {}, onDismiss }) => {
  const {
    title = 'Ειδοποίηση',
    message,
    icon = '🔔',
    dismissText = 'OK'
  } = alarmProps;

  const handleDismiss = () => {
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
          {icon}
        </motion.div>

        <h1>{title}</h1>
        {users.length > 0 && (
          <div className={`alarm-users${users.length > 1 ? ' several' : ''}`}>
            {users.map(user => (
              <div key={user.id} className="alarm-user-info">
                <div className="alarm-user-badge" style={{ background: user.color }}>
                  <SmartIcon value={user.avatar} size={96} style={{ width: '100%', height: '100%' }} />
                </div>
                <p className="user-name" style={{ color: user.color }}>{user.name}</p>
              </div>
            ))}
          </div>
        )}
        {message && <p>{message}</p>}

        <button className="btn-dismiss-global" {...help('alarm.dismiss')} onClick={handleDismiss}>
          {dismissText}
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

        .alarm-users {
          display: flex;
          justify-content: center;
          gap: 5cqmin;
        }

        .alarm-user-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1cqmin;
        }

        .alarm-user-badge {
          width: 20cqmin;
          height: 20cqmin;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border: 4px solid white;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .alarm-users.several .alarm-user-badge {
          width: 15cqmin;
          height: 15cqmin;
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
