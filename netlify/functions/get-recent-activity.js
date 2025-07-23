const Airtable = require('airtable');

const AIRTABLE_PERSONAL_ACCESS_TOKEN = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const base = new Airtable({ apiKey: AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(AIRTABLE_BASE_ID);

exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    console.log('get-recent-activity: Starting function execution');

    if (!AIRTABLE_PERSONAL_ACCESS_TOKEN || !AIRTABLE_BASE_ID) {
        console.error('get-recent-activity: Missing required environment variables');
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Missing Airtable configuration',
                details: 'Environment variables not properly configured'
            }),
        };
    }

    try {
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        
        // Get recent events (last 7 days)
        const recentEvents = await base('Events').select({
            filterByFormula: `IS_AFTER({Date}, '${oneWeekAgo.toISOString()}')`,
            sort: [{ field: 'Date', direction: 'desc' }],
            fields: ['Event Name', 'Status', 'Date', 'Submitter Email', 'Created Time']
        }).all();
        
        // Get recent venues (last 7 days)
        const recentVenues = await base('Venues').select({
            filterByFormula: `IS_AFTER({Created Time}, '${oneWeekAgo.toISOString()}')`,
            sort: [{ field: 'Created Time', direction: 'desc' }],
            fields: ['Name', 'Status', 'Created Time', 'Contact Email']
        }).all();
        
        // Combine and format activity
        const activity = [];
        
        // Add event activities
        recentEvents.forEach(event => {
            const eventDate = new Date(event.fields.Date || event.fields['Created Time']);
            const status = event.fields.Status;
            
            let type, title, description;
            
            if (status === 'Pending Review') {
                type = 'event_submitted';
                title = 'New Event Submitted';
                description = `${event.fields['Event Name']} submitted for review`;
            } else if (status === 'Approved') {
                type = 'event_approved';
                title = 'Event Approved';
                description = `${event.fields['Event Name']} was approved`;
            } else if (status === 'Rejected') {
                type = 'event_rejected';
                title = 'Event Rejected';
                description = `${event.fields['Event Name']} was rejected`;
            }
            
            if (type) {
                activity.push({
                    type,
                    title,
                    description,
                    timestamp: eventDate.toISOString(),
                    itemId: event.id
                });
            }
        });
        
        // Add venue activities
        recentVenues.forEach(venue => {
            const venueDate = new Date(venue.fields['Created Time']);
            const status = venue.fields.Status;
            
            let type, title, description;
            
            if (status === 'Pending Review') {
                type = 'venue_submitted';
                title = 'New Venue Submitted';
                description = `${venue.fields.Name} submitted for review`;
            } else if (status === 'Approved') {
                type = 'venue_approved';
                title = 'Venue Approved';
                description = `${venue.fields.Name} was approved`;
            } else if (status === 'Rejected') {
                type = 'venue_rejected';
                title = 'Venue Rejected';
                description = `${venue.fields.Name} was rejected`;
            }
            
            if (type) {
                activity.push({
                    type,
                    title,
                    description,
                    timestamp: venueDate.toISOString(),
                    itemId: venue.id
                });
            }
        });
        
        // Sort by timestamp (most recent first) and limit to 20 items
        activity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        activity.splice(20);

        return {
            statusCode: 200,
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(activity),
        };
    } catch (error) {
        console.error("Error in get-recent-activity handler:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch recent activity', details: error.toString() }),
        };
    }
};