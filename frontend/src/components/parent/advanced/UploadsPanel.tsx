import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../api';
import { useFeedback } from '../useFeedback';

// Uploaded images and sounds; the raw config refers to them by file name.
export function UploadsPanel() {
    const { run, notify } = useFeedback();
    const [files, setFiles] = useState<string[]>([]);
    const refresh = useCallback(() => { api.listUploads().then(setFiles, err => notify((err as Error).message, 'error')); }, [notify]);
    useEffect(refresh, [refresh]);

    const upload = async (file?: File) => {
        if (file && await run(() => api.uploadFile(file), `Ανέβηκε: ${file.name}`)) refresh();
    };
    const copy = (name: string) => navigator.clipboard.writeText(name).then(() => notify(`Αντιγράφηκε: ${name}`), () => notify(name));

    return (
        <div className="p-uploads">
            <label className="p-btn primary">
                Ανέβασμα εικόνας ή ήχου
                <input type="file" accept="image/*,audio/*" hidden onChange={e => upload(e.target.files?.[0])} />
            </label>
            <ul className="p-list">
                {files.map(f => (
                    <li key={f}>
                        <button type="button" className="p-row" onClick={() => copy(f)}>
                            {/\.(png|jpe?g|gif|webp|svg)$/i.test(f) ? <img src={`/uploads/${f}`} alt="" width={32} height={32} /> : <span aria-hidden>🔊</span>}
                            <span className="p-row-main"><span className="p-row-title">{f}</span><span className="p-row-sub">Πάτα για αντιγραφή του ονόματος</span></span>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
