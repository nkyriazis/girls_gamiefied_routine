const Ajv = require('ajv');
const ajv = new Ajv({ allErrors: true, validateFormats: false });

const dataSchema = require('./data.schema.json');
const validateData = ajv.compile(dataSchema);

// Test old data.json (without chores field)
const oldData = {
  tasks: [],
  routines: [],
  routineTasks: [],
  users: [{ id: "u1", name: "Test", avatar: { type: "emoji", value: "👤" }, color: "#fff" }],
  settings: { timezone: "Europe/Athens" },
  routineAssignments: [],
  flows: [],
  schedules: [],
  rewards: []
};

console.log('Testing OLD data.json format (without chores field):');
const validOld = validateData(oldData);
console.log('Valid:', validOld);
if (!validOld) {
  console.log('Errors:', JSON.stringify(validateData.errors, null, 2));
}
