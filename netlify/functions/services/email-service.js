const { Resend } = require('resend');
const fs = require('fs').promises;
const path = require('path');
const admin = require('firebase-admin');

// Initialize Firebase Admin
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

const resend = new Resend(process.env.RESEND_API_KEY);

async function logEmail({ to, from, subject, status, error, templateName, templateData }) {
    try {
        await db.collection('email_logs').add({
            to,
            from,
            subject,
            status,
            error: error || null,
            templateName: templateName || null,
            templateData: templateData || null,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (logError) {
        console.error('Failed to log email:', logError);
    }
}

async function sendEmail({ to, from, subject, html, templateName, templateData }) {
  let status = 'sent';
  let error = null;

  try {
    const { data, error: sendError } = await resend.emails.send({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    });

    if (sendError) {
        status = 'failed';
        error = sendError;
        console.error('Error sending email:', sendError);
    } else {
        console.log('Email sent successfully:', data);
    }

    await logEmail({ to, from, subject, status, error, templateName, templateData });

    if (status === 'failed') {
        return { success: false, error };
    }
    return { success: true, data };

  } catch (catchError) {
    status = 'failed';
    error = catchError;
    console.error('Failed to send email:', catchError);
    await logEmail({ to, from, subject, status, error: { message: catchError.message, stack: catchError.stack }, templateName, templateData });
    return { success: false, error: catchError };
  }
}

async function sendTemplatedEmail({ to, from, subject, templateName, data }) {
  try {
    const templatePath = path.join(__dirname, '..', 'emails', 'templates', `${templateName}.html`);
    let html = await fs.readFile(templatePath, 'utf-8');

    for (const key in data) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, data[key]);
    }

    return await sendEmail({ to, from, subject, html, templateName: templateName, templateData: data });
  } catch (error) {
    console.error(`Failed to send templated email (${templateName}):`, error);
    return { success: false, error };
  }
}

module.exports = { sendEmail, sendTemplatedEmail };
