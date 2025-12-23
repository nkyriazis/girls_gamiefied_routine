const Ajv = require('ajv');
const ajv = new Ajv({ allErrors: true, validateFormats: false });

const stateSchema = require('./state.schema.json');
const validateState = ajv.compile(stateSchema);

// Test old state.json (without new fields)
const oldState = {
  userStars: { u1: 150 },
  routineExecutions: [],
  taskExecutions: [],
  spendings: []
};

console.log('Testing OLD state.json format (without starTransfers and choreInstances):');
const validOld = validateState(oldState);
console.log('Valid:', validOld);
if (!validOld) {
  console.log('Errors:', JSON.stringify(validateState.errors, null, 2));
}
