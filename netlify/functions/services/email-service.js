const { Resend } = require('resend');
const admin = require('firebase-admin');
const EmailTemplates = require('./email-templates');
const { sign: signResubmitToken } = require('../utils/resubmit-token');

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
    // (brumoutloud.co.uk) is NOT verified in Resend — only
    // email.brumoutloud.co.uk — so sending from @brumoutloud.co.uk
    // returns 403. Override via RESEND_FROM if the verified address
    // changes.
    this.fromEmail = process.env.RESEND_FROM || 'Brum Outloud <hello@email.brumoutloud.co.uk>';
    // Where replies go — the apex address the user actually checks.
    this.replyTo   = process.env.RESEND_REPLY_TO || 'hello@brumoutloud.co.uk';
    // Admin address(es) — comma-separated ADMIN_EMAIL env var wins;
    // the fallback routes to the watched domain inbox so submission
    // alerts never land in a shared mailbox that isn't monitored.
    const raw = process.env.ADMIN_EMAIL || 'callum@brumoutloud.co.uk';
    this.adminRecipients = raw.split(',').map(s => s.trim()).filter(Boolean);
    this.adminEmail = this.adminRecipients[0]; // back-compat
    this.templates = new EmailTemplates();
    // One-click unsubscribe endpoint — must return 200 OK.
    this.unsubscribeUrl = `${this.templates.siteUrl}/unsubscribe.html`;
  }

  /**
   * Send email via Resend. Accepts a single address or an array.
   * `content` can be either { html, text } or a raw HTML string for
   * back-compat with older callers.
   */
  async sendEmail(to, subject, content, legacyTextContent = null) {
    const { html, text } = typeof content === 'string'
      ? { html: content, text: legacyTextContent }
      : (content || {});

    const recipients = Array.isArray(to) ? to : [to];

    // Bake the unsubscribe URL into the template placeholder. Base
    // template emits {{unsubscribe}} in the footer; replace here so
    // the same HTML body can be resent later without re-templating.
    const htmlBody = (html || '').replace(/\{\{unsubscribe\}\}/g, this.unsubscribeUrl);

    try {
      const emailData = {
        from: this.fromEmail,
        to: recipients,
        reply_to: this.replyTo,
        subject,
        html: htmlBody,
        ...(text && { text }),
        // Gmail + Apple Mail look for List-Unsubscribe to render the
        // native "unsubscribe" UI and to avoid spam-folder penalties.
        // Link-only variant is used here until a one-click POST
        // endpoint exists (RFC 8058 requires one for -Post header).
        headers: {
          'List-Unsubscribe': `<${this.unsubscribeUrl}>`,
        },
      };

      console.log('📧 Sending email:', { to: recipients, subject });

      const result = await resend.emails.send(emailData);

      // Resend's SDK does NOT throw on 4xx/5xx — it returns
      // { data: null, error: { ... } }. Treat that as a failure so
      // the log status matches reality.
      if (result.error) {
        throw new Error(result.error.message || result.error.name || 'Resend error');
      }

      await this.logEmail({
        to: recipients.join(', '),
        subject,
        status: 'sent',
        messageId: result.data?.id,
        sentAt: new Date(),
        content: { html: htmlBody, text },
      });

      console.log('✅ Email sent successfully:', result.data?.id);
      return { success: true, messageId: result.data?.id };

    } catch (error) {
      console.error('❌ Email sending failed:', error);

      await this.logEmail({
        to: recipients.join(', '),
        subject,
        status: 'failed',
        error: error.message,
        sentAt: new Date(),
        content: { html: htmlBody, text },
      });

      return { success: false, error: error.message };
    }
  }

  async logEmail(emailLog) {
    try {
      await db.collection('email_logs').add({
        ...emailLog,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error('Failed to log email:', error);
    }
  }

  async getEmailLogs(limit = 50, status = null) {
    try {
      let query = db.collection('email_logs').orderBy('sentAt', 'desc').limit(limit);
      if (status) query = query.where('status', '==', status);
      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Failed to get email logs:', error);
      return [];
    }
  }

  async resendEmail(logId) {
    try {
      const logDoc = await db.collection('email_logs').doc(logId).get();
      if (!logDoc.exists) throw new Error('Email log not found');
      const logData = logDoc.data();
      return await this.sendEmail(
        logData.to,
        logData.subject,
        { html: logData.content?.html, text: logData.content?.text }
      );
    } catch (error) {
      console.error('Failed to resend email:', error);
      return { success: false, error: error.message };
    }
  }

  // ---- Per-template senders ---------------------------------------------
  // Subject lines deliberately contain no leading emojis — the 2026
  // Gmail/Outlook spam heuristics treat "🎉 / 🔔 / ⚠️" prefixes as a
  // mild negative signal, especially on new subdomains.

  async sendSubmissionConfirmation(promoterEmail, eventName, eventId) {
    const subject = `Submission received — ${eventName}`;
    return await this.sendEmail(
      promoterEmail,
      subject,
      this.templates.getSubmissionConfirmationTemplate(eventName, eventId)
    );
  }

  /**
   * `extras` is optional; when provided, the approval template
   * renders a mini-poster with the flyer image + date/venue meta.
   * Supported keys: { image, eventDate, eventTime, venueName }.
   */
  async sendApprovalNotification(promoterEmail, eventName, eventUrl, extras = {}) {
    const subject = `You're live on Brum Outloud — ${eventName}`;
    return await this.sendEmail(
      promoterEmail,
      subject,
      this.templates.getApprovalTemplate(eventName, eventUrl, extras)
    );
  }

  /**
   * Promoter rejection email. When `docId` is provided we mint a
   * signed resubmit token so the Edit & resubmit button deep-links
   * into the form with all the original fields prefilled. Token
   * signing can fail if RESUBMIT_TOKEN_SECRET isn't set — in that
   * case we fall back to the plain /submit link rather than blocking
   * the whole rejection email.
   */
  async sendRejectionNotification(promoterEmail, eventName, reason, { docId } = {}) {
    const subject = `Submission update — ${eventName}`;
    let resubmitUrl;
    if (docId) {
      try {
        const token = signResubmitToken(docId);
        resubmitUrl = `${this.templates.siteUrl}/promoter-submit-new?resubmit=${encodeURIComponent(token)}`;
      } catch (err) {
        console.warn('Could not mint resubmit token; falling back to plain /submit:', err.message);
      }
    }
    return await this.sendEmail(
      promoterEmail,
      subject,
      this.templates.getRejectionTemplate(eventName, reason, { resubmitUrl })
    );
  }

  async sendEventReminder(promoterEmail, eventName, eventDate, eventUrl) {
    const subject = `Tomorrow: ${eventName}`;
    return await this.sendEmail(
      promoterEmail,
      subject,
      this.templates.getEventReminderTemplate(eventName, eventDate, eventUrl)
    );
  }

  /**
   * Admin submission alert. Fires for every submission — including
   * anonymous ones — so nothing slips past the queue. Routes to the
   * full adminRecipients list.
   */
  async sendAdminSubmissionAlert(eventName, promoterEmail, eventId) {
    const displayPromoter = promoterEmail || 'anonymous submitter';
    const subject = `New submission — ${eventName}`;
    return await this.sendEmail(
      this.adminRecipients,
      subject,
      this.templates.getAdminSubmissionTemplate(eventName, displayPromoter, eventId)
    );
  }
}

module.exports = EmailService;
