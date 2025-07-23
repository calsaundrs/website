const fetch = require('node-fetch');
const parser = require('lambda-multipart-parser');
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

// Helper to get Gemini model name from Firestore
async function getGeminiModelName() {
    try {
        const doc = await db.collection('settings').doc('gemini').get();
        if (doc.exists && doc.data().modelName) {
            return doc.data().modelName;
        }
    } catch (error) {
        console.error("Error fetching Gemini model from Firestore:", error);
    }
    return 'gemini-2.5-flash';
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function postProcessExtractedData(data) {
    // Clean up and enhance the extracted data
    const processed = { ...data };
    
    // Clean up event name
    if (processed.eventName) {
        processed.eventName = processed.eventName.trim();
    }
    
    // Clean up date format
    if (processed.date) {
        processed.date = processed.date.trim();
        // Ensure it's in YYYY-MM-DD format
        if (processed.date && !/^\d{4}-\d{2}-\d{2}$/.test(processed.date)) {
            console.log('Date format needs conversion:', processed.date);
            // Try to convert common date formats
            const converted = convertDateToISO(processed.date);
            if (converted) {
                processed.date = converted;
            }
        }
    }
    
    // Clean up time format
    if (processed.time) {
        processed.time = processed.time.trim();
        // Ensure it's in HH:MM format
        if (processed.time && !/^\d{2}:\d{2}$/.test(processed.time)) {
            console.log('Time format needs conversion:', processed.time);
            const converted = convertTimeTo24Hour(processed.time);
            if (converted) {
                processed.time = converted;
            }
        }
    }
    
    // Clean up description
    if (processed.description) {
        processed.description = processed.description.trim();
    }
    
    // Clean up venue
    if (processed.venue) {
        processed.venue = processed.venue.trim();
    }
    
    console.log('Post-processed data:', processed);
    return processed;
}

function convertDateToISO(dateStr) {
    // Common date conversion patterns
    const patterns = [
        // DD/MM/YYYY
        /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
        // MM/DD/YYYY
        /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
        // DD-MM-YYYY
        /(\d{1,2})-(\d{1,2})-(\d{4})/,
        // Month DD, YYYY
        /(\w+)\s+(\d{1,2}),?\s+(\d{4})/,
        // DD Month YYYY
        /(\d{1,2})\s+(\w+)\s+(\d{4})/
    ];
    
    for (const pattern of patterns) {
        const match = dateStr.match(pattern);
        if (match) {
            let day, month, year;
            
            if (pattern.source.includes('\\w+')) {
                // Text month format
                const monthNames = {
                    'january': '01', 'jan': '01',
                    'february': '02', 'feb': '02',
                    'march': '03', 'mar': '03',
                    'april': '04', 'apr': '04',
                    'may': '05',
                    'june': '06', 'jun': '06',
                    'july': '07', 'jul': '07',
                    'august': '08', 'aug': '08',
                    'september': '09', 'sep': '09',
                    'october': '10', 'oct': '10',
                    'november': '11', 'nov': '11',
                    'december': '12', 'dec': '12'
                };
                
                if (pattern.source.includes('\\d{1,2}\\s+\\w+')) {
                    // DD Month YYYY
                    day = match[1].padStart(2, '0');
                    month = monthNames[match[2].toLowerCase()];
                    year = match[3];
                } else {
                    // Month DD, YYYY
                    month = monthNames[match[1].toLowerCase()];
                    day = match[2].padStart(2, '0');
                    year = match[3];
                }
            } else {
                // Numeric format
                day = match[1].padStart(2, '0');
                month = match[2].padStart(2, '0');
                year = match[3];
            }
            
            if (day && month && year) {
                return `${year}-${month}-${day}`;
            }
        }
    }
    
    return null;
}

function convertTimeTo24Hour(timeStr) {
    // Common time conversion patterns
    const patterns = [
        // HH:MM AM/PM
        /(\d{1,2}):(\d{2})\s*(AM|PM)/i,
        // H:MM AM/PM
        /(\d{1,2}):(\d{2})\s*(AM|PM)/i,
        // HH AM/PM
        /(\d{1,2})\s*(AM|PM)/i,
        // H AM/PM
        /(\d{1,2})\s*(AM|PM)/i
    ];
    
    for (const pattern of patterns) {
        const match = timeStr.match(pattern);
        if (match) {
            let hours = parseInt(match[1]);
            let minutes = match[2] ? parseInt(match[2]) : 0;
            const period = match[3] ? match[3].toUpperCase() : null;
            
            if (period) {
                if (period === 'PM' && hours !== 12) hours += 12;
                if (period === 'AM' && hours === 12) hours = 0;
            }
            
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
    }
    
    return null;
}

function extractBasicInfo(text) {
    // Basic regex-based extraction as fallback
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let eventName = null;
    let date = null;
    let time = null;
    let description = null;
    let venue = null;
    
    // Look for event name (usually the largest text or first prominent line)
    if (lines.length > 0) {
        eventName = lines[0];
    }
    
    // Look for date patterns
    const datePatterns = [
        /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
        /(\d{1,2})-(\d{1,2})-(\d{4})/,
        /(\d{4})-(\d{1,2})-(\d{1,2})/,
        /(\w+)\s+(\d{1,2}),?\s+(\d{4})/
    ];
    
    for (const line of lines) {
        for (const pattern of datePatterns) {
            const match = line.match(pattern);
            if (match) {
                if (pattern.source.includes('\\d{4}-\\d{1,2}-\\d{1,2}')) {
                    date = match[0];
                } else {
                    const month = match[2].padStart(2, '0');
                    const day = match[1].padStart(2, '0');
                    const year = match[3];
                    date = `${year}-${month}-${day}`;
                }
                break;
            }
        }
        if (date) break;
    }
    
    // Look for time patterns
    const timePatterns = [
        /(\d{1,2}):(\d{2})\s*(AM|PM)/i,
        /(\d{1,2}):(\d{2})/,
        /(\d{1,2})\s*(AM|PM)/i
    ];
    
    for (const line of lines) {
        for (const pattern of timePatterns) {
            const match = line.match(pattern);
            if (match) {
                let hours = parseInt(match[1]);
                let minutes = match[2] ? parseInt(match[2]) : 0;
                
                if (match[3]) {
                    const period = match[3].toUpperCase();
                    if (period === 'PM' && hours !== 12) hours += 12;
                    if (period === 'AM' && hours === 12) hours = 0;
                }
                
                time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                break;
            }
        }
        if (time) break;
    }
    
    // Look for venue patterns
    const venuePatterns = [
        /at\s+([^,]+)/i,
        /venue[:\s]+([^,]+)/i,
        /location[:\s]+([^,]+)/i
    ];
    
    for (const line of lines) {
        for (const pattern of venuePatterns) {
            const match = line.match(pattern);
            if (match) {
                venue = match[1].trim();
                break;
            }
        }
        if (venue) break;
    }
    
    // Look for recurrence patterns
    let recurrence = { type: 'none' };
    const fullText = text.toLowerCase();
    
    // Weekly patterns
    const weeklyPatterns = [
        { pattern: /(?:every\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?/gi, day: 1 },
        { pattern: /(?:every\s+)?(mon|tue|wed|thu|fri|sat|sun)s?/gi, day: 1 }
    ];
    
    const dayMap = {
        'monday': 1, 'mon': 1,
        'tuesday': 2, 'tue': 2,
        'wednesday': 3, 'wed': 3,
        'thursday': 4, 'thu': 4,
        'friday': 5, 'fri': 5,
        'saturday': 6, 'sat': 6,
        'sunday': 0, 'sun': 0
    };
    
    for (const pattern of weeklyPatterns) {
        const matches = fullText.match(pattern.pattern);
        if (matches) {
            const days = matches.map(match => dayMap[match.toLowerCase()]).filter(day => day !== undefined);
            if (days.length > 0) {
                recurrence = { type: 'weekly', weekly_days: days };
                break;
            }
        }
    }
    
    // Monthly patterns
    if (fullText.includes('monthly') || fullText.includes('month')) {
        recurrence.type = 'monthly';
        // Try to extract specific monthly patterns
        const monthlyPatterns = [
            { pattern: /first\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i, week: 1 },
            { pattern: /second\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i, week: 2 },
            { pattern: /third\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i, week: 3 },
            { pattern: /fourth\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i, week: 4 },
            { pattern: /last\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i, week: -1 }
        ];
        
        for (const pattern of monthlyPatterns) {
            const match = fullText.match(pattern.pattern);
            if (match) {
                const dayName = match[1].toLowerCase();
                recurrence.monthly_type = 'day';
                recurrence.monthly_week = pattern.week;
                recurrence.monthly_day_of_week = dayMap[dayName];
                break;
            }
        }
    }
    
    // Look for categories
    const categoryKeywords = {
        'Comedy': ['comedy', 'standup', 'stand-up', 'jokes', 'funny', 'humor'],
        'Drag': ['drag', 'drag queen', 'drag show', 'drag performance', 'drag act'],
        'Live Music': ['live music', 'band', 'concert', 'gig', 'performance', 'musician'],
        'Party': ['party', 'celebration', 'birthday', 'club night', 'night out'],
        'Pride': ['pride', 'lgbtq', 'lgbt', 'queer', 'gay', 'lesbian', 'trans'],
        'Social': ['social', 'meet', 'meeting', 'gathering', 'social event'],
        'Theatre': ['theatre', 'theater', 'play', 'drama', 'performance', 'show'],
        'Viewing Party': ['viewing party', 'watch party', 'screening', 'tv', 'television'],
        'Kink': ['kink', 'fetish', 'bdsm', 'leather', 'fetish party'],
        'Community': ['community', 'support', 'group', 'therapy', 'counseling'],
        'Exhibition': ['exhibition', 'art', 'gallery', 'creative', 'display'],
        'Health': ['health', 'wellness', 'fitness', 'medical', 'therapy'],
        'Quiz': ['quiz', 'trivia', 'pub quiz', 'game', 'competition'],
        'Trans & Non-Binary': ['trans', 'transgender', 'non-binary', 'nonbinary', 'gender'],
        'Sober': ['sober', 'alcohol-free', 'dry', 'recovery'],
        'Queer Women & Sapphic': ['queer women', 'sapphic', 'lesbian', 'women only', 'female only']
    };
    
    const categories = [];
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
        for (const keyword of keywords) {
            if (fullText.includes(keyword)) {
                categories.push(category);
                break;
            }
        }
    }
    
    return {
        eventName,
        date,
        time,
        description,
        venue,
        recurrence,
        categories
    };
}

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Check for API key
        if (!process.env.GEMINI_API_KEY) {
            console.error('GEMINI_API_KEY not set');
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'API key not configured' })
            };
        }

        // Parse multipart form data
        const result = await parser.parse(event);
        
        if (!result.files || result.files.length === 0) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'No image file provided' })
            };
        }

        const imageFile = result.files[0];
        
        // Validate file size (max 20MB)
        if (imageFile.content.length > 20 * 1024 * 1024) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'File too large. Maximum size is 20MB.' })
            };
        }

        // Convert to base64
        const base64Image = imageFile.content.toString('base64');
        
        // Get Gemini model name from Firestore
        const modelName = await getGeminiModelName();
        console.log('Using Gemini model:', modelName);

        // Prepare the API request
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`;
        
        const prompt = `Analyze this event poster and extract the following information in JSON format:
        {
            "eventName": "Extract the exact event name/title as shown on the poster",
            "date": "YYYY-MM-DD format (extract the event date, convert any date format to YYYY-MM-DD)",
            "time": "HH:MM format (24-hour, extract the start time)",
            "description": "Write a compelling, marketing-focused description that sells the event. Include: what makes it special, who should attend, what they'll experience, any unique features, dress codes, or highlights. Make it exciting and persuasive - this should make people want to come!",
            "venue": "Venue name (extract the location/venue where the event is happening)",
            "recurrence": {
                "type": "none|weekly|monthly",
                "weekly_days": [0,1,2,3,4,5,6] (0=Sunday, 1=Monday, etc.),
                "monthly_type": "date|day",
                "monthly_day_of_month": 1-31,
                "monthly_week": 1-4 or -1 for last,
                "monthly_day_of_week": 0-6 (0=Sunday, 1=Monday, etc.)
            },
            "categories": ["category1", "category2"] (extract relevant event categories)
        }
        
        IMPORTANT INSTRUCTIONS:
        - For eventName: Extract the exact event name/title as it appears on the poster. Do not modify, interpret, or create a new name - use the actual title from the poster.
        - For description: Write a compelling, marketing-focused description that sells the event. Include:
          * What makes this event special and unique
          * Who should attend and why they'll love it
          * What they'll experience and what to expect
          * Any special features, performances, or highlights
          * Dress codes, themes, or atmosphere details
          * Call-to-action elements that create excitement
        - For dates: Convert any date format (e.g., "15th August", "Aug 15", "15/08/2024") to YYYY-MM-DD
        - For times: Convert to 24-hour format (e.g., "8pm" becomes "20:00", "2:30pm" becomes "14:30")
        - For venue: Extract the specific venue name/location
        - For recurrence: Analyze the event name and description for recurring patterns:
          * "Turnt Up Tuesdays" = weekly, day 2 (Tuesday)
          * "Monthly Mixer" = monthly
          * "Every Friday" = weekly, day 5 (Friday)
          * "First Saturday of the month" = monthly, week 1, day 6 (Saturday)
          * "Last Thursday" = monthly, week -1, day 4 (Thursday)
        - For categories: Extract relevant categories like "Comedy", "Drag", "Live Music", "Party", "Pride", "Social", "Theatre", "Viewing Party", "Kink", "Community", "Exhibition", "Health", "Quiz", "Trans & Non-Binary", "Sober", "Queer Women & Sapphic"
        - If any information is not found, use null for that field
        - Make the description exciting and irresistible while keeping the event name exactly as shown!`;

        const payload = {
            contents: [{
                parts: [{
                    text: prompt
                }, {
                    inline_data: {
                        mime_type: imageFile.contentType || 'image/jpeg',
                        data: base64Image
                    }
                }]
            }]
        };

        console.log('Sending request to Gemini API...');
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API error:', errorText);
            throw new Error(`Gemini API call failed: ${response.status} ${response.statusText}`);
        }

        const result_data = await response.json();
        console.log('Gemini API response received');

        if (!result_data.candidates || !result_data.candidates[0] || !result_data.candidates[0].content) {
            throw new Error('Invalid response from Gemini API');
        }

        const textResponse = result_data.candidates[0].content.parts[0].text;
        console.log('Raw text response:', textResponse);

        // Try to extract JSON from the response
        let extractedData = null;
        try {
            // Look for JSON in the response
            const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                extractedData = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (parseError) {
            console.log('JSON parsing failed, using fallback extraction');
            // Fallback to basic text extraction
            extractedData = extractBasicInfo(textResponse);
        }

        // Post-process the extracted data
        extractedData = postProcessExtractedData(extractedData);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify({
                success: true,
                data: extractedData
            })
        };

    } catch (error) {
        console.error('Error processing poster:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};