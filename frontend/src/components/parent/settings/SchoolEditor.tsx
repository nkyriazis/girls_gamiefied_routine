import type { ConfigUser, SchoolGrade } from '@shared/types';
import { useGame } from '../../../context/GameContext';
import { useConfigSave } from '../useConfigSave';
import { Section } from '../ui';
import { SelectField } from './fields';

const GRADES = ['Α΄', 'Β΄', 'Γ΄', 'Δ΄', 'Ε΄', 'ΣΤ΄'];

// Each kid's class, which picks the daily school exercises, and how many a day.
export function SchoolEditor() {
    const { config } = useGame();
    const save = useConfigSave();
    const perDay = config.settings.exercisesPerDay ?? 3;
    const setGrade = (id: string, grade: string) => save('users', config.users.map(u => {
        if (u.id !== id) return u;
        const next: ConfigUser = { ...u, grade: Number(grade) as SchoolGrade };
        if (!grade) delete next.grade;
        return next;
    }));
    return (
        <Section title="Σχολείο">
            <div className="p-form">
                {config.users.map(u => (
                    <SelectField key={u.id} label={`Τάξη: ${u.name}`} value={u.grade ? String(u.grade) : ''}
                        options={[{ value: '', label: 'Χωρίς ασκήσεις' }, ...GRADES.map((g, i) => ({ value: String(i + 1), label: `${g} Δημοτικού` }))]}
                        onChange={grade => setGrade(u.id, grade)} />
                ))}
                <SelectField label="Ασκήσεις την ημέρα" value={String(perDay)}
                    options={Array.from({ length: 11 }, (_, n) => ({ value: String(n), label: String(n) }))}
                    onChange={n => save('settings', { ...config.settings, exercisesPerDay: Number(n) })} />
                <p className="p-hint">Οι αλλαγές ισχύουν από τις ασκήσεις της επόμενης ημέρας.</p>
            </div>
        </Section>
    );
}
