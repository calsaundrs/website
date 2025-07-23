const Airtable = require('airtable');

exports.handler = async function(event, context) {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { seriesId } = JSON.parse(event.body);
        
        if (!seriesId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Series ID is required' })
            };
        }

        const base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);
        
        // Find all future instances of this series
        const today = new Date().toISOString().split('T')[0];
        const records = await base('Events').select({
            filterByFormula: `AND({Series ID} = '${seriesId}', {Date} >= '${today}')`
        }).all();

        console.log(`Found ${records.length} future instances to end for series ${seriesId}`);

        // Update all future instances to mark them as ended
        const updates = records.map(record => ({
            id: record.id,
            fields: {
                'Status': 'Ended',
                'End Date': new Date().toISOString().split('T')[0]
            }
        }));

        if (updates.length > 0) {
            // Update in batches of 10 (Airtable limit)
            const batchSize = 10;
            for (let i = 0; i < updates.length; i += batchSize) {
                const batch = updates.slice(i, i + batchSize);
                await base('Events').update(batch);
            }
        }

        // Also update the series record to mark it as inactive
        const seriesRecords = await base('Events').select({
            filterByFormula: `{Series ID} = '${seriesId}'`,
            maxRecords: 1
        }).all();

        if (seriesRecords.length > 0) {
            await base('Events').update([{
                id: seriesRecords[0].id,
                fields: {
                    'Is Active': false,
                    'End Date': new Date().toISOString().split('T')[0]
                }
            }]);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                message: `Successfully ended ${updates.length} future instances` 
            })
        };

    } catch (error) {
        console.error('Error ending recurring series:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to end recurring series',
                details: error.message 
            })
        };
    }
};