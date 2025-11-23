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

const JsonEditor = ({ title, loadFn, saveFn, onToast, enableValidation = false, validateFn }: {
    title: string,
    loadFn: () => Promise<any>,
    saveFn: (data: any) => Promise<void>,
    onToast: (message: string, type: ToastType) => void,
    enableValidation?: boolean,
    validateFn?: (data: any) => Promise<{ valid: boolean, errors?: any[] }>
}) => {
    const [json, setJson] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<any[] | null>(null);
    const [isValidating, setIsValidating] = useState(false);
    const [liveValidationEnabled, setLiveValidationEnabled] = useState(false);

    useEffect(() => {
        loadFn().then(data => setJson(JSON.stringify(data, null, 2)));
    }, []);

    // Live validation on text change (debounced)
    useEffect(() => {
        if (!enableValidation || !validateFn || !liveValidationEnabled) return;
        
        const timer = setTimeout(async () => {
            try {
                const parsed = JSON.parse(json);
                const result = await validateFn(parsed);
                
                if (result.valid) {
                    setValidationErrors(null);
                    setError(null);
                } else {
                    setValidationErrors(result.errors || []);
                    setError('Validation errors detected');
                }
            } catch (err) {
                // JSON parse error - don't show validation errors yet
                setError('Invalid JSON syntax');
                setValidationErrors(null);
            }
        }, 1000); // 1 second debounce

        return () => clearTimeout(timer);
    }, [json, enableValidation, validateFn, liveValidationEnabled]);

    const handleValidate = async () => {
        if (!validateFn) return;
        try {
            setIsValidating(true);
            const parsed = JSON.parse(json);
            const result = await validateFn(parsed);
            
            if (result.valid) {
                setValidationErrors(null);
                setError(null);
                onToast('✓ Valid configuration', 'success');
            } else {
                setValidationErrors(result.errors || []);
                setError('Validation failed - see errors below');
            }
        } catch (err) {
            setError((err as Error).message);
            setValidationErrors(null);
        } finally {
            setIsValidating(false);
        }
    };

    const handleSave = async () => {
        try {
            const parsed = JSON.parse(json);
            
            // Auto-validate before save if validation is enabled
            if (enableValidation && validateFn) {
                const result = await validateFn(parsed);
                if (!result.valid) {
                    setValidationErrors(result.errors || []);
                    setError('Cannot save: Validation failed');
                    onToast('Cannot save invalid configuration', 'error');
                    return;
                }
            }
            
            await saveFn(parsed);
            setError(null);
            setValidationErrors(null);
            onToast('Saved!', 'success');
        } catch (err) {
            const message = (err as Error).message;
            setError(message);
            
            // Try to parse validation errors from backend response
            if (message.includes('Validation failed')) {
                onToast('Validation failed - check errors below', 'error');
            }
        }
    };

    const formatValidationError = (err: any) => {
        const path = err.instancePath || '/';
        const message = err.message || 'Unknown error';
        const params = err.params ? ` (${JSON.stringify(err.params)})` : '';
        return `${path}: ${message}${params}`;
    };

    return (
        <div className="json-editor">
            <div className="editor-header">
                <h3>{title}</h3>
                {enableValidation && (
                    <label className="live-validation-toggle">
                        <input 
                            type="checkbox" 
                            checked={liveValidationEnabled}
                            onChange={e => setLiveValidationEnabled(e.target.checked)}
                        />
                        <span>Live validation</span>
                    </label>
                )}
            </div>
            <textarea
                value={json}
                onChange={e => setJson(e.target.value)}
                spellCheck={false}
            />
            {error && <div className="error">{error}</div>}
            {validationErrors && validationErrors.length > 0 && (
                <div className="validation-errors">
                    <strong>Validation Errors ({validationErrors.length}):</strong>
                    <ul>
                        {validationErrors.map((err, idx) => (
                            <li key={idx}>{formatValidationError(err)}</li>
                        ))}
                    </ul>
                </div>
            )}
            <div className="button-group">
                {enableValidation && (
                    <button onClick={handleValidate} disabled={isValidating} className="secondary">
                        {isValidating ? 'Validating...' : 'Validate'}
                    </button>
                )}
                <button onClick={handleSave}>Save {title}</button>
            </div>
            <style>{`
        .json-editor { display: flex; flex-direction: column; gap: 1rem; height: 500px; }
        .editor-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
        .editor-header h3 { margin: 0; }
        .live-validation-toggle { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; cursor: pointer; user-select: none; }
        .live-validation-toggle input[type="checkbox"] { cursor: pointer; }
        .live-validation-toggle span { color: #aaa; }
        textarea { flex: 1; background: #111; color: #0f0; font-family: monospace; padding: 1rem; border: 1px solid #333; }
        .error { color: red; font-weight: bold; padding: 0.5rem; background: rgba(255, 0, 0, 0.1); border-radius: 4px; }
        .validation-errors { color: orange; padding: 0.5rem; background: rgba(255, 165, 0, 0.1); border-radius: 4px; max-height: 200px; overflow-y: auto; }
        .validation-errors ul { margin: 0.5rem 0 0 1.5rem; padding: 0; }
        .validation-errors li { margin: 0.25rem 0; font-family: monospace; font-size: 0.9em; }
        .button-group { display: flex; gap: 0.5rem; }
        .button-group button { flex: 1; }
        .button-group button.secondary { background: #444; }
        .button-group button.secondary:hover { background: #555; }
        .button-group button:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
        </div>
    );
};

export const ParentDashboard: React.FC = () => {
    const { users, spendings, flows, lastEvent } = useGame();
    const [activeTab, setActiveTab] = useState<'dashboard' | 'config' | 'state'>('dashboard');
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [nextToastId, setNextToastId] = useState(0);
    const [validationErrors, setValidationErrors] = useState<{ config?: any, state?: any }>({});

    const showToast = (message: string, type: ToastType = 'info') => {
        const id = nextToastId;
        setNextToastId(id + 1);
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };

    // Listen for validation errors from WebSocket
    React.useEffect(() => {
        if (lastEvent?.type === 'CONFIG_ERROR') {
            showToast('⚠️ Config validation error detected!', 'error');
            setValidationErrors(prev => ({ ...prev, config: lastEvent.payload }));
        } else if (lastEvent?.type === 'STATE_ERROR') {
            showToast('⚠️ State validation error detected!', 'error');
            setValidationErrors(prev => ({ ...prev, state: lastEvent.payload }));
        } else if (lastEvent?.type === 'CONFIG_UPDATED') {
            setValidationErrors(prev => ({ ...prev, config: null }));
        }
    }, [lastEvent]);

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

            {(validationErrors.config || validationErrors.state) && (
                <div className="validation-banner">
                    <div className="banner-icon">⚠️</div>
                    <div className="banner-content">
                        {validationErrors.config && (
                            <div className="banner-error">
                                <strong>Config Validation Error:</strong> {validationErrors.config.message}
                                <button onClick={() => setValidationErrors(prev => ({ ...prev, config: null }))}>Dismiss</button>
                            </div>
                        )}
                        {validationErrors.state && (
                            <div className="banner-error">
                                <strong>State Validation Error:</strong> {validationErrors.state.message}
                                <button onClick={() => setValidationErrors(prev => ({ ...prev, state: null }))}>Dismiss</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

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
                            enableValidation={true}
                            validateFn={api.validateConfig}
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
                            enableValidation={true}
                            validateFn={api.validateState}
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

        .validation-banner {
          background: #ff6b6b;
          border-left: 4px solid #c92a2a;
          padding: 1rem;
          margin: 0 2rem 1rem 2rem;
          border-radius: 4px;
          display: flex;
          gap: 1rem;
          align-items: flex-start;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }

        .banner-icon {
          font-size: 1.5rem;
          flex-shrink: 0;
        }

        .banner-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .banner-error {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        }

        .banner-error strong {
          font-weight: 600;
        }

        .banner-error button {
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.3);
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.85rem;
        }

        .banner-error button:hover {
          background: rgba(255,255,255,0.3);
        }
      `}</style>
        </div>
    );
};
