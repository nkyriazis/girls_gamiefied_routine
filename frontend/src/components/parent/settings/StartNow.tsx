import type { ConfigWarning, TriggerResult } from '@shared/types';
import { api } from '../../../api';
import { useGame } from '../../../context/GameContext';
import { useFeedback } from '../useFeedback';
import { Section } from '../ui';
import { targetsOf, type Target } from './model';

// Start a flow or a kid's routine now, on every screen. A kid already in a routine keeps it
// (the server skips the start), and the toast names the routine she is in. A flow that ended at once
// started nothing, and the toast says so, and why when a cycle was refused (#121).
export function StartNow() {
    const { config, users, routineRuns, configWarnings } = useGame();
    const { run } = useFeedback();
    const targets = targetsOf(config, users);
    const labelOf = (assignmentId: string) => targets.find(t => t.id === assignmentId)?.label ?? assignmentId;
    const said = (t: Target, result: TriggerResult) => {
        if ('skipped' in result) return `Ήδη σε ρουτίνα: ${labelOf(routineRuns.find(r => r.id === result.runningId)?.routineId ?? t.id)}`;
        if ('nothingStarted' in result) return `Η ροή «${t.label}» δεν ξεκίνησε τίποτα${result.cycle ? ' (κύκλος)' : ''}`;
        return `Ξεκίνησε: ${t.label}`;
    };
    return (
        <Section title="Ξεκίνα τώρα">
            <div className="p-chips">
                {targets.map(t => (
                    <button key={t.id} type="button" className="p-chip" onClick={() => run(() => api.pushNow(t.id), result => said(t, result))}>
                        ▶ {t.label}
                    </button>
                ))}
            </div>
            <ReservedIds warnings={configWarnings} />
        </Section>
    );
}

// An assignment or a flow whose id is «alarm» isn't offered to start (#121): the server's warning says why.
export function ReservedIds({ warnings }: { warnings: ConfigWarning[] }) {
    return warnings.filter(w => w.kind === 'reserved-id').map(w => <p key={w.path} className="p-hint p-warning">⚠ {w.message}</p>);
}
