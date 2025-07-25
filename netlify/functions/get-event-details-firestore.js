const FirestoreEventService = require('./services/firestore-event-service');
const SeriesManager = require('./services/series-manager');
const Handlebars = require('handlebars');

// Version: 2025-01-27-v1 - Firestore-based event details function

const eventService = new FirestoreEventService();
const seriesManager = new SeriesManager();

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
function generateIcsDataURI(eventData) {
    const { name, description, venue, date } = eventData;
    
    // Validate date and provide fallback
    let eventDate;
    try {
        eventDate = new Date(date);
        if (isNaN(eventDate.getTime())) {
            console.warn('Invalid date for event in ICS:', name, 'date:', date);
            eventDate = new Date(); // Fallback to current date
        }
    } catch (error) {
        console.warn('Error parsing date for event in ICS:', name, 'date:', date, 'error:', error.message);
        eventDate = new Date(); // Fallback to current date
    }
    
    const endDate = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000);
    
    let icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//BrumOutloud//EN',
        'BEGIN:VEVENT',
        'UID:' + new Date().getTime() + ' @brumoutloud.co.uk',
        'DTSTAMP:' + toICSDate(new Date()),
        'DTSTART:' + toICSDate(eventDate),
        'DTEND:' + toICSDate(endDate),
        'SUMMARY:' + name,
        'DESCRIPTION:' + (description || '').replace(/\n/g, '\\n'),
        'LOCATION:' + venue.name,
        'END:VEVENT',
        'END:VCALENDAR'
    ];
    const icsString = icsContent.join('\r\n');
    return 'data:text/calendar;charset=utf8,' + encodeURIComponent(icsString);
}

function generateCalendarLinks(eventData) {
    const { name, description, venue, date } = eventData;
    
    // Validate date and provide fallback
    let eventDate;
    try {
        eventDate = new Date(date);
        if (isNaN(eventDate.getTime())) {
            console.warn('Invalid date for event:', name, 'date:', date);
            eventDate = new Date(); // Fallback to current date
        }
    } catch (error) {
        console.warn('Error parsing date for event:', name, 'date:', date, 'error:', error.message);
        eventDate = new Date(); // Fallback to current date
    }
    
    const endDate = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours later
    
    // Format dates for Google Calendar (YYYYMMDDTHHMMSSZ format)
    const formatDateForGoogle = (date) => {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    
    const googleLink = 'https://www.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(name) + '&dates=' + formatDateForGoogle(eventDate) + '/' + formatDateForGoogle(endDate) + '&details=' + encodeURIComponent(description || '') + '&location=' + encodeURIComponent(venue.name);
    
    return {
        google: googleLink,
        ical: generateIcsDataURI(eventData)
    };
}

exports.handler = async function (event, context) {
    console.log("get-event-details-firestore function called");
    console.log("Event path:", event.path);
    console.log("Event queryStringParameters:", event.queryStringParameters);
    
    // Extract slug from query parameters (as configured in netlify.toml)
    let slug = event.queryStringParameters?.slug;
    
    // Fallback: try to extract from path if not in query params
    if (!slug) {
        slug = event.path.split("/").pop();
    }
    
    console.log("Extracted slug:", slug);
    
    if (!slug) {
        console.log("No slug provided");
        return { 
            statusCode: 400, 
            body: 'Error: Event slug not provided.' 
        };
    }

    try {
        console.log("Attempting to fetch event with slug:", slug);
        
        // Use the new Firestore service to get event data
        const eventData = await eventService.getEventBySlug(slug);
        
        if (!eventData) {
            console.log("No event found with slug:", slug);
            return { 
                statusCode: 404, 
                body: 'Event not found.' 
            };
        }

        console.log("Event found:", eventData.name);
        console.log("Event date:", eventData.date, "Type:", typeof eventData.date);
        console.log("Event data structure:", JSON.stringify({
          id: eventData.id,
          name: eventData.name,
          slug: eventData.slug,
          hasDate: !!eventData.date,
          hasSeries: !!eventData.series,
          seriesType: eventData.series?.type,
          venue: eventData.venue?.name
        }, null, 2));

        // Get other instances if this is a series event
        let otherInstances = [];
        if (eventData.series && eventData.series.type === 'recurring') {
            try {
                const seriesWithInstances = await seriesManager.getSeriesWithInstances(
                    eventData.series.id, 
                    { limit: 6, futureOnly: true }
                );
                otherInstances = seriesWithInstances.events.filter(instance => 
                    instance.id !== eventData.id
                );
            } catch (error) {
                console.error('Error getting series instances:', error);
            }
        }

        // Get similar events based on categories
        let similarEvents = [];
        if (eventData.category && eventData.category.length > 0) {
            try {
                similarEvents = await eventService.getSimilarEvents(
                    eventData.category, 
                    eventData.id, 
                    3
                );
            } catch (error) {
                console.error('Error getting similar events:', error);
            }
        }

        // Format description
        let formattedDescription = eventData.description;
        if (eventData.description && !eventData.series) {
            // TODO: Add description formatting if needed
        }

                // Load the template file
        const fs = require('fs');
        const path = require('path');
        const templatePath = path.join(__dirname, 'templates', 'event-details-template.html');
        const templateContent = fs.readFileSync(templatePath, 'utf8');

        // Compile the template
        const template = Handlebars.compile(templateContent);

        // Prepare template data
        const templateData = {
            event: eventData,
            otherInstances: otherInstances,
            similarEvents: similarEvents,
            hasOtherInstances: otherInstances.length > 0,
            calendarLinks: generateCalendarLinks(eventData),
            categoryTags: (eventData.category || []).map(tag => 
                '<span class="inline-block bg-blue-100/20 text-blue-300 text-sm px-3 py-1 rounded-full">' + tag + '</span>'
            ).join(''),
            formatDate: (dateString) => {
                try {
                    const date = new Date(dateString);
                    if (isNaN(date.getTime())) {
                        return 'Date TBC';
                    }
                    return date.toLocaleDateString('en-GB', { 
                        weekday: 'long', 
                        day: 'numeric', 
                        month: 'long', 
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                    });
                } catch (error) {
                    return 'Date TBC';
                }
            },
            formatDateOnly: (dateString) => {
                try {
                    const date = new Date(dateString);
                    if (isNaN(date.getTime())) {
                        return 'Date TBC';
                    }
                    return date.toLocaleDateString('en-GB', { 
                        weekday: 'long', 
                        day: 'numeric', 
                        month: 'long', 
                        year: 'numeric'
                    });
                } catch (error) {
                    return 'Date TBC';
                }
            },
            formatTime: (dateString) => {
                try {
                    const date = new Date(dateString);
                    if (isNaN(date.getTime())) {
                        return 'Time TBC';
                    }
                    return date.toLocaleTimeString('en-GB', { 
                        hour: 'numeric',
                        minute: '2-digit'
                    });
                } catch (error) {
                    return 'Time TBC';
                }
            },
            formatDay: (dateString) => {
                try {
                    const date = new Date(dateString);
                    if (isNaN(date.getTime())) {
                        return '--';
                    }
                    return date.getDate();
                } catch (error) {
                    return '--';
                }
            },
            formatMonth: (dateString) => {
                try {
                    const date = new Date(dateString);
                    if (isNaN(date.getTime())) {
                        return '---';
                    }
                    return date.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
                } catch (error) {
                    return '---';
                }
            },
            hasValidLink: (link) => {
                return link && link !== null && link !== '';
            }
        };

        // Render the page
        const html = template(templateData);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'text/html',
                'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
            },
            body: html
        };

    } catch (error) {
        console.error('Error in get-event-details-firestore:', error);
        
        return {
            statusCode: 500,
            body: 'Internal server error. Please try again later.'
        };
    }
};