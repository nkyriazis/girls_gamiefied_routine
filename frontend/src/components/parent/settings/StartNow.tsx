import { api } from '../../../api';
import { useGame } from '../../../context/GameContext';
import { useFeedback } from '../useFeedback';
import { Section } from '../ui';
import { targetsOf } from './model';

// Start a flow or a kid's routine now, on every screen. A kid already in a routine keeps it
// (the server skips the start), and the toast names the routine she is in.
export function StartNow() {
    const { config, users, routineRuns } = useGame();
    const { run } = useFeedback();
    const targets = targetsOf(config, users);
    const labelOf = (assignmentId: string) => targets.find(t => t.id === assignmentId)?.label ?? assignmentId;
    return (
        <Section title="Ξεκίνα τώρα">
            <div className="p-chips">
                {targets.map(t => (
                    <button key={t.id} type="button" className="p-chip" onClick={() => run(() => api.pushNow(t.id), result => 'skipped' in result
                        ? `Ήδη σε ρουτίνα: ${labelOf(routineRuns.find(r => r.id === result.runningId)?.routineId ?? t.id)}`
                        : `Ξεκίνησε: ${t.label}`)}>
                        ▶ {t.label}
                    </button>
                ))}
            </div>
        </Section>
    );
}
