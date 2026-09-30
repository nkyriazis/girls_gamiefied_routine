// npm run check-sound: fails when something on the kids' screens can be touched and makes
// no sound. The screens sound by themselves for what the page knows is pressable (a
// button, a link, a field: src/sound/SoundProvider.tsx plays "tap", or what the element
// names with {...sound('open')}); anything else she can touch must name its sound, and a
// drag must play its own (sfx(...)) in its file.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const SRC = path.resolve(import.meta.dirname, '../src');
const SKIP = [/^components\/parent\//, /\.help\.ts$/, /^sound\//];
const PRESSABLE = new Set(['button', 'motion.button', 'a', 'motion.a', 'input', 'select', 'textarea', 'label']);
const TOUCH = ['onClick', 'onPointerDown', 'onPointerUp', 'onTouchStart', 'onTouchEnd', 'onMouseDown', 'onMouseUp'];
const DRAG = ['onPointerMove', 'onDrag', 'onDragStart', 'onDragEnd', 'onReorder', 'onTouchMove'];

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.tsx')) files.push(p);
  }
})(SRC);
const rel = f => path.relative(SRC, f).split(path.sep).join('/');

const problems = [];
let touched = 0;
for (const f of files) {
  const r = rel(f);
  if (SKIP.some(s => s.test(r))) continue;
  const text = fs.readFileSync(f, 'utf8');
  const src = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const playsItself = /\bsfx\(/.test(text);
  const visit = node => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(src);
      const attrs = node.attributes.properties;
      const named = n => attrs.find(a => ts.isJsxAttribute(a) && a.name.getText(src) === n);
      const sounded = attrs.some(a => ts.isJsxSpreadAttribute(a) && /^sound\(/.test(a.expression.getText(src)))
        || !!named('data-sound');
      const line = src.getLineAndCharacterOfPosition(node.getStart(src)).line + 1;
      for (const h of TOUCH) {
        const a = named(h);
        if (!a) continue;
        const body = a.initializer?.getText(src) ?? '';
        // Only keeps a tap from reaching the backdrop behind: not something she presses
        if (/^\{\s*\(?\s*e\s*\)?\s*=>\s*e\.stopPropagation\(\)\s*\}$/.test(body)) continue;
        touched++;
        const role = named('role')?.initializer?.getText(src);
        if (sounded || PRESSABLE.has(tag) || role === '"button"') continue;
        problems.push(`${r}:${line} <${tag} ${h}> makes no sound (add {...sound('tap' | 'open' | 'close' | …)}, or make it a <button>)`);
      }
      for (const h of DRAG) {
        if (named(h) && !playsItself && !sounded) problems.push(`${r}:${line} <${tag} ${h}> is dragged in silence (play sfx(...) as it moves)`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
}

if (problems.length) {
  console.error(`check-sound: ${problems.length} problem(s)\n  ` + problems.join('\n  '));
  process.exit(1);
}
console.log(`check-sound: ${touched} things to touch, all of them sound`);
