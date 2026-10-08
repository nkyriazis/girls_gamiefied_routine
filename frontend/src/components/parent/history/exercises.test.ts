// npm test (frontend): how a finished exercise reads in Ιστορικό (#68)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exerciseOutcome } from './exercises.ts';

const problem = { title: 'Το μυστήριο της αρχής', category: 'Προβλήματα', type: 'problem' as const, stars: 3, steps: 5 };
const choice = { title: 'Παροιμίες για τους μύλους', category: 'Γλώσσα', type: 'multiple-choice' as const, stars: 1 };

test('a problem: what it paid of its stars, and the counted wrong tries of each step that had any, 💡 on one shown worked', () => {
    assert.deepEqual(exerciseOutcome({ attempts: 9, starsAwarded: 1, mistakes: [1, 0, 0, 3, 0], shown: [3] }, problem), {
        icon: '🧩', amount: '+⭐1 από 3', chips: [{ text: 'βήμα 1: 1' }, { text: 'βήμα 4: 3 💡', shown: true }], label: '💡 δείχτηκε λυμένο',
    });
    // A step shown with no counted wrong try (a calc step whose slips meant nothing)
    assert.deepEqual(exerciseOutcome({ attempts: 6, starsAwarded: 3, mistakes: [0, 0, 0, 0, 0], shown: [3] }, problem).chips,
        [{ text: 'βήμα 4: 💡', shown: true }]);
    assert.deepEqual(exerciseOutcome({ attempts: 5, starsAwarded: 3, mistakes: [0, 0, 0, 0, 0] }, problem),
        { icon: '🧩', amount: '+⭐3 από 3', chips: [{ text: 'χωρίς λάθη' }] });
    // Αυστηρό: two steps shown worked, nothing paid
    assert.deepEqual(exerciseOutcome({ attempts: 12, starsAwarded: 0, mistakes: [2, 2, 0, 0, 1], shown: [0, 1] }, problem), {
        icon: '🧩', amount: '⭐0 από 3',
        chips: [{ text: 'βήμα 1: 2 💡', shown: true }, { text: 'βήμα 2: 2 💡', shown: true }, { text: 'βήμα 5: 1' }], label: '💡 δείχτηκε λυμένο',
    });
});

test('a plain exercise: right at the 1st, N tries, or its answer shown', () => {
    assert.deepEqual(exerciseOutcome({ attempts: 1, starsAwarded: 1 }, choice), { icon: '📖', amount: '+⭐1 από 1', chips: [{ text: 'σωστό με την 1η' }] });
    assert.deepEqual(exerciseOutcome({ attempts: 3, starsAwarded: 0 }, choice).chips, [{ text: '3 προσπάθειες' }]);
    // A row finished before `shown` was stored: «Δείξε μου» after one wrong try, or Αυστηρό's true/false
    // closed after its one try. It paid nothing, so it never reads «σωστό με την 1η».
    assert.deepEqual(exerciseOutcome({ attempts: 1, starsAwarded: 0 }, choice),
        { icon: '📖', amount: '⭐0 από 1', chips: [{ text: '1 προσπάθεια' }] });
    assert.deepEqual(exerciseOutcome({ attempts: 1, starsAwarded: 0, shown: [0] }, choice),
        { icon: '📖', amount: '⭐0 από 1', chips: [{ text: '💡 δείχτηκε η απάντηση', shown: true }] });
});

test('an exercise gone from the pools: the stars paid alone, a problem told by its steps', () => {
    assert.deepEqual(exerciseOutcome({ attempts: 4, starsAwarded: 2, mistakes: [0, 1, 0] }, null),
        { icon: '✏️', amount: '+⭐2', chips: [{ text: 'βήμα 2: 1' }] });
    assert.deepEqual(exerciseOutcome({ attempts: 1, starsAwarded: 1 }, null).chips, [{ text: 'σωστό με την 1η' }]);
    assert.deepEqual(exerciseOutcome({ attempts: 1, starsAwarded: 0 }, null).chips, [{ text: '1 προσπάθεια' }]);
});

test('a retry (#136): «🔁 ξανά», and «χωρίς βοήθεια» when nothing was shown on it, else its 💡 as usual', () => {
    assert.deepEqual(exerciseOutcome({ attempts: 1, starsAwarded: 1, retryOf: 'a' }, choice),
        { icon: '📖', amount: '+⭐1 από 1', chips: [{ text: '🔁 ξανά', retry: true }, { text: 'χωρίς βοήθεια' }, { text: 'σωστό με την 1η' }] });
    assert.deepEqual(exerciseOutcome({ attempts: 2, starsAwarded: 0, shown: [0], retryOf: 'a' }, choice).chips,
        [{ text: '🔁 ξανά', retry: true }, { text: '💡 δείχτηκε η απάντηση', shown: true }]);
    assert.deepEqual(exerciseOutcome({ attempts: 5, starsAwarded: 2, mistakes: [0, 1, 0, 0, 0], retryOf: 'a' }, problem).chips,
        [{ text: '🔁 ξανά', retry: true }, { text: 'χωρίς βοήθεια' }, { text: 'βήμα 2: 1' }]);
    assert.deepEqual(exerciseOutcome({ attempts: 9, starsAwarded: 1, mistakes: [0, 2, 0, 0, 0], shown: [1], retryOf: 'a' }, problem), {
        icon: '🧩', amount: '+⭐1 από 3', chips: [{ text: '🔁 ξανά', retry: true }, { text: 'βήμα 2: 2 💡', shown: true }], label: '💡 δείχτηκε λυμένο',
    });
});
