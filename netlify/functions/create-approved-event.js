const Airtable = require('airtable');
const { formidable } = require('formidable');
const cloudinary = require('cloudinary').v2;
const stream = require('stream');
const fetch = require('node-fetch');

const AIRTABLE_PERSONAL_ACCESS_TOKEN = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const base = new Airtable({ apiKey: AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(AIRTABLE_BASE_ID);

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

function parseMultipartForm(event) {
    return new Promise((resolve, reject) => {
        const req = new stream.PassThrough();
        if (event.isBase64Encoded) {
            req.end(Buffer.from(event.body, 'base64'));
        } else {
            req.end(event.body);
        }
        req.headers = event.headers;
        req.method = event.httpMethod;

        const form = formidable({
            multiples: true, // Allow multiple files for a single field
            keepExtensions: true,
            allowEmptyFiles: true,
            minFileSize: 0,
            maxFileSize: 5 * 1024 * 1024 // 5 MB limit
        });

        form.parse(req, (err, fields, files) => {
            if (err) {
                return reject(err);
            }
            // formidable wraps field values in arrays, let's simplify that
            const processedFields = {};
            for (const key in fields) {
                // If the key is 'events' and it's an array, keep it as an array
                if (key === 'events' && Array.isArray(fields[key])) {
                    processedFields[key] = fields[key];
                } else {
                    // Otherwise, take the first element (for single value fields)
                    processedFields[key] = fields[key][0];
                }
            }
            resolve({ fields: processedFields, files });
        });
    });
}


async function getDatesFromAI(startDate, recurrenceData, modelName) {
    let recurrenceRule = "";
    if (recurrenceData.type === 'weekly') {
        recurrenceRule = `the event repeats weekly`;
        if (recurrenceData.days && recurrenceData.days.length > 0) {
            const dayNames = recurrenceData.days.map(day => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day]);
            recurrenceRule += ` on ${dayNames.join(', ')}`;
        }
    } else if (recurrenceData.type === 'monthly') {
        if (recurrenceData.monthlyType === 'date') {
            recurrenceRule = `the event repeats monthly on day ${recurrenceData.dayOfMonth}`;
        } else if (recurrenceData.monthlyType === 'day') {
            const week = { '1': 'First', '2': 'Second', '3': 'Third', '4': 'Fourth', '-1': 'Last' }[recurrenceData.week];
            const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][recurrenceData.dayOfWeek];
            recurrenceRule = `the event repeats monthly on the ${week} ${dayOfWeek}`;
        }
    }

    const prompt = `Based on a start date of ${startDate}, and the rule that "${recurrenceRule}", provide a comma-separated list of all dates for the next 3 months in format YYYY-MM-DD, INCLUDING the start date if it matches the rule. IMPORTANT: Only return the comma-separated list of dates and nothing else.`;
    
    console.log(`[getDatesFromAI] AI PROMPT: "${prompt}"`);

    const payload = { contents: [{ parts: [{ text: prompt }] }] };
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        const errorBody = await response.text();
        console.error("AI API Error Response:", errorBody);
        throw new Error(`AI API call failed with status: ${response.status}`);
    }
    const data = await response.json();
    const datesText = data.candidates[0].content.parts[0].text.trim();
    return datesText.split(',').map(d => d.trim());
}

function generateSlug(name, date) {
    const datePart = new Date(date).toISOString().split('T')[0];
    const namePart = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `${namePart}-${datePart}`;
}

function createNaturalLanguageRule(recurrenceData) {
    if (!recurrenceData || recurrenceData.type === 'none') {
        return '';
    }

    if (recurrenceData.type === 'weekly') {
        const days = recurrenceData.days.map(day => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day]);
        return `Weekly on ${days.join(', ')}`;
    }

    if (recurrenceData.type === 'monthly') {
        if (recurrenceData.monthlyType === 'date') {
            return `Monthly on day ${recurrenceData.dayOfMonth}`;
        }
        if (recurrenceData.monthlyType === 'day') {
            const week = { '1': 'First', '2': 'Second', '3': 'Third', '4': 'Fourth', '-1': 'Last' }[recurrenceData.week];
            const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][recurrenceData.dayOfWeek];
            return `Monthly on the ${week} ${dayOfWeek}`;
        }
    }

    return '';
}

exports.handler = async function (event, context) {
    const geminiModel = 'gemini-1.5-flash';
    
    try {
        const { fields, files } = await parseMultipartForm(event);
        console.log('Raw fields object from formidable:', fields);
        console.log('Fields.events object:', fields.events);
        const { events } = fields;
        const promoImageFile = files['promo-image'] ? files['promo-image'][0] : null;

        if (!events || !Array.isArray(events) || events.length === 0) {
            return {
                statusCode: 400,
                body: JSON.stringify({ success: false, message: "No events data provided." }),
            };
        }

        let cloudinaryUrl = null;
        if (promoImageFile && promoImageFile.size > 0) {
            try {
                const uploadResult = await cloudinary.uploader.upload(promoImageFile.filepath, {
                    folder: "brumoutloud_events",
                    resource_type: "image"
                });
                cloudinaryUrl = uploadResult.secure_url;
            } catch (e) {
                console.error("Error uploading image to Cloudinary:", e);
                return {
                    statusCode: 500,
                    body: JSON.stringify({ success: false, message: "Failed to upload image." }),
                };
            }
        }

        const allRecordsToCreate = [];

        for (const eventData of events) {
            const { 
                name,
                date,
                time,
                venueId,
                description,
                link,
                categories, // Use 'categories' from eventData
                parentEventName, // Capture parentEventName
                'recurring-info': recurringInfoJson
            } = eventData;

            let recurrenceData = null;
            if (recurringInfoJson) {
                try {
                    recurrenceData = JSON.parse(recurringInfoJson);
                } catch (e) {
                    console.error("Error parsing recurring-info JSON for event:", name, e);
                    // Continue processing other events even if one has bad recurrence data
                }
            }

            let datesToCreate = [];
            if (recurrenceData && recurrenceData.type && recurrenceData.type !== 'none' && date) {
                datesToCreate = await getDatesFromAI(date, recurrenceData, geminiModel);
            } else if (date) {
                datesToCreate.push(date);
            } else {
                console.warn("Event skipped due to missing date:", eventData);
                continue; // Skip this event if date is missing
            }

            let currentSeriesId = null; // Series ID for the current recurring event group

            for (let i = 0; i < datesToCreate.length; i++) {
                const d = datesToCreate[i];
                const recordFields = {
                    'Event Name': name,
                    'Description': description,
                    'Date': `${d}T${time || '00:00'}:00.000Z`,
                    'Status': 'Pending Approval',
                    'Link': link,
                    'Slug': generateSlug(name, d)
                };

                if (parentEventName) { // Add Parent Event Name if present
                    recordFields['Parent Event Name'] = parentEventName;
                }

                if (recurrenceData && recurrenceData.type !== 'none') {
                    recordFields["Recurring JSON"] = JSON.stringify(recurrenceData);
                    recordFields["Recurring Info"] = createNaturalLanguageRule(recurrenceData);
                }

                if (venueId) recordFields['Venue'] = [venueId];
                if (cloudinaryUrl) recordFields['Promo Image'] = [{ url: cloudinaryUrl }];
                if (categories && categories.length > 0) { // Use 'categories'
                    recordFields['Category'] = categories;
                }

                if (i === 0 && datesToCreate.length > 1) { // Only for the first instance of a recurring series
                    // Create the first record to get its ID for Series ID
                    const createdRecord = await base('Events').create([{ fields: recordFields }]);
                    currentSeriesId = createdRecord[0].id;
                    recordFields['Series ID'] = currentSeriesId; // Add Series ID to the first record's fields
                    allRecordsToCreate.push({ fields: recordFields }); // Add the modified first record
                } else if (datesToCreate.length > 1) { // For subsequent instances of a recurring series
                    recordFields['Series ID'] = currentSeriesId;
                    allRecordsToCreate.push({ fields: recordFields });
                } else { // Single event
                    allRecordsToCreate.push({ fields: recordFields });
                }
            }
        }

        // Now, create all records in chunks
        const chunkSize = 10;
        for (let i = 0; i < allRecordsToCreate.length; i += chunkSize) {
            await base('Events').create(allRecordsToCreate.slice(i, i + chunkSize));
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: `Successfully processed ${allRecordsToCreate.length} event(s).` }),
        };

    } catch (error) {
        console.error("Error creating approved event(s):", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, message: error.toString() }),
        };
    }
};
