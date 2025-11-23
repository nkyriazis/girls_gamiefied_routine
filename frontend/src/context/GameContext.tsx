import React, { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from 'react';
import type { User, Flow, Reward, Spending } from '@shared/types';
import { api } from '../api';

interface GameState {
    users: User[];
    flows: Flow[];
    rewards: Reward[];
    spendings: Spending[];
    isConnected: boolean;
    lastEvent: GameEvent | null;
    refreshData: () => Promise<void>;
}

interface GameEvent {
    type: string;
    payload?: any;
    timestamp: number;
}

const GameContext = createContext<GameState | undefined>(undefined);

export const useGame = () => {
    const context = useContext(GameContext);
    if (!context) {
        throw new Error('useGame must be used within a GameProvider');
    }
    return context;
};

interface GameProviderProps {
    children: ReactNode;
}

export const GameProvider: React.FC<GameProviderProps> = ({ children }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [flows, setFlows] = useState<Flow[]>([]);
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [spendings, setSpendings] = useState<Spending[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [lastEvent, setLastEvent] = useState<GameEvent | null>(null);

    const refreshData = useCallback(async () => {
        try {
            const [usersData, flowsData, rewardsData, spendingsData] = await Promise.all([
                api.getUsers(),
                api.getFlows(),
                api.getRewards(),
                api.getSpendings()
            ]);
            setUsers(usersData);
            setFlows(flowsData);
            setRewards(rewardsData);
            setSpendings(spendingsData);
        } catch (error) {
            console.error('Failed to fetch data:', error);
        }
    }, []);

    // Initial Fetch
    useEffect(() => {
        refreshData();
    }, [refreshData]);

    // WebSocket Connection
    useEffect(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        let websocket: WebSocket;
        let reconnectTimer: ReturnType<typeof setTimeout>;

        const connect = () => {
            websocket = new WebSocket(wsUrl);

            websocket.onopen = () => {
                console.log('WebSocket connected');
                setIsConnected(true);
            };

            websocket.onclose = () => {
                console.log('WebSocket disconnected');
                setIsConnected(false);
                // Try to reconnect in 3 seconds
                reconnectTimer = setTimeout(connect, 3000);
            };

            websocket.onerror = (err) => {
                console.error('WebSocket error:', err);
                websocket.close();
            };

            websocket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    console.log('WS Message:', message);

                    // Handle Data Sync internally
                    if (message.type === 'SYNC_STATE') {
                        const { userStars, spendings: newSpendings } = message.payload;

                        setUsers(prev => prev.map(u => ({
                            ...u,
                            stars: userStars[u.id] ?? u.stars
                        })));

                        if (newSpendings) {
                            setSpendings(newSpendings);
                        }
                    } else if (message.type === 'STARS_AWARDED') {
                        const { userId, totalStars } = message.payload;
                        setUsers(prev => prev.map(u => u.id === userId ? { ...u, stars: totalStars } : u));
                    } else if (message.type === 'CONFIG_UPDATED') {
                        console.log('Config updated, reloading...');
                        refreshData();
                    } else if (message.type === 'CONFIG_ERROR') {
                        console.error('Config validation error:', message.payload);
                        // Error will be passed to subscribers via lastEvent
                    } else if (message.type === 'STATE_ERROR') {
                        console.error('State validation error:', message.payload);
                        // Error will be passed to subscribers via lastEvent
                    }

                    // Pass all events to subscribers via lastEvent
                    // We add a timestamp to ensure even identical events trigger effects
                    setLastEvent({ ...message, timestamp: Date.now() });

                } catch (err) {
                    console.error('Error parsing WS message:', err);
                }
            };
        };

        connect();

        return () => {
            if (websocket) websocket.close();
            if (reconnectTimer) clearTimeout(reconnectTimer);
        };
    }, [refreshData]);

    return (
        <GameContext.Provider value={{
            users,
            flows,
            rewards,
            spendings,
            isConnected,
            lastEvent,
            refreshData
        }}>
            {children}
        </GameContext.Provider>
    );
};
