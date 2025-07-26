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
    console.log('Starting diagnostic check...');
    
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
        
        const diagnostics = {
            environment: {
                status: 'OK',
                variables: envCheck
            },
            firebase: firebaseInit,
            airtable: airtableInit,
            data: {}
        };
        
        // Test Airtable access
        if (airtableInit.success) {
            try {
                console.log('Testing Airtable Events table...');
                const eventsResult = await airtableInit.base('Events').select({
                    fields: ['Event Name', 'Status'],
                    maxRecords: 5
                }).all();
                
                console.log('Testing Airtable Venues table...');
                const venuesResult = await airtableInit.base('Venues').select({
                    fields: ['Name', 'Status'],
                    maxRecords: 5
                }).all();
                
                diagnostics.data.airtable = {
                    events: {
                        count: eventsResult.length,
                        sample: eventsResult.map(record => ({
                            id: record.id,
                            name: record.fields['Event Name'],
                            status: record.fields['Status']
                        }))
                    },
                    venues: {
                        count: venuesResult.length,
                        sample: venuesResult.map(record => ({
                            id: record.id,
                            name: record.fields['Name'],
                            status: record.fields['Status']
                        }))
                    }
                };
            } catch (error) {
                diagnostics.data.airtable = {
                    error: error.message,
                    type: error.constructor.name
                };
            }
        }
        
        // Test Firestore access
        if (firebaseInit.success) {
            try {
                console.log('Testing Firestore events collection...');
                const eventsSnapshot = await firebaseInit.db.collection('events').limit(5).get();
                
                console.log('Testing Firestore venues collection...');
                const venuesSnapshot = await firebaseInit.db.collection('venues').limit(5).get();
                
                diagnostics.data.firestore = {
                    events: {
                        count: eventsSnapshot.size,
                        sample: eventsSnapshot.docs.map(doc => ({
                            id: doc.id,
                            name: doc.data().name || doc.data()['Event Name'],
                            status: doc.data().status || doc.data()['Status']
                        }))
                    },
                    venues: {
                        count: venuesSnapshot.size,
                        sample: venuesSnapshot.docs.map(doc => ({
                            id: doc.id,
                            name: doc.data().name || doc.data()['Name'],
                            status: doc.data().status || doc.data()['Status']
                        }))
                    }
                };
            } catch (error) {
                diagnostics.data.firestore = {
                    error: error.message,
                    type: error.constructor.name
                };
            }
        }
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify(diagnostics)
        };
        
    } catch (error) {
        console.error('Diagnostic check failed:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                error: 'Diagnostic check failed',
                message: error.message,
                stack: error.stack,
                type: error.constructor.name
            })
        };
    }
};