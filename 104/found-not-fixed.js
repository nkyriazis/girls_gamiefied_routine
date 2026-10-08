const fs = require('fs'), path = require('path'), os = require('os');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r104-'));
const src = JSON.parse(fs.readFileSync(process.cwd() + '/data.json', 'utf8'));
const variant = process.argv[2];
if (variant === 'loop') src.flows.push({ id: 'loop', steps: [{ type: 'parallel', actions: [{ type: 'flow', flowId: 'loop' }] }] });
if (variant === 'alarm-assign') src.routineAssignments.push({ ...src.routineAssignments[0], id: 'alarm' });
if (variant === 'alarm-flow') src.flows.push({ id: 'alarm', steps: [{ type: 'alarm', props: { sound: 'beep' } }] });
fs.writeFileSync(dir + '/data.json', JSON.stringify(src));
process.env.DATA_FILE = dir + '/data.json'; process.env.DB_FILE = dir + '/routine.db';
process.env.EXERCISES_FILE = process.cwd() + '/exercises.json';
process.env.STATE_FILE = dir + '/none.json'; process.env.LOGS_FILE = dir + '/none.jsonl';
const cfg = require(process.cwd() + '/src/config');
const db = require(process.cwd() + '/src/db');
console.log('reload:', JSON.stringify(cfg.reloadConfig()), JSON.stringify(cfg.configError()));
console.log('flows:', cfg.config().flows.map(f=>f.id).join(','), 'assignments has alarm:', cfg.config().routineAssignments.some(a=>a.id==='alarm'));
console.log(variant, 'configWarnings:', cfg.configWarnings().length, 'configError:', !!cfg.configError());
try { console.log('triggerAction:', JSON.stringify(db.triggerAction(variant === 'loop' ? 'loop' : 'alarm', 'repro'))); }
catch (e) { console.log('triggerAction threw:', e.constructor.name, e.message); }
const s = db.appState ? db.appState() : null;
if (s) console.log('flowRuns:', JSON.stringify((s.flowRuns||[]).map(r => r.flowId)), 'routineRuns:', JSON.stringify((s.routineRuns||[]).map(r=>r.routineId)));
