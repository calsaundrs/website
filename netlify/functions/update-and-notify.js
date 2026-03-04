const admin = require('firebase-admin');
const EmailService = require('./services/email-service');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined
        }),
    });
}

const db = admin.firestore();

exports.handler = async function (event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    try {
        const { id, type, name, contactEmail, newStatus, reason } = JSON.parse(event.body);

        if (!id || !type || !name || !newStatus) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Missing required parameters.' }) };
        }

        // Update status in Firestore
        const docRef = db.collection(type.toLowerCase() + 's').doc(id);
        await docRef.update({
            status: newStatus.toLowerCase(),
            updatedAt: new Date()
        });

        if (!contactEmail) {
            console.log(`No contactEmail provided for ${type} '${name}'. Skipping notification.`);
            return {
                statusCode: 200,
                body: JSON.stringify({ success: true, message: `Submission status set to ${newStatus}. No notification sent.` }),
            };
        }

        // Send email notification using the new email service
        const emailService = new EmailService();
        let emailResult;

        if (newStatus === 'Approved') {
            // Get the event/venue document to get the slug
            const doc = await docRef.get();
            const docData = doc.data();
            const slug = docData.slug;
            const liveUrl = slug ? `https://brumoutloud.co.uk/${type.toLowerCase()}/${slug}` : `https://brumoutloud.co.uk`;

            emailResult = await emailService.sendApprovalNotification(
                contactEmail,
                name,
                liveUrl
            );
        } else if (newStatus === 'Rejected') {
            emailResult = await emailService.sendRejectionNotification(
                contactEmail,
                name,
                reason || 'Please review your submission and ensure all required information is provided.'
            );
        }

        if (emailResult && emailResult.success) {
            console.log('✅ Email notification sent successfully');
        } else {
            console.error('❌ Email notification failed:', emailResult?.error);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: `Submission status set to ${newStatus} and notification sent.`,
                emailSent: emailResult?.success || false
            }),
        };

    } catch (error) {
        console.error("Error processing submission update:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, message: error.toString() }),
        };
    }
};
