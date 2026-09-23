import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import type { ActionLog } from '@shared/types';
import { api, type ScheduleDebug } from '../../../api';
import { describeCron } from '../cron';

// The server's clock, the next scheduled runs, and the recent action log.
export function LogPanel() {
    const [debug, setDebug] = useState<ScheduleDebug | null>(null);
    const [logs, setLogs] = useState<ActionLog[]>([]);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(() => {
        Promise.all([api.getScheduleDebug(), api.getDebugLogs()])
            .then(([d, l]) => { setDebug(d); setLogs(l); setError(null); }, err => setError((err as Error).message));
    }, []);
    useEffect(refresh, [refresh]);

    return (
        <div className="p-log">
            <div className="p-log-head">
                <div>
                    {debug && <>Ώρα διακομιστή <strong>{debug.serverTimeLocal}</strong> ({debug.timezone})</>}
                    {error && <span className="p-warning">{error}</span>}
                </div>
                <button type="button" className="p-btn ghost small" onClick={refresh}>Ανανέωση</button>
            </div>
            {debug && (
                <ul className="p-list">
                    {debug.schedules.map(s => (
                        <li key={s.id} className="p-row">
                            <span className="p-row-main">
                                <span className="p-row-title">{describeCron(s.cron)} · {s.targetId}</span>
                                <span className="p-row-sub">{s.error ?? `Επόμενη: ${s.nextRunLocal}`}</span>
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            <table className="p-log-table">
                <tbody>
                    {logs.map(l => (
                        <tr key={l.id}>
                            <td>{format(new Date(l.timestamp), 'dd/MM HH:mm:ss')}</td>
                            <td>{l.type}</td>
                            <td><code>{JSON.stringify(l.details)}</code></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
