BrumOutLoud Comprehensive Product Plan
To: New Product Manager
From: Gemini, Scrum Master
Date: June 25, 2025

Welcome to the BrumOutLoud team! This document provides a comprehensive overview of the project to ensure a smooth transition, combining product vision, roadmap, SEO tasks, and the current bug log. My role is to act as your Scrum Master and technical expert on the codebase, and I look forward to working with you to bring this fantastic product to launch and beyond.

The primary stakeholder and final decision-maker for all product matters is Callum Saunders.

## Rules of Engagement
1.  **Discuss First, Then Act:** Before attempting to resolve any bug or implement a new feature, I will first discuss the details with you to ensure I have a complete understanding of the issue and requirements.
2.  **Prioritize Additive & Minimally Invasive Changes:** I will avoid unnecessary or large-scale code modifications. When adding new features or elements, I will default to making additive changes to minimize the risk of unintended side effects. Full rewrites or significant refactoring will only be undertaken with your explicit approval.
3.  **Maintain Documentation:** I will update this `GEMINI.md` file as I go, reflecting changes, resolutions, and new insights to keep our shared understanding current.Did you
4.  **Seek External Expertise (Gemini Pro 2.5):** When encountering complex issues that prove difficult to resolve, I will formulate a detailed message for Gemini Pro 2.5, providing all necessary context (code, problem description, previous attempts, etc.) to solicit its assistance.

1. Product Vision & Goal
Our goal is to be the essential, bold, and unapologetic guide to the LGBTQ+ scene in Birmingham.

We are building a modern, visually engaging platform that serves two primary audiences: the public looking for what's on, and the promoters, venues, and community organisers who make the scene what it is. We aim to be the most comprehensive and easiest-to-use resource available.

2. Current State of the Product (As of June 2025)
We have successfully built and stabilized what can be considered Version 1.0 of the listings platform.

Key Strengths & Features:
Robust Content Submission: Promoters have multiple, best-in-class methods for submitting events.

Stable Data Model: A major piece of work (the "Unified Venue Model") is complete, ensuring all events are correctly linked to a venue record in our database.

Comprehensive Admin Panel: A secure admin area allows for reviewing, approving, and editing all content.

Monetization Foundation: The design and backend logic for our two-tiered paid-for listings feature ("Featured Banner" and "Boosted Listing") are complete and ready for the payment workflow to be built.

Technical Stack:
Frontend: HTML, CSS, JavaScript, Tailwind CSS.

Backend: Netlify Functions (serverless JavaScript).

Database: Airtable.

Authentication: Firebase Authentication.

AI & Machine Learning: Google's Gemini API.

Image Hosting: Cloudinary.

3. Product Backlog & Future Roadmap (Release Plan)
We have a well-defined backlog of features and a clear path toward our public launch and beyond.

Definition of Ready for Migration & Launch:
[x] Stable data model for event/venue submission and editing.

[ ] All public submission forms are feature-complete and consistent.

[ ] Core site branding (favicons, etc.) is in place.

[ ] Basic SEO for events (Google structured data) is implemented.

[ ] Public-facing listing pages are refined to a launch-ready standard.

[ ] The payment workflow for monetization features is implemented.

Launch-Critical Backlog
These items should be addressed before a full public launch and data migration.

Story: Form Consistency (Recurrence): Update the promoter-submit.html form to use the new structured recurrence system.

Story: Site Branding: Add favicons and other core branding elements. Ensure the site name is stylized as "Brum Outloud" and uses the "Omnes Pro" font for consistency with the old site, even if it deviates from the current design-system.html.

Story: Improved Event Filtering: Add new filter options to the events page (e.g., for "sober events").

Epic: Monetization - Payment Workflow:

Goal: Allow promoters to purchase "Featured Banner" and "Boosted Listing" packages.

Tasks: Create a new "Upgrade Event" page, integrate Stripe for payments, and write the backend function to update Airtable on successful payment.

Post-Launch & Future Vision Backlog
These are larger epics that will form the core of our roadmap after the initial launch.

Epic: Blog & Content Hub

User Story: As a community member, I want to read articles, interviews, and news relevant to the Birmingham scene so that I feel more connected.

Notes: This is a strong driver of traffic. We should explore migrating the existing blog and potentially partnering with other content creators like Midlands Rainbow.

Epic: Community Directory

User Story: As a new person in the city, I want to find LGBTQ+ sports teams, social clubs, queer-owned businesses, and safe spaces like saunas, so I can find my community.

Notes: This expands the site beyond just events into a true community resource. Would include a map view for venues and listings.

Epic: Enriched Venue Pages

User Story: As a user, I want to see more dynamic content on a venue's page, like a photo gallery and their latest Instagram posts, so I can get a better feel for the place.

Epic: Themed Event Hubs (e.g., Birmingham Pride Evergreen Page)

User Story: As a user, I want to see a special landing page for big community events (like Pride) that groups all related listings together and provides up-to-date information.

Specific Plan for Birmingham Pride:

SEO Goal: Establish Brum Outloud as the authoritative resource for Birmingham Pride information, both current and future.

Action: Create a dedicated, evergreen page (e.g., brumoutloud.co.uk/birmingham-pride).

URL Strategy: Use a non-year-specific URL. If year-specific URLs exist (e.g., /birmingham-pride-2025), implement 301 redirects to the evergreen page.

Content:

Current Year Focus (e.g., 2026): Prominently display key dates, themes, and confirmed details as soon as they are available.

"Stay Tuned" / Placeholder: For early stages, clearly state that information is "Coming Soon," "Dates TBC," or "Lineup Announcements Expected [Month/Year]" to capture early search traffic.

General Information: Include sections on what Birmingham Pride is (brief history/significance), key event types (Parade, Festival site, community events), how to get involved (volunteer, promote events), and past highlights (photos/summaries from previous years).

Calls to Action: Encourage email sign-ups for updates and social media follows.

On-Page SEO:

<title>: "Birmingham Pride [Year] - Dates, Lineup & Events | Brum Outloud" (update year annually, or use "Birmingham Pride | Your Guide to All Events" for a fully evergreen title).

<meta description>: "Your essential guide to Birmingham Pride [Year]: discover event dates, lineup announcements, venue details, and community celebrations with Brum Outloud."

<h1>: "Birmingham Pride [Year]"

Appropriate use of <h2>, <h3> for sections.

Structured Data: Implement Event (or Festival) Schema.org markup for the overall Pride event.

Internal Linking: Link prominently to this page from the homepage and events page.

Epic: Integrated Ticketing System

User Story: As a user, I want to buy tickets for an event directly on BrumOutLoud without being sent to another website, so the experience is faster and more seamless.

Notes: This is a major feature that provides a better user experience and a new revenue stream (small commission). It also provides a valuable marketing email collection route.

Epic: Queer Creatives Directory

User Story: As an event promoter, I want to find and hire local LGBTQ+ talent (DJs, photographers, designers, etc.) for my events.

Epic: Promoter Portal (Long-Term)

A full-fledged, login-based portal for promoters to manage their own content directly.

4. SEO Checklist
This checklist outlines key Search Engine Optimization (SEO) tasks to improve BrumOutLoud's visibility on search engines, focusing on technical and on-page fundamentals.

Technical SEO Fundamentals
Robots.txt:

Goal: Guide search engine crawlers.

Action: Ensure robots.txt exists in the root directory and doesn't block essential pages. (e.g., User-agent: * Disallow: /admin/ is good, but don't Disallow: /events/).

Status: Done

Sitemap (XML):

Goal: Help search engines discover all important pages.

Action: Generate an XML sitemap (e.g., sitemap.xml) listing all public-facing event pages, venue pages, and static pages. Submit it to Google Search Console.

Status: Done

Canonical Tags:

Goal: Prevent duplicate content issues.

Action: For dynamic pages (like event or venue details), ensure a <link rel="canonical" href="[preferred-URL]" /> tag points to the preferred version of the URL.

Status: To Do

Mobile-Friendliness (Responsiveness):

Goal: Provide a good user experience on all devices, which is a ranking factor.

Action: Review overall site responsiveness, especially focusing on the events.html filters which were previously flagged.

Status: In Progress (Bug #6)

Site Speed:

Goal: Improve user experience and rankings.

Action: Optimize images (Cloudinary helps, but ensure sizes are appropriate), minify CSS/JS, leverage browser caching.

Status: To Do

HTTPS:

Goal: Secure connection (ranking factor).

Action: Ensure entire site is served over HTTPS (Netlify usually handles this automatically).

Status: Done (Assumed via Netlify)

On-Page SEO for Event & Venue Pages
Unique & Descriptive Page Titles (<title> tag):

Goal: Tell search engines and users what the page is about.

Action: For each event and venue detail page, ensure the <title> dynamically includes the event/venue name and "Brum Outloud" (e.g., "Event Name | Brum Outloud").

Status: To Do

Meta Descriptions:

Goal: Provide a brief, compelling summary for search results.

Action: Dynamically generate meta descriptions for event and venue pages using event/venue descriptions and key details.

Status: To Do

Structured Data (Schema Markup):

Goal: Provide context to search engines, potentially leading to rich snippets.

Action: Implement Event and LocalBusiness (or Place) Schema.org markup for event and venue detail pages respectively. This is a crucial step for listings.

For Events: Include name, start/end date, location (venue), image, description, ticket URL, organizer.

For Venues: Include name, address, phone, website, business hours, category, reviews (if applicable).

Status: To Do (Flagged as Launch-Critical in Handover)

Header Tags (H1, H2, etc.):

Goal: Structure content and highlight key topics.

Action: Ensure main event/venue name is an <h1>, and sub-sections use <h2>, <h3> appropriately.

Status: To Do

Keyword Optimization (Natural Integration):

Goal: Help search engines understand content relevance.

Action: Ensure event/venue names, descriptions, and categories naturally include relevant keywords (e.g., "LGBTQ+ Birmingham," "queer events," "gay bars"). Avoid keyword stuffing.

Status: To Do

Image Alt Text:

Goal: Improve accessibility and provide context for images.

Action: Ensure all event poster images and venue photos have descriptive alt attributes.

Status: To Do

General Site SEO
Content Quality:

Goal: Provide valuable, unique content.

Action: Maintain high-quality event and venue descriptions. (The planned "Blog & Content Hub" will significantly boost this).

Status: Ongoing

Internal Linking:

Goal: Distribute link equity and help users/crawlers navigate.

Action: Ensure relevant internal links (e.g., event to venue pages, suggested events).

Status: To Do

User Experience (UX):

Goal: Search engines favor sites that users love.

Action: Continually improve navigation, readability, and overall user satisfaction.

Status: Ongoing

5. Bug Log
This log tracks identified bugs that need to be addressed, with current statuses.

Resolved Bugs
Event Form - Venue Management Issues

Description: On the event submission/editing form, when attempting to "add new venue," the necessary input fields for the new venue's details were not appearing.

Resolution: Implemented robust DOM manipulation in admin-edit-events.html to dynamically create and reliably display venue input fields.

Status: RESOLVED

Event Form - Missing Image Upload Field & Submission Failure

Description: The event submission/editing form lacked an image upload field, and saving changes (especially with image uploads or new unlisted venues) resulted in a 502 Bad Gateway error.

Resolution:

Added the promo-image file input to the dynamic form in admin-edit-events.html.

Updated netlify/functions/update-submission.js to correctly parse multipart/form-data using formidable (including handling the stream, minFileSize: 0, and correct formidable import).

Corrected the Airtable API key environment variable name in update-submission.js (to AIRTABLE_PERSONAL_ACCESS_TOKEN).

Ensured proper date/time formatting for Airtable's Date field.

Status: RESOLVED

Admin Event Management - Inability to Remove Events

Description: There was no functionality within the administrative interfaces to remove or delete an existing event.

Resolution: Added a "Delete Event" button and confirmAndDeleteEvent function in admin-edit-events.html which calls a new netlify/functions/archive-event.js backend function to set an event's status to "Archived" in Airtable.

Status: RESOLVED

Admin Event Form - Submit Button Stuck State

Description: The "Save Changes" button in the event edit modal would sometimes immediately display "Saving..." or be disabled upon opening the modal, even before interaction.

Resolution: Added explicit reset logic for the submit button's state and text content at the beginning of the populateEditForm function in admin-edit-events.html.

Status: RESOLVED

Approve Events List - Loading Failure (and Button Functionality)

Description: The list of events awaiting approval on the admin-approvals.html page failed to load, and the "Edit", "Approve", and "Reject" buttons did not function.

Resolution:

Updated netlify/functions/get-pending-items.js to correctly fetch and include the Type: 'Event' field for each item, and to only fetch events.

Updated admin-approvals.html to expect only events and simplified its rendering/editing logic accordingly, and to call get-event-details-by-id.js for fetching event data.

Created netlify/functions/get-event-details-by-id.js to correctly fetch events by ID for the "Edit" modal.

Implemented netlify/functions/update-item-status.js to handle status changes ("Approved" and "Rejected"), with support for your "Rejection Reason" Airtable field.

Status: RESOLVED

Current Bugs
1.  **Poster/Spreadsheet Parser:** Syntax error when using the poster parser.
    *   **Description:** The AI's response for both poster and spreadsheet parsing sometimes contained malformed JSON or extra text outside the JSON block, leading to syntax errors.
    *   **Resolution:** Modified `netlify/functions/process-poster.js` and `netlify/functions/process-spreadsheet.js` to use a more robust regex to extract the JSON string and added a step to aggressively clean up common JSON issues like trailing commas.
    *   **Status:** RESOLVED
2.  **Promoter Submit Form - Category Field & Venue Dropdown Issues**
    *   **Description:** The multi-select category field on `promoter-submit.html` was not appearing, and the venue dropdown was not loading. This was due to JavaScript errors in the `<script>` block of `promoter-submit.html` halting script execution.
    *   **Resolution:** The JavaScript in `promoter-submit.html` was corrected to fix syntax errors (duplicate `venueId` declaration, malformed `catch` block), ensure immediate category population, and robustly handle `FormData` for categories. This resolved both the missing category field and the venue dropdown loading issue.
    *   **Status:** RESOLVED
3.  **Venue TBC on Approval Queue:** Events in the approval queue now correctly display the linked venue name. **Status: RESOLVED**

5.  **Header Loading Glitch**
    *   **Description:** When loading any page, the main content appears before the header, causing a visual "glitch" or jump. This is due to the header being loaded asynchronously via JavaScript.
    *   **Status:** To Do
7.  **Event Listings on Venue Page:** The split between "regular recurring nights" and "one-off events" was missing on the venue details page.
    *   **Resolution:** Refactored event display logic in `netlify/functions/get-venue-details.js` to use a card-based layout with `Promo Image` and `Recurring Info` pill. Corrected the main HTML grid structure to restore the two-column layout.
    *   **Status:** RESOLVED
8.  **Event Deletion:** The delete functionality on the "Manage Events" page is not working.
9. **No Redirects File**
10. **No custom 404 pages**
11. **Day logic** for the purposes of an nighlife events website we need to consider the period between midnight and 6am as part of the day before as some events may even start at midnight on 26th June for example, yet our current logic would place that at the morning of that date rather then a continuation of that dates nighttime.
12. **No favicon on event details page**
    *   **Resolution:** Added favicon links to the `<head>` of the HTML template in `netlify/functions/get-venue-details.js` for site-wide consistency.
    *   **Status:** RESOLVED