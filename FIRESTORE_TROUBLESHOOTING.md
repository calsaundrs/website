# Firestore Troubleshooting Guide

## Current Issue: 500 Error on Events Function

The `get-events-firestore` function is returning a 500 error. This is likely due to missing Firestore indexes.

## 🔍 **Diagnostic Steps**

### Step 1: Test Basic Connection

Visit this URL to test the basic Firestore connection:
```
https://your-site.netlify.app/.netlify/functions/test-firestore-connection
```

Expected response:
```json
{
  "success": true,
  "message": "Firestore connection successful",
  "eventCount": 5,
  "sampleEvents": [...]
}
```

### Step 2: Test Basic Query

Visit this URL to test the basic events query:
```
https://your-site.netlify.app/.netlify/functions/test-events-query
```

**If successful:**
```json
{
  "success": true,
  "message": "Basic events query successful",
  "eventCount": 5,
  "events": [...]
}
```

**If index error:**
```json
{
  "success": false,
  "error": "INDEX_REQUIRED",
  "message": "This query requires a Firestore index",
  "details": "https://console.firebase.google.com/...",
  "solution": "Follow the link in the error details to create the required index"
}
```

### Step 3: Check Function Logs

1. Go to [Netlify Dashboard](https://app.netlify.com/)
2. Navigate to **Functions** → **Function logs**
3. Look for `get-events-firestore` function logs
4. Check for error messages with index creation links

## 🛠️ **Solutions**

### Solution 1: Create Required Index (Recommended)

If you see an index error, follow these steps:

1. **Copy the index creation link** from the error message
2. **Open the link** in your browser
3. **Review the pre-populated fields** in Firebase Console
4. **Click "Create"** to build the index
5. **Wait 5-15 minutes** for the index to build
6. **Test again**

### Solution 2: Use Simple Query (Temporary)

If you need the site working immediately, I've updated the function to use a simpler query that should work without complex indexes.

### Solution 3: Check Environment Variables

Verify these environment variables are set in Netlify:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

## 📊 **Expected Index Requirements**

Based on the queries we're using, you'll likely need:

### Basic Index (Required First)
- Collection: `events`
- Fields:
  - `status` (Ascending)
  - `date` (Ascending)
  - `__name__` (Ascending)

### Additional Indexes (As Needed)
- `status` + `category` + `date` + `__name__`
- `status` + `venueId` + `date` + `__name__`

## 🔄 **Testing Process**

1. **Deploy the updated functions**
2. **Test basic connection**: `/test-firestore-connection`
3. **Test basic query**: `/test-events-query`
4. **If index error**: Create index using the provided link
5. **Wait for index to build**
6. **Test events page**: Your site should work

## 🚨 **Common Issues**

### Issue: "FAILED_PRECONDITION" Error
**Solution**: This is an index error. Follow the link in the error message to create the required index.

### Issue: "Permission denied" Error
**Solution**: Check your Firebase service account credentials and permissions.

### Issue: "Collection not found" Error
**Solution**: Verify your Firestore database has an `events` collection with data.

### Issue: Index takes too long to build
**Solution**: This is normal for large datasets. Wait 15-30 minutes and check the Firebase Console.

## 📞 **Next Steps**

1. **Test the diagnostic functions** to identify the exact issue
2. **Create the required indexes** using Firestore's auto-generated links
3. **Wait for indexes to build**
4. **Test your site** - it should work perfectly!

## 🎯 **Success Indicators**

Your Firestore setup is working when:

- ✅ `/test-firestore-connection` returns success
- ✅ `/test-events-query` returns success
- ✅ Events page loads without errors
- ✅ All indexes show "Enabled" status in Firebase Console