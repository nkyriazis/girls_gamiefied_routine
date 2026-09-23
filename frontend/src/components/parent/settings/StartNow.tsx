import { api } from '../../../api';
import { useGame } from '../../../context/GameContext';
import { useFeedback } from '../useFeedback';
import { Section } from '../ui';
import { targetsOf } from './model';

// Start a flow or a kid's routine now, on every screen.
export function StartNow() {
    const { config, users } = useGame();
    const { run } = useFeedback();
    return (
        <Section title="Ξεκίνα τώρα">
            <div className="p-chips">
                {targetsOf(config, users).map(t => (
                    <button key={t.id} type="button" className="p-chip" onClick={() => run(() => api.pushNow(t.id), `Ξεκίνησε: ${t.label}`)}>
                        ▶ {t.label}
                    </button>
                ))}
            </div>
        </Section>
    );
}
