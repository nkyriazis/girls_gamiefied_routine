import type { ConfigTask } from '@shared/types';
import { useGame } from '../../../context/GameContext';
import { useConfigSave } from '../useConfigSave';
import { CollectionEditor, type FormProps } from './CollectionEditor';
import { newId } from './model';
import { taskIsValid, taskLock, taskUses, taskWarnings, tidyTask } from './routines';
import { IconField, NumberField, TextField } from './fields';

function TaskForm({ value, onChange }: FormProps<ConfigTask>) {
    const { config } = useGame();
    const uses = taskUses(config, value.id);
    return (
        <>
            <TextField label="Όνομα" value={value.title} onChange={title => onChange({ ...value, title })} />
            <IconField value={value.icon} onChange={icon => onChange({ ...value, icon })} />
            <NumberField label="Αστέρια" value={value.stars} min={0} onChange={stars => onChange({ ...value, stars })} />
            <NumberField label="Αστέρια αν αργήσει" value={value.lateStars ?? 0} min={0} onChange={lateStars => onChange({ ...value, lateStars })} />
            <p className="p-hint">Αν την τελειώσει αφού περάσει ο χρόνος της. Τον χρόνο τον ορίζει κάθε ρουτίνα, στις Ρουτίνες.</p>
            {taskWarnings(value).map(w => <p key={w} className="p-hint p-warning">⚠ {w}</p>)}
            {!uses.length && <p className="p-hint">Σε καμία ρουτίνα ακόμα: πρόσθεσέ την σε μία, στις Ρουτίνες.</p>}
        </>
    );
}

// The tasks routines are made of: name, icon, stars on time and late. Their time belongs to each
// routine (routineTasks), so it is in the routine's sheet. A task a routine uses can't be deleted.
export function TasksEditor() {
    const { config } = useGame();
    const save = useConfigSave();
    return (
        <CollectionEditor<ConfigTask> title="Εργασίες" empty="Δεν υπάρχουν εργασίες. Πρόσθεσε μία και βάλ' τη σε μια ρουτίνα." addLabel="Νέα εργασία"
            items={config.tasks} Form={TaskForm}
            create={() => ({ id: newId('task', config.tasks.map(t => t.id)), title: '', icon: { type: 'emoji', value: '📝' }, stars: 10 })}
            row={t => {
                const uses = taskUses(config, t.id);
                return { icon: t.icon, title: t.title, sub: `⭐ ${t.stars} · αργά ⭐ ${t.lateStars ?? 0} · ${uses.length ? uses.join(', ') : 'Σε καμία ρουτίνα'}` };
            }}
            isValid={(t, isNew) => taskIsValid(t, isNew ? undefined : config.tasks.find(x => x.id === t.id))}
            removable={t => taskLock(config, t.id)}
            save={(items, options) => save('tasks', items.map(t => (config.tasks.includes(t) ? t : tidyTask(t))), options)} />
    );
}
