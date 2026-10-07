import { createContext, useContext } from 'react';
import type { AppState, Chore, Flow, Reward, ServerEvent } from '@shared/types';

// What every screen reads with useGame(): the server's AppState, kept by <GameProvider>
// (GameProvider.tsx). The hook lives apart from the component so Fast Refresh can
// reload the provider (react-refresh/only-export-components).

export type EventListener = (event: ServerEvent) => void;

export interface GameState extends AppState {
    flows: Flow[];
    rewards: Reward[];
    chores: Chore[];
    isConnected: boolean;
    // The first STATE has arrived. Until then the state is EMPTY_STATE, which no
    // screen may save back: a config editor or form must wait for this.
    hasState: boolean;
    subscribe: (listener: EventListener) => () => void; // returns unsubscribe
}

export const GameContext = createContext<GameState | undefined>(undefined);

export const useGame = () => {
    const context = useContext(GameContext);
    if (!context) {
        throw new Error('useGame must be used within a GameProvider');
    }
    return context;
};
