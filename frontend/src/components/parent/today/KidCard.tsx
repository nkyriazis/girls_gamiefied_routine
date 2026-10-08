import type { RoutineRun, User } from '@shared/types';
import { api } from '../../../api';
import { useFeedback } from '../useFeedback';
import { Avatar, ConfirmButton } from '../ui';

// What the kid is doing right now, if they are in a routine.
function progressOf(user: User, run?: RoutineRun): { label: string; done: number } | null {
    const routine = run && user.routines.find(r => r.id === run.routineId);
    if (!run || !routine) return null;
    const total = routine.tasks.length;
    if (run.finishedAt) return { label: 'Τελείωσε τη ρουτίνα', done: 1 };
    return { label: `${routine.tasks[run.taskIndex]?.title ?? ''} · ${run.taskIndex + 1}/${total}`, done: run.taskIndex / total };
}

// A kid: balance, and the routine they are doing right now. Tap to give or take stars.
// «Τέλος» ends a running routine (#63): the kids' ✕'s close, so a waiting flow moves on, and her
// lane on the kids' screens says a parent closed it. A finished one isn't offered: any kids'
// screen closes it with its reward in a few seconds.
export function KidCard({ user, run, onOpen }: { user: User; run?: RoutineRun; onOpen: () => void }) {
    const feedback = useFeedback();
    const progress = progressOf(user, run);
    return (
        <div className="p-kid">
            <button type="button" className="p-kid-open" onClick={onOpen}>
                <Avatar icon={user.avatar} color={user.color} size={56} />
                <span className="p-kid-name">{user.name}</span>
                <span className="p-kid-stars">⭐ {user.stars}</span>
                {progress && (
                    <span className="p-kid-run">
                        <span>{progress.label}</span>
                        <span className="p-progress"><span style={{ width: `${progress.done * 100}%` }} /></span>
                    </span>
                )}
            </button>
            {/* Keyed on the run: an armed «Σίγουρα;» never carries over to a newer run */}
            {progress && run && !run.finishedAt && (
                <ConfirmButton key={run.id} className="p-btn danger p-kid-end"
                    onConfirm={() => feedback.run(() => api.endRoutine(run.id), 'Η ρουτίνα έκλεισε')}>
                    Τέλος
                </ConfirmButton>
            )}
        </div>
    );
}
