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

// Gemini API integration
async function getCategoriesFromGemini(eventName, description) {
    if (!process.env.GEMINI_API_KEY) {
        console.log('No Gemini API key found, using fallback detection');
        return null;
    }
    
    try {
        const prompt = `Analyze this LGBTQ+ event and assign appropriate categories from this list:
Drag, Nightclub, Bar, Social, Live Music, Theatre, Workshop, Kink, Family, Party, Community, Educational, Entertainment

Event Name: ${eventName}
Description: ${description}

Please respond with ONLY the category names separated by commas, no other text. For example: "Drag, Social, Entertainment"

If the event doesn't clearly fit any specific category, use "Entertainment" as a fallback.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        const categoriesText = data.candidates[0].content.parts[0].text.trim();
        
        // Parse the response
        const categories = categoriesText
            .split(',')
            .map(cat => cat.trim())
            .filter(cat => cat && cat.length > 0);
        
        console.log(`Gemini suggested categories: ${categories.join(', ')}`);
        return categories;
        
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        return null;
    }
}

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
                
                // If no categories found, use Gemini API for intelligent category assignment
                if (normalizedCategories.length === 0) {
                    const eventName = eventData['Event Name'] || eventData.name || '';
                    const description = eventData['Description'] || eventData.description || '';
                    
                    console.log(`No categories found for "${eventName}", using Gemini API for intelligent detection...`);
                    
                    // Try Gemini API first
                    const geminiCategories = await getCategoriesFromGemini(eventName, description);
                    
                    if (geminiCategories && geminiCategories.length > 0) {
                        normalizedCategories = geminiCategories;
                        console.log(`✅ Gemini assigned categories: ${normalizedCategories.join(', ')}`);
                    } else {
                        // Fallback to keyword detection if Gemini fails
                        console.log('Gemini API failed, using fallback keyword detection...');
                        const eventNameLower = eventName.toLowerCase();
                        const descriptionLower = description.toLowerCase();
                        
                        // Auto-detect categories based on content
                        if (eventNameLower.includes('drag') || descriptionLower.includes('drag')) {
                            normalizedCategories.push('Drag');
                        }
                        if (eventNameLower.includes('club') || eventNameLower.includes('night') || descriptionLower.includes('club') || descriptionLower.includes('night')) {
                            normalizedCategories.push('Nightclub');
                        }
                        if (eventNameLower.includes('bar') || descriptionLower.includes('bar')) {
                            normalizedCategories.push('Bar');
                        }
                        if (eventNameLower.includes('social') || descriptionLower.includes('social') || descriptionLower.includes('meet')) {
                            normalizedCategories.push('Social');
                        }
                        if (eventNameLower.includes('music') || descriptionLower.includes('music') || descriptionLower.includes('live')) {
                            normalizedCategories.push('Live Music');
                        }
                        if (eventNameLower.includes('theatre') || descriptionLower.includes('theatre') || descriptionLower.includes('show')) {
                            normalizedCategories.push('Theatre');
                        }
                        if (eventNameLower.includes('workshop') || descriptionLower.includes('workshop') || descriptionLower.includes('learn')) {
                            normalizedCategories.push('Workshop');
                        }
                        if (eventNameLower.includes('kink') || descriptionLower.includes('kink') || descriptionLower.includes('bdsm')) {
                            normalizedCategories.push('Kink');
                        }
                        if (eventNameLower.includes('family') || descriptionLower.includes('family') || descriptionLower.includes('kids')) {
                            normalizedCategories.push('Family');
                        }
                        if (eventNameLower.includes('party') || descriptionLower.includes('party')) {
                            normalizedCategories.push('Party');
                        }
                        if (eventNameLower.includes('community') || descriptionLower.includes('community')) {
                            normalizedCategories.push('Community');
                        }
                        if (eventNameLower.includes('educational') || descriptionLower.includes('educational') || descriptionLower.includes('learn')) {
                            normalizedCategories.push('Educational');
                        }
                        
                        console.log(`✅ Fallback assigned categories: ${normalizedCategories.join(', ')}`);
                    }
                    
                    // Always add LGBTQ+ as default category if not already present
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
                
                // Also try to improve existing categories using Gemini
                if (normalizedCategories.length > 0 && normalizedCategories.length < 3) {
                    const eventName = eventData['Event Name'] || eventData.name || '';
                    const description = eventData['Description'] || eventData.description || '';
                    
                    console.log(`Improving existing categories for "${eventName}"...`);
                    const geminiCategories = await getCategoriesFromGemini(eventName, description);
                    
                    if (geminiCategories && geminiCategories.length > 0) {
                        // Merge existing and Gemini categories, removing duplicates
                        const allCategories = [...new Set([...normalizedCategories, ...geminiCategories])];
                        if (allCategories.length > normalizedCategories.length) {
                            console.log(`✅ Gemini improved categories: ${normalizedCategories.join(', ')} → ${allCategories.join(', ')}`);
                            normalizedCategories = allCategories;
                        }
                    }
                }
                
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
