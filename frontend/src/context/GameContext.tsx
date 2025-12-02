import React, { createContext, useContext, useState, useEffect, useRef, type ReactNode, useCallback } from 'react';
import type { User, Flow, Reward, Spending, StarTransfer, Chore, ChoreInstance } from '@shared/types';
import { api } from '../api';

// Notification for expired chores
export interface ChoreNotification {
    id: string;
    type: 'expired' | 'confirmed' | 'rejected';
    choreTitle: string;
    userId?: string;
    starsAwarded?: number;
    timestamp: number;
}

interface GameState {
    users: User[];
    flows: Flow[];
    rewards: Reward[];
    spendings: Spending[];
    starTransfers: StarTransfer[];
    chores: Chore[];
    choreInstances: ChoreInstance[];
    choreNotifications: ChoreNotification[];
    dismissChoreNotification: (id: string) => void;
    isConnected: boolean;
    lastEvent: GameEvent | null;
    refreshData: () => Promise<void>;
    refreshChores: () => Promise<void>;
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
    const [starTransfers, setStarTransfers] = useState<StarTransfer[]>([]);
    const [chores, setChores] = useState<Chore[]>([]);
    const [choreInstances, setChoreInstances] = useState<ChoreInstance[]>([]);
    const [choreNotifications, setChoreNotifications] = useState<ChoreNotification[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [lastEvent, setLastEvent] = useState<GameEvent | null>(null);

    // Track processed message IDs to prevent duplicate notifications
    const processedMessages = useRef<Set<string>>(new Set());

    const dismissChoreNotification = useCallback((id: string) => {
        setChoreNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const refreshChores = useCallback(async () => {
        try {
            const { chores: choresData, instances } = await api.getChores();
            setChores(choresData);
            setChoreInstances(instances);
        } catch (error) {
            console.error('Failed to fetch chores:', error);
        }
    }, []);

    const refreshData = useCallback(async () => {
        try {
            const [usersData, flowsData, rewardsData, spendingsData, transfersData] = await Promise.all([
                api.getUsers(),
                api.getFlows(),
                api.getRewards(),
                api.getSpendings(),
                api.getTransfers()
            ]);
            setUsers(usersData);
            setFlows(flowsData);
            setRewards(rewardsData);
            setSpendings(spendingsData);
            setStarTransfers(transfersData);

            // Also refresh chores
            await refreshChores();
        } catch (error) {
            console.error('Failed to fetch data:', error);
        }
    }, [refreshChores]);

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
                        const { userStars, spendings: newSpendings, starTransfers: newTransfers, choreInstances: newChoreInstances } = message.payload;

                        setUsers(prev => prev.map(u => ({
                            ...u,
                            stars: userStars[u.id] ?? u.stars
                        })));

                        if (newSpendings) {
                            setSpendings(newSpendings);
                        }

                        if (newTransfers) {
                            setStarTransfers(newTransfers);
                        }

                        if (newChoreInstances) {
                            setChoreInstances(newChoreInstances);
                        }
                    } else if (message.type === 'STARS_AWARDED') {
                        const { userId, totalStars } = message.payload;
                        setUsers(prev => prev.map(u => u.id === userId ? { ...u, stars: totalStars } : u));
                    } else if (message.type === 'CHORE_EXPIRED') {
                        // Add notification for expired chore
                        const { choreTitle, userId, instanceId } = message.payload;
                        const messageKey = `expired-${instanceId || `${choreTitle}-${userId}`}`;

                        // Deduplicate - React StrictMode may cause double invocations
                        if (!processedMessages.current.has(messageKey)) {
                            processedMessages.current.add(messageKey);
                            const notification: ChoreNotification = {
                                id: messageKey,
                                type: 'expired',
                                choreTitle,
                                userId,
                                timestamp: Date.now()
                            };
                            setChoreNotifications(prev => [...prev, notification]);

                            // Auto-dismiss after 5 seconds and clean up dedup set
                            setTimeout(() => {
                                setChoreNotifications(prev => prev.filter(n => n.id !== notification.id));
                                processedMessages.current.delete(messageKey);
                            }, 5000);
                        }
                    } else if (message.type === 'CHORE_CONFIRMED') {
                        const { choreTitle, userId, starsAwarded, instanceId } = message.payload;
                        const messageKey = `confirmed-${instanceId || `${choreTitle}-${userId}`}`;

                        if (!processedMessages.current.has(messageKey)) {
                            processedMessages.current.add(messageKey);
                            const notification: ChoreNotification = {
                                id: messageKey,
                                type: 'confirmed',
                                choreTitle,
                                userId,
                                starsAwarded,
                                timestamp: Date.now()
                            };
                            setChoreNotifications(prev => [...prev, notification]);

                            setTimeout(() => {
                                setChoreNotifications(prev => prev.filter(n => n.id !== notification.id));
                                processedMessages.current.delete(messageKey);
                            }, 5000);
                        }
                    } else if (message.type === 'CHORE_REJECTED') {
                        const { choreTitle, userId, instanceId } = message.payload;
                        const messageKey = `rejected-${instanceId || `${choreTitle}-${userId}`}`;

                        if (!processedMessages.current.has(messageKey)) {
                            processedMessages.current.add(messageKey);
                            const notification: ChoreNotification = {
                                id: messageKey,
                                type: 'rejected',
                                choreTitle,
                                userId,
                                timestamp: Date.now()
                            };
                            setChoreNotifications(prev => [...prev, notification]);

                            setTimeout(() => {
                                setChoreNotifications(prev => prev.filter(n => n.id !== notification.id));
                                processedMessages.current.delete(messageKey);
                            }, 5000);
                        }
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
            starTransfers,
            chores,
            choreInstances,
            choreNotifications,
            dismissChoreNotification,
            isConnected,
            lastEvent,
            refreshData,
            refreshChores
        }}>
            {children}
        </GameContext.Provider>
    );
};
