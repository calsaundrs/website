const Airtable = require('airtable');
const { sendTemplatedEmail } = require('./services/email-service');

exports.handler = async function(event, context) {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ message: 'Method not allowed' })
        };
    }

    try {
        const { id, type } = JSON.parse(event.body);
        
        if (!id || !type) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Missing required fields: id and type' })
            };
        }

        // Initialize Airtable
        const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
        
        let tableName;
        if (type === 'Event') {
            tableName = 'Events';
        } else if (type === 'Venue') {
            tableName = 'Venues';
        } else {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Invalid type. Must be "Event" or "Venue"' })
            };
        }

        console.log(`delete-submission: Deleting ${type} with ID: ${id}`);

        // First, find the record to get details for the email
        const record = await base(tableName).find(id);

        // Send rejection email if possible
        if (record && record.fields['Submitted By'] && type === 'Event') {
            const fromEmail = process.env.FROM_EMAIL || 'noreply@brumoutloud.co.uk';
            await sendTemplatedEmail({
                to: record.fields['Submitted By'],
                from: fromEmail,
                subject: 'Update on your event submission',
                templateName: 'rejection-confirmation',
                data: {
                    eventName: record.fields['Event Name'] || 'your event',
                },
            });
            console.log(`delete-submission: Rejection email sent to ${record.fields['Submitted By']}`);
        } else {
            console.log('delete-submission: No "Submitted By" field found or not an event, skipping email.');
        }

        // Now, delete the record
        await base(tableName).destroy(id);

        console.log(`delete-submission: Successfully deleted ${type} with ID: ${id}`);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `${type} deleted successfully`,
                id: id
            })
        };

    } catch (error) {
        console.error('delete-submission: Error:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Error deleting submission',
                error: error.message
            })
        };
    }
};