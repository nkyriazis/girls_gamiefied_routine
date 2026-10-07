import { useId, useState } from 'react';
import { useGame } from '../../../context/GameContext';
import { SmartIcon } from '../../SmartIcon';
import { useConfigPatch } from '../useConfigSave';
import { CollectionEditor, type FormProps } from './CollectionEditor';
import { ColorField, IconField, TextField } from './fields';
import { asFormIcon } from './model';
import {
    addTask, applyRoutine, dropsLockedKid, formatMinutes, kidNotes, moveTask, newRoutine, parseMinutes, removeRoutine, removeTaskAt,
    routineDraft, routineIsValid, routineLock, routineSummary, routineWarnings, runningKids, type RoutineDraft,
} from './routines';

// A duration typed in minutes (1,5 or 1.5), shown rounded to a tenth; the exact seconds in its title.
// It keeps what is typed while it isn't a number yet, and follows a value changed from outside (a reload).
function MinutesInput({ seconds, label, onChange }: { seconds: number; label: string; onChange: (seconds: number) => void }) {
    const [shown, setShown] = useState({ text: formatMinutes(seconds), seconds });
    if (shown.seconds !== seconds && !(Number.isNaN(shown.seconds) && Number.isNaN(seconds))) setShown({ text: formatMinutes(seconds), seconds });
    return (
        <span className="p-minutes" title={Number.isNaN(seconds) ? undefined : `${seconds} δευτερόλεπτα`}>
            <input className="p-input" inputMode="decimal" aria-label={label} value={shown.text}
                aria-invalid={Number.isNaN(seconds) || undefined}
                onChange={e => {
                    const next = parseMinutes(e.target.value);
                    setShown({ text: e.target.value, seconds: next });
                    onChange(next);
                }} />′
        </span>
    );
}

function RoutineForm({ value, onChange }: FormProps<RoutineDraft>) {
    const { config, routineRuns } = useGame();
    const id = useId();
    const running = runningKids(config, routineRuns, value.id).map(id => config.users.find(u => u.id === id)?.name ?? id);
    const locked = running.length > 0;
    const notes = kidNotes(config, routineRuns, value);
    const fixed = new Set(notes.filter(n => n.locked).map(n => n.userId));
    const free = config.tasks.filter(t => !value.tasks.some(x => x.taskId === t.id));
    const setSeconds = (index: number, seconds: number) =>
        onChange({ ...value, tasks: value.tasks.map((t, i) => (i === index ? { ...t, seconds } : t)) });
    const toggleKid = (id: string) =>
        onChange({ ...value, kids: value.kids.includes(id) ? value.kids.filter(k => k !== id) : [...value.kids, id] });
    return (
        <>
            <TextField label="Όνομα" value={value.title} onChange={title => onChange({ ...value, title })} />
            <IconField value={value.icon} onChange={icon => onChange({ ...value, icon })} />
            <ColorField label="Χρώμα" value={value.themeColor} onChange={themeColor => onChange({ ...value, themeColor })} />

            <div className="p-field" role="group" aria-labelledby={`${id}-tasks`}>
                <span id={`${id}-tasks`} className="p-label">Εργασίες, με τη σειρά, και τα λεπτά της καθεμιάς</span>
                {locked && (
                    <p className="p-hint p-warning">
                        Τρέχει τώρα για: {running.join(', ')}. Οι εργασίες και η σειρά τους αλλάζουν όταν τελειώσει· το όνομα, το χρώμα και τα λεπτά αλλάζουν και τώρα.
                    </p>
                )}
                <ol className="p-steps">
                    {value.tasks.map((t, i) => {
                        const task = config.tasks.find(x => x.id === t.taskId);
                        const name = task?.title ?? t.taskId;
                        return (
                            <li key={t.rtId ?? `+${t.taskId}`} className={task ? 'p-step' : 'p-step missing'}>
                                <SmartIcon value={task?.icon ?? '❓'} size={28} />
                                <span className="p-step-title">{name}</span>
                                <MinutesInput seconds={t.seconds} label={`Λεπτά: ${name}`} onChange={s => setSeconds(i, s)} />
                                <button type="button" className="p-step-btn" aria-label={`Πιο πάνω: ${name}`} disabled={locked || i === 0}
                                    onClick={() => onChange(moveTask(value, i, -1))}>↑</button>
                                <button type="button" className="p-step-btn" aria-label={`Πιο κάτω: ${name}`} disabled={locked || i === value.tasks.length - 1}
                                    onClick={() => onChange(moveTask(value, i, 1))}>↓</button>
                                <button type="button" className="p-step-btn" aria-label={`Βγάλε: ${name}`} disabled={locked}
                                    onClick={() => onChange(removeTaskAt(value, i))}>✕</button>
                            </li>
                        );
                    })}
                </ol>
                {!locked && free.length > 0 && (
                    <select className="p-input" value="" aria-label="Πρόσθεσε εργασία"
                        onChange={e => e.target.value && onChange(addTask(config, value, e.target.value))}>
                        <option value="">+ Πρόσθεσε εργασία</option>
                        {free.map(t => <option key={t.id} value={t.id}>{asFormIcon(t.icon).type === 'emoji' ? `${asFormIcon(t.icon).value} ` : ''}{t.title}</option>)}
                    </select>
                )}
                <p className="p-hint">Μια νέα εργασία φτιάχνεται στις Εργασίες, πιο κάτω. Τα λεπτά είναι ο χρόνος της σε αυτή τη ρουτίνα.</p>
                {routineWarnings(value, config).map(w => <p key={w} className="p-hint p-warning">⚠ {w}</p>)}
            </div>

            <div className="p-field" role="group" aria-labelledby={`${id}-kids`}>
                <span id={`${id}-kids`} className="p-label">Παιδιά που την έχουν</span>
                <div className="p-chips">
                    {config.users.map(u => {
                        const on = value.kids.includes(u.id);
                        const stays = on && fixed.has(u.id); // can't be unticked now: the note under the chips says why
                        return (
                            <button key={u.id} type="button" aria-pressed={on} disabled={stays}
                                className={on ? 'p-chip on' : 'p-chip'} onClick={() => toggleKid(u.id)}>{stays && '🔒 '}{u.name}</button>
                        );
                    })}
                </div>
                {notes.map(n => <p key={n.userId} className={n.locked ? 'p-hint' : 'p-hint p-warning'}>{n.text}</p>)}
            </div>
        </>
    );
}

// The routines: name, icon, colour, their tasks in order with the minutes of each, and the kids who have
// them. A routine lives in three lists (routines, routineTasks, routineAssignments); a save writes the three
// in one POST, changing only this routine's entries (routines.ts). Ids are made here, never typed.
export function RoutinesEditor() {
    const { config, routineRuns } = useGame();
    const patch = useConfigPatch();
    const before = (id: string) => routineDraft(config, id);
    return (
        <CollectionEditor<RoutineDraft> title="Ρουτίνες" empty="Δεν υπάρχουν ρουτίνες. Πρόσθεσε μία με τις εργασίες της και τα παιδιά που την κάνουν." addLabel="Νέα ρουτίνα"
            items={config.routines.map(r => routineDraft(config, r.id))} Form={RoutineForm}
            create={() => newRoutine(config)}
            row={d => ({
                icon: d.icon, title: d.title,
                sub: <><span className="p-swatch-dot" style={{ background: d.themeColor }} aria-hidden />{routineSummary(config, d)}</>,
            })}
            isValid={(d, isNew) => routineIsValid(d, isNew ? undefined : before(d.id), config, runningKids(config, routineRuns, d.id).length > 0)
                && !dropsLockedKid(config, routineRuns, d)}
            removable={d => routineLock(config, routineRuns, d.id)}
            saveItem={(d, isNew, options) => patch(applyRoutine(config, d, isNew), options)}
            removeItem={(d, options) => patch(removeRoutine(config, d.id), options)}
            // A newly ticked kid has the routine without a time: the sheet stays to say so
            keepOpen={d => d.kids.some(k => !before(d.id).kids.includes(k))} />
    );
}
