import type { Chore, ChoreInstance, Spending, StarTransfer, User } from '@shared/types';
import { useGame } from '../../../context/GameContext';

// Everything waiting for a parent, newest first.
export type InboxItem = { id: string; at: string } & (
    | { kind: 'transfer'; transfer: StarTransfer }
    | { kind: 'spending'; spending: Spending }
    | { kind: 'chore'; instance: ChoreInstance; chore?: Chore; user?: User });

export function useInbox(): InboxItem[] {
    const { starTransfers, spendings, choreInstances, chores, users } = useGame();
    const items: InboxItem[] = [
        ...starTransfers.filter(t => t.status === 'pending').map(transfer => ({ kind: 'transfer' as const, id: transfer.id, at: transfer.createdAt, transfer })),
        ...spendings.filter(s => s.status === 'pending').map(spending => ({ kind: 'spending' as const, id: spending.id, at: spending.createdAt, spending })),
        ...choreInstances.filter(i => i.status === 'attempted').map(instance => ({
            kind: 'chore' as const,
            id: instance.id,
            at: instance.attemptedAt ?? instance.availableAt,
            instance,
            chore: chores.find(c => c.id === instance.choreId),
            user: users.find(u => u.id === instance.claimedBy),
        })),
    ];
    return items.sort((a, b) => b.at.localeCompare(a.at));
}
