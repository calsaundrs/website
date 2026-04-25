const EmailTemplates = require('./services/email-templates');

const DEFAULTS = {
  eventName: 'Pride Night at The Village Inn',
  eventId: 'evt-pride-001',
  eventUrl: 'https://brumoutloud.co.uk/event/pride-night-village-inn',
  eventDate: '2026-05-23',
  eventTime: '20:00',
  venueName: 'The Village Inn',
  image: '',
  reason: 'The description was too short — could you flesh it out a bit so attendees know what to expect?',
  resubmitUrl: '',
  promoterEmail: 'promoter@example.com',
};

const SUBJECTS = {
  submission_confirmation: (d) => `Submission received — ${d.eventName}`,
  approval_notification: (d) => `You're live on Brum Outloud — ${d.eventName}`,
  rejection_notification: (d) => `Submission update — ${d.eventName}`,
  event_reminder: (d) => `Tomorrow: ${d.eventName}`,
  admin_submission_alert: (d) => `New submission — ${d.eventName}`,
};

function render(templates, templateType, d) {
  switch (templateType) {
    case 'submission_confirmation':
      return templates.getSubmissionConfirmationTemplate(d.eventName, d.eventId);
    case 'approval_notification':
      return templates.getApprovalTemplate(d.eventName, d.eventUrl, {
        image: d.image || undefined,
        eventDate: d.eventDate || undefined,
        eventTime: d.eventTime || undefined,
        venueName: d.venueName || undefined,
      });
    case 'rejection_notification':
      return templates.getRejectionTemplate(d.eventName, d.reason, {
        resubmitUrl: d.resubmitUrl || undefined,
      });
    case 'event_reminder':
      return templates.getEventReminderTemplate(d.eventName, d.eventDate, d.eventUrl);
    case 'admin_submission_alert':
      return templates.getAdminSubmissionTemplate(
        d.eventName,
        d.promoterEmail || null,
        d.eventId
      );
    default:
      return null;
  }
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const templates = new EmailTemplates();

    let templateType;
    let overrides = {};

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      templateType = body.templateType;
      overrides = body.data || {};
    } else {
      templateType = event.queryStringParameters?.templateType;
    }

    if (!templateType) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'templateType is required' }),
      };
    }

    if (!SUBJECTS[templateType]) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Invalid templateType' }),
      };
    }

    const data = { ...DEFAULTS, ...overrides };
    const rendered = render(templates, templateType, data);

    if (!rendered) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'Render failed' }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        templateType,
        subject: SUBJECTS[templateType](data),
        htmlContent: rendered.html,
        textContent: rendered.text,
        sampleData: data,
      }),
    };
  } catch (error) {
    console.error('Email template preview error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
