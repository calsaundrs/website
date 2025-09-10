const { Resend } = require('resend');
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();
const resend = new Resend(process.env.RESEND_API_KEY);

class EmailService {
  constructor() {
    this.fromEmail = 'Brum Outloud <hello@brumoutloud.co.uk>';
    this.adminEmail = process.env.ADMIN_EMAIL || 'admin@brumoutloud.co.uk';
  }

  /**
   * Send email using Resend API
   */
  async sendEmail(to, subject, htmlContent, textContent = null) {
    try {
      const emailData = {
        from: this.fromEmail,
        to: [to],
        subject: subject,
        html: htmlContent,
        ...(textContent && { text: textContent })
      };

      console.log('📧 Sending email:', { to, subject });
      
      const result = await resend.emails.send(emailData);
      
      // Log email to Firestore
      await this.logEmail({
        to,
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
        to,
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
    const htmlContent = this.getSubmissionConfirmationTemplate(eventName, eventId);
    const textContent = this.getSubmissionConfirmationText(eventName, eventId);

    return await this.sendEmail(promoterEmail, subject, htmlContent, textContent);
  }

  /**
   * Send promoter approval notification
   */
  async sendApprovalNotification(promoterEmail, eventName, eventUrl) {
    const subject = `🎉 Your Event is Live! - "${eventName}"`;
    const htmlContent = this.getApprovalTemplate(eventName, eventUrl);
    const textContent = this.getApprovalText(eventName, eventUrl);

    return await this.sendEmail(promoterEmail, subject, htmlContent, textContent);
  }

  /**
   * Send promoter rejection notification
   */
  async sendRejectionNotification(promoterEmail, eventName, reason) {
    const subject = `⚠️ Event Submission Update - "${eventName}"`;
    const htmlContent = this.getRejectionTemplate(eventName, reason);
    const textContent = this.getRejectionText(eventName, reason);

    return await this.sendEmail(promoterEmail, subject, htmlContent, textContent);
  }

  /**
   * Send event reminder to promoter
   */
  async sendEventReminder(promoterEmail, eventName, eventDate, eventUrl) {
    const subject = `📅 Reminder: Your Event is Tomorrow - "${eventName}"`;
    const htmlContent = this.getEventReminderTemplate(eventName, eventDate, eventUrl);
    const textContent = this.getEventReminderText(eventName, eventDate, eventUrl);

    return await this.sendEmail(promoterEmail, subject, htmlContent, textContent);
  }

  /**
   * Send admin notification for new submission
   */
  async sendAdminSubmissionAlert(eventName, promoterEmail, eventId) {
    const subject = `🔔 New Event Submission - "${eventName}"`;
    const htmlContent = this.getAdminSubmissionTemplate(eventName, promoterEmail, eventId);
    const textContent = this.getAdminSubmissionText(eventName, promoterEmail, eventId);

    return await this.sendEmail(this.adminEmail, subject, htmlContent, textContent);
  }

  // Email Templates
  getSubmissionConfirmationTemplate(eventName, eventId) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Event Submitted Successfully</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎉 Event Submitted Successfully!</h1>
        </div>
        <div class="content">
          <h2>Thank you for your submission!</h2>
          <p>We've received your event submission for <strong>"${eventName}"</strong> and it's now in our review queue.</p>
          
          <h3>What happens next?</h3>
          <ul>
            <li>Our team will review your event details</li>
            <li>We'll check that all information is complete and accurate</li>
            <li>You'll receive an email once your event is approved or if we need any changes</li>
          </ul>
          
          <p><strong>Event ID:</strong> ${eventId}</p>
          <p>Keep this ID handy for any future reference.</p>
          
          <a href="https://brumoutloud.co.uk/promoter-tool" class="button">View Promoter Tools</a>
        </div>
        <div class="footer">
          <p>Thanks for contributing to Birmingham's LGBTQ+ community!</p>
          <p><strong>The Brum Outloud Team</strong></p>
        </div>
      </body>
      </html>
    `;
  }

  getSubmissionConfirmationText(eventName, eventId) {
    return `
Event Submitted Successfully!

Thank you for your submission!

We've received your event submission for "${eventName}" and it's now in our review queue.

What happens next?
- Our team will review your event details
- We'll check that all information is complete and accurate
- You'll receive an email once your event is approved or if we need any changes

Event ID: ${eventId}
Keep this ID handy for any future reference.

View Promoter Tools: https://brumoutloud.co.uk/promoter-tool

Thanks for contributing to Birmingham's LGBTQ+ community!

The Brum Outloud Team
    `;
  }

  getApprovalTemplate(eventName, eventUrl) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Event is Live!</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎉 Your Event is Live!</h1>
        </div>
        <div class="content">
          <h2>Great news!</h2>
          <p>Your event <strong>"${eventName}"</strong> has been approved and is now live on Brum Outloud!</p>
          
          <p>You can now:</p>
          <ul>
            <li>Share your event with the community</li>
            <li>View your event page</li>
            <li>Track engagement and attendance</li>
          </ul>
          
          <a href="${eventUrl}" class="button">View Your Event</a>
          
          <h3>Share Your Event</h3>
          <p>Help spread the word! Share your event on social media and with your network.</p>
        </div>
        <div class="footer">
          <p>Thanks for contributing to Birmingham's LGBTQ+ community!</p>
          <p><strong>The Brum Outloud Team</strong></p>
        </div>
      </body>
      </html>
    `;
  }

  getApprovalText(eventName, eventUrl) {
    return `
Your Event is Live!

Great news!

Your event "${eventName}" has been approved and is now live on Brum Outloud!

You can now:
- Share your event with the community
- View your event page
- Track engagement and attendance

View Your Event: ${eventUrl}

Share Your Event
Help spread the word! Share your event on social media and with your network.

Thanks for contributing to Birmingham's LGBTQ+ community!

The Brum Outloud Team
    `;
  }

  getRejectionTemplate(eventName, reason) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Event Submission Update</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #ff9800; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .reason-box { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>⚠️ Event Submission Update</h1>
        </div>
        <div class="content">
          <h2>Thank you for your submission</h2>
          <p>We've reviewed your event submission for <strong>"${eventName}"</strong> and need some additional information before we can approve it.</p>
          
          <div class="reason-box">
            <h3>Feedback from our team:</h3>
            <p>${reason}</p>
          </div>
          
          <p>Don't worry - this is common and easily fixed! Please:</p>
          <ul>
            <li>Review the feedback above</li>
            <li>Make the necessary changes</li>
            <li>Resubmit your event using our promoter tools</li>
          </ul>
          
          <a href="https://brumoutloud.co.uk/promoter-tool" class="button">Resubmit Your Event</a>
          
          <p>If you have any questions, feel free to reach out to us.</p>
        </div>
        <div class="footer">
          <p>Thanks for your patience and for contributing to Birmingham's LGBTQ+ community!</p>
          <p><strong>The Brum Outloud Team</strong></p>
        </div>
      </body>
      </html>
    `;
  }

  getRejectionText(eventName, reason) {
    return `
Event Submission Update

Thank you for your submission

We've reviewed your event submission for "${eventName}" and need some additional information before we can approve it.

Feedback from our team:
${reason}

Don't worry - this is common and easily fixed! Please:
- Review the feedback above
- Make the necessary changes
- Resubmit your event using our promoter tools

Resubmit Your Event: https://brumoutloud.co.uk/promoter-tool

If you have any questions, feel free to reach out to us.

Thanks for your patience and for contributing to Birmingham's LGBTQ+ community!

The Brum Outloud Team
    `;
  }

  getEventReminderTemplate(eventName, eventDate, eventUrl) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Event Reminder</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📅 Event Reminder</h1>
        </div>
        <div class="content">
          <h2>Your event is tomorrow!</h2>
          <p>Just a friendly reminder that your event <strong>"${eventName}"</strong> is scheduled for <strong>${eventDate}</strong>.</p>
          
          <p>Make sure you're all set:</p>
          <ul>
            <li>Double-check your event details</li>
            <li>Share on social media one more time</li>
            <li>Prepare for a great event!</li>
          </ul>
          
          <a href="${eventUrl}" class="button">View Your Event</a>
          
          <p>Good luck with your event! We hope it's a huge success.</p>
        </div>
        <div class="footer">
          <p>Thanks for contributing to Birmingham's LGBTQ+ community!</p>
          <p><strong>The Brum Outloud Team</strong></p>
        </div>
      </body>
      </html>
    `;
  }

  getEventReminderText(eventName, eventDate, eventUrl) {
    return `
Event Reminder

Your event is tomorrow!

Just a friendly reminder that your event "${eventName}" is scheduled for ${eventDate}.

Make sure you're all set:
- Double-check your event details
- Share on social media one more time
- Prepare for a great event!

View Your Event: ${eventUrl}

Good luck with your event! We hope it's a huge success.

Thanks for contributing to Birmingham's LGBTQ+ community!

The Brum Outloud Team
    `;
  }

  getAdminSubmissionTemplate(eventName, promoterEmail, eventId) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Event Submission</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #9C27B0 0%, #7B1FA2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #9C27B0; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .info-box { background: #e3f2fd; border: 1px solid #bbdefb; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🔔 New Event Submission</h1>
        </div>
        <div class="content">
          <h2>Action Required</h2>
          <p>A new event has been submitted and is waiting for your review.</p>
          
          <div class="info-box">
            <h3>Event Details:</h3>
            <p><strong>Event Name:</strong> ${eventName}</p>
            <p><strong>Promoter Email:</strong> ${promoterEmail}</p>
            <p><strong>Event ID:</strong> ${eventId}</p>
            <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <p>Please review this submission as soon as possible to ensure timely approval for the promoter.</p>
          
          <a href="https://brumoutloud.co.uk/admin-approvals.html" class="button">Review Submission</a>
        </div>
        <div class="footer">
          <p>Brum Outloud Admin System</p>
        </div>
      </body>
      </html>
    `;
  }

  getAdminSubmissionText(eventName, promoterEmail, eventId) {
    return `
New Event Submission

Action Required

A new event has been submitted and is waiting for your review.

Event Details:
- Event Name: ${eventName}
- Promoter Email: ${promoterEmail}
- Event ID: ${eventId}
- Submitted: ${new Date().toLocaleString()}

Please review this submission as soon as possible to ensure timely approval for the promoter.

Review Submission: https://brumoutloud.co.uk/admin-approvals.html

Brum Outloud Admin System
    `;
  }
}

module.exports = EmailService;
