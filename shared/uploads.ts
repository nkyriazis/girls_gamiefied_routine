// One upload limit for the parents' page, the backend and nginx (#107). An alarm song is the big case:
// 10 MB is about 10 minutes of 128 kbps MP3, plenty for a song that loops, and any avatar photo.
// The backend refuses a bigger file (413) and keeps nothing of it; api.ts refuses it before sending;
// frontend/nginx.conf lets a little more than this through on /api/admin/upload (uploadLimit.test.ts
// checks it). Change the number here and in nginx.conf together.
export const UPLOAD_MAX_MB = 10;
export const UPLOAD_MAX_BYTES = UPLOAD_MAX_MB * 1024 * 1024;

/** The one refusal, wherever it comes from: the page's own check, the backend, or nginx's 413. */
export const uploadTooBig = (name: string) =>
  `${name}: πάνω από ${UPLOAD_MAX_MB} MB, δεν ανέβηκε. Μίκρυνέ το (για ήχο: λιγότερα δευτερόλεπτα ή 128 kbps) και ξαναδοκίμασε.`;

/** The backend's other refusal: a request with no file in it (the page always sends one; curl may not). */
export const uploadNoFile = 'Δεν ήρθε αρχείο: διάλεξε ένα και ξαναδοκίμασε.';

/** The backend failed while reading or writing the file (its 500): the connection dropped mid-file, or the
 *  disk is full (songs in uploads/ and in 14 backups add up, BACKUP.md). Nothing of it is kept. The name is
 *  missing only when the failure came before the file did. */
export const uploadBroke = (name?: string) =>
  `${name ? `${name}: το` : 'Το'} ανέβασμα απέτυχε στον server, δεν κρατήθηκε τίποτα. Ξαναδοκίμασε· αν ξαναγίνει, ίσως γέμισε ο δίσκος του Pi.`;

/** What the parents' page says when an upload fails (api.ts), always in Greek and naming the file: the
 *  backend's two failures and every 413 (the backend's JSON one or nginx's HTML page) read as the backend
 *  words them, from these same functions; any other status (502 when the backend is down behind nginx…)
 *  gets its number; no answer at all (fetch threw: Wi-Fi gone, or the backend down) gets a word about the
 *  connection. The backend's own text is never shown as it came, so an English or HTML answer never shows. */
export function uploadFailed(name: string, answer: { status: number } | 'no answer'): string {
  if (answer === 'no answer') return `${name}: δεν ανέβηκε, δεν ήρθε απάντηση. Έλεγξε τη σύνδεση και ξαναδοκίμασε.`;
  if (answer.status === 413) return uploadTooBig(name);
  if (answer.status === 500) return uploadBroke(name);
  return `${name}: το ανέβασμα απέτυχε (HTTP ${answer.status}).`;
}
