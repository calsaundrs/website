const admin = require('firebase-admin');
const cloudinary = require('cloudinary').v2;

exports.handler = async function (event, context) {
    console.log('Firestore-only event submission called');
    
    try {
        // Check environment variables (no Airtable needed)
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
        
        // Parse form data manually (no formidable dependency)
        let fields = {};
        let files = {};
        
        if (event.body) {
            // Handle multipart form data
            const boundary = event.headers['content-type']?.split('boundary=')[1];
            if (boundary) {
                const parts = event.body.split(`--${boundary}`);
                for (const part of parts) {
                    if (part.includes('Content-Disposition: form-data')) {
                        const nameMatch = part.match(/name="([^"]+)"/);
                        if (nameMatch) {
                            const fieldName = nameMatch[1];
                            const valueMatch = part.match(/\r?\n\r?\n([\s\S]*?)(?=\r?\n--|$)/);
                            if (valueMatch) {
                                fields[fieldName] = valueMatch[1].trim();
                            }
                        }
                    }
                }
            } else {
                // Handle URL-encoded form data
                const params = new URLSearchParams(event.body);
                for (const [key, value] of params) {
                    fields[key] = value;
                }
            }
        }
        
        const submission = { ...fields, files: Object.values(files) };
        console.log('Parsed submission:', Object.keys(submission));
        
        // Handle image upload
        const imageFile = submission.files.find(f => f.fieldname === 'image');
        let uploadedImage = null;
        
        if (imageFile && imageFile.size > 0) {
            try {
                const result = await cloudinary.uploader.upload(imageFile.filepath, {
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
        
        // Generate slug
        const slug = generateSlug(submission['event-name'], submission.date);
        
        // Handle venue linking
        let venueData = {
            venueId: null,
            venueName: '',
            venueAddress: '',
            venueSlug: ''
        };
        
        if (submission['venue-id'] && submission['venue-id'] !== 'new') {
            // Existing venue selected
            try {
                const venueDoc = await db.collection('venues').doc(submission['venue-id']).get();
                if (venueDoc.exists) {
                    const venue = venueDoc.data();
                    venueData = {
                        venueId: submission['venue-id'],
                        venueName: venue.name || venue['Name'] || '',
                        venueAddress: venue.address || venue['Address'] || '',
                        venueSlug: venue.slug || ''
                    };
                } else {
                    console.warn(`Venue ID ${submission['venue-id']} not found, falling back to text input`);
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
        
        // Prepare Firestore data (no Airtable dependency)
        const firestoreData = {
            // Core Fields (Standardized)
            name: submission['event-name'] || 'Untitled Event',
            slug: slug,
            description: submission.description || '',
            date: new Date(`${submission.date}T${submission['start-time'] || '00:00'}`).toISOString(),
            status: 'pending',
            
            // Venue Fields (Standardized)
            venueId: venueData.venueId,
            venueName: venueData.venueName,
            venueAddress: venueData.venueAddress,
            venueSlug: venueData.venueSlug,
            
            // Categorization (Standardized)
            category: submission.category ? submission.category.split(',').map(cat => cat.trim()) : [],
            
            // Links (Standardized)
            link: submission.link || '',
            
            // Media Fields (Standardized)
            cloudinaryPublicId: uploadedImage ? uploadedImage.publicId : null,
            promoImage: uploadedImage ? uploadedImage.url : null,
            
            // Recurring Event Fields (Standardized)
            isRecurring: submission.recurrence ? true : false,
            recurringInfo: submission.recurrence || null,
            recurringPattern: null, // Will be set by series manager if needed
            seriesId: null, // Will be set by series manager if needed
            recurringGroupId: null, // Will be set by series manager if needed
            
            // Metadata (Standardized)
            submittedBy: submission.email || 'anonymous@brumoutloud.co.uk',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        // Handle recurring events
        if (submission['is-recurring'] === 'on' || submission['is-recurring'] === 'true') {
            // This is a recurring event
            const recurringData = {
                isRecurring: true,
                recurringPattern: submission['recurrence-pattern'] || null,
                recurringStartDate: submission['recurrence-start-date'] || submission.date,
                recurringEndDate: submission['recurrence-end-date'] || null,
                maxInstances: parseInt(submission['max-instances']) || 52,
                customRecurrenceDesc: submission['custom-recurrence-desc'] || null,
                recurringInfo: submission['custom-recurrence-desc'] || submission['recurrence-pattern'] || 'Recurring event'
            };
            
            // Merge recurring data
            Object.assign(firestoreData, recurringData);
            
            // Generate recurring event instances
            let instances;
            if (recurringData.recurringPattern === 'custom' && recurringData.customRecurrenceDesc) {
                // Use enhanced custom recurrence parser
                instances = await generateCustomRecurringInstances(recurringData);
            } else {
                // Use standard pattern generation
                instances = generateRecurringInstances(recurringData);
            }
            
            // Create all instances in a batch
            const batch = db.batch();
            const createdEvents = [];
            
            instances.forEach((instance, index) => {
                const eventRef = db.collection('events').doc();
                const instanceData = {
                    ...firestoreData,
                    date: instance.toISOString(),
                    slug: `${slug}-${index + 1}`,
                    recurringInstance: index + 1,
                    totalInstances: instances.length,
                    recurringGroupId: `group_${Date.now()}`,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                
                batch.set(eventRef, instanceData);
                createdEvents.push({
                    id: eventRef.id,
                    date: instance.toISOString(),
                    slug: `${slug}-${index + 1}`
                });
            });
            
            await batch.commit();
            
            console.log(`Created ${instances.length} recurring event instances`);
            
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'text/html',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
                },
                body: `<!DOCTYPE html>
                <html>
                <head>
                    <title>Recurring Events Submitted Successfully</title>
                    <meta http-equiv="refresh" content="5;url=/events.html">
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #1f2937; color: white; }
                        .success { color: #10B981; }
                        .info { color: #9CA3AF; }
                        .highlight { color: #E83A99; }
                    </style>
                </head>
                <body>
                    <h1 class="success">Recurring Events Created Successfully!</h1>
                    <p>Your recurring event "${submission['event-name']}" has been created with <span class="highlight">${instances.length} instances</span>.</p>
                    <p class="info">Pattern: ${recurringData.recurringPattern === 'custom' ? recurringData.customRecurrenceDesc : recurringData.recurringPattern}</p>
                    <p class="info">All events have been submitted for review.</p>
                    <p class="info">You will be redirected to the events page shortly.</p>
                    <p class="info">Note: This submission was processed using Firestore only.</p>
                </body>
                </html>`
            };
        } else {
            // Single event submission
            console.log('Submitting single event to Firestore...');
            const firestoreDoc = await db.collection('events').add(firestoreData);
            
            console.log(`Event submitted successfully. Firestore ID: ${firestoreDoc.id}`);
            
            // Trigger SSG rebuild for new event (if auto-approval is enabled)
            let ssgRebuildResult = null;
            if (process.env.AUTO_APPROVE_EVENTS === 'true') {
                try {
                    console.log('Auto-approval enabled - triggering SSG rebuild...');
                    
                    // Call the SSG rebuild function
                    const response = await fetch(`${process.env.URL || 'https://new.brumoutloud.co.uk'}/.netlify/functions/build-events-ssg`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            action: 'rebuild',
                            source: 'event-submission',
                            eventId: firestoreDoc.id
                        })
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        ssgRebuildResult = {
                            success: true,
                            generatedFiles: result.generatedFiles || 0,
                            message: 'SSG rebuild triggered successfully'
                        };
                        console.log('SSG rebuild completed:', result);
                    } else {
                        console.warn('SSG rebuild failed:', response.status, response.statusText);
                        ssgRebuildResult = {
                            success: false,
                            message: 'SSG rebuild failed'
                        };
                    }
                } catch (ssgError) {
                    console.error('Error triggering SSG rebuild:', ssgError);
                    ssgRebuildResult = {
                        success: false,
                        message: 'SSG rebuild error: ' + ssgError.message
                    };
                }
            }
            
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'text/html' },
                body: `<!DOCTYPE html>
                <html>
                <head>
                    <title>Event Submitted Successfully</title>
                    <meta http-equiv="refresh" content="3;url=/events.html">
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #1f2937; color: white; }
                        .success { color: #10B981; }
                        .info { color: #9CA3AF; }
                    </style>
                </head>
                <body>
                    <h1 class="success">Event Submitted Successfully!</h1>
                    <p>Your event "${submission['event-name']}" has been submitted for review.</p>
                    <p class="info">You will be redirected to the events page shortly.</p>
                    <p class="info">Firestore ID: ${firestoreDoc.id}</p>
                    <p class="info">Note: This submission was processed using Firestore only.</p>
                    ${ssgRebuildResult ? `<p class="info">SSG Rebuild: ${ssgRebuildResult.message}</p>` : ''}
                </body>
                </html>`
            };
        }
        
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
    const datePart = new Date(date).toISOString().split('T')[0];
    const namePart = eventName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `${namePart}-${datePart}`;
}

function generateVenueSlug(venueName) {
    return venueName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function generateRecurringInstances(eventData) {
    const startDate = new Date(eventData.recurringStartDate);
    const endDate = eventData.recurringEndDate ? new Date(eventData.recurringEndDate) : null;
    const pattern = eventData.recurringPattern;
    const maxInstances = eventData.maxInstances || 52;
    
    const instances = [];
    let current = new Date(startDate);
    let count = 0;
    
    while (count < maxInstances) {
        if (endDate && current > endDate) {
            break;
        }
        
        instances.push(new Date(current));
        count++;
        
        switch (pattern) {
            case 'weekly':
                current.setDate(current.getDate() + 7);
                break;
            case 'bi-weekly':
                current.setDate(current.getDate() + 14);
                break;
            case 'monthly':
                current.setMonth(current.getMonth() + 1);
                break;
            case 'yearly':
                current.setFullYear(current.getFullYear() + 1);
                break;
            default:
                // For custom patterns, assume weekly as fallback
                current.setDate(current.getDate() + 7);
        }
    }
    
    return instances;
}

async function generateCustomRecurringInstances(eventData) {
    try {
        // Call the custom recurrence parser
        const response = await fetch(`${process.env.NETLIFY_FUNCTIONS_URL || 'http://localhost:8888'}/.netlify/functions/custom-recurrence-parser`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                description: eventData.customRecurrenceDesc,
                startDate: eventData.recurringStartDate,
                endDate: eventData.recurringEndDate,
                maxInstances: eventData.maxInstances
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to parse custom recurrence');
        }
        
        const data = await response.json();
        
        if (data.success) {
            return data.instances.map(dateStr => new Date(dateStr));
        } else {
            throw new Error(data.message || 'Failed to parse custom recurrence');
        }
    } catch (error) {
        console.error('Error generating custom recurring instances:', error);
        // Fallback to weekly pattern
        return generateRecurringInstances({
            ...eventData,
            recurringPattern: 'weekly'
        });
    }
}