exports.handler = async function (event, context) {
    console.log('test-admin-events: Function called');
    
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        },
        body: JSON.stringify({
            success: true,
            message: 'Test function working',
            timestamp: new Date().toISOString()
        })
    };
}; 