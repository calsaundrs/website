const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
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

exports.handler = async (event, context) => {
    console.log("=== FIX EVENT CATEGORIES FUNCTION CALLED ===");
    
    try {
        const eventsRef = db.collection('events');
        const snapshot = await eventsRef.get();
        
        console.log(`Found ${snapshot.size} total events in collection`);
        
        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        
        const batch = db.batch();
        let batchCount = 0;
        const BATCH_SIZE = 500; // Firestore batch limit
        
        for (const doc of snapshot.docs) {
            try {
                const eventData = doc.data();
                const eventId = doc.id;
                
                console.log(`Processing event: ${eventData['Event Name'] || eventData.name || 'Unknown'} (ID: ${eventId})`);
                
                // Check current category data
                const currentCategories = eventData['categories'] || eventData.category || eventData.categoryIds || [];
                console.log(`Current categories:`, currentCategories);
                
                // Normalize categories to array format
                let normalizedCategories = [];
                
                if (Array.isArray(currentCategories)) {
                    // Already an array, just clean it up
                    normalizedCategories = currentCategories
                        .filter(cat => cat && typeof cat === 'string' && cat.trim())
                        .map(cat => cat.trim());
                } else if (typeof currentCategories === 'string') {
                    // String format, split by comma and clean
                    normalizedCategories = currentCategories
                        .split(',')
                        .filter(cat => cat && cat.trim())
                        .map(cat => cat.trim());
                }
                
                // If no categories found, add default categories based on event type
                if (normalizedCategories.length === 0) {
                    const eventName = (eventData['Event Name'] || eventData.name || '').toLowerCase();
                    const description = (eventData['Description'] || eventData.description || '').toLowerCase();
                    
                    // Auto-detect categories based on content
                    if (eventName.includes('drag') || description.includes('drag')) {
                        normalizedCategories.push('Drag');
                    }
                    if (eventName.includes('club') || eventName.includes('night') || description.includes('club') || description.includes('night')) {
                        normalizedCategories.push('Nightclub');
                    }
                    if (eventName.includes('bar') || description.includes('bar')) {
                        normalizedCategories.push('Bar');
                    }
                    if (eventName.includes('social') || description.includes('social') || description.includes('meet')) {
                        normalizedCategories.push('Social');
                    }
                    if (eventName.includes('music') || description.includes('music') || description.includes('live')) {
                        normalizedCategories.push('Live Music');
                    }
                    if (eventName.includes('theatre') || description.includes('theatre') || description.includes('show')) {
                        normalizedCategories.push('Theatre');
                    }
                    if (eventName.includes('workshop') || description.includes('workshop') || description.includes('learn')) {
                        normalizedCategories.push('Workshop');
                    }
                    if (eventName.includes('kink') || description.includes('kink') || description.includes('bdsm')) {
                        normalizedCategories.push('Kink');
                    }
                    if (eventName.includes('family') || description.includes('family') || description.includes('kids')) {
                        normalizedCategories.push('Family');
                    }
                    if (eventName.includes('party') || description.includes('party')) {
                        normalizedCategories.push('Party');
                    }
                    if (eventName.includes('community') || description.includes('community')) {
                        normalizedCategories.push('Community');
                    }
                    if (eventName.includes('educational') || description.includes('educational') || description.includes('learn')) {
                        normalizedCategories.push('Educational');
                    }
                    
                    // Always add LGBTQ+ as default category
                    if (!normalizedCategories.includes('LGBTQ+')) {
                        normalizedCategories.push('LGBTQ+');
                    }
                    
                    // Add Entertainment as fallback if no specific categories found
                    if (normalizedCategories.length === 1 && normalizedCategories[0] === 'LGBTQ+') {
                        normalizedCategories.push('Entertainment');
                    }
                }
                
                // Ensure we have at least some categories
                if (normalizedCategories.length === 0) {
                    normalizedCategories = ['LGBTQ+', 'Entertainment'];
                }
                
                console.log(`Normalized categories:`, normalizedCategories);
                
                // Check if update is needed
                const needsUpdate = !Array.isArray(currentCategories) || 
                                  JSON.stringify(currentCategories.sort()) !== JSON.stringify(normalizedCategories.sort());
                
                if (needsUpdate) {
                    // Update the document with normalized categories
                    const eventRef = db.collection('events').doc(eventId);
                    batch.update(eventRef, {
                        'categories': normalizedCategories,
                        'category': normalizedCategories, // Keep both for compatibility
                        'categoryIds': normalizedCategories, // Keep both for compatibility
                        'updatedAt': new Date(),
                        'categoryFixed': true
                    });
                    
                    batchCount++;
                    updatedCount++;
                    
                    console.log(`✅ Will update event: ${eventData['Event Name'] || eventData.name} with categories:`, normalizedCategories);
                    
                    // Commit batch if it's getting full
                    if (batchCount >= BATCH_SIZE) {
                        await batch.commit();
                        console.log(`Committed batch of ${batchCount} updates`);
                        batchCount = 0;
                    }
                } else {
                    console.log(`⏭️ Skipping event: ${eventData['Event Name'] || eventData.name} - categories already correct`);
                    skippedCount++;
                }
                
            } catch (error) {
                console.error(`❌ Error processing event ${doc.id}:`, error);
                errorCount++;
            }
        }
        
        // Commit any remaining updates
        if (batchCount > 0) {
            await batch.commit();
            console.log(`Committed final batch of ${batchCount} updates`);
        }
        
        console.log(`=== CATEGORY FIX COMPLETE ===`);
        console.log(`Total events processed: ${snapshot.size}`);
        console.log(`Events updated: ${updatedCount}`);
        console.log(`Events skipped (already correct): ${skippedCount}`);
        console.log(`Errors: ${errorCount}`);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                success: true,
                message: 'Event categories fixed successfully',
                summary: {
                    totalEvents: snapshot.size,
                    updated: updatedCount,
                    skipped: skippedCount,
                    errors: errorCount
                }
            })
        };
        
    } catch (error) {
        console.error('Error fixing event categories:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                error: 'Failed to fix event categories',
                message: error.message
            })
        };
    }
};
