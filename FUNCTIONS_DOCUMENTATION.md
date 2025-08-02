# BrumOutLoud Serverless Functions Documentation

## Overview

This documentation covers all Netlify serverless functions that power the BrumOutLoud platform backend. These functions handle data operations, integrations, and business logic.

**Architecture:** Netlify Functions (AWS Lambda)
**Runtime:** Node.js 18.x
**Database:** Firestore (Firebase)
**File Storage:** Cloudinary
**AI Integration:** Google Gemini API

---

## Function Categories

### Public API Functions
Functions accessible without authentication for public website features.

### Admin API Functions  
Functions requiring Firebase authentication for admin operations.

### Utility Functions
Helper functions for data processing, migration, and maintenance.

---

## Public API Functions

### `get-events-firestore-simple.js`
**Purpose:** Retrieve events from Firestore for public display and admin management.

**HTTP Method:** GET

**Parameters:**
- `view` (string, optional): 
  - `"admin"` - Returns detailed admin view with all fields
  - Default - Returns public view with limited fields

**Response Format:**
```json
{
  "events": [
    {
      "id": "recXXXXXXXXXXXXXX",
      "fields": {
        "Event Name": "Pride Night",
        "Description": "Celebrate diversity and inclusion...",
        "Date": "2024-07-15",
        "Promo Image": ["https://res.cloudinary.com/..."],
        "Slug": "pride-night-july-2024",
        "Venue": ["recVenueID"],
        "Venue Name": "The Rainbow Club",
        "VenueText": "123 Pride Street",
        "Category": ["Party", "LGBTQ+"],
        "Recurring Info": "Weekly on Fridays",
        "Recurring JSON": "{...}",
        "Series ID": "recParentEventID"
      }
    }
  ]
}
```

**Key Features:**
- Groups recurring events by series
- Handles parent-child event relationships
- Returns Cloudinary optimized image URLs
- Sorts events by date ascending

**Example Usage:**
```javascript
// Get public events
const response = await fetch('/.netlify/functions/get-events-firestore-simple');
const data = await response.json();

// Get admin view
const adminResponse = await fetch('/.netlify/functions/get-events?view=admin');
```

### `get-event-details.js`
**Purpose:** Get detailed event information for individual event pages.

**HTTP Method:** GET

**Parameters:**
- `slug` (string, required): Event slug identifier

**Response Format:**
```json
{
  "event": {
    "title": "Pride Night",
    "description": "Celebrate diversity...",
    "startTime": "2024-07-15T20:00:00Z",
    "endTime": "2024-07-16T02:00:00Z",
    "location": "The Rainbow Club",
    "address": "123 Pride Street, Birmingham",
    "image": "https://res.cloudinary.com/...",
    "venue": {
      "name": "The Rainbow Club",
      "address": "123 Pride Street",
      "slug": "rainbow-club"
    },
    "addToCalendarLinks": {
      "google": "https://calendar.google.com/...",
      "ical": "data:text/calendar;charset=utf8,..."
    },
    "isRecurring": true,
    "recurringDates": ["2024-07-15", "2024-07-22", "2024-07-29"]
  }
}
```

**Key Features:**
- Generates calendar integration links
- Handles recurring event dates
- Returns venue information
- Creates SEO-friendly content

### `get-event-details-by-id.js`
**Purpose:** Get event details using Airtable record ID.

**HTTP Method:** GET

**Parameters:**
- `id` (string, required): Airtable record ID

**Response:** Same format as `get-event-details`

### `get-venues.js`
**Purpose:** Retrieve venue listings with filtering options.

**HTTP Method:** GET

**Parameters:**
- `view` (string, optional): Airtable view name
- `filter` (string, optional): Additional filtering criteria

**Response Format:**
```json
{
  "venues": [
    {
      "id": "recVenueXXXXXXXXXX",
      "fields": {
        "Venue Name": "The Rainbow Club",
        "Description": "Birmingham's premier LGBTQ+ venue",
        "Address": "123 Pride Street, Birmingham",
        "Venue Type": ["Club", "Bar"],
        "Accessibility Features": ["Wheelchair Access"],
        "Image": ["https://res.cloudinary.com/..."],
        "Slug": "rainbow-club",
        "Status": "Approved"
      }
    }
  ]
}
```

### `get-venue-details.js`
**Purpose:** Get detailed venue information including associated events.

**HTTP Method:** GET

**Parameters:**
- `slug` (string, required): Venue slug identifier

**Response Format:**
```json
{
  "venue": {
    "name": "The Rainbow Club",
    "description": "Birmingham's premier LGBTQ+ venue...",
    "address": "123 Pride Street, Birmingham",
    "type": ["Club", "Bar"],
    "accessibility": ["Wheelchair Access"],
    "image": "https://res.cloudinary.com/...",
    "recurringEvents": [
      {
        "name": "Weekly Pride Night",
        "description": "Every Friday night...",
        "recurringInfo": "Weekly on Fridays"
      }
    ],
    "upcomingEvents": [
      {
        "name": "Special Pride Event",
        "date": "2024-07-15",
        "slug": "special-pride-event"
      }
    ]
  }
}
```

**Key Features:**
- Separates recurring and one-off events
- Uses effective date logic for nightlife events
- Returns venue image optimizations

### `get-venue-list.js`
**Purpose:** Simple venue list for dropdowns and form selections.

**HTTP Method:** GET

**Response Format:**
```json
{
  "venues": [
    {
      "id": "recXXXXXXXXXXXXXX",
      "name": "The Rainbow Club",
      "slug": "rainbow-club"
    }
  ]
}
```

### `find-venue.js`
**Purpose:** Search venues by name or location.

**HTTP Method:** GET

**Parameters:**
- `q` (string, required): Search query

**Response:** Array of matching venues

### `sitemap.js`
**Purpose:** Generate XML sitemap for SEO.

**HTTP Method:** GET

**Response:** XML sitemap following standard format

**Key Features:**
- Includes all approved events and venues
- Updates automatically with new content
- Proper XML formatting for search engines

---

## Form Submission Functions

### `event-submission.js`
**Purpose:** Handle public event submissions with image upload and AI processing.

**HTTP Method:** POST

**Content-Type:** multipart/form-data

**Form Fields:**
- `eventName` (string, required): Event name
- `description` (string, required): Event description  
- `date` (string, required): Event date (YYYY-MM-DD)
- `startTime` (string, required): Start time (HH:MM)
- `endTime` (string, optional): End time (HH:MM)
- `venue` (string, required): Venue ID or name
- `category` (array, required): Event categories
- `isRecurring` (boolean): Whether event repeats
- `recurrenceData` (object): Recurrence configuration
- `promoImage` (file, optional): Event promotional image
- `submitterName` (string, required): Submitter name
- `submitterEmail` (string, required): Submitter email

**Recurrence Data Structure:**
```json
{
  "type": "weekly", // "weekly" | "monthly"
  "days": [1, 5], // For weekly: day indices (0=Sunday, 6=Saturday)
  "monthlyType": "date", // For monthly: "date" | "day"
  "dayOfMonth": 15, // For monthly date type
  "week": "1", // For monthly day type: "1"|"2"|"3"|"4"|"-1"
  "dayOfWeek": 1 // For monthly day type: day index
}
```

**Response Format:**
```json
{
  "success": true,
  "message": "Event submitted successfully",
  "eventId": "recXXXXXXXXXXXXXX",
  "recurringEventIds": ["recYYYYYYYYYYYYY", "recZZZZZZZZZZZZ"]
}
```

**Key Features:**
- AI-powered recurring date generation using Gemini API
- Cloudinary image upload with optimization
- Automatic venue linking or creation
- Series ID management for recurring events

**Example Implementation:**
```javascript
// Client-side submission
const formData = new FormData();
formData.append('eventName', 'Pride Night');
formData.append('description', 'Weekly celebration...');
formData.append('date', '2024-07-15');
formData.append('startTime', '20:00');
formData.append('venue', 'recVenueXXXXXXXXXX');
formData.append('category', JSON.stringify(['Party', 'LGBTQ+']));
formData.append('isRecurring', 'true');
formData.append('recurrenceData', JSON.stringify({
  type: 'weekly',
  days: [5] // Friday
}));

const response = await fetch('/.netlify/functions/event-submission', {
  method: 'POST',
  body: formData
});
```

### `venue-submission.js`
**Purpose:** Handle public venue submissions.

**HTTP Method:** POST

**Content-Type:** multipart/form-data

**Form Fields:**
- `venueName` (string, required): Venue name
- `description` (string, required): Venue description
- `address` (string, required): Full address
- `venueType` (array, required): Venue types/categories
- `accessibility` (array, optional): Accessibility features
- `venueImage` (file, optional): Venue image
- `submitterName` (string, required): Submitter name
- `submitterEmail` (string, required): Submitter email

**Response Format:**
```json
{
  "success": true,
  "message": "Venue submitted successfully",
  "venueId": "recVenueXXXXXXXXXX"
}
```

---

## Admin Functions

### `get-pending-events.js`
**Purpose:** Retrieve events pending admin approval.

**HTTP Method:** GET

**Authentication:** Required (Firebase)

**Response Format:**
```json
{
  "events": [
    {
      "id": "recXXXXXXXXXXXXXX",
      "fields": {
        "Event Name": "Pending Event",
        "Status": "Pending Approval",
        "Submitted": "2024-07-01T10:00:00Z",
        "Submitter Name": "Jane Doe",
        "Submitter Email": "jane@example.com"
      }
    }
  ]
}
```

### `get-pending-venues.js`
**Purpose:** Retrieve venues pending admin approval.

**HTTP Method:** GET

**Authentication:** Required

**Response:** Similar format to `get-pending-events`

### `get-pending-items.js`
**Purpose:** Get combined pending events and venues.

**HTTP Method:** GET

**Authentication:** Required

**Response Format:**
```json
{
  "events": [...],
  "venues": [...]
}
```

### `create-approved-event.js`
**Purpose:** Create or update events from admin interface.

**HTTP Method:** POST

**Authentication:** Required

**Content-Type:** multipart/form-data

**Additional Fields:**
- `eventId` (string, optional): For updates
- `status` (string): Event status ("Approved", "Pending", "Rejected")

**Key Features:**
- Handles event updates and creation
- Manages recurring event series
- Updates event status
- Image upload and management

### `create-approved-venue.js`
**Purpose:** Create or update venues from admin interface.

**HTTP Method:** POST

**Authentication:** Required

### `update-item-status.js`
**Purpose:** Update status of events or venues.

**HTTP Method:** POST

**Authentication:** Required

**Request Body:**
```json
{
  "table": "Events", // or "Venues"
  "recordId": "recXXXXXXXXXXXXXX",
  "status": "Approved" // "Approved" | "Rejected" | "Pending"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Status updated successfully"
}
```

### `update-submission-status.js`
**Purpose:** Update submission status with additional metadata.

**HTTP Method:** POST

**Authentication:** Required

### `archive-event.js`
**Purpose:** Archive old or cancelled events.

**HTTP Method:** POST

**Authentication:** Required

**Parameters:**
- `eventId` (string, required): Event to archive

---

## Utility & Processing Functions

### `process-poster.js`
**Purpose:** Extract event information from poster images using AI.

**HTTP Method:** POST

**Authentication:** Required

**Form Fields:**
- `posterImage` (file, required): Image file to process

**Response Format:**
```json
{
  "events": [
    {
      "eventName": "Extracted Event Name",
      "date": "2024-07-15",
      "startTime": "20:00",
      "description": "AI-extracted description...",
      "venue": "Detected Venue Name"
    }
  ]
}
```

**Key Features:**
- Uses Google Gemini Vision API
- Extracts multiple events from single poster
- Returns structured event data
- Handles various poster formats

### `process-spreadsheet.js`
**Purpose:** Extract events from Excel/CSV files.

**HTTP Method:** POST

**Authentication:** Required

**Form Fields:**
- `spreadsheet` (file, required): Excel/CSV file

**Response:** Same format as `process-poster`

**Key Features:**
- Supports .xlsx and .csv formats
- Maps spreadsheet columns to event fields
- Handles multiple events per file
- Data validation and cleanup

### `categorize-events.js`
**Purpose:** Automatically categorize events using AI.

**HTTP Method:** POST

**Authentication:** Required

**Request Body:**
```json
{
  "eventIds": ["recXXXXXXXXXXXXXX"],
  "force": false // Optional: force re-categorization
}
```

**Key Features:**
- AI-powered event categorization
- Batch processing support
- Category confidence scoring
- Manual override protection

### `cleanup-descriptions.js`
**Purpose:** Clean and standardize event descriptions.

**HTTP Method:** POST

**Authentication:** Required

**Key Features:**
- Removes formatting inconsistencies
- Standardizes text formatting
- Handles special characters
- Maintains original meaning

### `fix-event-slugs.js`
**Purpose:** Generate or fix event slug URLs.

**HTTP Method:** POST

**Authentication:** Required

**Key Features:**
- Generates SEO-friendly slugs
- Handles duplicate slug conflicts
- Updates existing events
- Maintains URL consistency

### `update-recurring-events.js`
**Purpose:** Update recurring event series and generate new instances.

**HTTP Method:** POST

**Authentication:** Required

**Key Features:**
- Generates future recurring events
- Updates series relationships
- Manages series metadata
- Handles recurrence rule changes

### `migrate-data.js`
**Purpose:** Data migration and transformation utilities.

**HTTP Method:** POST

**Authentication:** Required

**Key Features:**
- Bulk data transformations
- Schema migrations
- Data validation
- Rollback capabilities

### `migrate-event-images.js`
**Purpose:** Migrate event images to Cloudinary with optimization.

**HTTP Method:** POST

**Authentication:** Required

**Key Features:**
- Batch image migration
- Automatic optimization
- URL updating
- Progress tracking

### `update-and-notify.js`
**Purpose:** Update records and send notifications.

**HTTP Method:** POST

**Authentication:** Required

**Key Features:**
- Email notifications
- Webhook triggers
- Status updates
- Bulk operations

---

## Helper Functions & Utilities

### Common Patterns

#### Authentication Verification
```javascript
// Firebase token verification pattern used across admin functions
const admin = require('firebase-admin');

async function verifyAuth(event) {
  const authHeader = event.headers.authorization;
  if (!authHeader) {
    throw new Error('Authentication required');
  }
  
  const token = authHeader.replace('Bearer ', '');
  const decodedToken = await admin.auth().verifyIdToken(token);
  return decodedToken;
}
```

#### Airtable Integration
```javascript
// Standard Airtable connection pattern
const Airtable = require('airtable');
const base = new Airtable({ 
  apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN 
}).base(process.env.AIRTABLE_BASE_ID);

// Query pattern
const records = await base('Events').select({
  view: "Approved Upcoming",
  sort: [{ field: 'Date', direction: 'asc' }]
}).all();
```

#### Cloudinary Image Upload
```javascript
// Image upload pattern
const cloudinary = require('cloudinary').v2;

async function uploadImage(file) {
  const base64String = file.content.toString('base64');
  const dataUri = `data:${file.contentType};base64,${base64String}`;
  
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: 'brumoutloud_events',
    eager: [
      { width: 800, height: 600, crop: 'fill', gravity: 'auto' },
      { width: 400, height: 400, crop: 'fill', gravity: 'auto' }
    ]
  });
  
  return result;
}
```

#### Error Handling
```javascript
// Standard error response pattern
function errorResponse(error, statusCode = 500) {
  console.error('Function error:', error);
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      success: false,
      error: error.message || 'Internal server error',
      code: error.code || 'UNKNOWN_ERROR'
    })
  };
}
```

#### Success Response
```javascript
// Standard success response pattern
function successResponse(data, statusCode = 200) {
  return {
    statusCode,
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      success: true,
      ...data
    })
  };
}
```

---

## Environment Variables

### Required Configuration
```bash
# Airtable Integration
AIRTABLE_PERSONAL_ACCESS_TOKEN=patXXXXXXXXXXXXXX
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX

# Cloudinary Image Storage
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuvwxyz

# Google AI Integration
GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Firebase Admin (for auth verification)
FIREBASE_ADMIN_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@project.iam.gserviceaccount.com
FIREBASE_ADMIN_PROJECT_ID=your-project-id
```

### Development Setup
```javascript
// For local development, create .env file
const dotenv = require('dotenv');
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}
```

---

## Error Codes & Troubleshooting

### Common Error Codes

#### `MISSING_PARAMETERS`
- **Cause:** Required form fields or query parameters missing
- **Solution:** Check API documentation for required fields

#### `AUTHENTICATION_REQUIRED`
- **Cause:** Admin function called without Firebase token
- **Solution:** Include valid `Authorization: Bearer <token>` header

#### `INVALID_TOKEN`
- **Cause:** Firebase token expired or invalid
- **Solution:** Refresh authentication token

#### `AIRTABLE_ERROR`
- **Cause:** Database operation failed
- **Solutions:**
  - Check Airtable API limits
  - Verify field names and types
  - Check record permissions

#### `CLOUDINARY_ERROR`
- **Cause:** Image upload failed
- **Solutions:**
  - Check file size (max 10MB)
  - Verify supported formats (JPEG, PNG, GIF)
  - Check Cloudinary quota

#### `AI_ERROR`
- **Cause:** Google Gemini API call failed
- **Solutions:**
  - Check API key validity
  - Verify request format
  - Check API quotas

### Debug Logging
```javascript
// Enable debug logging
console.log('Function input:', JSON.stringify(event, null, 2));
console.log('Environment check:', {
  airtable: !!process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
  cloudinary: !!process.env.CLOUDINARY_API_KEY,
  gemini: !!process.env.GEMINI_API_KEY
});
```

---

## Performance Considerations

### Function Optimization
- **Cold Start Reduction:** Keep functions warm with scheduled pings
- **Memory Usage:** Optimize for 512MB-1GB memory allocation
- **Timeout Settings:** Most functions timeout at 30 seconds
- **Connection Pooling:** Reuse database connections where possible

### Rate Limiting
```javascript
// Example rate limiting implementation
const rateLimits = new Map();

function checkRateLimit(ip, limit = 100, window = 3600000) {
  const now = Date.now();
  const userRequests = rateLimits.get(ip) || [];
  
  // Remove old requests outside window
  const validRequests = userRequests.filter(time => now - time < window);
  
  if (validRequests.length >= limit) {
    throw new Error('Rate limit exceeded');
  }
  
  validRequests.push(now);
  rateLimits.set(ip, validRequests);
}
```

### Caching Strategies
- **Static Data:** Cache venue lists and categories
- **Dynamic Data:** Short-term caching for event lists
- **Images:** Use Cloudinary CDN caching
- **API Responses:** Cache frequently accessed data

---

## Security Best Practices

### Input Validation
```javascript
// Example validation function
function validateEventInput(data) {
  const required = ['eventName', 'description', 'date', 'venue'];
  for (const field of required) {
    if (!data[field] || data[field].trim() === '') {
      throw new Error(`${field} is required`);
    }
  }
  
  // Date validation
  if (!isValidDate(data.date)) {
    throw new Error('Invalid date format');
  }
  
  // Length validation
  if (data.eventName.length > 200) {
    throw new Error('Event name too long');
  }
}
```

### Sanitization
```javascript
// HTML/script sanitization
function sanitizeInput(input) {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/[<>]/g, '')
    .trim();
}
```

### CORS Headers
```javascript
// Standard CORS configuration
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};
```

---

## Monitoring & Logging

### Function Monitoring
- **Netlify Analytics:** Built-in function performance metrics
- **Error Tracking:** Console.error logs captured automatically
- **Custom Metrics:** Use structured logging for tracking

### Log Formatting
```javascript
// Structured logging pattern
function logEvent(level, message, metadata = {}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    functionName: context.functionName,
    requestId: context.awsRequestId,
    ...metadata
  }));
}
```

---

## Testing

### Unit Testing
```javascript
// Example test for event submission
const { handler } = require('./event-submission');

describe('Event Submission', () => {
  test('should create event successfully', async () => {
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        eventName: 'Test Event',
        description: 'Test Description',
        date: '2024-07-15'
      })
    };
    
    const result = await handler(event, {});
    expect(result.statusCode).toBe(200);
  });
});
```

### Integration Testing
- Test with actual Airtable records
- Verify Cloudinary uploads
- Check Firebase authentication
- Validate AI API responses

---

## Deployment & CI/CD

### Automatic Deployment
Functions deploy automatically when pushed to main branch via Netlify's Git integration.

### Environment Management
```toml
# netlify.toml
[build]
  functions = "netlify/functions"

[build.environment]
  NODE_VERSION = "18"

[[plugins]]
  package = "@netlify/plugin-functions-install-core"
```

### Health Checks
```javascript
// Health check endpoint
exports.handler = async (event, context) => {
  const checks = {
    airtable: !!process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
    cloudinary: !!process.env.CLOUDINARY_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY
  };
  
  const healthy = Object.values(checks).every(Boolean);
  
  return {
    statusCode: healthy ? 200 : 503,
    body: JSON.stringify({ healthy, checks })
  };
};
```

---

*Last updated: [Current Date]*
*Functions Version: 1.0*