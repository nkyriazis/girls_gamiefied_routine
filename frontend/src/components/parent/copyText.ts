// Copies text to the clipboard from a tap, on the Pi's plain http too (#108). Resolves to whether it
// worked; never throws. Call it straight from the click handler, before any await of your own.
//
// navigator.clipboard exists only in a secure context (https, localhost). On http://<pi>/ it is
// undefined in every browser, so there the text is selected in a hidden textarea and copied with
// execCommand('copy'), which Chromium and WebKit (Safari on the parents' iPhones) both still honour
// during a user's tap. The order matters for WebKit: each way is tried only while the tap lasts.
// writeText starts synchronously, and when it refuses we report false rather than try execCommand
// after the await, by which time WebKit has dropped the gesture and would refuse that too.
export function copyText(text: string): Promise<boolean> {
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
    if (clipboard?.writeText) {
        try {
            return clipboard.writeText(text).then(() => true, () => false);
        } catch {
            return Promise.resolve(false);
        }
    }
    return Promise.resolve(copyBySelection(text));
}

// The old way: select the text and ask the browser to copy the selection. Puts the page back as it
// was (focus, selection) whatever happens.
function copyBySelection(text: string): boolean {
    let area: HTMLTextAreaElement | undefined;
    const focused = document.activeElement as HTMLElement | null;
    const selection = document.getSelection?.();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : undefined;
    try {
        area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');                       // no keyboard on a phone
        // Out of sight without scrolling the page; 16px so iOS doesn't zoom in on it
        area.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;font-size:16px;contain:strict';
        document.body.appendChild(area);
        area.select();
        area.setSelectionRange(0, text.length);                  // iOS ignores select() alone
        return document.execCommand('copy');
    } catch {
        return false;
    } finally {
        area?.remove();
        if (range && selection) { selection.removeAllRanges(); selection.addRange(range); }
        focused?.focus?.({ preventScroll: true });
    }
}
