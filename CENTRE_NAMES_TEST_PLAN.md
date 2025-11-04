# Centre Names Feature - Test Plan

## Test Environment Setup

Before testing:
1. Run the database migration SQL
2. Run `node deploy-commands.js` to register commands
3. Restart the bot

## Test Cases

### 1. Helper Function Tests

#### formatChannelName
```javascript
const { formatChannelName } = require('./helpers/formatters');

// Test cases
console.assert(formatChannelName('confetti-institute') === 'Confetti Institute');
console.assert(formatChannelName('test-channel') === 'Test Channel');
console.assert(formatChannelName('my-racing-centre') === 'My Racing Centre');
console.assert(formatChannelName('single') === 'Single');
console.assert(formatChannelName(null) === null);
console.assert(formatChannelName('') === null);
```

### 2. Database Tests

#### Check Migration
```sql
-- Verify centre_name column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'hotlaps' AND column_name = 'centre_name';

-- Expected: centre_name | text | YES

-- Verify special_hotlap_categories table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'special_hotlap_categories';

-- Verify initial categories
SELECT * FROM special_hotlap_categories;
-- Expected: Two rows with category IDs 1285999601496887367 and 1049282296529817691
```

### 3. Admin Command Tests (Special Guild Only)

#### Test 1: List Categories (Initial State)
```
Command: /manage_special_category list
Expected: Shows 2 pre-configured categories
```

#### Test 2: Add New Category
```
Command: /manage_special_category add category:<select a category>
Expected: "Category `<name>` is now being scanned for hotlaps."
```

#### Test 3: List Categories (After Add)
```
Command: /manage_special_category list
Expected: Shows 3 categories including the newly added one
```

#### Test 4: Remove Category
```
Command: /manage_special_category remove category:<select a category>
Expected: "Category `<name>` is no longer being scanned."
```

#### Test 5: Remove Non-existent Category
```
Command: /manage_special_category remove category:<unconfigured category>
Expected: "Category `<name>` was not in the list."
```

#### Test 6: Try in Wrong Guild
```
Command: /manage_special_category list (in a different guild)
Expected: "This command can only be used in the designated special guild."
```

### 4. Automatic Submission Tests

#### Test 1: Special Guild - Channel in Configured Category
```
Setup: 
- Post F1 hotlap screenshot in a channel under a configured category
- Channel name: "confetti-institute"

Expected:
- Bot processes the image
- Saves to database with centre_name = "Confetti Institute"
- Reply includes: **Centre:** Confetti Institute
```

#### Test 2: Special Guild - Channel NOT in Configured Category
```
Setup:
- Post F1 hotlap screenshot in a channel NOT under any configured category

Expected:
- Bot does NOT process the image
- No database entry created
```

#### Test 3: Regular Guild - Configured Hotlap Channel
```
Setup:
- Post F1 hotlap screenshot in the guild's configured hotlap channel

Expected:
- Bot processes the image
- Saves to database with centre_name = NULL
- Reply does NOT include centre information
```

#### Test 4: Regular Guild - Non-configured Channel
```
Setup:
- Post F1 hotlap screenshot in a random channel

Expected:
- Bot does NOT process the image
- No database entry created
```

### 5. Manual Submission Tests (submit_hotlap)

#### Test 1: Special Guild - With Centre Option
```
Command: /submit_hotlap
Options: (fill all required fields)
- centre: <use autocomplete to select "Confetti Institute">

Expected:
- Autocomplete shows formatted channel names from configured categories
- Submission succeeds with centre_name = "Confetti Institute"
- Reply includes: **Centre:** Confetti Institute
```

#### Test 2: Special Guild - Without Centre Option
```
Command: /submit_hotlap
Options: (fill all required fields, leave centre empty)

Expected:
- Submission succeeds with centre_name = NULL
- Reply does NOT include centre information
```

#### Test 3: Regular Guild - Centre Option
```
Command: /submit_hotlap
Options: Try to use centre autocomplete

Expected:
- Centre autocomplete shows no suggestions
- Can still submit successfully with centre_name = NULL
```

#### Test 4: Track Name Autocomplete
```
Command: /submit_hotlap
Options: Start typing in 'track' field

Expected:
- Shows existing track names from database
- Autocomplete works for both special and regular guilds
```

### 6. Database Verification Tests

After running tests, verify database entries:

```sql
-- Check that centre_name is populated for special guild submissions
SELECT id, guild_id, centre_name, track_location_name, lap_time 
FROM hotlaps 
WHERE guild_id = '1042747615856562187' 
ORDER BY id DESC 
LIMIT 10;

-- Check that centre_name is NULL for regular guild submissions
SELECT id, guild_id, centre_name, track_location_name, lap_time 
FROM hotlaps 
WHERE guild_id != '1042747615856562187' 
ORDER BY id DESC 
LIMIT 10;
```

### 7. Edge Cases

#### Test 1: Mixed Attachments
```
Setup: Post a message with both image and non-image attachments

Expected:
- Bot processes the message (has at least one image)
- Works the same as image-only messages
```

#### Test 2: Invalid Image
```
Setup: Post an invalid/corrupted image

Expected:
- Bot attempts to process but fails gracefully
- Error message returned to user
```

#### Test 3: Category Deleted After Configuration
```
Setup:
1. Add a category to special_hotlap_categories
2. Delete the category from Discord
3. Try to list or use channels

Expected:
- No crashes
- Gracefully handles missing categories
```

## Success Criteria

All tests pass with expected results:
- ✅ Helper functions work correctly
- ✅ Database schema is updated
- ✅ Admin commands work only in special guild
- ✅ Automatic submissions detect centre names correctly
- ✅ Manual submissions support centre autocomplete
- ✅ Regular guilds continue to work without centre names
- ✅ No security vulnerabilities
- ✅ No crashes or unhandled errors
