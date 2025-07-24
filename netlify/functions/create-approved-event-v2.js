const Airtable = require('airtable');
const { formidable } = require('formidable');
const cloudinary = require('cloudinary').v2;
const stream = require('stream');
const fetch = require('node-fetch');
const EventService = require('./services/event-service');
const SeriesManager = require('./services/series-manager');
const SlugGenerator = require('./utils/slug-generator');

const eventService = new EventService();
const seriesManager = new SeriesManager();
const slugGenerator = new SlugGenerator();

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
            multiples: true,
            keepExtensions: true,
            allowEmptyFiles: true,
            minFileSize: 0,
            maxFileSize: 5 * 1024 * 1024 // 5 MB limit
        });

        form.parse(req, (err, fields, files) => {
            if (err) {
                return reject(err);
            }
            const processedFields = {};
            for (const key in fields) {
                if (key === 'events' && Array.isArray(fields[key])) {
                    processedFields[key] = fields[key];
                } else {
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
        
        const { events } = fields;
        const promoImageFile = files['promo-image'] ? files['promo-image'][0] : null;

        if (!events || !Array.isArray(events) || events.length === 0) {
            return {
                statusCode: 400,
                body: JSON.stringify({ success: false, message: "No events data provided." }),
            };
        }

        // Upload image if provided
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

        const createdEvents = [];

        for (const eventData of events) {
            const { 
                name,
                date,
                time,
                venueId,
                description,
                link,
                categories,
                parentEventName,
                'recurring-info': recurringInfoJson
            } = eventData;

            // Validate required fields
            if (!name || !date) {
                console.warn("Event skipped due to missing required fields:", eventData);
                continue;
            }

            let recurrenceData = null;
            if (recurringInfoJson) {
                try {
                    recurrenceData = JSON.parse(recurringInfoJson);
                } catch (e) {
                    console.error("Error parsing recurring-info JSON for event:", name, e);
                    continue;
                }
            }

            // Determine if this is a recurring event
            const isRecurring = recurrenceData && recurrenceData.type && recurrenceData.type !== 'none';

            if (isRecurring) {
                // Handle recurring event using SeriesManager
                try {
                    const datesToCreate = await getDatesFromAI(date, recurrenceData, geminiModel);
                    
                    // Create series using SeriesManager
                    const seriesData = {
                        name: name,
                        pattern: createNaturalLanguageRule(recurrenceData),
                        recurrence: recurrenceData,
                        description: description,
                        venue: venueId,
                        category: categories
                    };

                    const series = await seriesManager.createSeries(seriesData);
                    
                    // Generate instances for the series
                    const instances = await seriesManager.generateInstances(series.id, datesToCreate.length);
                    
                    // Update instances with additional data
                    for (let i = 0; i < instances.length; i++) {
                        const instance = instances[i];
                        const instanceDate = datesToCreate[i];
                        
                        await seriesManager.updateSeriesEvent(instance.id, {
                            'Date': `${instanceDate}T${time || '00:00'}:00.000Z`,
                            'Link': link,
                            'Promo Image': cloudinaryUrl ? [{ url: cloudinaryUrl }] : undefined,
                            'Parent Event Name': parentEventName
                        });
                    }
                    
                    createdEvents.push(...instances.map(instance => ({
                        id: instance.id,
                        name: instance.fields['Event Name'],
                        date: instance.fields['Date'],
                        series: true
                    })));
                    
                } catch (error) {
                    console.error("Error creating recurring event series:", error);
                    // Fall back to single event creation
                    const singleEvent = await createSingleEvent(eventData, cloudinaryUrl, parentEventName);
                    if (singleEvent) createdEvents.push(singleEvent);
                }
            } else {
                // Handle single event
                const singleEvent = await createSingleEvent(eventData, cloudinaryUrl, parentEventName);
                if (singleEvent) createdEvents.push(singleEvent);
            }
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({ 
                success: true, 
                message: `Successfully processed ${createdEvents.length} event(s).`,
                events: createdEvents
            }),
        };

    } catch (error) {
        console.error("Error creating approved event(s):", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, message: error.toString() }),
        };
    }
};

async function createSingleEvent(eventData, cloudinaryUrl, parentEventName) {
    const { name, date, time, venueId, description, link, categories } = eventData;
    
    try {
        // Generate proper slug using SlugGenerator
        const slug = await slugGenerator.ensureUniqueSlug(
            slugGenerator.generateSlug(name, { includeDate: true, date: date }),
            await getExistingSlugs()
        );

        const recordFields = {
            'Event Name': name,
            'Description': description,
            'Date': `${date}T${time || '00:00'}:00.000Z`,
            'Status': 'Pending Approval',
            'Link': link,
            'Slug': slug
        };

        if (parentEventName) {
            recordFields['Parent Event Name'] = parentEventName;
        }

        if (venueId) recordFields['Venue'] = [venueId];
        if (cloudinaryUrl) recordFields['Promo Image'] = [{ url: cloudinaryUrl }];
        if (categories && categories.length > 0) {
            recordFields['Category'] = categories;
        }

        const base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);
        const createdRecord = await base('Events').create([{ fields: recordFields }]);
        
        return {
            id: createdRecord[0].id,
            name: createdRecord[0].fields['Event Name'],
            date: createdRecord[0].fields['Date'],
            series: false
        };
        
    } catch (error) {
        console.error("Error creating single event:", error);
        return null;
    }
}

async function getExistingSlugs() {
    try {
        const base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);
        const records = await base('Events').select({
            fields: ['Slug']
        }).all();
        
        return records.map(r => r.fields['Slug']).filter(Boolean);
    } catch (error) {
        console.error('Error getting existing slugs:', error);
        return [];
    }
}