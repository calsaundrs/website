const Airtable = require('airtable');

const base = new Airtable({ 
  apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN 
}).base(process.env.AIRTABLE_BASE_ID);

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
        console.log('Notifications: Starting function');
        
        // Return empty notifications for now
        const notifications = {
            notifications: [],
            unreadCount: 0,
            timestamp: new Date().toISOString()
        };

        console.log('Notifications: Returning notifications successfully');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(notifications)
        };

    } catch (error) {
        console.error('Notifications: Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to get notifications',
                details: error.message
            })
        };
    }
};