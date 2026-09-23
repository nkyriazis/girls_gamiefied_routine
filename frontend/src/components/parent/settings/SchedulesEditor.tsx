import type { Schedule } from '@shared/types';
import { useGame } from '../../../context/GameContext';
import { describeCron } from '../cron';
import { useConfigSave } from '../useConfigSave';
import { CollectionEditor, type FormProps } from './CollectionEditor';
import { newId, targetsOf } from './model';
import { SelectField, WhenField } from './fields';

function ScheduleForm({ value, onChange }: FormProps<Schedule>) {
    const { config, users } = useGame();
    const targets = targetsOf(config, users);
    return (
        <>
            <SelectField label="Τι ξεκινά" value={value.targetId}
                options={targets.map(t => ({ value: t.id, label: t.label }))}
                onChange={id => onChange({ ...value, targetId: id, type: targets.find(t => t.id === id)?.type ?? value.type })} />
            <WhenField label="Πότε" cron={value.cron} onChange={cron => onChange({ ...value, cron })} />
        </>
    );
}

// When flows and routines start on their own.
export function SchedulesEditor() {
    const { config, users } = useGame();
    const save = useConfigSave();
    const targets = targetsOf(config, users);
    const first = targets[0];
    return (
        <CollectionEditor<Schedule> title="Πρόγραμμα" addLabel="Νέο πρόγραμμα" items={config.schedules} Form={ScheduleForm}
            create={() => ({ id: newId('sch'), cron: '0 7 * * 1-5', type: first?.type ?? 'flow', targetId: first?.id ?? '' })}
            row={s => ({ icon: '⏰', title: describeCron(s.cron), sub: targets.find(t => t.id === s.targetId)?.label ?? s.targetId })}
            isValid={s => targets.some(t => t.id === s.targetId)}
            save={(items, done) => save('schedules', items, done)} />
    );
}
