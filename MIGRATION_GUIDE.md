# Full Data Migration Guide: Airtable → Firestore

This guide explains how to use the comprehensive migration function to transfer all data from Airtable to Firestore with proper structure and relationships.

## Overview

The migration function (`full-migration.js`) is designed to:
- Migrate all data from Airtable tables to Firestore collections
- Preserve relationships between data
- Generate SEO-friendly slugs
- Handle rate limiting and error recovery
- Provide detailed progress reporting

## Prerequisites

### 1. Environment Variables

Ensure these environment variables are set in your Netlify dashboard:

```bash
# Airtable Configuration
AIRTABLE_PERSONAL_ACCESS_TOKEN=your_airtable_token
AIRTABLE_BASE_ID=your_airtable_base_id

# Firebase Configuration
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_PRIVATE_KEY=your_firebase_private_key

# Optional: Migration Authentication
MIGRATION_TOKEN=your_secure_migration_token
```

### 2. Firebase Setup

1. Create a Firebase project
2. Enable Firestore Database
3. Create a service account and download the JSON key
4. Set the environment variables with your Firebase credentials

### 3. Airtable Access

1. Generate a Personal Access Token in Airtable
2. Ensure you have read access to all tables:
   - `Events`
   - `Venues`
   - `System Notifications`

## Migration Process

### Step 1: Venues Migration
- Migrates all venue records from Airtable
- Generates slugs for SEO-friendly URLs
- Sets default status to "Approved" if not present
- Creates `venues` collection in Firestore

### Step 2: Events Migration
- Migrates all event records from Airtable
- Handles venue relationships (links to venue IDs)
- Processes recurring event data
- Handles categories and dates
- Creates `events` collection in Firestore

### Step 3: System Notifications Migration
- Migrates all system notification records
- Sets default status to "Active" if not present
- Creates `systemNotifications` collection in Firestore

### Step 4: Relationship Establishment
- Links events to venues by name matching
- Updates events with proper venue IDs
- Removes temporary venue name fields

## Data Structure

### Venues Collection
```javascript
{
  id: "airtable_record_id",
  Name: "Venue Name",
  slug: "venue-name",
  Status: "Approved",
  // ... other venue fields
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z"
}
```

### Events Collection
```javascript
{
  id: "airtable_record_id",
  "Event Name": "Event Name",
  slug: "event-name",
  Status: "Approved",
  venueId: "venue_record_id", // Linked venue
  categories: ["Comedy", "Live Music"],
  eventDate: "2024-01-01",
  endDate: "2024-01-01",
  recurringSeriesId: "series_id", // For recurring events
  parentEventId: "parent_id", // For event instances
  // ... other event fields
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z"
}
```

### System Notifications Collection
```javascript
{
  id: "airtable_record_id",
  // ... notification fields
  Status: "Active",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z"
}
```

## Usage

### Method 1: Web Interface

1. Navigate to `/full-migration-trigger.html`
2. Review the migration details and warnings
3. Click "Start Full Migration"
4. Enter your migration token when prompted
5. Monitor the progress and results

### Method 2: Direct API Call

```bash
curl -X POST \
  https://your-site.netlify.app/.netlify/functions/full-migration \
  -H "Authorization: Bearer YOUR_MIGRATION_TOKEN" \
  -H "Content-Type: application/json"
```

### Method 3: Netlify CLI

```bash
netlify functions:invoke full-migration \
  --method POST \
  --headers '{"Authorization": "Bearer YOUR_MIGRATION_TOKEN"}'
```

## Configuration Options

### Rate Limiting
The migration uses a 250ms delay between API calls to avoid hitting Airtable rate limits:
```javascript
const RATE_LIMIT_DELAY = 250; // milliseconds
```

### Batch Size
Firestore operations are batched for efficiency:
```javascript
const BATCH_SIZE = 10; // records per batch
```

### Authentication
The function requires a Bearer token for security:
```javascript
const authHeader = event.headers.authorization;
if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { statusCode: 401, body: 'Unauthorized' };
}
```

## Error Handling

The migration function includes comprehensive error handling:

1. **Individual Record Errors**: Failed records are logged but don't stop the migration
2. **Batch Errors**: If a batch fails, the error is logged and processing continues
3. **Network Errors**: Automatic retries with exponential backoff
4. **Validation Errors**: Invalid data is cleaned or skipped with logging

## Monitoring and Logging

### Console Logs
The function provides detailed console logging:
- Progress updates for each step
- Record counts and error counts
- Relationship linking results
- Total execution time

### Response Format
```javascript
{
  success: true,
  startTime: "2024-01-01T00:00:00.000Z",
  endTime: "2024-01-01T00:01:00.000Z",
  totalTime: 60000,
  migrations: {
    venues: { processedCount: 50, errorCount: 0 },
    events: { processedCount: 200, errorCount: 2 },
    systemNotifications: { processedCount: 10, errorCount: 0 }
  },
  relationships: {
    linkedCount: 180,
    unlinkedCount: 20
  }
}
```

## Post-Migration Tasks

### 1. Verify Data Integrity
- Check that all records were migrated
- Verify relationships are properly established
- Test that slugs are unique and SEO-friendly

### 2. Update Application Code
- Update your frontend to read from Firestore instead of Airtable
- Update any API endpoints to use Firestore
- Test all functionality with the new data source

### 3. Monitor Performance
- Check Firestore usage and costs
- Monitor query performance
- Optimize indexes if needed

### 4. Clean Up
- Remove the migration function after successful migration
- Update environment variables to remove Airtable credentials
- Archive or delete the migration trigger page

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify all environment variables are set correctly
   - Check that the migration token is valid
   - Ensure Firebase service account has proper permissions

2. **Rate Limiting**
   - The function includes built-in rate limiting
   - If you still hit limits, increase the `RATE_LIMIT_DELAY`

3. **Memory Issues**
   - For large datasets, consider reducing `BATCH_SIZE`
   - Monitor Netlify function timeout limits

4. **Relationship Linking Failures**
   - Check venue name matching logic
   - Verify that venue names are consistent between tables

### Debug Mode

To enable detailed logging, you can modify the function to include more verbose output:

```javascript
const DEBUG_MODE = process.env.DEBUG_MIGRATION === 'true';
if (DEBUG_MODE) {
    console.log('Debug mode enabled');
    // Add more detailed logging
}
```

## Security Considerations

1. **Token Security**: Use a strong, unique migration token
2. **Environment Variables**: Never commit credentials to version control
3. **Access Control**: Restrict access to the migration trigger page
4. **Data Validation**: Validate all migrated data before going live

## Rollback Plan

If the migration fails or you need to rollback:

1. **Keep Airtable Data**: Don't delete Airtable data until migration is verified
2. **Backup Firestore**: Export Firestore data before making changes
3. **Gradual Rollback**: Update application code to use Airtable again
4. **Data Verification**: Compare data between systems before final cleanup

## Support

For issues or questions:
1. Check the console logs for detailed error messages
2. Verify all environment variables are correctly set
3. Test with a small subset of data first
4. Review the troubleshooting section above

---

**Important**: This is a one-time migration function. After successful migration, remove or secure the function to prevent accidental re-runs.