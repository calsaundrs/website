const EmailService = require('./services/email-service');

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

  const emailService = new EmailService();

  try {
    if (event.httpMethod === 'GET') {
      // Get email logs
      const { limit = 50, status } = event.queryStringParameters || {};
      const logs = await emailService.getEmailLogs(parseInt(limit), status);

      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          logs: logs
        })
      };

    } else if (event.httpMethod === 'POST') {
      // Resend email
      const { logId } = JSON.parse(event.body);
      
      if (!logId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Log ID is required' })
        };
      }

      const result = await emailService.resendEmail(logId);

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

    } else {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

  } catch (error) {
    console.error('Email logs error:', error);
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
