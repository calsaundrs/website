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

exports.handler = async function (event, context) {
    console.log('Starting comprehensive data migration audit...');
    
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
        
        // Initialize Firebase
        const firebaseInit = initializeFirebase();
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
        
        // Initialize Airtable
        const airtableInit = initializeAirtable();
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
        
        // Run audit
        const auditResults = {
            events: await auditEvents(base, db),
            venues: await auditVenues(base, db),
            pendingItems: await auditPendingItems(base, db),
            summary: {}
        };
        
        // Generate summary
        auditResults.summary = {
            totalAirtableEvents: auditResults.events.airtableCount,
            totalFirestoreEvents: auditResults.events.firestoreCount,
            missingEvents: auditResults.events.missingInFirestore.length,
            totalAirtableVenues: auditResults.venues.airtableCount,
            totalFirestoreVenues: auditResults.venues.firestoreCount,
            missingVenues: auditResults.venues.missingInFirestore.length,
            totalPendingItems: auditResults.pendingItems.totalCount,
            issuesFound: auditResults.events.missingInFirestore.length + 
                        auditResults.venues.missingInFirestore.length +
                        auditResults.events.dataInconsistencies.length +
                        auditResults.venues.dataInconsistencies.length
        };
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify(auditResults)
        };
        
    } catch (error) {
        console.error('Audit failed:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                error: 'Audit failed',
                message: error.message,
                stack: error.stack,
                type: error.constructor.name
            })
        };
    }
};

async function auditEvents(base, db) {
    console.log('Auditing events...');
    
    try {
        // Get all Airtable events
        const airtableEvents = await base('Events').select({
            fields: [
                'Event Name', 'Slug', 'Description', 'Date', 'Status', 'Venue Name',
                'VenueText', 'Category', 'Price', 'Age Restriction', 'Link',
                'Recurring Info', 'Series ID', 'Cloudinary Public ID', 'Promo Image',
                'Submitter Email', 'Created Time', 'Last Modified Time'
            ]
        }).all();
        
        console.log(`Found ${airtableEvents.length} events in Airtable`);
        
        // Get all Firestore events
        const firestoreSnapshot = await db.collection('events').get();
        const firestoreEvents = firestoreSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        console.log(`Found ${firestoreEvents.length} events in Firestore`);
        
        // Find missing events in Firestore
        const missingInFirestore = [];
        const dataInconsistencies = [];
        
        for (const airtableEvent of airtableEvents) {
            const airtableId = airtableEvent.id;
            const firestoreEvent = firestoreEvents.find(e => e.airtableId === airtableId);
            
            if (!firestoreEvent) {
                missingInFirestore.push({
                    airtableId: airtableId,
                    name: airtableEvent.fields['Event Name'],
                    status: airtableEvent.fields['Status'],
                    date: airtableEvent.fields['Date']
                });
            } else {
                // Check for data inconsistencies
                const inconsistencies = checkEventDataConsistency(airtableEvent.fields, firestoreEvent);
                if (inconsistencies.length > 0) {
                    dataInconsistencies.push({
                        airtableId: airtableId,
                        name: airtableEvent.fields['Event Name'],
                        inconsistencies: inconsistencies
                    });
                }
            }
        }
        
        return {
            airtableCount: airtableEvents.length,
            firestoreCount: firestoreEvents.length,
            missingInFirestore: missingInFirestore,
            dataInconsistencies: dataInconsistencies
        };
    } catch (error) {
        console.error('Error auditing events:', error);
        return {
            airtableCount: 0,
            firestoreCount: 0,
            missingInFirestore: [],
            dataInconsistencies: [],
            error: error.message
        };
    }
}

async function auditVenues(base, db) {
    console.log('Auditing venues...');
    
    try {
        // Get all Airtable venues
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
        
        console.log(`Found ${airtableVenues.length} venues in Airtable`);
        
        // Get all Firestore venues
        const firestoreSnapshot = await db.collection('venues').get();
        const firestoreVenues = firestoreSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        console.log(`Found ${firestoreVenues.length} venues in Firestore`);
        
        // Find missing venues in Firestore
        const missingInFirestore = [];
        const dataInconsistencies = [];
        
        for (const airtableVenue of airtableVenues) {
            const airtableId = airtableVenue.id;
            const firestoreVenue = firestoreVenues.find(v => v.airtableId === airtableId);
            
            if (!firestoreVenue) {
                missingInFirestore.push({
                    airtableId: airtableId,
                    name: airtableVenue.fields['Name'],
                    status: airtableVenue.fields['Status']
                });
            } else {
                // Check for data inconsistencies
                const inconsistencies = checkVenueDataConsistency(airtableVenue.fields, firestoreVenue);
                if (inconsistencies.length > 0) {
                    dataInconsistencies.push({
                        airtableId: airtableId,
                        name: airtableVenue.fields['Name'],
                        inconsistencies: inconsistencies
                    });
                }
            }
        }
        
        return {
            airtableCount: airtableVenues.length,
            firestoreCount: firestoreVenues.length,
            missingInFirestore: missingInFirestore,
            dataInconsistencies: dataInconsistencies
        };
    } catch (error) {
        console.error('Error auditing venues:', error);
        return {
            airtableCount: 0,
            firestoreCount: 0,
            missingInFirestore: [],
            dataInconsistencies: [],
            error: error.message
        };
    }
}

async function auditPendingItems(base, db) {
    console.log('Auditing pending items...');
    
    try {
        // Get pending events from Airtable
        const pendingAirtableEvents = await base('Events').select({
            filterByFormula: "{Status} = 'Pending Review'",
            fields: ['Event Name', 'Status', 'Created Time']
        }).all();
        
        // Get pending venues from Airtable
        const pendingAirtableVenues = await base('Venues').select({
            filterByFormula: "{Status} = 'Pending Review'",
            fields: ['Name', 'Status', 'Created Time']
        }).all();
        
        // Get pending items from Firestore
        const pendingFirestoreEvents = await db.collection('events')
            .where('status', '==', 'pending')
            .get();
        
        const pendingFirestoreVenues = await db.collection('venues')
            .where('status', '==', 'pending')
            .get();
        
        return {
            totalCount: pendingAirtableEvents.length + pendingAirtableVenues.length,
            airtableEvents: pendingAirtableEvents.length,
            airtableVenues: pendingAirtableVenues.length,
            firestoreEvents: pendingFirestoreEvents.size,
            firestoreVenues: pendingFirestoreVenues.size
        };
    } catch (error) {
        console.error('Error auditing pending items:', error);
        return {
            totalCount: 0,
            airtableEvents: 0,
            airtableVenues: 0,
            firestoreEvents: 0,
            firestoreVenues: 0,
            error: error.message
        };
    }
}

function checkEventDataConsistency(airtableFields, firestoreData) {
    const inconsistencies = [];
    
    // Check key fields
    const fieldMappings = {
        'Event Name': 'name',
        'Description': 'description',
        'Date': 'date',
        'Status': 'status',
        'Venue Name': 'venueName',
        'Category': 'category',
        'Price': 'price',
        'Link': 'link',
        'Slug': 'slug'
    };
    
    for (const [airtableField, firestoreField] of Object.entries(fieldMappings)) {
        const airtableValue = airtableFields[airtableField];
        const firestoreValue = firestoreData[firestoreField];
        
        if (airtableValue !== firestoreValue) {
            inconsistencies.push({
                field: airtableField,
                airtableValue: airtableValue,
                firestoreValue: firestoreValue
            });
        }
    }
    
    return inconsistencies;
}

function checkVenueDataConsistency(airtableFields, firestoreData) {
    const inconsistencies = [];
    
    // Check key fields
    const fieldMappings = {
        'Name': 'name',
        'Description': 'description',
        'Address': 'address',
        'Status': 'status',
        'Website': 'website',
        'Slug': 'slug'
    };
    
    for (const [airtableField, firestoreField] of Object.entries(fieldMappings)) {
        const airtableValue = airtableFields[airtableField];
        const firestoreValue = firestoreData[firestoreField];
        
        if (airtableValue !== firestoreValue) {
            inconsistencies.push({
                field: airtableField,
                airtableValue: airtableValue,
                firestoreValue: firestoreValue
            });
        }
    }
    
    return inconsistencies;
}