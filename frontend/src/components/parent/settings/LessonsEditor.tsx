import { useGame } from '../../../context/GameContext';
import { api } from '../../../api';
import { useFeedback } from '../useFeedback';
import { Avatar, ConfirmButton, Empty, Section } from '../ui';
import { gradeLabel } from './model';
import { profileOf } from '@shared/lessons';

// The lessons library: packages prepared on the dev machine (tools/lessons) are imported here, and a kid of
// that class finds them under her exercises, to open when asked. Each lesson shows how far each kid has got,
// and the book's questions to talk about with her afterwards (no right answer for a screen to check).
export function LessonsEditor() {
    const { lessons, lessonRuns, users } = useGame();
    const { run } = useFeedback();

    const importFile = async (input: HTMLInputElement) => {
        const file = input.files?.[0];
        input.value = '';
        if (file) await run(() => api.importLesson(file), r => `${r.replaced ? 'Ενημερώθηκε' : 'Μπήκε στη βιβλιοθήκη'}: ${r.lesson.title}`);
    };

    return (
        <Section title="Μαθήματα" action={
            <label className="p-btn primary">
                Εισαγωγή
                <input type="file" accept=".zip,application/zip" hidden onChange={e => importFile(e.target)} />
            </label>
        }>
            <p className="p-hint">Μαθήματα για διάβασμα (Ιστορία, Γεωγραφία…), σε μικρά κομμάτια με ερωτήσεις. Τα φτιάχνει ο υπολογιστής ανάπτυξης (tools/lessons) σε ένα αρχείο .zip· εδώ μπαίνουν στη βιβλιοθήκη. Τα βλέπουν τα παιδιά της τάξης τους στις ασκήσεις τους.</p>
            {lessons.length === 0 && <Empty>Η βιβλιοθήκη είναι άδεια.</Empty>}
            <ul className="p-list p-lessons">
                {lessons.map(l => {
                    const kids = users.filter(u => u.grade === l.grade);
                    return (
                        <li key={l.id} className="p-lesson">
                            <div className="p-row-main">
                                <span className="p-row-title">{l.icon ?? '📖'} {l.title}</span>
                                <span className="p-row-sub">{l.subject}{l.chapter ? ` · κεφ. ${l.chapter}` : ''} · {gradeLabel(l.grade)} · {l.pieces} κομμάτια</span>
                            </div>
                            <div className="p-lesson-kids">
                                {kids.length === 0 && <span className="p-row-sub">Κανένα παιδί σε αυτή την τάξη.</span>}
                                {kids.map(u => {
                                    const r = lessonRuns.find(x => x.userId === u.id && x.lessonId === l.id);
                                    const wrong = r ? Object.values(r.mistakes).reduce((n, m) => n + m, 0) : 0;
                                    const where = !r || r.stop === 0 && !r.completedAt ? 'δεν το άνοιξε'
                                        : r.completedAt ? `τελείωσε${r.round > 1 ? ` (${r.round}η φορά)` : ''} · ⭐${r.paid.length}`
                                        : `στη μέση · ⭐${r.paid.length}/${l.stars[profileOf(u)]}`;
                                    return (
                                        <span key={u.id} className="p-lesson-kid">
                                            <Avatar icon={u.avatar} color={u.color} size={24} /> {u.name}: {where}{r && wrong > 0 ? ` · ${wrong} λάθη` : ''}
                                        </span>
                                    );
                                })}
                            </div>
                            {l.talk.length > 0 && (
                                <details className="p-lesson-talk">
                                    <summary>Για συζήτηση μετά</summary>
                                    <ul>{l.talk.map(t => <li key={t}>{t}</li>)}</ul>
                                </details>
                            )}
                            <div className="p-lesson-actions">
                                <span className="p-row-sub">{l.source}</span>
                                <ConfirmButton onConfirm={() => run(() => api.deleteLesson(l.id), `Βγήκε από τη βιβλιοθήκη: ${l.title}`)}>Αφαίρεση</ConfirmButton>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </Section>
    );
}
