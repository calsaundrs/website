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
        console.log('Venue List: Starting function - testing basic functionality');
        
        // Return a simple test response for now
        const testVenues = [
            {
                id: 'test-1',
                name: 'Test Venue 1',
                address: '123 Test Street',
                description: 'A test venue',
                website: 'https://example.com',
                phone: '0121 123 4567'
            },
            {
                id: 'test-2',
                name: 'Test Venue 2',
                address: '456 Test Avenue',
                description: 'Another test venue',
                website: 'https://example2.com',
                phone: '0121 987 6543'
            }
        ];

        console.log('Venue List: Returning test venues successfully');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(testVenues)
        };

    } catch (error) {
        console.error('Venue List: Error:', error);
        console.error('Venue List: Error stack:', error.stack);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to fetch venues',
                details: error.message,
                stack: error.stack
            })
        };
    }
};
