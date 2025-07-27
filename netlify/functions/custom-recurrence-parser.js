const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Custom Recurrence Parser');
    
    try {
        const body = JSON.parse(event.body);
        const customDescription = body.description;
        const startDate = new Date(body.startDate);
        const endDate = body.endDate ? new Date(body.endDate) : null;
        const maxInstances = body.maxInstances || 52;
        
        const instances = parseCustomRecurrence(customDescription, startDate, endDate, maxInstances);
        
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
                totalInstances: instances.length
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