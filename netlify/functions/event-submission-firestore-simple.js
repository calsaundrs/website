const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('🚀 EVENT SUBMISSION: Function called');
    console.log('📋 EVENT SUBMISSION: HTTP Method:', event.httpMethod);
    console.log('📋 EVENT SUBMISSION: Content-Type:', event.headers['content-type']);
    console.log('📋 EVENT SUBMISSION: Body length:', event.body ? event.body.length : 0);
    
    try {
        // Check environment variables (no Cloudinary needed)
        const required = [
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
        
        // Parse form data manually (no formidable dependency)
        let fields = {};
        
        if (event.body) {
            console.log('🔍 EVENT SUBMISSION: Raw body length:', event.body.length);
            console.log('🔍 EVENT SUBMISSION: Content-Type:', event.headers['content-type']);
            
            // Check if body is base64 encoded
            let decodedBody = event.body;
            if (event.isBase64Encoded) {
                console.log('🔍 EVENT SUBMISSION: Body is base64 encoded, decoding...');
                decodedBody = Buffer.from(event.body, 'base64').toString('utf8');
                console.log('🔍 EVENT SUBMISSION: Decoded body length:', decodedBody.length);
            }
            
            // Handle multipart form data
            const contentType = event.headers['content-type'] || '';
            const boundaryMatch = contentType.match(/boundary=([^;]+)/);
            
            if (boundaryMatch) {
                const boundary = boundaryMatch[1];
                console.log('🔍 EVENT SUBMISSION: Found boundary:', boundary);
                
                // Split by boundary
                const parts = decodedBody.split(`--${boundary}`);
                console.log('🔍 EVENT SUBMISSION: Number of parts:', parts.length);
                
                for (let i = 0; i < parts.length; i++) {
                    const part = parts[i];
                    if (part.trim() === '' || part.includes('--')) continue;
                    
                    console.log(`🔍 EVENT SUBMISSION: Processing part ${i}:`, part.substring(0, 200) + '...');
                    
                    // Extract field name
                    const nameMatch = part.match(/name="([^"]+)"/);
                    if (nameMatch) {
                        const fieldName = nameMatch[1];
                        console.log(`🔍 EVENT SUBMISSION: Found field name: ${fieldName}`);
                        
                        // Extract field value (everything after the double newline)
                        const valueMatch = part.match(/\r?\n\r?\n([\s\S]*?)(?=\r?\n--|$)/);
                        if (valueMatch) {
                            const fieldValue = valueMatch[1].trim();
                            fields[fieldName] = fieldValue;
                            console.log(`🔍 EVENT SUBMISSION: Parsed field ${fieldName}:`, fieldValue);
                        } else {
                            console.log(`🔍 EVENT SUBMISSION: No value found for field ${fieldName}`);
                        }
                    } else {
                        console.log(`🔍 EVENT SUBMISSION: No name found in part ${i}`);
                    }
                }
            } else {
                console.log('🔍 EVENT SUBMISSION: No boundary found, trying URL-encoded');
                // Handle URL-encoded form data
                const params = new URLSearchParams(decodedBody);
                for (const [key, value] of params) {
                    fields[key] = value;
                    console.log(`🔍 EVENT SUBMISSION: Parsed field ${key}:`, value);
                }
            }
        }
        
        console.log('🔍 EVENT SUBMISSION: Parsed fields:', JSON.stringify(fields, null, 2));
        
        const submission = fields;
        console.log('🔑 EVENT SUBMISSION: Submission keys:', Object.keys(submission));
        console.log('📅 EVENT SUBMISSION: Event date:', submission.date);
        console.log('⏰ EVENT SUBMISSION: Event time:', submission['start-time']);
        console.log('🏢 EVENT SUBMISSION: Venue name:', submission['venue-name']);
        
        // Generate slug
        const slug = generateSlug(submission['event-name'], submission.date);
        
        // Prepare Firestore data (no Cloudinary dependency)
        const eventDate = submission.date || new Date().toISOString().split('T')[0];
        const eventTime = submission['start-time'] || '00:00';
        
        // Validate and create date
        let eventDateTime;
        try {
            eventDateTime = new Date(`${eventDate}T${eventTime}`).toISOString();
        } catch (dateError) {
            console.error('Date parsing error:', dateError);
            // Fallback to current date/time
            eventDateTime = new Date().toISOString();
        }
        
        const firestoreData = {
            name: submission['event-name'] || 'Untitled Event',
            slug: slug,
            description: submission.description || '',
            date: eventDateTime,
            status: 'pending',
            venueName: submission['venue-name'] || '',
            category: submission.category ? submission.category.split(',').map(cat => cat.trim()) : [],
            link: submission.link || '',
            recurringInfo: submission['recurring-info'] || '',
            seriesId: submission['series-id'] || `series_${Date.now()}`,
            cloudinaryPublicId: null,
            promoImage: null,
            submittedBy: submission.email || 'anonymous@brumoutloud.co.uk',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        console.log('📊 EVENT SUBMISSION: Firestore data to submit:', JSON.stringify(firestoreData, null, 2));
        
        // Submit to Firestore only
        console.log('🔥 EVENT SUBMISSION: Submitting to Firestore...');
        const firestoreDoc = await db.collection('events').add(firestoreData);
        
        console.log('✅ EVENT SUBMISSION: Event submitted successfully!');
        console.log('🆔 EVENT SUBMISSION: Firestore ID:', firestoreDoc.id);
        console.log('📝 EVENT SUBMISSION: Event name:', firestoreData.name);
        console.log('📅 EVENT SUBMISSION: Event date:', firestoreData.date);
        console.log('🏷️ EVENT SUBMISSION: Status:', firestoreData.status);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Event submitted successfully',
                firestoreId: firestoreDoc.id,
                eventName: firestoreData.name,
                venueName: firestoreData.venueName,
                status: firestoreData.status
            })
        };
        
    } catch (error) {
        console.error('❌ EVENT SUBMISSION: Error in simple Firestore-only event submission:', error);
        console.error('❌ EVENT SUBMISSION: Error message:', error.message);
        console.error('❌ EVENT SUBMISSION: Error stack:', error.stack);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Event submission failed',
                message: error.message,
                type: error.constructor.name,
                stack: error.stack
            })
        };
    }
};

function generateSlug(eventName, date) {
    let datePart;
    try {
        datePart = new Date(date).toISOString().split('T')[0];
    } catch (error) {
        datePart = new Date().toISOString().split('T')[0];
    }
    const namePart = (eventName || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `${namePart}-${datePart}`;
}