import type { ConfigUser, DataConfig, Forgiveness, IconValue, ProblemReading, Schedule, User } from '@shared/types';
import { themeColor } from '../../../../../shared/themeColours.ts'; // relative, so node --test runs it too
import { CURRICULUM, hasCurriculum, paceAt, placeLabel, type Subject } from '../../../../../shared/curriculum.ts';

// Pure helpers for the config forms.

// An id no other in `taken` has: the base, else base-2, base-3…
export function uniqueId(base: string, taken: Iterable<string> = []): string {
    const ids = new Set(taken);
    let id = base;
    for (let n = 2; ids.has(id); n++) id = `${base}-${n}`;
    return id;
}

// A new id, from the time: two in the same millisecond (one save adding several rows) differ too.
let last = { stamp: '', count: 0 };
export function newId(prefix: string, taken: Iterable<string> = []): string {
    const stamp = Date.now().toString(36);
    last = { stamp, count: stamp === last.stamp ? last.count + 1 : 0 };
    return uniqueId(last.count ? `${prefix}-${stamp}-${last.count}` : `${prefix}-${stamp}`, taken);
}

// The icons forms can set (the schema allows an emoji or an uploaded image).
export type FormIcon = { type: 'emoji' | 'image'; value: string };
export const asFormIcon = (icon: IconValue): FormIcon =>
    typeof icon === 'object' && (icon.type === 'emoji' || icon.type === 'image') ? icon : { type: 'emoji', value: '' };

export interface Target { id: string; type: Schedule['type']; label: string }

// What a schedule (or "start now") can start: flows, and a kid's routine. Not an item whose id is «alarm»:
// a schedule or push with «alarm» rings the plain alarm (triggerAction, #121), so it would never start it;
// the forms show the server's reserved-id warning instead.
export function targetsOf(config: DataConfig, users: User[]): Target[] {
    const startable = <T extends { id: string }>(items: T[]) => items.filter(x => x.id !== 'alarm');
    return [
        ...startable(config.flows).map(f => ({ id: f.id, type: 'flow' as const, label: f.id })),
        ...startable(config.routineAssignments).map(a => ({
            id: a.id, type: 'routine' as const,
            label: `${users.find(u => u.id === a.userId)?.name ?? a.userId}: ${config.routines.find(r => r.id === a.routineId)?.title ?? a.routineId}`,
        })),
    ];
}

// Ποια παιδιά (a chore's eligibleUsers): none means every kid. A tap on a kid keeps only kids, so an id
// that is no kid (hand-written, or a kid since removed) goes on any tap (#121); untouched, the value stays.
export function toggleKid(value: string[] | undefined, id: string, users: { id: string }[]): string[] | undefined {
    const kids = (value ?? []).filter(x => users.some(u => u.id === x));
    const next = kids.includes(id) ? kids.filter(x => x !== id) : [...kids, id];
    return next.length ? next : undefined;
}

// While the value names ids that are no kid, the line that says so, for one or several (#121).
export function missingKidsHint(value: string[] | undefined, users: { id: string }[]): string | null {
    const missing = (value ?? []).filter(x => !users.some(u => u.id === x));
    if (!missing.length) return null;
    const also = missing.length < (value ?? []).length ? 'και ' : '';
    const names = missing.map(x => `«${x}»`).join(', ');
    return `Η δουλειά είναι ${also}για ${names}, που δεν ${missing.length === 1 ? 'υπάρχει' : 'υπάρχουν'}. Πάτα ένα παιδί, ή «Για όλα».`;
}

// The kids (#36). A class picks the daily exercises; Δημοτικό, Α΄ = 1 … ΣΤ΄ = 6.
export const GRADES = ['Α΄', 'Β΄', 'Γ΄', 'Δ΄', 'Ε΄', 'ΣΤ΄'];
export const gradeLabel = (grade?: number) => (grade ? `${GRADES[grade - 1]} Δημοτικού` : 'Χωρίς ασκήσεις');

// The reading ladder of word problems, easiest first
export const READING: { value: ProblemReading; label: string }[] = [
    { value: 'marked', label: 'Πατά τις σημειωμένες φράσεις' },
    { value: 'paint', label: 'Βάφει μόνη της (τα περιττά γκριζάρουν)' },
    { value: 'paint-all', label: 'Βάφει μόνη της και τα περιττά' },
];

// How much mistakes cost (shared/forgiveness.ts): short labels that fit a phone, and a line under the select
export const FORGIVENESS: { value: Forgiveness; label: string; says: string }[] = [
    { value: 'forgiving', label: 'Συγχωρετικό', says: 'Ξαναδοκιμάζει όσο θέλει, −1 ⭐ ανά βήμα με λάθος (μένει τουλάχιστον 1). Μετά από 3 λάθη, «Δείξε μου».' },
    { value: 'unforgiving', label: 'Αυστηρό', says: 'Δύο προσπάθειες ανά βήμα, μετά βλέπει τη λύση. −1 ⭐ ανά βήμα με λάθος (ως 0).' },
];

// A kid's colour: one of the theme's (styles/variables.css), which read well on the dark kids' screen.
// Saved as the var(), as data.json has always had it, so a theme change carries the kids along.
// The tokens come from shared/themeColours.ts, the list the backend's config checks accept (#104).
export const THEME_COLORS: { value: string; label: string }[] = [
    { value: themeColor('primary'), label: 'Κυανό' },
    { value: themeColor('secondary'), label: 'Ροζ' },
    { value: themeColor('accent'), label: 'Χρυσό' },
    { value: themeColor('success'), label: 'Πράσινο' },
    { value: themeColor('warning'), label: 'Πορτοκαλί' },
];

// How far her class has got, per book (#71): «Όπως το βιβλίο» (unset) follows the book's pace and says where
// it is today; a chapter or lesson a parent picks stays until changed. Holiday lessons (pinned) are no place.
export const BOOK_FIELD: Record<Subject, string> = {
    maths: 'Μαθηματικά: ως πού έχει φτάσει η τάξη',
    language: 'Γλώσσα: ως πού έχει φτάσει η τάξη',
};
export function placeOptions(grade: number | undefined, subject: Subject, today: string): { value: string; label: string; group?: string }[] {
    if (!hasCurriculum(grade)) return [];
    const book = CURRICULUM[grade][subject];
    return [
        { value: '', label: `Όπως το βιβλίο (τώρα: ${placeLabel(subject, paceAt(grade, subject, today))})` },
        ...book.chapters.filter(c => !c.pinned).map(c => ({
            value: c.id,
            // The unit is in the label too, not only in its group: a closed select shows the label alone
            label: subject === 'language' && c.id.endsWith('.0') ? placeLabel(subject, c.id) : `${placeLabel(subject, c.id)}: ${c.title}`,
            group: `Ενότητα ${c.unit}${book.unitTitles?.[c.unit] ? `: ${book.unitTitles[c.unit]}` : ''}`,
        })),
    ];
}

// Difficulty is «up to»: unset is all; harder ones come in only when the easier run out
export const DIFFICULTY: { value: '' | '1' | '2'; label: string }[] = [
    { value: '', label: 'Όλες' },
    { value: '2', label: 'Κυρίως εύκολες και μέτριες' },
    { value: '1', label: 'Κυρίως εύκολες' },
];

// Today in the family's timezone (YYYY-MM-DD), where the pace is read
export const todayIn = (timezone: string, now = new Date()) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

// A new class: a place in the old one's books means nothing in the new ones
export const withGrade = (user: ConfigUser, grade: ConfigUser['grade']): ConfigUser =>
    ({ ...user, grade, ...(grade !== user.grade ? { progress: undefined } : {}) });

// A kid as data.json keeps it: the name trimmed, and the fields at their default left out
// (no class, the marked phrases, forgiving, the book's pace, every difficulty), like the hand-written ones.
// A rung stays without a class, as Σχολείο kept it: hidden in the form, back when a class is set again.
export function tidyUser(user: ConfigUser): ConfigUser {
    const next: ConfigUser = { ...user, name: user.name.trim() };
    if (!next.grade) delete next.grade;
    if (!next.problemReading || next.problemReading === 'marked') delete next.problemReading;
    if (!next.forgiveness || next.forgiveness === 'forgiving') delete next.forgiveness;
    const progress = Object.fromEntries(Object.entries(next.progress ?? {}).filter(([, id]) => id));
    if (Object.keys(progress).length) next.progress = progress; else delete next.progress;
    if (!next.difficulty || next.difficulty === 3) delete next.difficulty;
    return next;
}

// A new kid: an id nobody has, an emoji to start with, and a colour no other kid wears (if one is left).
export function newKid(users: ConfigUser[]): ConfigUser {
    const id = newId('kid', users.map(u => u.id));
    const color = THEME_COLORS.find(c => !users.some(u => u.color === c.value)) ?? THEME_COLORS[0];
    return { id, name: '', avatar: { type: 'emoji', value: '🙂' }, color: color.value };
}

// A name, an avatar and a colour; a new kid's id must be free (an edited kid keeps hers).
export function kidIsValid(user: ConfigUser, users: ConfigUser[], isNew: boolean): boolean {
    return user.name.trim() !== ''
        && asFormIcon(user.avatar).value !== ''
        && user.color.trim() !== ''
        && (!isNew || !users.some(u => u.id === user.id));
}
