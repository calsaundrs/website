const Airtable = require('airtable');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
try {
    if (!admin.apps.length) {
        const privateKey = process.env.FIREBASE_PRIVATE_KEY 
            ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
            : '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKB\nAgEAAoIBAQC7VJTUt9Us8cKB\n-----END PRIVATE KEY-----\n';
            
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID || 'test-project',
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL || 'test@example.com',
                privateKey: privateKey,
            }),
        });
    }
} catch (error) {
    console.error("Firebase Admin Initialization Error:", error);
}

const db = admin.firestore();

// Initialize Airtable
const base = new Airtable({ 
    apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN 
}).base(process.env.AIRTABLE_BASE_ID);

// Configuration
const RATE_LIMIT_DELAY = 250; // 250ms between API calls
const BATCH_SIZE = 10; // Firestore batch size

// Helper function to delay execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to generate slug from name
function generateSlug(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim('-');
}

// Helper function to clean and validate data
function cleanData(data) {
    if (typeof data === 'string') {
        return data.trim();
    }
    if (Array.isArray(data)) {
        return data.filter(item => item !== null && item !== undefined);
    }
    return data;
}

// Helper function to convert Airtable record to clean object
function recordToObject(record) {
    const fields = record.fields;
    const cleanFields = {};

    for (const [key, value] of Object.entries(fields)) {
        cleanFields[key] = cleanData(value);
    }
    
    // Ensure createdAt is always a valid date string
    const createdAt = record.createdTime || new Date().toISOString();
    
    return {
        id: record.id,
        ...cleanFields,
        createdAt: createdAt,
        updatedAt: new Date().toISOString()
    };
}

// Migration function for Venues
async function migrateVenues() {
    console.log('Starting Venues migration...');
    const venuesTable = base('Venues');
    const venuesCollection = db.collection('venues');
    
    let processedCount = 0;
    let errorCount = 0;
    
    try {
        const records = await venuesTable.select().all();
        console.log(`Found ${records.length} venues to migrate`);
        
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batch = db.batch();
            const chunk = records.slice(i, i + BATCH_SIZE);
            
            for (const record of chunk) {
                try {
                    // Debug: Log record structure for first few records
                    if (processedCount < 3) {
                        console.log(`Debug - Record ${record.id}:`, {
                            id: record.id,
                            createdTime: record.createdTime,
                            fields: Object.keys(record.fields)
                        });
                    }
                    
                    const venueData = recordToObject(record);
                    
                    // Generate slug if not present
                    if (!venueData.slug && venueData.Name) {
                        venueData.slug = generateSlug(venueData.Name);
                    }
                    
                    // Set default status if not present
                    if (!venueData.Status) {
                        venueData.Status = 'Approved';
                    }
                    
                    // Create venue document
                    const venueRef = venuesCollection.doc(venueData.id);
                    batch.set(venueRef, venueData);
                    processedCount++;
                    
                } catch (error) {
                    console.error(`Error processing venue ${record.id}:`, error);
                    errorCount++;
                }
            }
            
            // Commit batch
            await batch.commit();
            console.log(`Processed ${Math.min(i + BATCH_SIZE, records.length)} venues`);
            
            // Rate limiting
            if (i + BATCH_SIZE < records.length) {
                await delay(RATE_LIMIT_DELAY);
            }
        }
        
        console.log(`Venues migration complete: ${processedCount} processed, ${errorCount} errors`);
        return { processedCount, errorCount };
        
    } catch (error) {
        console.error('Venues migration failed:', error);
        throw error;
    }
}

// Migration function for Events
async function migrateEvents() {
    console.log('Starting Events migration...');
    const eventsTable = base('Events');
    const eventsCollection = db.collection('events');
    const venuesCollection = db.collection('venues');
    
    let processedCount = 0;
    let errorCount = 0;
    
    try {
        const records = await eventsTable.select().all();
        console.log(`Found ${records.length} events to migrate`);
        
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batch = db.batch();
            const chunk = records.slice(i, i + BATCH_SIZE);
            
            for (const record of chunk) {
                try {
                    const eventData = recordToObject(record);
                    
                    // Generate slug if not present
                    if (!eventData.slug && eventData['Event Name']) {
                        eventData.slug = generateSlug(eventData['Event Name']);
                    }
                    
                    // Set default status if not present
                    if (!eventData.Status) {
                        eventData.Status = 'Approved';
                    }
                    
                    // Handle venue relationship
                    if (eventData.Venue && Array.isArray(eventData.Venue)) {
                        // This is an array of venue IDs from Airtable
                        // We'll store the first venue ID as the primary venue
                        eventData.venueId = eventData.Venue[0];
                        delete eventData.Venue; // Remove the array, keep only the ID
                    } else if (eventData.VenueText) {
                        // If we have venue text but no ID, we'll need to look it up
                        // For now, we'll keep the text and handle linking later
                        eventData.venueName = eventData.VenueText;
                        delete eventData.VenueText;
                    }
                    
                    // Handle recurring event data
                    if (eventData['Recurring Series ID']) {
                        eventData.recurringSeriesId = eventData['Recurring Series ID'];
                        delete eventData['Recurring Series ID'];
                    }
                    
                    if (eventData['Parent Event ID']) {
                        eventData.parentEventId = eventData['Parent Event ID'];
                        delete eventData['Parent Event ID'];
                    }
                    
                    // Handle dates
                    if (eventData['Event Date']) {
                        eventData.eventDate = eventData['Event Date'];
                        delete eventData['Event Date'];
                    }
                    
                    if (eventData['End Date']) {
                        eventData.endDate = eventData['End Date'];
                        delete eventData['End Date'];
                    }
                    
                    // Handle categories
                    if (eventData.Category && Array.isArray(eventData.Category)) {
                        eventData.categories = eventData.Category;
                        delete eventData.Category;
                    }
                    
                    // Create event document
                    const eventRef = eventsCollection.doc(eventData.id);
                    batch.set(eventRef, eventData);
                    processedCount++;
                    
                } catch (error) {
                    console.error(`Error processing event ${record.id}:`, error);
                    errorCount++;
                }
            }
            
            // Commit batch
            await batch.commit();
            console.log(`Processed ${Math.min(i + BATCH_SIZE, records.length)} events`);
            
            // Rate limiting
            if (i + BATCH_SIZE < records.length) {
                await delay(RATE_LIMIT_DELAY);
            }
        }
        
        console.log(`Events migration complete: ${processedCount} processed, ${errorCount} errors`);
        return { processedCount, errorCount };
        
    } catch (error) {
        console.error('Events migration failed:', error);
        throw error;
    }
}

// Migration function for System Notifications
async function migrateSystemNotifications() {
    console.log('Starting System Notifications migration...');
    const notificationsTable = base('System Notifications');
    const notificationsCollection = db.collection('systemNotifications');
    
    let processedCount = 0;
    let errorCount = 0;
    
    try {
        const records = await notificationsTable.select().all();
        console.log(`Found ${records.length} system notifications to migrate`);
        
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batch = db.batch();
            const chunk = records.slice(i, i + BATCH_SIZE);
            
            for (const record of chunk) {
                try {
                    const notificationData = recordToObject(record);
                    
                    // Set default status if not present
                    if (!notificationData.Status) {
                        notificationData.Status = 'Active';
                    }
                    
                    // Create notification document
                    const notificationRef = notificationsCollection.doc(notificationData.id);
                    batch.set(notificationRef, notificationData);
                    processedCount++;
                    
                } catch (error) {
                    console.error(`Error processing notification ${record.id}:`, error);
                    errorCount++;
                }
            }
            
            // Commit batch
            await batch.commit();
            console.log(`Processed ${Math.min(i + BATCH_SIZE, records.length)} notifications`);
            
            // Rate limiting
            if (i + BATCH_SIZE < records.length) {
                await delay(RATE_LIMIT_DELAY);
            }
        }
        
        console.log(`System Notifications migration complete: ${processedCount} processed, ${errorCount} errors`);
        return { processedCount, errorCount };
        
    } catch (error) {
        console.error('System Notifications migration failed:', error);
        throw error;
    }
}

// Post-migration function to establish relationships
async function establishRelationships() {
    console.log('Establishing relationships between collections...');
    
    const eventsCollection = db.collection('events');
    const venuesCollection = db.collection('venues');
    
    try {
        // Get all events that have venue names but no venue IDs
        const eventsSnapshot = await eventsCollection
            .where('venueName', '!=', null)
            .get();
        
        let linkedCount = 0;
        let unlinkedCount = 0;
        
        for (const eventDoc of eventsSnapshot.docs) {
            const eventData = eventDoc.data();
            const venueName = eventData.venueName;
            
            if (venueName) {
                // Try to find matching venue by name
                const venuesSnapshot = await venuesCollection
                    .where('Name', '==', venueName)
                    .limit(1)
                    .get();
                
                if (!venuesSnapshot.empty) {
                    const venueDoc = venuesSnapshot.docs[0];
                    const venueId = venueDoc.id;
                    
                    // Update event with venue ID
                    await eventDoc.ref.update({
                        venueId: venueId,
                        venueName: admin.firestore.FieldValue.delete()
                    });
                    
                    linkedCount++;
                } else {
                    unlinkedCount++;
                    console.log(`No venue found for: ${venueName}`);
                }
            }
        }
        
        console.log(`Relationship establishment complete: ${linkedCount} linked, ${unlinkedCount} unlinked`);
        return { linkedCount, unlinkedCount };
        
    } catch (error) {
        console.error('Relationship establishment failed:', error);
        throw error;
    }
}

// Main migration handler
exports.handler = async function (event, context) {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ 
                success: false, 
                message: 'Method Not Allowed. Use POST to trigger migration.' 
            })
        };
    }
    
    // Optional: Add authentication check
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return {
            statusCode: 401,
            body: JSON.stringify({ 
                success: false, 
                message: 'Unauthorized. Valid Bearer token required.' 
            })
        };
    }
    
    const startTime = Date.now();
    const results = {
        success: true,
        startTime: new Date(startTime).toISOString(),
        migrations: {},
        relationships: {},
        totalTime: 0
    };
    
    try {
        console.log('=== Starting Full Migration ===');
        
        // Step 1: Migrate Venues (fewer dependencies)
        console.log('\n--- Step 1: Migrating Venues ---');
        results.migrations.venues = await migrateVenues();
        await delay(RATE_LIMIT_DELAY);
        
        // Step 2: Migrate Events
        console.log('\n--- Step 2: Migrating Events ---');
        results.migrations.events = await migrateEvents();
        await delay(RATE_LIMIT_DELAY);
        
        // Step 3: Migrate System Notifications
        console.log('\n--- Step 3: Migrating System Notifications ---');
        results.migrations.systemNotifications = await migrateSystemNotifications();
        await delay(RATE_LIMIT_DELAY);
        
        // Step 4: Establish relationships
        console.log('\n--- Step 4: Establishing Relationships ---');
        results.relationships = await establishRelationships();
        
        const endTime = Date.now();
        results.totalTime = endTime - startTime;
        results.endTime = new Date(endTime).toISOString();
        
        console.log('\n=== Migration Complete ===');
        console.log(`Total time: ${results.totalTime}ms`);
        
        return {
            statusCode: 200,
            body: JSON.stringify(results)
        };
        
    } catch (error) {
        console.error('Migration failed:', error);
        
        const endTime = Date.now();
        results.success = false;
        results.error = error.message;
        results.totalTime = endTime - startTime;
        results.endTime = new Date(endTime).toISOString();
        
        return {
            statusCode: 500,
            body: JSON.stringify(results)
        };
    }
};