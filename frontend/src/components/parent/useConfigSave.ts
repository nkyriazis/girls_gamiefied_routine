import { useCallback } from 'react';
import type { DataConfig } from '@shared/types';
import { api, ApiError } from '../../api';
import { useGame } from '../../context/GameContext';
import { useFeedback } from './useFeedback';

/** How a form's save went: saved, refused because the config changed since the form read it, or refused otherwise. */
export type SaveOutcome = 'saved' | 'stale' | 'refused';

export interface SaveOptions {
    done?: string; // the toast when it saved
    // The version the form edited: the one its sheet opened with. Default: the live one, which
    // belongs to the `config` this spreads (both come from the same STATE).
    version?: string;
    stale?: string; // the toast when another save came first (409)
}

const STALE = 'Οι ρυθμίσεις άλλαξαν στο μεταξύ από άλλη οθόνη. Δες τις τρέχουσες τιμές και κάνε την αλλαγή σου πάλι.';

// Saves one list of the live config (data.json). The server validates it
// against the schema and every client gets the new config in the next STATE.
// While data.json on disk is invalid the forms don't save: the live config is
// then the last valid one (or, after a start with a broken file, an empty
// fallback), and saving it would silently replace the file being fixed. The
// server refuses such a save too (ConfigFile.save); this says why, in Greek.
// Nor before the first state has arrived: the config is then the empty one,
// and one list saved into it would wipe the rest.
// Each save names the version of data.json the form edited (#33): if another
// screen saved since, the server answers 409 and writes nothing, so the form
// shows the current values instead of putting its old ones over that save.
export function useConfigSave() {
    const { config, configVersion, configError, hasState } = useGame();
    const { notify } = useFeedback();
    return useCallback(async <K extends keyof DataConfig>(key: K, value: DataConfig[K], options: SaveOptions = {}): Promise<SaveOutcome> => {
        if (!hasState) {
            notify('Οι ρυθμίσεις δεν έχουν φορτώσει ακόμα. Περίμενε λίγο και ξαναδοκίμασε.', 'error');
            return 'refused';
        }
        if (configError?.file === 'data.json') {
            notify('Το data.json δεν είναι έγκυρο. Διόρθωσέ το πρώτα (Προχωρημένα).', 'error');
            return 'refused';
        }
        try {
            await api.saveConfig({ ...config, [key]: value }, options.version ?? configVersion.data);
            notify(options.done ?? 'Αποθηκεύτηκε');
            return 'saved';
        } catch (err) {
            const stale = err instanceof ApiError && err.status === 409;
            notify(stale ? options.stale ?? STALE : (err as Error).message, 'error');
            return stale ? 'stale' : 'refused';
        }
    }, [config, configVersion, configError, hasState, notify]);
}
