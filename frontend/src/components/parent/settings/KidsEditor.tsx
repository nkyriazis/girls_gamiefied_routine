import type { ConfigUser, Forgiveness, ProblemReading, SchoolGrade } from '@shared/types';
import { useGame } from '../../../context/GameContext';
import { useConfigSave } from '../useConfigSave';
import { CollectionEditor, type FormProps } from './CollectionEditor';
import { FORGIVENESS, GRADES, gradeLabel, kidIsValid, newKid, READING, tidyUser } from './model';
import { ColorField, IconField, SelectField, TextField } from './fields';

function KidForm({ value, onChange }: FormProps<ConfigUser>) {
    const rung = FORGIVENESS.find(f => f.value === (value.forgiveness ?? 'forgiving'))!;
    return (
        <>
            <TextField label="Όνομα" value={value.name} onChange={name => onChange({ ...value, name })} />
            <IconField label="Φατσούλα" value={value.avatar} onChange={avatar => onChange({ ...value, avatar })} />
            <ColorField label="Χρώμα" value={value.color} onChange={color => onChange({ ...value, color })} />
            <SelectField label="Τάξη" value={value.grade ? String(value.grade) : ''}
                options={[{ value: '', label: gradeLabel() }, ...GRADES.map((_, i) => ({ value: String(i + 1), label: gradeLabel(i + 1) }))]}
                onChange={grade => onChange({ ...value, grade: grade ? Number(grade) as SchoolGrade : undefined })} />
            {value.grade && (
                <>
                    <SelectField label="Προβλήματα" value={value.problemReading ?? 'marked'} options={READING}
                        onChange={reading => onChange({ ...value, problemReading: reading as ProblemReading })} />
                    <SelectField label="Λάθη" value={rung.value} options={FORGIVENESS}
                        onChange={f => onChange({ ...value, forgiveness: f as Forgiveness })} />
                    <p className="p-hint">{rung.says}</p>
                </>
            )}
        </>
    );
}

// The kids: name, avatar, colour, and the class that picks their school exercises.
// No Διαγραφή: a kid's stars, history and routines hang on her id, so removing one stays in Προχωρημένα.
export function KidsEditor() {
    const { config } = useGame();
    const save = useConfigSave();
    return (
        <CollectionEditor<ConfigUser> title="Παιδιά" empty="Δεν υπάρχουν παιδιά. Πρόσθεσε ένα για να εμφανιστεί στην οθόνη." addLabel="Νέο παιδί"
            items={config.users} Form={KidForm} removable={false}
            create={() => newKid(config.users)}
            row={u => ({
                icon: u.avatar, title: u.name,
                sub: <><span className="p-swatch-dot" style={{ background: u.color }} aria-hidden />{gradeLabel(u.grade)}</>,
            })}
            isValid={(u, isNew) => kidIsValid(u, config.users, isNew)}
            save={(items, options) => save('users', items.map(u => (config.users.includes(u) ? u : tidyUser(u))), options)} />
    );
}
