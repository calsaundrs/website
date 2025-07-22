const Airtable = require('airtable');
const parser = require('lambda-multipart-parser');
const cloudinary = require('cloudinary').v2;
const fetch = require('node-fetch');

const base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Calculate recurring dates using pure JavaScript logic
 * This serves as a fallback when AI is unavailable
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
                // Handle months with fewer days
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

/**
 * Get the nth weekday of a month
 */
function getNthWeekdayOfMonth(year, month, week, dayOfWeek) {
    const date = new Date(year, month, 1);
    
    if (week > 0) {
        // Find the nth occurrence
        let day = date.getDay();
        let diff = (dayOfWeek - day + 7) % 7;
        date.setDate(date.getDate() + diff);
        date.setDate(date.getDate() + (week - 1) * 7);
    } else {
        // Find the last occurrence
        date.setMonth(date.getMonth() + 1);
        date.setDate(0); // Last day of current month
        let day = date.getDay();
        let diff = (dayOfWeek - day + 7) % 7;
        date.setDate(date.getDate() - diff);
    }
    
    // Ensure the date is still in the target month
    if (date.getMonth() !== month) return null;
    return date;
}

async function getDatesFromAI(startDate, recurrenceData, modelName) {
    console.log("getDatesFromAI: Received recurrenceData:", recurrenceData);
    
    // First try AI, with fallback to pure JavaScript
    try {
        let recurrenceRule = "";
        if (recurrenceData.type === 'weekly') {
            const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const selectedDays = recurrenceData.days.map(dayIndex => daysOfWeek[dayIndex]);
            recurrenceRule = `the event repeats weekly on ${selectedDays.join(', ')}`;
        } else if (recurrenceData.type === 'monthly') {
            if (recurrenceData.monthlyType === 'date') {
                recurrenceRule = `the event repeats monthly on day ${recurrenceData.dayOfMonth}`;
            } else if (recurrenceData.monthlyType === 'day') {
                const ordinal = { '1': 'first', '2': 'second', '3': 'third', '4': 'fourth', '-1': 'last' }[recurrenceData.week];
                const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][recurrenceData.dayOfWeek];
                recurrenceRule = `the event repeats monthly on the ${ordinal} ${dayOfWeek} of each month`;
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
            throw new Error(`AI API call failed with status: ${response.status}`);
        }
        
        const data = await response.json();
        const datesText = data.candidates[0].content.parts[0].text.trim();
        console.log("getDatesFromAI: Raw AI response datesText:", datesText);
        
        const aiDates = datesText.split(',').map(d => d.trim());
        
        // Validate AI response
        const validDates = aiDates.filter(date => {
            const parsed = new Date(date);
            return !isNaN(parsed.getTime()) && date.match(/^\d{4}-\d{2}-\d{2}$/);
        });
        
        if (validDates.length > 0) {
            return validDates;
        } else {
            throw new Error('AI returned invalid dates');
        }
        
    } catch (error) {
        console.warn('AI date generation failed, falling back to JavaScript calculation:', error);
        
        // Fallback to pure JavaScript calculation
        const jsDates = calculateRecurringDates(startDate, recurrenceData, 3);
        console.log('getDatesFromAI: JavaScript fallback dates:', jsDates);
        return jsDates;
    }
}

function generateSlug(eventName, date) {
    const datePart = new Date(date).toISOString().split('T')[0];
    const namePart = eventName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
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

async function uploadImage(file) {
    if (!file) return null;
    try {
        const base64String = file.content.toString('base64');
        const dataUri = `data:${file.contentType};base64,${base64String}`;
        const result = await cloudinary.uploader.upload(dataUri, { folder: 'brumoutloud_events' });
        return { secure_url: result.secure_url, public_id: result.public_id };
    } catch (error) {
        console.error("Cloudinary upload error in event-submission:", error);
        return null;
    }
}

exports.handler = async function (event, context) {
    const geminiModel = 'gemini-1.5-flash';
    try {
        const submission = await parser.parse(event);
        console.log('submission.categoryIds:', submission.categoryIds);
        
        const uploadResult = await uploadImage(submission.files.find(f => f.fieldname === 'promo-image'));
        const imageUrl = uploadResult ? uploadResult.secure_url : null;
        const cloudinaryPublicId = uploadResult ? uploadResult.public_id : null;
        const venueId = submission.venueId || null;

        let submittedCategoryNames = submission.categoryIds;
        if (typeof submittedCategoryNames === 'string') {
            submittedCategoryNames = [submittedCategoryNames];
        } else if (!Array.isArray(submittedCategoryNames)) {
            submittedCategoryNames = [];
        }

        let recurrenceData = null;
        if (submission['recurring-info']) {
            try {
                recurrenceData = JSON.parse(submission['recurring-info']);
                console.log('Parsed recurrenceData:', recurrenceData);
            } catch (e) {
                console.error("Error parsing recurring-info JSON:", e);
            }
        }

        let datesToCreate = [];
        if (recurrenceData && recurrenceData.type && recurrenceData.type !== 'none' && submission.date) {
            datesToCreate = await getDatesFromAI(submission.date, recurrenceData, geminiModel);
            console.log('Dates generated by AI:', datesToCreate);
        } else if (submission.date) {
            datesToCreate.push(submission.date);
            console.log('Single date to create:', datesToCreate);
        } else {
            return {
                statusCode: 400,
                body: JSON.stringify({ success: false, message: "Date is required." }),
            };
        }

        let firstEventRecord = {
            "Event Name":      submission['event-name'] || 'Untitled Event',
            "Date":            new Date(`${datesToCreate[0]}T${submission['start-time'] || '00:00'}`).toISOString(),
            "Description":     submission.description || '',
            "Link":            submission.link || '',
            "Status":          "Pending Review",
            "Submitter Email": submission['contact-email'] || null,
            "Slug":            generateSlug(submission['event-name'], datesToCreate[0])
        };

        if (recurrenceData && recurrenceData.type !== 'none') {
            firstEventRecord["Recurring JSON"] = JSON.stringify(recurrenceData);
            firstEventRecord["Recurring Info"] = createNaturalLanguageRule(recurrenceData);
            console.log('Natural language recurrence for first event:', firstEventRecord["Recurring Info"]);
        }

        if (imageUrl) {
            firstEventRecord["Promo Image"] = [{ url: imageUrl }];
        }
        if (cloudinaryPublicId) {
            firstEventRecord["Cloudinary Public ID"] = cloudinaryPublicId;
        }

        if (venueId && venueId.startsWith('rec')) {
            firstEventRecord["Venue"] = [venueId];
        }

        if (submittedCategoryNames.length > 0) {
            firstEventRecord["Category"] = submittedCategoryNames;
        }

        console.log('Attempting to create first event record in Airtable:', firstEventRecord);
        const createdFirstRecord = await base('Events').create([{ fields: firstEventRecord }]);
        const seriesId = createdFirstRecord[0].id;
        console.log('First event created with Series ID:', seriesId);
        console.log('Series ID for subsequent records:', seriesId);

        const subsequentRecordsToCreate = datesToCreate.slice(1).map(d => {
            const recordFields = {
                "Event Name":      submission['event-name'] || 'Untitled Event',
                "Date":            new Date(`${d}T${submission['start-time'] || '00:00'}`).toISOString(),
                "Description":     submission.description || '',
                "Link":            submission.link || '',
                "Status":          "Pending Review",
                "Submitter Email": submission['contact-email'] || null,
                "Slug":            generateSlug(submission['event-name'], d),
                "Series ID":       seriesId // Link to the first event in the series
            };

            if (imageUrl) {
                recordFields["Promo Image"] = [{ url: imageUrl }];
            }
            if (cloudinaryPublicId) {
                recordFields["Cloudinary Public ID"] = cloudinaryPublicId;
            }

            if (venueId && venueId.startsWith('rec')) {
                recordFields["Venue"] = [venueId];
            }

            if (submittedCategoryNames.length > 0) {
                recordFields["Category"] = submittedCategoryNames;
            }
            console.log(`Subsequent record to create for date ${d}:`, recordFields);
            return { fields: recordFields };
        });

        if (subsequentRecordsToCreate.length > 0) {
            console.log('Attempting to create subsequent records in Airtable:', subsequentRecordsToCreate);
            const chunkSize = 10;
            for (let i = 0; i < subsequentRecordsToCreate.length; i += chunkSize) {
                await base('Events').create(subsequentRecordsToCreate.slice(i, i + chunkSize));
            }
            console.log(`Successfully created ${subsequentRecordsToCreate.length} subsequent event(s) in Airtable.`);
        } else {
            console.log('No subsequent records to create.');
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/html' },
            body: `<!DOCTYPE html><html><head><title>Success</title><meta http-equiv="refresh" content="3;url=/events.html"></head><body style="font-family: sans-serif; text-align: center; padding-top: 50px;"><h1>Thank You!</h1><p>Your event has been submitted for review.</p><p>You will be redirected shortly.</p></body></html>`
        };

    } catch (error) {
        console.error("!!! An error occurred in event-submission handler:", error);
        return {
            statusCode: 500,
            body: `<html><body><h1>Internal Server Error</h1><p>An unexpected error occurred: ${error.toString()}</p></body></html>`
        };
    }
};
