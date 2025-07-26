const Airtable = require('airtable');

exports.handler = async function (event, context) {
    console.log('Checking category options...');
    
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
        
        // Get a few events to see what categories are used
        const events = await base('Events').select({
            fields: ['Event Name', 'Category'],
            maxRecords: 10
        }).all();
        
        // Collect all unique categories
        const categories = new Set();
        events.forEach(event => {
            const eventCategories = event.get('Category');
            if (eventCategories && Array.isArray(eventCategories)) {
                eventCategories.forEach(cat => categories.add(cat));
            }
        });
        
        const categoryList = Array.from(categories).sort();
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Category options found',
                totalCategories: categoryList.length,
                categories: categoryList,
                sampleEvents: events.map(event => ({
                    name: event.get('Event Name'),
                    categories: event.get('Category')
                }))
            })
        };
        
    } catch (error) {
        console.error('Category check failed:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Category check failed',
                message: error.message,
                type: error.constructor.name
            })
        };
    }
};