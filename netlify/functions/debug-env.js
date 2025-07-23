exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    console.log('debug-env: Checking environment variables');

    const envVars = {
        AIRTABLE_PERSONAL_ACCESS_TOKEN: !!process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
        AIRTABLE_BASE_ID: !!process.env.AIRTABLE_BASE_ID,
        NODE_ENV: process.env.NODE_ENV,
        NETLIFY_DEV: process.env.NETLIFY_DEV,
        NETLIFY_FUNCTION_REGION: process.env.NETLIFY_FUNCTION_REGION
    };

    console.log('debug-env: Environment variables status:', envVars);

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
        body: JSON.stringify({
            message: 'Environment variables check',
            environment: envVars,
            timestamp: new Date().toISOString()
        })
    };
};