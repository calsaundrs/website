# Firestore Index Setup Guide

## Current Issue

The Firestore functions are failing because they require composite indexes for complex queries. The error message shows:

```
FAILED_PRECONDITION: The query requires an index. You can create it here: 
https://console.firebase.google.com/v1/r/project/brumoutloud-3dd92/firestore/indexes?create_composite=...
```

## Quick Fix (Temporary)

I've updated the `get-events-firestore.js` function to use client-side filtering as a temporary solution. This avoids the need for complex indexes but may not be optimal for large datasets.

## Permanent Solution: Set Up Proper Indexes

### 1. Access Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `brumoutloud-3dd92`
3. Navigate to **Firestore Database** → **Indexes**

### 2. Required Composite Indexes

#### For Events Collection

**Index 1: Status + Date + __name__**
- Collection: `events`
- Fields:
  - `status` (Ascending)
  - `date` (Ascending)
  - `__name__` (Ascending)
- Query scope: Collection

**Index 2: Status + Category + Date + __name__**
- Collection: `events`
- Fields:
  - `status` (Ascending)
  - `category` (Array contains)
  - `date` (Ascending)
  - `__name__` (Ascending)
- Query scope: Collection

**Index 3: Status + VenueId + Date + __name__**
- Collection: `events`
- Fields:
  - `status` (Ascending)
  - `venueId` (Ascending)
  - `date` (Ascending)
  - `__name__` (Ascending)
- Query scope: Collection

**Index 4: Status + Date + VenueId + __name__**
- Collection: `events`
- Fields:
  - `status` (Ascending)
  - `date` (Ascending)
  - `venueId` (Ascending)
  - `__name__` (Ascending)
- Query scope: Collection

#### For Venues Collection

**Index 5: Status + Slug + __name__**
- Collection: `venues`
- Fields:
  - `status` (Ascending)
  - `slug` (Ascending)
  - `__name__` (Ascending)
- Query scope: Collection

### 3. Creating Indexes via Firebase Console

1. Click **"Create Index"**
2. Select the collection (e.g., `events`)
3. Add fields in the correct order
4. Set the appropriate field types:
   - Regular fields: Ascending/Descending
   - Array fields: Array contains
   - Always include `__name__` as the last field
5. Click **"Create"**

### 4. Creating Indexes via Direct Link

You can also use the direct link from the error message:

```
https://console.firebase.google.com/v1/r/project/brumoutloud-3dd92/firestore/indexes?create_composite=ClBwcm9qZWN0cy9icnVtb3V0bG91ZC0zZGQ5Mi9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvZXZlbnRzL2luZGV4ZXMvXxABGgoKBnN0YXR1cxABGggKBGRhdGUQARoMCghfX25hbWVfXxAB
```

This will pre-populate the index creation form with the exact fields needed.

### 5. Index Building Time

- **Small datasets (< 1000 documents)**: 1-5 minutes
- **Medium datasets (1000-10000 documents)**: 5-15 minutes
- **Large datasets (> 10000 documents)**: 15-60 minutes

You can monitor the build progress in the Firebase Console.

### 6. Verifying Index Status

1. Go to **Firestore Database** → **Indexes**
2. Look for the **Status** column
3. Status will show:
   - **Building**: Index is being created
   - **Enabled**: Index is ready to use
   - **Error**: There was an issue creating the index

### 7. Testing After Index Creation

Once indexes are built, test the functions:

```bash
# Test events listing
curl "https://your-site.netlify.app/.netlify/functions/get-events-firestore"

# Test with filters
curl "https://your-site.netlify.app/.netlify/functions/get-events-firestore?dateRange={\"type\":\"upcoming\"}"

# Test venues
curl "https://your-site.netlify.app/.netlify/functions/get-events-firestore?view=venues"
```

### 8. Reverting to Server-Side Filtering

Once indexes are created, you can revert the `get-events-firestore.js` function to use server-side filtering for better performance:

```javascript
// Apply date filtering
if (filters.dateRange.type === 'upcoming') {
    const now = new Date();
    query = query.where('date', '>=', now);
} else if (filters.dateRange.type === 'today') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    query = query.where('date', '>=', today).where('date', '<', tomorrow);
} else if (filters.dateRange.type === 'week') {
    const now = new Date();
    const weekFromNow = new Date(now);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    query = query.where('date', '>=', now).where('date', '<=', weekFromNow);
}

// Apply category filtering
if (filters.categories.length > 0) {
    query = query.where('category', 'array-contains-any', filters.categories);
}

// Apply venue filtering
if (filters.venues.length > 0) {
    query = query.where('venueId', 'in', filters.venues);
}
```

### 9. Index Cost Considerations

- **Storage**: Each index takes up storage space
- **Writes**: Each write operation updates relevant indexes
- **Reads**: Indexes make reads faster but don't affect read costs directly

For a typical events site, index costs are minimal compared to the performance benefits.

### 10. Monitoring Index Usage

You can monitor index usage in the Firebase Console:

1. Go to **Firestore Database** → **Usage**
2. Look for **Index operations** metrics
3. Monitor for any unused indexes that can be removed

### 11. Troubleshooting

#### Index Build Fails
- Check if the data structure matches the index fields
- Ensure all documents have the required fields
- Look for any data type mismatches

#### Query Still Fails After Index Creation
- Wait for the index to finish building
- Check the index status in the console
- Verify the query matches the index exactly

#### Performance Issues
- Monitor index usage
- Remove unused indexes
- Consider breaking complex queries into simpler ones

## Next Steps

1. **Immediate**: Create the required indexes using the Firebase Console
2. **After Index Creation**: Test all functions to ensure they work
3. **Optimization**: Revert to server-side filtering for better performance
4. **Monitoring**: Set up alerts for index build failures and performance issues

## Support

If you encounter issues with index creation:

1. Check the [Firestore Indexing Documentation](https://firebase.google.com/docs/firestore/query-data/indexing)
2. Review the [Firestore Query Limitations](https://firebase.google.com/docs/firestore/query-data/queries#query_limitations)
3. Contact Firebase Support if needed