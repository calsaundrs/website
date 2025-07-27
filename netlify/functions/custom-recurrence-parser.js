const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Custom Recurrence Parser with Gemini AI');
    
    try {
        const body = JSON.parse(event.body);
        const customDescription = body.description;
        const startDate = new Date(body.startDate);
        const endDate = body.endDate ? new Date(body.endDate) : null;
        const maxInstances = body.maxInstances || 52;
        
        // First try AI-powered parsing
        let instances = await parseWithGemini(customDescription, startDate, endDate, maxInstances);
        
        // If AI parsing fails, fall back to rule-based parsing
        if (!instances || instances.length === 0) {
            console.log('AI parsing failed, falling back to rule-based parsing');
            instances = parseCustomRecurrence(customDescription, startDate, endDate, maxInstances);
        }
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            },
            body: JSON.stringify({
                success: true,
                instances: instances,
                parsedPattern: extractPatternFromDescription(customDescription),
                totalInstances: instances.length,
                method: instances.length > 0 ? 'ai_enhanced' : 'rule_based'
            })
        };
        
    } catch (error) {
        console.error('Error parsing custom recurrence:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            },
            body: JSON.stringify({
                success: false,
                error: 'Failed to parse custom recurrence',
                message: error.message
            })
        };
    }
};

async function parseWithGemini(description, startDate, endDate, maxInstances) {
    try {
        if (!process.env.GEMINI_API_KEY) {
            console.log('Gemini API key not available, skipping AI parsing');
            return null;
        }

        const prompt = `
You are a calendar recurrence parser. Given a natural language description of a recurring event, generate a list of dates.

Description: "${description}"
Start Date: ${startDate.toISOString().split('T')[0]}
End Date: ${endDate ? endDate.toISOString().split('T')[0] : 'No end date'}
Maximum Instances: ${maxInstances}

Rules:
1. Only generate dates that are on or after the start date
2. If an end date is provided, don't generate dates after it
3. Don't exceed the maximum instances limit
4. Return dates in ISO format (YYYY-MM-DD)
5. Handle complex patterns like "first Monday of each month", "every other Tuesday", "last Friday of the month", etc.
6. Be flexible with natural language - understand variations in how people describe recurring events

Examples:
- "Every first Saturday of the month" → Generate first Saturday of each month
- "Every other Tuesday" → Generate every second Tuesday
- "Last Friday of each month" → Generate last Friday of each month
- "1st and 3rd Thursday" → Generate 1st and 3rd Thursday of each month
- "Every Monday except bank holidays" → Generate every Monday (bank holiday logic would need separate handling)

Return ONLY a JSON array of date strings in ISO format (YYYY-MM-DD), nothing else.
Example: ["2024-01-01", "2024-01-08", "2024-01-15"]
`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            throw new Error('Invalid response from Gemini API');
        }

        const aiResponse = data.candidates[0].content.parts[0].text.trim();
        console.log('Gemini response:', aiResponse);

        // Try to extract JSON from the response
        let jsonMatch = aiResponse.match(/\[.*\]/);
        if (!jsonMatch) {
            // If no JSON array found, try to parse the entire response
            jsonMatch = aiResponse;
        }

        const dates = JSON.parse(jsonMatch);
        
        if (!Array.isArray(dates)) {
            throw new Error('AI response is not a valid date array');
        }

        // Convert to Date objects and validate
        const instances = dates
            .map(dateStr => new Date(dateStr))
            .filter(date => !isNaN(date.getTime()) && date >= startDate)
            .filter(date => !endDate || date <= endDate)
            .slice(0, maxInstances);

        console.log(`AI generated ${instances.length} valid instances`);
        return instances;

    } catch (error) {
        console.error('Error in AI parsing:', error);
        return null;
    }
}

function parseCustomRecurrence(description, startDate, endDate, maxInstances) {
    const text = description.toLowerCase().trim();
    const instances = [];
    let current = new Date(startDate);
    let count = 0;
    
    // Parse different patterns
    if (text.includes('every first') || text.includes('first')) {
        return parseFirstOfMonth(text, startDate, endDate, maxInstances);
    } else if (text.includes('every last') || text.includes('last')) {
        return parseLastOfMonth(text, startDate, endDate, maxInstances);
    } else if (text.includes('every other') || text.includes('alternate')) {
        return parseAlternate(text, startDate, endDate, maxInstances);
    } else if (text.includes('1st') || text.includes('2nd') || text.includes('3rd') || text.includes('4th')) {
        return parseNthOfMonth(text, startDate, endDate, maxInstances);
    } else if (text.includes('every') && text.includes('day')) {
        return parseDaily(text, startDate, endDate, maxInstances);
    } else if (text.includes('every') && text.includes('week')) {
        return parseWeekly(text, startDate, endDate, maxInstances);
    } else if (text.includes('every') && text.includes('month')) {
        return parseMonthly(text, startDate, endDate, maxInstances);
    } else if (text.includes('every') && text.includes('year')) {
        return parseYearly(text, startDate, endDate, maxInstances);
    } else {
        // Fallback to weekly
        return parseWeekly(text, startDate, endDate, maxInstances);
    }
}

function parseFirstOfMonth(text, startDate, endDate, maxInstances) {
    const instances = [];
    let current = new Date(startDate);
    let count = 0;
    
    // Get the day of week from the text
    const dayOfWeek = extractDayOfWeek(text);
    if (!dayOfWeek) return instances;
    
    while (count < maxInstances) {
        if (endDate && current > endDate) break;
        
        // Find the first occurrence of the specified day in the current month
        const firstOfMonth = new Date(current.getFullYear(), current.getMonth(), 1);
        const targetDate = getNextDayOfWeek(firstOfMonth, dayOfWeek);
        
        if (targetDate >= startDate) {
            instances.push(new Date(targetDate));
            count++;
        }
        
        // Move to next month
        current.setMonth(current.getMonth() + 1);
    }
    
    return instances;
}

function parseLastOfMonth(text, startDate, endDate, maxInstances) {
    const instances = [];
    let current = new Date(startDate);
    let count = 0;
    
    const dayOfWeek = extractDayOfWeek(text);
    if (!dayOfWeek) return instances;
    
    while (count < maxInstances) {
        if (endDate && current > endDate) break;
        
        // Find the last occurrence of the specified day in the current month
        const lastOfMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0);
        const targetDate = getLastDayOfWeek(lastOfMonth, dayOfWeek);
        
        if (targetDate >= startDate) {
            instances.push(new Date(targetDate));
            count++;
        }
        
        // Move to next month
        current.setMonth(current.getMonth() + 1);
    }
    
    return instances;
}

function parseAlternate(text, startDate, endDate, maxInstances) {
    const instances = [];
    let current = new Date(startDate);
    let count = 0;
    
    const dayOfWeek = extractDayOfWeek(text);
    if (!dayOfWeek) return instances;
    
    // Find the first occurrence
    let targetDate = getNextDayOfWeek(current, dayOfWeek);
    
    while (count < maxInstances) {
        if (endDate && targetDate > endDate) break;
        
        instances.push(new Date(targetDate));
        count++;
        
        // Skip one week (every other)
        targetDate.setDate(targetDate.getDate() + 14);
    }
    
    return instances;
}

function parseNthOfMonth(text, startDate, endDate, maxInstances) {
    const instances = [];
    let current = new Date(startDate);
    let count = 0;
    
    // Extract nth occurrence and day of week
    const nth = extractNthOccurrence(text);
    const dayOfWeek = extractDayOfWeek(text);
    
    if (!nth || !dayOfWeek) return instances;
    
    while (count < maxInstances) {
        if (endDate && current > endDate) break;
        
        const targetDate = getNthDayOfWeek(current.getFullYear(), current.getMonth(), nth, dayOfWeek);
        
        if (targetDate && targetDate >= startDate) {
            instances.push(new Date(targetDate));
            count++;
        }
        
        // Move to next month
        current.setMonth(current.getMonth() + 1);
    }
    
    return instances;
}

function parseDaily(text, startDate, endDate, maxInstances) {
    const instances = [];
    let current = new Date(startDate);
    let count = 0;
    
    while (count < maxInstances) {
        if (endDate && current > endDate) break;
        
        instances.push(new Date(current));
        count++;
        current.setDate(current.getDate() + 1);
    }
    
    return instances;
}

function parseWeekly(text, startDate, endDate, maxInstances) {
    const instances = [];
    let current = new Date(startDate);
    let count = 0;
    
    const dayOfWeek = extractDayOfWeek(text);
    
    if (dayOfWeek) {
        // Specific day of week
        let targetDate = getNextDayOfWeek(current, dayOfWeek);
        
        while (count < maxInstances) {
            if (endDate && targetDate > endDate) break;
            
            instances.push(new Date(targetDate));
            count++;
            targetDate.setDate(targetDate.getDate() + 7);
        }
    } else {
        // Every week from start date
        while (count < maxInstances) {
            if (endDate && current > endDate) break;
            
            instances.push(new Date(current));
            count++;
            current.setDate(current.getDate() + 7);
        }
    }
    
    return instances;
}

function parseMonthly(text, startDate, endDate, maxInstances) {
    const instances = [];
    let current = new Date(startDate);
    let count = 0;
    
    while (count < maxInstances) {
        if (endDate && current > endDate) break;
        
        instances.push(new Date(current));
        count++;
        current.setMonth(current.getMonth() + 1);
    }
    
    return instances;
}

function parseYearly(text, startDate, endDate, maxInstances) {
    const instances = [];
    let current = new Date(startDate);
    let count = 0;
    
    while (count < maxInstances) {
        if (endDate && current > endDate) break;
        
        instances.push(new Date(current));
        count++;
        current.setFullYear(current.getFullYear() + 1);
    }
    
    return instances;
}

// Helper functions
function extractDayOfWeek(text) {
    const days = {
        'monday': 1, 'mon': 1,
        'tuesday': 2, 'tue': 2, 'tues': 2,
        'wednesday': 3, 'wed': 3,
        'thursday': 4, 'thu': 4, 'thurs': 4,
        'friday': 5, 'fri': 5,
        'saturday': 6, 'sat': 6,
        'sunday': 0, 'sun': 0
    };
    
    for (const [day, value] of Object.entries(days)) {
        if (text.includes(day)) {
            return value;
        }
    }
    
    return null;
}

function extractNthOccurrence(text) {
    if (text.includes('1st') || text.includes('first')) return 1;
    if (text.includes('2nd') || text.includes('second')) return 2;
    if (text.includes('3rd') || text.includes('third')) return 3;
    if (text.includes('4th') || text.includes('fourth')) return 4;
    if (text.includes('5th') || text.includes('fifth')) return 5;
    return null;
}

function getNextDayOfWeek(date, dayOfWeek) {
    const result = new Date(date);
    result.setDate(date.getDate() + (7 + dayOfWeek - date.getDay()) % 7);
    return result;
}

function getLastDayOfWeek(date, dayOfWeek) {
    const result = new Date(date);
    result.setDate(date.getDate() - (7 + date.getDay() - dayOfWeek) % 7);
    return result;
}

function getNthDayOfWeek(year, month, nth, dayOfWeek) {
    const firstDay = new Date(year, month, 1);
    const firstOccurrence = getNextDayOfWeek(firstDay, dayOfWeek);
    
    if (nth === 1) return firstOccurrence;
    
    const targetDate = new Date(firstOccurrence);
    targetDate.setDate(firstOccurrence.getDate() + (nth - 1) * 7);
    
    // Check if it's still in the same month
    if (targetDate.getMonth() === month) {
        return targetDate;
    }
    
    return null;
}

function extractPatternFromDescription(description) {
    const text = description.toLowerCase();
    
    if (text.includes('every first') || text.includes('first')) {
        return 'First of Month';
    } else if (text.includes('every last') || text.includes('last')) {
        return 'Last of Month';
    } else if (text.includes('every other') || text.includes('alternate')) {
        return 'Alternate';
    } else if (text.includes('1st') || text.includes('2nd') || text.includes('3rd') || text.includes('4th')) {
        return 'Nth of Month';
    } else if (text.includes('every day')) {
        return 'Daily';
    } else if (text.includes('every week')) {
        return 'Weekly';
    } else if (text.includes('every month')) {
        return 'Monthly';
    } else if (text.includes('every year')) {
        return 'Yearly';
    } else {
        return 'Custom';
    }
}