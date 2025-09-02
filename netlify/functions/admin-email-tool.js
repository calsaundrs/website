const { sendTemplatedEmail } = require('./services/email-service');
const fs = require('fs').promises;
const path = require('path');

const sampleData = {
    eventName: 'Sample Event Name',
    eventUrl: '#',
    venueName: 'Sample Venue',
    eventDate: new Date().toLocaleDateString(),
    submittedBy: 'test@example.com',
};

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { action, templateName, email } = JSON.parse(event.body);

        if (!action || !templateName) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Missing required fields: action and templateName' })
            };
        }

        const templatePath = path.join(__dirname, 'emails', 'templates', `${templateName}.html`);
        let html;
        try {
            html = await fs.readFile(templatePath, 'utf-8');
        } catch (e) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: `Template not found: ${templateName}`})
            }
        }

        for (const key in sampleData) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            html = html.replace(regex, sampleData[key]);
        }

        if (action === 'preview') {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'text/html' },
                body: html,
            };
        }

        if (action === 'send') {
            if (!email) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ message: 'Missing required field: email' })
                };
            }

            const fromEmail = process.env.FROM_EMAIL || 'noreply@email.brumoutloud.co.uk';

            const result = await sendTemplatedEmail({
                to: email,
                from: fromEmail,
                subject: `[TEST] ${templateName}`,
                templateName: templateName,
                data: sampleData,
            });

            if (!result.success) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({
                        message: 'Failed to send test email.',
                        error: result.error,
                    }),
                };
            }

            return {
                statusCode: 200,
                body: JSON.stringify({ message: `Test email sent to ${email}` })
            };
        }

        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Invalid action' })
        };

    } catch (error) {
        console.error('admin-email-tool: Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Error processing request', error: error.message })
        };
    }
};
