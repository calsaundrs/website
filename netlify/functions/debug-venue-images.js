const admin = require('firebase-admin');

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        console.log('Debug Venue Images: Starting function');
        
        // Initialize Firebase
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
                })
            });
        }
        const db = admin.firestore();
        
        // Fetch first few venues to inspect their structure
        const venuesRef = db.collection('venues');
        console.log('Debug Venue Images: Fetching venues from Firestore');
        const snapshot = await venuesRef.limit(5).get();
        console.log(`Debug Venue Images: Found ${snapshot.size} venues`);
        
        const venueDetails = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const venueInfo = {
                id: doc.id,
                name: data.name || data['Name'] || 'Unnamed Venue',
                allFields: Object.keys(data),
                imageFields: {},
                stringFields: {}
            };
            
            // Check all fields for potential image data
            Object.keys(data).forEach(fieldName => {
                const fieldValue = data[fieldName];
                
                // Check if it's an object with URL-like properties
                if (typeof fieldValue === 'object' && fieldValue !== null) {
                    if (fieldValue.url || fieldValue.thumbnail || fieldValue.secure_url) {
                        venueInfo.imageFields[fieldName] = fieldValue;
                    }
                }
                
                // Check if it's a string that looks like a URL
                if (typeof fieldValue === 'string' && 
                    (fieldValue.includes('cloudinary') || 
                     fieldValue.includes('http') || 
                     fieldValue.includes('res.cloudinary'))) {
                    venueInfo.stringFields[fieldName] = fieldValue;
                }
            });
            
            venueDetails.push(venueInfo);
        });
        
        console.log('Debug Venue Images: Venue details:', venueDetails);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                totalVenues: snapshot.size,
                venueDetails: venueDetails
            })
        };

    } catch (error) {
        console.error('Debug Venue Images: Error:', error);
        console.error('Debug Venue Images: Error stack:', error.stack);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to debug venue images',
                details: error.message,
                stack: error.stack
            })
        };
    }
};