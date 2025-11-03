# Centre Names Feature - Deployment Instructions

This file contains instructions for deploying the centre names feature for the special guild.

## 1. Database Migration

Run the SQL migration file to update the database schema:

```bash
psql -h <DB_HOST> -U <DB_USER> -d <DB_NAME> -f database/migrations/2025-11-03_add_centre_name_and_categories.sql
```

Or execute the SQL statements manually:
1. Add centre_name column to hotlaps table
2. Create special_hotlap_categories table
3. Insert initial category IDs

## 2. Register Discord Commands

Run the deploy-commands script to register the new `/manage_special_category` command:

```bash
node deploy-commands.js
```

This will register:
- The new `/manage_special_category` command (admin-only, guild-restricted)
- Updated `/submit_hotlap` command with the new 'centre' option

## 3. Restart the Bot

After deploying, restart the bot to load the new code:

```bash
npm start
```

## 4. Verify the Implementation

### For the Special Guild (1042747615856562187):

1. **Test Category Management:**
   - Run `/manage_special_category list` to see configured categories
   - Run `/manage_special_category add` to add a new category
   - Run `/manage_special_category remove` to remove a category

2. **Test Automatic Submission:**
   - Post an F1 hotlap screenshot in a channel under one of the configured categories
   - Verify the bot processes it and includes the centre name in the confirmation

3. **Test Manual Submission:**
   - Run `/submit_hotlap` in the special guild
   - Use the 'centre' option autocomplete to select a centre
   - Verify the submission includes the centre name

### For Other Guilds:

1. **Verify Backwards Compatibility:**
   - Post an F1 hotlap screenshot in the configured hotlap channel
   - Verify the bot processes it normally (without centre name)

2. **Test Manual Submission:**
   - Run `/submit_hotlap` in a regular guild
   - Verify the 'centre' option is available but doesn't show any suggestions
   - Submit without centre and verify it works

## Features Implemented

- ✅ Dynamic category list for special guild (no code changes needed to add/remove categories)
- ✅ Channel name formatting (e.g., "confetti-institute" → "Confetti Institute")
- ✅ Centre name stored in database for special guild submissions
- ✅ Admin command to manage categories
- ✅ Autocomplete for centre selection in manual submissions
- ✅ Backwards compatibility for existing guilds

## Configuration

### Special Guild ID
The special guild ID is hardcoded as: `1042747615856562187`

To change this, update the `SPECIAL_GUILD_ID` constant in:
- `index.js`
- `commands/submit_hotlap.js`
- `commands/manage_special_category.js`

### Initial Categories
The migration pre-populates these category IDs:
- `1285999601496887367`
- `1049282296529817691`

These can be managed after deployment using `/manage_special_category` command.
