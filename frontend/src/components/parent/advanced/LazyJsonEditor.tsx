import { Component, lazy, Suspense, type ComponentProps, type ReactNode } from 'react';
import type { JsonEditor as JsonEditorType } from './JsonEditor';

// The JSON editor brings Monaco (~4 MB, #35): it loads when a JSON panel opens, from the Pi, and is
// not in the service worker's precache. So it can fail to load: a device that never opened it and
// can't reach the Pi now, or a Pi that was updated since the page loaded (the old chunk is gone).
class LoadError extends Error {}
const Editor = lazy(() => import('./JsonEditor').then(m => ({ default: m.JsonEditor }), err => {
    throw new LoadError(String(err));
}));

const FAILED = 'Ο επεξεργαστής δεν φορτώθηκε από τον Pi: η συσκευή δεν τον βρίσκει, ή ο Pi πήρε νέα έκδοση. ' +
    'Έλεγξε ότι είσαι στο δίκτυο του σπιτιού και δοκίμασε ξανά.';

// Catches only the editor's code not loading; any other error goes on up, as without it.
// Δοκίμασε ξανά reloads the page: the browser remembers a failed import() for as long as the page
// lives (Chromium asks the server nothing the second time), and a new version needs the new page
// anyway. Nothing is lost: the editor never opened. The page comes back on Προχωρημένα.
class LoadBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
    state = { error: undefined as unknown };
    static getDerivedStateFromError(error: unknown) { return { error }; }
    render() {
        const { error } = this.state;
        if (error === undefined) return this.props.children;
        if (!(error instanceof LoadError)) throw error;
        return (
            <div className="p-stale" role="alert">
                <span>{FAILED}</span>
                <button type="button" className="p-btn small" onClick={() => location.reload()}>Δοκίμασε ξανά</button>
            </div>
        );
    }
}

export function LazyJsonEditor(props: ComponentProps<typeof JsonEditorType>) {
    return (
        <LoadBoundary>
            <Suspense fallback={<p className="p-empty">Φόρτωση…</p>}>
                <Editor {...props} />
            </Suspense>
        </LoadBoundary>
    );
}
