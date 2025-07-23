const Airtable = require('airtable');
const base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);
const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');
const Handlebars = require('handlebars');

/**
 * Converts a date object to an ISO string suitable for ICS files (YYYYMMDDTHHMMSSZ).
 * @param {Date} date The date to convert.
 * @returns {string} The formatted date string.
 */
function toICSDate(date) {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * Generates a Data URI for an .ics file. This works server-side.
 * @param {object} event The event data object.
 * @returns {string} A Data URI containing the ICS file content.
 */
function generateIcsDataURI(event) {
    let icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//BrumOutloud//EN',
        'BEGIN:VEVENT',
        'UID:' + new Date().getTime() + ' @brumoutloud.co.uk',
        'DTSTAMP:' + toICSDate(new Date()),
        'DTSTART:' + toICSDate(new Date(event.startTime)),
        'DTEND:' + toICSDate(new Date(event.endTime)),
        'SUMMARY:' + event.title,
        'DESCRIPTION:' + event.description.replace(/\n/g, '\\n'),
        'LOCATION:' + event.location,
        'END:VEVENT',
        'END:VCALENDAR'
    ];
    const icsString = icsContent.join('\r\n');
    return 'data:text/calendar;charset=utf8,' + encodeURIComponent(icsString);
}


/**
 * Generates the HTML for all "Add to Calendar" links.
 * @param {object} event The event data object.
 * @returns {string} HTML string containing multiple <a> tags.
 */
function generateAddToCalendarLinks(event) {
    const googleLink = 'https://www.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(event.title) + '&dates=' + toICSDate(new Date(event.startTime)) + '/' + toICSDate(new Date(event.endTime)) + '&details=' + encodeURIComponent(event.description) + '&location=' + encodeURIComponent(event.location);
    const icalDataUri = generateIcsDataURI(event);
    const safeTitle = event.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    // All href attributes are correctly quoted to prevent parsing errors.
    return `
        <a href="${googleLink}" target="_blank" rel="noopener noreferrer" class="sidebar-button secondary">
            <i class="fab fa-google"></i>
            Google Calendar
        </a>
        <a href="${icalDataUri}" download="${safeTitle}.ics" class="sidebar-button secondary">
            <i class="fas fa-calendar-plus"></i>
            Apple/Outlook/Other
        </a>
    `;
}

exports.handler = async function (event, context) {
    const baseUrl = process.env.URL || 'https://www.brumoutloud.co.uk';
    
    // Improved slug extraction with better error handling
    let slug = '';
    try {
        // Check for slug in query parameters first (Netlify function routing)
        if (event.queryStringParameters && event.queryStringParameters.slug) {
            slug = event.queryStringParameters.slug;
            console.log("Slug from query parameters:", slug);
        } else {
            // Fallback to path extraction
            const pathParts = event.path.split("/");
            slug = pathParts[pathParts.length - 1];
            console.log("Slug from path:", slug);
        }
        
        // Handle edge cases where slug might be empty or undefined
        if (!slug || slug === 'event' || slug === '') {
            console.log("Invalid slug extracted. Path:", event.path, "Query:", event.queryStringParameters);
            return { statusCode: 400, body: 'Error: Event slug not provided.' };
        }
        
        console.log("Processing event details request for slug:", slug);
    } catch (error) {
        console.error("Error extracting slug from path:", error);
        return { statusCode: 400, body: 'Error: Invalid event URL.' };
    }

    try {
        const dateMatch = slug.match(/\d{4}-\d{2}-\d{2}$/);
        let eventRecords = [];

        console.log("Attempting to fetch event records from Airtable.");
        if (dateMatch) {
            const dateFromSlug = dateMatch[0];
            console.log("Date match found, searching for specific date:", dateFromSlug);
            eventRecords = await base('Events').select({ maxRecords: 1, filterByFormula: `AND({Slug} = "${slug}", DATETIME_FORMAT(Date, 'YYYY-MM-DD') = '${dateFromSlug}')` }).firstPage();
        } else {
            console.log("No date match, searching for event with slug:", slug);
            const escapedSlug = slug.replace(/"/g, '"');
            
            // First, try to find any event with this slug (parent or child)
            eventRecords = await base('Events').select({ 
                maxRecords: 10, 
                filterByFormula: `{Slug} = "${escapedSlug}"`,
                fields: ['Event Name', 'Slug', 'Recurring Info', 'Series ID', 'Date']
            }).firstPage();
            
            if (eventRecords && eventRecords.length > 0) {
                // If we found events, check if any is a parent (has Recurring Info)
                const parentEvent = eventRecords.find(record => record.fields['Recurring Info']);
                
                if (parentEvent) {
                    // Use the parent event
                    console.log("Found parent recurring event:", parentEvent.fields['Event Name']);
                    eventRecords = [parentEvent];
                } else {
                    // Check if any of the found events is a child with a Series ID
                    const childEvent = eventRecords.find(record => record.fields['Series ID']);
                    
                    if (childEvent) {
                        const seriesId = childEvent.fields['Series ID'];
                        console.log("Found child event with Series ID:", seriesId);
                        
                        // Find the parent event for this series
                        const parentRecords = await base('Events').select({ 
                            maxRecords: 1, 
                            filterByFormula: `AND({Series ID} = "${seriesId}", {Recurring Info})`,
                            fields: ['Event Name', 'Slug', 'Recurring Info', 'Series ID', 'Date']
                        }).firstPage();
                        
                        if (parentRecords && parentRecords.length > 0) {
                            console.log("Found parent event:", parentRecords[0].fields['Event Name']);
                            eventRecords = [parentRecords[0]];
                        } else {
                            console.log("No parent event found for Series ID:", seriesId);
                            // Use the first child event as fallback
                            eventRecords = [childEvent];
                        }
                    } else {
                        // Use the first event found (standalone event)
                        console.log("Using standalone event:", eventRecords[0].fields['Event Name']);
                        eventRecords = [eventRecords[0]];
                    }
                }
            } else {
                console.log("No event found with slug:", slug);
                return { statusCode: 404, body: 'Event not found.' };
            }
        }
        console.log("Event records fetched. Count:", eventRecords.length);

        const eventRecord = eventRecords[0];
        if (!eventRecord) {
            console.log("Event record is null or undefined.");
            return { statusCode: 404, body: `Event '${slug}' not found.` };
        }
        
        console.log("Event record found:", {
            id: eventRecord.id,
            name: eventRecord.fields['Event Name'],
            slug: eventRecord.fields['Slug'],
            recurringInfo: eventRecord.fields['Recurring Info'],
            seriesId: eventRecord.fields['Series ID']
        });
        
        const fields = eventRecord.fields;
        const eventName = fields['Event Name'];
        const recurringInfo = fields['Recurring Info'];
        const categoryTags = fields['Category'] || [];
        const tagsHtml = categoryTags.map(tag => `<span class="inline-block bg-gray-700 text-gray-300 text-xs font-semibold mr-2 px-2.5 py-1 rounded-full">${tag}</span>`).join('');

        let parentEventName = fields['Parent Event Name'];
        let filterFormula = null;
        let allFutureInstances = [];
        let finalVenueSlug = '';
        let venueWebsiteHtml = '';
        let venueSocialHtml = '';
        
        

        if (recurringInfo) {
            // For recurring events, find all instances with the same Series ID
            const seriesId = fields['Series ID'];
            if (seriesId) {
                filterFormula = `AND({Series ID} = "${seriesId}", IS_AFTER({Date}, DATEADD(TODAY(),-1,'days')))`;
            } else {
                // Fallback to old method if no Series ID
                const eventNameForQuery = eventName.replace(/"/g, '\"');
                filterFormula = `AND({Event Name} = "${eventNameForQuery}", {Recurring Info}, IS_AFTER({Date}, DATEADD(TODAY(),-1,'days')))`;
            }
        } else if (parentEventName) {
            // Legacy support for Parent Event Name
            const parentNameForQuery = parentEventName.replace(/"/g, '\"');
            filterFormula = `AND({Parent Event Name} = "${parentNameForQuery}", IS_AFTER({Date}, DATEADD(TODAY(),-1,'days')))`;
        }

        if (filterFormula) {
            const futureInstanceRecords = await base('Events').select({
                filterByFormula: filterFormula,
                sort: [{ field: 'Date', direction: 'asc' }]
            }).all();
            allFutureInstances = futureInstanceRecords.map(rec => rec.fields);
        }

        let venueNameForDisplay = fields['Venue Name'] ? fields['Venue Name'][0] : (fields['VenueText'] || 'TBC');
        let venueHtml = `<p class="text-2xl font-semibold">${venueNameForDisplay}</p>`;

        const venueId = fields['Venue'] ? fields['Venue'][0] : null;

        if (venueId) {
            try {
                console.log("Attempting to fetch venue record for ID:", venueId);
                const venueRecord = await base('Venues').find(venueId);
                
                if (venueRecord && venueRecord.fields) {
                    const status = venueRecord.fields['Listing Status'];
                    const name = venueRecord.fields['Name'];
                    const website = venueRecord.fields['Website'];
                    const facebook = venueRecord.fields['Facebook'];
                    const instagram = venueRecord.fields['Instagram'];
                    const twitter = venueRecord.fields['Twitter'];
                    finalVenueSlug = venueRecord.fields['Slug'] || '';
                    venueNameForDisplay = name || venueNameForDisplay;
                    
                    if (status === 'Listed' && finalVenueSlug) {
                        venueHtml = `<a href="/venue/${finalVenueSlug}" class="text-2xl font-semibold hover:text-white underline">${venueNameForDisplay}</a>`;
                    } else {
                        venueHtml = `<p class="text-2xl font-semibold">${venueNameForDisplay}</p>`;
                    }

                    if (website) {
                        venueWebsiteHtml = `<a href="${website}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline"><i class="fas fa-globe mr-2"></i> Website</a>`;
                    }
                    if (facebook) {
                        venueSocialHtml += `<a href="${facebook}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline"><i class="fab fa-facebook-square mr-2"></i> Facebook</a>`;
                    }
                    if (instagram) {
                        venueSocialHtml += `<a href="${instagram}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline"><i class="fab fa-instagram mr-2"></i> Instagram</a>`;
                    }
                    if (twitter) {
                        venueSocialHtml += `<a href="${twitter}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline"><i class="fab fa-twitter-square mr-2"></i> Twitter</a>`;
                    }
                } else {
                    console.log("Venue record found but has no fields, using fallback");
                }

            } catch (venueError) { 
                console.error("Could not fetch linked venue, falling back to text. Venue ID:", venueId, "Error:", venueError.message);
                // Keep the fallback venue name and HTML
            }
        }

        let addressHtml = fields['Address'] ? `<li><i class="fas fa-map-pin text-accent-color mr-3"></i> <strong>Address:</strong> ${fields['Address']}</li>` : '';
        let priceHtml = fields['Price'] ? `<li><i class="fas fa-tag text-accent-color mr-3"></i> <strong>Price:</strong> ${fields['Price']}</li>` : '';
        let ageRestrictionHtml = fields['Age Restriction'] ? `<li><i class="fas fa-user-friends text-accent-color mr-3"></i> <strong>Age:</strong> ${fields['Age Restriction']}</li>` : '';
        let linkHtml = fields['Link'] ? `<li><i class="fas fa-link text-accent-color mr-3"></i> <strong>Link:</strong> <a href="${fields['Link']}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">More Info</a></li>` : '';

        let suggestedEventsHtml = '';
        const primaryEventCategories = fields['Category'] || [];
        const currentEventId = eventRecord.id;

        if (primaryEventCategories.length > 0) {
            try {
                const categoryFilterString = primaryEventCategories.map(cat => `FIND("${cat.replace(/"/g, '\"')}", ARRAYJOIN({Category}, ","))`).join(', ');

                const suggestedEventsFilter = `AND({Status} = 'Approved', IS_AFTER({Date}, TODAY()), NOT(RECORD_ID() = '${currentEventId}'), OR(${categoryFilterString}))`;

                const suggestedRecords = await base('Events').select({
                    filterByFormula: suggestedEventsFilter,
                    sort: [{ field: 'Date', direction: 'asc' }],
                    maxRecords: 6,
                    fields: ['Event Name', 'Date', 'Promo Image', 'Slug', 'Venue Name', 'VenueText']
                }).all();

                if (suggestedRecords.length > 0) {
                    const suggestedCardsHtml = suggestedRecords.map(suggEvent => {
                        try {
                            const suggEventName = suggEvent.fields['Event Name'] || 'Event';
                            const suggEventDate = new Date(suggEvent.fields['Date']);
                            const suggImageUrl = suggEvent.fields['Promo Image'] && suggEvent.fields['Promo Image'].length > 0 
                                ? suggEvent.fields['Promo Image'][0].url 
                                : 'https://placehold.co/400x600/1e1e1e/EAEAEA?text=Event';
                            const suggEventSlug = suggEvent.fields['Slug'] || '';

                            if (!suggEventSlug) {
                                console.log("Skipping suggested event without slug:", suggEventName);
                                return '';
                            }

                            return `<a href="/event/${suggEventSlug}" class="suggested-card aspect-[2/3] w-10/12 md:w-5/12 lg:w-[32%] flex-shrink-0 relative overflow-hidden flex flex-col justify-end snap-start"><div class="absolute inset-0 bg-cover bg-center" style="background-image: url('${suggImageUrl}')"></div><div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent"></div><div class="absolute top-2 right-2 bg-black bg-opacity-70 text-white text-center p-2 rounded-lg z-20"><p class="font-bold text-xl leading-none">${suggEventDate.getDate()}</p><p class="text-sm uppercase">${suggEventDate.toLocaleDateString('en-GB', { month: 'short' })}</p></div><div class="relative z-10 p-4"><h4 class="font-extrabold text-white text-2xl">${suggEventName}</h4></div></a>`;
                        } catch (cardError) {
                            console.error("Error processing suggested event card:", cardError);
                            return '';
                        }
                    }).filter(html => html !== '').join('');

                    if (suggestedCardsHtml) {
                        suggestedEventsHtml = `<div class="mt-16 suggested-events-section"><h2 class="font-anton text-4xl mb-8">Don't Miss These...</h2><div class="suggested-carousel flex overflow-x-auto gap-6 snap-x snap-mandatory pr-6">${suggestedCardsHtml}</div></div>`;
                    }
                }
            } catch (suggestedError) {
                console.error("Error fetching suggested events:", suggestedError);
                // Continue without suggested events
            }
        }

        const eventDate = new Date(fields['Date']);
        const description = fields['Description'] || 'No description provided.';
        const pageUrl = `https://brumoutloud.co.uk${event.path}`;
        
        // Enhanced image URL handling with better error handling
        let imageUrl = 'https://placehold.co/1200x675/1a1a1a/f5efe6?text=Brum+Out+Loud';
        try {
            if (fields['Promo Image'] && fields['Promo Image'].length > 0) {
                imageUrl = fields['Promo Image'][0].url;
                console.log("Image URL found:", imageUrl);
            } else {
                console.log("No promo image found, using placeholder");
            }
        } catch (imageError) {
            console.error("Error processing image URL:", imageError);
            // Keep the placeholder URL
        }

        const calendarData = {
            title: eventName,
            description: `${description.replace(/\n/g, '\n')}\n\nFind out more: ${pageUrl}`,
            location: venueNameForDisplay,
            startTime: eventDate.toISOString(),
            endTime: new Date(eventDate.getTime() + 2 * 60 * 60 * 1000).toISOString(),
            isRecurring: (parentEventName || recurringInfo) && allFutureInstances.length > 1,
            recurringDates: allFutureInstances.map(i => i.Date)
        };

        const otherInstancesToDisplay = allFutureInstances.filter(inst => inst.Date !== fields['Date']);

        const otherInstancesHTML = otherInstancesToDisplay.slice(0, 5).map(instance => {
            try {
                const d = new Date(instance.Date);
                const day = d.toLocaleDateString('en-GB', { day: 'numeric' });
                const month = d.toLocaleDateString('en-GB', { month: 'short' });
                const eventName = instance['Event Name'] || 'Event';
                const slug = instance['Slug'] || '';
                
                if (!slug) {
                    console.log("Skipping other instance without slug:", eventName);
                    return '';
                }
                
                return `<a href="/event/${slug}" class="card-bg p-4 flex items-center space-x-4 hover:bg-gray-800 transition-colors duration-200 block"><div class="text-center w-20 flex-shrink-0"><p class="text-2xl font-bold text-white">${day}</p><p class="text-lg text-gray-400">${month}</p></div><div class="flex-grow"><h4 class="font-bold text-white text-xl">${eventName}</h4><p class="text-sm text-gray-400">${d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Europe/London' })}</p></div><div class="text-accent-color"><i class="fas fa-arrow-right"></i></div></a>`;
            } catch (instanceError) {
                console.error("Error processing other instance:", instanceError);
                return '';
            }
        }).filter(html => html !== '').join('');

        const templatePath = path.join(__dirname, 'templates', 'event-details-template.html');
        console.log("Attempting to read template file:", templatePath);
        let htmlTemplate;
        
        try {
            htmlTemplate = await fs.readFile(templatePath, 'utf8');
            console.log("Template file read successfully. Length:", htmlTemplate.length);
        } catch (templateReadError) {
            console.error("Failed to read template file:", templateReadError);
            // Fallback to inline template if file read fails
            htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{eventName}} | Brum Outloud</title>
    <meta name="description" content="{{descriptionMeta}}">
    <link rel="canonical" href="{{pageUrlCanonical}}">
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Anton&family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <link rel="stylesheet" href="/css/main.css">
    <script src="/js/main.js" defer></script>
    <style>
        .hero-image-container { position: relative; width: 100%; aspect-ratio: 16 / 9; background-color: #1e1e1e; overflow: hidden; border-radius: 1.25rem; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
        .hero-image-bg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; filter: blur(24px) brightness(0.5); transform: scale(1.1); transition: opacity 0.4s ease; }
        .hero-image-container:hover .hero-image-bg { opacity: 1; }
        .hero-image-fg { position: relative; width: 100%; height: 100%; object-fit: cover; z-index: 10; transition: all 0.4s ease; }
        .hero-image-container:hover .hero-image-fg { object-fit: contain; transform: scale(0.9); }
        .suggested-card { border-radius: 1.25rem; box-shadow: 0 10px 30px rgba(0,0,0,0.3); background-color: #1e1e1e; transition: transform 0.3s ease, box-shadow 0.3s ease; }
        .suggested-card:hover { transform: translateY(-5px); box-shadow: 0 15px 40px rgba(0,0,0,0.5); }
        .suggested-carousel { scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; overflow-x: auto; padding-bottom: 1rem; scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.3) rgba(0, 0, 0, 0.1); }
        .suggested-carousel::-webkit-scrollbar { height: 4px; }
        .suggested-carousel::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.1); border-radius: 2px; }
        .suggested-carousel::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.3); border-radius: 2px; }
        .card-bg { background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); }
        .accent-color { color: #b564fb; }
        .accent-color-secondary { color: #8b5cf6; }
        .heading-gradient { background: linear-gradient(135deg, #b564fb 0%, #8b5cf6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .button-primary { background: linear-gradient(135deg, #b564fb 0%, #8b5cf6 100%); color: white; font-weight: bold; padding: 0.75rem 1.5rem; border-radius: 0.5rem; display: inline-block; text-decoration: none; transition: all 0.3s ease; }
        .button-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(181, 100, 247, 0.4); }
        .sidebar-button { width: 100%; background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); color: white; font-weight: 600; padding: 1rem 1.5rem; border-radius: 0.75rem; text-decoration: none; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; gap: 0.5rem; text-align: center; font-size: 0.95rem; letter-spacing: 0.025em; position: relative; overflow: hidden; }
        .sidebar-button::before { content: ''; position: absolute; top: 0; left: -100%; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent); transition: left 0.5s ease; }
        .sidebar-button:hover::before { left: 100%; }
        .sidebar-button:hover { background: linear-gradient(135deg, rgba(181, 100, 247, 0.2) 0%, rgba(139, 92, 246, 0.1) 100%); border-color: rgba(181, 100, 247, 0.3); transform: translateY(-2px); box-shadow: 0 8px 25px rgba(181, 100, 247, 0.2); }
        .sidebar-button:focus-visible { outline: 3px solid #B564F7; outline-offset: 2px; box-shadow: 0 0 0 2px rgba(181, 100, 247, 0.2); }
        .sidebar-button.primary { background: linear-gradient(135deg, #B564F7 0%, #8B5CF6 100%); border-color: #B564F7; color: white; font-weight: 700; }
        .sidebar-button.primary:hover { background: linear-gradient(135deg, #9F4FD8 0%, #7C3AED 100%); transform: translateY(-3px); box-shadow: 0 12px 35px rgba(181, 100, 247, 0.4); }
        .sidebar-button.secondary { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); color: #FADCD9; }
        .sidebar-button.secondary:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); color: white; }
        .sidebar-button i { font-size: 1.1em; transition: transform 0.3s ease; }
        .sidebar-button:hover i { transform: scale(1.1); }
        .calendar-link { background: rgba(255,255,255,0.08); color: white; padding: 0.75rem 1rem; border-radius: 0.5rem; text-decoration: none; transition: all 0.3s ease; border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-weight: 500; font-size: 0.9rem; }
        .calendar-link:hover { background: rgba(255,255,255,0.15); border-color: rgba(255,255,255,0.2); transform: translateY(-1px); box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
        .sidebar-section { background: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); border-radius: 1rem; padding: 1.5rem; margin-bottom: 1.5rem; }
        .sidebar-section h3 { font-weight: 700; font-size: 1.1rem; margin-bottom: 1rem; color: #FADCD9; letter-spacing: 0.05em; }
    </style>
</head>
<body class="antialiased bg-gray-900 text-white">
    <header class="p-8">
        <nav class="container mx-auto flex justify-between items-center">
            <a href="/" class="nav-logo">
                <span>Brum Outloud</span>
                <img src="/progressflag.svg.png" alt="LGBTQ+ Flag" class="flag-icon">
            </a>
            <div class="hidden lg:flex items-center space-x-8">
                <a href="/events.html" class="text-gray-300 hover:text-white">WHAT'S ON</a>
                <a href="/all-venues.html" class="text-gray-300 hover:text-white">VENUES</a>
                <a href="/community.html" class="text-gray-300 hover:text-white">COMMUNITY</a>
                <a href="/contact.html" class="text-gray-300 hover:text-white">CONTACT</a>
                <a href="/promoter-tool.html" class="inline-block bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors duration-200">GET LISTED</a>
            </div>
        </nav>
    </header>
    
    <main class="container mx-auto px-8 py-16">
        <div class="grid lg:grid-cols-3 gap-16">
            <div class="lg:col-span-2">
                <div class="hero-image-container mb-8">
                    <img src="{{imageUrl}}" alt="" class="hero-image-bg" aria-hidden="true">
                    <img src="{{imageUrl}}" alt="{{eventName}}" class="hero-image-fg">
                </div>
                <p class="font-semibold accent-color mb-2">EVENT DETAILS</p>
                <h1 class="font-anton text-6xl lg:text-8xl heading-gradient leading-none mb-8">{{eventName}}</h1>
                <div class="prose prose-invert prose-lg max-w-none text-gray-300">{{{description}}}</div>
            </div>
            <div class="lg:col-span-1">
                <div class="space-y-6 sticky top-8">
                    <div class="sidebar-section">
                        <h3><i class="fas fa-calendar-alt mr-2"></i>Date & Time</h3>
                        <p class="text-2xl font-semibold text-white">{{eventDateFormatted}}</p>
                        <p class="text-xl text-gray-400">{{eventTimeFormatted}}</p>
                    </div>
                    
                    <div class="sidebar-section">
                        <h3><i class="fas fa-map-marker-alt mr-2"></i>Location</h3>
                        {{{venueHtml}}}
                    </div>
                    
                    <div class="sidebar-section">
                        <h3><i class="fas fa-tags mr-2"></i>Tags</h3>
                        <div class="flex flex-wrap gap-2">{{{tagsHtml}}}</div>
                    </div>
                    
                    {{#if ticketLink}}
                    <a href="{{ticketLink}}" target="_blank" rel="noopener noreferrer" class="sidebar-button primary">
                        <i class="fas fa-ticket-alt"></i>
                        Get Tickets / Info
                    </a>
                    {{/if}}
                    
                    <div class="sidebar-section" id="add-to-calendar-section">
                        <h3><i class="fas fa-calendar-plus mr-2"></i>Add to Calendar</h3>
                        <div class="space-y-3">
                            {{{calendarLinksHtml}}}
                        </div>
                    </div>
                </div>
            </div>
        </div>
        {{#if otherInstancesHTML}}
        <div class="mt-16">
            <h2 class="font-anton text-4xl mb-8"><span class="accent-color">Other Events</span> in this Series</h2>
            <div class="space-y-4">
                {{{otherInstancesHTML}}}
            </div>
        </div>
        {{/if}}
        {{{suggestedEventsHtml}}}
    </main>
    
    <footer class="border-t-2 border-gray-800 p-8">
        <div class="container mx-auto">
            <h3 class="font-anton text-5xl leading-tight text-white">BE SEEN,<br>BE HEARD.</h3>
        </div>
    </footer>
</body>
</html>`;
            console.log("Using fallback template. Length:", htmlTemplate.length);
        }

        console.log("Preparing data for Handlebars template.");
        const data = {
            eventName: eventName,
            descriptionMeta: description.substring(0, 150).replace(/\n/g, ' ') + '...',
            pageUrlCanonical: `${baseUrl}/event/${slug}`,
            schemaMarkup: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Event",
                "name": eventName,
                "startDate": eventDate.toISOString(),
                "endDate": new Date(eventDate.getTime() + 2 * 60 * 60 * 1000).toISOString(),
                "eventStatus": "https://schema.org/EventScheduled",
                "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
                "location": {
                    "@type": "Place",
                    "name": venueNameForDisplay,
                    "address": {
                        "@type": "PostalAddress",
                        "addressLocality": "Birmingham",
                        "addressRegion": "England",
                        "addressCountry": "UK"
                    }
                },
                "image": [imageUrl],
                "description": description.replace(/\n/g, ' ').replace(/"/g, '"'),
                "url": `${baseUrl}/event/${slug}`,
                "offers": {
                    "@type": "Offer",
                    "url": fields['Link'] || `${baseUrl}/event/${slug}`,
                    "price": "0",
                    "priceCurrency": "GBP",
                    "availability": "https://schema.org/InStock"
                }
            }),
            imageUrl: imageUrl,
            eventDateFormatted: eventDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
            eventTimeFormatted: eventDate.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Europe/London' }),
            venueHtml: venueHtml,
            tagsHtml: tagsHtml,
            description: description.replace(/\n/g, '<br>'),
            ticketLink: fields['Link'],
            calendarLinksHtml: generateAddToCalendarLinks(calendarData),
            otherInstancesHTML: otherInstancesHTML,
            suggestedEventsHtml: suggestedEventsHtml,
            venueNameForDisplay: venueNameForDisplay,
            venueSlug: finalVenueSlug,
            addressHtml: addressHtml,
            priceHtml: priceHtml,
            ageRestrictionHtml: ageRestrictionHtml,
            linkHtml: linkHtml,
            venueWebsiteHtml: venueWebsiteHtml,
            venueSocialHtml: venueSocialHtml,
            hasEventDetails: !!(addressHtml || priceHtml || ageRestrictionHtml || linkHtml)
        };

        try {
            const template = Handlebars.compile(htmlTemplate);
            htmlTemplate = template(data);
        } catch (templateError) {
            console.error("Error compiling or rendering Handlebars template:", templateError);
            return { statusCode: 500, body: 'Server error rendering event details.' };
        }

        console.log("Final htmlTemplate length:", htmlTemplate.length);
        const response = {
            statusCode: 200,
            headers: {
                'Content-Type': 'text/html',
                'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=60'
            },
            body: htmlTemplate
        };
        console.log("Returning response:", response);
        return response;

    } catch (error) {
        console.error("Caught error in handler:", error);
        return { statusCode: 500, body: 'Server error fetching event details. Please try again later.' };
    }
};