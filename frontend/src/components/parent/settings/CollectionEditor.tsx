import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { IconValue } from '@shared/types';
import { useGame } from '../../../context/GameContext';
import { SmartIcon } from '../../SmartIcon';
import type { SaveOptions, SaveOutcome } from '../useConfigSave';
import { ConfirmButton, Empty, Section, Sheet } from '../ui';

export interface FormProps<T> { value: T; onChange: (value: T) => void }

interface Props<T extends { id: string }> {
    title: string;
    addLabel: string; // "Νέο δώρο"
    empty: string;
    items: T[];
    create: () => T;
    row: (item: T) => { icon: IconValue; title: string; sub: ReactNode };
    Form: (props: FormProps<T>) => ReactNode;
    isValid: (item: T, isNew: boolean) => boolean;
    save: (items: T[], options: SaveOptions) => Promise<SaveOutcome>;
    removable?: boolean; // false: the sheet has no Διαγραφή (the kids: their stars and history hang on the id)
}

const ADD_STALE = 'Οι ρυθμίσεις άλλαξαν στο μεταξύ από άλλη οθόνη. Πάτα ξανά Αποθήκευση για να προστεθεί.';

// A config list (rewards, schedules, chores, kids): rows, and a sheet to add, edit or delete one.
// The sheet copies the item when it opens, so it saves with the version of data.json it opened
// with (#33): if another screen saved since, the server refuses (409) and the sheet reloads, an
// edited item with its current values (the parent makes the change again), a new one as typed.
export function CollectionEditor<T extends { id: string }>({ title, addLabel, empty, items, create, row, Form, isValid, save, removable = true }: Props<T>) {
    const { configVersion } = useGame();
    const [editing, setEditing] = useState<{ item: T; isNew: boolean; title: string; version: string } | null>(null);
    const close = () => setEditing(null);
    const open = (item: T, isNew: boolean, title: string) => setEditing({ item, isNew, title, version: configVersion.data });

    // The live list and version, for a sheet that reloads after a refused save
    const live = useRef({ items, version: configVersion.data });
    useEffect(() => { live.current = { items, version: configVersion.data }; }, [items, configVersion.data]);
    const reload = () => setEditing(e => {
        if (!e) return e;
        if (e.isNew) return { ...e, version: live.current.version };
        const item = live.current.items.find(i => i.id === e.item.id);
        return item ? { ...e, item, version: live.current.version } : null; // deleted meanwhile: nothing to edit
    });

    const submit = async () => {
        if (!editing) return;
        const { item, isNew, version } = editing;
        const next = isNew ? [...items, item] : items.map(i => (i.id === item.id ? item : i));
        const outcome = await save(next, { done: isNew ? 'Προστέθηκε' : 'Αποθηκεύτηκε', version, ...(isNew ? { stale: ADD_STALE } : {}) });
        if (outcome === 'saved') close();
        if (outcome === 'stale') reload();
    };
    const remove = async (id: string) => {
        const outcome = await save(items.filter(i => i.id !== id), { done: 'Διαγράφηκε', version: editing?.version });
        if (outcome === 'saved') close();
        if (outcome === 'stale') reload();
    };

    return (
        <Section title={title}
            action={<button type="button" className="p-btn small" onClick={() => open(create(), true, addLabel)}>+ {addLabel}</button>}>
            {items.length === 0 && <Empty>{empty}</Empty>}
            <ul className="p-list">
                {items.map(item => {
                    const r = row(item);
                    return (
                        <li key={item.id}>
                            <button type="button" className="p-row" onClick={() => open(item, false, r.title)}>
                                <SmartIcon value={r.icon} size={32} />
                                <span className="p-row-main">
                                    <span className="p-row-title">{r.title}</span>
                                    <span className="p-row-sub">{r.sub}</span>
                                </span>
                                <span className="p-chevron" aria-hidden>›</span>
                            </button>
                        </li>
                    );
                })}
            </ul>
            {editing && (
                <Sheet title={editing.title} onClose={close}>
                    <form className="p-form" onSubmit={e => { e.preventDefault(); submit(); }}>
                        <Form value={editing.item} onChange={item => setEditing({ ...editing, item })} />
                        <div className="p-actions">
                            {removable && !editing.isNew && <ConfirmButton onConfirm={() => remove(editing.item.id)}>Διαγραφή</ConfirmButton>}
                            <button type="submit" className="p-btn primary" disabled={!isValid(editing.item, editing.isNew)}>Αποθήκευση</button>
                        </div>
                    </form>
                </Sheet>
            )}
        </Section>
    );
}
