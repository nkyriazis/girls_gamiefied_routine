import type { Chore } from '@shared/types';
import { useGame } from '../../../context/GameContext';
import { describeCron } from '../cron';
import { useConfigSave } from '../useConfigSave';
import { CollectionEditor, type FormProps } from './CollectionEditor';
import { newId } from './model';
import { IconField, KidsField, NumberField, SelectField, TextField, WhenField } from './fields';

function ChoreForm({ value, onChange }: FormProps<Chore>) {
    const { users } = useGame();
    return (
        <>
            <TextField label="Όνομα" value={value.title} onChange={title => onChange({ ...value, title })} />
            <IconField value={value.icon} onChange={icon => onChange({ ...value, icon })} />
            <SelectField label="Είδος" value={value.category ?? 'chore'}
                options={[{ value: 'chore', label: 'Δουλειά του σπιτιού' }, { value: 'bonus', label: 'Bonus (σχολείο, έξω)' }]}
                onChange={category => onChange({ ...value, category: category as Chore['category'] })} />
            <NumberField label="Αστέρια" value={value.defaultStars} onChange={defaultStars => onChange({ ...value, defaultStars })} />
            <WhenField label="Διαθέσιμη από" cron={value.availabilityCron} onChange={availabilityCron => onChange({ ...value, availabilityCron })} />
            <NumberField label="Λήγει μετά από (ώρες)" value={value.expirationHours} min={0.5} step={0.5}
                onChange={expirationHours => onChange({ ...value, expirationHours })} />
            <KidsField label="Ποια παιδιά (κανένα επιλεγμένο: όλα)" users={users} value={value.eligibleUsers}
                onChange={eligibleUsers => onChange({ ...value, eligibleUsers })} />
        </>
    );
}

// Chores and bonus activities the kids can claim for stars.
export function ChoresEditor() {
    const { chores } = useGame();
    const save = useConfigSave();
    return (
        <CollectionEditor<Chore> title="Δουλειές & bonus" empty="Δεν υπάρχουν δουλειές. Πρόσθεσε μία και τα παιδιά θα τη βλέπουν στην ώρα της." addLabel="Νέα δουλειά" items={chores} Form={ChoreForm}
            create={() => ({ id: newId('chore'), title: '', icon: { type: 'emoji', value: '🧹' }, defaultStars: 10, availabilityCron: '0 17 * * *', expirationHours: 4, category: 'chore' })}
            row={c => ({ icon: c.icon, title: c.title, sub: `${c.category === 'bonus' ? 'Bonus' : 'Δουλειά'} · ${describeCron(c.availabilityCron)} · ⭐ ${c.defaultStars}` })}
            isValid={c => c.title.trim() !== '' && Number.isInteger(c.defaultStars) && c.defaultStars >= 1 && c.expirationHours >= 0.5}
            save={(items, done) => save('chores', items, done)} />
    );
}
