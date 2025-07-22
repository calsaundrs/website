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

exports.handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Check if API key is available
        if (!GEMINI_API_KEY) {
            console.error('GEMINI_API_KEY is not set');
            // Return sample data for testing
            return {
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                    extractedData: {
                        eventName: "Sample Event",
                        date: "2024-08-15",
                        time: "20:00",
                        description: "Sample event description"
                    }
                })
            };
        }

        // Parse multipart form data using the parser library
        const result = await parser.parse(event);
        console.log('Parsed form data:', {
            files: result.files ? result.files.length : 0,
            fields: Object.keys(result.fields || {})
        });

        let posterFile = null;
        let fileName = null;

        if (result.files && result.files.length > 0) {
            posterFile = result.files[0].content;
            fileName = result.files[0].filename;
        }

        if (!posterFile) {
            console.error('No poster file found in multipart data');
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'No poster file found' })
            };
        }

        console.log('File processing:', {
            fileName: fileName,
            fileSize: posterFile.length,
            fileType: result.files[0].contentType
        });

        // Check file size (Gemini has limits)
        const maxSize = 20 * 1024 * 1024; // 20MB limit
        if (posterFile.length > maxSize) {
            console.error('File too large:', posterFile.length, 'bytes');
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'File too large. Please use an image smaller than 20MB.' })
            };
        }

        // Use Gemini Vision API to analyze the image
        const base64Image = posterFile.toString('base64');
        
        console.log('Image processing:', {
            originalSize: posterFile.length,
            base64Size: base64Image.length,
            isValidBase64: /^[A-Za-z0-9+/]*={0,2}$/.test(base64Image),
            base64Start: base64Image.substring(0, 50) + '...',
            base64End: '...' + base64Image.substring(base64Image.length - 50)
        });
        
        const prompt = `Analyze this event poster and extract the following information in JSON format:
        {
            "eventName": "Event name (extract the main title/name of the event)",
            "date": "YYYY-MM-DD format (extract the event date, convert any date format to YYYY-MM-DD)",
            "time": "HH:MM format (24-hour, extract the start time)",
            "description": "Brief description of the event (what it's about, who it's for)",
            "venue": "Venue name (extract the location/venue where the event is happening)"
        }
        
        IMPORTANT INSTRUCTIONS:
        - For dates: Convert any date format (e.g., "15th August", "Aug 15", "15/08/2024") to YYYY-MM-DD
        - For times: Convert to 24-hour format (e.g., "8pm" becomes "20:00", "2:30pm" becomes "14:30")
        - For venue: Extract the specific venue name/location
        - If any information is not found, use null for that field
        - Be as accurate as possible with the extraction`;

        // Use the content type from the parsed file
        const mimeType = result.files[0].contentType || 'image/jpeg';

        console.log('Using MIME type:', mimeType);
        console.log('File signature (hex):', posterFile.slice(0, 8).toString('hex'));

        const payload = {
            contents: [{
                parts: [
                    { text: prompt },
                    { inline_data: { mime_type: mimeType, data: base64Image } }
                ]
            }]
        };

        console.log('Payload structure:', {
            hasContents: !!payload.contents,
            contentsLength: payload.contents.length,
            hasParts: !!payload.contents[0].parts,
            partsLength: payload.contents[0].parts.length,
            hasText: !!payload.contents[0].parts[0].text,
            hasImage: !!payload.contents[0].parts[1].inline_data,
            imageDataLength: payload.contents[0].parts[1].inline_data.data.length
        });

        // Get the model name from Firestore
        const modelName = await getGeminiModelName();
        console.log('Using Gemini model:', modelName);

        console.log('Making Gemini API call...');
        console.log('API Key available:', !!GEMINI_API_KEY);
        console.log('API Key length:', GEMINI_API_KEY ? GEMINI_API_KEY.length : 0);
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        console.log('Gemini API response status:', response.status);
        console.log('Gemini API response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API error response:', errorText);
            throw new Error(`Gemini API call failed with status ${response.status}: ${errorText}`);
        }

        const result2 = await response.json();
        console.log('Gemini API response received');
        
        if (!result2.candidates || !result2.candidates[0] || !result2.candidates[0].content) {
            throw new Error('Invalid response format from Gemini API');
        }
        
        const aiResponse = result2.candidates[0].content.parts[0].text;
        console.log('AI Response:', aiResponse);
        
        // Try to parse the JSON response
        let extractedData;
        try {
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                extractedData = JSON.parse(jsonMatch[0]);
                console.log('Extracted data:', extractedData);
                
                // Post-process the extracted data
                extractedData = postProcessExtractedData(extractedData);
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (parseError) {
            console.log('JSON parsing failed, using fallback extraction');
            // Fallback: extract basic information manually
            extractedData = extractBasicInfo(aiResponse);
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                extractedData: extractedData
            })
        };

    } catch (error) {
        console.error('Error processing poster:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: 'Failed to process poster'
            })
        };
    }
};

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
    
    return {
        eventName,
        date,
        time,
        description,
        venue
    };
}
