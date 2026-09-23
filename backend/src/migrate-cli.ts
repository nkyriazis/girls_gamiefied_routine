import { formatVerification, importLegacy, verifyLegacyImport } from './migrate';
import { DB_FILE, LOGS_FILE, STATE_FILE } from './paths';
import { Store } from './store';

// Import state.json + logs.jsonl into the database (if not done yet), then
// verify record by record that nothing was lost. Exits non-zero on mismatch.
//   npm run migrate                  (uses DB_FILE, STATE_FILE, LOGS_FILE)

const sources = { stateFile: STATE_FILE, logsFile: LOGS_FILE };
console.log(`database: ${DB_FILE}\nstate:    ${STATE_FILE}\nlogs:     ${LOGS_FILE}\n`);

const store = new Store(DB_FILE);
try {
  const result = importLegacy(store, sources);
  console.log(result.imported
    ? `Imported legacy files at ${result.importedAt}.\n`
    : `Legacy files were already imported at ${result.importedAt}; nothing to do.\n`);
  const verification = verifyLegacyImport(store, sources);
  console.log(formatVerification(verification));
  process.exitCode = verification.ok ? 0 : 1;
} finally {
  store.close();
}
