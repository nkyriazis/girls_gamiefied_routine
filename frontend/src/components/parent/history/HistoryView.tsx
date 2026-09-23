import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import type { IconValue } from '@shared/types';
import { useGame } from '../../../context/GameContext';
import { SmartIcon } from '../../SmartIcon';
import { Empty, Section, Stars } from '../ui';

interface Entry {
    id: string;
    at: string;
    userIds: string[];
    icon: IconValue;
    title: string;
    outcome: string;
    stars: number;
    undone: boolean; // rejected, revoked or cancelled: no stars moved
}

const TRANSFER_OUTCOME = { approved: 'Εγκρίθηκε', rejected: 'Απορρίφθηκε', cancelled: 'Ακυρώθηκε από το παιδί', pending: '' };
const PAGE = 30;

// What parents and kids decided: rewards given, star gifts, chores.
export function HistoryView() {
    const { spendings, starTransfers, choreInstances, chores, users } = useGame();
    const [kid, setKid] = useState<string | null>(null);
    const [shown, setShown] = useState(PAGE);
    const entries = useMemo<Entry[]>(() => {
        const name = (id?: string) => users.find(u => u.id === id)?.name ?? id ?? '';
        return [
        ...spendings.filter(s => s.status !== 'pending').map(s => ({
            id: s.id, at: s.createdAt, userIds: [s.userId], icon: s.reward?.icon ?? '🎀',
            title: `${name(s.userId)}: ${s.reward?.title ?? s.rewardId}`,
            outcome: s.status === 'done' ? 'Δόθηκε' : 'Ακυρώθηκε', stars: -s.cost, undone: s.status === 'revoked',
        })),
        ...starTransfers.filter(t => t.status !== 'pending').map(t => ({
            id: t.id, at: t.resolvedAt ?? t.createdAt, userIds: [t.fromUserId, t.toUserId], icon: '🎁',
            title: `${name(t.fromUserId)} → ${name(t.toUserId)}`,
            outcome: TRANSFER_OUTCOME[t.status], stars: t.amount, undone: t.status !== 'approved',
        })),
        ...choreInstances.filter(i => i.status === 'confirmed' || i.status === 'rejected').map(i => {
            const chore = chores.find(c => c.id === i.choreId);
            return {
                id: i.id, at: i.confirmedAt ?? i.rejectedAt ?? i.availableAt, userIds: i.claimedBy ? [i.claimedBy] : [],
                icon: chore?.icon ?? '🧹', title: `${name(i.claimedBy)}: ${chore?.title ?? i.choreId}`,
                outcome: i.status === 'confirmed' ? 'Επιβεβαιώθηκε' : 'Απορρίφθηκε', stars: i.starsAwarded ?? 0, undone: i.status === 'rejected',
            };
        }),
        ].sort((a, b) => b.at.localeCompare(a.at));
    }, [spendings, starTransfers, choreInstances, chores, users]);

    const visible = kid ? entries.filter(e => e.userIds.includes(kid)) : entries;

    return (
        <Section title="Ιστορικό">
            <div className="p-chips" role="group" aria-label="Παιδί">
                <button type="button" className={kid ? 'p-chip' : 'p-chip on'} onClick={() => setKid(null)}>Όλα</button>
                {users.map(u => (
                    <button key={u.id} type="button" className={kid === u.id ? 'p-chip on' : 'p-chip'} onClick={() => setKid(u.id)}>{u.name}</button>
                ))}
            </div>
            {visible.length === 0 && <Empty>Δεν υπάρχει ακόμη ιστορικό.</Empty>}
            <ul className="p-list">
                {visible.slice(0, shown).map(e => (
                    <li key={e.id} className={e.undone ? 'p-row undone' : 'p-row'}>
                        <SmartIcon value={e.icon} size={32} />
                        <div className="p-row-main">
                            <div className="p-row-title">{e.title}</div>
                            <div className="p-row-sub">{e.outcome} · {format(new Date(e.at), 'd MMM yyyy, HH:mm', { locale: el })}</div>
                        </div>
                        <Stars value={e.stars} sign />
                    </li>
                ))}
            </ul>
            {visible.length > shown && <button type="button" className="p-btn ghost wide" onClick={() => setShown(n => n + PAGE)}>Περισσότερα</button>}
        </Section>
    );
}
