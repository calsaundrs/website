# Complete Guide: Fix Recurring Event Slugs from Scratch

## Overview
The recurring events system is broken - events show "Event slug not provided" errors because the database contains fallback slugs like `#event-recePEZSnbNDaECsw` instead of proper URLs like `mash-up-mondays`.

## Problem Analysis
- Database has fallback slugs like `#event-recePEZSnbNDaECsw`
- Frontend generates URLs with these broken slugs
- Backend can't find events with these slugs
- Recurring events need consistent slugs without dates
- Standalone events need date-specific slugs

## Files Modified

### 1. netlify/functions/get-events.js
**Changes Made:**
- Added `generateSlug()` function to create URL-friendly slugs
- Updated standalone events to generate date-specific slugs
- Updated recurring events to generate slugs without dates
- All events now use proper slugs instead of fallback `#event-` slugs

**Key Logic:**
```javascript
// For standalone events, include the date
eventSlug = generateSlug(fields['Event Name'], fields['Date']);

// For recurring events, don't include date
eventSlug = generateSlug(fields['Event Name']);
```

### 2. netlify/functions/update-airtable-slugs.js (NEW FILE)
**Purpose:** Updates the actual Airtable database with proper slugs
**Functionality:**
- Finds all recurring events and generates proper slugs
- Updates parent events with clean slugs (e.g., `mash-up-mondays`)
- Updates all child instances to use the parent's slug
- Updates standalone events with date-specific slugs
- Processes updates in batches to respect Airtable limits

### 3. netlify/functions/get-event-details.js
**Changes Made:**
- Simplified event lookup logic
- Better handling of recurring vs standalone events
- Improved error handling and logging

## Deployment Steps

### Step 1: Deploy the Changes
**Option A: Git + Netlify**
```bash
# Add all changes
git add .

# Commit the changes
git commit -m "Fix recurring event slugs - update get-events.js and add update-airtable-slugs.js"

# Push to trigger Netlify deployment
git push origin main
```

**Option B: Netlify CLI**
```bash
# Deploy to production
npx netlify deploy --prod
```

**Option C: Manual Deployment**
- Go to your Netlify dashboard
- Find your site
- Go to "Deploys" tab
- Trigger a new deploy

### Step 2: Verify Functions Are Deployed
Wait 2-3 minutes for deployment to complete, then test:

```bash
# Test the get-events function
curl "https://new.brumoutloud.co.uk/.netlify/functions/get-events" | head -20

# Test the update function exists
curl "https://new.brumoutloud.co.uk/.netlify/functions/update-airtable-slugs"
```

### Step 3: Update Airtable Database
Once deployed, run the update function:

```bash
curl "https://new.brumoutloud.co.uk/.netlify/functions/update-airtable-slugs"
```

This will:
- Find all recurring events
- Generate proper slugs (e.g., `mash-up-mondays`)
- Update parent and child events to use the same slug
- Update standalone events with date-specific slugs

### Step 4: Verify the Fix

**Test 1: Check Events API**
```bash
curl "https://new.brumoutloud.co.uk/.netlify/functions/get-events" | grep -o '"slug":"[^"]*"' | grep -E "(mash-up|xxl)"
```

You should see proper slugs like:
```
"slug":"mash-up-mondays"
"slug":"xxl-birmingham"
```

**Test 2: Test Recurring Event Pages**
Visit these URLs in your browser:
- https://new.brumoutloud.co.uk/event/mash-up-mondays
- https://new.brumoutloud.co.uk/event/xxl-birmingham

They should load properly instead of showing "Event slug not provided".

**Test 3: Test Frontend**
- Go to https://new.brumoutloud.co.uk/events
- Click on any recurring event
- Verify it opens the event details page

## Expected Results

After completing these steps:

✅ **Recurring events work:** `mash-up-mondays` loads properly
✅ **No more 404 errors:** All event URLs work
✅ **Consistent slugs:** All instances of recurring events use the same slug
✅ **Clean URLs:** No more `#event-` fallback slugs
✅ **Date-specific standalone events:** One-time events have date-specific URLs

## Troubleshooting

### If update function returns 404:
- Wait longer for deployment to complete
- Check Netlify deployment logs for errors
- Verify the function file was created correctly

### If events still show old slugs:
- Clear browser cache
- Check that the deployment completed successfully
- Verify the update function ran successfully

### If some events still don't work:
- Run the update function again
- Check Airtable directly to verify slugs were updated
- Check Netlify function logs for errors

### If you get "Event slug not provided":
- The changes haven't been deployed yet
- The database hasn't been updated yet
- There's a mismatch between frontend and backend expectations

## Technical Details

### Slug Generation Logic
```javascript
const generateSlug = (eventName, date) => {
    let slug = eventName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens
        .trim();
    
    if (date) {
        const dateStr = new Date(date).toISOString().split('T')[0];
        slug = `${slug}-${dateStr}`;
    }
    
    return slug;
};
```

### Examples
- **Recurring Event:** "Mash Up Mondays" → `mash-up-mondays`
- **Standalone Event:** "Queer Mendhi Nights" on 2025-07-25 → `queer-mendhi-nights-2025-07-25`

### Database Update Process
1. Groups events by Series ID
2. Finds parent events (with Recurring Info)
3. Generates clean slugs for parents
4. Updates all child instances to use parent's slug
5. Updates standalone events with date-specific slugs
6. Processes updates in batches of 10 (Airtable limit)

## Files Summary
- **Modified:** `netlify/functions/get-events.js`
- **Created:** `netlify/functions/update-airtable-slugs.js`
- **Modified:** `netlify/functions/get-event-details.js`
- **Frontend:** No changes needed (uses `event.slug` and `instance.Slug`)

The key is deploying first, then running the update function to fix the database.