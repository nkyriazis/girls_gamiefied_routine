import { useState, type ReactNode } from 'react';
import { api } from '../../../api';
import { SmartIcon } from '../../SmartIcon';
import { useFeedback } from '../useFeedback';
import { Ago, Avatar, ConfirmButton, Stars } from '../ui';
import type { InboxItem } from './useInbox';

// One thing waiting for a parent: what it is, who asked, and the two answers.
export function InboxCard({ item }: { item: InboxItem }) {
    switch (item.kind) {
        case 'transfer': return <TransferCard item={item} />;
        case 'spending': return <SpendingCard item={item} />;
        case 'chore': return <ChoreCard item={item} />;
    }
}

function Card({ icon, kind, title, who, stars, at, children }: {
    icon: ReactNode; kind: string; title: string; who: ReactNode; stars: ReactNode; at: string; children: ReactNode;
}) {
    return (
        <article className="p-card p-inbox-card">
            <div className="p-inbox-icon">{icon}</div>
            <div className="p-inbox-body">
                <div className="p-eyebrow">{kind} · <Ago at={at} /></div>
                <h3>{title}</h3>
                <div className="p-inbox-meta">
                    <span className="p-who">{who}</span>
                    <span className="p-inbox-stars">{stars}</span>
                </div>
            </div>
            <div className="p-actions">{children}</div>
        </article>
    );
}

function TransferCard({ item: { transfer: t, at } }: { item: Extract<InboxItem, { kind: 'transfer' }> }) {
    const { run } = useFeedback();
    return (
        <Card icon="🎁" kind="Δώρο αστεριών" at={at} stars={<Stars value={t.amount} />}
            title={`${t.fromUser?.name ?? t.fromUserId} → ${t.toUser?.name ?? t.toUserId}`}
            who={t.fromUser && t.toUser && <><Avatar icon={t.fromUser.avatar} color={t.fromUser.color} size={24} /> → <Avatar icon={t.toUser.avatar} color={t.toUser.color} size={24} /></>}>
            <ConfirmButton onConfirm={() => run(() => api.rejectTransfer(t.id), 'Η μεταφορά απορρίφθηκε')}>Απόρριψη</ConfirmButton>
            <button type="button" className="p-btn primary" onClick={() => run(() => api.approveTransfer(t.id), 'Η μεταφορά εγκρίθηκε')}>Έγκριση</button>
        </Card>
    );
}

function SpendingCard({ item: { spending: s, at } }: { item: Extract<InboxItem, { kind: 'spending' }> }) {
    const { run } = useFeedback();
    return (
        <Card icon={s.reward ? <SmartIcon value={s.reward.icon} size={44} /> : '🎀'} kind="Εξαργύρωση" at={at}
            title={s.reward?.title ?? s.rewardId} stars={<Stars value={s.cost} />}
            who={s.user && <><Avatar icon={s.user.avatar} color={s.user.color} size={24} /> {s.user.name}</>}>
            <ConfirmButton onConfirm={() => run(() => api.revokeSpending(s.id), `Ακυρώθηκε· επιστράφηκαν ${s.cost} ⭐`)}>Ακύρωση</ConfirmButton>
            <button type="button" className="p-btn primary" onClick={() => run(() => api.markSpendingDone(s.id), 'Σημειώθηκε ότι δόθηκε')}>Δόθηκε</button>
        </Card>
    );
}

function ChoreCard({ item: { instance, chore, user, at } }: { item: Extract<InboxItem, { kind: 'chore' }> }) {
    const { run } = useFeedback();
    const [stars, setStars] = useState(chore?.defaultStars ?? 0);
    return (
        <Card icon={chore ? <SmartIcon value={chore.icon} size={44} /> : '🧹'} at={at}
            kind={chore?.category === 'bonus' ? 'Bonus δραστηριότητα' : 'Δουλειά'} title={chore?.title ?? instance.choreId}
            who={user && <><Avatar icon={user.avatar} color={user.color} size={24} /> {user.name}</>}
            stars={
                <span className="p-stepper">
                    <button type="button" aria-label="Λιγότερα" onClick={() => setStars(n => Math.max(1, n - 1))}>−</button>
                    <Stars value={stars} />
                    <button type="button" aria-label="Περισσότερα" onClick={() => setStars(n => n + 1)}>+</button>
                </span>
            }>
            <ConfirmButton onConfirm={() => run(() => api.rejectChore(instance.id), 'Η δουλειά απορρίφθηκε')}>Απόρριψη</ConfirmButton>
            <button type="button" className="p-btn primary" onClick={() => run(() => api.confirmChore(instance.id, stars), `Επιβεβαιώθηκε· +${stars} ⭐`)}>Επιβεβαίωση</button>
        </Card>
    );
}
