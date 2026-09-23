import { useId, type ReactNode } from 'react';
import type { IconValue, User } from '@shared/types';
import { api } from '../../../api';
import { SmartIcon } from '../../SmartIcon';
import { DAY_LABELS, formatWeekly, parseWeekly, WEEK_ORDER } from '../cron';
import { useFeedback } from '../useFeedback';
import { asFormIcon, type FormIcon } from './model';

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

export function SelectField({ label, value, options, onChange }: {
    label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void;
}) {
    return (
        <Field label={label}>
            {id => (
                <select id={id} className="p-input" value={value} onChange={e => onChange(e.target.value)}>
                    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            )}
        </Field>
    );
}

export function IconField({ value, onChange }: { value: IconValue; onChange: (v: FormIcon) => void }) {
    const { run } = useFeedback();
    const icon = asFormIcon(value);
    const upload = (file?: File) => file && run(async () => onChange({ type: 'image', value: (await api.uploadFile(file)).filename }), 'Η εικόνα ανέβηκε');
    return (
        <Field label="Εικονίδιο">
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

// A time and weekdays; a cron expression the form can't show that way is edited as text.
export function WhenField({ label, cron, onChange }: { label: string; cron: string; onChange: (cron: string) => void }) {
    const weekly = parseWeekly(cron);
    if (!weekly) return <TextField label={`${label} (cron)`} value={cron} onChange={onChange} />;
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

// Which kids: none selected means everyone.
export function KidsField({ label, users, value, onChange }: {
    label: string; users: User[]; value?: string[]; onChange: (ids: string[] | undefined) => void;
}) {
    const selected = value ?? [];
    const toggle = (id: string) => {
        const next = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id];
        onChange(next.length ? next : undefined);
    };
    return (
        <Field label={label}>
            {() => (
                <div className="p-chips" role="group" aria-label={label}>
                    {users.map(u => (
                        <button key={u.id} type="button" aria-pressed={selected.includes(u.id)}
                            className={selected.includes(u.id) ? 'p-chip on' : 'p-chip'} onClick={() => toggle(u.id)}>{u.name}</button>
                    ))}
                </div>
            )}
        </Field>
    );
}
