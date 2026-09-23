import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { AppState, Chore, Flow, Reward, ServerEvent, ServerMessage } from '@shared/types';

// The server is the source of truth. It sends the whole AppState on connect and
// after every change; we replace ours with it. Reconnecting (after a network
// drop or a server restart) needs nothing extra: the server sends the state on
// connect. Events are one-off effects, delivered to listeners added with
// subscribe().

const RECONNECT_DELAY_MS = 3000;

const EMPTY_STATE: AppState = {
    config: {
        users: [], tasks: [], routines: [], routineTasks: [], routineAssignments: [],
        flows: [], schedules: [], rewards: [], chores: [], settings: { timezone: 'Europe/Athens' }
    },
    configError: null,
    users: [],
    spendings: [],
    starTransfers: [],
    choreInstances: [],
    exerciseSessions: [],
    exerciseAssignments: []
};

type EventListener = (event: ServerEvent) => void;

interface GameState extends AppState {
    flows: Flow[];
    rewards: Reward[];
    chores: Chore[];
    isConnected: boolean;
    subscribe: (listener: EventListener) => () => void; // returns unsubscribe
}

const GameContext = createContext<GameState | undefined>(undefined);

export const useGame = () => {
    const context = useContext(GameContext);
    if (!context) {
        throw new Error('useGame must be used within a GameProvider');
    }
    return context;
};

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, setState] = useState<AppState>(EMPTY_STATE);
    const [isConnected, setIsConnected] = useState(false);
    const listeners = useRef(new Set<EventListener>());

    const subscribe = useCallback((listener: EventListener) => {
        listeners.current.add(listener);
        return () => { listeners.current.delete(listener); };
    }, []);

    useEffect(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${protocol}//${window.location.host}/ws`;
        let socket: WebSocket;
        let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
        let stopped = false;

        const connect = () => {
            socket = new WebSocket(url);
            socket.onopen = () => setIsConnected(true);
            socket.onclose = () => {
                setIsConnected(false);
                if (!stopped) reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
            };
            socket.onmessage = ({ data }) => {
                const message: ServerMessage = JSON.parse(data);
                if (message.type === 'STATE') {
                    setState(message.payload);
                } else {
                    listeners.current.forEach(listener => listener(message));
                }
            };
        };
        connect();

        return () => {
            stopped = true;
            clearTimeout(reconnectTimer);
            socket.close();
        };
    }, []);

    return (
        <GameContext.Provider value={{
            ...state,
            flows: state.config.flows,
            rewards: state.config.rewards,
            chores: state.config.chores ?? [],
            isConnected,
            subscribe
        }}>
            {children}
        </GameContext.Provider>
    );
};
