const { generateAllVenuePages } = require('../../build-venues-from-db.js');

exports.handler = async (event, context) => {
    // Set CORS headers
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

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        console.log('🚀 Admin panel triggered venue rebuild...');
        
        // Parse the request body
        const body = JSON.parse(event.body || '{}');
        const { action, source } = body;
        
        console.log(`📋 Rebuild request from: ${source || 'unknown'}`);
        
        // Validate the request
        if (action !== 'rebuild') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Invalid action specified' 
                })
            };
        }

        // Check if user is authenticated (basic check)
        // In production, you'd want more robust authentication
        const authHeader = event.headers.authorization || event.headers.Authorization;
        if (!authHeader) {
            console.warn('⚠️ No authorization header provided');
            // For now, we'll allow the request but log it
        }

        // Start the rebuild process
        console.log('🔧 Starting venue rebuild process...');
        
        // Call the venue generation function
        const result = await generateAllVenuePages();
        
        console.log('✅ Venue rebuild completed successfully');
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Venue pages rebuilt successfully',
                generatedFiles: result.generatedFiles || 0,
                timestamp: new Date().toISOString(),
                source: source || 'admin-panel'
            })
        };

    } catch (error) {
        console.error('❌ Error during venue rebuild:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message || 'Internal server error',
                timestamp: new Date().toISOString()
            })
        };
    }
};