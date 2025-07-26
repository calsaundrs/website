# Firestore Index Setup Guide

## Current Issue

The Firestore functions are failing because they require composite indexes for complex queries. The error message shows:

```
FAILED_PRECONDITION: The query requires an index. You can create it here: 
https://console.firebase.google.com/v1/r/project/brumoutloud-3dd92/firestore/indexes?create_composite=...
```

## Firestore's Recommended Approach

Firestore automatically generates error messages with direct links to create the missing indexes. This is the **official and recommended** way to handle index creation.

## Step-by-Step Index Creation Process

### 1. Trigger the Error (Generate Index Links)

1. **Deploy the updated function** that uses server-side filtering
2. **Test the function** by visiting your site or calling the API
3. **Check the function logs** for error messages with index creation links

### 2. Use Firestore's Auto-Generated Links

When you get an error like this:
```
FAILED_PRECONDITION: The query requires an index. You can create it here: 
https://console.firebase.google.com/v1/r/project/brumoutloud-3dd92/firestore/indexes?create_composite=...
```

1. **Click the link** in the error message
2. **Review the pre-populated fields** in the Firebase Console
3. **Click "Create"** to build the index

### 3. Repeat for Each Query Pattern

Different queries will generate different index requirements:

- **Basic events query**: `status == 'approved' ORDER BY date`
- **Events with date filter**: `status == 'approved' AND date >= now ORDER BY date`
- **Events with categories**: `status == 'approved' AND category ARRAY_CONTAINS_ANY [...] ORDER BY date`
- **Events with venues**: `status == 'approved' AND venueId IN [...] ORDER BY date`
- **Venues query**: `status == 'approved' AND slug == '...'`

Each will generate its own index creation link when first encountered.

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

### 8. The Function is Already Optimized

The `get-events-firestore.js` function is already using server-side filtering for optimal performance. Once the indexes are created, it will work efficiently without any code changes.

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