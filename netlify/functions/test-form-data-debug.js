exports.handler = async function (event, context) {
    console.log('Form data debug test called');
    
    try {
        console.log('Event headers:', event.headers);
        console.log('Event body length:', event.body ? event.body.length : 0);
        console.log('Content-Type:', event.headers['content-type']);
        
        // Parse form data manually
        let fields = {};
        
        if (event.body) {
            // Handle multipart form data
            const boundary = event.headers['content-type']?.split('boundary=')[1];
            console.log('Boundary:', boundary);
            
            if (boundary) {
                const parts = event.body.split(`--${boundary}`);
                console.log('Number of parts:', parts.length);
                
                for (let i = 0; i < parts.length; i++) {
                    const part = parts[i];
                    console.log(`Part ${i}:`, part.substring(0, 200) + '...');
                    
                    if (part.includes('Content-Disposition: form-data')) {
                        const nameMatch = part.match(/name="([^"]+)"/);
                        if (nameMatch) {
                            const fieldName = nameMatch[1];
                            const valueMatch = part.match(/\r?\n\r?\n([\s\S]*?)(?=\r?\n--|$)/);
                            if (valueMatch) {
                                fields[fieldName] = valueMatch[1].trim();
                                console.log(`Field ${fieldName}:`, fields[fieldName]);
                            }
                        }
                    }
                }
            } else {
                // Handle URL-encoded form data
                console.log('Parsing as URL-encoded data');
                const params = new URLSearchParams(event.body);
                for (const [key, value] of params) {
                    fields[key] = value;
                    console.log(`Field ${key}:`, value);
                }
            }
        }
        
        console.log('Final parsed fields:', fields);
        
        // Test date parsing
        const testDate = fields.date || '2025-01-27';
        const testTime = fields['start-time'] || '20:00';
        console.log('Test date:', testDate);
        console.log('Test time:', testTime);
        
        let parsedDate;
        try {
            parsedDate = new Date(`${testDate}T${testTime}`);
            console.log('Parsed date:', parsedDate);
            console.log('Is valid date:', !isNaN(parsedDate.getTime()));
        } catch (error) {
            console.error('Date parsing error:', error);
        }
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Form data debug completed',
                receivedFields: fields,
                fieldCount: Object.keys(fields).length,
                testDate: testDate,
                testTime: testTime,
                parsedDate: parsedDate ? parsedDate.toISOString() : null,
                isValidDate: parsedDate ? !isNaN(parsedDate.getTime()) : false
            })
        };
        
    } catch (error) {
        console.error('Form data debug failed:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Form data debug failed',
                message: error.message,
                type: error.constructor.name,
                stack: error.stack
            })
        };
    }
};