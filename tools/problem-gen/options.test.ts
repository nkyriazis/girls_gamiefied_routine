// Where a choice puts its right option by length (#50 part 5c), run with Node 24 alone:
//   node --test tools/problem-gen/options.test.ts
// The audit checks the same over every pool (the place rule); these are the pieces on their own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { builder, hash, leadWays, lengthTell, placeLimit, places, placeSeed, promptKey, rng, verdictLead } from './lib.ts';

test('places: options within 2 code points of the right one tie with it, ties split', () => {
  // 13, 14, 16: all within 2 of the right one (14), so every place is a third
  assert.deepEqual(places(['Τους αγνοούμε', 'Τους αφαιρούμε', 'Τους προσθέτουμε'], 1).map(p => +p.toFixed(3)), [0.333, 0.333, 0.333]);
  // 27, 32, 38: the right one (32) is plainly the middle
  assert.deepEqual(places(['Μοιράζω εξίσου στα δύο είδη', 'Παρουσιάζω το πρόβλημα με σχέδιο', 'Προσθέτω τους αριθμούς του προβλήματος'], 1), [0, 1, 0]);
  // 10, 11, 20: the right one (10) ties with 11 for the two shortest places
  assert.deepEqual(places(['aaaaaaaaaa', 'bbbbbbbbbbb', 'cccccccccccccccccccc'], 0), [0.5, 0.5, 0]);
});

test('lengthTell: the only longest is a rule per prompt now, per choice only for the curated pools', () => {
  const opts = ['Βρήκε μόνο την τέταρτη ημέρα', 'Κανένα λάθος, είναι σωστό', 'Ξέχασε να πολλαπλασιάσει'];
  assert.equal(lengthTell(opts, 0), null);
  assert.match(lengthTell(opts, 0, { onlyLongest: true }) ?? '', /only longest/);
  // Standing out at either end stays a rule per choice
  assert.match(lengthTell(['Ναι', 'Όχι', 'Ναι, γιατί έτσι λέει η ιστορία από την αρχή'], 2) ?? '', /stands out/);
  // And the most digits among numbers
  assert.match(lengthTell(['120', '1.200', '12'], 1) ?? '', /digits/);
});

test('promptKey: names (with their article) and numbers aside, synonyms as one', () => {
  assert.equal(promptKey('Κάποιος απάντησε «1.229». Τι έκανε λάθος η Δανάη;'), 'Κάποιος απάντησε «#». Τι έκανε λάθος @;');
  assert.equal(promptKey('Ο Νίκος βρήκε 61. Πώς καταλαβαίνουμε ότι έκανε λάθος;'), promptKey('Η Δανάη βρήκε 524. Πώς καταλαβαίνουμε ότι έκανε λάθος;'));
  assert.equal(promptKey('Πώς οργανώνουμε τη λύση;'), promptKey('Ποιο εργαλείο μας βοηθά;'));
});

test('placeSeed: from the id alone, every place in turn for a prompt every problem asks', () => {
  assert.equal(placeSeed('e5-gen-parts-ratio-007', 'k'), placeSeed('e5-gen-parts-ratio-007', 'k'));
  for (const n of [3, 4]) {
    const got = Array(n).fill(0);
    for (let i = 1; i <= 20; i++) got[Math.floor(placeSeed(`e5-gen-parts-ratio-${String(i).padStart(3, '0')}`, 'Ποια στρατηγική μας βοηθά περισσότερο;') * n)]++;
    assert.ok(Math.max(...got) - Math.min(...got) <= 2, `${n} options: ${got}`);
  }
});

test('placeLimit: a fair die goes over it in less than 1 prompt in 100', () => {
  assert.equal(placeLimit(6, 3), 5); // 6 of 6 at one place fails
  assert.equal(placeLimit(20, 3), 12);
  assert.equal(placeLimit(8, 4), 5);
});

// Lengths 20/14 (right), 24/17 and 22/16/10 (wrong): every place can be reached without a tell
const w = (c: string, ...lengths: number[]) => lengths.map(n => c.repeat(n));
const WORDINGS = { right: w('ρ', 20, 14), wrong: [w('α', 24, 17), w('β', 22, 16, 10)] };

test('builder.choice: one wording each is what it always was', () => {
  for (let seed = 0; seed < 50; seed++) {
    const [r1, r2] = [rng(seed), rng(seed)];
    const step = builder(r1, '', () => 0).choice('plan', 'Ποια στρατηγική;', 'α β γ δ', ['α β γ', 'α β γ δ ε']);
    const options = r2.shuffle(['α β γ δ', 'α β γ', 'α β γ δ ε']);
    assert.deepEqual(step.options, options);
    assert.equal(step.correctIndex, options.indexOf('α β γ δ'));
  }
});

test('builder.choice: wordings spread the right option over the places, never longer than the first ones', () => {
  const won = [0, 0, 0];
  for (let i = 1; i <= 30; i++) {
    const id = `e5-gen-test-${String(i).padStart(3, '0')}`;
    const b = builder(rng(hash(id)), '', key => placeSeed(id, key));
    const step = b.choice('plan', 'Ποια στρατηγική;', WORDINGS.right, WORDINGS.wrong);
    assert.deepEqual(b.tells, []);
    assert.deepEqual(b.uneven, []);
    places(step.options, step.correctIndex).forEach((p, k) => (won[k] += p));
    assert.ok(step.options.every(o => o.length <= 24), `${id}: ${step.options}`);
  }
  assert.ok(Math.max(...won) <= 12 && Math.min(...won) >= 8, `places won ${won}`);
});

test('builder.choice: wordings that can\'t reach a place spread the right option over the others', () => {
  // The right one (20) can't be the shortest: the second is always 4 or 7 below it
  const won = [0, 0, 0];
  let uneven = 0;
  for (let i = 1; i <= 60; i++) {
    const id = `e5-gen-test-${String(i).padStart(3, '0')}`;
    const b = builder(rng(hash(id)), '', key => placeSeed(id, key));
    const step = b.choice('plan', 'Ποια στρατηγική;', 'ρ'.repeat(20), [w('α', 24, 17), w('β', 16, 13)]);
    places(step.options, step.correctIndex).forEach((p, k) => (won[k] += p));
    uneven += b.uneven.length;
  }
  assert.equal(won[0], 0);
  assert.ok(Math.abs(won[1] - won[2]) <= 4, `places won ${won}`);
  assert.equal(uneven, 60);
});

test('builder.choice: no wording that fits is a tell (gen.ts drops the draft)', () => {
  const b = builder(rng(1), '', () => 0.9);
  b.choice('plan', 'Ποια στρατηγική;', 'Ναι', ['Όχι', 'Ναι, γιατί έτσι λέει η ιστορία από την αρχή']);
  assert.equal(b.tells.length, 1);
});

// No option gives the answer away by its first word (#83): what tapping by the verdict word alone wins
test('leadWays: the lone one, a «Ναι» and an «Όχι», each winning 1/k of its k options', () => {
  // One «Ναι» among two «Όχι», right: the lone one and the «Ναι» win it, an «Όχι» doesn't
  assert.deepEqual(leadWays(['Όχι, πρέπει να είναι 495 ευρώ', 'Ναι, είναι λιγότερα από τα 335 ευρώ', 'Όχι, θα είναι πάνω από 335 ευρώ'], 1),
    { lone: 1, yes: 1, no: 0 });
  // ages: the lone «Όχι» is right; a «Ναι» has two options and wins nothing
  assert.deepEqual(leadWays(['Ναι, θα μεγαλώνει κι αυτή', 'Όχι, μεγαλώνουν και οι δύο', 'Ναι, θα γίνεται μικρότερη'], 1),
    { lone: 1, yes: 0, no: 1 });
  // Two «Ναι», one right: a «Ναι» wins half; the lone «Όχι» nothing
  assert.deepEqual(leadWays(['Ναι, γιατί 384 < 650', 'Ναι, γιατί 549 < 650', 'Όχι, γιατί 549 > 650'], 1), { lone: 0, yes: 0.5, no: 0 });
});

test('leadWays: only verdict words lead, with their «,» and «:» forms; «Σωστό» is a yes, «Λάθος» a no', () => {
  assert.equal(verdictLead('Ναι: 4 × 55 = 220 θέσεις'), 'yes');
  assert.equal(verdictLead('  Όχι, θα λείπουν'), 'no');
  assert.equal(verdictLead('Σωστό'), 'yes');
  assert.equal(verdictLead('Λάθος: ξέχασε το κρατούμενο'), 'no');
  // Not a verdict: other first words, articles, a word that only starts like one
  for (const o of ['Είναι κάτω από τα 335 ευρώ', 'Οι 122 χωράνε σε 3 λεωφορεία', 'Πόσες καρέκλες έχει κάθε σειρά', 'Ναίσκος']) assert.equal(verdictLead(o), '-');
  // No option leads with a verdict: nothing to count
  assert.equal(leadWays(['Μένει ίδια', 'Μεγαλώνει', 'Μικραίνει'], 0), null);
  assert.equal(leadWays(['Είναι κάτω από τα 335 ευρώ', 'Είναι πάνω από τα 335 ευρώ', 'Είναι 495 ευρώ: όλα μαζί'], 0), null);
});

test('leadWays: every option sharing its lead leaves no lone one; a lone option without a verdict counts', () => {
  // Every option a «Ναι»: no lone one, a «Ναι» is a third
  assert.deepEqual(leadWays(['Ναι, και θα περισσέψουν', 'Ναι, ακριβώς τόσα', 'Ναι, θα περισσέψουν'], 0), { yes: 1 / 3 });
  // Two «Ναι» and the right one with no verdict: it is the lone one
  assert.deepEqual(leadWays(['Ναι: 4 + 55 = 59 θέσεις', 'Ναι: τους πολλαπλασιάζουμε', 'Συμπίπτουν νωρίτερα, στο 120'], 2), { lone: 1, yes: 0 });
  // «Ναι», «Όχι» and none: each alone, so no lone one (tapping one of three is the die)
  assert.deepEqual(leadWays(['Ναι: 6 κάνουν 9 €', 'Όχι: συμφέρει πάντα η μεγαλύτερη', 'Δεν μπορούμε να το ξέρουμε'], 0), { yes: 1, no: 0 });
});
