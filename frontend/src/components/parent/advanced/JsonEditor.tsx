import { useEffect, useState } from 'react';
import Editor, { type BeforeMount } from '@monaco-editor/react';
import type { ValidationResult } from '../../../api';
import { useFeedback } from '../useFeedback';

interface Props {
    initial?: unknown; // the document, when it is already at hand...
    load?: () => Promise<unknown>; // ...or how to fetch it
    save: (data: unknown) => Promise<unknown>;
    schema?: () => Promise<object>;
    validate?: (data: unknown) => Promise<ValidationResult>;
    warning?: string;
}

// Raw JSON editing, for what the forms don't cover. The text is loaded once
// when the editor opens and doesn't follow later changes while you edit.
export function JsonEditor({ initial, load, save, schema, validate, warning }: Props) {
    const { run } = useFeedback();
    const [text, setText] = useState<string | null>(() => (initial === undefined ? null : JSON.stringify(initial, null, 2)));
    const [errors, setErrors] = useState<string[]>([]);
    const [schemaJson, setSchemaJson] = useState<object | null>(null);

    useEffect(() => {
        load?.().then(data => setText(JSON.stringify(data, null, 2)), err => setErrors([(err as Error).message]));
        schema?.().then(setSchemaJson, () => undefined);
    }, [load, schema]);

    const beforeMount: BeforeMount = monaco => {
        if (schemaJson) {
            monaco.json.jsonDefaults.setDiagnosticsOptions({
                validate: true,
                schemas: [{ uri: 'internal://schema.json', fileMatch: ['*'], schema: schemaJson }],
            });
        }
    };

    const submit = async () => {
        let data: unknown;
        try {
            data = JSON.parse(text ?? '');
        } catch (err) {
            setErrors([`Μη έγκυρο JSON: ${(err as Error).message}`]);
            return;
        }
        const result = validate ? await validate(data) : { valid: true };
        if (!result.valid) {
            setErrors((result.errors ?? []).map(e => `${e.instancePath || '/'} ${e.message}`));
            return;
        }
        setErrors([]);
        await run(() => save(data), 'Αποθηκεύτηκε');
    };

    if (text === null) return <p className="p-empty">{errors[0] ?? 'Φόρτωση…'}</p>;
    // Wait for the schema so the editor validates from the start.
    if (schema && !schemaJson) return <p className="p-empty">Φόρτωση…</p>;
    return (
        <div className="p-json">
            {warning && <p className="p-warning">{warning}</p>}
            <div className="p-json-editor">
                <Editor height="100%" defaultLanguage="json" value={text} theme="vs-dark" beforeMount={beforeMount}
                    onChange={v => setText(v ?? '')}
                    options={{ minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 13, tabSize: 2, automaticLayout: true, wordWrap: 'on' }} />
            </div>
            {errors.length > 0 && <ul className="p-errors">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
            <div className="p-actions"><button type="button" className="p-btn primary" onClick={submit}>Αποθήκευση</button></div>
        </div>
    );
}
