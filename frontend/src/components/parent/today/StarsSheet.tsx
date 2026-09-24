import { useState } from 'react';
import type { User } from '@shared/types';
import { api } from '../../../api';
import { useFeedback } from '../useFeedback';
import { Avatar, Sheet } from '../ui';

const QUICK = [1, 5, 10, 20, 50];

// Give or take stars by hand.
export function StarsSheet({ user, onClose }: { user: User; onClose: () => void }) {
    const { run } = useFeedback();
    const [amount, setAmount] = useState(10);
    const valid = Number.isInteger(amount) && amount > 0;

    const change = async (delta: number) => {
        const verb = delta > 0 ? `+${delta}` : `${delta}`;
        if (await run(() => api.adjustStars(user.id, delta), `${user.name}: ${verb} ⭐`)) onClose();
    };

    return (
        <Sheet title="Αστέρια" onClose={onClose}>
            <div className="p-stars-head">
                <Avatar icon={user.avatar} color={user.color} size={64} />
                <div>
                    <div className="p-kid-name">{user.name}</div>
                    <div className="p-kid-stars big">⭐ {user.stars}</div>
                </div>
            </div>
            <div className="p-chips" role="group" aria-label="Πόσα αστέρια">
                {QUICK.map(n => (
                    <button key={n} type="button" className={n === amount ? 'p-chip on' : 'p-chip'} onClick={() => setAmount(n)}>{n}</button>
                ))}
                <input className="p-input p-amount" type="number" inputMode="numeric" min={1} aria-label="Άλλο ποσό"
                    value={amount} onChange={e => setAmount(e.target.valueAsNumber)} />
            </div>
            <div className="p-actions">
                <button type="button" className="p-btn ghost" disabled={!valid || amount > user.stars} onClick={() => change(-amount)}>− Αφαίρεση {valid ? amount : ''}</button>
                <button type="button" className="p-btn primary" disabled={!valid} onClick={() => change(amount)}>+ Προσθήκη {valid ? amount : ''}</button>
            </div>
        </Sheet>
    );
}
