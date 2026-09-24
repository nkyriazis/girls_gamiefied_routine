import { useState } from 'react';
import { api } from '../../../api';
import { useGame } from '../../../context/GameContext';
import { JsonEditor } from './JsonEditor';
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

const dataSchema = () => api.getSchema('data');
const stateSchema = () => api.getSchema('state');

// Rare admin work: raw JSON for everything the forms don't cover, files, the log.
// Loaded on demand, so the everyday views don't download the code editor.
export default function AdvancedView() {
    const { config } = useGame();
    const [panel, setPanel] = useState<Panel>('config');

    return (
        <section className="p-section p-advanced">
            <div className="p-chips" role="tablist">
                {PANELS.map(p => (
                    <button key={p.id} type="button" role="tab" aria-selected={panel === p.id}
                        className={panel === p.id ? 'p-chip on' : 'p-chip'} onClick={() => setPanel(p.id)}>{p.label}</button>
                ))}
            </div>
            {panel === 'config' && <JsonEditor key="config" initial={config} save={api.saveRawConfig} schema={dataSchema} validate={api.validateConfig} />}
            {panel === 'exercises' && <JsonEditor key="exercises" load={api.getRawExercises} save={api.saveRawExercises} schema={api.getExerciseSchema} />}
            {panel === 'state' && <JsonEditor key="state" load={api.getRawState} save={api.saveRawState} schema={stateSchema} validate={api.validateState}
                warning="Αντικαθιστά όλη την κατάσταση: αστέρια, ιστορικό και ό,τι τρέχει τώρα. Για αλλαγές αστεριών χρησιμοποίησε την καρτέλα Σήμερα." />}
            {panel === 'uploads' && <UploadsPanel />}
            {panel === 'log' && <LogPanel />}
        </section>
    );
}
