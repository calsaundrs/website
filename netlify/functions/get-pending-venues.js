const Airtable = require('airtable');

const AIRTABLE_PERSONAL_ACCESS_TOKEN = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    console.log('get-pending-venues: Starting function execution');
    console.log('get-pending-venues: AIRTABLE_BASE_ID:', AIRTABLE_BASE_ID ? 'Set' : 'Not set');
    console.log('get-pending-venues: AIRTABLE_PERSONAL_ACCESS_TOKEN:', AIRTABLE_PERSONAL_ACCESS_TOKEN ? 'Set' : 'Not set');

    if (!AIRTABLE_PERSONAL_ACCESS_TOKEN || !AIRTABLE_BASE_ID) {
        console.error('get-pending-venues: Missing required environment variables');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Missing Airtable configuration' }),
        };
    }

    const base = new Airtable({ apiKey: AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(AIRTABLE_BASE_ID);

    try {
        console.log('get-pending-venues: Fetching pending venues from Airtable...');
        
        // Try different possible status values
        const possibleStatuses = ['Pending Review', 'Pending', 'Review', 'Submitted'];
        let venueRecords = [];
        
        for (const status of possibleStatuses) {
            console.log(`get-pending-venues: Trying status: "${status}"`);
            try {
                const records = await base('Venues').select({
                    filterByFormula: `{Status} = '${status}'`,
                    fields: ['Name', 'Description', 'Address', 'Contact Email', 'Website', 'Status', 'Created Time']
                }).all();
                
                if (records.length > 0) {
                    console.log(`get-pending-venues: Found ${records.length} venues with status "${status}"`);
                    venueRecords = records;
                    break;
                }
            } catch (error) {
                console.log(`get-pending-venues: Status "${status}" failed:`, error.message);
            }
        }
        
        // If no venues found with specific statuses, try getting all venues and filter by status
        if (venueRecords.length === 0) {
            console.log('get-pending-venues: No venues found with specific statuses, trying to get all venues...');
            try {
                const allVenues = await base('Venues').select({
                    fields: ['Name', 'Description', 'Address', 'Contact Email', 'Website', 'Status', 'Created Time']
                }).all();
                
                // Filter for pending-like statuses
                venueRecords = allVenues.filter(record => {
                    const status = record.fields.Status || '';
                    return status.toLowerCase().includes('pending') || 
                           status.toLowerCase().includes('review') || 
                           status.toLowerCase().includes('submitted');
                });
                
                console.log(`get-pending-venues: Found ${venueRecords.length} venues after filtering all venues`);
            } catch (error) {
                console.error('get-pending-venues: Error getting all venues:', error);
            }
        }

        console.log(`get-pending-venues: Final count: ${venueRecords.length} pending venues`);

        // Process venues
        const formattedVenues = venueRecords.map(record => {
            const fields = record.fields;
            console.log(`get-pending-venues: Processing venue: ${fields.Name || 'Unnamed'} (Status: ${fields.Status || 'No Status'})`);
            
            return {
                id: record.id,
                fields: {
                    ...fields,
                    Type: 'Venue'
                }
            };
        });

        console.log(`get-pending-venues: Successfully formatted ${formattedVenues.length} venues`);

        return {
            statusCode: 200,
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formattedVenues),
        };
    } catch (error) {
        console.error("get-pending-venues: Critical error:", error);
        console.error("get-pending-venues: Error stack:", error.stack);
        
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Failed to fetch pending venues', 
                details: error.toString(),
                message: error.message 
            }),
        };
    }
};
