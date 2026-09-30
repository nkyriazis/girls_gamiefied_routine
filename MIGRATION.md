# Migration Guide

## Overview

This guide helps you migrate from older versions of your `data.json` and `state.json` files to the latest schema that includes new features like **Chores & Bonus Activities** and **Star Transfers**.

## Good News: Your Files Are Already Compatible! ✅

**You don't need to do anything to continue using the app.** The latest version is fully backward-compatible with older data files:

- ✅ **Old `data.json` files** (without the `chores` field) will work perfectly
- ✅ **Old `state.json` files** (without `starTransfers` and `choreInstances`) will work perfectly
- ✅ The backend automatically adds missing fields with empty defaults

## What's New?

The latest version adds two optional features:

### 1. Chores & Bonus Activities (`data.json`)

A new optional `chores` array that allows children to claim and complete household chores or bonus activities for stars.

**Example:**
```json
{
  "chores": [
    {
      "id": "chore-dishes",
      "title": "Wash Dishes",
      "icon": { "type": "emoji", "value": "🍽️" },
      "defaultStars": 20,
      "availabilityCron": "0 18 * * *",
      "expirationHours": 4,
      "category": "chore"
    }
  ],
  "tasks": [...],
  "routines": [...]
}
```

### 2. Star Transfers & Chore Instances (`state.json`)

Two new optional arrays for tracking star transfers between users and chore lifecycle:

```json
{
  "userStars": { "u1": 150 },
  "routineExecutions": [],
  "taskExecutions": [],
  "spendings": [],
  "starTransfers": [],      // New: optional
  "choreInstances": []       // New: optional
}
```

## Migration Options

### Option 1: Keep Using Your Existing Files (Recommended)

Simply continue using your existing `data.json` and `state.json` files. The app will:
- Load your existing data
- Automatically add empty arrays for new features
- Continue working exactly as before

**No action needed!**

### Option 2: Add New Features to Your Files

If you want to use the new chores/bonus activities feature:

1. **Manually edit `data.json`** to add a `chores` array (see example above)
2. Your `state.json` will automatically be updated when chores are used

Or use our migration helper:

```bash
cd backend
node migrate-data.js
```

This will:
- Validate your existing files
- Add empty `chores` array to `data.json` if missing
- Preserve all your existing data
- Create a backup before making changes

## Verification

You can verify your files are compatible by running:

```bash
cd backend
npm install
node test-schemas.js
```

This will validate both `data.json` and `state.json` against the current schemas.

## Schema Details

### data.json Schema
- **Required fields:** `tasks`, `routines`, `routineTasks`, `users`, `settings`, `routineAssignments`, `flows`, `schedules`, `rewards`
- **Optional fields:** `chores`
- **Additional properties:** Not allowed

### state.json Schema
- **Required fields:** `userStars`, `routineExecutions`, `taskExecutions`, `spendings`
- **Optional fields:** `starTransfers`, `choreInstances`
- **Additional properties:** Not allowed

## Troubleshooting

### "Config file validation failed"

If you see this error, your `data.json` might have:
- Missing required fields (see required fields above)
- Syntax errors (invalid JSON)
- Unknown properties (check for typos)

**Fix:** Run `node test-schemas.js` to see specific validation errors.

### "State file validation failed on load"

If you see this error, your `state.json` might have:
- Missing required fields
- Invalid data types
- Syntax errors

**Fix:** The app will start with empty state. You can restore from a backup or start fresh.

### Lost Data After Update

The app creates atomic saves using `.tmp` files. Check for:
- `state.json.tmp` - in-progress save
- Manual backups in your deployment scripts

## Best Practices

1. **Backup before updating**: Always keep a copy of your working files
2. **Test in development**: Use `docker-compose.dev.yml` to test changes
3. **Validate schemas**: Run `node test-schemas.js` after manual edits
4. **Incremental changes**: Add features one at a time and test

## Support

If you encounter issues:
1. Check the console logs for detailed error messages
2. Run validation tests to identify specific problems
3. Restore from backup if needed
4. Open an issue on GitHub with your error logs

## Summary

**Your old files will work without any changes.** The new features are optional and can be added when you're ready. The system is designed to be backward-compatible and will handle missing fields gracefully.
