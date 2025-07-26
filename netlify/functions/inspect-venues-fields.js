const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
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

exports.handler = async function (event, context) {
    console.log("inspect-venues-fields function called");
    
    try {
        const venuesRef = db.collection('venues');
        const snapshot = await venuesRef.limit(5).get();
        
        console.log(`Found ${snapshot.size} venues to inspect`);
        
        const fieldAnalysis = {
            totalVenues: snapshot.size,
            allFields: new Set(),
            statusFields: {},
            sampleVenues: []
        };
        
        snapshot.forEach(doc => {
            const venueData = doc.data();
            const venueFields = Object.keys(venueData);
            
            // Add all fields to the set
            venueFields.forEach(field => fieldAnalysis.allFields.add(field));
            
            // Look for status-related fields
            venueFields.forEach(field => {
                if (field.toLowerCase().includes('status') || field.toLowerCase().includes('listing')) {
                    if (!fieldAnalysis.statusFields[field]) {
                        fieldAnalysis.statusFields[field] = [];
                    }
                    fieldAnalysis.statusFields[field].push(venueData[field]);
                }
            });
            
            // Add sample venue data
            fieldAnalysis.sampleVenues.push({
                id: doc.id,
                fields: venueFields,
                data: venueData
            });
        });
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                success: true,
                message: "Venues field inspection complete",
                analysis: {
                    totalVenues: fieldAnalysis.totalVenues,
                    allFields: Array.from(fieldAnalysis.allFields),
                    statusFields: fieldAnalysis.statusFields,
                    sampleVenues: fieldAnalysis.sampleVenues
                }
            })
        };
        
    } catch (error) {
        console.error('Error inspecting venues fields:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};