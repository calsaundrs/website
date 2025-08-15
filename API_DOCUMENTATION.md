# BrumOutLoud API Documentation

## Overview

BrumOutLoud is a comprehensive LGBTQ+ events platform for Birmingham. This documentation covers all public APIs, serverless functions, and their usage patterns.

**Base URL:** `https://your-netlify-domain.netlify.app/.netlify/functions/`

**Technology Stack:**
- **Backend:** Netlify Functions (Node.js serverless)
- **Database:** Firestore (Firebase)
- **Authentication:** Firebase Authentication
- **Image Storage:** Cloudinary
- **AI Integration:** Google Gemini API

---

## Authentication

Most admin endpoints require Firebase Authentication. Include the Firebase ID token in requests to protected endpoints.

```javascript
// Example: Getting Firebase auth token
import { getAuth, onAuthStateChanged } from "firebase/auth";
const auth = getAuth();
const user = auth.currentUser;
const token = await user.getIdToken();
```

---

## Public Events API

### GET /get-events-firestore-simple

Retrieves events from Firestore based on specified parameters.

**Parameters:**
- `view` (string, optional): 
  - `"admin"` - Returns admin view with additional fields
  - Default: Returns public event listing

**Response Format:**
```json
{
  "events": [
    {
      "id": "recXXXXXXXXXXXXXX",
      "fields": {
        "Event Name": "Pride Night",
        "Description": "Celebrate diversity...",
        "Date": "2024-07-15",
        "Promo Image": ["https://cloudinary.com/..."],
        "Slug": "pride-night-july-2024",
        "Venue": ["recVenueID"],
        "Venue Name": "The Venue Name",
        "Category": ["Party", "LGBTQ+"],
        "Recurring Info": "Weekly on Fridays",
        "Series ID": "recParentEventID"
      }
    }
  ]
}
```

**Example Usage:**
```javascript
// Get public events
fetch('/.netlify/functions/get-events-firestore-simple')
  .then(response => response.json())
  .then(data => console.log(data.events));

// Get admin view
fetch('/.netlify/functions/get-events-firestore?view=admin')
  .then(response => response.json())
  .then(data => console.log(data.events));
```

### GET /get-event-details-firestore

Retrieves detailed information for a specific event by slug from Firestore.

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
    "location": "The Rainbow Venue",
    "image": "https://cloudinary.com/...",
    "venue": {
      "name": "The Rainbow Venue",
      "address": "123 Pride Street",
      "slug": "rainbow-venue"
    },
    "addToCalendarLinks": {
      "google": "https://calendar.google.com/...",
      "ical": "data:text/calendar;charset=utf8,..."
    }
  }
}
```

### GET /get-event-details-by-id

Retrieves event details by Firestore document ID.

**Parameters:**
- `id` (string, required): Firestore document ID

**Response:** Same format as `/get-event-details`

---

## Venues API

### GET /get-venues

Retrieves venue listings with optional filtering.

**Parameters:**
- `view` (string, optional): Database view to query
- `filter` (string, optional): Additional filtering criteria

**Response Format:**
```json
{
  "venues": [
    {
      "id": "recVenueXXXXXXXXXX",
      "fields": {
        "Venue Name": "The Rainbow Club",
        "Description": "Birmingham's premier LGBTQ+ venue...",
        "Address": "123 Pride Street, Birmingham",
        "Venue Type": ["Club", "Bar"],
        "Image": ["https://cloudinary.com/..."],
        "Slug": "rainbow-club"
      }
    }
  ]
}
```

### GET /get-venue-details

Retrieves detailed venue information including upcoming events.

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
    "image": "https://cloudinary.com/...",
    "recurringEvents": [
      {
        "name": "Weekly Pride Night",
        "description": "Every Friday night..."
      }
    ],
    "upcomingEvents": [
      {
        "name": "Special Pride Event",
        "date": "2024-07-15"
      }
    ]
  }
}
```

### GET /get-venue-list

Returns a simplified list of all venues for dropdowns and selection.

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

### GET /find-venue

Searches for venues by name or location.

**Parameters:**
- `q` (string, required): Search query

**Response:** Array of matching venues

---

## Event Submission API

### POST /event-submission

Submits a new event for approval. Supports multipart form data for image uploads.

**Authentication:** Not required (public submission)

**Form Fields:**
- `eventName` (string, required): Event name
- `description` (string, required): Event description
- `date` (string, required): Event date (YYYY-MM-DD)
- `startTime` (string, required): Start time (HH:MM)
- `endTime` (string, optional): End time (HH:MM)
- `venue` (string, required): Venue ID or name
- `category` (array, required): Event categories
- `isRecurring` (boolean): Whether event repeats
- `recurrenceData` (object): Recurrence configuration if recurring
- `promoImage` (file, optional): Promotional image
- `submitterName` (string, required): Submitter name
- `submitterEmail` (string, required): Submitter email

**Recurrence Data Format:**
```json
{
  "type": "weekly", // "weekly" | "monthly"
  "days": [1, 5], // For weekly: day indices (0=Sunday)
  "monthlyType": "date", // For monthly: "date" | "day"
  "dayOfMonth": 15, // For monthly date type
  "week": "1", // For monthly day type: "1"|"2"|"3"|"4"|"-1"
  "dayOfWeek": 1 // For monthly day type: day index
}
```

**Response:**
```json
{
  "success": true,
  "message": "Event submitted successfully",
  "eventId": "recXXXXXXXXXXXXXX",
  "recurringEventIds": ["recYYYYYYYYYYYYY", "recZZZZZZZZZZZZ"]
}
```

**Example Usage:**
```javascript
const formData = new FormData();
formData.append('eventName', 'Pride Night');
formData.append('description', 'Celebrate diversity...');
formData.append('date', '2024-07-15');
formData.append('startTime', '20:00');
formData.append('venue', 'recVenueXXXXXXXXXX');
formData.append('category', JSON.stringify(['Party', 'LGBTQ+']));
formData.append('submitterName', 'Jane Doe');
formData.append('submitterEmail', 'jane@example.com');

fetch('/.netlify/functions/event-submission', {
  method: 'POST',
  body: formData
})
.then(response => response.json())
.then(data => console.log(data));
```

---

## Venue Submission API

### POST /venue-submission

Submits a new venue for approval.

**Authentication:** Not required (public submission)

**Form Fields:**
- `venueName` (string, required): Venue name
- `description` (string, required): Venue description
- `address` (string, required): Full address
- `venueType` (array, required): Venue types/categories
- `accessibility` (array, optional): Accessibility features
- `venueImage` (file, optional): Venue image
- `submitterName` (string, required): Submitter name
- `submitterEmail` (string, required): Submitter email

**Response:**
```json
{
  "success": true,
  "message": "Venue submitted successfully",
  "venueId": "recVenueXXXXXXXXXX"
}
```

---

## Admin APIs

All admin endpoints require Firebase authentication.

### GET /get-pending-events

Retrieves events pending approval.

**Authentication:** Required

**Response:**
```json
{
  "events": [
    {
      "id": "recXXXXXXXXXXXXXX",
      "fields": {
        "Event Name": "Pending Event",
        "Status": "Pending Approval",
        "Submitted": "2024-07-01T10:00:00Z"
      }
    }
  ]
}
```

### GET /get-pending-venues

Retrieves venues pending approval.

**Authentication:** Required

**Response:** Similar format to `/get-pending-events`

### POST /create-approved-event

Creates or updates an approved event from admin panel.

**Authentication:** Required

**Form Fields:** Similar to `/event-submission` plus:
- `eventId` (string, optional): For updates
- `status` (string): Event status

### POST /create-approved-venue

Creates or updates an approved venue from admin panel.

**Authentication:** Required

### POST /update-item-status

Updates the status of events or venues.

**Authentication:** Required

**Request Body:**
```json
{
  "table": "Events", // or "Venues"
  "recordId": "recXXXXXXXXXXXXXX",
  "status": "Approved" // or "Rejected", "Pending"
}
```

---

## Utility APIs

### GET /sitemap

Generates XML sitemap for SEO.

**Response:** XML sitemap format

### POST /process-poster

Processes poster images to extract event information using AI.

**Authentication:** Required

**Form Fields:**
- `posterImage` (file, required): Poster image file

**Response:**
```json
{
  "events": [
    {
      "eventName": "Extracted Event Name",
      "date": "2024-07-15",
      "description": "AI-extracted description..."
    }
  ]
}
```

### POST /process-spreadsheet

Processes spreadsheet files to extract multiple events.

**Authentication:** Required

**Form Fields:**
- `spreadsheet` (file, required): Excel/CSV file

**Response:** Same format as `/process-poster`

---

## Error Handling

All APIs return consistent error responses:

```json
{
  "success": false,
  "error": "Error message description",
  "code": "ERROR_CODE"
}
```

**Common Error Codes:**
- `MISSING_PARAMETERS`: Required parameters missing
- `AUTHENTICATION_REQUIRED`: Firebase auth token required
- `INVALID_TOKEN`: Invalid or expired auth token
- `FIRESTORE_ERROR`: Database operation failed
- `CLOUDINARY_ERROR`: Image upload failed
- `AI_ERROR`: AI processing failed

---

## Rate Limiting

APIs are subject to the following limits:
- Public endpoints: 100 requests per minute per IP
- Authenticated endpoints: 500 requests per minute per user
- File upload endpoints: 10 requests per minute per user

---

## SDK Examples

### JavaScript/Frontend Usage

```javascript
class BrumOutLoudAPI {
  constructor(baseUrl = '/.netlify/functions') {
    this.baseUrl = baseUrl;
    this.authToken = null;
  }

  setAuthToken(token) {
    this.authToken = token;
  }

  async getEvents(admin = false) {
    const url = admin ? `${this.baseUrl}/get-events?view=admin` : `${this.baseUrl}/get-events`;
    const response = await fetch(url, this.getAuthHeaders());
    return response.json();
  }

  async submitEvent(formData) {
    const response = await fetch(`${this.baseUrl}/event-submission`, {
      method: 'POST',
      body: formData
    });
    return response.json();
  }

  getAuthHeaders() {
    const headers = {};
    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }
    return { headers };
  }
}

// Usage
const api = new BrumOutLoudAPI();
const events = await api.getEvents();
```

### Node.js/Server Usage

```javascript
const fetch = require('node-fetch');

async function getUpcomingEvents() {
  const response = await fetch('https://your-domain.netlify.app/.netlify/functions/get-events');
  const data = await response.json();
  return data.events;
}
```

---

## Webhooks

### Firestore Real-time Updates

The platform uses Firestore real-time listeners for live updates:

- **Event Status Changes**: Real-time updates when event status changes
- **Venue Approvals**: Live notifications for venue approvals/rejections
- **New Submissions**: Instant updates for new event/venue submissions

Configure Firestore rules and use real-time listeners in your frontend code.

---

## Best Practices

1. **Always handle errors gracefully**
2. **Use appropriate HTTP methods** (GET for retrieval, POST for submissions)
3. **Include proper headers** for authentication
4. **Validate form data** before submission
5. **Optimize image uploads** (max 5MB, JPEG/PNG formats)
6. **Cache responses** where appropriate to reduce API calls
7. **Use slugs instead of IDs** for SEO-friendly URLs

---

## Support

For API support and questions:
- Review this documentation
- Check the error responses for specific error codes
- Ensure all required parameters are included
- Verify authentication tokens are valid

---

*Last updated: [Current Date]*
*API Version: 1.0*