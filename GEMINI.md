# BrumOutLoud Product Overview & Development Guide

Welcome to the BrumOutLoud team! This document serves as a living guide to our product, outlining its vision, current status, and ongoing development priorities. As your dedicated AI assistant, I am here to support you in all software engineering tasks.

## Core Principles for Collaboration

1.  **Discuss Before Action:** Always initiate a discussion with me to ensure a complete understanding of requirements before implementing any bug fixes or new features.
2.  **Confirm Fixes:** After implementing a fix, I will confirm with you that the issue is resolved before moving on to other tasks.
2.  **Additive Changes Preferred:** Prioritize additive and minimally invasive code modifications to reduce risk. Significant refactoring or rewrites require explicit approval.
3.  **Documentation as a Priority:** This `GEMINI.md` file will be continuously updated to reflect all changes, resolutions, and new insights, maintaining a shared, current understanding of the project.
4.  **Leverage External Expertise:** For complex challenges, I will formulate detailed requests to Gemini Pro 2.5, providing all necessary context to seek advanced assistance.

## Product Vision

Our mission is to be the definitive, bold, and unapologetic guide to Birmingham's LGBTQ+ scene. We aim to provide a modern, engaging platform for both the public seeking event information and promoters/venues looking to list their offerings.

## Current Product Status (June 2025)

Version 1.0 of our listings platform is stable and operational.

**Key Highlights:**
*   Robust content submission for events.
*   Stable "Unified Venue Model" ensuring accurate event-to-venue linking.
*   Comprehensive admin panel for content management.
*   Monetization features (Featured Banner, Boosted Listing) are designed and backend-ready for payment integration.

**Technical Stack:**
*   **Frontend:** HTML, CSS, JavaScript, Tailwind CSS
*   **Backend:** Netlify Functions (serverless JavaScript)
*   **Database:** Airtable
*   **Authentication:** Firebase Authentication
*   **AI/ML:** Google's Gemini API
*   **Image Hosting:** Cloudinary (Implemented optimized image delivery via Cloudinary URLs in `get-events.js` and `event-submission.js`.)

## Development Roadmap & Backlog

Our path to public launch and future growth is clearly defined.

**Launch-Critical Backlog:**
These items are essential for public launch and data migration.

*   **Form Consistency (Recurrence):** Update `promoter-submit.html` to integrate the new structured recurrence system.
*   **Airtable Schema Update:** Create a new field named "Series ID" (Text type) in the "Events" table in Airtable.
*   **Site Branding:** Implement favicons and core branding elements. Ensure "Brum Outloud" styling with "Omnes Pro" font.
*   **Improved Event Filtering:** Add new filter options (e.g., "sober events") to the events page.

**Post-Launch & Future Vision Backlog:**
Larger epics for future development.

*   **Monetization - Payment Workflow:** Develop "Upgrade Event" page, integrate Stripe, and create backend function for Airtable updates on successful payments.
*   **Blog & Content Hub:** Create a platform for articles, interviews, and news to drive traffic and community engagement.
*   **Community Directory:** Expand beyond events to include LGBTQ+ sports teams, social clubs, businesses, and safe spaces.
*   **Enriched Venue Pages:** Enhance venue pages with dynamic content like photo galleries and social media feeds.
*   **Themed Event Hubs:** Create dedicated evergreen pages for major community events (e.g., Birmingham Pride) with grouped listings and up-to-date information.
*   **Integrated Ticketing System:** Allow direct ticket purchases on BrumOutLoud for a seamless user experience and new revenue stream.
*   **Queer Creatives Directory:** A resource for promoters to find and hire local LGBTQ+ talent.
*   **Promoter Portal:** A long-term vision for a login-based portal for promoters to manage their content.

## SEO Checklist

Key SEO tasks to enhance visibility:

*   **Technical SEO:**
    *   `robots.txt`: Configured to guide crawlers. (Status: Done)
    *   XML Sitemap: Generated and submitted. (Status: Done)
    *   Canonical Tags: Implement for dynamic pages. (Status: To Do)
    *   Mobile-Friendliness: Improved responsiveness of suggested events section on event details page. (Status: Resolved - Bug #6)
*   Site Speed: Optimize images, minify CSS/JS, leverage caching. (Status: To Do)
    *   HTTPS: Ensured via Netlify. (Status: Done)
*   **On-Page SEO (Event & Venue Pages):**
    *   Unique & Descriptive Page Titles: Dynamically include event/venue name. (Status: To Do)
    *   Meta Descriptions: Dynamically generate compelling summaries. (Status: To Do)
    *   Structured Data (Schema Markup): Implement Event and LocalBusiness schema. (Status: To Do - Flagged as Launch-Critical)
    *   Header Tags (H1, H2, etc.): Ensure proper content structure. (Status: To Do)
    *   Keyword Optimization: Natural integration of relevant keywords. (Status: To Do)
    *   Image Alt Text: Ensure descriptive alt attributes. (Status: To Do)
*   **General Site SEO:**
    *   Content Quality: Maintain high-quality descriptions. (Status: Ongoing)
    *   Internal Linking: Ensure relevant internal links. (Status: To Do)
    *   User Experience (UX): Continuously improve navigation, readability, and overall user satisfaction. (Status: Ongoing)

## Bug Log

This section tracks identified bugs and their current statuses.

**Resolved Bugs:**
*   **Event Form - Venue Management Issues**
*   **Event Form - Missing Image Upload Field & Submission Failure**
*   **Admin Event Management - Inability to Remove Events**
*   **Admin Event Form - Submit Button Stuck State**
*   **Approve Events List - Loading Failure (and Button Functionality)**
*   **Poster/Spreadsheet Parser:** Parsed events were not displayed, and buttons would time out, with a `TypeError: Cannot read properties of undefined (reading 'length')` on the frontend.
    *   **Resolution:** The Netlify functions `process-poster.js` and `process-spreadsheet.js` were returning a raw JSON array, while the frontend `admin-poster-tool.html` expected an object with an `events` property. The backend functions have been updated to return the parsed events wrapped in an `events` object, aligning with the frontend's expectation. Additionally, the `Content-Type: application/json` header is now consistently set in both success and error responses from these functions.
    *   **Status:** RESOLVED
*   **Promoter Submit Form - Category Field & Venue Dropdown Issues**
*   **Venue TBC on Approval Queue:** Events in the approval queue now correctly display the linked venue name.
*   **Header Loading Glitch & Styling Issues:** When loading any page, the main content appeared before the header, causing a visual "glitch" or jump. Additionally, styling was not consistently applied across all pages.
*   **Event Listings on Venue Page:** The split between "regular recurring nights" and "one-off events" was missing on the venue details page.
*   **No favicon on event details page**
*   **Admin Event Form - Save Changes Button Not Working:** The save changes button in `admin-edit-events.html` was not functioning due to a 500 Internal Server Error from the `create-approved-event.js` Netlify function, which was also returning invalid JSON. The `create-approved-event.js` function has been updated to correctly parse form data and return valid JSON, resolving the submission issue.
*   **Admin Event Form - Save Changes Button Not Working:** The save changes button in `admin-edit-events.html` was not functioning due to a 500 Internal Server Error from the `create-approved-event.js` Netlify function, which was also returning invalid JSON. The `create-approved-event.js` function has been updated to correctly parse form data and return valid JSON, resolving the submission issue.

**Current Unresolved Bugs:**

*   **Header Loading Glitch:** When loading any page, the main content appeared before the header, causing a visual "glitch" or jump. This was due to the header being loaded asynchronously via JavaScript.
    *   **Resolution:** The header and footer injection via JavaScript in `js/main.js` has been removed. The header and footer HTML content from `global/header.html` and `global/footer.html` are now directly included in all relevant HTML files, ensuring synchronous loading and eliminating the visual glitch.
    *   **Status:** RESOLVED
*   **Event Deletion:** The delete functionality on the "Manage Events" page is not working.
*   **No Redirects File**
*   **No custom 404 pages**

**Resolved Bugs:**

*   **Day logic:** For the purposes of a nightlife events website, we need to consider the period between midnight and 6 am as part of the day before, as some events may even start at midnight on June 26th, for example, yet our current logic would place that at the morning of that date rather than a continuation of that date's nighttime.
    *   **Resolution:** Implemented `getEffectiveToday()` helper function in `netlify/functions/get-venue-details.js` to adjust the "today" cutoff to 6 AM, ensuring accurate filtering for nightlife events.
    *   **Status:** RESOLVED
*   **Add to Calendar button not working.**
    *   **Resolution:** The `get-event-details` serverless function was generating incorrect data for recurring events in both Google Calendar and ICS files. The function has been updated to correctly format the recurring dates for both calendar types, ensuring that all events in a series are added to the user's calendar.
    *   **Status:** RESOLVED
*   **Add to calendar for event series only adds the first event**
    *   **Resolution:** This issue was resolved as part of the fix for the "Add to Calendar button not working" bug. The `get-event-details` serverless function now correctly formats recurring event data for all calendar types, ensuring all events in a series are added.
    *   **Status:** RESOLVED
*   **Persistent `SyntaxError` in `admin-edit-events.html`:**
    *   **Resolution:** Resolved by wrapping the script in an IIFE and changing `let` to `var` for `currentFilter` to prevent re-declaration errors.
    *   **Status:** RESOLVED
*   **Recurring Event Creation (Admin Form - `create-approved-event.js`):**
    *   **Resolution:** Corrected recurrence data property names and ensured `createNaturalLanguageRule` is used for human-readable strings.
    *   **Status:** RESOLVED
*   **Recurring Event Creation (Promoter Form - `event-submission.js`):**
    *   **Resolution:** Ensured `createNaturalLanguageRule` is used to store human-readable strings in Airtable.
    *   **Status:** RESOLVED
*   **"Series ID" Field:**
    *   **Resolution:** Modified backend functions (`create-approved-event.js` and `event-submission.js`) to assign the Airtable record ID of the first event in a series as the "Series ID" for all subsequent events in that series.
    *   **Status:** RESOLVED
*   **Frontend Grouping and Display of Recurring Events:**
    *   **Resolution:** Updated `admin-edit-events.html` to correctly handle parent and child events, and pre-populate venue and recurrence fields in the edit form.
    *   **Status:** RESOLVED

## Handover: Recurring Event Functionality and "Manage Events" Page

**Date:** July 10, 2025

**Current State:**

All issues related to recurring event functionality and the "Manage Events" page, as outlined in the previous handover, have been resolved. The system now correctly handles recurring event creation, displays them appropriately on the admin page, and pre-populates venue and recurrence rules when editing.

**Next Steps:**

No further steps are required for this section of the handover.
