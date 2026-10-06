import { SAME_FILESYSTEM_WARNING, takeBackup } from './backup';
import { BACKUP_DIR, BACKUP_KEEP, DATA_FILE, DB_FILE, EXERCISES_FILE, UPLOADS_DIR } from './paths';

// Take one backup now, into BACKUP_DIR, and rotate (keeps BACKUP_KEEP).
//   npm run backup                 (prod image: docker compose exec backend npm run backup)
//   npm run backup:dev             (dev stack, from the sources)
// The server runs this as a child process every day (backupSchedule.ts) with --json: the
// result as one JSON line on stdout. Exits non-zero on failure.

const json = process.argv.includes('--json');
try {
  const result = takeBackup({
    dbFile: DB_FILE, dataFile: DATA_FILE, exercisesFile: EXERCISES_FILE, uploadsDir: UPLOADS_DIR,
    dir: BACKUP_DIR, keep: BACKUP_KEEP
  });
  if (json) {
    console.log(JSON.stringify(result));
  } else {
    console.log(`Backup written to ${result.folder}`);
    console.log(`  ${result.files} files, ${result.bytes} bytes, in ${result.ms} ms; database integrity: ${result.integrity}`);
    console.log(`  stars in the copy: ${Object.entries(result.stars).map(([id, n]) => `${id} ${n}`).join(', ') || '(none)'}`);
    if (result.removed.length) console.log(`  rotated out (keeping ${BACKUP_KEEP}): ${result.removed.join(', ')}`);
    if (result.sameFilesystem) console.warn(`WARNING: ${SAME_FILESYSTEM_WARNING}`);
  }
} catch (err) {
  console.error(`Backup failed: ${(err as Error).message}`);
  process.exitCode = 1;
}
