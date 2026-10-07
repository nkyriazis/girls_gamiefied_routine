import { useState } from 'react';
import { api } from '../../../api';
import { useGame } from '../../../context/GameContext';
import { JsonEditor, type SchemaFile } from './JsonEditor';
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

// Rare admin work: raw JSON for everything the forms don't cover, files, the log.
// Loaded on demand, so the everyday views don't download the code editor.
export default function AdvancedView() {
    const { config, configError, hasState } = useGame();
    const [panel, setPanel] = useState<Panel>('config');
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
                holds the empty config, and one Αποθήκευση would write that over the family's file. */}
            {panel === 'config' && !hasState && <p className="p-empty">Φόρτωση…</p>}
            {panel === 'config' && hasState && (unread('data.json')
                ? <JsonEditor key="config-text" loadText={api.getConfigText} save={api.saveRawConfig} schemas={dataSchemas} validate={api.validateConfig} warning={fixWarning('data.json')} />
                : <JsonEditor key="config" initial={config} save={api.saveRawConfig} schemas={dataSchemas} validate={api.validateConfig} />)}
            {panel === 'exercises' && (unread('exercises.json')
                ? <JsonEditor key="exercises-text" loadText={api.getExercisesText} save={api.saveRawExercises} schemas={exerciseSchemas} validate={api.validateExercises} warning={fixWarning('exercises.json')} />
                : <JsonEditor key="exercises" load={api.getRawExercises} save={api.saveRawExercises} schemas={exerciseSchemas} validate={api.validateExercises} />)}
            {panel === 'state' && <JsonEditor key="state" load={api.getRawState} save={api.saveRawState} schemas={stateSchemas} validate={api.validateState}
                warning="Αντικαθιστά όλη την κατάσταση: αστέρια, ιστορικό και ό,τι τρέχει τώρα. Για αλλαγές αστεριών χρησιμοποίησε την καρτέλα Σήμερα." />}
            {panel === 'uploads' && <UploadsPanel />}
            {panel === 'log' && <LogPanel />}
        </section>
    );
}
