exports.handler = async function (event, context) {
    console.log('Testing environment variables...');
    
    const requiredVars = [
        'AIRTABLE_PERSONAL_ACCESS_TOKEN',
        'AIRTABLE_BASE_ID',
        'FIREBASE_PROJECT_ID',
        'FIREBASE_CLIENT_EMAIL',
        'FIREBASE_PRIVATE_KEY',
        'CLOUDINARY_CLOUD_NAME',
        'CLOUDINARY_API_KEY',
        'CLOUDINARY_API_SECRET'
    ];
    
    const results = {};
    const missing = [];
    
    for (const varName of requiredVars) {
        const value = process.env[varName];
        if (value) {
            results[varName] = {
                present: true,
                length: value.length,
                preview: value.substring(0, 10) + '...'
            };
        } else {
            results[varName] = {
                present: false,
                length: 0,
                preview: null
            };
            missing.push(varName);
        }
    }
    
    const summary = {
        total: requiredVars.length,
        present: requiredVars.length - missing.length,
        missing: missing.length,
        missingVars: missing,
        results: results
    };
    
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
        },
        body: JSON.stringify(summary)
    };
};