import { createContext, useContext } from 'react';

// Toasts for the parent dashboard (FeedbackProvider). run() performs an action
// and reports how it went; the state change itself arrives over the socket.

export type Tone = 'ok' | 'error';

export interface Feedback {
    run: (action: () => Promise<unknown>, done: string) => Promise<boolean>;
    notify: (text: string, tone?: Tone) => void;
}

export const FeedbackContext = createContext<Feedback | null>(null);

export function useFeedback(): Feedback {
    const feedback = useContext(FeedbackContext);
    if (!feedback) throw new Error('useFeedback must be used within FeedbackProvider');
    return feedback;
}
