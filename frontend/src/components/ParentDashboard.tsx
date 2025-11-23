import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Editor from '@monaco-editor/react';
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

const JsonEditor = ({ title, loadFn, saveFn, onToast, enableValidation = false, validateFn, schemaUri }: {
    title: string,
    loadFn: () => Promise<any>,
    saveFn: (data: any) => Promise<void>,
    onToast: (message: string, type: ToastType) => void,
    enableValidation?: boolean,
    validateFn?: (data: any) => Promise<{ valid: boolean, errors?: any[] }>,
    schemaUri?: string
}) => {
    const [json, setJson] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [schema, setSchema] = useState<any>(null);
    const editorRef = useRef<any>(null);

    useEffect(() => {
        loadFn().then(data => setJson(JSON.stringify(data, null, 2)));
    }, []);

    // Load schema if provided
    useEffect(() => {
        if (schemaUri) {
            fetch(schemaUri)
                .then(res => res.json())
                .then(schema => setSchema(schema))
                .catch(err => console.error('Failed to load schema:', err));
        }
    }, [schemaUri]);

    // Configure Monaco schema when schema loads
    useEffect(() => {
        if (schema && editorRef.current) {
            const monaco = (window as any).monaco;
            if (monaco) {
                monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
                    validate: true,
                    schemas: [{
                        uri: schemaUri || 'http://internal/schema.json',
                        fileMatch: ['*'],
                        schema: schema
                    }]
                });
            }
        }
    }, [schema, schemaUri]);

    const handleEditorDidMount = async (editor: any, monaco: any) => {
        editorRef.current = editor;

        // Store monaco globally for schema updates
        (window as any).monaco = monaco;

        if (schema) {
            // Configure Monaco to use the schema for validation
            monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
                validate: true,
                schemas: [{
                    uri: schemaUri || 'http://internal/schema.json',
                    fileMatch: ['*'],
                    schema: schema
                }]
            });
        }

        // Add custom completion provider for uploaded files (config editor only)
        if (title.includes('Configuration')) {
            try {
                // Fetch list of uploaded files
                const response = await fetch('/api/admin/uploads/list');
                const uploadedFiles: string[] = await response.json();

                // Register completion provider for icon values
                monaco.languages.registerCompletionItemProvider('json', {
                    provideCompletionItems: (model: any, position: any) => {
                        const textUntilPosition = model.getValueInRange({
                            startLineNumber: 1,
                            startColumn: 1,
                            endLineNumber: position.lineNumber,
                            endColumn: position.column
                        });

                        // Check if we're in an icon/avatar value context
                        const iconValuePattern = /"(icon|avatar)"\s*:\s*\{[^}]*"type"\s*:\s*"image"[^}]*"value"\s*:\s*"[^"]*$/;
                        const inIconValue = iconValuePattern.test(textUntilPosition);

                        if (inIconValue && uploadedFiles.length > 0) {
                            const word = model.getWordUntilPosition(position);
                            const range = {
                                startLineNumber: position.lineNumber,
                                endLineNumber: position.lineNumber,
                                startColumn: word.startColumn,
                                endColumn: word.endColumn
                            };

                            return {
                                suggestions: uploadedFiles.map((file) => ({
                                    label: file,
                                    kind: monaco.languages.CompletionItemKind.File,
                                    insertText: file,
                                    range: range,
                                    detail: 'Uploaded file',
                                    documentation: `/uploads/${file}`
                                }))
                            };
                        }

                        return { suggestions: [] };
                    }
                });
            } catch (err) {
                console.error('Failed to load uploaded files for autocomplete:', err);
            }
        }
    };

    const handleSave = async () => {
        try {
            const parsed = JSON.parse(json);

            // Auto-validate before save if validation is enabled
            if (enableValidation && validateFn) {
                const result = await validateFn(parsed);
                if (!result.valid) {
                    setError('Cannot save: Validation failed');
                    onToast('Cannot save invalid configuration', 'error');
                    return;
                }
            }

            await saveFn(parsed);
            setError(null);
            onToast('Saved!', 'success');
        } catch (err) {
            const message = (err as Error).message;
            setError(message);

            // Try to parse validation errors from backend response
            if (message.includes('Validation failed')) {
                onToast('Validation failed - check inline errors', 'error');
            }
        }
    };

    return (
        <div className="json-editor">
            <div className="editor-header">
                <h3>{title}</h3>
                {enableValidation && schema && (
                    <span className="validation-status">✓ Live validation enabled</span>
                )}
            </div>
            <div className="editor-container">
                <Editor
                    height="100%"
                    defaultLanguage="json"
                    value={json}
                    onChange={(value) => setJson(value || '')}
                    theme="vs-dark"
                    onMount={handleEditorDidMount}
                    options={{
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        fontSize: 13,
                        lineNumbers: 'on',
                        renderValidationDecorations: 'on',
                        automaticLayout: true,
                        formatOnPaste: true,
                        formatOnType: false,
                        tabSize: 2,
                    }}
                />
            </div>
            <div className="editor-footer">
                {error && <div className="error">{error}</div>}
                <div className="button-group">
                    <button onClick={handleSave}>Save {title}</button>
                </div>
            </div>
            <style>{`
        .json-editor { display: flex; flex-direction: column; gap: 0.5rem; height: 600px; }
        .editor-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
        .editor-header h3 { margin: 0; }
        .validation-status { color: #4cc9f0; font-size: 0.85rem; display: flex; align-items: center; gap: 0.3rem; }
        .editor-container { flex: 1; min-height: 0; border: 1px solid #333; border-radius: 4px; overflow: hidden; }
        .editor-footer { display: flex; flex-direction: column; gap: 0.5rem; }
        .error { color: red; font-weight: bold; padding: 0.5rem; background: rgba(255, 0, 0, 0.1); border-radius: 4px; font-size: 0.9rem; max-height: 80px; overflow-y: auto; }
        .button-group { display: flex; gap: 0.5rem; }
        .button-group button { flex: 1; padding: 0.75rem; }
      `}</style>
        </div>
    );
};

export const ParentDashboard: React.FC = () => {
    const { users, spendings, flows, lastEvent } = useGame();
    const [activeTab, setActiveTab] = useState<'dashboard' | 'config' | 'state' | 'debug' | 'logs'>('dashboard');
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [nextToastId, setNextToastId] = useState(0);
    const [validationErrors, setValidationErrors] = useState<{ config?: any, state?: any }>({});
    const [db, setDb] = useState<any>(null);
    const [debugInfo, setDebugInfo] = useState<any>(null);
    const [logs, setLogs] = useState<any[]>([]);

    const showToast = (message: string, type: ToastType = 'info') => {
        const id = nextToastId;
        setNextToastId(id + 1);
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };

    // Load full database for trigger list
    React.useEffect(() => {
        api.getRawData().then(setDb).catch(console.error);
    }, [lastEvent]);

    // Load debug info when tab is active
    React.useEffect(() => {
        if (activeTab === 'debug') {
            api.getScheduleDebug().then(setDebugInfo).catch((err: any) => {
                console.error(err);
                showToast('Failed to load debug info', 'error');
            });
        }
        if (activeTab === 'logs') {
            api.getDebugLogs().then(setLogs).catch((err: any) => {
                console.error(err);
                showToast('Failed to load logs', 'error');
            });
        }
    }, [activeTab]);

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
                    <button className={activeTab === 'debug' ? 'active' : ''} onClick={() => setActiveTab('debug')}>Debug Time</button>
                    <button className={activeTab === 'logs' ? 'active' : ''} onClick={() => setActiveTab('logs')}>Logs</button>
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
                            <h2>Trigger Actions (Test)</h2>
                            {!db ? (
                                <p className="empty">Loading...</p>
                            ) : (
                                <div className="trigger-list">
                                    <div className="trigger-section">
                                        <h3>Schedules</h3>
                                        {db.schedules?.map((s: any) => (
                                            <button key={s.id} onClick={() => handleTrigger(s.targetId)}>
                                                📅 {s.id} ({s.cron})
                                            </button>
                                        ))}
                                    </div>
                                    <div className="trigger-section">
                                        <h3>Flows</h3>
                                        {flows.map(f => (
                                            <button key={f.id} onClick={() => handleTrigger(f.id)}>
                                                🔄 {f.id}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="trigger-section">
                                        <h3>Routine Assignments</h3>
                                        {db.routineAssignments?.map((ra: any) => {
                                            const user = users.find(u => u.id === ra.userId);
                                            const routine = db.routines?.find((r: any) => r.id === ra.routineId);
                                            return (
                                                <button key={ra.id} onClick={() => handleTrigger(ra.id)}>
                                                    👤 {user?.name}: {routine?.title || ra.routineId}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
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
                            schemaUri="/api/admin/schema/data"
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
                            schemaUri="/api/admin/schema/state"
                        />
                    </section>
                )}

                {activeTab === 'debug' && (
                    <section className="card full-width">
                        <h2>Time & Schedule Debug</h2>
                        <div className="debug-info">
                            <button onClick={() => api.getScheduleDebug().then(setDebugInfo)}>Refresh</button>

                            {debugInfo ? (
                                <div className="debug-grid">
                                    <div className="debug-item">
                                        <label>Server Time (ISO):</label>
                                        <code>{debugInfo.serverTime}</code>
                                    </div>
                                    <div className="debug-item">
                                        <label>Server Timezone:</label>
                                        <code>{debugInfo.timezone}</code>
                                    </div>
                                    <div className="debug-item">
                                        <label>Server Time (Local):</label>
                                        <code>{debugInfo.serverTimeLocal}</code>
                                    </div>

                                    <h3>Schedules</h3>
                                    <table className="debug-table">
                                        <thead>
                                            <tr>
                                                <th>ID</th>
                                                <th>Cron</th>
                                                <th>Target</th>
                                                <th>Next Run (ISO)</th>
                                                <th>Next Run (Local)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {debugInfo.schedules.map((s: any) => (
                                                <tr key={s.id}>
                                                    <td>{s.id}</td>
                                                    <td>{s.cron}</td>
                                                    <td>{s.targetId}</td>
                                                    <td>{s.nextRun}</td>
                                                    <td>{s.nextRunLocal}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p>Loading...</p>
                            )}
                        </div>
                    </section>
                )}

                {activeTab === 'logs' && (
                    <section className="card full-width">
                        <div className="editor-header">
                            <h2>Server Action Logs</h2>
                            <button onClick={() => api.getDebugLogs().then(setLogs)}>Refresh</button>
                        </div>
                        <div className="logs-container">
                            <table className="debug-table">
                                <thead>
                                    <tr>
                                        <th>Time</th>
                                        <th>Type</th>
                                        <th>Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => (
                                        <tr key={log.id}>
                                            <td className="whitespace-nowrap">
                                                {format(new Date(log.timestamp), 'HH:mm:ss')}
                                            </td>
                                            <td>
                                                <span className={`log-type type-${log.type.split('_')[0].toLowerCase()}`}>
                                                    {log.type}
                                                </span>
                                            </td>
                                            <td>
                                                <pre className="log-details">
                                                    {JSON.stringify(log.details, null, 2)}
                                                </pre>
                                            </td>
                                        </tr>
                                    ))}
                                    {logs.length === 0 && (
                                        <tr>
                                            <td colSpan={3} style={{ textAlign: 'center', padding: '2rem' }}>
                                                No logs available
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
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
          flex-direction: column;
          gap: 1.5rem;
        }

        .trigger-section h3 {
          margin: 0 0 0.5rem 0;
          font-size: 1rem;
          opacity: 0.7;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .trigger-section {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .trigger-section button {
          justify-content: flex-start;
          text-align: left;
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

        .debug-grid {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            margin-top: 1rem;
        }
        
        .debug-item {
            display: flex;
            gap: 1rem;
            align-items: center;
        }
        
        .debug-item label {
            font-weight: bold;
            color: #aaa;
            width: 150px;
        }
        
        .debug-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 1rem;
        }
        
        .debug-table th, .debug-table td {
            text-align: left;
            padding: 0.5rem;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        
        .debug-table th {
            color: #4cc9f0;
        }

        .logs-container {
            max-height: 600px;
            overflow-y: auto;
        }

        .log-details {
            margin: 0;
            font-size: 0.85rem;
            color: #aaa;
            white-space: pre-wrap;
            max-height: 100px;
            overflow-y: auto;
        }

        .whitespace-nowrap {
            white-space: nowrap;
        }

        .log-type {
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            font-size: 0.8rem;
            font-weight: bold;
        }

        .type-trigger { background: rgba(76, 201, 240, 0.2); color: #4cc9f0; }
        .type-schedule { background: rgba(46, 204, 113, 0.2); color: #2ecc71; }
        .type-push { background: rgba(155, 89, 182, 0.2); color: #9b59b6; }
        .type-spend { background: rgba(241, 196, 15, 0.2); color: #f1c40f; }
        .type-task { background: rgba(230, 126, 34, 0.2); color: #e67e22; }
        .type-alarm { background: rgba(231, 76, 60, 0.2); color: #e74c3c; }
      `}</style>
        </div>
    );
};
