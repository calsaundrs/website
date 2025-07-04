# BrumOutLoud Product Overview & Development Guide

Welcome to the BrumOutLoud team! This document serves as a living guide to our product, outlining its vision, current status, and ongoing development priorities. As your dedicated AI assistant, I am here to support you in all software engineering tasks.

## Core Principles for Collaboration

1.  **Discuss Before Action:** Always initiate a discussion with me to ensure a complete understanding of requirements before implementing any bug fixes or new features.
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
*   **Image Hosting:** Cloudinary

## Development Roadmap & Backlog

Our path to public launch and future growth is clearly defined.

**Launch-Critical Backlog:**
These items are essential for public launch and data migration.

*   **Form Consistency (Recurrence):** Update `promoter-submit.html` to integrate the new structured recurrence system.
*   **Site Branding:** Implement favicons and core branding elements. Ensure "Brum Outloud" styling with "Omnes Pro" font.
*   **Improved Event Filtering:** Add new filter options (e.g., "sober events") to the events page.
*   **Monetization - Payment Workflow:** Develop "Upgrade Event" page, integrate Stripe, and create backend function for Airtable updates on successful payments.

**Post-Launch & Future Vision Backlog:**
Larger epics for future development.

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
    *   Mobile-Friendliness: Review responsiveness, especially event filters. (Status: In Progress - Bug #6)
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
*   **Poster/Spreadsheet Parser:** Syntax error when using the poster parser.
*   **Promoter Submit Form - Category Field & Venue Dropdown Issues**
*   **Venue TBC on Approval Queue:** Events in the approval queue now correctly display the linked venue name.
*   **Header Loading Glitch & Styling Issues:** When loading any page, the main content appeared before the header, causing a visual "glitch" or jump. Additionally, styling was not consistently applied across all pages.
*   **Event Listings on Venue Page:** The split between "regular recurring nights" and "one-off events" was missing on the venue details page.
*   **No favicon on event details page**

**Current Unresolved Bugs:**

*   **Header Loading Glitch:** When loading any page, the main content appears before the header, causing a visual "glitch" or jump. This is due to the header being loaded asynchronously via JavaScript. (Status: To Do)
*   **Event Deletion:** The delete functionality on the "Manage Events" page is not working.
*   **No Redirects File**
*   **No custom 404 pages**
*   **Day logic:** For the purposes of a nightlife events website, we need to consider the period between midnight and 6 am as part of the day before, as some events may even start at midnight on June 26th, for example, yet our current logic would place that at the morning of that date rather than a continuation of that date's nighttime.
    *   **Resolution:** Implemented `getEffectiveToday()` helper function in `netlify/functions/get-venue-details.js` to adjust the "today" cutoff to 6 AM, ensuring accurate filtering for nightlife events.
    *   **Status:** RESOLVED
   **Add to Calendar button not working.**
    *   **Resolution:** The `get-event-details` serverless function was generating incorrect data for recurring events in both Google Calendar and ICS files. The function has been updated to correctly format the recurring dates for both calendar types, ensuring that all events in a series are added to the user's calendar.
    *   **Status:** RESOLVED
*   **Add to calendar for event series only adds the first event**
    *   **Resolution:** This issue was resolved as part of the fix for the "Add to Calendar button not working" bug. The `get-event-details` serverless function now correctly formats recurring event data for all calendar types, ensuring all events in a series are added.
    *   **Status:** RESOLVED

## Next Steps

Let's discuss the updated backlog and confirm priorities for upcoming sprints. I'm here to assist with any questions.