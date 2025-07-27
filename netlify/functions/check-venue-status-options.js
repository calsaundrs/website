const Airtable = require('airtable');

exports.handler = async function (event, context) {
    console.log('Checking venue status options...');
    
    try {
        // Check environment variables
        const required = [
            'AIRTABLE_PERSONAL_ACCESS_TOKEN',
            'AIRTABLE_BASE_ID'
        ];
        
        const missing = required.filter(varName => !process.env[varName]);
        if (missing.length > 0) {
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Environment configuration error',
                    message: `Missing environment variables: ${missing.join(', ')}`,
                    missing: missing
                })
            };
        }
        
        // Initialize Airtable
        const base = new Airtable({ 
            apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN 
        }).base(process.env.AIRTABLE_BASE_ID);
        
        // Get a few venues to see what statuses are used
        const venues = await base('Venues').select({
            fields: ['Name', 'Status', 'Listing Status'],
            maxRecords: 10
        }).all();
        
        // Collect all unique statuses
        const statuses = new Set();
        const listingStatuses = new Set();
        venues.forEach(venue => {
            const status = venue.get('Status');
            const listingStatus = venue.get('Listing Status');
            if (status) statuses.add(status);
            if (listingStatus) listingStatuses.add(listingStatus);
        });
        
        const statusList = Array.from(statuses).sort();
        const listingStatusList = Array.from(listingStatuses).sort();
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Venue status options found',
                totalStatuses: statusList.length,
                totalListingStatuses: listingStatusList.length,
                statuses: statusList,
                listingStatuses: listingStatusList,
                sampleVenues: venues.map(venue => ({
                    name: venue.get('Name'),
                    status: venue.get('Status'),
                    listingStatus: venue.get('Listing Status')
                }))
            })
        };
        
    } catch (error) {
        console.error('Venue status check failed:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Venue status check failed',
                message: error.message,
                type: error.constructor.name
            })
        };
    }
};