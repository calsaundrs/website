const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Updating event venue slugs...');
    
    try {
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
        
        // Venue name to slug mapping
        const venueSlugMap = {
            'Eden Bar': 'eden-bar',
            'Equator Bar': 'equator-bar',
            'Glamorous': 'glamorous',
            'Missing Bar': 'missing-bar',
            'Sidewalk': 'sidewalk',
            'The Fountain inn': 'the-fountain-inn',
            'The Fox': 'the-fox',
            'The Nightingale Club': 'the-nightingale-club',
            'The Village Inn': 'the-village-inn',
            'Test Venue': 'test-venue'
        };
        
        // Get all events
        const eventsSnapshot = await db.collection('events').get();
        let updatedCount = 0;
        let skippedCount = 0;
        const results = [];
        
        for (const doc of eventsSnapshot.docs) {
            const eventData = doc.data();
            const venueName = eventData.venueName;
            
            if (venueName && venueSlugMap[venueName]) {
                const venueSlug = venueSlugMap[venueName];
                
                // Update the event with the venue slug
                await doc.ref.update({
                    venueSlug: venueSlug,
                    updatedAt: new Date()
                });
                
                results.push({
                    eventId: doc.id,
                    eventName: eventData.name,
                    venueName: venueName,
                    venueSlug: venueSlug,
                    status: 'updated'
                });
                
                console.log(`Updated event "${eventData.name}" with venue slug: ${venueSlug}`);
                updatedCount++;
            } else if (venueName) {
                results.push({
                    eventId: doc.id,
                    eventName: eventData.name,
                    venueName: venueName,
                    status: 'skipped - no slug mapping'
                });
                
                console.log(`Skipped event "${eventData.name}" - no slug mapping for venue: "${venueName}"`);
                skippedCount++;
            } else {
                results.push({
                    eventId: doc.id,
                    eventName: eventData.name,
                    status: 'skipped - no venue name'
                });
                
                console.log(`Skipped event "${eventData.name}" - no venue name`);
                skippedCount++;
            }
        }
        
        console.log(`\nUpdate complete!`);
        console.log(`Updated: ${updatedCount} events`);
        console.log(`Skipped: ${skippedCount} events`);
        
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
                message: `Updated ${updatedCount} events, skipped ${skippedCount} events`,
                updated: updatedCount,
                skipped: skippedCount,
                results: results
            })
        };
        
    } catch (error) {
        console.error('Error updating event venue slugs:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            },
            body: JSON.stringify({
                success: false,
                error: 'Failed to update event venue slugs',
                message: error.message
            })
        };
    }
};