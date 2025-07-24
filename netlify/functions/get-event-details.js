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
        <a href="${googleLink}" target="_blank" rel="noopener noreferrer" class="calendar-link google"><i class="fab fa-google mr-2"></i> Google Calendar</a>
        <a href="${icalDataUri}" download="${safeTitle}.ics" class="calendar-link ical"><i class="fas fa-calendar-plus mr-2"></i> Apple/Outlook/Other</a>
    `;
}

exports.handler = async function (event, context) {
    const baseUrl = process.env.URL || 'https://www.brumoutloud.co.uk';
    const slug = event.path.split("/").pop();
    if (!slug) {
        return { statusCode: 400, body: 'Error: Event slug not provided.' };
    }

    try {
        const dateMatch = slug.match(/\d{4}-\d{2}-\d{2}$/);
        let eventRecords = [];

        console.log("Attempting to fetch event records from Airtable.");
        
        // First, try to find any event with this slug (parent or child)
        const escapedSlug = slug.replace(/"/g, '"');
        eventRecords = await base('Events').select({
            maxRecords: 10,
            filterByFormula: `{Slug} = "${escapedSlug}"`,
            fields: ['Event Name', 'Slug', 'Series ID', 'Date', 'Venue', 'Venue Name', 'Venue Slug', 'Category', 'Description', 'Status']
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
                        fields: ['Event Name', 'Slug', 'Series ID', 'Date', 'Venue', 'Venue Name', 'Venue Slug', 'Category', 'Description', 'Status']
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
        console.log("Event records fetched. Count:", eventRecords.length);

        const eventRecord = eventRecords[0];
        if (!eventRecord) {
            console.log("Event record is null or undefined.");
            return { statusCode: 404, body: `Event '${slug}' not found.` };
        }
        const fields = eventRecord.fields;
        const eventName = fields['Event Name'];
        const seriesId = fields['Series ID'];
        const categoryTags = fields['Category'] || [];
        const tagsHtml = categoryTags.map(tag => `<span class="inline-block bg-gray-700 text-gray-300 text-xs font-semibold mr-2 px-2.5 py-1 rounded-full">${tag}</span>`).join('');

        // Check if this is a recurring event by looking for Series ID
        const isRecurringEvent = !!seriesId;
        let filterFormula = null;
        let allFutureInstances = [];
        let finalVenueSlug = '';
        let venueWebsiteHtml = '';
        let venueSocialHtml = '';
        
        

        if (isRecurringEvent) {
            const eventNameForQuery = eventName.replace(/"/g, '\"');
            filterFormula = `AND({Event Name} = "${eventNameForQuery}", {Series ID} = "${seriesId}", IS_AFTER({Date}, DATEADD(TODAY(),-1,'days')))`
        }

        if (filterFormula) {
            const futureInstanceRecords = await base('Events').select({
                filterByFormula: filterFormula,
                sort: [{ field: 'Date', direction: 'asc' }]
            }).all();
            allFutureInstances = futureInstanceRecords.map(rec => rec.fields);
        }

        let venueNameForDisplay = fields['Venue Name'] ? fields['Venue Name'][0] : 'TBC';
        let venueHtml = `<p class="text-2xl font-semibold">${venueNameForDisplay}</p>`;

        const venueId = fields['Venue'] ? fields['Venue'][0] : null;

        if (venueId) {
            try {
                const venueRecord = await base('Venues').find(venueId);
                const status = venueRecord.get('Listing Status');
                const name = venueRecord.get('Name');
                const website = venueRecord.get('Website');
                const facebook = venueRecord.get('Facebook');
                const instagram = venueRecord.get('Instagram');
                const twitter = venueRecord.get('Twitter');
                finalVenueSlug = venueRecord.get('Slug') || '';
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

            } catch (venueError) { console.error("Could not fetch linked venue, falling back to text.", venueError); }
        }

        // These fields don't exist in the current database schema
        let addressHtml = '';
        let priceHtml = '';
        let ageRestrictionHtml = '';
        let linkHtml = '';

        let suggestedEventsHtml = '';
        const primaryEventCategories = fields['Category'] || [];
        const currentEventId = eventRecord.id;

        if (primaryEventCategories.length > 0) {
            const categoryFilterString = primaryEventCategories.map(cat => `FIND("${cat.replace(/"/g, '\"')}", ARRAYJOIN({Category}, ","))`).join(', ');

            const suggestedEventsFilter = `AND({Status} = 'Approved', IS_AFTER({Date}, TODAY()), NOT(RECORD_ID() = '${currentEventId}'), OR(${categoryFilterString}))`;

            const suggestedRecords = await base('Events').select({
                filterByFormula: suggestedEventsFilter,
                sort: [{ field: 'Date', direction: 'asc' }],
                maxRecords: 6,
                fields: ['Event Name', 'Date', 'Slug', 'Venue Name']
            }).all();

            if (suggestedRecords.length > 0) {
                const suggestedCardsHtml = suggestedRecords.map(suggEvent => {
                    const suggEventName = suggEvent.get('Event Name');
                    const suggEventDate = new Date(suggEvent.get('Date'));
                    const suggImageUrl = suggEvent.get('Promo Image') ? suggEvent.get('Promo Image')[0].url : 'https://placehold.co/400x600/1e1e1e/EAEAEA?text=Event';
                    const suggEventSlug = suggEvent.get('Slug');

                    return `<a href="/event/${suggEventSlug}" class="suggested-card aspect-[2/3] w-10/12 md:w-5/12 lg:w-[32%] flex-shrink-0 relative overflow-hidden flex flex-col justify-end snap-start"><div class="absolute inset-0 bg-cover bg-center" style="background-image: url('${suggImageUrl}')"></div><div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent"></div><div class="absolute top-2 right-2 bg-black bg-opacity-70 text-white text-center p-2 rounded-lg z-20"><p class="font-bold text-xl leading-none">${suggEventDate.getDate()}</p><p class="text-sm uppercase">${suggEventDate.toLocaleDateString('en-GB', { month: 'short' })}</p></div><div class="relative z-10 p-4"><h4 class="font-extrabold text-white text-2xl">${suggEventName}</h4></div></a>`;
                }).join('');

                suggestedEventsHtml = `<div class="mt-16 suggested-events-section"><h2 class="font-anton text-4xl mb-8">Don't Miss These...</h2><div class="suggested-carousel flex overflow-x-auto gap-6 snap-x snap-mandatory pr-6">${suggestedCardsHtml}</div></div>`;
            }
        }

        const eventDate = new Date(fields['Date']);
        const description = fields['Description'] || 'No description provided.';
        const pageUrl = `https://brumoutloud.co.uk${event.path}`;
        const imageUrl = fields['Promo Image'] ? fields['Promo Image'][0].url : 'https://placehold.co/1200x675/1a1a1a/f5efe6?text=Brum+Out+Loud';

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
            const d = new Date(instance.Date);
            const day = d.toLocaleDateString('en-GB', { day: 'numeric' });
            const month = d.toLocaleDateString('en-GB', { month: 'short' });
            return `<a href="/event/${instance.Slug}" class="card-bg p-4 flex items-center space-x-4 hover:bg-gray-800 transition-colors duration-200 block"><div class="text-center w-20 flex-shrink-0"><p class="text-2xl font-bold text-white">${day}</p><p class="text-lg text-gray-400">${month}</p></div><div class="flex-grow"><h4 class="font-bold text-white text-xl">${instance['Event Name']}</h4><p class="text-sm text-gray-400">${d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Europe/London' })}</p></div><div class="text-accent-color"><i class="fas fa-arrow-right"></i></div></a>`;
        }).join('');

        const templatePath = path.resolve(__dirname, './templates/event-details-template.html');
        console.log("Attempting to read template file:", templatePath);
        let htmlTemplate = await fs.readFile(templatePath, 'utf8');
        console.log("Template file read successfully. Length:", htmlTemplate.length);

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