// npm test (frontend): shared/themeColours.ts lists exactly the --color-* tokens variables.css defines (#104).
// The backend's config checks accept a colour var(--color-…) only for a token on that list, and the parents'
// colour picker offers some of them: a token added to the theme, or one renamed, must change the list too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { THEME_COLOR_TOKENS } from '../../../shared/themeColours.ts';
import { THEME_COLORS } from '../components/parent/settings/model.ts';

const css = readFileSync(new URL('./variables.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const defined = [...css.matchAll(/--color-([\w-]+)\s*:/g)].map(m => m[1]);

test('the shared list is every --color-* token in variables.css, and nothing else', () => {
    assert.ok(defined.length > 0, 'no --color-* token found in variables.css');
    assert.deepEqual([...new Set(defined)].sort(), [...THEME_COLOR_TOKENS].sort());
});

test("the parents' colour picker offers only tokens on the list", () => {
    for (const { value } of THEME_COLORS) {
        const token = /^var\(--color-([\w-]+)\)$/.exec(value)?.[1];
        assert.ok(token && (THEME_COLOR_TOKENS as readonly string[]).includes(token), value);
    }
});
