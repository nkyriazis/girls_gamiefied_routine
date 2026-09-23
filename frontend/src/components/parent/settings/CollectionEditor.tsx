import { useState, type ReactNode } from 'react';
import type { IconValue } from '@shared/types';
import { SmartIcon } from '../../SmartIcon';
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
    isValid: (item: T) => boolean;
    save: (items: T[], done: string) => Promise<boolean>;
}

// A config list (rewards, schedules, chores): rows, and a sheet to add, edit or delete one.
export function CollectionEditor<T extends { id: string }>({ title, addLabel, empty, items, create, row, Form, isValid, save }: Props<T>) {
    const [editing, setEditing] = useState<{ item: T; isNew: boolean; title: string } | null>(null);
    const close = () => setEditing(null);

    const submit = async () => {
        if (!editing) return;
        const { item, isNew } = editing;
        const next = isNew ? [...items, item] : items.map(i => (i.id === item.id ? item : i));
        if (await save(next, isNew ? 'Προστέθηκε' : 'Αποθηκεύτηκε')) close();
    };
    const remove = async (id: string) => {
        if (await save(items.filter(i => i.id !== id), 'Διαγράφηκε')) close();
    };

    return (
        <Section title={title}
            action={<button type="button" className="p-btn small" onClick={() => setEditing({ item: create(), isNew: true, title: addLabel })}>+ {addLabel}</button>}>
            {items.length === 0 && <Empty>{empty}</Empty>}
            <ul className="p-list">
                {items.map(item => {
                    const r = row(item);
                    return (
                        <li key={item.id}>
                            <button type="button" className="p-row" onClick={() => setEditing({ item, isNew: false, title: r.title })}>
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
                            {!editing.isNew && <ConfirmButton onConfirm={() => remove(editing.item.id)}>Διαγραφή</ConfirmButton>}
                            <button type="submit" className="p-btn primary" disabled={!isValid(editing.item)}>Αποθήκευση</button>
                        </div>
                    </form>
                </Sheet>
            )}
        </Section>
    );
}
