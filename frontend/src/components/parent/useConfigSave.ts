import { useCallback } from 'react';
import type { DataConfig } from '@shared/types';
import { api } from '../../api';
import { useGame } from '../../context/GameContext';
import { useFeedback } from './useFeedback';

// Saves one list of the live config (data.json). The server validates it
// against the schema and every client gets the new config in the next STATE.
// While data.json on disk is invalid the forms don't save: the live config is
// then the last valid one (or, after a start with a broken file, an empty
// fallback), and saving it would silently replace the file being fixed.
export function useConfigSave() {
    const { config, configError } = useGame();
    const { run, notify } = useFeedback();
    return useCallback(async <K extends keyof DataConfig>(key: K, value: DataConfig[K], done = 'Αποθηκεύτηκε') => {
        if (configError) {
            notify('Το data.json δεν είναι έγκυρο. Διόρθωσέ το πρώτα (Προχωρημένα).', 'error');
            return false;
        }
        return run(() => api.saveConfig({ ...config, [key]: value }), done);
    }, [config, configError, run, notify]);
}
