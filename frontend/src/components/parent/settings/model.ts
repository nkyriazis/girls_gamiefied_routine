import type { DataConfig, IconValue, Schedule, User } from '@shared/types';

// Pure helpers for the config forms.

export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}`;

// The icons forms can set (the schema allows an emoji or an uploaded image).
export type FormIcon = { type: 'emoji' | 'image'; value: string };
export const asFormIcon = (icon: IconValue): FormIcon =>
    typeof icon === 'object' && (icon.type === 'emoji' || icon.type === 'image') ? icon : { type: 'emoji', value: '' };

export interface Target { id: string; type: Schedule['type']; label: string }

// What a schedule (or "start now") can start: flows, and a kid's routine.
export function targetsOf(config: DataConfig, users: User[]): Target[] {
    return [
        ...config.flows.map(f => ({ id: f.id, type: 'flow' as const, label: f.id })),
        ...config.routineAssignments.map(a => ({
            id: a.id, type: 'routine' as const,
            label: `${users.find(u => u.id === a.userId)?.name ?? a.userId}: ${config.routines.find(r => r.id === a.routineId)?.title ?? a.routineId}`,
        })),
    ];
}
