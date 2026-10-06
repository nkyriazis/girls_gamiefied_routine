const Ajv = require('ajv');
const fs = require('fs');
const path = require('path');

// Validates the shipped examples (data/exercises.example.json, what a new install starts from)
// and this install's own files when present (data.json and exercises.json are git-ignored;
// state.json is the legacy runtime state). Exits 1 when any file is invalid.

// Don't validate formats strictly (date-time format is not critical for our test)
const ajv = new Ajv({ allErrors: true, validateFormats: false });
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf-8'));
// Registered under their file names, as the backend does (exercises.schema.json $refs data.schema.json)
for (const schema of ['data.schema.json', 'exercises.schema.json', 'state.schema.json']) ajv.addSchema(read(schema), schema);

const checks = [
    ['data.example.json', 'data.schema.json', true],
    ['exercises.example.json', 'exercises.schema.json', true],
    ['data.json', 'data.schema.json', false],
    ['exercises.json', 'exercises.schema.json', false],
    ['state.json', 'state.schema.json', false],
];

console.log('Testing JSON schemas against existing files...\n');
let failed = false;
for (const [file, schema, required] of checks) {
    console.log(`=== Testing ${file} ===`);
    if (!required && !fs.existsSync(path.join(__dirname, file))) {
        console.log(`- ${file} is not here (skipped)\n`);
        continue;
    }
    try {
        const validate = ajv.getSchema(schema);
        if (validate(read(file))) {
            console.log(`✓ ${file} is VALID\n`);
        } else {
            failed = true;
            console.log(`✗ ${file} is INVALID`);
            console.log('Errors:', JSON.stringify(validate.errors, null, 2));
            console.log();
        }
    } catch (error) {
        failed = true;
        console.log(`✗ Error testing ${file}:`, error.message);
        console.log();
    }
}

console.log('Schema testing complete!');
if (failed) process.exitCode = 1;
