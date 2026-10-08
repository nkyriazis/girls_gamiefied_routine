// npm test (frontend): the kids' form (#36) saves kids that look like the hand-written ones
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ConfigUser, DataConfig } from '@shared/types';
import { kidIsValid, newKid, targetsOf, THEME_COLORS, tidyUser } from './model.ts';

const kid = (over: Partial<ConfigUser> = {}): ConfigUser => ({
    id: 'u1', name: 'Ηλέκτρα', avatar: { type: 'emoji', value: '🦊' }, color: 'var(--color-accent)', ...over,
});

test('tidyUser drops the fields left at their defaults, as Σχολείο did', () => {
    assert.deepEqual(tidyUser(kid({ grade: undefined, problemReading: 'marked', forgiveness: 'forgiving' })), kid());
    assert.deepEqual(Object.keys(tidyUser(kid({ grade: undefined }))), ['id', 'name', 'avatar', 'color']);
});

test('tidyUser keeps a class, a reading rung and a strict forgiveness', () => {
    const u = kid({ grade: 3, problemReading: 'paint-all', forgiveness: 'unforgiving' });
    assert.deepEqual(tidyUser(u), u);
    // without a class the rungs stay (hidden), as Σχολείο kept them
    assert.deepEqual(tidyUser({ ...u, grade: undefined }), kid({ problemReading: 'paint-all', forgiveness: 'unforgiving' }));
});

test('tidyUser trims the name', () => {
    assert.equal(tidyUser(kid({ name: '  Ιφιγένεια ' })).name, 'Ιφιγένεια');
});

test('a new kid gets an id nobody has and the first theme colour not in use', () => {
    const users = [kid({ id: 'u1', color: THEME_COLORS[0].value }), kid({ id: 'u2', color: THEME_COLORS[1].value })];
    const k = newKid(users);
    assert.ok(!users.some(u => u.id === k.id));
    assert.match(k.id, /^[a-zA-Z0-9-_]+$/); // the schema's id pattern
    assert.equal(k.color, THEME_COLORS[2].value);
    assert.equal(k.name, '');
    assert.equal(k.grade, undefined);
});

test('when every theme colour is taken, a new kid gets the first one', () => {
    assert.equal(newKid(THEME_COLORS.map((c, i) => kid({ id: `u${i}`, color: c.value }))).color, THEME_COLORS[0].value);
});

test('a kid needs a name, an avatar and a colour', () => {
    const users = [kid()];
    assert.equal(kidIsValid(kid(), users, false), true);
    assert.equal(kidIsValid(kid({ name: '  ' }), users, false), false);
    assert.equal(kidIsValid(kid({ avatar: { type: 'emoji', value: '' } }), users, false), false);
    assert.equal(kidIsValid(kid({ color: '' }), users, false), false);
});

test('a new kid\'s id must be unused; an edited kid keeps hers', () => {
    const users = [kid({ id: 'u1' }), kid({ id: 'u2' })];
    assert.equal(kidIsValid(kid({ id: 'u2' }), users, false), true);
    assert.equal(kidIsValid(kid({ id: 'u2' }), users, true), false);
    assert.equal(kidIsValid(kid({ id: 'kid-new' }), users, true), true);
});

test('targetsOf never offers an assignment or a flow whose id is «alarm» (#121)', () => {
    const icon = { type: 'emoji' as const, value: 'x' };
    const config = {
        users: [], tasks: [], routineTasks: [], schedules: [], rewards: [],
        routines: [{ id: 'r1', title: 'Βραδινή', themeColor: 'red', icon }],
        routineAssignments: [{ id: 'alarm', userId: 'u1', routineId: 'r1' }, { id: 'a1', userId: 'u1', routineId: 'r1' }],
        flows: [{ id: 'alarm', steps: [] }, { id: 'f1', steps: [] }],
    } as DataConfig;
    assert.deepEqual(targetsOf(config, [{ id: 'u1', name: 'Ηλέκτρα' }] as never).map(t => t.id), ['f1', 'a1']);
});
