// A lesson's source as a page of text for the owner to read (show.sh): the pieces, then every step in order.
//   node tools/lessons/show.mjs <lesson.src.json>
import fs from 'node:fs';

const L = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const out = [];
const say = (s = '') => out.push(s);
const piece = id => L.pieces.find(p => p.id === id);
const mask = s => (s.for ? ` [μόνο ${s.for}]` : '') + (s.think ? ` [σκέψου πρώτα: ${s.think === true ? 'όλοι' : s.think}]` : '') + (s.review ? ' [επανάληψη]' : '') + (s.star ? ' ⭐' : '');

say(`# ${L.title}`);
say(`${L.subject}, τάξη ${L.grade}, ${L.source} · ${L.id}`);
say(`${L.pieces.length} κομμάτια, ${L.script.filter(s => s.do === 'ask').length} ερωτήσεις, εικόνες: ${Object.keys(L.pictures ?? {}).join(', ') || 'καμία'}`);
say('\n## Τα κομμάτια');
for (const p of L.pieces) {
  say(`\n### ${p.id} · ${p.title}${p.image ? `  (εικόνα: ${p.image.file}${p.image.caption ? `, «${p.image.caption}»` : ''})` : ''}`);
  p.sentences.forEach((s, k) => {
    say(`${k}. ${k === p.key ? '⭐ ' : ''}${s}`);
    if (p.easy?.[k]) say(`   💡 ${p.easy[k]}`);
  });
  for (const g of p.glossary ?? []) say(`   · ${g.term}: ${g.meaning}`);
}
say('\n## Τα βήματα');
L.script.forEach((s, i) => {
  const at = `${i}. `;
  if (s.do === 'read') return say(`\n${at}διάβασμα ${s.piece} «${piece(s.piece)?.title}»${mask(s)}`);
  if (s.do === 'move') return say(`${at}κίνηση${s.warmup ? ' (ζέσταμα)' : ''}: ${s.text}${mask(s)}`);
  if (s.do === 'explain') return say(`${at}εξήγησε: ${s.prompt}${mask(s)}${s.stems?.length ? `\n     αρχές: ${s.stems.join(' | ')}` : ''}`);
  if (s.do === 'choose') return say(`${at}διάλεξε: ${s.question} (${s.options.map(o => o.label).join(' / ')})`);
  if (s.do !== 'ask') return say(`${at}${s.do}${s.when ? ` (${s.when})` : ''}${mask(s)}`);
  const q = s.question;
  say(`${at}${q.type}${s.piece ? ` στο ${s.piece}` : ''}${s.picture ? ` με εικόνα ${s.picture}` : ''}${mask(s)}: ${q.question ?? q.prompt ?? ''}`);
  const pad = '     ';
  if (q.type === 'multiple-choice') q.options.forEach((o, k) => say(`${pad}${k === q.correctIndex ? '✓' : '✗'} ${o}`));
  if (q.type === 'true-false') say(`${pad}${q.correctValue ? '✓ σωστό' : '✗ λάθος'}`);
  if (q.type === 'fill-blank') say(`${pad}${q.textWithGaps}\n${pad}απάντηση: ${q.correctAnswers.join(', ')} · λέξεις: ${q.options.join(', ')}`);
  if (q.type === 'ordering') q.items.forEach((it, k) => say(`${pad}${k + 1}. ${it.content}`));
  if (q.type === 'match-pairs') q.pairs.forEach(p => say(`${pad}${p.left} → ${p.right}`));
  if (q.type === 'sort') q.items.forEach(it => say(`${pad}${it.text} → ${q.bins[it.bin]}`));
  if (q.type === 'spot') q.regions.forEach((r, k) => say(`${pad}${k === q.correct ? '✓' : '✗'} ${r.label ?? k} (${q.image})`));
  if (q.type === 'find-sentence') for (const k of q.sentences) say(`${pad}✓ ${piece(s.piece)?.sentences[k]}`);
  if (q.evidence?.length) say(`${pad}το λέει: ${q.evidence.map(k => `«${piece(s.piece)?.sentences[k]}»`).join(' ')}`);
});
if (L.talk?.length) { say('\n## Για κουβέντα με τον γονιό'); for (const t of L.talk) say(`- ${t}`); }
console.log(out.join('\n'));
