import { useState } from 'react';
import { useGame } from '../../../context/GameContext';
import { Empty, Section } from '../ui';
import { InboxCard } from './InboxCard';
import { KidCard } from './KidCard';
import { StarsSheet } from './StarsSheet';
import { useInbox } from './useInbox';

// The everyday screen: the kids, and what is waiting for a parent.
export function TodayView() {
    const { users, routineRuns } = useGame();
    const inbox = useInbox();
    const [starsFor, setStarsFor] = useState<string | null>(null);
    const kid = users.find(u => u.id === starsFor);

    return (
        <div className="p-today">
            <Section title="Παιδιά">
                <div className="p-kids">
                    {users.map(u => (
                        <KidCard key={u.id} user={u} run={routineRuns.find(r => r.userId === u.id)} onOpen={() => setStarsFor(u.id)} />
                    ))}
                </div>
            </Section>
            <Section title={inbox.length ? `Σε αναμονή · ${inbox.length}` : 'Σε αναμονή'}>
                {inbox.length === 0
                    ? <Empty>Τίποτα δεν περιμένει. Οι αγορές, τα δώρα αστεριών και οι δουλειές των παιδιών θα εμφανιστούν εδώ.</Empty>
                    : <div className="p-inbox">{inbox.map(item => <InboxCard key={item.id} item={item} />)}</div>}
            </Section>
            {kid && <StarsSheet user={kid} onClose={() => setStarsFor(null)} />}
        </div>
    );
}
