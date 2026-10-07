import { useCallback, useRef, useState, type ReactNode } from 'react';
import { FeedbackContext, type Tone } from './useFeedback';

interface Toast { id: number; text: string; tone: Tone }

export function FeedbackProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const nextId = useRef(0);

    const dismiss = useCallback((id: number) => setToasts(list => list.filter(t => t.id !== id)), []);

    // A toast stays long enough to be read: 3 s, or 60 ms a character for a long one (a refusal
    // that says what to do next), at most 12 s. A tap closes it sooner.
    const notify = useCallback((text: string, tone: Tone = 'ok') => {
        const id = nextId.current++;
        setToasts(list => [...list, { id, text, tone }]);
        setTimeout(() => dismiss(id), Math.min(12000, Math.max(3000, text.length * 60)));
    }, [dismiss]);

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
                {toasts.map(t => (
                    <div key={t.id} className={`p-toast ${t.tone}`} onClick={() => dismiss(t.id)}>
                        <span className="p-toast-text">{t.text}</span>
                    </div>
                ))}
            </div>
        </FeedbackContext.Provider>
    );
}
