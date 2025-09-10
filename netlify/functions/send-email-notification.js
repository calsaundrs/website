const EmailService = require('./services/email-service');

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { type, data } = JSON.parse(event.body);
    const emailService = new EmailService();

    let result;

    switch (type) {
      case 'submission_confirmation':
        result = await emailService.sendSubmissionConfirmation(
          data.promoterEmail,
          data.eventName,
          data.eventId
        );
        break;

      case 'approval_notification':
        result = await emailService.sendApprovalNotification(
          data.promoterEmail,
          data.eventName,
          data.eventUrl
        );
        break;

      case 'rejection_notification':
        result = await emailService.sendRejectionNotification(
          data.promoterEmail,
          data.eventName,
          data.reason
        );
        break;

      case 'event_reminder':
        result = await emailService.sendEventReminder(
          data.promoterEmail,
          data.eventName,
          data.eventDate,
          data.eventUrl
        );
        break;

      case 'admin_submission_alert':
        result = await emailService.sendAdminSubmissionAlert(
          data.eventName,
          data.promoterEmail,
          data.eventId
        );
        break;

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid email type' })
        };
    }

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: result.success,
        messageId: result.messageId,
        error: result.error
      })
    };

  } catch (error) {
    console.error('Email notification error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: error.message 
      })
    };
  }
};
