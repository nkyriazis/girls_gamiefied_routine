import type { ConfigUser, ProblemReading, SchoolGrade } from '@shared/types';
import { useGame } from '../../../context/GameContext';
import { useConfigSave } from '../useConfigSave';
import { Section } from '../ui';
import { SelectField } from './fields';

const GRADES = ['Α΄', 'Β΄', 'Γ΄', 'Δ΄', 'Ε΄', 'ΣΤ΄'];

// The reading ladder of word problems, easiest first
const READING: { value: ProblemReading; label: string }[] = [
    { value: 'marked', label: 'Πατά τις σημειωμένες φράσεις' },
    { value: 'paint', label: 'Βάφει μόνη της (τα περιττά γκριζάρουν)' },
    { value: 'paint-all', label: 'Βάφει μόνη της και τα περιττά' },
];

// Each kid's class, which picks their school exercises, how many a day, and how many
// extra problems they may ask for on top.
export function SchoolEditor() {
    const { config } = useGame();
    const save = useConfigSave();
    const perDay = config.settings.exercisesPerDay ?? 3;
    const extraPerDay = config.settings.extraProblemsPerDay ?? 10;
    const setGrade = (id: string, grade: string) => save('users', config.users.map(u => {
        if (u.id !== id) return u;
        const next: ConfigUser = { ...u, grade: Number(grade) as SchoolGrade };
        if (!grade) delete next.grade;
        return next;
    }));
    const setReading = (id: string, reading: string) => save('users', config.users.map(u => {
        if (u.id !== id) return u;
        const next: ConfigUser = { ...u, problemReading: reading as ProblemReading };
        if (reading === 'marked') delete next.problemReading;
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
                {config.users.filter(u => u.grade).map(u => (
                    <SelectField key={`r-${u.id}`} label={`Προβλήματα: ${u.name}`} value={u.problemReading ?? 'marked'}
                        options={READING} onChange={reading => setReading(u.id, reading)} />
                ))}
                <SelectField label="Ασκήσεις την ημέρα" value={String(perDay)}
                    options={Array.from({ length: 11 }, (_, n) => ({ value: String(n), label: String(n) }))}
                    onChange={n => save('settings', { ...config.settings, exercisesPerDay: Number(n) })} />
                <SelectField label="Έξτρα προβλήματα την ημέρα (τα ζητούν τα παιδιά)" value={String(extraPerDay)}
                    options={[0, 1, 2, 3, 5, 10, 15, 20, 30, 50].map(n => ({ value: String(n), label: n === 0 ? 'Κανένα' : String(n) }))}
                    onChange={n => save('settings', { ...config.settings, extraProblemsPerDay: Number(n) })} />
                <p className="p-hint">Στα προβλήματα, το παιδί πρώτα βρίσκει στην ιστορία τι ξέρουμε και τι ψάχνουμε: με τις φράσεις σημειωμένες, βάφοντας μόνο του τις λέξεις, ή βάφοντας και όσα δεν χρειάζονται. Ισχύει αμέσως, για κάθε πρόβλημα.</p>
                <p className="p-hint">Οι ασκήσεις της ημέρας αλλάζουν από την επόμενη ημέρα. Τα έξτρα προβλήματα δίνουν τα αστέρια τους όπως και τα άλλα.</p>
            </div>
        </Section>
    );
}
