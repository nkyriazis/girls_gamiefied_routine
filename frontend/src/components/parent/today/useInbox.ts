import type { Chore, ChoreInstance, Reward, Spending, StarTransfer, User } from '@shared/types';
import { useGame } from '../../../context/GameContext';

// Everything waiting for a parent, newest first, with the kids and reward it names by id.
export type InboxItem = { id: string; at: string } & (
    | { kind: 'transfer'; transfer: StarTransfer; from?: User; to?: User }
    | { kind: 'spending'; spending: Spending; user?: User; reward?: Reward }
    | { kind: 'chore'; instance: ChoreInstance; chore?: Chore; user?: User });

export function useInbox(): InboxItem[] {
    const { starTransfers, spendings, choreInstances, chores, rewards, users } = useGame();
    const items: InboxItem[] = [
        ...starTransfers.filter(t => t.status === 'pending').map(transfer => ({
            kind: 'transfer' as const, id: transfer.id, at: transfer.createdAt, transfer,
            from: users.find(u => u.id === transfer.fromUserId), to: users.find(u => u.id === transfer.toUserId),
        })),
        ...spendings.filter(s => s.status === 'pending').map(spending => ({
            kind: 'spending' as const, id: spending.id, at: spending.createdAt, spending,
            user: users.find(u => u.id === spending.userId), reward: rewards.find(r => r.id === spending.rewardId),
        })),
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
