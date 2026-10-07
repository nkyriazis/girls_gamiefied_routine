// What things cost, and what a child pays with (#50). One table for change-left and the
// world's purchases, in line with two-purchases and total-cost: toys 5–60 € (the README),
// and a few bigger things for the three-digit amounts of Γ΄ κεφ. 10, paid from the κουμπαράς
// or with 100 and 200 notes.
import type { Rng } from './lib.ts';

export interface Priced {
  /** «ένα παζλ»: what she buys. */
  a: string;
  /** «το παζλ»: the one she bought. */
  the: string;
  /** «του παζλ»: «Τιμή του παζλ». */
  of: string;
  lo: number;
  hi: number;
  big?: boolean;
}

export const PRICED: Priced[] = [
  { a: 'ένα παζλ', the: 'το παζλ', of: 'του παζλ', lo: 9, hi: 25 },
  { a: 'μια μπάλα ποδοσφαίρου', the: 'η μπάλα', of: 'της μπάλας', lo: 10, hi: 25 },
  { a: 'ένα βιβλίο με παραμύθια', the: 'το βιβλίο', of: 'του βιβλίου', lo: 6, hi: 15 },
  { a: 'μια κασετίνα', the: 'η κασετίνα', of: 'της κασετίνας', lo: 6, hi: 15 },
  { a: 'ένα επιτραπέζιο παιχνίδι', the: 'το επιτραπέζιο', of: 'του επιτραπέζιου', lo: 15, hi: 35 },
  { a: 'ένα σακίδιο για το σχολείο', the: 'το σακίδιο', of: 'του σακιδίου', lo: 15, hi: 40 },
  { a: 'μια κούκλα', the: 'η κούκλα', of: 'της κούκλας', lo: 12, hi: 30 },
  { a: 'ένα αυτοκινητάκι', the: 'το αυτοκινητάκι', of: 'του αυτοκινήτου', lo: 5, hi: 14 },
  { a: 'ένα αυτοκίνητο ράλι', the: 'το αυτοκίνητο', of: 'του αυτοκινήτου', lo: 20, hi: 45 },
  { a: 'ένα ζευγάρι πατίνια', the: 'τα πατίνια', of: 'των πατινιών', lo: 25, hi: 60 },
  { a: 'ένα τηλεσκόπιο παιχνίδι', the: 'το τηλεσκόπιο', of: 'του τηλεσκοπίου', lo: 20, hi: 50 },
  { a: 'ένα ποδήλατο', the: 'το ποδήλατο', of: 'του ποδηλάτου', lo: 120, hi: 350, big: true },
  { a: 'μια κιθάρα', the: 'η κιθάρα', of: 'της κιθάρας', lo: 100, hi: 250, big: true },
  { a: 'ένα ηλεκτρικό πιάνο', the: 'το πιάνο', of: 'του πιάνου', lo: 150, hi: 400, big: true },
];
export const TOYS = PRICED.filter(p => !p.big);
export const BIG = PRICED.filter(p => p.big);

/** Euro notes: «πληρώνει με» is a sum of these. */
export const NOTES = [5, 10, 20, 50, 100, 200];

/**
 * What she hands over for a price: a sum of up to `most` notes of `notes`, more than the
 * price, that needs every note (without the smallest the rest wouldn't pay: 20 + 20 for
 * 37 €, not 100 + 10). One of the possible sums, each as likely; null when there is none.
 */
export function payWith(r: Rng, price: number, notes: number[], most = 3): number | null {
  const sums = new Set<number>();
  // notes from the largest down, so the last one added is the smallest
  const desc = [...notes].sort((a, b) => b - a);
  const walk = (from: number, left: number, sum: number, smallest: number) => {
    if (sum > price) { if (sum - smallest < price) sums.add(sum); return; }
    if (!left) return;
    for (let i = from; i < desc.length; i++) walk(i, left - 1, sum + desc[i], desc[i]);
  };
  walk(0, most, 0, 0);
  const all = [...sums].sort((a, b) => a - b);
  // 200 € with 50, 100 and 200 notes: every sum above it has a note to spare
  return all.length ? r.pick(all) : null;
}
