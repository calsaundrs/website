#!/usr/bin/env node

require('dotenv').config();

const NotificationService = require('../netlify/functions/services/notification-service');

async function main() {
  const to = process.argv[2];

  if (!to) {
    console.error('Usage: node scripts/send-resend-test.js recipient@example.com');
    process.exit(1);
  }

  const notificationService = new NotificationService();

  try {
    const result = await notificationService.sendEmailNotification({
      to,
      subject: 'Brum Outloud Test Email',
      html: `<h1>Brum Outloud</h1><p>This is a Resend test email sent at ${new Date().toISOString()}</p>`,
      text: `Brum Outloud test email sent at ${new Date().toISOString()}`,
      type: 'test_email',
    });

    console.log('✅ Email attempt finished', result);
    process.exit(0);
  } catch (error) {
    console.error('❌ Email attempt failed', error);
    process.exit(1);
  }
}

main();


