import { useContext, useEffect, useId, useState, type ReactNode } from 'react';
import type { IconValue, User } from '@shared/types';
import { api } from '../../../api';
import { SmartIcon } from '../../SmartIcon';
import { DAY_LABELS, formatWeekly, parseWeekly, WEEK_ORDER } from '../cron';
import { useFeedback } from '../useFeedback';
import { FieldProblems } from './fieldProblems';
import { asFormIcon, missingKidsHint, THEME_COLORS, toggleKid, type FormIcon } from './model';

// Form fields for the config editors. Each is a label plus one control.

export function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
    const id = useId();
    return <div className="p-field"><label htmlFor={id}>{label}</label>{children(id)}</div>;
}

export function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return <Field label={label}>{id => <input id={id} className="p-input" value={value} onChange={e => onChange(e.target.value)} />}</Field>;
}

export function NumberField({ label, value, onChange, min = 1, step = 1 }: {
    label: string; value: number; onChange: (v: number) => void; min?: number; step?: number;
}) {
    return (
        <Field label={label}>
            {id => <input id={id} className="p-input" type="number" inputMode="decimal" min={min} step={step}
                value={Number.isNaN(value) ? '' : value} onChange={e => onChange(e.target.valueAsNumber)} />}
        </Field>
    );
}

// Options with a `group` go under it (an <optgroup>), in the order given
export function SelectField({ label, value, options, onChange }: {
    label: string; value: string; options: { value: string; label: string; group?: string }[]; onChange: (v: string) => void;
}) {
    const option = (o: { value: string; label: string }) => <option key={o.value} value={o.value}>{o.label}</option>;
    const runs: { group?: string; options: typeof options }[] = [];
    for (const o of options) {
        const last = runs[runs.length - 1];
        if (last && last.group === o.group) last.options.push(o);
        else runs.push({ group: o.group, options: [o] });
    }
    return (
        <Field label={label}>
            {id => (
                <select id={id} className="p-input" value={value} onChange={e => onChange(e.target.value)}>
                    {runs.map((run, i) => run.group
                        ? <optgroup key={`${i}-${run.group}`} label={run.group}>{run.options.map(option)}</optgroup>
                        : run.options.map(option))}
                </select>
            )}
        </Field>
    );
}

export function IconField({ label = 'Εικονίδιο', value, onChange }: { label?: string; value: IconValue; onChange: (v: FormIcon) => void }) {
    const { run } = useFeedback();
    const icon = asFormIcon(value);
    const upload = (file?: File) => file && run(async () => onChange({ type: 'image', value: (await api.uploadFile(file)).filename }), 'Η εικόνα ανέβηκε');
    return (
        <Field label={label}>
            {id => (
                <div className="p-icon-field">
                    <span className="p-icon-preview">{icon.value && <SmartIcon value={icon} size={40} />}</span>
                    <input id={id} className="p-input" placeholder="Emoji, π.χ. 🎬" value={icon.type === 'emoji' ? icon.value : ''}
                        onChange={e => onChange({ type: 'emoji', value: e.target.value.trim() })} />
                    <label className="p-btn ghost small">
                        Εικόνα
                        <input type="file" accept="image/*" hidden onChange={e => upload(e.target.files?.[0])} />
                    </label>
                </div>
            )}
        </Field>
    );
}

// A colour from the theme, which reads well on the dark kids' screen. A value that is none of them
// (written by hand in the JSON) shows as its own chip, «Άλλο», and stays unless another is picked;
// the chip stays too while the sheet is open, so it can be picked back.
export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    const [first] = useState(value);
    const own = [...new Set([first, value])].filter(v => v.trim() && !THEME_COLORS.some(c => c.value === v)).map(v => ({ value: v, label: 'Άλλο' }));
    return (
        <Field label={label}>
            {() => (
                <div className="p-chips" role="group" aria-label={label}>
                    {[...THEME_COLORS, ...own].map(c => (
                        <button key={c.value} type="button" aria-pressed={c.value === value}
                            className={c.value === value ? 'p-chip p-swatch on' : 'p-chip p-swatch'} onClick={() => onChange(c.value)}>
                            <span className="p-swatch-dot" style={{ background: c.value }} aria-hidden />{c.label}
                        </button>
                    ))}
                </div>
            )}
        </Field>
    );
}

// Why the scheduler can't read `cron`, asked of the server (cron.ts is the one reader, #89) a moment after
// the typing stops; null when it can, while asking, or for no cron (null).
function useCronError(cron: string | null): string | null {
    const [answer, setAnswer] = useState<{ cron: string; error: string | null } | null>(null);
    useEffect(() => {
        if (cron === null) return;
        let current = true;
        const timer = setTimeout(() => {
            api.validateCron(cron).then(({ error }) => { if (current) setAnswer({ cron, error }); }).catch(() => { /* the save checks it too */ });
        }, 300);
        return () => { current = false; clearTimeout(timer); };
    }, [cron]);
    return cron !== null && answer?.cron === cron ? answer.error : null;
}

// A time and weekdays; a cron expression the form can't show that way is edited as text. The weekly controls
// only write crons the scheduler reads; the text is checked by the server, and one it can't read is said
// under the field. Changed to one, it can't be saved (the server refuses it too); the cron the sheet opened
// with, live already, may stay as it is while the rest of the item changes.
export function WhenField({ label, cron, onChange }: { label: string; cron: string; onChange: (cron: string) => void }) {
    const [first] = useState(cron);
    const weekly = parseWeekly(cron);
    const error = useCronError(weekly ? null : cron);
    const blocks = error !== null && cron !== first;
    const key = useId();
    const report = useContext(FieldProblems);
    useEffect(() => {
        report(key, blocks ? error : null);
        return () => report(key, null);
    }, [report, key, blocks, error]);
    if (!weekly) {
        return (
            <Field label={`${label} (cron)`}>
                {id => <>
                    <input id={id} className="p-input" value={cron} aria-invalid={error !== null || undefined}
                        aria-describedby={error !== null ? `${id}-error` : undefined} onChange={e => onChange(e.target.value)} />
                    {error !== null && (
                        <p id={`${id}-error`} className="p-hint p-warning" role="alert">
                            ⚠ Δεν διαβάζεται: {error}. {blocks ? 'Διόρθωσέ το για να αποθηκευτεί.' : 'Όσο μένει έτσι, δεν ενεργοποιείται ποτέ.'}
                        </p>
                    )}
                </>}
            </Field>
        );
    }
    const toggle = (day: number) => {
        const days = weekly.days.includes(day) ? weekly.days.filter(d => d !== day) : [...weekly.days, day];
        if (days.length) onChange(formatWeekly({ ...weekly, days }));
    };
    return (
        <Field label={label}>
            {id => (
                <div className="p-when">
                    <input id={id} className="p-input" type="time" value={weekly.time} required
                        onChange={e => e.target.value && onChange(formatWeekly({ ...weekly, time: e.target.value }))} />
                    <div className="p-chips" role="group" aria-label="Μέρες">
                        {WEEK_ORDER.map(d => (
                            <button key={d} type="button" aria-pressed={weekly.days.includes(d)}
                                className={weekly.days.includes(d) ? 'p-chip on' : 'p-chip'} onClick={() => toggle(d)}>{DAY_LABELS[d]}</button>
                        ))}
                    </div>
                </div>
            )}
        </Field>
    );
}

// Which kids (a chore's: the line speaks of «η δουλειά»): none selected means everyone («Για όλα»). Only kids
// show and toggle: an id that is no kid goes on any tap, and a line says so while one is there (#121).
export function KidsField({ label, users, value, onChange }: {
    label: string; users: User[]; value?: string[]; onChange: (ids: string[] | undefined) => void;
}) {
    const selected = value ?? [];
    const hint = missingKidsHint(value, users);
    return (
        <Field label={label}>
            {() => (
                <>
                    <div className="p-chips" role="group" aria-label={label}>
                        <button type="button" aria-pressed={!selected.length} className={selected.length ? 'p-chip' : 'p-chip on'}
                            onClick={() => onChange(undefined)}>Για όλα</button>
                        {users.map(u => (
                            <button key={u.id} type="button" aria-pressed={selected.includes(u.id)}
                                className={selected.includes(u.id) ? 'p-chip on' : 'p-chip'} onClick={() => onChange(toggleKid(value, u.id, users))}>{u.name}</button>
                        ))}
                    </div>
                    {hint && <p className="p-hint p-warning">⚠ {hint}</p>}
                </>
            )}
        </Field>
    );
}
