const admin = require('firebase-admin');

exports.handler = async function(event, context) {
    console.log('Event Field Migration: Starting migration...');
    
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

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
        const eventsRef = db.collection('events');
        
        console.log('Event Field Migration: Fetching all events...');
        const snapshot = await eventsRef.get();
        
        const migrationResults = {
            total: snapshot.size,
            migrated: 0,
            skipped: 0,
            errors: 0,
            details: []
        };
        
        console.log(`Event Field Migration: Processing ${snapshot.size} events...`);
        
        const batch = db.batch();
        let batchCount = 0;
        const BATCH_SIZE = 500;
        
        for (const doc of snapshot.docs) {
            const data = doc.data();
            const updates = {};
            let needsUpdate = false;
            
            // Migrate field names to standardized format
            const fieldMappings = {
                // Event name fields
                'Event Name': 'name',
                'event-name': 'name',
                
                // Status fields
                'Status': 'status',
                'Pending Review': 'pending',
                'Approved': 'approved',
                'Rejected': 'rejected',
                
                // Date fields
                'Date': 'date',
                'Event Date': 'date',
                
                // Venue fields
                'Venue Name': 'venueName',
                'venue-name': 'venueName',
                'Venue Slug': 'venueSlug',
                'venue-slug': 'venueSlug',
                
                // Category fields
                'Category': 'category',
                'categories': 'category',
                'categoryIds': 'category',
                
                // Image fields
                'Cloudinary Public ID': 'cloudinaryPublicId',
                'Promo Image': 'promoImage',
                'promo-image': 'promoImage',
                
                // Recurring fields
                'Recurring Info': 'recurringInfo',
                'Series ID': 'seriesId',
                'series-id': 'seriesId',
                
                // Link fields
                'Link': 'link',
                'Ticket Link': 'ticketLink',
                'ticket-link': 'ticketLink',
                
                // Metadata fields
                'Submitted By': 'submittedBy',
                'Submitter Email': 'submitterEmail',
                'submitter-email': 'submitterEmail'
            };
            
            // Process field mappings
            for (const oldField of Object.keys(fieldMappings)) {
                if (data[oldField] !== undefined) {
                    const newField = fieldMappings[oldField];
                    
                    // Handle special cases
                    if (oldField === 'Status' && typeof data[oldField] === 'string') {
                        // Normalize status values
                        const statusValue = data[oldField].toLowerCase();
                        if (statusValue === 'pending review') {
                            updates[newField] = 'pending';
                        } else if (statusValue === 'approved') {
                            updates[newField] = 'approved';
                        } else if (statusValue === 'rejected') {
                            updates[newField] = 'rejected';
                        } else {
                            updates[newField] = statusValue;
                        }
                    } else if (oldField === 'categoryIds' && typeof data[oldField] === 'string') {
                        // Convert comma-separated string to array
                        updates[newField] = data[oldField].split(',').map(cat => cat.trim()).filter(cat => cat);
                    } else if (oldField === 'Promo Image' && Array.isArray(data[oldField])) {
                        // Convert Airtable image array to URL string
                        if (data[oldField].length > 0 && data[oldField][0].url) {
                            updates[newField] = data[oldField][0].url;
                        }
                    } else {
                        // Direct field copy
                        updates[newField] = data[oldField];
                    }
                    
                    needsUpdate = true;
                }
            }
            
            // Add missing required fields
            if (!data.name && !updates.name) {
                updates.name = 'Untitled Event';
                needsUpdate = true;
            }
            
            if (!data.status && !updates.status) {
                updates.status = 'pending';
                needsUpdate = true;
            }
            
            if (!data.createdAt) {
                updates.createdAt = new Date();
                needsUpdate = true;
            }
            
            if (!data.updatedAt) {
                updates.updatedAt = new Date();
                needsUpdate = true;
            }
            
            // Add to batch if updates needed
            if (needsUpdate) {
                const docRef = eventsRef.doc(doc.id);
                batch.update(docRef, updates);
                batchCount++;
                migrationResults.migrated++;
                
                migrationResults.details.push({
                    id: doc.id,
                    name: data.name || data['Event Name'] || 'Untitled Event',
                    fieldsUpdated: Object.keys(updates)
                });
                
                console.log(`Event Field Migration: Updated event ${doc.id} with fields:`, Object.keys(updates));
            } else {
                migrationResults.skipped++;
                console.log(`Event Field Migration: Skipped event ${doc.id} (no updates needed)`);
            }
            
            // Commit batch when it reaches the limit
            if (batchCount >= BATCH_SIZE) {
                console.log(`Event Field Migration: Committing batch of ${batchCount} updates...`);
                await batch.commit();
                batchCount = 0;
            }
        }
        
        // Commit any remaining updates
        if (batchCount > 0) {
            console.log(`Event Field Migration: Committing final batch of ${batchCount} updates...`);
            await batch.commit();
        }
        
        console.log('Event Field Migration: Migration completed successfully');
        console.log('Migration Results:', migrationResults);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Event field migration completed successfully',
                results: migrationResults
            })
        };
        
    } catch (error) {
        console.error('Event Field Migration: Error during migration:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Migration failed',
                message: error.message
            })
        };
    }
}; 