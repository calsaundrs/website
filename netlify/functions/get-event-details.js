const EventService = require('./services/event-service');
const SeriesManager = require('./services/series-manager');
const fs = require('fs').promises;
const path = require('path');
const Handlebars = require('handlebars');

const eventService = new EventService();
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
    const eventDate = new Date(date);
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
    const eventDate = new Date(date);
    const endDate = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours later
    
    const googleLink = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(name)}&dates=${eventDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z/${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z&details=${encodeURIComponent(description || '')}&location=${encodeURIComponent(venue.name)}`;
    
    return {
        google: googleLink,
        ical: generateIcsDataURI(eventData)
    };
}

exports.handler = async function (event, context) {
    const slug = event.path.split("/").pop();
    
    if (!slug) {
        return { 
            statusCode: 400, 
            body: 'Error: Event slug not provided.' 
        };
    }

    try {
        console.log("Attempting to fetch event with slug:", slug);
        
        // Use the new service to get event data
        const eventData = await eventService.getEventBySlug(slug);
        
        if (!eventData) {
            console.log("No event found with slug:", slug);
            return { 
                statusCode: 404, 
                body: 'Event not found.' 
            };
        }

        console.log("Event found:", eventData.name);

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

        // Load and compile template
        const templatePath = path.join(__dirname, 'templates', 'event-details-template.html');
        const templateContent = await fs.readFile(templatePath, 'utf8');
        const template = Handlebars.compile(templateContent);

        // Prepare template data
        const templateData = {
            event: eventData,
            otherInstances: otherInstances,
            hasOtherInstances: otherInstances.length > 0,
            calendarLinks: generateCalendarLinks(eventData),
            categoryTags: eventData.category.map(tag => 
                `<span class="inline-block bg-gray-700 text-gray-300 text-xs font-semibold mr-2 px-2.5 py-1 rounded-full">${tag}</span>`
            ).join('')
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
        console.error('Error in get-event-details:', error);
        
        return {
            statusCode: 500,
            body: 'Internal server error. Please try again later.'
        };
    }
};



