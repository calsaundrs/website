const admin = require('firebase-admin');
const { sendTemplatedEmail } = require('./services/email-service');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        })
    });
}
const db = admin.firestore();

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { logId } = JSON.parse(event.body);

        if (!logId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Missing required field: logId' })
            };
        }

        const logDoc = await db.collection('email_logs').doc(logId).get();
        if (!logDoc.exists) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: 'Email log not found' })
            };
        }

        const logData = logDoc.data();

        if (!logData.templateName || !logData.templateData) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Cannot resend email: template information is missing from the log.' })
            };
        }

        await sendTemplatedEmail({
            to: logData.to,
            from: logData.from,
            subject: logData.subject,
            templateName: logData.templateName,
            data: logData.templateData,
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ message: `Email resent successfully to ${logData.to}` })
        };

    } catch (error) {
        console.error('resend-email: Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Error resending email', error: error.message })
        };
    }
};
