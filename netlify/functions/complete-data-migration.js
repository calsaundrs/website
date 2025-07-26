const Airtable = require('airtable');

// Check if required environment variables are available
function checkEnvironmentVariables() {
    const required = [
        'AIRTABLE_PERSONAL_ACCESS_TOKEN',
        'AIRTABLE_BASE_ID',
        'FIREBASE_PROJECT_ID',
        'FIREBASE_CLIENT_EMAIL',
        'FIREBASE_PRIVATE_KEY'
    ];
    
    const missing = required.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
        return {
            success: false,
            missing: missing,
            message: `Missing environment variables: ${missing.join(', ')}`
        };
    }
    
    return { success: true };
}

// Initialize Firebase Admin with error handling
function initializeFirebase() {
    try {
        const admin = require('firebase-admin');
        
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                }),
            });
        }
        
        return { success: true, db: admin.firestore() };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            message: 'Failed to initialize Firebase Admin'
        };
    }
}

// Initialize Airtable with error handling
function initializeAirtable() {
    try {
        const base = new Airtable({ 
            apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN 
        }).base(process.env.AIRTABLE_BASE_ID);
        
        return { success: true, base: base };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            message: 'Failed to initialize Airtable'
        };
    }
}

// Helper function to safely get field value
function getFieldValue(record, fieldName, defaultValue = null) {
    try {
        const value = record.get(fieldName);
        return value !== undefined && value !== null ? value : defaultValue;
    } catch (error) {
        console.log(`Field "${fieldName}" not found, using default value: ${defaultValue}`);
        return defaultValue;
    }
}

// Helper function to create URL-friendly slug
function slugify(text) {
    if (!text) return '';
    return text
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-');
}

exports.handler = async function (event, context) {
    console.log('Starting complete data migration...');
    
    try {
        // Check environment variables
        const envCheck = checkEnvironmentVariables();
        if (!envCheck.success) {
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                },
                body: JSON.stringify({
                    error: 'Environment configuration error',
                    message: envCheck.message,
                    missing: envCheck.missing
                })
            };
        }
        
        // Initialize services
        const firebaseInit = initializeFirebase();
        const airtableInit = initializeAirtable();
        
        if (!firebaseInit.success) {
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                },
                body: JSON.stringify({
                    error: 'Firebase initialization error',
                    message: firebaseInit.message,
                    details: firebaseInit.error
                })
            };
        }
        
        if (!airtableInit.success) {
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                },
                body: JSON.stringify({
                    error: 'Airtable initialization error',
                    message: airtableInit.message,
                    details: airtableInit.error
                })
            };
        }
        
        const db = firebaseInit.db;
        const base = airtableInit.base;
        
        const results = {
            events: { migrated: 0, skipped: 0, errors: 0 },
            venues: { migrated: 0, skipped: 0, errors: 0 },
            details: []
        };
        
        // Migrate Events
        console.log('Starting event migration...');
        try {
            const events = await base('Events').select().all();
            console.log(`Found ${events.length} events in Airtable`);
            
            for (const event of events) {
                try {
                    // Check if event already exists in Firestore
                    const existingQuery = await db.collection('events')
                        .where('airtableId', '==', event.id)
                        .limit(1)
                        .get();
                    
                    if (!existingQuery.empty) {
                        console.log(`Event ${event.id} already exists in Firestore, skipping`);
                        results.events.skipped++;
                        continue;
                    }
                    
                    // Get event data with safe field access
                    const eventData = {
                        airtableId: event.id,
                        name: getFieldValue(event, 'Event Name', 'Untitled Event'),
                        description: getFieldValue(event, 'Description', ''),
                        date: getFieldValue(event, 'Date', ''),
                        status: getFieldValue(event, 'Status', 'pending').toLowerCase(),
                        venueName: getFieldValue(event, 'Venue Name', ''),
                        category: getFieldValue(event, 'Category', []),
                        price: getFieldValue(event, 'Price', ''),
                        link: getFieldValue(event, 'Link', ''),
                        submittedBy: getFieldValue(event, 'Submitter Email', ''),
                        slug: getFieldValue(event, 'Slug', slugify(getFieldValue(event, 'Event Name', 'untitled-event'))),
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                    
                    // Add to Firestore
                    await db.collection('events').add(eventData);
                    console.log(`Migrated event: ${eventData.name}`);
                    results.events.migrated++;
                    results.details.push(`✅ Event: ${eventData.name}`);
                    
                } catch (error) {
                    console.error(`Error migrating event ${event.id}:`, error);
                    results.events.errors++;
                    results.details.push(`❌ Event ${event.id}: ${error.message}`);
                }
            }
        } catch (error) {
            console.error('Error fetching events from Airtable:', error);
            results.details.push(`❌ Events fetch error: ${error.message}`);
        }
        
        // Migrate Venues
        console.log('Starting venue migration...');
        try {
            const venues = await base('Venues').select().all();
            console.log(`Found ${venues.length} venues in Airtable`);
            
            for (const venue of venues) {
                try {
                    // Check if venue already exists in Firestore
                    const existingQuery = await db.collection('venues')
                        .where('airtableId', '==', venue.id)
                        .limit(1)
                        .get();
                    
                    if (!existingQuery.empty) {
                        console.log(`Venue ${venue.id} already exists in Firestore, skipping`);
                        results.venues.skipped++;
                        continue;
                    }
                    
                    // Get venue data with safe field access
                    const venueData = {
                        airtableId: venue.id,
                        name: getFieldValue(venue, 'Name', 'Untitled Venue'),
                        description: getFieldValue(venue, 'Description', ''),
                        address: getFieldValue(venue, 'Address', ''),
                        status: getFieldValue(venue, 'Status', 'pending').toLowerCase(),
                        listingStatus: getFieldValue(venue, 'Listing Status', 'pending').toLowerCase(),
                        contactEmail: getFieldValue(venue, 'Contact Email', ''),
                        website: getFieldValue(venue, 'Website', ''),
                        slug: getFieldValue(venue, 'Slug', slugify(getFieldValue(venue, 'Name', 'untitled-venue'))),
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                    
                    // Add to Firestore
                    await db.collection('venues').add(venueData);
                    console.log(`Migrated venue: ${venueData.name}`);
                    results.venues.migrated++;
                    results.details.push(`✅ Venue: ${venueData.name}`);
                    
                } catch (error) {
                    console.error(`Error migrating venue ${venue.id}:`, error);
                    results.venues.errors++;
                    results.details.push(`❌ Venue ${venue.id}: ${error.message}`);
                }
            }
        } catch (error) {
            console.error('Error fetching venues from Airtable:', error);
            results.details.push(`❌ Venues fetch error: ${error.message}`);
        }
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                success: true,
                message: 'Data migration completed',
                results: results
            })
        };
        
    } catch (error) {
        console.error('Data migration failed:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                error: 'Data migration failed',
                message: error.message,
                type: error.constructor.name
            })
        };
    }
};