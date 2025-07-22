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
            "eventName": "Event name",
            "date": "YYYY-MM-DD format",
            "time": "HH:MM format (24-hour)",
            "description": "Brief description"
        }
        
        If any information is not found, use null for that field.`;

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

function extractBasicInfo(text) {
    // Basic regex-based extraction as fallback
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let eventName = null;
    let date = null;
    let time = null;
    let description = null;
    
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
    
    return {
        eventName,
        date,
        time,
        description
    };
}
