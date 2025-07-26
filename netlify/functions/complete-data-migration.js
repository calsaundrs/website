const Airtable = require('airtable');
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
    });
}

const db = admin.firestore();
const base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);

exports.handler = async function (event, context) {
    console.log('Starting complete data migration from Airtable to Firestore...');
    
    try {
        const migrationResults = {
            events: await migrateEvents(),
            venues: await migrateVenues(),
            summary: {}
        };
        
        // Generate summary
        migrationResults.summary = {
            eventsMigrated: migrationResults.events.migrated,
            eventsSkipped: migrationResults.events.skipped,
            eventsErrors: migrationResults.events.errors,
            venuesMigrated: migrationResults.venues.migrated,
            venuesSkipped: migrationResults.venues.skipped,
            venuesErrors: migrationResults.venues.errors,
            totalMigrated: migrationResults.events.migrated + migrationResults.venues.migrated,
            totalErrors: migrationResults.events.errors + migrationResults.venues.errors
        };
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify(migrationResults)
        };
        
    } catch (error) {
        console.error('Migration failed:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                error: 'Migration failed',
                message: error.message,
                stack: error.stack
            })
        };
    }
};

async function migrateEvents() {
    console.log('Migrating events...');
    
    // Get all events from Airtable
    const airtableEvents = await base('Events').select({
        fields: [
            'Event Name', 'Slug', 'Description', 'Date', 'Status', 'Venue Name',
            'VenueText', 'Category', 'Price', 'Age Restriction', 'Link',
            'Recurring Info', 'Series ID', 'Cloudinary Public ID', 'Promo Image',
            'Submitter Email', 'Created Time', 'Last Modified Time', 'Venue',
            'Venue Slug', 'Venue Address', 'Ticket Link', 'Promotion'
        ]
    }).all();
    
    console.log(`Found ${airtableEvents.length} events to migrate`);
    
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const airtableEvent of airtableEvents) {
        try {
            const airtableId = airtableEvent.id;
            
            // Check if event already exists in Firestore
            const existingDoc = await db.collection('events').where('airtableId', '==', airtableId).limit(1).get();
            
            if (!existingDoc.empty) {
                console.log(`Event ${airtableEvent.fields['Event Name']} already exists in Firestore, skipping...`);
                skipped++;
                continue;
            }
            
            // Transform Airtable data to Firestore format
            const firestoreData = transformEventData(airtableEvent.fields, airtableId);
            
            // Add to Firestore
            await db.collection('events').add(firestoreData);
            
            console.log(`Migrated event: ${airtableEvent.fields['Event Name']}`);
            migrated++;
            
        } catch (error) {
            console.error(`Error migrating event ${airtableEvent.fields['Event Name']}:`, error);
            errors++;
        }
    }
    
    return { migrated, skipped, errors };
}

async function migrateVenues() {
    console.log('Migrating venues...');
    
    // Get all venues from Airtable
    const airtableVenues = await base('Venues').select({
        fields: [
            'Name', 'Description', 'Slug', 'Address', 'Opening Hours',
            'Accessibility', 'Website', 'Instagram', 'Facebook', 'TikTok',
            'Contact Email', 'Contact Phone', 'Status', 'Listing Status',
            'Photo URL', 'Photo Medium URL', 'Photo Thumbnail URL',
            'Vibe Tags', 'Venue Features', 'Accessibility Features',
            'Google Rating', 'Number of Reviews', 'Created Time', 'Last Modified Time'
        ]
    }).all();
    
    console.log(`Found ${airtableVenues.length} venues to migrate`);
    
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const airtableVenue of airtableVenues) {
        try {
            const airtableId = airtableVenue.id;
            
            // Check if venue already exists in Firestore
            const existingDoc = await db.collection('venues').where('airtableId', '==', airtableId).limit(1).get();
            
            if (!existingDoc.empty) {
                console.log(`Venue ${airtableVenue.fields['Name']} already exists in Firestore, skipping...`);
                skipped++;
                continue;
            }
            
            // Transform Airtable data to Firestore format
            const firestoreData = transformVenueData(airtableVenue.fields, airtableId);
            
            // Add to Firestore
            await db.collection('venues').add(firestoreData);
            
            console.log(`Migrated venue: ${airtableVenue.fields['Name']}`);
            migrated++;
            
        } catch (error) {
            console.error(`Error migrating venue ${airtableVenue.fields['Name']}:`, error);
            errors++;
        }
    }
    
    return { migrated, skipped, errors };
}

function transformEventData(airtableFields, airtableId) {
    // Map Airtable fields to Firestore fields
    const firestoreData = {
        // Core fields
        airtableId: airtableId,
        name: airtableFields['Event Name'],
        slug: airtableFields['Slug'],
        description: airtableFields['Description'],
        date: airtableFields['Date'],
        status: airtableFields['Status']?.toLowerCase() || 'pending',
        
        // Venue information
        venueName: airtableFields['Venue Name'] || airtableFields['VenueText'],
        venueSlug: airtableFields['Venue Slug'],
        venueAddress: airtableFields['Venue Address'],
        
        // Event details
        category: airtableFields['Category'] || [],
        price: airtableFields['Price'],
        ageRestriction: airtableFields['Age Restriction'],
        link: airtableFields['Link'],
        ticketLink: airtableFields['Ticket Link'],
        
        // Recurring event information
        recurringInfo: airtableFields['Recurring Info'],
        seriesId: airtableFields['Series ID'],
        
        // Image information
        cloudinaryPublicId: airtableFields['Cloudinary Public ID'],
        promoImage: airtableFields['Promo Image'],
        
        // Submission information
        submittedBy: airtableFields['Submitter Email'],
        submittedAt: airtableFields['Created Time'],
        
        // Timestamps
        createdAt: airtableFields['Created Time'] ? new Date(airtableFields['Created Time']) : new Date(),
        updatedAt: airtableFields['Last Modified Time'] ? new Date(airtableFields['Last Modified Time']) : new Date(),
        
        // Promotion data
        promotion: airtableFields['Promotion'] || {}
    };
    
    // Handle venue object if it exists
    if (airtableFields['Venue'] && Array.isArray(airtableFields['Venue'])) {
        firestoreData.venue = {
            id: airtableFields['Venue'][0],
            name: airtableFields['Venue Name'],
            slug: airtableFields['Venue Slug'],
            address: airtableFields['Venue Address']
        };
    }
    
    // Clean up undefined values
    Object.keys(firestoreData).forEach(key => {
        if (firestoreData[key] === undefined) {
            delete firestoreData[key];
        }
    });
    
    return firestoreData;
}

function transformVenueData(airtableFields, airtableId) {
    // Map Airtable fields to Firestore fields
    const firestoreData = {
        // Core fields
        airtableId: airtableId,
        name: airtableFields['Name'],
        slug: airtableFields['Slug'],
        description: airtableFields['Description'],
        address: airtableFields['Address'],
        status: airtableFields['Status']?.toLowerCase() || 'pending',
        listingStatus: airtableFields['Listing Status']?.toLowerCase() || 'listed',
        
        // Contact information
        website: airtableFields['Website'],
        instagram: airtableFields['Instagram'],
        facebook: airtableFields['Facebook'],
        tiktok: airtableFields['TikTok'],
        contactEmail: airtableFields['Contact Email'],
        contactPhone: airtableFields['Contact Phone'],
        
        // Venue details
        openingHours: airtableFields['Opening Hours'],
        accessibility: airtableFields['Accessibility'],
        vibeTags: airtableFields['Vibe Tags'] || [],
        venueFeatures: airtableFields['Venue Features'] || [],
        accessibilityFeatures: airtableFields['Accessibility Features'] || [],
        
        // Image information
        photoUrl: airtableFields['Photo URL'],
        photoMediumUrl: airtableFields['Photo Medium URL'],
        photoThumbnailUrl: airtableFields['Photo Thumbnail URL'],
        
        // Google information
        googleRating: airtableFields['Google Rating'],
        numberOfReviews: airtableFields['Number of Reviews'],
        
        // Timestamps
        createdAt: airtableFields['Created Time'] ? new Date(airtableFields['Created Time']) : new Date(),
        updatedAt: airtableFields['Last Modified Time'] ? new Date(airtableFields['Last Modified Time']) : new Date()
    };
    
    // Clean up undefined values
    Object.keys(firestoreData).forEach(key => {
        if (firestoreData[key] === undefined) {
            delete firestoreData[key];
        }
    });
    
    return firestoreData;
}