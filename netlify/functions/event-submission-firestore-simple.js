const admin = require('firebase-admin');
const { sendTemplatedEmail } = require('./services/email-service');

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
        console.log('🏢 EVENT SUBMISSION: Venue ID:', submission.venueId);
        
        // Generate slug
        const slug = generateSlug(submission['event-name'], submission.date);
        
        // Prepare Firestore data (no Cloudinary dependency)
        const eventDate = submission.date || new Date().toISOString().split('T')[0];
        const eventTime = submission['start-time'] || '00:00';
        
        // Validate and create date
        let eventDateTime;
        try {
            // Create date in UK timezone (Europe/London)
            // Since this is a UK site, all times should be treated as UK time
            const constructedDate = new Date(`${eventDate}T${eventTime}:00`);
            
            // Debug: Log the timezone information
            console.log('⏰ EVENT SUBMISSION: Date construction debug:', {
                eventDate,
                eventTime,
                constructedDate: constructedDate.toString(),
                constructedDateISO: constructedDate.toISOString(),
                timezoneOffset: constructedDate.getTimezoneOffset(),
                isDST: constructedDate.getTimezoneOffset() < new Date(constructedDate.getFullYear(), 0, 1).getTimezoneOffset()
            });
            
            // For UK events, we want to preserve the time as entered
            // The server runs in UTC, but we want to store the time as if it's UK time
            // We'll create a proper UK timezone date
            const ukDate = new Date(`${eventDate}T${eventTime}:00+00:00`); // Treat as GMT/UTC
            eventDateTime = ukDate.toISOString();
            
            console.log('⏰ EVENT SUBMISSION: UK timezone fix:', {
                originalTime: `${eventDate}T${eventTime}:00`,
                ukDate: ukDate.toString(),
                finalISO: eventDateTime
            });
            
        } catch (dateError) {
            console.error('Date parsing error:', dateError);
            // Fallback to current date/time
            eventDateTime = new Date().toISOString();
        }
        
        // Get venue name from venue ID
        let venueName = '';
        if (submission.venueId && submission.venueId !== 'new') {
            try {
                console.log('🏢 EVENT SUBMISSION: Looking up venue name for ID:', submission.venueId);
                const venueDoc = await db.collection('venues').doc(submission.venueId).get();
                if (venueDoc.exists) {
                    const venueData = venueDoc.data();
                    venueName = venueData.name || venueData['Venue Name'] || 'Unknown Venue';
                    console.log('🏢 EVENT SUBMISSION: Found venue name:', venueName);
                } else {
                    console.log('🏢 EVENT SUBMISSION: Venue not found, using ID as name');
                    venueName = submission.venueId;
                }
            } catch (venueError) {
                console.error('🏢 EVENT SUBMISSION: Error looking up venue:', venueError);
                venueName = submission.venueId || 'Unknown Venue';
            }
        } else if (submission['new-venue-name']) {
            venueName = submission['new-venue-name'];
            console.log('🏢 EVENT SUBMISSION: Using new venue name:', venueName);
        }
        
        const firestoreData = {
            name: submission['event-name'] || 'Untitled Event',
            slug: slug,
            description: submission.description || '',
            date: eventDateTime, // Keep for backward compatibility and sorting
            eventDate: eventDate, // Separate date field
            eventTime: eventTime, // Separate time field
            status: 'pending',
            venueName: venueName,
            category: submission.categoryIds ? [submission.categoryIds] : [],
            link: submission.link || '',
            recurringInfo: submission.recurrence || '',
            seriesId: `series_${Date.now()}`,
            cloudinaryPublicId: null,
            promoImage: null,
            submittedBy: submission['contact-email'] || 'anonymous@brumoutloud.co.uk',
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

        // Send confirmation emails
        const fromEmail = process.env.FROM_EMAIL || 'noreply@email.brumoutloud.co.uk';
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@brumoutloud.co.uk';

        // 1. Send submission confirmation to the user
        if (firestoreData.submittedBy && firestoreData.submittedBy !== 'anonymous@brumoutloud.co.uk') {
            await sendTemplatedEmail({
                to: firestoreData.submittedBy,
                from: fromEmail,
                subject: 'Your event submission has been received!',
                templateName: 'submission-confirmation',
                data: {
                    eventName: firestoreData.name,
                },
            });
        }

        // 2. Send notification to admin
        await sendTemplatedEmail({
            to: adminEmail,
            from: fromEmail,
            subject: `New Event Submission: ${firestoreData.name}`,
            templateName: 'admin-submission-notification',
            data: {
                eventName: firestoreData.name,
                venueName: firestoreData.venueName,
                eventDate: firestoreData.eventDate,
                submittedBy: firestoreData.submittedBy,
            },
        });
        
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