const Airtable = require('airtable');
const parser = require('lambda-multipart-parser');

// Check if required environment variables are available
function checkEnvironmentVariables() {
    const required = [
        'AIRTABLE_PERSONAL_ACCESS_TOKEN',
        'AIRTABLE_BASE_ID',
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

// Initialize Cloudinary with error handling
function initializeCloudinary() {
    try {
        const cloudinary = require('cloudinary').v2;
        
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
        });
        
        return { success: true, cloudinary: cloudinary };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            message: 'Failed to initialize Cloudinary'
        };
    }
}

/**
 * Calculate recurring dates using pure JavaScript logic
 */
function calculateRecurringDates(startDate, recurrenceData, monthsAhead = 3) {
    const dates = [];
    const start = new Date(startDate);
    const endDate = new Date(start);
    endDate.setMonth(endDate.getMonth() + monthsAhead);
    
    if (recurrenceData.type === 'weekly') {
        const daysOfWeek = recurrenceData.days || [];
        let currentDate = new Date(start);
        
        while (currentDate <= endDate) {
            if (daysOfWeek.includes(currentDate.getDay())) {
                dates.push(currentDate.toISOString().split('T')[0]);
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
    } else if (recurrenceData.type === 'monthly') {
        if (recurrenceData.monthlyType === 'date') {
            const dayOfMonth = recurrenceData.dayOfMonth;
            let currentDate = new Date(start);
            
            while (currentDate <= endDate) {
                const maxDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
                const actualDay = Math.min(dayOfMonth, maxDay);
                
                const eventDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), actualDay);
                if (eventDate >= start) {
                    dates.push(eventDate.toISOString().split('T')[0]);
                }
                
                currentDate.setMonth(currentDate.getMonth() + 1);
            }
        } else if (recurrenceData.monthlyType === 'day') {
            const week = recurrenceData.week;
            const dayOfWeek = recurrenceData.dayOfWeek;
            let currentDate = new Date(start);
            
            while (currentDate <= endDate) {
                const eventDate = getNthWeekdayOfMonth(currentDate.getFullYear(), currentDate.getMonth(), week, dayOfWeek);
                if (eventDate && eventDate >= start) {
                    dates.push(eventDate.toISOString().split('T')[0]);
                }
                currentDate.setMonth(currentDate.getMonth() + 1);
            }
        }
    }
    
    return dates;
}

function getNthWeekdayOfMonth(year, month, week, dayOfWeek) {
    const date = new Date(year, month, 1);
    
    if (week > 0) {
        let day = date.getDay();
        let diff = (dayOfWeek - day + 7) % 7;
        date.setDate(date.getDate() + diff);
        date.setDate(date.getDate() + (week - 1) * 7);
    } else {
        date.setMonth(date.getMonth() + 1);
        date.setDate(0);
        let day = date.getDay();
        let diff = (dayOfWeek - day + 7) % 7;
        date.setDate(date.getDate() - diff);
    }
    
    if (date.getMonth() !== month) return null;
    return date;
}

function generateSlug(eventName, date) {
    const datePart = new Date(date).toISOString().split('T')[0];
    const namePart = eventName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `${namePart}-${datePart}`;
}

function createNaturalLanguageRule(recurrenceData) {
    if (recurrenceData.type === 'weekly') {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const days = recurrenceData.days.map(day => dayNames[day]).join(', ');
        return `Every ${days}`;
    } else if (recurrenceData.type === 'monthly') {
        if (recurrenceData.monthlyType === 'date') {
            return `Monthly on the ${recurrenceData.dayOfMonth}${getOrdinalSuffix(recurrenceData.dayOfMonth)}`;
        } else {
            const weekNames = { '1': 'First', '2': 'Second', '3': 'Third', '4': 'Fourth', '-1': 'Last' };
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            return `Monthly on the ${weekNames[recurrenceData.week]} ${dayNames[recurrenceData.dayOfWeek]}`;
        }
    }
    return 'Recurring event';
}

function getOrdinalSuffix(day) {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
}

async function uploadImage(file, cloudinary) {
    if (!file) return null;
    
    try {
        const base64String = file.content.toString('base64');
        const dataUri = `data:${file.contentType};base64,${base64String}`;
        
        const result = await cloudinary.uploader.upload(dataUri, {
            folder: 'brumoutloud_events',
            eager: [
                { width: 800, height: 400, crop: 'fill', gravity: 'auto', fetch_format: 'auto', quality: 'auto' }
            ]
        });
        
        return {
            url: result.secure_url,
            publicId: result.public_id,
            mediumUrl: result.eager[0].secure_url
        };
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        throw error;
    }
}

exports.handler = async function (event, context) {
    console.log('Unified event submission handler called');
    
    try {
        // Check environment variables
        const envCheck = checkEnvironmentVariables();
        if (!envCheck.success) {
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
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
        const cloudinaryInit = initializeCloudinary();
        
        if (!firebaseInit.success) {
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Firebase initialization error',
                    message: firebaseInit.message,
                    details: firebaseInit.error
                })
            };
        }
        
        if (!airtableInit.success) {
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Airtable initialization error',
                    message: airtableInit.message,
                    details: airtableInit.error
                })
            };
        }
        
        if (!cloudinaryInit.success) {
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Cloudinary initialization error',
                    message: cloudinaryInit.message,
                    details: cloudinaryInit.error
                })
            };
        }
        
        const db = firebaseInit.db;
        const base = airtableInit.base;
        const cloudinary = cloudinaryInit.cloudinary;
        
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
        
        // Handle image upload
        const imageFile = submission.files.find(f => f.fieldname === 'image');
        const uploadedImage = await uploadImage(imageFile, cloudinary);
        
        // Parse recurring event data if present
        let recurringInfo = null;
        let seriesId = null;
        let eventDates = [submission.date];
        
        if (submission['recurring-type']) {
            const recurrenceData = {
                type: submission['recurring-type'],
                days: submission['recurring-days'] ? submission['recurring-days'].split(',').map(d => parseInt(d)) : [],
                monthlyType: submission['monthly-type'],
                dayOfMonth: submission['day-of-month'] ? parseInt(submission['day-of-month']) : null,
                week: submission['week'],
                dayOfWeek: submission['day-of-week'] ? parseInt(submission['day-of-week']) : null
            };
            
            recurringInfo = createNaturalLanguageRule(recurrenceData);
            seriesId = `series_${Date.now()}`;
            eventDates = calculateRecurringDates(submission.date, recurrenceData);
        }
        
        // Generate slug
        const slug = generateSlug(submission['event-name'], submission.date);
        
        // Prepare event data for both Airtable and Firestore
        const eventData = {
            // Core fields
            'Event Name': submission['event-name'],
            'Slug': slug,
            'Description': submission.description,
            'Date': submission.date,
            'Status': 'Pending Review',
            'Venue Name': submission['venue-name'],
            'VenueText': submission['venue-text'],
            'Category': submission.category ? submission.category.split(',') : [],
            'Price': submission.price || '',
            'Age Restriction': submission['age-restriction'] || '',
            'Link': submission.link,
            'Submitter Email': submission.email,
            
            // Recurring event fields
            'Recurring Info': recurringInfo,
            'Series ID': seriesId,
            
            // Image fields
            'Cloudinary Public ID': uploadedImage ? uploadedImage.publicId : null,
            'Promo Image': uploadedImage ? uploadedImage.url : null,
            
            // Timestamps
            'Created Time': new Date().toISOString(),
            'Last Modified Time': new Date().toISOString()
        };
        
        // Submit to Airtable
        console.log('Submitting to Airtable...');
        const airtableRecord = await base('Events').create([{ fields: eventData }]);
        const airtableId = airtableRecord[0].id;
        
        // Prepare Firestore data
        const firestoreData = {
            airtableId: airtableId,
            name: eventData['Event Name'],
            slug: eventData['Slug'],
            description: eventData['Description'],
            date: eventData['Date'],
            status: 'pending',
            venueName: eventData['Venue Name'] || eventData['VenueText'],
            category: eventData['Category'],
            price: eventData['Price'] || '',
            ageRestriction: eventData['Age Restriction'] || '',
            link: eventData['Link'],
            recurringInfo: eventData['Recurring Info'],
            seriesId: eventData['Series ID'],
            cloudinaryPublicId: eventData['Cloudinary Public ID'],
            promoImage: eventData['Promo Image'],
            submittedBy: eventData['Submitter Email'],
            submittedAt: eventData['Created Time'],
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        // Submit to Firestore
        console.log('Submitting to Firestore...');
        const firestoreDoc = await db.collection('events').add(firestoreData);
        
        console.log(`Event submitted successfully. Airtable ID: ${airtableId}, Firestore ID: ${firestoreDoc.id}`);
        
        // Handle recurring events
        if (eventDates.length > 1) {
            console.log(`Creating ${eventDates.length - 1} additional recurring event instances...`);
            
            for (let i = 1; i < eventDates.length; i++) {
                const instanceData = {
                    ...eventData,
                    'Date': eventDates[i],
                    'Slug': generateSlug(eventData['Event Name'], eventDates[i]),
                    'Series ID': seriesId
                };
                
                // Create Airtable instance
                const instanceRecord = await base('Events').create([{ fields: instanceData }]);
                
                // Create Firestore instance
                const firestoreInstanceData = {
                    ...firestoreData,
                    airtableId: instanceRecord[0].id,
                    date: eventDates[i],
                    slug: generateSlug(eventData['Event Name'], eventDates[i]),
                    seriesId: seriesId
                };
                
                await db.collection('events').add(firestoreInstanceData);
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
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                    .success { color: #10B981; }
                    .info { color: #6B7280; }
                </style>
            </head>
            <body>
                <h1 class="success">Event Submitted Successfully!</h1>
                <p>Your event "${submission['event-name']}" has been submitted for review.</p>
                <p class="info">You will be redirected to the events page shortly.</p>
                <p class="info">Airtable ID: ${airtableId}</p>
                <p class="info">Firestore ID: ${firestoreDoc.id}</p>
            </body>
            </html>`
        };
        
    } catch (error) {
        console.error('Error in unified event submission:', error);
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