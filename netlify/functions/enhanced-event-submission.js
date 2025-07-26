const Airtable = require('airtable');
const parser = require('lambda-multipart-parser');

exports.handler = async function (event, context) {
    console.log('Enhanced event submission handler called');
    
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
        const db = admin.firestore();
        
        // Initialize Airtable
        const base = new Airtable({ 
            apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN 
        }).base(process.env.AIRTABLE_BASE_ID);
        
        // Parse form data
        let submission;
        try {
            submission = await parser.parse(event);
        } catch (error) {
            console.error('Error parsing form data:', error);
            return { 
                statusCode: 400, 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Error processing form data' })
            };
        }
        
        console.log('Parsed submission:', submission);
        
        // Generate slug
        function generateSlug(eventName, date) {
            const datePart = new Date(date).toISOString().split('T')[0];
            const namePart = eventName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            return `${namePart}-${datePart}`;
        }
        
        const slug = generateSlug(submission['event-name'], submission.date);
        
        // Prepare enhanced event data for Airtable (adding more fields gradually)
        const eventData = {
            // Core fields (we know these work)
            'Event Name': submission['event-name'] || 'Untitled Event',
            'Date': new Date(`${submission.date}T${submission['start-time'] || '00:00'}`).toISOString(),
            'Description': submission.description || '',
            'Status': 'Pending Review',
            'Submitter Email': submission.email || null,
            'Slug': slug,
            
            // Additional fields to test
            'Link': submission.link || '',
            'Category': submission.category ? submission.category.split(',') : []
        };
        
        console.log('Attempting to create event in Airtable with data:', eventData);
        
        // Submit to Airtable
        const airtableRecord = await base('Events').create([{ fields: eventData }]);
        const airtableId = airtableRecord[0].id;
        
        console.log('Successfully created Airtable record with ID:', airtableId);
        
        // Prepare Firestore data
        const firestoreData = {
            airtableId: airtableId,
            name: eventData['Event Name'],
            slug: eventData['Slug'],
            description: eventData['Description'],
            date: eventData['Date'],
            status: 'pending',
            venueName: submission['venue-text'] || submission['venue-name'] || '',
            category: eventData['Category'],
            link: eventData['Link'],
            submittedBy: eventData['Submitter Email'],
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        // Submit to Firestore
        const firestoreDoc = await db.collection('events').add(firestoreData);
        
        console.log(`Event submitted successfully. Airtable ID: ${airtableId}, Firestore ID: ${firestoreDoc.id}`);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Enhanced event submitted successfully',
                airtableId: airtableId,
                firestoreId: firestoreDoc.id,
                fieldsUsed: Object.keys(eventData)
            })
        };
        
    } catch (error) {
        console.error('Enhanced event submission failed:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Event submission failed',
                message: error.message,
                type: error.constructor.name
            })
        };
    }
};