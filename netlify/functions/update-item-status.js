const admin = require('firebase-admin');
const { verifyAuth } = require('./utils/auth');
const EmailService = require('./services/email-service');

exports.handler = async function (event, context) {
    console.log('Firestore-only status update called');

    try {
        // Verify authentication
        try {
            await verifyAuth(event);
        } catch (authError) {
            return {
                statusCode: authError.statusCode || 401,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: authError.message })
            };
        }

        // Check environment variables
        const required = [
            'FIREBASE_PROJECT_ID',
            'FIREBASE_CLIENT_EMAIL',
            'FIREBASE_PRIVATE_KEY'
        ];

        const missing = required.filter(varName => !process.env[varName]);
        if (missing.length > 0) {
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Environment configuration error',
                    message: `Missing environment variables: ${missing.join(', ')}`,
                    missing: missing
                })
            };
        }

        // Initialize Firebase
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

        // Parse request body
        const body = JSON.parse(event.body);
        const { itemId, newStatus, itemType, reason } = body;

        if (!itemId || !newStatus || !itemType) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Missing required parameters',
                    message: 'itemId, newStatus, and itemType are required'
                })
            };
        }

        console.log(`Updating ${itemType} ${itemId} to status: ${newStatus}`);

        // Determine collection based on item type
        const collection = itemType === 'venue' ? 'venues' : 'events';

        // Update status in Firestore
        const docRef = db.collection(collection).doc(itemId);
        const doc = await docRef.get();

        if (!doc.exists) {
            return {
                statusCode: 404,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Item not found',
                    message: `${itemType} with ID ${itemId} not found`
                })
            };
        }

        // Update the document
        await docRef.update({
            status: newStatus.toLowerCase(),
            updatedAt: new Date()
        });

        console.log(`Successfully updated ${itemType} ${itemId} to status: ${newStatus}`);

        // Send promoter email notification. Pull contact + naming info
        // directly off the doc so the admin UI doesn't need to round-trip
        // them. Skips silently when no valid submitter email exists.
        let emailResult = null;
        try {
            const docData = doc.data() || {};
            const contactEmail = docData.submittedBy || docData.submitterEmail;
            const displayName  = docData.name || 'your submission';
            const slug         = docData.slug;

            const isAnonymous = !contactEmail || contactEmail === 'anonymous@brumoutloud.co.uk';
            if (!isAnonymous) {
                const emailService = new EmailService();
                const status = newStatus.toLowerCase();

                if (status === 'approved') {
                    const liveUrl = slug
                        ? `https://brumoutloud.co.uk/${itemType}/${slug}.html`
                        : 'https://brumoutloud.co.uk';
                    emailResult = await emailService.sendApprovalNotification(
                        contactEmail,
                        displayName,
                        liveUrl,
                        // Extra context the celebration template renders as
                        // a mini-poster. Safe to pass for venues too — the
                        // template only uses the fields it's given.
                        {
                            image: docData.image || docData.imageUrl,
                            eventDate: docData.eventDate,
                            eventTime: docData.eventTime,
                            venueName: docData.venueName || (docData.venue && docData.venue.name),
                        }
                    );
                    console.log('✅ Approval email dispatched:', emailResult?.messageId || emailResult?.error);
                } else if (status === 'rejected') {
                    emailResult = await emailService.sendRejectionNotification(
                        contactEmail,
                        displayName,
                        reason || 'Please review your submission and ensure all required information is provided.'
                    );
                    console.log('✅ Rejection email dispatched:', emailResult?.messageId || emailResult?.error);
                }
            } else {
                console.log('ℹ️ No valid submitter email on doc; skipping notification.');
            }
        } catch (notifyError) {
            // Never let email failure block the status update.
            console.error('❌ Email notification failed:', notifyError);
            emailResult = { success: false, error: notifyError.message };
        }

        // Trigger SSG rebuild if an event or venue was approved
        let ssgRebuildResult = null;
        if (newStatus.toLowerCase() === 'approved') {
            try {
                console.log(`${itemType} approved - triggering build hook...`);

                // Check if build hook URL is configured
                const buildHookUrl = process.env.NETLIFY_BUILD_HOOK_URL;

                if (buildHookUrl) {
                    // Trigger the build hook
                    const response = await fetch(buildHookUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });

                    if (response.ok) {
                        const buildId = await response.text();
                        ssgRebuildResult = {
                            success: true,
                            message: 'Build triggered successfully',
                            buildId: buildId
                        };
                        console.log('Build hook triggered successfully:', buildId);
                    } else {
                        throw new Error(`Build hook failed: ${response.status} ${response.statusText}`);
                    }
                } else {
                    console.log('NETLIFY_BUILD_HOOK_URL not configured - skipping build trigger');
                    ssgRebuildResult = {
                        success: false,
                        message: 'Build hook not configured'
                    };
                }
            } catch (error) {
                console.error('Error triggering build hook:', error);
                ssgRebuildResult = {
                    success: false,
                    message: error.message
                };
            }
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: `${itemType} status updated successfully`,
                itemId: itemId,
                newStatus: newStatus,
                itemType: itemType,
                ssgRebuild: ssgRebuildResult,
                emailSent: emailResult?.success || false,
                emailError: emailResult?.error,
                note: 'This update was processed using Firestore only'
            })
        };

    } catch (error) {
        console.error('Error in Firestore-only status update:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.toString()
            })
        };
    }
};