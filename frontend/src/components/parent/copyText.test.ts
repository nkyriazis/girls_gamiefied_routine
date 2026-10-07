// npm test (frontend): copyText copies a file's name on the Pi's plain http too (#108).
// navigator.clipboard exists only in a secure context (https, localhost); on http://<pi>/ it is
// undefined, and the tap used to throw before any toast. Both paths must start inside the tap itself:
// WebKit honours a copy only during the user's gesture, which is gone after an await.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { copyText } from './copyText.ts';

// A minimal page: the body, the element that has focus, the selection, and execCommand
interface FakeArea { value: string; readOnly?: boolean; attrs: Record<string, string>; style: { cssText: string }; selected: string; removed: boolean }
function page({ exec }: { exec: (area: FakeArea | undefined) => boolean }) {
    const calls: string[] = [];
    let area: FakeArea | undefined;
    const button = { focused: false, focus() { this.focused = true; calls.push('focus back'); } };
    const doc = {
        activeElement: button as unknown,
        body: { appendChild(el: FakeArea) { area = el; calls.push('append'); } },
        getSelection: () => ({ rangeCount: 0, removeAllRanges() {}, addRange() {} }),
        createElement(tag: string) {
            assert.equal(tag, 'textarea');
            const el: FakeArea & Record<string, unknown> = {
                value: '', attrs: {}, style: { cssText: '' }, selected: '', removed: false,
                setAttribute(k: string, v: string) { el.attrs[k] = v; },
                select() { el.selected = el.value; doc.activeElement = el; },
                setSelectionRange(a: number, b: number) { el.selected = el.value.slice(a, b); },
                remove() { el.removed = true; calls.push('remove'); },
                focus() {},
            };
            return el;
        },
        execCommand(cmd: string) {
            calls.push(`execCommand ${cmd}`);
            return exec(area);
        },
    };
    return { doc, calls, button, area: () => area };
}

const original = { navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'), document: Object.getOwnPropertyDescriptor(globalThis, 'document') };
function install(nav: unknown, doc: unknown) {
    Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true, writable: true });
    Object.defineProperty(globalThis, 'document', { value: doc, configurable: true, writable: true });
}
afterEach(() => {
    for (const k of ['navigator', 'document'] as const) {
        const d = original[k];
        if (d) Object.defineProperty(globalThis, k, d); else delete (globalThis as Record<string, unknown>)[k];
    }
});

const NAME = '1791411270551-rooster.wav';

test('secure context: writeText, called inside the tap, and nothing else', async () => {
    const p = page({ exec: () => assert.fail('execCommand on a secure page') });
    const written: string[] = [];
    install({ clipboard: { writeText: (t: string) => { written.push(t); return Promise.resolve(); } } }, p.doc);
    const copying = copyText(NAME);
    assert.deepEqual(written, [NAME], 'writeText must be called before copyText returns, not after an await');
    assert.equal(await copying, true);
    assert.deepEqual(p.calls, []);
});

test('secure context, the browser refuses: false, and no execCommand after the gesture is gone', async () => {
    const p = page({ exec: () => assert.fail('execCommand after writeText was refused') });
    install({ clipboard: { writeText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) } }, p.doc);
    assert.equal(await copyText(NAME), false);
    assert.deepEqual(p.calls, []);
});

test('secure context, writeText throws: false, never a throw', async () => {
    const p = page({ exec: () => assert.fail('execCommand after writeText threw') });
    install({ clipboard: { writeText: () => { throw new TypeError('boom'); } } }, p.doc);
    assert.equal(await copyText(NAME), false);
});

test('the Pi (http, no navigator.clipboard): the name is selected and copied inside the tap', async () => {
    let selectedAtCopy = '';
    const p = page({ exec: area => { selectedAtCopy = area?.selected ?? ''; return true; } });
    install({}, p.doc);
    const copying = copyText(NAME);
    // Synchronously: by the time copyText returns, the copy has happened and the page is as it was
    assert.deepEqual(p.calls, ['append', 'execCommand copy', 'remove', 'focus back']);
    assert.equal(selectedAtCopy, NAME);
    const area = p.area()!;
    assert.equal(area.attrs.readonly, '', 'readonly: no keyboard pops up on a phone');
    assert.match(area.style.cssText, /font-size:\s*16px/, '16px: iOS does not zoom in');
    assert.ok(area.removed);
    assert.ok(p.button.focused, 'focus goes back to the row that was tapped');
    assert.equal(await copying, true);
});

test('the Pi, the browser refuses execCommand: false', async () => {
    const p = page({ exec: () => false });
    install({ clipboard: undefined }, p.doc);
    assert.equal(await copyText(NAME), false);
    assert.ok(p.area()!.removed);
});

test('the Pi, execCommand throws: false, never a throw, the textarea still removed', async () => {
    const p = page({ exec: () => { throw new Error('not supported'); } });
    install({}, p.doc);
    assert.equal(await copyText(NAME), false);
    assert.ok(p.area()!.removed);
});
