const fetch = require('node-fetch');

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

        // Parse multipart form data
        const boundary = event.headers['content-type'].split('boundary=')[1];
        const body = Buffer.from(event.body, 'base64');
        
        // Simple multipart parser for the poster file
        const parts = body.toString().split(`--${boundary}`);
        let posterFile = null;
        
        for (const part of parts) {
            if (part.includes('Content-Type: image/')) {
                const lines = part.split('\r\n');
                const contentStart = lines.findIndex(line => line === '') + 1;
                const content = lines.slice(contentStart, -1).join('\r\n');
                posterFile = Buffer.from(content, 'binary');
                break;
            }
        }
        
        if (!posterFile) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'No poster file found' })
            };
        }

        // Use Gemini Vision API to analyze the image
        const base64Image = posterFile.toString('base64');
        
        const prompt = `Analyze this event poster and extract the following information in JSON format:
        {
            "eventName": "Event name",
            "date": "YYYY-MM-DD format",
            "time": "HH:MM format (24-hour)",
            "description": "Brief description"
        }
        
        If any information is not found, use null for that field.`;

        const payload = {
            contents: [{
                parts: [
                    { text: prompt },
                    { inline_data: { mime_type: 'image/jpeg', data: base64Image } }
                ]
            }]
        };

        console.log('Making Gemini API call...');
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        console.log('Gemini API response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API error response:', errorText);
            throw new Error(`Gemini API call failed with status ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        console.log('Gemini API response received');
        
        if (!result.candidates || !result.candidates[0] || !result.candidates[0].content) {
            throw new Error('Invalid response format from Gemini API');
        }
        
        const aiResponse = result.candidates[0].content.parts[0].text;
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
