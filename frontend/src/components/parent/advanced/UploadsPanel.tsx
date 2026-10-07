import { useCallback, useEffect, useState } from 'react';
import { UPLOAD_MAX_MB } from '@shared/uploads';
import { api } from '../../../api';
import { copyText } from '../copyText';
import { useFeedback } from '../useFeedback';
import { Empty } from '../ui';

// Uploaded images and sounds; the raw config refers to them by file name.
export function UploadsPanel() {
    const { run, notify } = useFeedback();
    const [files, setFiles] = useState<string[]>([]);
    const refresh = useCallback(() => { api.listUploads().then(setFiles, err => notify((err as Error).message, 'error')); }, [notify]);
    useEffect(refresh, [refresh]);

    const upload = async (file?: File) => {
        if (file && await run(() => api.uploadFile(file), `Ανέβηκε: ${file.name}`)) refresh();
    };
    // The toast says what happened; when the browser refused, the name is there to read (#108)
    const copy = async (name: string) => {
        if (await copyText(name)) notify(`Αντιγράφηκε: ${name}`);
        else notify(`Δεν αντιγράφηκε. Το όνομα: ${name}`, 'error');
    };

    return (
        <div className="p-uploads">
            <label className="p-btn primary">
                Ανέβασμα εικόνας ή ήχου
                <input type="file" accept="image/*,audio/*" hidden onChange={e => upload(e.target.files?.[0])} />
            </label>
            <p className="p-hint">Εικόνες και ήχοι έως {UPLOAD_MAX_MB} MB. Για ξυπνητήρι: MP3, 30 με 60 δευτερόλεπτα.</p>
            {files.length === 0 && <Empty>Δεν έχει ανέβει κανένα αρχείο. Οι εικόνες μπαίνουν και από τα εικονίδια στις φόρμες.</Empty>}
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
