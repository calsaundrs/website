const admin = require('firebase-admin');
const cloudinary = require('cloudinary').v2;
const RecurringEventsManager = require('./services/recurring-events-manager');
const multipart = require('lambda-multipart-parser');

exports.handler = async function (event, context) {
    console.log('Firestore-only event submission called');
    
    try {
        // Check environment variables
        const required = [
            'FIREBASE_PROJECT_ID',
            'FIREBASE_CLIENT_EMAIL',
            'FIREBASE_PRIVATE_KEY',
            'CLOUDINARY_CLOUD_NAME',
            'CLOUDINARY_API_KEY',
            'CLOUDINARY_API_SECRET'
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
        
        // Initialize Cloudinary
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
        });
        
        // Parse form data
        let submission = {};
        let imageBuffer = null;
        let imageFileName = null;
        let imageContentType = null;
        
        try {
            const headers = event.headers || {};
            const contentType = (headers['content-type'] || headers['Content-Type'] || '').toLowerCase();
            
            if (contentType.includes('multipart/form-data')) {
                const parsed = await multipart.parse(event);
                const { files = [], ...fields } = parsed || {};
                submission = fields || {};
                
                const imageFile = files.find(f => f.fieldname === 'image' || f.name === 'image') || files[0];
                if (imageFile && imageFile.content && imageFile.content.length) {
                    imageBuffer = Buffer.from(imageFile.content);
                    imageFileName = imageFile.filename || imageFile.fileName || 'upload.jpg';
                    imageContentType = imageFile.contentType || 'image/jpeg';
                }
            } else if (contentType.includes('application/x-www-form-urlencoded')) {
                const rawBody = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
                const params = new URLSearchParams(rawBody);
                for (const [key, value] of params) {
                    submission[key] = value;
                }
            } else if (contentType.includes('application/json')) {
                const rawBody = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '{}');
                submission = JSON.parse(rawBody || '{}');
            } else {
                // Fallback: try urlencoded
                const rawBody = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
                const params = new URLSearchParams(rawBody);
                for (const [key, value] of params) {
                    submission[key] = value;
                }
            }
            
            console.log('Form data parsed successfully');
            console.log('Fields received:', Object.keys(submission));
            console.log('Image file:', imageFileName ? { name: imageFileName, size: imageBuffer?.length } : 'No image');
            
        } catch (parseError) {
            console.error('Error parsing form data:', parseError);
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Failed to parse form data',
                    message: parseError.message
                })
            };
        }
        
        // Handle image upload
        console.log('Processing image upload...');
        let uploadedImage = null;
        
        if (imageBuffer && imageFileName) {
            try {
                // Convert buffer to base64 string for Cloudinary
                const base64Image = imageBuffer.toString('base64');
                const dataURI = `data:${imageContentType};base64,${base64Image}`;
                
                const result = await cloudinary.uploader.upload(dataURI, {
                    folder: 'events',
                    transformation: [
                        { width: 800, height: 400, crop: 'fill', gravity: 'auto' },
                        { quality: 'auto', fetch_format: 'auto' }
                    ]
                });
                
                uploadedImage = {
                    publicId: result.public_id,
                    url: result.secure_url,
                    original: result.secure_url
                };
                console.log('Image uploaded successfully:', uploadedImage.publicId);
                
            } catch (uploadError) {
                console.error('Image upload failed:', uploadError);
                // Continue without image
            }
        }
        
        // Generate slug and validate required fields
        const eventName = submission['event-name'] || submission.name || '';
        const dateStr = submission.date || '';
        const startTimeStr = submission['start-time'] || '00:00';
        const venueIdSubmitted = submission['venue-id'] || submission.venueId || submission['venueId'] || null;
        
        if (!eventName) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Validation error', message: 'Missing event name' })
            };
        }
        if (!dateStr) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Validation error', message: 'Missing event date' })
            };
        }
        
        const constructedDate = new Date(`${dateStr}T${startTimeStr}`);
        if (isNaN(constructedDate.getTime())) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Validation error', message: 'Invalid date or time' })
            };
        }
        const eventDateIso = constructedDate.toISOString();
        const slug = generateSlug(eventName, dateStr);
        
        // Handle venue linking
        let venueData = {
            venueId: null,
            venueName: '',
            venueAddress: '',
            venueSlug: ''
        };
        
        if (venueIdSubmitted && venueIdSubmitted !== 'new') {
            // Existing venue selected
            try {
                const venueDoc = await db.collection('venues').doc(venueIdSubmitted).get();
                if (venueDoc.exists) {
                    const venue = venueDoc.data();
                    venueData = {
                        venueId: venueIdSubmitted,
                        venueName: venue.name || venue['Name'] || '',
                        venueAddress: venue.address || venue['Address'] || '',
                        venueSlug: venue.slug || ''
                    };
                } else {
                    console.warn(`Venue ID ${venueIdSubmitted} not found, falling back to text input`);
                    venueData.venueName = submission['venue-name'] || '';
                }
            } catch (venueError) {
                console.error('Error fetching venue:', venueError);
                venueData.venueName = submission['venue-name'] || '';
            }
        } else if (submission['new-venue-name']) {
            // New venue being created
            venueData.venueName = submission['new-venue-name'];
            venueData.venueAddress = submission['new-venue-address'] || '';
            
            // Create new venue record
            const newVenueData = {
                name: submission['new-venue-name'],
                address: submission['new-venue-address'] || '',
                postcode: submission['new-venue-postcode'] || '',
                website: submission['new-venue-website'] || '',
                slug: generateVenueSlug(submission['new-venue-name']),
                status: 'pending',
                submittedBy: submission.email || 'anonymous@brumoutloud.co.uk',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            const newVenueRef = await db.collection('venues').add(newVenueData);
            venueData.venueId = newVenueRef.id;
            venueData.venueSlug = newVenueData.slug;
            
            console.log(`New venue created with ID: ${newVenueRef.id}`);
        } else {
            // Fallback to text input
            venueData.venueName = submission['venue-name'] || '';
        }
        
        // Prepare Firestore data
        const firestoreData = {
            // Core Fields (Standardized)
            name: submission['event-name'] || 'Untitled Event',
            slug: slug,
            description: submission.description || '',
            date: eventDateIso,
            status: 'pending',
            
            // Venue Fields (Standardized)
            venueId: venueData.venueId,
            venueName: venueData.venueName,
            venueAddress: venueData.venueAddress,
            venueSlug: venueData.venueSlug,
            
            // Categorization (Standardized)
            category: submission.category ? submission.category.split(',').map(cat => cat.trim()) : (Array.isArray(submission.categoryIds) ? submission.categoryIds : []),
            
            // Links (Standardized)
            link: submission.link || '',
            
            // Media Fields (Standardized)
            cloudinaryPublicId: uploadedImage ? uploadedImage.publicId : null,
            promoImage: uploadedImage ? uploadedImage.url : null,
            
            // Metadata (Standardized)
            submittedBy: submission.email || submission['contact-email'] || 'anonymous@brumoutloud.co.uk',
            submitterEmail: submission['contact-email'] || submission.email || '',
            createdAt: new Date(),
            submittedAt: new Date(),
            approvedBy: null,
            approvedAt: null,
            
            // Additional Fields
            startTime: submission['start-time'] || '00:00',
            endTime: submission['end-time'] || '23:59',
            price: submission.price || '',
            ageRestriction: submission['age-restriction'] || '',
            featured: submission.featured === 'true',
            
            // Recurring Event Fields
            isRecurring: submission['is-recurring'] === 'true',
            recurringPattern: submission['recurring-pattern'] || null,
            recurringStartDate: submission['recurring-start-date'] || null,
            recurringEndDate: submission['recurring-end-date'] || null,
            maxInstances: submission['max-instances'] ? parseInt(submission['max-instances']) : null,
            customRecurrenceDesc: submission['custom-recurrence-desc'] || null
        };
        
        // Handle recurring events
        if (firestoreData.isRecurring && firestoreData.recurringPattern) {
            const recurringManager = new RecurringEventsManager(db);
            const recurringResult = await recurringManager.createRecurringSeries(firestoreData);
            
            if (recurringResult.success) {
                console.log('Recurring event series created successfully');
                firestoreData.recurringGroupId = recurringResult.groupId;
                firestoreData.recurringInstance = 1;
                firestoreData.totalInstances = recurringResult.totalInstances;
            } else {
                console.error('Failed to create recurring series:', recurringResult.error);
                // Continue with single event
            }
        }
        
        // Save to Firestore
        const firestoreDoc = await db.collection('events').add(firestoreData);
        console.log('Event saved to Firestore with ID:', firestoreDoc.id);
        
        // Trigger SSG rebuild if in production
        let ssgRebuildResult = null;
        if (process.env.NODE_ENV === 'production' && process.env.NETLIFY_BUILD_HOOK) {
            try {
                const response = await fetch(process.env.NETLIFY_BUILD_HOOK, { method: 'POST' });
                if (response.ok) {
                    ssgRebuildResult = { success: true, message: 'Build hook triggered successfully.' };
                } else {
                    ssgRebuildResult = { success: false, message: `Failed to trigger build hook: ${response.status} ${response.statusText}` };
                }
            } catch (error) {
                ssgRebuildResult = { success: false, message: error.message };
            }
        }
        
        // Return success response as JSON for client script
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                id: firestoreDoc.id,
                slug,
                ssg: ssgRebuildResult || null
            })
        };
        
    } catch (error) {
        console.error('Error in Firestore-only event submission:', error);
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

function generateSlug(eventName, date) {
    const safeName = String(eventName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const d = new Date(date);
    const datePart = isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0];
    return `${safeName}-${datePart}`;
}

function generateVenueSlug(venueName) {
    return venueName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}