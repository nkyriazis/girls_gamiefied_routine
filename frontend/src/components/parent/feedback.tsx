import { useCallback, useRef, useState, type ReactNode } from 'react';
import { FeedbackContext, type Tone } from './useFeedback';

interface Toast { id: number; text: string; tone: Tone }

export function FeedbackProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const nextId = useRef(0);

    const notify = useCallback((text: string, tone: Tone = 'ok') => {
        const id = nextId.current++;
        setToasts(list => [...list, { id, text, tone }]);
        setTimeout(() => setToasts(list => list.filter(t => t.id !== id)), 3000);
    }, []);

    const run = useCallback(async <T,>(action: () => Promise<T>, done: string | ((result: T) => string)) => {
        try {
            const result = await action();
            notify(typeof done === 'string' ? done : done(result));
            return true;
        } catch (err) {
            notify((err as Error).message, 'error');
            return false;
        }
    }, [notify]);

    return (
        <FeedbackContext.Provider value={{ run, notify }}>
            {children}
            <div className="p-toasts" role="status" aria-live="polite">
                {toasts.map(t => <div key={t.id} className={`p-toast ${t.tone}`}><span className="p-toast-text">{t.text}</span></div>)}
            </div>
        </FeedbackContext.Provider>
    );
}
