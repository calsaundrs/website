# Firestore Deployment Guide

## Overview

This guide follows **Firestore's official recommended approach** for handling index creation. Firestore automatically generates error messages with direct links to create missing indexes.

## 🚀 **Deployment Steps**

### Step 1: Deploy the Functions

1. **Commit and push** your changes to trigger a Netlify deployment
2. **Wait for deployment** to complete
3. **Verify environment variables** are set in Netlify:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`

### Step 2: Test and Generate Index Links

1. **Visit your site** and navigate to the events page
2. **Check Netlify function logs** for error messages
3. **Look for index creation links** in the error messages

### Step 3: Create Indexes Using Firestore's Links

When you see an error like this:
```
FAILED_PRECONDITION: The query requires an index. You can create it here: 
https://console.firebase.google.com/v1/r/project/brumoutloud-3dd92/firestore/indexes?create_composite=...
```

1. **Click the link** in the error message
2. **Review the pre-populated fields** in Firebase Console
3. **Click "Create"** to build the index
4. **Wait for the index to build** (usually 5-15 minutes)

### Step 4: Repeat for All Query Patterns

Different parts of your site will trigger different index requirements:

- **Events listing page** → Basic events index
- **Events with filters** → Filtered events indexes
- **Venue details page** → Venue lookup index
- **Sitemap generation** → Events and venues indexes

Each will generate its own index creation link when first encountered.

## 📊 **Expected Index Requirements**

Based on the functions we've created, you'll likely need these indexes:

### Events Collection
- `status` (Ascending) + `date` (Ascending) + `__name__` (Ascending)
- `status` (Ascending) + `category` (Array contains) + `date` (Ascending) + `__name__` (Ascending)
- `status` (Ascending) + `venueId` (Ascending) + `date` (Ascending) + `__name__` (Ascending)

### Venues Collection
- `status` (Ascending) + `slug` (Ascending) + `__name__` (Ascending)

## ⏱️ **Timeline**

- **Deployment**: 2-5 minutes
- **Index creation**: 5-15 minutes per index
- **Total setup time**: 15-30 minutes

## 🔍 **Monitoring Progress**

### Check Index Status
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Navigate to **Firestore Database** → **Indexes**
3. Look for **Status** column:
   - **Building**: Index is being created
   - **Enabled**: Index is ready to use
   - **Error**: There was an issue

### Check Function Logs
1. Go to [Netlify Dashboard](https://app.netlify.com/)
2. Navigate to **Functions** → **Function logs**
3. Look for successful responses (no more index errors)

## ✅ **Success Indicators**

Your migration is complete when:

1. **Events page loads** without errors
2. **Venue pages load** without errors
3. **Sitemap generates** successfully
4. **All indexes show "Enabled"** status in Firebase Console
5. **No more index errors** in function logs

## 🚨 **Troubleshooting**

### Index Build Fails
- Check if your data structure matches the index fields
- Ensure all documents have the required fields
- Look for data type mismatches

### Function Still Fails After Index Creation
- Wait for the index to finish building (check status in Firebase Console)
- Verify the query matches the index exactly
- Check function logs for other errors

### Performance Issues
- Monitor index usage in Firebase Console
- Remove unused indexes
- Consider breaking complex queries into simpler ones

## 🎯 **Benefits of This Approach**

1. **Follows Firestore best practices** - Uses official recommended method
2. **Automatic index discovery** - No need to guess which indexes are needed
3. **Pre-populated forms** - Firebase Console fills in the correct fields
4. **Optimal performance** - Only creates indexes that are actually used
5. **Future-proof** - Automatically handles new query patterns

## 📞 **Support**

If you encounter issues:

1. **Check Firebase Console** for index build status
2. **Review function logs** for specific error messages
3. **Consult Firestore documentation** for index requirements
4. **Contact Firebase Support** if needed

## 🎉 **Completion**

Once all indexes are built and functions are working, your Firestore migration is complete! The site will be running on Firestore with optimal performance and following all best practices.