const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Trigger venue rebuild function called');
    
    try {
        // Check environment variables
        const required = [
            'FIREBASE_PROJECT_ID',
            'FIREBASE_CLIENT_EMAIL',
            'FIREBASE_PRIVATE_KEY'
        ];
        
        const missing = required.filter(varName => !process.env[varName]);
        if (missing.length > 0) {
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Environment configuration error',
                    message: `Missing environment variables: ${missing.join(', ')}`,
                    missing: missing
                })
            };
        }
        
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
        
        console.log('Firebase initialized successfully');
        
        // Get all venues from Firestore
        console.log('Fetching all venues from database...');
        const venuesRef = db.collection('venues');
        const snapshot = await venuesRef.get();
        
        console.log(`Found ${snapshot.size} venues in database`);
        
        const venues = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            venues.push({
                id: doc.id,
                name: data.name || data['Name'] || 'Untitled Venue',
                slug: data.slug || data['Slug'] || '',
                description: data.description || data['Description'] || '',
                address: data.address || data['Address'] || '',
                status: data.status || 'pending',
                image: data.image || data['Image'] || null
            });
        });
        
        // Trigger the venue rebuild
        console.log('Triggering venue rebuild...');
        const rebuildResponse = await fetch('/.netlify/functions/build-venues-ssg', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer admin-trigger'
            },
            body: JSON.stringify({
                action: 'rebuild',
                source: 'debug-trigger'
            })
        });
        
        if (!rebuildResponse.ok) {
            throw new Error(`Venue rebuild failed: ${rebuildResponse.status}`);
        }
        
        const rebuildResult = await rebuildResponse.json();
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Venue rebuild triggered successfully',
                venuesFound: venues.length,
                venues: venues.slice(0, 5), // Show first 5 venues
                rebuildResult: rebuildResult
            })
        };
        
    } catch (error) {
        console.error('Trigger venue rebuild failed:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Trigger venue rebuild failed',
                message: error.message,
                type: error.constructor.name,
                stack: error.stack
            })
        };
    }
};