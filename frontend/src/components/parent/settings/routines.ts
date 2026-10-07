import type { ConfigRoutine, ConfigTask, DataConfig, RoutineAssignment, RoutineRun, RoutineTask } from '@shared/types';
import { describeCron } from '../cron.ts';
import { asFormIcon, newId, THEME_COLORS, uniqueId } from './model.ts';

// The routine and task forms (#36), as pure functions over the config.
// A routine lives in three lists of data.json: `routines` (name, icon, colour), `routineTasks` (its tasks,
// one row each, with an order and a duration in seconds) and `routineAssignments` (one per kid who has it;
// schedules and flows start a kid's routine by that assignment's id). The form edits a draft of the three,
// and a save writes them back together, changing only that routine's rows and leaving every row nobody
// touched as it was, object for object.

export interface DraftTask {
    rtId?: string; // its routineTasks row; none for a task added in the form
    taskId: string;
    seconds: number; // NaN while the minutes typed aren't a number
}

export interface RoutineDraft extends ConfigRoutine {
    tasks: DraftTask[]; // in order
    kids: string[]; // user ids that have it (one assignment each)
}

export type RoutineLists = Pick<DataConfig, 'routines' | 'routineTasks' | 'routineAssignments'>;

export const DEFAULT_SECONDS = 300;

const rowsOf = (config: DataConfig, routineId: string) =>
    config.routineTasks.filter(rt => rt.routineId === routineId).sort((a, b) => a.order - b.order); // stable: ties keep the file order

const assignmentsOf = (config: DataConfig, routineId: string) => config.routineAssignments.filter(a => a.routineId === routineId);

export function routineDraft(config: DataConfig, routineId: string): RoutineDraft {
    const routine = config.routines.find(r => r.id === routineId) ?? { id: routineId, title: routineId, themeColor: '', icon: { type: 'emoji', value: '' } };
    return {
        ...routine,
        tasks: rowsOf(config, routineId).map(rt => ({ rtId: rt.id, taskId: rt.taskId, seconds: rt.durationSeconds })),
        kids: [...new Set(assignmentsOf(config, routineId).map(a => a.userId))],
    };
}

// A new routine: an id no routine has, a theme colour no routine wears (if one is left), no tasks, no kids.
export function newRoutine(config: DataConfig): RoutineDraft {
    const color = THEME_COLORS.find(c => !config.routines.some(r => r.themeColor === c.value)) ?? THEME_COLORS[0];
    return { id: newId('routine', config.routines.map(r => r.id)), title: '', themeColor: color.value, icon: { type: 'emoji', value: '📋' }, tasks: [], kids: [] };
}

// A task added to a routine takes the time it has in another routine, else 5 minutes.
export function addTask(config: DataConfig, draft: RoutineDraft, taskId: string): RoutineDraft {
    const seconds = config.routineTasks.find(rt => rt.taskId === taskId)?.durationSeconds ?? DEFAULT_SECONDS;
    return { ...draft, tasks: [...draft.tasks, { taskId, seconds }] };
}

export function moveTask(draft: RoutineDraft, index: number, delta: -1 | 1): RoutineDraft {
    const to = index + delta;
    if (to < 0 || to >= draft.tasks.length) return draft;
    const tasks = [...draft.tasks];
    [tasks[index], tasks[to]] = [tasks[to], tasks[index]];
    return { ...draft, tasks };
}

export const removeTaskAt = (draft: RoutineDraft, index: number): RoutineDraft => ({ ...draft, tasks: draft.tasks.filter((_, i) => i !== index) });

// Every id a start can name (POST /api/hooks/push, a schedule, a flow): a new assignment's id must be none of
// them, or it would shadow a flow (triggerAction looks for an assignment first) or be shadowed itself.
function startIds(config: DataConfig): string[] {
    const ids = ['alarm', ...config.routineAssignments.map(a => a.id), ...config.flows.map(f => f.id), ...config.schedules.map(s => s.targetId)];
    for (const flow of config.flows) {
        for (const step of flow.steps) {
            if (step.type === 'routine') ids.push(step.routineId);
            if (step.type === 'parallel') for (const a of step.actions) ids.push(a.type === 'routine' ? a.routineId : a.flowId);
        }
    }
    return ids;
}

const sameIcon = (a: ConfigRoutine['icon'], b: ConfigRoutine['icon']) => JSON.stringify(a) === JSON.stringify(b);

// The routine's rows as the draft has them. Orders already rising along the new sequence stay (a row nobody
// touched is saved exactly, gaps and all), a row added at the end takes the next one; otherwise (a move,
// or ties in hand-written data) the routine's rows are renumbered 1..n.
function draftRows(config: DataConfig, draft: RoutineDraft): RoutineTask[] {
    const byId = new Map(config.routineTasks.filter(rt => rt.routineId === draft.id).map(rt => [rt.id, rt]));
    const kept = draft.tasks.map(t => (t.rtId ? byId.get(t.rtId) : undefined));
    let prev = 0;
    let rising = true;
    const orders = kept.map(rt => {
        const order = rt ? rt.order : prev + 1;
        if (order <= prev) rising = false;
        prev = order;
        return order;
    });
    const taken = config.routineTasks.map(rt => rt.id);
    return draft.tasks.map((t, i) => {
        const rt = kept[i];
        const order = rising ? orders[i] : i + 1;
        if (rt && rt.taskId === t.taskId && rt.order === order && rt.durationSeconds === t.seconds) return rt;
        if (rt) return { ...rt, taskId: t.taskId, order, durationSeconds: t.seconds };
        const id = newId('rt', taken);
        taken.push(id);
        return { id, routineId: draft.id, taskId: t.taskId, order, durationSeconds: t.seconds };
    });
}

// The three lists with the draft saved in them. Only this routine's entries change: its rows fill the
// places its old rows had in the file (extra ones after the last, or at the end), a kid who keeps the
// routine keeps her assignment and its id (schedules and flows name it), a newly ticked kid gets
// `${userId}-${routineId}`, suffixed if that is taken.
export function applyRoutine(config: DataConfig, draft: RoutineDraft, isNew: boolean): RoutineLists {
    const old = isNew ? undefined : config.routines.find(r => r.id === draft.id);
    const title = draft.title.trim();
    const routine: ConfigRoutine = !old
        ? { id: draft.id, title, themeColor: draft.themeColor, icon: draft.icon }
        : old.title === title && old.themeColor === draft.themeColor && sameIcon(old.icon, draft.icon)
            ? old
            : { ...old, title, themeColor: draft.themeColor, icon: draft.icon };
    const routines = old ? config.routines.map(r => (r === old ? routine : r)) : [...config.routines, routine];

    const rows = draftRows(config, draft);
    const oldRows = config.routineTasks.filter(rt => rt.routineId === draft.id);
    let routineTasks = config.routineTasks;
    if (rows.length !== oldRows.length || rows.some(r => !oldRows.includes(r))) {
        const queue = [...rows];
        const last = config.routineTasks.map(rt => rt.routineId).lastIndexOf(draft.id);
        routineTasks = config.routineTasks.flatMap((rt, i) => {
            if (rt.routineId !== draft.id) return [rt];
            const here = queue.length ? [queue.shift()!] : [];
            return i === last ? [...here, ...queue.splice(0)] : here;
        });
        routineTasks.push(...queue);
    }

    const taken = new Set(startIds(config));
    const had = new Set(assignmentsOf(config, draft.id).map(a => a.userId));
    const added: RoutineAssignment[] = draft.kids.filter(userId => !had.has(userId)).map(userId => {
        const id = uniqueId(`${userId}-${draft.id}`, taken);
        taken.add(id);
        return { id, userId, routineId: draft.id };
    });
    const kept = config.routineAssignments.filter(a => a.routineId !== draft.id || draft.kids.includes(a.userId));
    const routineAssignments = added.length || kept.length !== config.routineAssignments.length ? [...kept, ...added] : config.routineAssignments;

    return { routines, routineTasks, routineAssignments };
}

export function removeRoutine(config: DataConfig, routineId: string): RoutineLists {
    return {
        routines: config.routines.filter(r => r.id !== routineId),
        routineTasks: config.routineTasks.filter(rt => rt.routineId !== routineId),
        routineAssignments: config.routineAssignments.filter(a => a.routineId !== routineId),
    };
}

// --- What a kid's routine hangs on, and what the forms refuse ---

// The flows that start an assignment, in a step of their own or in a parallel one
function flowsStarting(config: DataConfig, assignmentId: string): string[] {
    return config.flows.filter(f => f.steps.some(step =>
        (step.type === 'routine' && step.routineId === assignmentId)
        || (step.type === 'parallel' && step.actions.some(a => a.type === 'routine' && a.routineId === assignmentId)),
    )).map(f => f.id);
}

export interface KidNote { userId: string; text: string; locked: boolean }

// One line per kid who has the routine in the draft: when it starts for her, or that nothing starts it.
// `locked`: she can't be unticked, because a schedule or a flow starts it (they name her assignment: remove
// that first) or she is in it on screen now (her run would be left without its routine).
export function kidNotes(config: DataConfig, runs: RoutineRun[], draft: RoutineDraft): KidNote[] {
    const kids = [...config.users.map(u => u.id).filter(id => draft.kids.includes(id)), ...draft.kids.filter(id => !config.users.some(u => u.id === id))];
    return kids.map(userId => {
        const name = config.users.find(u => u.id === userId)?.name ?? userId;
        const ids = assignmentsOf(config, draft.id).filter(a => a.userId === userId).map(a => a.id);
        const running = runs.some(r => ids.includes(r.routineId));
        const schedules = config.schedules.filter(s => s.type === 'routine' && ids.includes(s.targetId));
        const flows = [...new Set(ids.flatMap(id => flowsStarting(config, id)))];
        const sentences: string[] = [];
        if (running) sentences.push('την κάνει τώρα. Για να βγει, περίμενε να τελειώσει.');
        if (schedules.length || flows.length) {
            const starters = [
                ...schedules.map(s => `το Πρόγραμμα (${describeCron(s.cron)})`),
                ...flows.map(f => `η ροή ${f}`),
            ];
            const fixes = [
                ...(schedules.length ? [schedules.length > 1 ? 'σβήσε πρώτα αυτά τα προγράμματα' : 'σβήσε πρώτα αυτό το πρόγραμμα'] : []),
                ...(flows.length ? ['άλλαξε πρώτα τη ροή (Προχωρημένα)'] : []),
            ];
            sentences.push(`${sentences.length ? 'Την' : 'την'} ξεκινά ${starters.join(' και ')}. Για να βγει, ${fixes.join(' και ')}.`);
        }
        return sentences.length
            ? { userId, locked: true, text: `${name}: ${sentences.join(' ')}` }
            : { userId, locked: false, text: `${name}: χωρίς ώρα — πρόσθεσε στο Πρόγραμμα.` };
    });
}

// Whether the draft unticks a kid who can't be unticked now, by the live config and runs (a schedule
// or a run may have come since the sheet opened, when her chip was still free).
export function dropsLockedKid(config: DataConfig, runs: RoutineRun[], draft: RoutineDraft): boolean {
    return kidNotes(config, runs, routineDraft(config, draft.id)).some(n => n.locked && !draft.kids.includes(n.userId));
}

// Why the routine can't be deleted now, or null: a kid can't lose it. The sheet shows why above, in
// her note (kidNotes), so this names the kids.
export function routineLock(config: DataConfig, runs: RoutineRun[], routineId: string): string | null {
    const locked = kidNotes(config, runs, routineDraft(config, routineId)).filter(n => n.locked);
    const names = locked.map(n => config.users.find(u => u.id === n.userId)?.name ?? n.userId);
    return locked.length ? `Δεν διαγράφεται ακόμα. Πρώτα να μπορούν να βγουν από αυτήν: ${names.join(', ')} (δες πιο πάνω γιατί).` : null;
}

// The kids who have this routine on screen now. Its task list is then locked: the run counts tasks by
// position (taskIndex), so a task added, removed or moved would put her on another task or past the end.
export function runningKids(config: DataConfig, runs: RoutineRun[], routineId: string): string[] {
    const ids = assignmentsOf(config, routineId).map(a => a.id);
    return [...new Set(runs.filter(r => ids.includes(r.routineId)).map(r => r.userId))];
}

// The routines a task is in, by title
export function taskUses(config: DataConfig, taskId: string): string[] {
    const ids = new Set(config.routineTasks.filter(rt => rt.taskId === taskId).map(rt => rt.routineId));
    return [...ids].map(id => config.routines.find(r => r.id === id)?.title ?? id);
}

// Why the task can't be deleted, or null: a routine uses it (it would drop out of the routine unseen).
export function taskLock(config: DataConfig, taskId: string): string | null {
    const uses = taskUses(config, taskId);
    if (!uses.length) return null;
    return `${uses.length > 1 ? `Είναι στις ρουτίνες ${uses.join(', ')}` : `Είναι στη ρουτίνα ${uses[0]}`}. Βγάλ' την από εκεί πρώτα, για να διαγραφεί.`;
}

// --- Validity: the rules apply to what the parent changes ---

const sequence = (d: RoutineDraft) => d.tasks.map(t => t.rtId ?? `+${t.taskId}`).join('|');
const countOf = (d: RoutineDraft, taskId: string) => d.tasks.filter(t => t.taskId === taskId).length;

// A name, an icon, a colour; at least one task, each once, each existing, each lasting a whole second or
// more. What was already odd in the data (a task twice, a task id that doesn't exist, no task) doesn't
// block saving the rest: routineWarnings shows it. `locked` (it runs now): the task list can't change.
export function routineIsValid(draft: RoutineDraft, original: RoutineDraft | undefined, config: DataConfig, locked: boolean): boolean {
    if (!draft.title.trim() || !asFormIcon(draft.icon).value || !draft.themeColor.trim()) return false;
    const listChanged = !original || sequence(draft) !== sequence(original);
    if (locked && listChanged) return false;
    if (listChanged && draft.tasks.length === 0) return false;
    if (!draft.tasks.every(t => Number.isInteger(t.seconds) && t.seconds >= 1)) return false;
    if (draft.tasks.some(t => !t.rtId && !config.tasks.some(x => x.id === t.taskId))) return false;
    return draft.tasks.every(t => countOf(draft, t.taskId) <= Math.max(1, original ? countOf(original, t.taskId) : 0));
}

export function routineWarnings(draft: RoutineDraft, config: DataConfig): string[] {
    const warnings: string[] = [];
    for (const taskId of new Set(draft.tasks.map(t => t.taskId))) {
        const task = config.tasks.find(t => t.id === taskId);
        const n = countOf(draft, taskId);
        if (!task) warnings.push(`«${taskId}»: δεν υπάρχει τέτοια εργασία, οπότε η ρουτίνα την παραλείπει. Βγάλ' την με το ✕.`);
        else if (n > 1) warnings.push(`«${task.title}» είναι ${n} φορές στη ρουτίνα: ένα πάτημα στο Έτοιμο μπορεί να τις κλείσει μαζί. Βγάλε τη μία με το ✕.`);
    }
    return warnings;
}

// A name, an icon, whole stars from 0; late stars no more than on time, when either is changed
// (a task already odd in the data still saves a new name: taskWarnings says what is odd).
export function taskIsValid(task: ConfigTask, original?: ConfigTask): boolean {
    const late = task.lateStars ?? 0;
    if (!task.title.trim() || !asFormIcon(task.icon).value) return false;
    if (!Number.isInteger(task.stars) || task.stars < 0 || !Number.isInteger(late) || late < 0) return false;
    const touched = !original || original.stars !== task.stars || (original.lateStars ?? 0) !== late;
    return !touched || late <= task.stars;
}

export function taskWarnings(task: ConfigTask): string[] {
    const late = task.lateStars ?? 0;
    return late > task.stars ? [`Αν αργήσει παίρνει περισσότερα αστέρια (${late}) από ό,τι στην ώρα της (${task.stars}).`] : [];
}

// A task as data.json keeps it: the name trimmed, no lateStars when it is 0 (the hand-written ones omit it).
export function tidyTask(task: ConfigTask): ConfigTask {
    const next: ConfigTask = { ...task, title: task.title.trim() };
    if (!next.lateStars) delete next.lateStars;
    return next;
}

// --- Minutes: the form shows a routine's durations in minutes, data.json keeps seconds ---

// Rounded to a tenth (1,7 for 100 s), finer under 6 s so nothing shows as 0
export function formatMinutes(seconds: number): string {
    const scale = seconds < 6 ? 100 : 10;
    return String(Math.round((seconds / 60) * scale) / scale).replace('.', ',');
}

// Typed minutes (comma or point) as whole seconds, at least 1; NaN when it isn't a positive number
export function parseMinutes(text: string): number {
    const t = text.trim().replace(',', '.');
    const n = Number(t);
    if (!t || !Number.isFinite(n) || n <= 0) return NaN;
    return Math.max(1, Math.round(n * 60));
}

// The row under Ρουτίνες: "3 εργασίες · 15′ · Ηλέκτρα"
export function routineSummary(config: DataConfig, draft: RoutineDraft): string {
    const total = draft.tasks.reduce((sum, t) => sum + (config.tasks.some(x => x.id === t.taskId) ? t.seconds : 0), 0);
    const n = draft.tasks.length;
    const kids = draft.kids.map(id => config.users.find(u => u.id === id)?.name ?? id);
    return `${n === 1 ? '1 εργασία' : `${n} εργασίες`} · ${formatMinutes(total)}′ · ${kids.length ? kids.join(', ') : 'Κανένα παιδί'}`;
}
