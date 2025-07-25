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

        console.log(`Ending series ${seriesId}...`);

        // Use SeriesManager to end the series
        const result = await seriesManager.endSeries(seriesId);
        
        console.log(`Successfully ended series ${seriesId}: ${result.endedInstances} instances ended`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                message: `Successfully ended ${result.endedInstances} future instances` 
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