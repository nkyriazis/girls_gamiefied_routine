import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import type { HistoryEntry, HistoryPage, IconValue } from '@shared/types';
import { api } from '../../../api';
import { useGame } from '../../../context/GameContext';
import { SmartIcon } from '../../SmartIcon';
import { useFeedback } from '../useFeedback';
import { Empty, Stars } from '../ui';

interface Row {
    key: string;
    at: string;
    icon: IconValue;
    title: string;
    outcome: string;
    stars: number;
    undone: boolean; // rejected, revoked or cancelled: no stars moved
}

const TRANSFER_OUTCOME = { approved: 'Εγκρίθηκε', rejected: 'Απορρίφθηκε', cancelled: 'Ακυρώθηκε από το παιδί', pending: '' };

const idOf = (e: HistoryEntry) => (e.kind === 'spending' ? e.spending : e.kind === 'transfer' ? e.transfer : e.instance).id;
const keyOf = (e: HistoryEntry) => `${e.kind}:${idOf(e)}`;
// The server's order: newest first, ties by id
const older = (a: HistoryEntry, b: HistoryEntry) => a.at < b.at || (a.at === b.at && idOf(a) < idOf(b));

interface Loaded {
    kid: string | null;
    entries: HistoryEntry[];
    next: string | null; // where «Περισσότερα» continues
    olderPages: boolean; // pages after the first are loaded: their cursor, not the first page's, is `next`
}

// The first page, fresh: it replaces what it covers, and the older pages already loaded stay below it
function withFirst(loaded: Loaded, first: HistoryPage): Loaded {
    const last = first.entries[first.entries.length - 1];
    if (!first.next || !loaded.olderPages || !last) return { ...loaded, entries: first.entries, next: first.next, olderPages: false };
    const keys = new Set(first.entries.map(keyOf));
    return { ...loaded, entries: [...first.entries, ...loaded.entries.filter(e => older(e, last) && !keys.has(keyOf(e)))] };
}

function withOlder(loaded: Loaded, page: HistoryPage): Loaded {
    const keys = new Set(loaded.entries.map(keyOf));
    return { ...loaded, entries: [...loaded.entries, ...page.entries.filter(e => !keys.has(keyOf(e)))], next: page.next, olderPages: true };
}

// What parents and kids decided: rewards given, star gifts, chores. It is read from the server a page at a
// time (GET /api/history), since STATE carries only the last 30 days; the first page is read again whenever
// a STATE arrives, so a decision shows up here as it is made. The pages stay in this view (not GameContext).
export function HistoryView() {
    const { spendings, starTransfers, choreInstances, chores, rewards, users } = useGame();
    const { notify } = useFeedback();
    const [kid, setKid] = useState<string | null>(null);
    const [loaded, setLoaded] = useState<Loaded>({ kid: null, entries: [], next: null, olderPages: false });
    const [busy, setBusy] = useState(false);
    const [ready, setReady] = useState(false);
    const kidNow = useRef(kid);
    kidNow.current = kid;

    // On a kid chosen and on every STATE (a decision may have been made): the first page again
    useEffect(() => {
        let current = true;
        api.history(null, kid).then(first => {
            if (!current) return;
            setLoaded(l => withFirst(l.kid === kid ? l : { kid, entries: [], next: null, olderPages: false }, first));
            setReady(true);
        }).catch(() => current && notify('Το ιστορικό δεν διαβάστηκε', 'error'));
        return () => { current = false; };
    }, [kid, spendings, starTransfers, choreInstances, notify]);

    const more = async () => {
        if (!loaded.next) return;
        setBusy(true);
        try {
            const page = await api.history(loaded.next, kid);
            setLoaded(l => (l.kid === kidNow.current && l.next === loaded.next ? withOlder(l, page) : l));
        } catch {
            notify('Το ιστορικό δεν διαβάστηκε', 'error');
        } finally {
            setBusy(false);
        }
    };

    const name = (id?: string) => users.find(u => u.id === id)?.name ?? id ?? '';
    const reward = (id: string) => rewards.find(r => r.id === id);
    const rows: Row[] = loaded.kid !== kid ? [] : loaded.entries.map(e => {
        switch (e.kind) {
            case 'spending': {
                const s = e.spending;
                return {
                    key: keyOf(e), at: e.at, icon: reward(s.rewardId)?.icon ?? '🎀', title: `${name(s.userId)}: ${reward(s.rewardId)?.title ?? s.rewardId}`,
                    outcome: s.status === 'done' ? 'Δόθηκε' : 'Ακυρώθηκε', stars: -s.cost, undone: s.status === 'revoked',
                };
            }
            case 'transfer': {
                const t = e.transfer;
                return {
                    key: keyOf(e), at: e.at, icon: '🎁', title: `${name(t.fromUserId)} → ${name(t.toUserId)}`,
                    outcome: TRANSFER_OUTCOME[t.status], stars: t.amount, undone: t.status !== 'approved',
                };
            }
            case 'chore': {
                const i = e.instance, chore = chores.find(c => c.id === i.choreId);
                return {
                    key: keyOf(e), at: e.at, icon: chore?.icon ?? '🧹', title: `${name(i.claimedBy)}: ${chore?.title ?? i.choreId}`,
                    outcome: i.status === 'confirmed' ? 'Επιβεβαιώθηκε' : 'Απορρίφθηκε', stars: i.starsAwarded ?? 0, undone: i.status === 'rejected',
                };
            }
        }
    });

    return (
        <section className="p-section">
            <div className="p-chips" role="group" aria-label="Παιδί">
                <button type="button" className={kid ? 'p-chip' : 'p-chip on'} onClick={() => setKid(null)}>Όλα</button>
                {users.map(u => (
                    <button key={u.id} type="button" className={kid === u.id ? 'p-chip on' : 'p-chip'} onClick={() => setKid(u.id)}>{u.name}</button>
                ))}
            </div>
            {ready && rows.length === 0 && <Empty>Δεν υπάρχει ακόμη ιστορικό.</Empty>}
            <ul className="p-list">
                {rows.map(e => (
                    <li key={e.key} className={e.undone ? 'p-row undone' : 'p-row'}>
                        <SmartIcon value={e.icon} size={32} />
                        <div className="p-row-main">
                            <div className="p-row-title">{e.title}</div>
                            <div className="p-row-sub">{e.outcome} · {format(new Date(e.at), 'd MMM yyyy, HH:mm', { locale: el })}</div>
                        </div>
                        {e.stars !== 0 && <Stars value={e.stars} sign />}
                    </li>
                ))}
            </ul>
            {loaded.kid === kid && loaded.next && (
                <button type="button" className="p-btn ghost wide" disabled={busy} onClick={more}>{busy ? 'Φόρτωση…' : 'Περισσότερα'}</button>
            )}
        </section>
    );
}
