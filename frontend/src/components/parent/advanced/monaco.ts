// Monaco for the parent's JSON editors, bundled (#35): it comes from the Pi with the rest of the app,
// so the editors work on the home LAN with no internet. JSON only: the editor core, its features
// (find, folding, hover, suggest… as editor.main has them), the JSON language and two workers. Every
// other language, and the css/html/ts workers, stay out (the full 'monaco-editor' import is ~19 MB).
// Only JsonEditor imports this, and AdvancedView loads JsonEditor lazily, so Monaco is its own chunk:
// the kids' screens never download it, and the service worker leaves it out (vite.config.ts).
import { loader } from '@monaco-editor/react';
import * as api from 'monaco-editor/editor/editor.api';
import 'monaco-editor/features/register.all';
import * as json from 'monaco-editor/languages/features/json/register';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/language/json/json.worker?worker';

// Monaco asks for a worker when a model needs one: the JSON language service, or the editor's own
self.MonacoEnvironment = {
    getWorker: (_id, label) => (label === 'json' ? new JsonWorker() : new EditorWorker()),
};

// @monaco-editor/react uses this instance instead of fetching Monaco itself (it would from jsdelivr).
// JsonEditor's beforeMount sets the schemas through monaco.json.jsonDefaults, as before.
loader.config({ monaco: { ...api, json } });
