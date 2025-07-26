const Airtable = require('airtable');

exports.handler = async function (event, context) {
    console.log('Starting complete data migration...');
    
    try {
        // Check environment variables
        const required = [
            'AIRTABLE_PERSONAL_ACCESS_TOKEN',
            'AIRTABLE_BASE_ID',
            'FIREBASE_PROJECT_ID',
            'FIREBASE_CLIENT_EMAIL',
            'FIREBASE_PRIVATE_KEY'
        ];
        
        const missing = required.filter(varName => !process.env[varName]);
        if (missing.length > 0) {
            console.error('Missing environment variables:', missing);
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
        let db;
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
            db = admin.firestore();
            console.log('Firebase initialized successfully');
        } catch (error) {
            console.error('Firebase initialization failed:', error);
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Firebase initialization error',
                    message: error.message
                })
            };
        }
        
        // Initialize Airtable
        let base;
        try {
            base = new Airtable({ 
                apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN 
            }).base(process.env.AIRTABLE_BASE_ID);
            console.log('Airtable initialized successfully');
        } catch (error) {
            console.error('Airtable initialization failed:', error);
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Airtable initialization error',
                    message: error.message
                })
            };
        }
        
        const results = {
            events: { migrated: 0, skipped: 0, errors: 0 },
            venues: { migrated: 0, skipped: 0, errors: 0 },
            details: []
        };
        
        // Helper function to safely get field value
        function getFieldValue(record, fieldName, defaultValue = '') {
            try {
                const value = record.get(fieldName);
                return value !== undefined && value !== null ? value : defaultValue;
            } catch (error) {
                console.log(`Field "${fieldName}" not found, using default: ${defaultValue}`);
                return defaultValue;
            }
        }
        
        // Helper function to create slug
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
        
        console.log('Migration completed successfully');
        console.log('Results:', JSON.stringify(results, null, 2));
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Data migration completed successfully',
                results: results
            })
        };
        
    } catch (error) {
        console.error('Migration failed with error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Migration failed',
                message: error.message,
                stack: error.stack
            })
        };
    }
};