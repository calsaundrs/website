const Airtable = require('airtable');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
try {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
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

exports.handler = async function (event, context) {
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ 
                success: false, 
                message: 'Method Not Allowed. Use GET to test setup.' 
            })
        };
    }
    
    const results = {
        success: true,
        timestamp: new Date().toISOString(),
        environment: {},
        connections: {},
        data: {}
    };
    
    try {
        console.log('=== Testing Migration Setup ===');
        
        // Test Environment Variables
        console.log('Testing environment variables...');
        const requiredEnvVars = [
            'AIRTABLE_PERSONAL_ACCESS_TOKEN',
            'AIRTABLE_BASE_ID',
            'FIREBASE_PROJECT_ID',
            'FIREBASE_CLIENT_EMAIL',
            'FIREBASE_PRIVATE_KEY'
        ];
        
        results.environment = {};
        for (const envVar of requiredEnvVars) {
            const value = process.env[envVar];
            results.environment[envVar] = {
                present: !!value,
                length: value ? value.length : 0,
                preview: value ? `${value.substring(0, 10)}...` : 'not set'
            };
            
            if (!value) {
                results.success = false;
                console.error(`Missing environment variable: ${envVar}`);
            }
        }
        
        // Test Airtable Connection
        console.log('Testing Airtable connection...');
        try {
            const venuesTable = base('Venues');
            const venueCount = await venuesTable.select({ maxRecords: 1 }).firstPage();
            results.connections.airtable = {
                success: true,
                message: 'Connected successfully',
                sampleCount: venueCount.length
            };
            console.log('Airtable connection successful');
        } catch (error) {
            results.connections.airtable = {
                success: false,
                message: error.message
            };
            results.success = false;
            console.error('Airtable connection failed:', error);
        }
        
        // Test Firestore Connection
        console.log('Testing Firestore connection...');
        try {
            const testCollection = db.collection('_test_migration');
            await testCollection.doc('test').set({ 
                test: true, 
                timestamp: new Date().toISOString() 
            });
            await testCollection.doc('test').delete();
            results.connections.firestore = {
                success: true,
                message: 'Connected successfully'
            };
            console.log('Firestore connection successful');
        } catch (error) {
            results.connections.firestore = {
                success: false,
                message: error.message
            };
            results.success = false;
            console.error('Firestore connection failed:', error);
        }
        
        // Test Data Access
        console.log('Testing data access...');
        try {
            // Test Venues table
            const venuesTable = base('Venues');
            const venues = await venuesTable.select({ maxRecords: 5 }).firstPage();
            results.data.venues = {
                accessible: true,
                count: venues.length,
                sampleFields: venues.length > 0 ? Object.keys(venues[0].fields) : []
            };
            
            // Test Events table
            const eventsTable = base('Events');
            const events = await eventsTable.select({ maxRecords: 5 }).firstPage();
            results.data.events = {
                accessible: true,
                count: events.length,
                sampleFields: events.length > 0 ? Object.keys(events[0].fields) : []
            };
            
            // Test System Notifications table
            try {
                const notificationsTable = base('System Notifications');
                const notifications = await notificationsTable.select({ maxRecords: 5 }).firstPage();
                results.data.systemNotifications = {
                    accessible: true,
                    count: notifications.length,
                    sampleFields: notifications.length > 0 ? Object.keys(notifications[0].fields) : []
                };
            } catch (error) {
                results.data.systemNotifications = {
                    accessible: false,
                    error: error.message
                };
            }
            
            console.log('Data access test completed');
        } catch (error) {
            results.data = {
                error: error.message
            };
            results.success = false;
            console.error('Data access test failed:', error);
        }
        
        // Test Firestore Collections
        console.log('Testing Firestore collections...');
        try {
            const collections = ['venues', 'events', 'systemNotifications'];
            results.data.firestoreCollections = {};
            
            for (const collectionName of collections) {
                try {
                    const collection = db.collection(collectionName);
                    const snapshot = await collection.limit(1).get();
                    results.data.firestoreCollections[collectionName] = {
                        accessible: true,
                        exists: !snapshot.empty,
                        count: snapshot.size
                    };
                } catch (error) {
                    results.data.firestoreCollections[collectionName] = {
                        accessible: false,
                        error: error.message
                    };
                }
            }
        } catch (error) {
            console.error('Firestore collections test failed:', error);
        }
        
        console.log('=== Setup Test Complete ===');
        
        return {
            statusCode: 200,
            body: JSON.stringify(results, null, 2)
        };
        
    } catch (error) {
        console.error('Setup test failed:', error);
        
        results.success = false;
        results.error = error.message;
        
        return {
            statusCode: 500,
            body: JSON.stringify(results, null, 2)
        };
    }
};