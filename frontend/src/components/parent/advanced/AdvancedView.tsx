import { useState } from 'react';
import { api } from '../../../api';
import { useGame } from '../../../context/GameContext';
import type { SchemaFile } from './JsonEditor'; // a type only: `import { type … }` would load the module
import { LazyJsonEditor } from './LazyJsonEditor';
import { LogPanel } from './LogPanel';
import { UploadsPanel } from './UploadsPanel';

const PANELS = [
    { id: 'config', label: 'Ρυθμίσεις (JSON)' },
    { id: 'exercises', label: 'Ασκήσεις (JSON)' },
    { id: 'state', label: 'Κατάσταση (JSON)' },
    { id: 'uploads', label: 'Αρχεία' },
    { id: 'log', label: 'Καταγραφή' },
] as const;
type Panel = typeof PANELS[number]['id'];

const dataSchemas = () => api.getSchema('data').then((schema): SchemaFile[] => [{ file: 'data.schema.json', schema }]);
const stateSchemas = () => api.getSchema('state').then((schema): SchemaFile[] => [{ file: 'state.schema.json', schema }]);
// exercises.schema.json takes the icon's definition from data.schema.json: Monaco needs both
const exerciseSchemas = () => Promise.all([api.getExerciseSchema(), api.getSchema('data')])
    .then(([exercises, data]): SchemaFile[] => [{ file: 'exercises.schema.json', schema: exercises }, { file: 'data.schema.json', schema: data }]);

// Fixing a file that doesn't parse: no live version it was edited from
const saveConfigFix = (data: unknown) => api.saveRawConfig(data, undefined, 'advanced-fix');
const saveExercisesFix = (data: unknown) => api.saveRawExercises(data, undefined, 'advanced-fix');

const STALE_CONFIG = 'Οι ρυθμίσεις άλλαξαν στο μεταξύ (από άλλη οθόνη ή στον δίσκο). Φόρτωσε ξανά: οι αλλαγές σου εδώ θα χαθούν.';
// The state has no live version on screen (hashing the whole history per STATE would cost too much): the
// banner shows when the server refuses a save as stale (409, #98)
const STALE_STATE = 'Η κατάσταση άλλαξε στο μεταξύ (αστέρια, δουλειές, ρουτίνες…). Φόρτωσε ξανά: οι αλλαγές σου εδώ θα χαθούν.';
const STALE_EXERCISES = 'Οι ασκήσεις άλλαξαν στο μεταξύ (από άλλη οθόνη ή στον δίσκο). Φόρτωσε ξανά: οι αλλαγές σου εδώ θα χαθούν.';

// Rare admin work: raw JSON for everything the forms don't cover, files, the log.
// Loaded on demand, so the everyday views don't download the code editor; the JSON panels load
// Monaco only when one opens (LazyJsonEditor), so Αρχεία and Καταγραφή don't either.
export default function AdvancedView() {
    const { config, configVersion, configError, hasState } = useGame();
    const [panel, setPanel] = useState<Panel>('config');
    // Φόρτωσε ξανά on a stale editor opens it afresh (a new key remounts it)
    const [opened, setOpened] = useState(0);
    const reopen = () => setOpened(n => n + 1);
    // A file the server couldn't read since the start: the editor holds the file's own text, to fix
    // and save, never the empty config that runs meanwhile (saving that would replace the family's file).
    const unread = (file: string) => configError?.file === file && configError.emptyFallback;
    const fixWarning = (file: string) =>
        `Το ${file} όπως είναι στον δίσκο. Διόρθωσε το λάθος που δείχνει το μήνυμα πάνω και πάτα Αποθήκευση. ` +
        `Το χαλασμένο αρχείο κρατιέται δίπλα ως ${file}.invalid-….`;

    return (
        <section className="p-section p-advanced">
            <div className="p-chips" role="tablist">
                {PANELS.map(p => (
                    <button key={p.id} type="button" role="tab" aria-selected={panel === p.id}
                        className={panel === p.id ? 'p-chip on' : 'p-chip'} onClick={() => setPanel(p.id)}>{p.label}</button>
                ))}
            </div>
            {/* The config editor reads `initial` once: never mount it before the first state, or it
                holds the empty config, and one Αποθήκευση would write that over the family's file.
                Its version comes from the same STATE as the config, so the two belong together. */}
            {panel === 'config' && !hasState && <p className="p-empty">Φόρτωση…</p>}
            {panel === 'config' && hasState && (unread('data.json')
                ? <LazyJsonEditor key="config-text" loadText={api.getConfigText} save={saveConfigFix} schemas={dataSchemas} validate={api.validateConfig} warning={fixWarning('data.json')} />
                : <LazyJsonEditor key={`config-${opened}`} initial={{ data: config, version: configVersion.data }} save={api.saveRawConfig}
                    live={configVersion.data} stale={STALE_CONFIG} onReload={reopen} schemas={dataSchemas} validate={api.validateConfig} />)}
            {panel === 'exercises' && (unread('exercises.json')
                ? <LazyJsonEditor key="exercises-text" loadText={api.getExercisesText} save={saveExercisesFix} schemas={exerciseSchemas} validate={api.validateExercises} warning={fixWarning('exercises.json')} />
                : <LazyJsonEditor key={`exercises-${opened}`} load={api.getRawExercises} save={api.saveRawExercises}
                    live={configVersion.exercises} stale={STALE_EXERCISES} onReload={reopen} schemas={exerciseSchemas} validate={api.validateExercises} />)}
            {panel === 'state' && <LazyJsonEditor key={`state-${opened}`} load={api.getRawState} save={api.saveRawState}
                stale={STALE_STATE} onReload={reopen} schemas={stateSchemas} validate={api.validateState}
                warning="Αντικαθιστά όλη την κατάσταση: αστέρια, ιστορικό και ό,τι τρέχει τώρα. Για αλλαγές αστεριών χρησιμοποίησε την καρτέλα Σήμερα." />}
            {panel === 'uploads' && <UploadsPanel />}
            {panel === 'log' && <LogPanel />}
        </section>
    );
}
