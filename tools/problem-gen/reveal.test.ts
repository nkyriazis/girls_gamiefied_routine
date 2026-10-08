// What «Η σωστή απάντηση: …» may show (#72), run with Node 24 alone:
//   node --test tools/problem-gen/reveal.test.ts
// The caps are measured on the held card (maths/check.ts REVEAL_*); the audit checks every pool with
// the same revealTooLong(), and match() refuses a pair line the card would wrap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Exercise } from '../../shared/types.ts';
import { REVEAL_MAX, REVEAL_PAIR_MAX, REVEAL_PAIRS, revealTooLong } from './maths/check.ts';
import { match } from './maths/lib.ts';
import { G3_MATHS } from './maths/g3.ts';
import { hash, rng } from './lib.ts';

type Plain = Exclude<Exercise, { type: 'problem' }>;
const base = { id: 'x', category: 'Μαθηματικά', title: 'Τ', stars: 1 } as const;
const choice = (right: string): Plain => ({ ...base, type: 'multiple-choice', question: 'Ποιο;', options: [right, 'β'], correctIndex: 0 });
const table = (n: number): [string, string][] => Array.from({ length: n }, (_, i) => [`${i + 2} × 7`, String((i + 2) * 7)]);

test('a match: up to REVEAL_PAIRS pairs, each «a → b» line up to REVEAL_PAIR_MAX', () => {
  assert.equal(REVEAL_PAIRS, 4);
  assert.equal(REVEAL_PAIR_MAX, 21);
  const four = match('Προπαίδεια του 7', 'Σύνδεσε.', table(4));
  assert.ok(four && four.type === 'match-pairs');
  assert.equal(four.pairs.length, 4);
  assert.equal(revealTooLong({ ...base, ...four } as Plain), null);
  // match() never cuts: a family that asks for more than the card shows is a mistake in the family
  assert.throws(() => match('Προπαίδεια του 7', 'Σύνδεσε.', table(5)), /5 pairs/);
  assert.throws(() => match('Προπαίδεια του 7', 'Σύνδεσε.', table(2)), /2 pairs/);
  // «εννιακόσια ενενήντα → 990» is 25 characters, «εξακόσια εξήντα → 660» 21
  const words: [string, string][] = [['εξακόσια εξήντα', '660'], ['διακόσια είκοσι', '220'], ['εφτακόσια εφτά', '707']];
  assert.ok(match('Αριθμοί', 'Σύνδεσε.', words));
  assert.equal(match('Αριθμοί', 'Σύνδεσε.', [...words.slice(0, 2), ['εννιακόσια ενενήντα', '990']]), null);
  const long = { ...base, type: 'match-pairs', body: 'Σύνδεσε.', pairs: [...words, ['εννιακόσια ενενήντα', '990']].map(([left, right]) => ({ left, right })) } as Plain;
  assert.match(revealTooLong(long) ?? '', /«εννιακόσια ενενήντα → 990» is 25 characters/);
  const five = { ...base, type: 'match-pairs', body: 'Σύνδεσε.', pairs: table(5).map(([left, right]) => ({ left, right })) } as Plain;
  assert.match(revealTooLong(five) ?? '', /5 pairs/);
});

test('anything else: up to REVEAL_MAX characters, an ordering with its no-break spaces', () => {
  assert.equal(REVEAL_MAX, 120);
  assert.equal(revealTooLong(choice('α'.repeat(120))), null);
  assert.match(revealTooLong(choice('α'.repeat(121))) ?? '', /121 characters/);
  // Four items of 28 joined by « → » (3 characters each): 4 × 28 + 3 × 3 = 121
  const order = (len: number): Plain => ({ ...base, type: 'ordering', body: 'Βάλε σε σειρά.', items: ['a', 'b', 'c', 'd'].map((id, i) => ({ id, content: String(i).repeat(len) })) });
  assert.match(revealTooLong(order(28)) ?? '', /121 characters/);
  assert.equal(revealTooLong(order(27)), null);
});

test('the times tables ask for 3 pairs: a fourth row would push «Έλεγχος Ζευγαριών» off 800×480', () => {
  for (const id of ['tables-match-a', 'tables-match-b']) {
    const f = G3_MATHS.find(x => x.id === id)!;
    const r = rng(hash(`g3-math:${id}`));
    for (let i = 0; i < 200; i++) {
      const d = f.make(r);
      assert.ok(d && d.type === 'match-pairs');
      assert.equal(d.pairs.length, 3, `${id}: ${JSON.stringify(d.pairs)}`);
    }
  }
});
