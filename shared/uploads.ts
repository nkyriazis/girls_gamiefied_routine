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

/** What the parents' page says when an upload fails (api.ts): the backend's own message when it sent one
 *  (JSON { error }); the limit's message for nginx's 413, which is an HTML page; a word about the connection
 *  when no answer came at all (fetch threw: Wi-Fi gone, or the backend down). */
export function uploadFailed(name: string, answer: { status: number; error?: unknown } | 'no answer'): string {
  if (answer === 'no answer') return `${name}: δεν ανέβηκε, δεν ήρθε απάντηση. Έλεγξε τη σύνδεση και ξαναδοκίμασε.`;
  if (typeof answer.error === 'string' && answer.error) return answer.error;
  if (answer.status === 413) return uploadTooBig(name);
  return `${name}: το ανέβασμα απέτυχε (HTTP ${answer.status}).`;
}
