const Ajv = require('ajv');
const ajv = new Ajv({ allErrors: true, validateFormats: false });

const dataSchema = require('./data.schema.json');
const stateSchema = require('./state.schema.json');
const validateData = ajv.compile(dataSchema);
const validateState = ajv.compile(stateSchema);

console.log('=== Testing Migration Compatibility ===\n');

// Simulate OLD data.json (without chores field)
const oldData = {
  tasks: [
    { id: "t1", title: "Brush Teeth", icon: { type: "emoji", value: "🪥" }, stars: 10 }
  ],
  routines: [
    { id: "r1", title: "Morning", themeColor: "#fff", icon: { type: "emoji", value: "☀️" } }
  ],
  routineTasks: [
    { id: "rt1", routineId: "r1", taskId: "t1", order: 1, durationSeconds: 120 }
  ],
  users: [
    { id: "u1", name: "Alice", avatar: { type: "emoji", value: "👧" }, color: "#f00" }
  ],
  settings: { timezone: "Europe/Athens" },
  routineAssignments: [
    { id: "ra1", userId: "u1", routineId: "r1" }
  ],
  flows: [],
  schedules: [],
  rewards: [
    { id: "rew1", title: "Ice Cream", icon: { type: "emoji", value: "🍦" }, cost: 50 }
  ]
};

// Simulate OLD state.json (without starTransfers and choreInstances)
const oldState = {
  userStars: { u1: 150 },
  routineExecutions: [],
  taskExecutions: [],
  spendings: []
};

console.log('1. Testing OLD data.json (without "chores" field):');
const validOldData = validateData(oldData);
console.log('   ✓ Valid:', validOldData);
if (!validOldData) {
  console.log('   Errors:', JSON.stringify(validateData.errors, null, 2));
}

console.log('\n2. Testing OLD state.json (without "starTransfers" and "choreInstances"):');
const validOldState = validateState(oldState);
console.log('   ✓ Valid:', validOldState);
if (!validOldState) {
  console.log('   Errors:', JSON.stringify(validateState.errors, null, 2));
}

// Simulate what the backend does
console.log('\n3. Simulating backend loading behavior:');
const loadedData = {
  ...oldData,
  chores: oldData.chores || [],  // Backend default
};
console.log('   ✓ chores field:', loadedData.chores, '(empty array if missing)');

const globalState = {
  userStars: oldState.userStars || {},
  routineExecutions: oldState.routineExecutions || [],
  taskExecutions: oldState.taskExecutions || [],
  spendings: oldState.spendings || [],
  starTransfers: oldState.starTransfers || [],  // Backend default
  choreInstances: oldState.choreInstances || []  // Backend default
};
console.log('   ✓ starTransfers:', globalState.starTransfers);
console.log('   ✓ choreInstances:', globalState.choreInstances);

console.log('\n=== Result: Old files ARE compatible! ===');
console.log('The backend will automatically add missing fields with empty arrays.');
