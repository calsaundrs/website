exports.handler = async function(event, context) {
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
        console.log('System Status: Starting function');
        
        // Return basic system status
        const status = {
            timestamp: new Date().toISOString(),
            status: 'operational',
            services: {
                firestore: 'operational',
                functions: 'operational',
                storage: 'operational'
            },
            version: '2.0.0',
            environment: process.env.NODE_ENV || 'development'
        };

        console.log('System Status: Returning status successfully');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(status)
        };

    } catch (error) {
        console.error('System Status: Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to get system status',
                details: error.message
            })
        };
    }
};