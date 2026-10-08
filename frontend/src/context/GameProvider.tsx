import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { AppState, ServerMessage } from '@shared/types';
import { GameContext, type EventListener } from './GameContext';

// The server is the source of truth. It sends the whole AppState on connect and
// after every change; we replace ours with it. Reconnecting (after a network
// drop or a server restart) needs nothing extra: the server sends the state on
// connect. Events are one-off effects, delivered to listeners added with
// subscribe().

const RECONNECT_DELAY_MS = 3000;
// The server sends at least a heartbeat every 10 s. Silence for longer means
// the link is dead (e.g. Wi-Fi dropped without closing the socket): reconnect.
const STALE_MS = 25000;

const EMPTY_STATE: AppState = {
    config: {
        users: [], tasks: [], routines: [], routineTasks: [], routineAssignments: [],
        flows: [], schedules: [], rewards: [], chores: [], settings: { timezone: 'Europe/Athens' }
    },
    configVersion: { data: '', exercises: '' },
    configError: null,
    configWarnings: [],
    users: [],
    spendings: [],
    starTransfers: [],
    choreInstances: [],
    exerciseSessions: [],
    exerciseAssignments: [],
    flowRuns: [],
    routineRuns: [],
    helpSeen: []
};

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, setState] = useState<AppState>(EMPTY_STATE);
    const [isConnected, setIsConnected] = useState(false);
    const [hasState, setHasState] = useState(false);
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

        let staleTimer: ReturnType<typeof setTimeout> | undefined;

        const connect = () => {
            socket = new WebSocket(url);
            const lost = () => {
                clearTimeout(staleTimer);
                socket.onclose = null;
                socket.close();
                setIsConnected(false);
                if (!stopped) reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
            };
            const alive = () => {
                clearTimeout(staleTimer);
                staleTimer = setTimeout(lost, STALE_MS);
            };
            socket.onopen = () => {
                setIsConnected(true);
                alive();
            };
            socket.onclose = lost;
            socket.onmessage = ({ data }) => {
                alive();
                const message: ServerMessage = JSON.parse(data);
                if (message.type === 'STATE') {
                    setState(message.payload);
                    setHasState(true);
                } else if (message.type !== 'HEARTBEAT') {
                    listeners.current.forEach(listener => listener(message));
                }
            };
        };
        connect();

        return () => {
            stopped = true;
            clearTimeout(reconnectTimer);
            clearTimeout(staleTimer);
            socket.onclose = null;
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
            hasState,
            subscribe
        }}>
            {children}
        </GameContext.Provider>
    );
};
