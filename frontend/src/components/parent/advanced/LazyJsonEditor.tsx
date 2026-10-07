import { lazy, Suspense, type ComponentProps } from 'react';
import type { JsonEditor as JsonEditorType } from './JsonEditor';

// The JSON editor brings Monaco (~4 MB, #35): it loads when a JSON panel opens, from the Pi, and is
// not in the service worker's precache.
const Editor = lazy(() => import('./JsonEditor').then(m => ({ default: m.JsonEditor })));

export function LazyJsonEditor(props: ComponentProps<typeof JsonEditorType>) {
    return (
        <Suspense fallback={<p className="p-empty">Φόρτωση…</p>}>
            <Editor {...props} />
        </Suspense>
    );
}
