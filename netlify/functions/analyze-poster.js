/**
 * Dedicated Poster Analysis Function
 * Phase 4: Code Quality & Error Handling
 * 
 * Handles AI poster analysis separately from event submission
 * for better performance and error handling
 */

const admin = require('firebase-admin');

// AI Poster Parsing Function
async function parsePosterWithAI(imageUrl, geminiModel = 'gemini-1.5-flash') {
    try {
        console.log('🤖 Starting AI poster parsing');
        
        const currentYear = new Date().getFullYear();
        const prompt = `Analyze this event poster and extract the following information in JSON format:
{
  "eventName": "The name of the event",
  "date": "Event date in YYYY-MM-DD format if found",
  "time": "Event time in HH:MM format if found", 
  "venue": "Venue name if found",
  "description": "Brief description or tagline if found",
  "price": "Price information if found",
  "ageRestriction": "Age restriction if found",
  "categories": ["array", "of", "relevant", "categories"],
  "confidence": "high/medium/low based on how clear the information is"
}

IMPORTANT DATE GUIDELINES:
- If the poster shows only day/month (e.g., "4th September"), assume the current year ${currentYear}
- If the poster shows a past year, assume it's a typo and use ${currentYear} instead
- Only extract dates that are clearly future events
- If no year is shown, default to ${currentYear}
- If the date appears to be in the past, use ${currentYear} instead

Only return valid JSON. If information is not found, use null for that field. Be conservative - only extract information you're confident about.`;

        const payload = {
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: "image/jpeg",
                            data: imageUrl.split(',')[1] || imageUrl // Handle both data URLs and direct URLs
                        }
                    }
                ]
            }]
        };

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
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
        const extractedText = data.candidates[0].content.parts[0].text.trim();
        
        // Clean up the response - remove markdown code blocks if present
        let cleanText = extractedText;
        if (cleanText.includes('```json')) {
            cleanText = cleanText.replace(/```json\s*/, '').replace(/\s*```/, '');
        } else if (cleanText.includes('```')) {
            cleanText = cleanText.replace(/```\s*/, '').replace(/\s*```/, '');
        }
        
        // Try to parse the JSON response
        try {
            const parsedData = JSON.parse(cleanText);
            
            // Fix past dates - if date is in the past, assume it's the current year
            if (parsedData.date) {
                const extractedDate = new Date(parsedData.date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                if (extractedDate < today) {
                    const currentYear = new Date().getFullYear();
                    console.log('🤖 Fixing past date:', parsedData.date, `→ ${currentYear}`);
                    // Extract day and month, set year to current year
                    const day = extractedDate.getDate();
                    const month = extractedDate.getMonth() + 1; // getMonth() returns 0-11
                    parsedData.date = `${currentYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                }
            }
            
            console.log('🤖 AI extracted data:', parsedData);
            return parsedData;
        } catch (parseError) {
            console.error('Failed to parse AI response as JSON:', cleanText);
            console.error('Parse error:', parseError.message);
            return null;
        }

    } catch (error) {
        console.error('AI poster parsing failed:', error);
        return null;
    }
}

exports.handler = async function (event, context) {
    console.log('Poster analysis function called');
    
    // Set CORS headers
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: headers,
            body: ''
        };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Check if Gemini API key is available
        if (!process.env.GEMINI_API_KEY) {
            return {
                statusCode: 500,
                headers: headers,
                body: JSON.stringify({
                    success: false,
                    error: 'AI analysis not available - missing API key'
                })
            };
        }

        // Parse request body
        let body;
        try {
            body = JSON.parse(event.body);
        } catch (parseError) {
            return {
                statusCode: 400,
                headers: headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Invalid JSON in request body'
                })
            };
        }

        // Validate required fields
        if (!body.image) {
            return {
                statusCode: 400,
                headers: headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Image data is required'
                })
            };
        }

        // Analyze poster with AI
        const extractedData = await parsePosterWithAI(body.image);
        
        if (extractedData) {
            return {
                statusCode: 200,
                headers: headers,
                body: JSON.stringify({
                    success: true,
                    extractedData: extractedData,
                    message: 'Poster analyzed successfully'
                })
            };
        } else {
            return {
                statusCode: 200,
                headers: headers,
                body: JSON.stringify({
                    success: false,
                    error: 'AI analysis completed but no data could be extracted',
                    message: 'Please fill in the form manually'
                })
            };
        }

    } catch (error) {
        console.error('Error in poster analysis:', error);
        return {
            statusCode: 500,
            headers: headers,
            body: JSON.stringify({
                success: false,
                error: 'Internal server error during poster analysis',
                message: error.message
            })
        };
    }
};
