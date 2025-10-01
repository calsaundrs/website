const { admin } = require('../utils/firebase-admin');
const fetch = require('node-fetch');
const EmailService = require('./email-service');

class NotificationService {
  constructor() {
    this.db = admin.firestore();
    this.collections = {
      mailbox: 'system_notifications',
      admin: 'admin_notifications',
      pushLogs: 'push_notifications',
    };
  }

  async sendEmailNotification(payload) {
    const emailService = new EmailService();
    const { to, subject, html, text, template, templateData } = payload;

    if (!to) {
      throw new Error('Email recipient (to) is required');
    }

    if (!subject) {
      throw new Error('Email subject is required');
    }

    if (!html && !template) {
      throw new Error('Email requires either html content or template');
    }

    let htmlContent = html;
    let textContent = text;

    if (template) {
      const rendered = this.renderTemplate(template, templateData || {});
      htmlContent = rendered.html;
      textContent = rendered.text;
    }

    const result = await emailService.sendEmail(to, subject, htmlContent, textContent);

    await this.recordNotification({
      channel: 'email',
      type: payload.type || 'system_email',
      title: subject,
      body: htmlContent,
      recipient: to,
      status: result.success ? 'sent' : 'failed',
      metadata: {
        messageId: result.messageId,
        template,
      },
    });

    return result;
  }

  renderTemplate(name, data) {
    const emailService = new EmailService();
    let html = '';

    switch (name) {
      case 'submission_confirmation':
        html = emailService.templates.getSubmissionConfirmationTemplate(data.eventName, data.eventId);
        break;
      case 'approval_notification':
        html = emailService.templates.getApprovalTemplate(data.eventName, data.eventUrl);
        break;
      case 'rejection_notification':
        html = emailService.templates.getRejectionTemplate(data.eventName, data.reason || 'Please review your submission and ensure all required information is provided.');
        break;
      case 'event_reminder':
        html = emailService.templates.getEventReminderTemplate(data.eventName, data.eventDate, data.eventUrl);
        break;
      case 'admin_submission_alert':
        html = emailService.templates.getAdminSubmissionTemplate(data.eventName, data.promoterEmail, data.eventId);
        break;
      default:
        throw new Error(`Unknown email template: ${name}`);
    }

    return {
      html,
      text: emailService.templates.generatePlainText(name, data) || emailService.templates.getPlainTextVersion(html),
    };
  }

  async recordNotification(notification) {
    const doc = {
      ...notification,
      createdAt: new Date(),
      status: notification.status || 'pending',
      channel: notification.channel || 'system',
    };

    const ref = await this.db.collection(this.collections.mailbox).add(doc);
    return { id: ref.id, ...doc };
  }

  async sendPushNotification(payload) {
    const {
      type,
      title,
      body,
      data = {},
      requireInteraction = false,
    } = payload;

    if (!type || !title || !body) {
      throw new Error('type, title and body are required for push notifications');
    }

    const subscriptionsSnapshot = await this.db.collection('admin_push_subscriptions').get();
    const timestamp = new Date();
    const results = [];

    if (subscriptionsSnapshot.empty) {
      await this.logPushResult({
        status: 'skipped',
        reason: 'no_subscriptions',
        payload,
        timestamp,
      });
      return { sent: 0, failed: 0, results: [] };
    }

    for (const doc of subscriptionsSnapshot.docs) {
      const subscription = doc.data();
      try {
        await this.db.collection(this.collections.admin).add({
          type,
          title,
          body,
          data,
          timestamp,
          subscriptionId: doc.id,
          status: 'queued',
        });

        results.push({ id: doc.id, status: 'queued' });
      } catch (error) {
        console.error(`Failed to queue push notification for ${doc.id}:`, error);
        results.push({ id: doc.id, status: 'failed', error: error.message });
      }
    }

    await this.logPushResult({
      status: 'processed',
      payload,
      timestamp,
      results,
    });

    return {
      sent: results.filter(r => r.status === 'queued').length,
      failed: results.filter(r => r.status === 'failed').length,
      results,
    };
  }

  async logPushResult(record) {
    try {
      await this.db.collection(this.collections.pushLogs).add({
        ...record,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error('Failed to log push notification:', error);
    }
  }

  async triggerBuildHook() {
    const hook = process.env.NETLIFY_BUILD_HOOK || process.env.NETLIFY_BUILD_HOOK_URL;

    if (!hook) {
      return { success: false, message: 'Build hook not configured' };
    }

    const response = await fetch(hook, { method: 'POST' });

    if (!response.ok) {
      const message = `Build hook failed: ${response.status} ${response.statusText}`;
      console.error(message);
      return { success: false, message };
    }

    return { success: true, message: 'Build triggered' };
  }
}

module.exports = NotificationService;


