#!/usr/bin/env node

/**
 * Migration Helper for data.json and state.json
 * 
 * This script helps migrate older data files to the latest schema format.
 * It's OPTIONAL - the app works fine with old files.
 * 
 * Usage: node migrate-data.js [--data-file path] [--state-file path]
 */

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

// Parse command line arguments
const args = process.argv.slice(2);
const dataFileArg = args.indexOf('--data-file');
const stateFileArg = args.indexOf('--state-file');

const DATA_FILE = dataFileArg >= 0 && args[dataFileArg + 1] 
  ? args[dataFileArg + 1] 
  : path.join(__dirname, 'data.json');
const STATE_FILE = stateFileArg >= 0 && args[stateFileArg + 1]
  ? args[stateFileArg + 1]
  : path.join(__dirname, 'state.json');

const DATA_SCHEMA_FILE = path.join(__dirname, 'data.schema.json');
const STATE_SCHEMA_FILE = path.join(__dirname, 'state.schema.json');

// Initialize validator
const ajv = new Ajv({ allErrors: true, validateFormats: false });

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║       Data Migration Helper for Girls Gamified Routine    ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

console.log('Files:');
console.log(`  data.json:   ${DATA_FILE}`);
console.log(`  state.json:  ${STATE_FILE}\n`);

/**
 * Create backup of a file
 */
function createBackup(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${filePath}.backup.${timestamp}`;
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

/**
 * Validate file against schema
 */
function validateFile(filePath, schemaPath, fileType) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  ${fileType}: File not found (this is OK for new installations)`);
      return { valid: false, exists: false, data: null };
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    
    const validate = ajv.compile(schema);
    const valid = validate(data);
    
    if (valid) {
      console.log(`✅ ${fileType}: Valid`);
    } else {
      console.log(`❌ ${fileType}: Validation errors found`);
      console.log('   Errors:', JSON.stringify(validate.errors, null, 2));
    }
    
    return { valid, exists: true, data };
  } catch (error) {
    console.log(`❌ ${fileType}: Error - ${error.message}`);
    return { valid: false, exists: true, data: null, error };
  }
}

/**
 * Migrate data.json by adding missing optional fields
 */
function migrateDataJson(data) {
  let modified = false;
  
  // Add chores array if missing
  if (!data.chores) {
    console.log('  → Adding empty "chores" array');
    data.chores = [];
    modified = true;
  }
  
  return { data, modified };
}

/**
 * Migrate state.json by adding missing optional fields
 */
function migrateStateJson(data) {
  let modified = false;
  
  // Add starTransfers array if missing
  if (!data.starTransfers) {
    console.log('  → Adding empty "starTransfers" array');
    data.starTransfers = [];
    modified = true;
  }
  
  // Add choreInstances array if missing
  if (!data.choreInstances) {
    console.log('  → Adding empty "choreInstances" array');
    data.choreInstances = [];
    modified = true;
  }
  
  return { data, modified };
}

/**
 * Save file with atomic write
 */
function saveFile(filePath, data) {
  const tempFile = `${filePath}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));
  fs.renameSync(tempFile, filePath);
}

// Main migration process
async function main() {
  console.log('Step 1: Validating existing files...\n');
  
  const dataResult = validateFile(DATA_FILE, DATA_SCHEMA_FILE, 'data.json');
  const stateResult = validateFile(STATE_FILE, STATE_SCHEMA_FILE, 'state.json');
  
  console.log('\n' + '─'.repeat(60) + '\n');
  
  // Check if data.json needs migration
  let dataBackup = null;
  if (dataResult.exists && dataResult.data) {
    console.log('Step 2: Checking data.json for migration...\n');
    
    const { data: migratedData, modified } = migrateDataJson(dataResult.data);
    
    if (modified) {
      console.log('\n⚠️  data.json needs migration!');
      console.log('Creating backup...');
      dataBackup = createBackup(DATA_FILE);
      if (dataBackup) {
        console.log(`✅ Backup created: ${path.basename(dataBackup)}`);
      }
      
      console.log('Saving migrated file...');
      saveFile(DATA_FILE, migratedData);
      console.log('✅ data.json migrated successfully!');
    } else {
      console.log('✅ data.json is already up to date (no changes needed)');
    }
  } else {
    console.log('Step 2: Skipping data.json migration (file not found or invalid)\n');
  }
  
  console.log('\n' + '─'.repeat(60) + '\n');
  
  // Check if state.json needs migration
  let stateBackup = null;
  if (stateResult.exists && stateResult.data) {
    console.log('Step 3: Checking state.json for migration...\n');
    
    const { data: migratedState, modified } = migrateStateJson(stateResult.data);
    
    if (modified) {
      console.log('\n⚠️  state.json needs migration!');
      console.log('Creating backup...');
      stateBackup = createBackup(STATE_FILE);
      if (stateBackup) {
        console.log(`✅ Backup created: ${path.basename(stateBackup)}`);
      }
      
      console.log('Saving migrated file...');
      saveFile(STATE_FILE, migratedState);
      console.log('✅ state.json migrated successfully!');
    } else {
      console.log('✅ state.json is already up to date (no changes needed)');
    }
  } else {
    console.log('Step 3: Skipping state.json migration (file not found or invalid)\n');
  }
  
  console.log('\n' + '═'.repeat(60) + '\n');
  
  // Final validation
  if ((dataResult.exists && dataResult.data) || (stateResult.exists && stateResult.data)) {
    console.log('Step 4: Validating migrated files...\n');
    
    if (dataResult.exists && dataResult.data) {
      validateFile(DATA_FILE, DATA_SCHEMA_FILE, 'data.json (after migration)');
    }
    
    if (stateResult.exists && stateResult.data) {
      validateFile(STATE_FILE, STATE_SCHEMA_FILE, 'state.json (after migration)');
    }
  }
  
  console.log('\n' + '═'.repeat(60) + '\n');
  console.log('Migration Summary:\n');
  
  if (dataBackup || stateBackup) {
    console.log('✅ Migration completed successfully!');
    console.log('\nBackup files created:');
    if (dataBackup) console.log(`  - ${path.basename(dataBackup)}`);
    if (stateBackup) console.log(`  - ${path.basename(stateBackup)}`);
    console.log('\n💡 You can delete backups once you\'ve verified everything works.');
  } else if (dataResult.exists || stateResult.exists) {
    console.log('✅ No migration needed - your files are already up to date!');
  } else {
    console.log('⚠️  No files found to migrate.');
    console.log('This is normal for new installations.');
  }
  
  console.log('\n' + '═'.repeat(60) + '\n');
}

// Run migration
main().catch(error => {
  console.error('\n❌ Fatal error during migration:', error);
  process.exit(1);
});
