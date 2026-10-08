import { lazy, Suspense } from 'react';
import type { AppState, ConfigWarning } from '@shared/types';
import { useSearchParams } from 'react-router-dom';
import { useGame } from '../../context/GameContext';
import { FeedbackProvider } from './feedback';
import { HistoryView } from './history/HistoryView';
import { targetsOf } from './settings/model';
import { SettingsView } from './settings/SettingsView';
import { TodayView } from './today/TodayView';
import { useInbox } from './today/useInbox';
import './parent.css';

const AdvancedView = lazy(() => import('./advanced/AdvancedView'));

const VIEWS = [
    { id: 'today', icon: '🏠', label: 'Σήμερα' },
    { id: 'history', icon: '📜', label: 'Ιστορικό' },
    { id: 'settings', icon: '🎁', label: 'Ρυθμίσεις' },
    { id: 'advanced', icon: '🛠️', label: 'Προχωρημένα' },
] as const;
type View = typeof VIEWS[number]['id'];

// The parent dashboard at /parent: everyday tasks first (Σήμερα), config
// forms next, raw JSON last. The open view is in the URL (?view=…).
export function ParentDashboard() {
    const { isConnected, configError, configWarnings } = useGame();
    const waiting = useInbox().length;
    const [params, setParams] = useSearchParams();
    const view: View = VIEWS.find(v => v.id === params.get('view'))?.id ?? 'today';

    return (
        <FeedbackProvider>
            <div className="parent">
                <nav className="p-nav" aria-label="Ενότητες">
                    <div className="p-brand">Γονείς</div>
                    {VIEWS.map(v => (
                        <button key={v.id} type="button" className={view === v.id ? 'p-nav-item on' : 'p-nav-item'}
                            aria-current={view === v.id ? 'page' : undefined} onClick={() => setParams(v.id === 'today' ? {} : { view: v.id })}>
                            <span className="p-nav-icon" aria-hidden>{v.icon}</span>
                            <span className="p-nav-label">{v.label}</span>
                            {v.id === 'today' && waiting > 0 && <span className="p-badge" aria-label={`${waiting} σε αναμονή`}>{waiting}</span>}
                        </button>
                    ))}
                </nav>
                <main className="p-main">
                    <header className="p-header">
                        <h1>{VIEWS.find(v => v.id === view)?.label}</h1>
                        <span className={isConnected ? 'p-live on' : 'p-live'}>{isConnected ? 'Συνδεδεμένο' : 'Επανασύνδεση…'}</span>
                    </header>
                    {configError && <ConfigBanner error={configError} />}
                    {configWarnings.length > 0 && <CronBanner warnings={configWarnings}
                        onOpen={view === 'settings' ? undefined : () => setParams({ view: 'settings' })} />}
                    {view === 'today' && <TodayView />}
                    {view === 'history' && <HistoryView />}
                    {view === 'settings' && <SettingsView />}
                    {view === 'advanced' && <Suspense fallback={<p className="p-empty">Φόρτωση…</p>}><AdvancedView /></Suspense>}
                </main>
            </div>
        </FeedbackProvider>
    );
}

// Crons in the live data.json the scheduler can't read (#89): the file loaded, so everything else runs and
// saves, but these never fire. Names each by what the parent sees in Ρυθμίσεις, where its row has a ⚠.
function CronBanner({ warnings, onOpen }: { warnings: ConfigWarning[]; onOpen?: () => void }) {
    const { config, users } = useGame();
    const targets = targetsOf(config, users);
    const name = (w: ConfigWarning) => {
        if (w.kind === 'chore') return `Η δουλειά «${config.chores?.find(c => c.id === w.id)?.title ?? w.id}» δεν θα εμφανίζεται`;
        const targetId = config.schedules.find(s => s.id === w.id)?.targetId;
        return `Το πρόγραμμα «${targets.find(t => t.id === targetId)?.label ?? targetId ?? w.id}» δεν θα ξεκινά`;
    };
    return (
        <div className="p-banner warn" role="status">
            <strong>{warnings.length === 1 ? 'Μια ώρα (cron) δεν διαβάζεται.' : `${warnings.length} ώρες (cron) δεν διαβάζονται.`}</strong>{' '}
            Οι ρυθμίσεις φόρτωσαν και τα υπόλοιπα δουλεύουν κανονικά, αλλά μέχρι να {warnings.length === 1 ? 'διορθωθεί' : 'διορθωθούν'} στις
            Ρυθμίσεις (εκεί {warnings.length === 1 ? 'έχει' : 'έχουν'} ⚠):
            <ul className="p-banner-list">
                {warnings.map(w => (
                    <li key={w.path}>{name(w)}: «{w.cron}» <span className="p-hint">({w.error})</span></li>
                ))}
            </ul>
            {onOpen && <button type="button" className="p-btn small" onClick={onOpen}>Άνοιγμα Ρυθμίσεων</button>}
        </div>
    );
}

// Says what is live while a config file is invalid: the last valid version, or, when the file
// couldn't be read since the start, an empty one (no kids). Saving is off either way.
function ConfigBanner({ error }: { error: NonNullable<AppState['configError']> }) {
    const data = error.file === 'data.json';
    const where = `Προχωρημένα → ${data ? 'Ρυθμίσεις' : 'Ασκήσεις'} (JSON)`;
    return (
        <div className="p-banner" role="alert">
            {error.emptyFallback ? <>
                <strong>Το {error.file} δεν διαβάζεται από την εκκίνηση.</strong>{' '}
                Η εφαρμογή τρέχει {data ? 'με κενές ρυθμίσεις: χωρίς παιδιά, ρουτίνες και ανταμοιβές' : 'χωρίς τις ασκήσεις του'}.
                Οι αλλαγές δεν αποθηκεύονται μέχρι να διορθωθεί το αρχείο ({where}) ή να επανέλθει από αντίγραφο ασφαλείας.{' '}
            </> : <>
                <strong>Το {error.file} στον δίσκο δεν είναι έγκυρο.</strong>{' '}
                Ισχύουν οι τελευταίες έγκυρες ρυθμίσεις. Οι αλλαγές δεν αποθηκεύονται μέχρι να διορθωθεί ({where}).{' '}
            </>}
            {error.message}
        </div>
    );
}
