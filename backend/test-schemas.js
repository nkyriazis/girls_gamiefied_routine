const Ajv = require('ajv');
const fs = require('fs');
const path = require('path');

// Don't validate formats strictly (date-time format is not critical for our test)
const ajv = new Ajv({ allErrors: true, validateFormats: false });

console.log('Testing JSON schemas against existing files...\n');

// Test data.json against data.schema.json
try {
  console.log('=== Testing data.json ===');
  const dataSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.schema.json'), 'utf-8'));
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf-8'));
  
  const validateData = ajv.compile(dataSchema);
  const validData = validateData(data);
  
  if (validData) {
    console.log('✓ data.json is VALID\n');
  } else {
    console.log('✗ data.json is INVALID');
    console.log('Errors:', JSON.stringify(validateData.errors, null, 2));
    console.log();
  }
} catch (error) {
  console.log('✗ Error testing data.json:', error.message);
  console.log();
}

// Test state.json against state.schema.json
try {
  console.log('=== Testing state.json ===');
  const stateSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'state.schema.json'), 'utf-8'));
  const state = JSON.parse(fs.readFileSync(path.join(__dirname, 'state.json'), 'utf-8'));
  
  const validateState = ajv.compile(stateSchema);
  const validState = validateState(state);
  
  if (validState) {
    console.log('✓ state.json is VALID\n');
  } else {
    console.log('✗ state.json is INVALID');
    console.log('Errors:', JSON.stringify(validateState.errors, null, 2));
    console.log();
  }
} catch (error) {
  console.log('✗ Error testing state.json:', error.message);
  console.log();
}

console.log('Schema testing complete!');
