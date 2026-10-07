import { useGame } from '../../../context/GameContext';
import { useConfigSave } from '../useConfigSave';
import { Section } from '../ui';
import { SelectField } from './fields';

// How many school exercises a day, and how many extra problems the kids may ask for on top.
// Each kid's class, problems and mistakes are in her sheet under Παιδιά (KidsEditor).
export function SchoolEditor() {
    const { config } = useGame();
    const save = useConfigSave();
    const perDay = config.settings.exercisesPerDay ?? 3;
    const extraPerDay = config.settings.extraProblemsPerDay ?? 10;
    return (
        <Section title="Σχολείο">
            <div className="p-form">
                <p className="p-hint">Η τάξη, τα προβλήματα και τα λάθη κάθε παιδιού είναι στα Παιδιά, πάνω.</p>
                <SelectField label="Ασκήσεις την ημέρα" value={String(perDay)}
                    options={Array.from({ length: 11 }, (_, n) => ({ value: String(n), label: String(n) }))}
                    onChange={n => save('settings', { ...config.settings, exercisesPerDay: Number(n) })} />
                <SelectField label="Έξτρα προβλήματα την ημέρα (τα ζητούν τα παιδιά)" value={String(extraPerDay)}
                    options={[0, 1, 2, 3, 5, 10, 15, 20, 30, 50].map(n => ({ value: String(n), label: n === 0 ? 'Κανένα' : String(n) }))}
                    onChange={n => save('settings', { ...config.settings, extraProblemsPerDay: Number(n) })} />
                <p className="p-hint">Στα προβλήματα, το παιδί πρώτα βρίσκει στην ιστορία τι ξέρουμε και τι ψάχνουμε: με τις φράσεις σημειωμένες, βάφοντας μόνο του τις λέξεις, ή βάφοντας και όσα δεν χρειάζονται. Ισχύει αμέσως, για κάθε πρόβλημα.</p>
                <p className="p-hint">Οι ασκήσεις της ημέρας αλλάζουν από την επόμενη ημέρα. Τα λάθη κοστίζουν αστέρια: σε ένα πρόβλημα, ένα ανά βήμα με λάθος· μια απλή άσκηση με λάθος δεν δίνει αστέρι. Τα έξτρα προβλήματα πληρώνουν το ίδιο. Μετράει και το βάψιμο. Στις πράξεις κοστίζει μόνο ένας λάθος λογαριασμός ή ο μικρότερος αριθμός πρώτος, όχι ένας σωστός που δεν βοηθά.</p>
            </div>
        </Section>
    );
}
