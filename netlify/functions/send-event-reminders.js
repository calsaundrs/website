const Airtable = require('airtable');
const { sendTemplatedEmail } = require('./services/email-service');

const AIRTABLE_PERSONAL_ACCESS_TOKEN = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const fromEmail = process.env.FROM_EMAIL || 'noreply@brumoutloud.co.uk';

exports.handler = async function(event, context) {
    console.log('send-event-reminders: Starting function execution');

    if (!AIRTABLE_PERSONAL_ACCESS_TOKEN || !AIRTABLE_BASE_ID) {
        console.error('send-event-reminders: Missing required environment variables');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Missing Airtable configuration' }),
        };
    }

    const base = new Airtable({ apiKey: AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(AIRTABLE_BASE_ID);

    try {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);

        const filterByFormula = `AND(
            {Status} = 'Approved',
            IS_AFTER({Date}, '${now.toISOString()}'),
            IS_BEFORE({Date}, '${tomorrow.toISOString()}')
        )`;

        console.log(`send-event-reminders: Using filter: ${filterByFormula}`);

        const records = await base('Events').select({
            filterByFormula: filterByFormula,
            fields: ['Event Name', 'Submitted By']
        }).all();

        console.log(`send-event-reminders: Found ${records.length} events to remind.`);

        for (const record of records) {
            const eventName = record.get('Event Name');
            const submittedBy = record.get('Submitted By');

            if (submittedBy) {
                console.log(`send-event-reminders: Sending reminder for "${eventName}" to ${submittedBy}`);
                await sendTemplatedEmail({
                    to: submittedBy,
                    from: fromEmail,
                    subject: `Reminder: Your event "${eventName}" is tomorrow!`,
                    templateName: 'event-reminder',
                    data: {
                        eventName: eventName,
                    },
                });
            } else {
                console.log(`send-event-reminders: No "Submitted By" for event "${eventName}", skipping.`);
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: `Sent ${records.length} reminders.` }),
        };

    } catch (error) {
        console.error('send-event-reminders: Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to send event reminders' }),
        };
    }
};
