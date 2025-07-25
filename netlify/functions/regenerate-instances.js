const SeriesManager = require('./services/series-manager');
const EventService = require('./services/event-service');

const seriesManager = new SeriesManager();
const eventService = new EventService();

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

        console.log(`Regenerating instances for series ${seriesId}...`);

        // Use SeriesManager to regenerate instances
        const result = await seriesManager.regenerateInstances(seriesId);
        
        console.log(`Successfully regenerated ${result.generatedInstances} instances for series ${seriesId}`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                message: `Successfully regenerated ${result.generatedInstances} instances` 
            })
        };

    } catch (error) {
        console.error('Error regenerating instances:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to regenerate instances',
                details: error.message 
            })
        };
    }
};

