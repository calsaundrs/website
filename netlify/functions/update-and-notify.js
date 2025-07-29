const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);

exports.handler = async function (event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    try {
        const { id, type, name, contactEmail, newStatus, reason } = JSON.parse(event.body);

        if (!id || !type || !name || !newStatus) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Missing required parameters.' }) };
        }

        const table = type === 'Event' ? base('Events') : base('Venues');
        const updatedRecords = await table.update([{
            id: id,
            fields: { "Status": newStatus }
        }]);

        if (!contactEmail) {
            console.log(`No contactEmail provided for ${type} '${name}'. Skipping notification.`);
            return {
                statusCode: 200,
                body: JSON.stringify({ success: true, message: `Submission status set to ${newStatus}. No notification sent.` }),
            };
        }
        
        let subject = '';
        let body = '';

        if (newStatus === 'Approved') {
            const recordSlug = updatedRecords[0].fields.Slug;
            const liveUrl = recordSlug ? `https://brumoutloud.co.uk/${type.toLowerCase()}/${recordSlug}` : `https://brumoutloud.co.uk`;
            
            subject = 'Your submission has been approved!';
            body = `Great news! Your submission for "${name}" has been approved and is now live on Brum Outloud.

You can view your ${type.toLowerCase()} at: ${liveUrl}

Thank you for contributing to Birmingham's LGBTQ+ community!

The Brum Outloud Team`;
        } else if (newStatus === 'Rejected') {
            subject = 'Update on your submission';
            body = `Thank you for your submission to Brum Outloud.

Unfortunately, we are unable to approve your ${type.toLowerCase()} "${name}" at this time.

${reason ? `Reason: ${reason}` : ''}

If you have any questions or would like to submit a revised version, please visit our promoter tools: https://brumoutloud.co.uk/promoter-tool

The Brum Outloud Team`;
        }

        const mail = { from: 'hello@brumoutloud.co.uk', to: contactEmail, subject: subject, text: body };
        console.log('--- EMAIL TO BE SENT ---');
        console.log(JSON.stringify(mail, null, 2));

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: `Submission status set to ${newStatus} and notification logged.` }),
        };

    } catch (error) {
        console.error("Error processing submission update:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, message: error.toString() }),
        };
    }
};
