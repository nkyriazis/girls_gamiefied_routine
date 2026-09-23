import type { Reward } from '@shared/types';
import { useGame } from '../../../context/GameContext';
import { useConfigSave } from '../useConfigSave';
import { Stars } from '../ui';
import { CollectionEditor, type FormProps } from './CollectionEditor';
import { newId } from './model';
import { IconField, NumberField, TextField } from './fields';

function RewardForm({ value, onChange }: FormProps<Reward>) {
    return (
        <>
            <TextField label="Όνομα" value={value.title} onChange={title => onChange({ ...value, title })} />
            <IconField value={value.icon} onChange={icon => onChange({ ...value, icon })} />
            <NumberField label="Κόστος σε αστέρια" value={value.cost} onChange={cost => onChange({ ...value, cost })} />
        </>
    );
}

// What the kids can buy in the store.
export function RewardsEditor() {
    const { rewards } = useGame();
    const save = useConfigSave();
    return (
        <CollectionEditor<Reward> title="Δώρα" addLabel="Νέο δώρο" items={rewards} Form={RewardForm}
            create={() => ({ id: newId('rew'), title: '', icon: { type: 'emoji', value: '🎁' }, cost: 100 })}
            row={r => ({ icon: r.icon, title: r.title, sub: <Stars value={r.cost} /> })}
            isValid={r => r.title.trim() !== '' && Number.isInteger(r.cost) && r.cost >= 1}
            save={(items, done) => save('rewards', items, done)} />
    );
}
