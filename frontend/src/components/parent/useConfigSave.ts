import { useCallback } from 'react';
import type { DataConfig } from '@shared/types';
import { api } from '../../api';
import { useGame } from '../../context/GameContext';
import { useFeedback } from './useFeedback';

// Saves one list of the live config (data.json). The server validates it
// against the schema and every client gets the new config in the next STATE.
export function useConfigSave() {
    const { config } = useGame();
    const { run } = useFeedback();
    return useCallback(<K extends keyof DataConfig>(key: K, value: DataConfig[K], done = 'Αποθηκεύτηκε') =>
        run(() => api.saveConfig({ ...config, [key]: value }), done), [config, run]);
}
