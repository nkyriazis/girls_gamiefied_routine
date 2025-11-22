import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';
import { SmartIcon } from './SmartIcon';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { useGame } from '../context/GameContext';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

const JsonEditor = ({ title, loadFn, saveFn, onToast }: {
    title: string,
    loadFn: () => Promise<any>,
    saveFn: (data: any) => Promise<void>,
    onToast: (message: string, type: ToastType) => void
}) => {
    const [json, setJson] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadFn().then(data => setJson(JSON.stringify(data, null, 2)));
    }, []);

    const handleSave = async () => {
        try {
            const parsed = JSON.parse(json);
            await saveFn(parsed);
            setError(null);
            onToast('Saved!', 'success');
        } catch (err) {
            setError((err as Error).message);
        }
    };

    return (
        <div className="json-editor">
            <h3>{title}</h3>
            <textarea
                value={json}
                onChange={e => setJson(e.target.value)}
                spellCheck={false}
            />
            {error && <div className="error">{error}</div>}
            <button onClick={handleSave}>Save {title}</button>
            <style>{`
        .json-editor { display: flex; flex-direction: column; gap: 1rem; height: 500px; }
        textarea { flex: 1; background: #111; color: #0f0; font-family: monospace; padding: 1rem; border: 1px solid #333; }
        .error { color: red; }
      `}</style>
        </div>
    );
};

export const ParentDashboard: React.FC = () => {
    const { users, spendings, flows } = useGame();
    const [activeTab, setActiveTab] = useState<'dashboard' | 'config' | 'state'>('dashboard');
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [nextToastId, setNextToastId] = useState(0);

    const showToast = (message: string, type: ToastType = 'info') => {
        const id = nextToastId;
        setNextToastId(id + 1);
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };

    const handleMarkDone = async (id: string) => {
        try {
            await api.markSpendingDone(id);
            showToast('Marked as done', 'success');
        } catch (err) {
            console.error(err);
            showToast('Failed to update', 'error');
        }
    };

    const handleRevoke = async (id: string) => {
        if (!confirm('Are you sure you want to revoke this spending? Stars will be refunded.')) return;
        try {
            await api.revokeSpending(id);
            showToast('Spending revoked', 'success');
        } catch (err) {
            console.error(err);
            showToast('Failed to revoke', 'error');
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        try {
            const result = await api.uploadFile(file);
            showToast(`Uploaded: ${result.url}`, 'success');
            navigator.clipboard.writeText(result.url);
            setTimeout(() => showToast('URL copied to clipboard', 'info'), 500);
        } catch (err) {
            console.error(err);
            showToast('Upload failed', 'error');
        }
    };

    const handleTrigger = async (id: string) => {
        try {
            await api.pushNow(id);
            showToast('Triggered!', 'success');
        } catch (err) {
            console.error(err);
            showToast('Failed to trigger', 'error');
        }
    };

    return (
        <div className="parent-dashboard">
            <AnimatePresence>
                {toasts.map(toast => (
                    <motion.div
                        key={toast.id}
                        className={`toast toast-${toast.type}`}
                        initial={{ opacity: 0, y: -50, x: '-50%' }}
                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, y: -50, x: '-50%' }}
                        transition={{ duration: 0.3 }}
                    >
                        {toast.type === 'success' && '✓ '}
                        {toast.type === 'error' && '✗ '}
                        {toast.type === 'info' && 'ℹ '}
                        {toast.message}
                    </motion.div>
                ))}
            </AnimatePresence>

            <header>
                <h1>Γονείς & Διαχείριση</h1>
                <div className="tabs">
                    <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
                    <button className={activeTab === 'config' ? 'active' : ''} onClick={() => setActiveTab('config')}>Config (data.json)</button>
                    <button className={activeTab === 'state' ? 'active' : ''} onClick={() => setActiveTab('state')}>State (state.json)</button>
                </div>
            </header>

            <main>
                {activeTab === 'dashboard' && (
                    <>
                        <section className="card">
                            <h2>Παιδιά & Αστέρια</h2>
                            <div className="user-list">
                                {users.map(user => (
                                    <div key={user.id} className="user-row">
                                        <div className="user-info">
                                            <SmartIcon value={user.avatar} />
                                            <span>{user.name}</span>
                                        </div>
                                        <div className="stars">⭐ {user.stars}</div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="card">
                            <h2>Εξαργυρώσεις (Pending)</h2>
                            <div className="spending-list">
                                {spendings.filter(s => s.status === 'pending').length === 0 && (
                                    <p className="empty">Καμία εκκρεμότητα</p>
                                )}
                                {spendings.filter(s => s.status === 'pending').map(s => (
                                    <div key={s.id} className="spending-row">
                                        <div className="spending-info">
                                            <span className="spending-user">{s.user?.name}</span>
                                            <span className="spending-reward">
                                                {s.reward ? (
                                                    <>
                                                        <SmartIcon value={s.reward.icon} /> {s.reward.title}
                                                    </>
                                                ) : (
                                                    <span>Unknown Reward</span>
                                                )}
                                            </span>
                                            <span className="spending-date">
                                                {format(new Date(s.createdAt), 'd MMM HH:mm', { locale: el })}
                                            </span>
                                        </div>
                                        <button onClick={() => handleMarkDone(s.id)}>Ολοκληρώθηκε</button>
                                        <button className="danger" onClick={() => handleRevoke(s.id)}>Ακύρωση</button>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="card">
                            <h2>Uploads</h2>
                            <div className="upload-section">
                                <input type="file" onChange={handleFileUpload} />
                                <p className="hint">Upload images for icons/avatars. Copy the URL from the alert to use in data.json.</p>
                            </div>
                        </section>

                        <section className="card">
                            <h2>Ιστορικό Εξαργυρώσεων</h2>
                            <div className="spending-list history">
                                {spendings.filter(s => s.status === 'done').slice(0, 10).map(s => (
                                    <div key={s.id} className="spending-row done">
                                        <div className="spending-info">
                                            <span>{s.user?.name}</span>
                                            <span>{s.reward?.title}</span>
                                            <span className="date">{format(new Date(s.createdAt), 'd MMM HH:mm', { locale: el })}</span>
                                        </div>
                                        <span className="status">Done</span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="card">
                            <h2>Trigger Routines (Test)</h2>
                            <div className="trigger-list">
                                {flows.map(f => (
                                    <button key={f.id} onClick={() => handleTrigger(f.id)}>
                                        Start Flow: {f.id}
                                    </button>
                                ))}
                                {users.map(u => u.routines.map((r: any) => (
                                    <button key={r.id} onClick={() => handleTrigger(r.id)}>
                                        Start {u.name}: {r.title}
                                    </button>
                                )))}
                            </div>
                        </section>
                    </>
                )}

                {activeTab === 'config' && (
                    <section className="card full-width">
                        <JsonEditor
                            title="Configuration (data.json)"
                            loadFn={api.getRawData}
                            saveFn={api.saveRawData}
                            onToast={showToast}
                        />
                    </section>
                )}

                {activeTab === 'state' && (
                    <section className="card full-width">
                        <JsonEditor
                            title="State (state.json)"
                            loadFn={api.getRawState}
                            saveFn={api.saveRawState}
                            onToast={showToast}
                        />
                    </section>
                )}
            </main>

            <style>{`
        .parent-dashboard {
          min-height: 100vh;
          background: #1a1a2e;
          color: white;
          padding: 2rem;
          font-family: system-ui, sans-serif;
        }

        header {
          margin-bottom: 2rem;
          border-bottom: 1px solid rgba(255,255,255,0.1);
          padding-bottom: 1rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .tabs {
          display: flex;
          gap: 1rem;
        }

        .tabs button {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.2);
          color: #aaa;
        }

        .tabs button.active {
          background: #4cc9f0;
          color: #000;
          border-color: #4cc9f0;
        }

        main {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 2rem;
        }

        .card {
          background: rgba(255,255,255,0.05);
          border-radius: 1rem;
          padding: 1.5rem;
          border: 1px solid rgba(255,255,255,0.1);
        }

        .card.full-width {
          grid-column: 1 / -1;
        }

        h2 {
          margin-top: 0;
          font-size: 1.2rem;
          color: #aaa;
          margin-bottom: 1rem;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .user-list {
          max-height: 300px;
          overflow-y: auto;
        }

        .user-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 1rem;
          font-size: 1.2rem;
        }

        .stars {
          color: gold;
          font-weight: bold;
          font-size: 1.2rem;
        }

        .spending-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          max-height: 400px;
          overflow-y: auto;
        }

        .spending-row {
          background: rgba(0,0,0,0.2);
          padding: 1rem;
          border-radius: 0.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .spending-info {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .spending-user {
          font-weight: bold;
          color: var(--color-accent, #4cc9f0);
        }

        .spending-reward {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .spending-date {
          font-size: 0.8rem;
          opacity: 0.5;
        }

        button {
          background: #4cc9f0;
          border: none;
          color: #000;
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          cursor: pointer;
          font-weight: bold;
        }

        button:hover {
          opacity: 0.9;
        }

        button.danger {
          background: #ff4757;
          color: white;
          margin-left: 0.5rem;
        }

        .trigger-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .empty {
          opacity: 0.5;
          font-style: italic;
        }

        .history .spending-row {
          opacity: 0.5;
        }

        .toast {
          position: fixed;
          top: 2rem;
          left: 50%;
          transform: translateX(-50%);
          padding: 1rem 2rem;
          border-radius: 0.5rem;
          font-weight: 600;
          z-index: 9999;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          min-width: 200px;
          text-align: center;
        }

        .toast-success {
          background: #2ecc71;
          color: white;
        }

        .toast-error {
          background: #e74c3c;
          color: white;
        }

        .toast-info {
          background: #3498db;
          color: white;
        }
      `}</style>
        </div>
    );
};
