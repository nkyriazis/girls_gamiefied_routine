import { useEffect, useRef, useState } from 'react';
import Editor, { loader, type BeforeMount, type OnMount, type OnValidate } from '@monaco-editor/react';
import type { ValidationResult } from '../../../api';
import { useFeedback } from '../useFeedback';

// Monaco comes from jsdelivr (#35 would bundle it), at the version npm installed and audits.
// Without this the loader fetches the version it names itself (0.55.1 in loader 1.7.0).
loader.config({ paths: { vs: `https://cdn.jsdelivr.net/npm/monaco-editor@${__MONACO_VERSION__}/min/vs` } });

/** A schema as Monaco gets it: under its file name, so a relative $ref ("data.schema.json#…") resolves. */
export interface SchemaFile { file: string; schema: object }

interface Props {
    initial?: unknown; // the document, when it is already at hand...
    load?: () => Promise<unknown>; // ...or how to fetch it
    loadText?: () => Promise<string>; // ...or the file's own text, when it doesn't parse
    save: (data: unknown) => Promise<unknown>;
    schemas?: () => Promise<SchemaFile[]>; // the document's schema first, then the ones it $refs
    validate?: (data: unknown) => Promise<ValidationResult>;
    warning?: string;
}

// Raw JSON editing, for what the forms don't cover. The text is loaded once
// when the editor opens and doesn't follow later changes while you edit.
export function JsonEditor({ initial, load, loadText, save, schemas, validate, warning }: Props) {
    const { run } = useFeedback();
    const [text, setText] = useState<string | null>(() => (initial === undefined ? null : JSON.stringify(initial, null, 2)));
    const [errors, setErrors] = useState<string[]>([]);
    const [schemaFiles, setSchemaFiles] = useState<SchemaFile[] | null>(null);

    useEffect(() => {
        load?.().then(data => setText(JSON.stringify(data, null, 2)), err => setErrors([(err as Error).message]));
        loadText?.().then(setText, err => setErrors([(err as Error).message]));
        schemas?.().then(setSchemaFiles, () => undefined);
    }, [load, loadText, schemas]);

    // A file loaded as text is there to be fixed: open it at its first error (a phone shows ~15 lines)
    const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
    const revealed = useRef(false);
    const onValidate: OnValidate = markers => {
        const first = markers.find(m => m.severity === 8); // MarkerSeverity.Error
        if (!loadText || revealed.current || !first || !editorRef.current) return;
        revealed.current = true;
        editorRef.current.revealLineInCenter(first.startLineNumber);
        editorRef.current.setPosition({ lineNumber: first.startLineNumber, column: first.startColumn });
    };

    // Each schema at internal://schemas/<file>, the document's own matching every model. Monaco resolves a
    // $ref against the schema's URI, so exercises.schema.json's "data.schema.json#…" finds data's schema there
    // (at internal://data.schema.json it would look for internal:/data.schema.json and fail).
    const beforeMount: BeforeMount = monaco => {
        if (schemaFiles) {
            monaco.json.jsonDefaults.setDiagnosticsOptions({
                validate: true,
                schemas: schemaFiles.map(({ file, schema }, i) =>
                    ({ uri: `internal://schemas/${file}`, ...(i === 0 ? { fileMatch: ['*'] } : {}), schema })),
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
    if (schemas && !schemaFiles) return <p className="p-empty">Φόρτωση…</p>;
    return (
        <div className="p-json">
            {warning && <p className="p-warning">{warning}</p>}
            <div className="p-json-editor">
                <Editor height="100%" defaultLanguage="json" value={text} theme="vs-dark" beforeMount={beforeMount}
                    onMount={ed => { editorRef.current = ed; }} onValidate={onValidate}
                    onChange={v => setText(v ?? '')}
                    options={{ minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 13, tabSize: 2, automaticLayout: true, wordWrap: 'on' }} />
            </div>
            {errors.length > 0 && <ul className="p-errors">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
            <div className="p-actions"><button type="button" className="p-btn primary" onClick={submit}>Αποθήκευση</button></div>
        </div>
    );
}
