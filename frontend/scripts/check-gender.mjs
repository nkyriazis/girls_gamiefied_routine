// npm run check-gender: fails when the kids' screens speak to a kid as a girl or a boy.
// Every child uses these screens, so what they read and hear (the text, the owl's lines, a
// step's own `say`) says the same to all: «Τελείωσες;», not «Έτοιμη;»; «Σε ποιο παιδί;»,
// not «Σε ποια;». The words below are gendered and almost always mean a person; rephrase
// around them (a verb, the neuter «παιδί/παιδιά», a plural of things: «όλα έτοιμα»). The list is in
// gendered.mjs, shared with the maths audit (tools/problem-gen/maths/check.ts).
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { genderedWords } from './gendered.mjs';

const SRC = path.resolve(import.meta.dirname, '../src');
const SKIP = [/^components\/parent\//];
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(e.name)) files.push(p);
  }
})(SRC);
const rel = f => path.relative(SRC, f).split(path.sep).join('/');

const problems = [];
let checked = 0;
for (const f of files) {
  const r = rel(f);
  if (SKIP.some(s => s.test(r))) continue;
  const src = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const look = (node, text) => {
    if (!/[Ͱ-Ͽἀ-῿]/.test(text)) return;
    checked++;
    for (const word of genderedWords(text)) {
      const line = src.getLineAndCharacterOfPosition(node.getStart(src)).line + 1;
      problems.push(`${r}:${line} «${text.trim().slice(0, 70)}» says «${word}»: say it the same way to every child`);
    }
  };
  const visit = node => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) look(node, node.text);
    else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) look(node, node.text);
    else if (ts.isJsxText(node)) look(node, node.text);
    ts.forEachChild(node, visit);
  };
  visit(src);
}

if (problems.length) {
  console.error(`check-gender: ${problems.length} problem(s)\n  ` + problems.join('\n  '));
  process.exit(1);
}
console.log(`check-gender: ${checked} Greek texts, none says girl or boy`);
