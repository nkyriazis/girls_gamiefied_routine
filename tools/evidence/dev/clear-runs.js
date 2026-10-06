// Dev only: take running flows and routines off screen.
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/app/routine.db');
console.log('flow_runs', db.prepare('DELETE FROM flow_runs').run().changes, 'routine_runs', db.prepare('DELETE FROM routine_runs').run().changes);
