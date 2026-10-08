import type { CheckWarning, ConfigList, ConfigWarning, CronWarning, DataConfig, FlowAction, FlowStep } from '../../shared/types';
import { THEME_COLOR_TOKENS } from '../../shared/themeColours';
import { unreadableCrons } from './cron';

// What data.json can have that data.schema.json can't see: the rules of data.json's ConfigFile (config.ts).
// The schema checks each item's shape; these check the items against each other and against the theme:
// - duplicate-id: two items in one list with the same id. The backend finds an item with find(), so the
//   second is never found, and stars, history and runs are keyed by the id: a second kid «u1» shows and
//   spends the first one's stars. Assignments and flows share one namespace (a schedule, a push and
//   «Ξεκίνα τώρα» name either; triggerAction tries assignments first), so a flow with an assignment's id
//   is one too (unless both are «alarm»: reserved-id says it);
// - missing-link: an id that names nothing. The backend skips it without a word (usersView,
//   assignmentTasks, triggerAction's TRIGGER_FAILED, enterStep), so a routine loses a task, a schedule or
//   a flow step starts nothing, a chore limited to missing kids can be done by nobody;
// - blank: a kid's name, or a task's, routine's, reward's or chore's title, that is only spaces (the
//   schema's minLength lets «  » through);
// - colour: a kid's or a routine's colour that is none (isColour), which the kids' screen
//   then draws without one;
// - flow-cycle: flows that start each other (A → A, A → B → A) before any wait. The engine refuses to start a
//   flow while its own start is still under way (db.ts, FLOW_CYCLE), so the action that closes the cycle
//   starts nothing. A flow that starts itself again after an alarm (A: alarm, then A) is no cycle: the
//   alarm waits, and then A restarts, as from a schedule;
// - reserved-id: an assignment or a flow whose id is «alarm». A schedule, a push and «Ξεκίνα τώρα» with
//   «alarm» always ring the plain alarm (triggerAction looks at it first), so they never start that item;
// - and #89's crons the scheduler can't read (cron.ts).
// Only the crons refuse a save that brings one in (refuses()); every other kind is a warning: the save goes
// through and the parents' page lists it until it is fixed (#104 left refusing out of scope). A file on disk
// with any of them still loads. A new check goes here, with its case in test/configChecks.test.ts.

/** The one kind a save that brings it in is refused for: a cron the scheduler can't read (#89). */
export const refuses = (w: ConfigWarning): w is CronWarning => w.kind === 'schedule' || w.kind === 'chore';

/** Every problem the rules find in `data`, the most harmful kinds first. */
export function configProblems(data: DataConfig): ConfigWarning[] {
  return [...duplicateIds(data), ...missingLinks(data), ...flowCycles(data), ...reservedIds(data), ...blanks(data),
    ...unreadableCrons(data), ...colours(data)];
}

// How a list's item is named in a message: its noun (with its article) and the plural for the list
const NOUN: Record<ConfigList, [string, string]> = {
  users: ['το παιδί', 'παιδιά'],
  tasks: ['η εργασία', 'εργασίες'],
  routines: ['η ρουτίνα', 'ρουτίνες'],
  routineTasks: ['η εργασία ρουτίνας', 'εργασίες ρουτινών (routineTasks)'],
  routineAssignments: ['η ανάθεση ρουτίνας', 'αναθέσεις ρουτινών (routineAssignments)'],
  flows: ['η ροή', 'ροές'],
  schedules: ['το πρόγραμμα', 'προγράμματα'],
  rewards: ['το δώρο', 'δώρα'],
  chores: ['η δουλειά', 'δουλειές'],
};
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Item = { id: string; name?: string; title?: string };
const lists = (d: DataConfig): [ConfigList, Item[]][] => [
  ['users', d.users], ['tasks', d.tasks], ['routines', d.routines], ['routineTasks', d.routineTasks],
  ['routineAssignments', d.routineAssignments], ['flows', d.flows], ['schedules', d.schedules],
  ['rewards', d.rewards], ['chores', d.chores ?? []],
];
/** An item as the parents know it: «name» for a kid, «title» for what has one, else «id». */
const label = (item: Item) => `«${item.name ?? item.title ?? item.id}»`;

const problem = (kind: CheckWarning['kind'], list: ConfigList, index: number, id: string, field: string, value: string,
  message: string, rest = ''): CheckWarning =>
  ({ path: `/${list}/${index}/${field}${rest}`, kind, list, id, field, value, message });

function duplicateIds(d: DataConfig): CheckWarning[] {
  const found: CheckWarning[] = [];
  for (const [list, items] of lists(d)) {
    const first = new Map<string, Item>();
    items.forEach((item, i) => {
      const before = first.get(item.id);
      if (!before) return void first.set(item.id, item);
      const [, plural] = NOUN[list];
      const why = list === 'users'
        ? 'μοιράζονται αστέρια, ιστορικό και ρουτίνες'
        : `ό,τι ψάχνει ένα από αυτά με το id βρίσκει μόνο το πρώτο, ${label(before)}`;
      found.push(problem('duplicate-id', list, i, item.id, 'id', item.id, `Δύο ${plural} έχουν το id «${item.id}» (${label(before)}, ${label(item)}): ${why}.`));
    });
  }
  const assignments = new Set(d.routineAssignments.map(a => a.id));
  d.flows.forEach((f, i) => {
    if (assignments.has(f.id) && f.id !== 'alarm') {
      found.push(problem('duplicate-id', 'flows', i, f.id, 'id', f.id,
        `Η ροή «${f.id}» έχει το id μιας ανάθεσης ρουτίνας: ένα πρόγραμμα ή το «Ξεκίνα τώρα» ξεκινά πάντα την ανάθεση, η ροή δεν ξεκινά ποτέ.`));
    }
  });
  return found;
}

function missingLinks(d: DataConfig): CheckWarning[] {
  const ids = (items: { id: string }[]) => new Set(items.map(x => x.id));
  const users = ids(d.users), tasks = ids(d.tasks), routines = ids(d.routines), assignments = ids(d.routineAssignments), flows = ids(d.flows);
  const routineTitle = (id: string) => `«${d.routines.find(r => r.id === id)?.title ?? id}»`;
  const found: CheckWarning[] = [];
  const missing = (list: ConfigList, i: number, id: string, field: string, value: string, message: string, rest = '') =>
    found.push(problem('missing-link', list, i, id, field, value, message, rest));

  d.routineAssignments.forEach((a, i) => {
    if (!users.has(a.userId)) {
      missing('routineAssignments', i, a.id, 'userId', a.userId,
        `Η ανάθεση ρουτίνας «${a.id}» είναι για το παιδί «${a.userId}», που δεν υπάρχει: δεν τη βλέπει κανένα παιδί.`);
    }
    if (!routines.has(a.routineId)) {
      missing('routineAssignments', i, a.id, 'routineId', a.routineId,
        `Η ανάθεση ρουτίνας «${a.id}» είναι της ρουτίνας «${a.routineId}», που δεν υπάρχει: δεν εμφανίζεται.`);
    }
  });
  d.routineTasks.forEach((rt, i) => {
    if (!routines.has(rt.routineId)) {
      missing('routineTasks', i, rt.id, 'routineId', rt.routineId,
        `Η εργασία ρουτίνας «${rt.id}» ανήκει στη ρουτίνα «${rt.routineId}», που δεν υπάρχει: δεν εμφανίζεται πουθενά.`);
    }
    if (!tasks.has(rt.taskId)) {
      missing('routineTasks', i, rt.id, 'taskId', rt.taskId,
        `Η ρουτίνα ${routineTitle(rt.routineId)} έχει την εργασία «${rt.taskId}», που δεν υπάρχει: η ρουτίνα δείχνεται χωρίς αυτήν.`);
    }
  });
  d.schedules.forEach((s, i) => {
    if (s.targetId !== 'alarm' && !assignments.has(s.targetId) && !flows.has(s.targetId)) {
      missing('schedules', i, s.id, 'targetId', s.targetId,
        `Το πρόγραμμα «${s.id}» (${s.cron}) ξεκινά το «${s.targetId}», που δεν είναι ούτε ανάθεση ρουτίνας ούτε ροή: στην ώρα του δεν ξεκινά τίποτα.`);
    }
  });
  // The schema lets a flow's steps be alarms and parallel steps only (no routine step)
  d.flows.forEach((f, i) => f.steps.forEach((step, n) => {
    const where = `Η ροή «${f.id}», βήμα ${n + 1},`;
    if (step.type !== 'parallel') return;
    step.actions.forEach((action, k) => {
      if (action.type === 'routine' && !assignments.has(action.routineId)) {
        missing('flows', i, f.id, 'steps', action.routineId,
          `${where} ξεκινά την ανάθεση ρουτίνας «${action.routineId}», που δεν υπάρχει: αυτή η ρουτίνα δεν ξεκινά.`, `/${n}/actions/${k}/routineId`);
      }
      if (action.type === 'flow' && !flows.has(action.flowId)) {
        missing('flows', i, f.id, 'steps', action.flowId,
          `${where} ξεκινά τη ροή «${action.flowId}», που δεν υπάρχει: αυτή η ροή δεν ξεκινά.`, `/${n}/actions/${k}/flowId`);
      }
    });
  }));
  (d.chores ?? []).forEach((c, i) => {
    const eligible = c.eligibleUsers ?? [];
    const nobody = eligible.length > 0 && eligible.every(u => !users.has(u));
    eligible.forEach((u, k) => {
      if (users.has(u)) return;
      missing('chores', i, c.id, 'eligibleUsers', u, nobody
        ? `Η δουλειά «${c.title}» είναι μόνο για ${eligible.length === 1 ? 'το παιδί' : 'τα παιδιά'} ${eligible.map(x => `«${x}»`).join(', ')}, που δεν ${eligible.length === 1 ? 'υπάρχει' : 'υπάρχουν'}: δεν μπορεί να την κάνει κανένα παιδί.`
        : `Η δουλειά «${c.title}» είναι και για το παιδί «${u}», που δεν υπάρχει (τα άλλα παιδιά της την κάνουν κανονικά).`, `/${k}`);
    });
  });
  // The same chore's every kid missing: one problem per kid would say «nobody» twice; keep the first
  return found.filter((w, i) => !(w.list === 'chores' && found.findIndex(x => x.list === 'chores' && x.id === w.id && x.message === w.message) !== i));
}

// The flows a flow starts while its own start is still under way, with where (db.ts, startFlow, which
// refuses those: a flow already starting above starts nothing). Every action of a step starts in turn;
// the steps after an alarm, or after a step that starts a flow which waits at an alarm, come only once it
// is dismissed, so the walk stops there. A routine is no such sure wait: one that starts holds the next
// step until it closes, one that is skipped (the kid in another routine, or done with it today) doesn't.
// So the walk goes on past it, and marks what comes after `afterRoutine`: at once only if every routine
// before it was skipped; otherwise later, and then the flow named starts over (startFlow restarts it).
type Start = { flowId: string; step: number; action: number; afterRoutine: boolean };
function startsAtOnce(d: DataConfig): Map<string, Start[]> {
  const byId = new Map(d.flows.map(f => [f.id, f]));
  const assignments = new Set(d.routineAssignments.map(a => a.id));
  // What a step starts, as enterStep reads it (the schema has no routine step, the type does)
  const starts = (s: FlowStep): FlowAction[] => s.type === 'parallel' ? s.actions : s.type === 'routine' ? [{ type: 'routine', userId: '', routineId: s.routineId }] : [];
  const routineIn = (s: FlowStep) => starts(s).some(a => a.type === 'routine' && assignments.has(a.routineId));
  // Whether a flow, or a flow it starts, has a step that `own` holds; a flow inside its own walk is refused, so it adds nothing
  const reach = (own: (s: FlowStep) => boolean) => {
    const memo = new Map<string, boolean>();
    const deeper = (id: string): boolean => {
      if (memo.has(id)) return memo.get(id)!;
      memo.set(id, false);
      const found = !!byId.get(id)?.steps.some(s => own(s) || starts(s).some(a => a.type === 'flow' && deeper(a.flowId)));
      memo.set(id, found);
      return found;
    };
    return deeper;
  };
  const hasAlarm = reach(s => s.type === 'alarm');
  const mayWait = reach(routineIn);
  const edges = new Map<string, Start[]>();
  for (const f of d.flows) {
    const out: Start[] = [];
    let afterRoutine = false;
    for (const [n, step] of f.steps.entries()) {
      if (step.type === 'alarm') break;
      const actions = starts(step);
      actions.forEach((a, k) => { if (a.type === 'flow' && byId.has(a.flowId)) out.push({ flowId: a.flowId, step: n, action: k, afterRoutine }); });
      if (actions.some(a => a.type === 'flow' && hasAlarm(a.flowId))) break;
      if (routineIn(step) || actions.some(a => a.type === 'flow' && mayWait(a.flowId))) afterRoutine = true;
    }
    if (!edges.has(f.id)) edges.set(f.id, out);
  }
  return edges;
}

// One warning per cycle, at the action that closes it. With no routine on the way the engine refuses that
// action every time, and the message says only that. With one («rr»: her routine, then «rr» again),
// it says both outcomes: every routine skipped, the action starts nothing; one started, the cycle starts
// over when it closes, so a routine she leaves with ✕ (or a parent ends) comes back, every time.
function flowCycles(d: DataConfig): CheckWarning[] {
  const edges = startsAtOnce(d);
  const index = new Map<string, number>();
  d.flows.forEach((f, i) => { if (!index.has(f.id)) index.set(f.id, i); });
  const found: CheckWarning[] = [];
  const done = new Set<string>();
  const path: Start[] = []; // the starts being walked (grey), in order; the first is the walk's root
  const walk = (id: string, via: Start): void => {
    path.push(via);
    for (const e of edges.get(id) ?? []) {
      const at = path.findIndex(p => p.flowId === e.flowId);
      if (at >= 0) {
        const ring = [...path.slice(at).map(p => p.flowId), e.flowId];
        const names = ring.slice(0, -1).map(x => `«${x}»`);
        const self = ring.length === 2;
        const routine = e.afterRoutine || path.slice(at + 1).some(p => p.afterRoutine);
        const head = self
          ? `Η ροή «${id}», βήμα ${e.step + 1}, ξεκινά τον εαυτό της (${ring.join(' → ')})`
          : `Οι ροές ${names.slice(0, -1).join(', ')} και ${names[names.length - 1]} ξεκινούν η μία την άλλη (${ring.join(' → ')})`;
        const nothing = self ? 'αυτή η ενέργεια δεν ξεκινά τίποτα' : 'η ενέργεια που κλείνει τον κύκλο δεν ξεκινά τίποτα';
        const message = routine
          ? `${head}, μετά από ρουτίνα. Αν δεν ξεκινήσει καμία ρουτίνα (το παιδί είναι ήδη σε ρουτίνα ή την έχει τελειώσει σήμερα), ${nothing}. `
            + `Αν ξεκινήσει, ${self ? 'η ροή' : 'ο κύκλος'} ξεκινά από την αρχή μόλις κλείσει η ρουτίνα: μια ρουτίνα που έκλεισε με ✕ ή «Τέλος» ξαναβγαίνει, κάθε φορά.`
          : `${head}: ${nothing}.`;
        found.push(problem('flow-cycle', 'flows', index.get(id)!, id, 'steps', e.flowId, message, `/${e.step}/actions/${e.action}/flowId`));
      } else if (!done.has(e.flowId)) {
        walk(e.flowId, e);
      }
    }
    path.pop();
    done.add(id);
  };
  for (const f of d.flows) if (!done.has(f.id)) walk(f.id, { flowId: f.id, step: -1, action: -1, afterRoutine: false });
  return found;
}

function reservedIds(d: DataConfig): CheckWarning[] {
  const found: CheckWarning[] = [];
  const reserved = (list: 'routineAssignments' | 'flows', items: { id: string }[], what: string) => items.forEach((item, i) => {
    if (item.id !== 'alarm') return;
    found.push(problem('reserved-id', list, i, item.id, 'id', item.id,
      `${capital(NOUN[list][0])} «alarm» έχει το id της απλής ειδοποίησης: ένα πρόγραμμα ή ένα push με «alarm» χτυπά την απλή ειδοποίηση, δεν ξεκινά ${what}. Χρειάζεται άλλο id.`));
  });
  reserved('routineAssignments', d.routineAssignments, 'αυτή τη ρουτίνα');
  reserved('flows', d.flows, 'αυτή τη ροή');
  return found;
}

function blanks(d: DataConfig): CheckWarning[] {
  const found: CheckWarning[] = [];
  for (const [list, items] of lists(d)) {
    const field = list === 'users' ? 'name' : 'title';
    items.forEach((item, i) => {
      const value = (item as Record<string, unknown>)[field];
      if (typeof value !== 'string' || value.trim() !== '') return;
      const [noun] = NOUN[list];
      found.push(problem('blank', list, i, item.id, field, value,
        `${capital(noun)} «${item.id}» δεν έχει ${list === 'users' ? 'όνομα: στην οθόνη των παιδιών φαίνεται χωρίς όνομα' : 'τίτλο: φαίνεται χωρίς τίτλο'}.`));
    });
  }
  return found;
}

function colours(d: DataConfig): CheckWarning[] {
  const found: CheckWarning[] = [];
  const check = (list: ConfigList, i: number, item: Item, field: string, value: string | undefined, whose: string) => {
    if (value === undefined || isColour(value)) return;
    const typo = /^var\(\s*--color-/.test(value) ? 'δεν είναι χρώμα του θέματος' : 'δεν είναι χρώμα';
    found.push(problem('colour', list, i, item.id, field, value, `Το χρώμα «${value}» ${whose} ${typo}: στην οθόνη των παιδιών φαίνεται χωρίς χρώμα.`));
  };
  d.users.forEach((u, i) => check('users', i, u, 'color', u.color, `του παιδιού ${label(u)}`));
  d.routines.forEach((r, i) => check('routines', i, r, 'themeColor', r.themeColor, `της ρουτίνας ${label(r)}`));
  // (an assignment's themeColor, in the type, is one the schema doesn't allow)
  return found;
}

const TOKENS = new Set<string>(THEME_COLOR_TOKENS);
// CSS colour functions, accepted by name (what is inside them is the browser's to read)
const FUNCTION = /^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\(.*\)$/i;
const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
// The theme's tokens, with an optional fallback: var(--color-accent), var(--color-x, #fff)
const VAR = /^var\(\s*--color-([\w-]+)\s*(?:,\s*(.*?)\s*)?\)$/;

/**
 * A colour the kids' screen can draw: a theme token var(--color-…) from shared/themeColours.ts (or any var()
 * with a colour as its fallback), a hex, a CSS colour function or a CSS named colour.
 */
export function isColour(value: string): boolean {
  const v = value.trim();
  const token = VAR.exec(v);
  if (token) return TOKENS.has(token[1]) || (token[2] !== undefined && isColour(token[2]));
  return HEX.test(v) || FUNCTION.test(v) || NAMED.has(v.toLowerCase());
}

// CSS Color Module Level 4's named colours, plus transparent and currentcolor
const NAMED = new Set([
  'transparent', 'currentcolor',
  'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige', 'bisque', 'black', 'blanchedalmond', 'blue',
  'blueviolet', 'brown', 'burlywood', 'cadetblue', 'chartreuse', 'chocolate', 'coral', 'cornflowerblue', 'cornsilk',
  'crimson', 'cyan', 'darkblue', 'darkcyan', 'darkgoldenrod', 'darkgray', 'darkgreen', 'darkgrey', 'darkkhaki',
  'darkmagenta', 'darkolivegreen', 'darkorange', 'darkorchid', 'darkred', 'darksalmon', 'darkseagreen', 'darkslateblue',
  'darkslategray', 'darkslategrey', 'darkturquoise', 'darkviolet', 'deeppink', 'deepskyblue', 'dimgray', 'dimgrey',
  'dodgerblue', 'firebrick', 'floralwhite', 'forestgreen', 'fuchsia', 'gainsboro', 'ghostwhite', 'gold', 'goldenrod',
  'gray', 'green', 'greenyellow', 'grey', 'honeydew', 'hotpink', 'indianred', 'indigo', 'ivory', 'khaki', 'lavender',
  'lavenderblush', 'lawngreen', 'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan', 'lightgoldenrodyellow',
  'lightgray', 'lightgreen', 'lightgrey', 'lightpink', 'lightsalmon', 'lightseagreen', 'lightskyblue', 'lightslategray',
  'lightslategrey', 'lightsteelblue', 'lightyellow', 'lime', 'limegreen', 'linen', 'magenta', 'maroon',
  'mediumaquamarine', 'mediumblue', 'mediumorchid', 'mediumpurple', 'mediumseagreen', 'mediumslateblue',
  'mediumspringgreen', 'mediumturquoise', 'mediumvioletred', 'midnightblue', 'mintcream', 'mistyrose', 'moccasin',
  'navajowhite', 'navy', 'oldlace', 'olive', 'olivedrab', 'orange', 'orangered', 'orchid', 'palegoldenrod', 'palegreen',
  'paleturquoise', 'palevioletred', 'papayawhip', 'peachpuff', 'peru', 'pink', 'plum', 'powderblue', 'purple',
  'rebeccapurple', 'red', 'rosybrown', 'royalblue', 'saddlebrown', 'salmon', 'sandybrown', 'seagreen', 'seashell',
  'sienna', 'silver', 'skyblue', 'slateblue', 'slategray', 'slategrey', 'snow', 'springgreen', 'steelblue', 'tan', 'teal',
  'thistle', 'tomato', 'turquoise', 'violet', 'wheat', 'white', 'whitesmoke', 'yellow', 'yellowgreen',
]);
