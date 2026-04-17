const { Resend } = require('resend');
const admin = require('firebase-admin');
const EmailTemplates = require('./email-templates');

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
const resend = new Resend(process.env.RESEND_API_KEY);

class EmailService {
  constructor() {
    // Sends from the verified Resend subdomain. The apex
    // (brumoutloud.co.uk) is NOT verified in Resend — only the mail
    // subdomain — so sending from @brumoutloud.co.uk gets a 403.
    // Override via RESEND_FROM if you verify a different address.
    this.fromEmail = process.env.RESEND_FROM || 'Brum Outloud <hello@email.brumoutloud.co.uk>';
    // Admin address(es) — comma-separated ADMIN_EMAIL env var wins; the
    // fallback routes directly to Cal's personal inbox so submission
    // alerts never land in a shared mailbox that isn't watched.
    const raw = process.env.ADMIN_EMAIL || 'csaunders339@gmail.com';
    this.adminRecipients = raw.split(',').map(s => s.trim()).filter(Boolean);
    this.adminEmail = this.adminRecipients[0]; // back-compat
    this.templates = new EmailTemplates();
  }

  /**
   * Send email using Resend API. `to` may be a string or an array of
   * recipient addresses.
   */
  async sendEmail(to, subject, htmlContent, textContent = null) {
    try {
      const recipients = Array.isArray(to) ? to : [to];
      const emailData = {
        from: this.fromEmail,
        to: recipients,
        subject: subject,
        html: htmlContent,
        ...(textContent && { text: textContent })
      };

      console.log('📧 Sending email:', { to: recipients, subject });

      const result = await resend.emails.send(emailData);

      // The Resend SDK does NOT throw on error — it returns
      // { data: null, error: { ... } }. Treat that as a failure so the
      // admin-email-logs UI doesn't show a phantom "sent" entry and so
      // the handler's `success` field is actually truthful.
      if (result.error) {
        throw new Error(result.error.message || result.error.name || 'Resend error');
      }

      await this.logEmail({
        to: recipients.join(', '),
        subject,
        status: 'sent',
        messageId: result.data?.id,
        sentAt: new Date(),
        content: { html: htmlContent, text: textContent }
      });

      console.log('✅ Email sent successfully:', result.data?.id);
      return { success: true, messageId: result.data?.id };

    } catch (error) {
      console.error('❌ Email sending failed:', error);

      // Log failed email
      await this.logEmail({
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        status: 'failed',
        error: error.message,
        sentAt: new Date(),
        content: { html: htmlContent, text: textContent }
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Log email to Firestore for tracking and management
   */
  async logEmail(emailLog) {
    try {
      await db.collection('email_logs').add({
        ...emailLog,
        createdAt: new Date()
      });
    } catch (error) {
      console.error('Failed to log email:', error);
    }
  }

  /**
   * Get email logs for admin management
   */
  async getEmailLogs(limit = 50, status = null) {
    try {
      let query = db.collection('email_logs').orderBy('sentAt', 'desc').limit(limit);

      if (status) {
        query = query.where('status', '==', status);
      }

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Failed to get email logs:', error);
      return [];
    }
  }

  /**
   * Resend a failed email
   */
  async resendEmail(logId) {
    try {
      const logDoc = await db.collection('email_logs').doc(logId).get();
      if (!logDoc.exists) {
        throw new Error('Email log not found');
      }

      const logData = logDoc.data();
      const result = await this.sendEmail(
        logData.to,
        logData.subject,
        logData.content.html,
        logData.content.text
      );

      return result;
    } catch (error) {
      console.error('Failed to resend email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send promoter submission confirmation
   */
  async sendSubmissionConfirmation(promoterEmail, eventName, eventId) {
    const subject = `✅ Event Submitted Successfully - "${eventName}"`;
    const htmlContent = this.templates.getSubmissionConfirmationTemplate(eventName, eventId);
    const textContent = this.templates.getPlainTextVersion(htmlContent);

    return await this.sendEmail(promoterEmail, subject, htmlContent, textContent);
  }

  /**
   * Send promoter approval notification
   */
  async sendApprovalNotification(promoterEmail, eventName, eventUrl) {
    const subject = `🎉 Your Event is Live! - "${eventName}"`;
    const htmlContent = this.templates.getApprovalTemplate(eventName, eventUrl);
    const textContent = this.templates.getPlainTextVersion(htmlContent);

    return await this.sendEmail(promoterEmail, subject, htmlContent, textContent);
  }

  /**
   * Send promoter rejection notification
   */
  async sendRejectionNotification(promoterEmail, eventName, reason) {
    const subject = `⚠️ Event Submission Update - "${eventName}"`;
    const htmlContent = this.templates.getRejectionTemplate(eventName, reason);
    const textContent = this.templates.getPlainTextVersion(htmlContent);

    return await this.sendEmail(promoterEmail, subject, htmlContent, textContent);
  }

  /**
   * Send event reminder to promoter
   */
  async sendEventReminder(promoterEmail, eventName, eventDate, eventUrl) {
    const subject = `📅 Reminder: Your Event is Tomorrow - "${eventName}"`;
    const htmlContent = this.templates.getEventReminderTemplate(eventName, eventDate, eventUrl);
    const textContent = this.templates.getPlainTextVersion(htmlContent);

    return await this.sendEmail(promoterEmail, subject, htmlContent, textContent);
  }

  /**
   * Send admin notification for new submission. Fires for every
   * submission — including anonymous ones where the promoter didn't
   * provide an email — so Cal gets an inbox alert whenever something
   * needs reviewing. Routes to the full adminRecipients list.
   */
  async sendAdminSubmissionAlert(eventName, promoterEmail, eventId) {
    const displayPromoter = promoterEmail || 'anonymous submitter';
    const subject = `🔔 New Event Submission - "${eventName}"`;
    const htmlContent = this.templates.getAdminSubmissionTemplate(eventName, displayPromoter, eventId);
    const textContent = this.templates.getPlainTextVersion(htmlContent);

    return await this.sendEmail(this.adminRecipients, subject, htmlContent, textContent);
  }



}

module.exports = EmailService;
