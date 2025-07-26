# Event Details Page: Airtable to Firestore Migration

## Overview

This document outlines the refactoring of the event details page data source from Airtable to Firestore while maintaining the current Client-Side Rendering (CSR) approach and existing HTML design.

## What Changed

### 1. New Firestore Event Service
- **File**: `netlify/functions/services/firestore-event-service.js`
- **Purpose**: Replaces the Airtable-based `EventService` for fetching event details
- **Features**:
  - Direct Firestore queries for better performance
  - Maintains the same API interface as the original service
  - Handles series events and recurring instances
  - Includes caching for improved performance
  - Supports similar events functionality

### 2. New Firestore Event Details Function
- **File**: `netlify/functions/get-event-details-firestore.js`
- **Purpose**: Replaces `get-event-details.js` with Firestore backend
- **Features**:
  - Identical HTML output and user experience
  - Same calendar integration (Google Calendar + iCal)
  - Maintains all existing functionality
  - Better error handling and logging

### 3. Updated Routing Configuration
- **File**: `netlify.toml`
- **Change**: Updated event routing to use the new Firestore function
- **Impact**: All `/event/*` URLs now use Firestore data source

### 4. Test Function
- **File**: `netlify/functions/test-firestore-connection.js`
- **Purpose**: Verify Firestore connection and data access
- **Usage**: Call `/test-firestore-connection` to test connectivity

## Environment Variables Required

Add these environment variables to your Netlify dashboard:

```bash
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY=your-private-key
```

### How to Get Firebase Credentials

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Extract the values:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY`

## Data Structure Assumptions

The Firestore service expects events to be stored in a collection called `events` with the following structure:

```javascript
{
  id: "document-id",
  name: "Event Name",
  slug: "event-slug",
  description: "Event description",
  date: "2025-01-27T19:00:00Z",
  category: ["Drag", "Party"],
  venue: {
    id: "venue-id",
    name: "Venue Name",
    address: "Venue Address",
    link: "https://venue-website.com"
  },
  image: {
    url: "https://image-url.com",
    publicId: "cloudinary-public-id"
  },
  price: "£10",
  ageRestriction: "18+",
  link: "https://event-link.com",
  recurringInfo: "Every Friday", // For series events
  seriesId: "series-id", // For recurring events
  status: "approved",
  promotion: {
    featured: {
      startDate: "2025-01-01",
      endDate: "2025-01-31"
    },
    boosted: {
      startDate: "2025-01-01",
      endDate: "2025-01-31"
    }
  }
}
```

## Migration Steps

### 1. Set Up Environment Variables
1. Add Firebase credentials to Netlify environment variables
2. Ensure all required variables are set for both production and deploy-preview contexts

### 2. Test Firestore Connection
1. Deploy the changes to a preview environment
2. Test the connection: `https://your-site.netlify.app/.netlify/functions/test-firestore-connection`
3. Verify that events are accessible and the connection is working

### 3. Test Event Details Page
1. Navigate to an event page: `https://your-site.netlify.app/event/your-event-slug`
2. Verify that the page loads correctly with Firestore data
3. Test all functionality (calendar links, recurring events, etc.)

### 4. Monitor and Rollback Plan
1. Monitor function logs for any errors
2. If issues arise, you can quickly rollback by changing the netlify.toml redirect back to the original function
3. The original Airtable function remains available as `get-event-details.js`

## Benefits of the Migration

### Performance Improvements
- **Faster Queries**: Direct Firestore queries are typically faster than Airtable API calls
- **Better Caching**: Built-in caching reduces redundant database calls
- **Reduced Latency**: Firestore's global infrastructure provides better response times

### Scalability
- **Higher Limits**: Firestore has higher read/write limits than Airtable
- **Real-time Updates**: Potential for real-time event updates in the future
- **Better Cost Management**: More predictable pricing model

### Maintainability
- **Consistent API**: Same interface as the original service
- **Better Error Handling**: More detailed error messages and logging
- **Easier Testing**: Direct database access for testing and debugging

## Troubleshooting

### Common Issues

1. **Firebase Connection Errors**
   - Verify environment variables are set correctly
   - Check that the service account has proper permissions
   - Ensure the private key is properly formatted (with newlines)

2. **Missing Events**
   - Verify events exist in the `events` collection
   - Check that event slugs match the expected format
   - Ensure events have `status: "approved"` for public access

3. **Template Rendering Issues**
   - Check that event data structure matches expected format
   - Verify all required fields are present
   - Check function logs for template compilation errors

### Debug Commands

```bash
# Test Firestore connection
curl https://your-site.netlify.app/.netlify/functions/test-firestore-connection

# Test specific event
curl https://your-site.netlify.app/event/your-event-slug
```

## Rollback Instructions

If you need to rollback to the Airtable version:

1. Update `netlify.toml`:
```toml
[[redirects]]
  from = "/event/*"
  to = "/.netlify/functions/get-event-details?slug=:splat"
  status = 200
```

2. Deploy the change
3. The site will immediately switch back to using Airtable data

## Future Enhancements

With the Firestore foundation in place, future enhancements could include:

1. **Real-time Updates**: Live event updates without page refresh
2. **Offline Support**: Service worker integration for offline event viewing
3. **Advanced Filtering**: More sophisticated event filtering and search
4. **Analytics Integration**: Better event view tracking and analytics
5. **Performance Optimization**: Additional caching layers and CDN integration

## Support

For issues or questions about this migration:

1. Check the function logs in Netlify dashboard
2. Test the Firestore connection using the test function
3. Verify environment variables are correctly set
4. Review the data structure in Firestore to ensure it matches expectations

## Version History

- **2025-01-27-v1**: Initial Firestore migration
  - Created FirestoreEventService
  - Created get-event-details-firestore function
  - Updated routing configuration
  - Added comprehensive documentation