const { admin } = require('./utils/firebase-admin');
const NotificationService = require('./services/notification-service');

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
        
        const notificationService = new NotificationService();
        let emailResult;

        if (newStatus === 'Approved') {
            // Get the event/venue document to get the slug
            const doc = await docRef.get();
            const docData = doc.data();
            const slug = docData.slug;
            const liveUrl = slug ? `https://brumoutloud.co.uk/${type.toLowerCase()}/${slug}` : `https://brumoutloud.co.uk`;
            
            emailResult = await notificationService.sendEmailNotification({
                to: contactEmail,
                subject: `🎉 ${type} Approved - "${name}"`,
                template: 'approval_notification',
                templateData: {
                    eventName: name,
                    eventUrl: liveUrl,
                    promoImage: docData.promoImage,
                    eventDate: docData.eventDate,
                    venueName: docData.venueName
                },
                type: 'approval_notification',
            });
        } else if (newStatus === 'Rejected') {
            emailResult = await notificationService.sendEmailNotification({
                to: contactEmail,
                subject: `⚠️ ${type} Update - "${name}"`,
                template: 'rejection_notification',
                templateData: {
                    eventName: name,
                    reason: reason || 'Please review your submission and ensure all required information is provided.',
                },
                type: 'rejection_notification',
            });
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
