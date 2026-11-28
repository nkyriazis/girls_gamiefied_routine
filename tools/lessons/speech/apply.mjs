// The owner's answers from the sign-off page into the registry (rules.json), and which lessons to record again
// (tools/lessons/speech/README.md). The answers are the page's `verdicts` collection, as JSON: an array of
// { item, kind, rule | key, verdict: 'ok' | 'wrong' | 'say', say?, note? }; items.json is what review.mjs wrote.
//   node tools/lessons/speech/apply.mjs <verdicts.json> <items.json>
import fs from 'node:fs';
import path from 'node:path';

const [verdictsFile, itemsFile] = process.argv.slice(2);
const here = path.dirname(new URL(import.meta.url).pathname);
const rulesFile = path.join(here, 'rules.json');
const registry = JSON.parse(fs.readFileSync(rulesFile, 'utf8'));
const { voice, items } = JSON.parse(fs.readFileSync(itemsFile, 'utf8'));
const raw = JSON.parse(fs.readFileSync(verdictsFile, 'utf8'));
const verdicts = (Array.isArray(raw) ? raw : raw.documents ?? raw.docs ?? []).map(d => d.data ?? d);
const byItem = Object.fromEntries(items.map(i => [i.id, i]));
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// «ταΰγετος» said as «Ταήγετος»: the part that changes, with a little of the word around it so it doesn't catch
// other words, case kept from the text (the first letters are a group put back as they were)
function wordRule(key, say) {
  const a = key.toLowerCase(), b = say.toLowerCase();
  let p = 0; while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0; while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  const pre = a.slice(Math.max(0, p - 3), p).split(' ').pop(), post = a.slice(a.length - s, a.length - s + 2).split(' ')[0];
  const from = a.slice(p, a.length - s), to = say.slice(p, say.length - s);
  const start = pre.length === p - Math.max(0, p - 3) && p <= 3 ? '\\b' : '';
  return { match: `(?i)${start}(${esc(pre)})${esc(from)}(?=${esc(post)})`, say: `\\g<1>${to}` };
}

const done = [];
for (const v of verdicts) {
  const item = byItem[v.item];
  if (!item) continue;  // an answer to a card from an older round
  if (item.kind === 'rule') {
    const r = registry.rules.find(r => r.id === item.rule);
    if (!r || r.match !== item.match || r.say !== item.say) continue;  // the rule changed since that card
    if (v.verdict === 'ok') Object.assign(r, { status: 'approved', voice }), delete r.note;
    else Object.assign(r, { status: 'rejected', note: v.note || 'sounds wrong' });
    done.push(`rule ${r.id}: ${r.status}`);
  } else if (v.verdict === 'ok') {
    if (!registry.cases.some(c => c.key === item.key && c.voice === voice)) registry.cases.push({ key: item.key, voice });
    done.push(`«${item.key}»: right as written`);
  } else if (v.verdict === 'say' && v.say) {
    const id = `word-${item.key.replace(/\s+/g, '-')}`;
    const rule = { id, ...wordRule(item.key, v.say), why: `the owner: «${item.key}» said as «${v.say}»`, status: 'pending' };
    registry.rules = [...registry.rules.filter(r => r.id !== id), rule];
    done.push(`«${item.key}»: say «${v.say}» (new rule ${id}, ${rule.match} → ${rule.say}, to hear next round)`);
  }
}
fs.writeFileSync(rulesFile, JSON.stringify(registry, null, 2) + '\n');
// The owner's time: from the page's cards to the last answer
const ats = verdicts.filter(v => byItem[v.item]).map(v => Date.parse(v.at)).filter(Boolean);
const owner = ats.length ? Math.round((Math.max(...ats) - fs.statSync(itemsFile).mtimeMs) / 1000) : 0;
fs.appendFileSync(path.join(here, '..', 'work', 'rounds.jsonl'), JSON.stringify({ at: new Date().toISOString(), step: 'apply', lesson: '-',
  secs: owner, n: { cards: items.length, answered: ats.length, ok: verdicts.filter(v => byItem[v.item] && v.verdict === 'ok').length } }) + '\n');
console.log(done.length ? done.join('\n') : 'no answers to apply');
