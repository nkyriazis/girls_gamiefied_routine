import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { IconValue } from '@shared/types';
import { useGame } from '../../../context/GameContext';
import { SmartIcon } from '../../SmartIcon';
import type { SaveOptions, SaveOutcome } from '../useConfigSave';
import { ConfirmButton, Empty, Section, Sheet } from '../ui';

export interface FormProps<T> { value: T; onChange: (value: T) => void }

// How the sheet's item is saved: the list with it swapped in (rewards, schedules, chores, kids, tasks), or by
// the editor itself, item by item (a routine, which lives in three lists).
type Saving<T> =
    | { save: (items: T[], options: SaveOptions) => Promise<SaveOutcome>; saveItem?: never; removeItem?: never }
    | {
        save?: never;
        saveItem: (item: T, isNew: boolean, options: SaveOptions) => Promise<SaveOutcome>;
        removeItem: (item: T, options: SaveOptions) => Promise<SaveOutcome>;
    };

type Props<T extends { id: string }> = Saving<T> & {
    title: string;
    addLabel: string; // "Νέο δώρο"
    empty: string;
    items: T[];
    create: () => T;
    row: (item: T) => { icon: IconValue; title: string; sub: ReactNode; warning?: string }; // warning: a line marked ⚠
    Form: (props: FormProps<T>) => ReactNode;
    isValid: (item: T, isNew: boolean) => boolean;
    // false: the sheet has no Διαγραφή (the kids: their stars and history hang on the id). A function says,
    // per item, why it can't be deleted now (shown in place of Διαγραφή), or null when it can.
    removable?: boolean | ((item: T) => string | null);
    // After a save, keep the sheet open on the saved item, reloaded from the live config once it arrives,
    // when it has something to say about the result (a routine: a newly ticked kid has no time yet).
    keepOpen?: (item: T, isNew: boolean) => boolean;
};

const ADD_STALE = 'Οι ρυθμίσεις άλλαξαν στο μεταξύ από άλλη οθόνη. Πάτα ξανά Αποθήκευση για να προστεθεί.';

// A config list (rewards, schedules, chores, routines, tasks, kids): rows, and a sheet to add, edit or delete one.
// The sheet copies the item when it opens, so it saves with the version of data.json it opened
// with (#33): if another screen saved since, the server refuses (409) and the sheet reloads, an
// edited item with its current values (the parent makes the change again), a new one as typed.
export function CollectionEditor<T extends { id: string }>({ title, addLabel, empty, items, create, row, Form, isValid, save, saveItem, removeItem, removable = true, keepOpen }: Props<T>) {
    const { configVersion } = useGame();
    // saved: the sheet stays open after a save (keepOpen) and waits for the config it wrote
    const [editing, setEditing] = useState<{ item: T; isNew: boolean; title: string; version: string; saved?: boolean } | null>(null);
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

    // The saved item, once the config with it has arrived (setting state while rendering, React's way to
    // follow a change of props)
    if (editing?.saved && editing.version !== configVersion.data) {
        const item = items.find(i => i.id === editing.item.id);
        setEditing(item ? { item, isNew: false, title: row(item).title, version: configVersion.data } : null);
    }

    const submit = async () => {
        if (!editing) return;
        const { item, isNew, version } = editing;
        const options = { done: isNew ? 'Προστέθηκε' : 'Αποθηκεύτηκε', version, ...(isNew ? { stale: ADD_STALE } : {}) };
        const outcome = saveItem
            ? await saveItem(item, isNew, options)
            : await save!(isNew ? [...items, item] : items.map(i => (i.id === item.id ? item : i)), options);
        if (outcome === 'saved') {
            if (keepOpen?.(item, isNew)) setEditing({ ...editing, saved: true });
            else close();
        }
        if (outcome === 'stale') reload();
    };
    const remove = async (item: T) => {
        const options = { done: 'Διαγράφηκε', version: editing?.version };
        const outcome = removeItem ? await removeItem(item, options) : await save!(items.filter(i => i.id !== item.id), options);
        if (outcome === 'saved') close();
        if (outcome === 'stale') reload();
    };
    const lock = editing && !editing.isNew && typeof removable === 'function' ? removable(editing.item) : null;

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
                                    {r.warning && <span className="p-row-sub p-warning">⚠ {r.warning}</span>}
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
                        {lock && <p className="p-hint">{lock}</p>}
                        <div className="p-actions">
                            {removable && !editing.isNew && !lock && <ConfirmButton onConfirm={() => remove(editing.item)}>Διαγραφή</ConfirmButton>}
                            <button type="submit" className="p-btn primary" disabled={editing.saved || !isValid(editing.item, editing.isNew)}>Αποθήκευση</button>
                        </div>
                    </form>
                </Sheet>
            )}
        </Section>
    );
}
