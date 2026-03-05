const admin = require('firebase-admin');

// Initialize Firebase if not already initialized
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
    try {
        console.log("Fetching all approved events...");
        const snapshot = await db.collection('events').get();
        let updatedCount = 0;

        const specificUpdates = {
            'Trans Central': { venueName: 'Birmingham LGBT Centre', venueSlug: 'birmingham-lgbt-centre', time: '18:30' },
            'Bing-eoke with Blanche': { time: '20:30' },
            'Midweek Mayhem with Misty': { time: '21:00' },
            'Throwback Thursday': { time: '21:00' },
            'Trans-ition': { venueName: 'The Fox', venueSlug: 'the-fox', time: '19:00' },
            'Shamrocks and Shenanigans': { venueName: 'The Fox', venueSlug: 'the-fox', time: '20:00' },
        };

        const batch = db.batch();

        snapshot.forEach(doc => {
            const data = doc.data();
            let needsUpdate = false;
            let updateData = {};

            // 1. Fox and Goose -> The Fox
            if (data.venueName === 'Fox and Goose' || data.venueSlug === 'fox-and-goose' || data.venueName === 'The Fox and Goose') {
                updateData.venueName = 'The Fox';
                updateData.venueSlug = 'the-fox';
                needsUpdate = true;
            }

            // 2. Midnight time 00:00 defaults
            let time = data.time || data.eventTime;
            if (time === '00:00') {
                updateData.time = '20:00'; // fallback
                updateData.eventTime = '20:00';
                needsUpdate = true;
            }

            // Match specific rules
            for (const [eventName, updates] of Object.entries(specificUpdates)) {
                if (data.name && data.name.includes(eventName)) {
                    if (updates.venueName && data.venueName !== updates.venueName) {
                        updateData.venueName = updates.venueName;
                        if (updates.venueSlug) updateData.venueSlug = updates.venueSlug;
                        needsUpdate = true;
                    }
                    if (updates.time && time !== updates.time) {
                        updateData.time = updates.time;
                        updateData.eventTime = updates.time;
                        needsUpdate = true;
                    }
                }
            }

            if (needsUpdate) {
                console.log(`Updating ${doc.id} - ${data.name}:`, updateData);
                batch.update(doc.ref, updateData);
                updatedCount++;
            }
        });

        if (updatedCount > 0) {
            console.log(`Committing ${updatedCount} updates...`);
            await batch.commit();
            console.log('Update complete.');
            return {
                statusCode: 200,
                body: JSON.stringify({ message: `Updated ${updatedCount} events` })
            };
        } else {
            console.log('No updates required.');
            return {
                statusCode: 200,
                body: JSON.stringify({ message: "No updates were needed" })
            };
        }
    } catch (error) {
        console.error("Error updating events:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
