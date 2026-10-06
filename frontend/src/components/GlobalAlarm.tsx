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
    dismissText = 'Εντάξει!'
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
                {/* The kid's colour rings the avatar; the name is white on a dark plate, readable on the orange */}
                <div className="alarm-user-badge" style={{ background: user.color, borderColor: user.color }}>
                  <SmartIcon value={user.avatar} size={96} style={{ width: '100%', height: '100%', fontSize: 'inherit' }} />
                </div>
                <p className="user-name">{user.name}</p>
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

        /* A short card (a phone with three items): the icon gives way to the words and the OK */
        @container (max-height: 300px) {
          .alarm-icon { font-size: 14cqmin; }
        }

        .global-alarm-container h1 {
          font-size: max(1.5rem, 8cqmin);
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
          border: 4px solid; /* the kid's colour (inline) */
          box-shadow: 0 0 0 3px white, 0 4px 20px rgba(0, 0, 0, 0.3);
          font-size: 12cqmin; /* an emoji avatar, sized with its badge */
        }

        .alarm-users.several .alarm-user-badge {
          width: 15cqmin;
          height: 15cqmin;
        }

        /* White on a dark plate: at least 4.5:1 against every part of the orange gradient.
           Scoped to the card (this style is global) and the size it had: the card's p rule won before. */
        .global-alarm-container .user-name {
          font-size: max(1rem, 5cqmin);
          font-weight: 900;
          margin: 0;
          color: white;
          opacity: 1;
          background: rgba(20, 10, 40, 0.75);
          padding: 0.1em 0.6em;
          border-radius: 1em;
        }

        .global-alarm-container p {
          font-size: max(1rem, 5cqmin);
          opacity: 0.9;
          margin: 0;
        }

        .btn-dismiss-global {
          background: rgba(255, 255, 255, 0.95);
          color: #ff0055;
          /* Sized with its card, but never too small for a finger (48 px tall at least) */
          font-size: max(1.25rem, 5cqmin);
          padding: max(0.75rem, 2cqmin) max(2rem, 6cqmin);
          min-height: 48px;
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
