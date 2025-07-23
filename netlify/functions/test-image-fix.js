const Airtable = require('airtable');

exports.handler = async (event, context) => {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        console.log('Test Image Fix: Starting test...');
        
        if (!process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN || !process.env.AIRTABLE_BASE_ID) {
            throw new Error('Missing required environment variables');
        }

        const base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);
        
        // Get a few recurring events to test
        console.log('Test Image Fix: Fetching recurring events...');
        const eventRecords = await base('Events').select({
            filterByFormula: "AND({Status} = 'Approved', {Recurring Info} != '')",
            maxRecords: 5,
            fields: ['Event Name', 'Recurring Info', 'Series ID', 'Promo Image', 'Cloudinary Public ID']
        }).all();

        const results = [];
        
        for (const record of eventRecords) {
            const fields = record.fields;
            const cloudinaryPublicId = fields['Cloudinary Public ID'];
            const promoImage = fields['Promo Image'] && fields['Promo Image'][0] ? fields['Promo Image'][0] : null;
            
            // Test the same logic as in get-events.js
            const imageUrl = cloudinaryPublicId ? 
                `https://res.cloudinary.com/dbxhpjoiz/image/upload/f_auto,q_auto,w_500,h_281,c_limit/${cloudinaryPublicId}` : 
                (promoImage ? promoImage.url : null);
            
            results.push({
                eventName: fields['Event Name'],
                recurringInfo: fields['Recurring Info'],
                seriesId: fields['Series ID'],
                cloudinaryPublicId,
                promoImageUrl: promoImage ? promoImage.url : null,
                finalImageUrl: imageUrl,
                hasImage: !!imageUrl
            });
        }

        console.log('Test Image Fix: Test completed');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Image fix test completed',
                results,
                summary: {
                    totalEvents: results.length,
                    eventsWithImages: results.filter(r => r.hasImage).length,
                    eventsWithoutImages: results.filter(r => !r.hasImage).length
                }
            })
        };

    } catch (error) {
        console.error('Test Image Fix: Error during test:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to test image fix',
                details: error.message
            })
        };
    }
};