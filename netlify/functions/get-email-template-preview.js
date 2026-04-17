const EmailTemplates = require('./services/email-templates');

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const templates = new EmailTemplates();
    const { templateType, data } = event.queryStringParameters || {};

    if (!templateType) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Template type is required' })
      };
    }

    let htmlContent = '';
    let subject = '';

    // Sample data for previews
    const sampleData = {
      eventName: data?.eventName || 'Pride Night at The Village Inn',
      eventId: data?.eventId || 'pride-night-2024-001',
      eventUrl: data?.eventUrl || 'https://brumoutloud.co.uk/event/pride-night-village-inn',
      eventDate: data?.eventDate || '2024-01-15 at 20:00',
      promoterEmail: data?.promoterEmail || 'promoter@example.com',
      reason: data?.reason || 'Please provide more details about your event, including venue information and a clear description of what attendees can expect.'
    };

    switch (templateType) {
      case 'submission_confirmation':
        ({ html: htmlContent } = templates.getSubmissionConfirmationTemplate(
          sampleData.eventName,
          sampleData.eventId
        ));
        subject = `Submission received — ${sampleData.eventName}`;
        break;

      case 'approval_notification':
        ({ html: htmlContent } = templates.getApprovalTemplate(
          sampleData.eventName,
          sampleData.eventUrl
        ));
        subject = `You're live on Brum Outloud — ${sampleData.eventName}`;
        break;

      case 'rejection_notification':
        ({ html: htmlContent } = templates.getRejectionTemplate(
          sampleData.eventName,
          sampleData.reason
        ));
        subject = `Submission update — ${sampleData.eventName}`;
        break;

      case 'event_reminder':
        ({ html: htmlContent } = templates.getEventReminderTemplate(
          sampleData.eventName,
          sampleData.eventDate,
          sampleData.eventUrl
        ));
        subject = `Tomorrow: ${sampleData.eventName}`;
        break;

      case 'admin_submission_alert':
        ({ html: htmlContent } = templates.getAdminSubmissionTemplate(
          sampleData.eventName,
          sampleData.promoterEmail,
          sampleData.eventId
        ));
        subject = `New submission — ${sampleData.eventName}`;
        break;

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid template type' })
        };
    }

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        templateType,
        subject,
        htmlContent,
        sampleData
      })
    };

  } catch (error) {
    console.error('Email template preview error:', error);
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
