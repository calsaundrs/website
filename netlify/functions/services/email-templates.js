/**
 * Professional Email Templates for Brum Outloud
 * Based on the design system with brand consistency
 */

class EmailTemplates {
  constructor() {
    this.brandColors = {
      primary: '#E83A99',
      secondary: '#8B5CF6',
      background: '#111827',
      text: '#EAEAEA',
      textLight: '#D1D5DB',
      textMuted: '#9CA3AF',
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444'
    };
    
    this.fonts = {
      primary: 'Poppins, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      heading: 'Anton, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    };
  }

  /**
   * Base email template with Brum Outloud branding
   */
  getBaseTemplate(content, title = 'Brum Outloud') {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        /* Reset and base styles */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: ${this.fonts.primary};
            line-height: 1.6;
            color: ${this.brandColors.text};
            background: linear-gradient(135deg, #0a0a0a 0%, #1a0d2e 50%, #0a0a0a 100%);
            margin: 0;
            padding: 0;
        }
        
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: ${this.brandColors.background};
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }
        
        .email-header {
            background: linear-gradient(135deg, ${this.brandColors.primary} 0%, ${this.brandColors.secondary} 100%);
            padding: 40px 30px;
            text-align: center;
            position: relative;
        }
        
        .email-header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.1) 75%);
            background-size: 20px 20px;
            opacity: 0.3;
        }
        
        .logo {
            font-family: ${this.fonts.heading};
            font-size: 32px;
            font-weight: 900;
            color: white;
            text-decoration: none;
            letter-spacing: 0.05em;
            position: relative;
            z-index: 1;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }
        
        .email-content {
            padding: 40px 30px;
            background: ${this.brandColors.background};
        }
        
        .email-footer {
            background: rgba(17, 24, 39, 0.8);
            padding: 30px;
            text-align: center;
            border-top: 1px solid rgba(75, 85, 99, 0.3);
        }
        
        .footer-text {
            color: ${this.brandColors.textMuted};
            font-size: 14px;
            margin-bottom: 20px;
        }
        
        .social-links {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-bottom: 20px;
        }
        
        .social-link {
            display: inline-block;
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, ${this.brandColors.primary} 0%, ${this.brandColors.secondary} 100%);
            border-radius: 50%;
            text-align: center;
            line-height: 40px;
            color: white;
            text-decoration: none;
            transition: transform 0.3s ease;
        }
        
        .social-link:hover {
            transform: translateY(-2px);
        }
        
        .unsubscribe {
            color: ${this.brandColors.textMuted};
            font-size: 12px;
            text-decoration: none;
        }
        
        /* Responsive design */
        @media only screen and (max-width: 600px) {
            .email-container {
                margin: 0;
                border-radius: 0;
            }
            
            .email-header, .email-content, .email-footer {
                padding: 30px 20px;
            }
            
            .logo {
                font-size: 28px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <a href="https://brumoutloud.co.uk" class="logo">BRUM OUTLOUD</a>
        </div>
        
        <div class="email-content">
            ${content}
        </div>
        
        <div class="email-footer">
            <p class="footer-text">
                Thanks for being part of Birmingham's LGBTQ+ community!<br>
                <strong>The Brum Outloud Team</strong>
            </p>
            
            <div class="social-links">
                <a href="https://instagram.com/brumoutloud" class="social-link">📷</a>
                <a href="https://twitter.com/brumoutloud" class="social-link">🐦</a>
                <a href="https://facebook.com/brumoutloud" class="social-link">📘</a>
            </div>
            
            <a href="https://brumoutloud.co.uk/unsubscribe" class="unsubscribe">
                Unsubscribe from these emails
            </a>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Submission Confirmation Template
   */
  getSubmissionConfirmationTemplate(eventName, eventId) {
    const content = `
      <style>
        .success-icon {
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, ${this.brandColors.success} 0%, #059669 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 30px;
          font-size: 36px;
          color: white;
          box-shadow: 0 10px 30px rgba(16, 185, 129, 0.3);
        }
        
        .event-details {
          background: rgba(31, 41, 55, 0.5);
          border: 1px solid rgba(75, 85, 99, 0.3);
          border-radius: 12px;
          padding: 25px;
          margin: 30px 0;
        }
        
        .event-id {
          background: rgba(232, 58, 153, 0.1);
          border: 1px solid rgba(232, 58, 153, 0.3);
          border-radius: 8px;
          padding: 15px;
          margin: 20px 0;
          text-align: center;
        }
        
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, ${this.brandColors.primary} 0%, ${this.brandColors.secondary} 100%);
          color: white;
          text-decoration: none;
          padding: 16px 32px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 16px;
          margin: 25px 0;
          transition: transform 0.3s ease;
          box-shadow: 0 8px 25px rgba(232, 58, 153, 0.3);
        }
        
        .cta-button:hover {
          transform: translateY(-2px);
        }
        
        .next-steps {
          background: rgba(139, 92, 246, 0.1);
          border-left: 4px solid ${this.brandColors.secondary};
          padding: 20px;
          margin: 25px 0;
          border-radius: 0 8px 8px 0;
        }
        
        .next-steps h3 {
          color: ${this.brandColors.secondary};
          margin-bottom: 15px;
          font-size: 18px;
        }
        
        .next-steps ul {
          list-style: none;
          padding: 0;
        }
        
        .next-steps li {
          padding: 8px 0;
          position: relative;
          padding-left: 25px;
        }
        
        .next-steps li::before {
          content: '✓';
          position: absolute;
          left: 0;
          color: ${this.brandColors.success};
          font-weight: bold;
        }
      </style>
      
      <div class="success-icon">🎉</div>
      
      <h1 style="text-align: center; font-size: 28px; margin-bottom: 20px; color: white;">
        Event Submitted Successfully!
      </h1>
      
      <p style="text-align: center; font-size: 18px; color: ${this.brandColors.textLight}; margin-bottom: 30px;">
        Thank you for your submission! We've received your event and it's now in our review queue.
      </p>
      
      <div class="event-details">
        <h2 style="color: white; margin-bottom: 15px; font-size: 22px;">Event Details</h2>
        <p style="color: ${this.brandColors.textLight}; font-size: 16px; margin-bottom: 10px;">
          <strong>Event Name:</strong> ${eventName}
        </p>
        <p style="color: ${this.brandColors.textMuted}; font-size: 14px;">
          <strong>Submitted:</strong> ${new Date().toLocaleString()}
        </p>
      </div>
      
      <div class="event-id">
        <p style="color: ${this.brandColors.primary}; font-weight: 600; margin: 0;">
          Event ID: <span style="font-family: monospace; background: rgba(232, 58, 153, 0.2); padding: 4px 8px; border-radius: 4px;">${eventId}</span>
        </p>
        <p style="color: ${this.brandColors.textMuted}; font-size: 12px; margin: 8px 0 0 0;">
          Keep this ID handy for future reference
        </p>
      </div>
      
      <div class="next-steps">
        <h3>What happens next?</h3>
        <ul>
          <li>Our team will review your event details</li>
          <li>We'll check that all information is complete and accurate</li>
          <li>You'll receive an email once your event is approved or if we need any changes</li>
          <li>Approved events go live immediately on our platform</li>
        </ul>
      </div>
      
      <div style="text-align: center; margin: 35px 0;">
        <a href="https://brumoutloud.co.uk/promoter-tool" class="cta-button">
          View Promoter Tools
        </a>
      </div>
      
      <p style="text-align: center; color: ${this.brandColors.textMuted}; font-size: 14px; margin-top: 30px;">
        Questions? Reply to this email or visit our <a href="https://brumoutloud.co.uk/contact" style="color: ${this.brandColors.primary}; text-decoration: none;">contact page</a>.
      </p>
    `;
    
    return this.getBaseTemplate(content, `Event Submitted - ${eventName}`);
  }

  /**
   * Approval Notification Template
   */
  getApprovalTemplate(eventName, eventUrl) {
    const content = `
      <style>
        .celebration-icon {
          width: 100px;
          height: 100px;
          background: linear-gradient(135deg, ${this.brandColors.success} 0%, #059669 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 30px;
          font-size: 48px;
          color: white;
          box-shadow: 0 15px 40px rgba(16, 185, 129, 0.4);
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        .live-badge {
          display: inline-block;
          background: linear-gradient(135deg, ${this.brandColors.success} 0%, #059669 100%);
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 20px;
          box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
        }
        
        .event-card {
          background: rgba(31, 41, 55, 0.5);
          border: 1px solid rgba(75, 85, 99, 0.3);
          border-radius: 16px;
          padding: 30px;
          margin: 30px 0;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        
        .event-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(135deg, ${this.brandColors.primary} 0%, ${this.brandColors.secondary} 100%);
        }
        
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, ${this.brandColors.primary} 0%, ${this.brandColors.secondary} 100%);
          color: white;
          text-decoration: none;
          padding: 18px 36px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 18px;
          margin: 25px 0;
          transition: transform 0.3s ease;
          box-shadow: 0 10px 30px rgba(232, 58, 153, 0.4);
        }
        
        .cta-button:hover {
          transform: translateY(-3px);
        }
        
        .share-section {
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 12px;
          padding: 25px;
          margin: 30px 0;
          text-align: center;
        }
        
        .share-buttons {
          display: flex;
          justify-content: center;
          gap: 15px;
          margin-top: 20px;
          flex-wrap: wrap;
        }
        
        .share-button {
          display: inline-block;
          padding: 12px 20px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          font-size: 14px;
          transition: transform 0.3s ease;
        }
        
        .share-button.instagram {
          background: linear-gradient(135deg, #E4405F 0%, #C13584 100%);
          color: white;
        }
        
        .share-button.twitter {
          background: linear-gradient(135deg, #1DA1F2 0%, #0d8bd9 100%);
          color: white;
        }
        
        .share-button.facebook {
          background: linear-gradient(135deg, #4267B2 0%, #365899 100%);
          color: white;
        }
        
        .share-button:hover {
          transform: translateY(-2px);
        }
      </style>
      
      <div class="celebration-icon">🎉</div>
      
      <div style="text-align: center; margin-bottom: 30px;">
        <span class="live-badge">✨ LIVE NOW ✨</span>
        <h1 style="font-size: 32px; margin-bottom: 15px; color: white;">
          Your Event is Live!
        </h1>
        <p style="font-size: 20px; color: ${this.brandColors.textLight};">
          Congratulations! Your event is now live on Brum Outloud
        </p>
      </div>
      
      <div class="event-card">
        <h2 style="color: white; margin-bottom: 15px; font-size: 24px;">${eventName}</h2>
        <p style="color: ${this.brandColors.textMuted}; font-size: 14px; margin-bottom: 20px;">
          Now live and discoverable by the Birmingham LGBTQ+ community
        </p>
        
        <a href="${eventUrl}" class="cta-button">
          View Your Event
        </a>
      </div>
      
      <div class="share-section">
        <h3 style="color: ${this.brandColors.secondary}; margin-bottom: 15px; font-size: 20px;">
          Share Your Success! 🚀
        </h3>
        <p style="color: ${this.brandColors.textLight}; margin-bottom: 20px;">
          Help spread the word! Share your event on social media and with your network.
        </p>
        
        <div class="share-buttons">
          <a href="https://www.instagram.com/brumoutloud" class="share-button instagram">
            📷 Share on Instagram
          </a>
          <a href="https://twitter.com/brumoutloud" class="share-button twitter">
            🐦 Share on Twitter
          </a>
          <a href="https://facebook.com/brumoutloud" class="share-button facebook">
            📘 Share on Facebook
          </a>
        </div>
      </div>
      
      <div style="background: rgba(16, 185, 129, 0.1); border-left: 4px solid ${this.brandColors.success}; padding: 20px; margin: 30px 0; border-radius: 0 8px 8px 0;">
        <h3 style="color: ${this.brandColors.success}; margin-bottom: 15px; font-size: 18px;">
          What's Next?
        </h3>
        <ul style="list-style: none; padding: 0; color: ${this.brandColors.textLight};">
          <li style="padding: 5px 0;">✓ Your event is now discoverable on our platform</li>
          <li style="padding: 5px 0;">✓ Community members can find and attend your event</li>
          <li style="padding: 5px 0;">✓ You can track engagement and attendance</li>
          <li style="padding: 5px 0;">✓ Consider sharing on your own social channels</li>
        </ul>
      </div>
      
      <p style="text-align: center; color: ${this.brandColors.textMuted}; font-size: 14px; margin-top: 30px;">
        Need help promoting your event? Check out our <a href="https://brumoutloud.co.uk/promoter-tool" style="color: ${this.brandColors.primary}; text-decoration: none;">promoter resources</a>.
      </p>
    `;
    
    return this.getBaseTemplate(content, `Event Approved - ${eventName}`);
  }

  /**
   * Rejection Notification Template
   */
  getRejectionTemplate(eventName, reason) {
    const content = `
      <style>
        .feedback-icon {
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, ${this.brandColors.warning} 0%, #D97706 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 30px;
          font-size: 36px;
          color: white;
          box-shadow: 0 10px 30px rgba(245, 158, 11, 0.3);
        }
        
        .feedback-box {
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 12px;
          padding: 25px;
          margin: 30px 0;
        }
        
        .feedback-box h3 {
          color: ${this.brandColors.warning};
          margin-bottom: 15px;
          font-size: 18px;
        }
        
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, ${this.brandColors.primary} 0%, ${this.brandColors.secondary} 100%);
          color: white;
          text-decoration: none;
          padding: 16px 32px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 16px;
          margin: 25px 0;
          transition: transform 0.3s ease;
          box-shadow: 0 8px 25px rgba(232, 58, 153, 0.3);
        }
        
        .cta-button:hover {
          transform: translateY(-2px);
        }
        
        .help-section {
          background: rgba(139, 92, 246, 0.1);
          border-left: 4px solid ${this.brandColors.secondary};
          padding: 20px;
          margin: 25px 0;
          border-radius: 0 8px 8px 0;
        }
        
        .help-section h3 {
          color: ${this.brandColors.secondary};
          margin-bottom: 15px;
          font-size: 18px;
        }
        
        .help-section ul {
          list-style: none;
          padding: 0;
        }
        
        .help-section li {
          padding: 8px 0;
          position: relative;
          padding-left: 25px;
          color: ${this.brandColors.textLight};
        }
        
        .help-section li::before {
          content: '💡';
          position: absolute;
          left: 0;
        }
      </style>
      
      <div class="feedback-icon">📝</div>
      
      <h1 style="text-align: center; font-size: 28px; margin-bottom: 20px; color: white;">
        Event Submission Update
      </h1>
      
      <p style="text-align: center; font-size: 18px; color: ${this.brandColors.textLight}; margin-bottom: 30px;">
        Thank you for your submission! We've reviewed your event and need some additional information.
      </p>
      
      <div style="background: rgba(31, 41, 55, 0.5); border: 1px solid rgba(75, 85, 99, 0.3); border-radius: 12px; padding: 25px; margin: 30px 0;">
        <h2 style="color: white; margin-bottom: 15px; font-size: 22px;">Event Details</h2>
        <p style="color: ${this.brandColors.textLight}; font-size: 16px; margin-bottom: 10px;">
          <strong>Event Name:</strong> ${eventName}
        </p>
        <p style="color: ${this.brandColors.textMuted}; font-size: 14px;">
          <strong>Submitted:</strong> ${new Date().toLocaleString()}
        </p>
      </div>
      
      <div class="feedback-box">
        <h3>Feedback from our team:</h3>
        <p style="color: ${this.brandColors.textLight}; line-height: 1.6;">
          ${reason}
        </p>
      </div>
      
      <div class="help-section">
        <h3>Don't worry - this is easily fixed!</h3>
        <ul>
          <li>Review the feedback above carefully</li>
          <li>Make the necessary changes to your event details</li>
          <li>Resubmit your event using our promoter tools</li>
          <li>Our team will review your updated submission promptly</li>
        </ul>
      </div>
      
      <div style="text-align: center; margin: 35px 0;">
        <a href="https://brumoutloud.co.uk/promoter-tool" class="cta-button">
          Resubmit Your Event
        </a>
      </div>
      
      <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 20px; margin: 30px 0; text-align: center;">
        <h3 style="color: ${this.brandColors.success}; margin-bottom: 10px; font-size: 18px;">
          Need Help?
        </h3>
        <p style="color: ${this.brandColors.textLight}; margin-bottom: 15px;">
          Our team is here to help you create the perfect event listing.
        </p>
        <a href="https://brumoutloud.co.uk/contact" style="color: ${this.brandColors.primary}; text-decoration: none; font-weight: 600;">
          Contact Support →
        </a>
      </div>
      
      <p style="text-align: center; color: ${this.brandColors.textMuted}; font-size: 14px; margin-top: 30px;">
        Thanks for your patience and for contributing to Birmingham's LGBTQ+ community!
      </p>
    `;
    
    return this.getBaseTemplate(content, `Event Update - ${eventName}`);
  }

  /**
   * Event Reminder Template
   */
  getEventReminderTemplate(eventName, eventDate, eventUrl) {
    const content = `
      <style>
        .reminder-icon {
          width: 90px;
          height: 90px;
          background: linear-gradient(135deg, ${this.brandColors.primary} 0%, ${this.brandColors.secondary} 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 30px;
          font-size: 42px;
          color: white;
          box-shadow: 0 12px 35px rgba(232, 58, 153, 0.4);
          animation: bounce 2s infinite;
        }
        
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-10px); }
          60% { transform: translateY(-5px); }
        }
        
        .event-card {
          background: rgba(31, 41, 55, 0.5);
          border: 1px solid rgba(75, 85, 99, 0.3);
          border-radius: 16px;
          padding: 30px;
          margin: 30px 0;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        
        .event-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(135deg, ${this.brandColors.primary} 0%, ${this.brandColors.secondary} 100%);
        }
        
        .date-badge {
          display: inline-block;
          background: linear-gradient(135deg, ${this.brandColors.secondary} 0%, #7C3AED 100%);
          color: white;
          padding: 10px 20px;
          border-radius: 25px;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 20px;
          box-shadow: 0 6px 20px rgba(139, 92, 246, 0.3);
        }
        
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, ${this.brandColors.primary} 0%, ${this.brandColors.secondary} 100%);
          color: white;
          text-decoration: none;
          padding: 18px 36px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 18px;
          margin: 25px 0;
          transition: transform 0.3s ease;
          box-shadow: 0 10px 30px rgba(232, 58, 153, 0.4);
        }
        
        .cta-button:hover {
          transform: translateY(-3px);
        }
        
        .checklist {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 12px;
          padding: 25px;
          margin: 30px 0;
        }
        
        .checklist h3 {
          color: ${this.brandColors.success};
          margin-bottom: 20px;
          font-size: 20px;
          text-align: center;
        }
        
        .checklist ul {
          list-style: none;
          padding: 0;
        }
        
        .checklist li {
          padding: 12px 0;
          position: relative;
          padding-left: 35px;
          color: ${this.brandColors.textLight};
          border-bottom: 1px solid rgba(16, 185, 129, 0.2);
        }
        
        .checklist li:last-child {
          border-bottom: none;
        }
        
        .checklist li::before {
          content: '☐';
          position: absolute;
          left: 0;
          color: ${this.brandColors.success};
          font-size: 18px;
          font-weight: bold;
        }
        
        .motivation-section {
          background: rgba(139, 92, 246, 0.1);
          border-left: 4px solid ${this.brandColors.secondary};
          padding: 25px;
          margin: 30px 0;
          border-radius: 0 12px 12px 0;
          text-align: center;
        }
        
        .motivation-section h3 {
          color: ${this.brandColors.secondary};
          margin-bottom: 15px;
          font-size: 22px;
        }
      </style>
      
      <div class="reminder-icon">📅</div>
      
      <h1 style="text-align: center; font-size: 32px; margin-bottom: 20px; color: white;">
        Your Event is Tomorrow!
      </h1>
      
      <p style="text-align: center; font-size: 18px; color: ${this.brandColors.textLight}; margin-bottom: 30px;">
        Just a friendly reminder that your event is coming up soon. Make sure you're all set!
      </p>
      
      <div class="event-card">
        <span class="date-badge">📅 ${eventDate}</span>
        <h2 style="color: white; margin-bottom: 15px; font-size: 26px;">${eventName}</h2>
        <p style="color: ${this.brandColors.textMuted}; font-size: 14px; margin-bottom: 25px;">
          Your event is live and ready for the community to discover
        </p>
        
        <a href="${eventUrl}" class="cta-button">
          View Your Event
        </a>
      </div>
      
      <div class="checklist">
        <h3>Final Checklist</h3>
        <ul>
          <li>Double-check your event details and timing</li>
          <li>Share on social media one more time</li>
          <li>Prepare any materials or equipment needed</li>
          <li>Arrive early to set up</li>
          <li>Have a backup plan for any technical issues</li>
          <li>Bring contact information for attendees</li>
        </ul>
      </div>
      
      <div class="motivation-section">
        <h3>You've Got This! 🚀</h3>
        <p style="color: ${this.brandColors.textLight}; font-size: 16px; line-height: 1.6;">
          Your event is going to be amazing! The Birmingham LGBTQ+ community is excited to join you. 
          Take a deep breath, trust your preparation, and get ready to create some incredible memories.
        </p>
      </div>
      
      <div style="background: rgba(232, 58, 153, 0.1); border: 1px solid rgba(232, 58, 153, 0.3); border-radius: 12px; padding: 20px; margin: 30px 0; text-align: center;">
        <h3 style="color: ${this.brandColors.primary}; margin-bottom: 10px; font-size: 18px;">
          Last-Minute Promotion
        </h3>
        <p style="color: ${this.brandColors.textLight}; margin-bottom: 15px;">
          Share your event one more time to maximize attendance!
        </p>
        <div style="display: flex; justify-content: center; gap: 15px; flex-wrap: wrap;">
          <a href="https://www.instagram.com/brumoutloud" style="display: inline-block; padding: 10px 20px; background: linear-gradient(135deg, #E4405F 0%, #C13584 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
            📷 Instagram
          </a>
          <a href="https://twitter.com/brumoutloud" style="display: inline-block; padding: 10px 20px; background: linear-gradient(135deg, #1DA1F2 0%, #0d8bd9 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
            🐦 Twitter
          </a>
        </div>
      </div>
      
      <p style="text-align: center; color: ${this.brandColors.textMuted}; font-size: 14px; margin-top: 30px;">
        Good luck with your event! We hope it's a huge success. 🌟
      </p>
    `;
    
    return this.getBaseTemplate(content, `Event Reminder - ${eventName}`);
  }

  /**
   * Admin Submission Alert Template
   */
  getAdminSubmissionTemplate(eventName, promoterEmail, eventId) {
    const content = `
      <style>
        .alert-icon {
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, ${this.brandColors.warning} 0%, #D97706 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 30px;
          font-size: 36px;
          color: white;
          box-shadow: 0 10px 30px rgba(245, 158, 11, 0.3);
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        .submission-card {
          background: rgba(31, 41, 55, 0.5);
          border: 1px solid rgba(75, 85, 99, 0.3);
          border-radius: 16px;
          padding: 30px;
          margin: 30px 0;
          position: relative;
          overflow: hidden;
        }
        
        .submission-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(135deg, ${this.brandColors.warning} 0%, #D97706 100%);
        }
        
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin: 20px 0;
        }
        
        .info-item {
          background: rgba(75, 85, 99, 0.2);
          border-radius: 8px;
          padding: 15px;
        }
        
        .info-label {
          color: ${this.brandColors.textMuted};
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 5px;
        }
        
        .info-value {
          color: white;
          font-weight: 600;
          font-size: 16px;
        }
        
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, ${this.brandColors.primary} 0%, ${this.brandColors.secondary} 100%);
          color: white;
          text-decoration: none;
          padding: 16px 32px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 16px;
          margin: 25px 0;
          transition: transform 0.3s ease;
          box-shadow: 0 8px 25px rgba(232, 58, 153, 0.3);
        }
        
        .cta-button:hover {
          transform: translateY(-2px);
        }
        
        .priority-notice {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 12px;
          padding: 20px;
          margin: 25px 0;
          text-align: center;
        }
        
        .priority-notice h3 {
          color: ${this.brandColors.error};
          margin-bottom: 10px;
          font-size: 18px;
        }
        
        @media only screen and (max-width: 600px) {
          .info-grid {
            grid-template-columns: 1fr;
          }
        }
      </style>
      
      <div class="alert-icon">🔔</div>
      
      <h1 style="text-align: center; font-size: 28px; margin-bottom: 20px; color: white;">
        New Event Submission
      </h1>
      
      <p style="text-align: center; font-size: 18px; color: ${this.brandColors.textLight}; margin-bottom: 30px;">
        A new event has been submitted and is waiting for your review.
      </p>
      
      <div class="submission-card">
        <h2 style="color: white; margin-bottom: 20px; font-size: 24px; text-align: center;">
          ${eventName}
        </h2>
        
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Event Name</div>
            <div class="info-value">${eventName}</div>
          </div>
          
          <div class="info-item">
            <div class="info-label">Event ID</div>
            <div class="info-value" style="font-family: monospace; font-size: 14px;">${eventId}</div>
          </div>
          
          <div class="info-item">
            <div class="info-label">Promoter Email</div>
            <div class="info-value">${promoterEmail}</div>
          </div>
          
          <div class="info-item">
            <div class="info-label">Submitted</div>
            <div class="info-value">${new Date().toLocaleString()}</div>
          </div>
        </div>
      </div>
      
      <div class="priority-notice">
        <h3>Action Required</h3>
        <p style="color: ${this.brandColors.textLight};">
          Please review this submission as soon as possible to ensure timely approval for the promoter.
        </p>
      </div>
      
      <div style="text-align: center; margin: 35px 0;">
        <a href="https://brumoutloud.co.uk/admin-approvals.html" class="cta-button">
          Review Submission
        </a>
      </div>
      
      <div style="background: rgba(139, 92, 246, 0.1); border-left: 4px solid ${this.brandColors.secondary}; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
        <h3 style="color: ${this.brandColors.secondary}; margin-bottom: 15px; font-size: 18px;">
          Quick Actions
        </h3>
        <ul style="list-style: none; padding: 0; color: ${this.brandColors.textLight};">
          <li style="padding: 5px 0;">✓ Review event details and images</li>
          <li style="padding: 5px 0;">✓ Check venue information accuracy</li>
          <li style="padding: 5px 0;">✓ Verify event date and time</li>
          <li style="padding: 5px 0;">✓ Approve or request changes</li>
        </ul>
      </div>
      
      <p style="text-align: center; color: ${this.brandColors.textMuted}; font-size: 14px; margin-top: 30px;">
        This is an automated notification from the Brum Outloud admin system.
      </p>
    `;
    
    return this.getBaseTemplate(content, `New Submission - ${eventName}`);
  }

  /**
   * Get plain text version of any template
   */
  getPlainTextVersion(htmlContent) {
    // Simple HTML to text conversion
    return htmlContent
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
      .replace(/&amp;/g, '&') // Replace HTML entities
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }
}

module.exports = EmailTemplates;
