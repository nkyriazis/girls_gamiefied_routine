import type { ExerciseAssignment, ExerciseSummary } from '@shared/types';

// How a finished exercise went, as Ιστορικό shows it (#68): what it paid of its stars, like a ledger
// amount, and counts only, as small chips. A problem: the counted wrong tries of each step that had any
// («βήμα 4: 3»), 💡 on a step shown worked («Δείξε μου», or Αυστηρό after its tries). A plain exercise:
// «σωστό με την 1η» only for one try that paid (a ⭐1 pays only a right first try), else «1 προσπάθεια» or
// «N προσπάθειες», or «💡 δείχτηκε η απάντηση». A row finished before `shown` was stored has none, so a
// «Δείξε μου» after one wrong try reads «1 προσπάθεια» with ⭐0, never «σωστό». A 💡 on a step is said
// once, in the row's line: «💡 δείχτηκε λυμένο» (the same for «Δείξε μου» and Αυστηρό).
// A retry of an item shown worked (#136) starts with «🔁 ξανά», then «χωρίς βοήθεια» when nothing was
// shown on it, else its 💡 chips as any row.

export interface ExerciseChip {
    text: string;
    shown?: boolean; // a step or answer shown worked
    retry?: boolean; // the row is a retry (#136)
}

export interface ExerciseOutcome {
    icon: string;
    amount: string; // «+⭐1 από 3»
    chips: ExerciseChip[];
    label?: string; // what 💡 on a step means, when a step has it
}

const CATEGORY_ICONS: Record<string, string> = { 'Μαθηματικά': '🔢', 'Γλώσσα': '📖', 'Προβλήματα': '🧩' };

type Done = Pick<ExerciseAssignment, 'attempts' | 'starsAwarded' | 'mistakes' | 'shown' | 'retryOf'>;

export function exerciseOutcome(a: Done, exercise: ExerciseSummary | null): ExerciseOutcome {
    const outcome = howItWent(a, exercise);
    if (!a.retryOf) return outcome;
    const helped = !!a.shown?.length;
    return { ...outcome, chips: [{ text: '🔁 ξανά', retry: true }, ...(helped ? [] : [{ text: 'χωρίς βοήθεια' }]), ...outcome.chips] };
}

function howItWent(a: Done, exercise: ExerciseSummary | null): ExerciseOutcome {
    const paid = a.starsAwarded ?? 0;
    const amount = `${paid > 0 ? '+' : ''}⭐${paid}${exercise ? ` από ${exercise.stars}` : ''}`;
    const icon = (exercise && CATEGORY_ICONS[exercise.category]) ?? '✏️';
    const shown = a.shown ?? [];
    // One gone from the pools is a problem if it was answered in steps
    if (exercise ? exercise.type === 'problem' : a.mistakes !== undefined) {
        const steps = Math.max(exercise?.steps ?? 0, a.mistakes?.length ?? 0, ...shown.map(s => s + 1));
        const chips: ExerciseChip[] = [];
        for (let i = 0; i < steps; i++) {
            const wrong = a.mistakes?.[i] ?? 0, worked = shown.includes(i);
            if (!wrong && !worked) continue;
            chips.push({ text: `βήμα ${i + 1}: ${[wrong || '', worked ? '💡' : ''].filter(Boolean).join(' ')}`, ...(worked ? { shown: true } : {}) });
        }
        if (!chips.length) return { icon, amount, chips: [{ text: 'χωρίς λάθη' }] };
        return { icon, amount, chips, ...(shown.length ? { label: '💡 δείχτηκε λυμένο' } : {}) };
    }
    if (shown.includes(0)) return { icon, amount, chips: [{ text: '💡 δείχτηκε η απάντηση', shown: true }] };
    const tries = Math.max(a.attempts, 1);
    const text = paid > 0 && tries === 1 ? 'σωστό με την 1η' : tries === 1 ? '1 προσπάθεια' : `${tries} προσπάθειες`;
    return { icon, amount, chips: [{ text }] };
}
