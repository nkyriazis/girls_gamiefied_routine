import { useEffect, useState, type ReactNode } from 'react';
import { formatDistanceStrict } from 'date-fns';
import { el } from 'date-fns/locale';
import type { IconValue } from '@shared/types';
import { SmartIcon } from '../SmartIcon';

// Small pieces shared by the parent views.

export function Stars({ value, sign = false }: { value: number; sign?: boolean }) {
    return <span className="p-stars">⭐ {sign && value > 0 ? '+' : ''}{value}</span>;
}

// A kid's avatar on their colour, like the kids' dock.
export function Avatar({ icon, color, size = 40 }: { icon: IconValue; color: string; size?: number }) {
    return (
        <span className="p-avatar" style={{ background: color, width: size, height: size }}>
            <SmartIcon value={icon} size={size * 0.8} />
        </span>
    );
}

// The current time, updated every minute.
function useNow(): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 60_000);
        return () => clearInterval(timer);
    }, []);
    return now;
}

// "πριν 3 μήνες"; older than a day is marked, since it has waited too long.
export function Ago({ at }: { at: string }) {
    const now = useNow();
    const age = now - new Date(at).getTime();
    return (
        <time className={age > 24 * 3600 * 1000 ? 'p-ago old' : 'p-ago'} dateTime={at} title={new Date(at).toLocaleString('el-GR')}>
            {age < 60_000 ? 'μόλις τώρα' : `πριν ${formatDistanceStrict(new Date(at), now, { locale: el })}`}
        </time>
    );
}

export function Empty({ children }: { children: ReactNode }) {
    return <p className="p-empty">{children}</p>;
}

// A button that asks once more before a destructive action: the first tap
// turns it into "Σίγουρα;" for a few seconds.
export function ConfirmButton({ onConfirm, children, className = 'p-btn danger' }: {
    onConfirm: () => void; children: ReactNode; className?: string;
}) {
    const [armed, setArmed] = useState(false);
    useEffect(() => {
        if (!armed) return;
        const timer = setTimeout(() => setArmed(false), 3000);
        return () => clearTimeout(timer);
    }, [armed]);
    return (
        <button type="button" className={`${className}${armed ? ' armed' : ''}`}
            onClick={() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}>
            {armed ? 'Σίγουρα;' : children}
        </button>
    );
}

// A bottom sheet on phones, a centred dialog on wider screens.
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    return (
        <div className="p-sheet-backdrop" onClick={onClose}>
            <div className="p-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
                <header>
                    <h2>{title}</h2>
                    <button type="button" className="p-icon-btn" aria-label="Κλείσιμο" onClick={onClose}>✕</button>
                </header>
                {children}
            </div>
        </div>
    );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
    return (
        <section className="p-section">
            <header><h2>{title}</h2>{action}</header>
            {children}
        </section>
    );
}
