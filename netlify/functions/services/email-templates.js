/**
 * Professional Email Templates for Brum Outloud
 * Based on the design system with brand consistency
 */

class EmailTemplates {
  constructor() {
    this.colors = {
      backgroundGradient: 'linear-gradient(135deg, #0a0a0a 0%, #1a0d2e 50%, #0a0a0a 100%)',
      panel: 'rgba(17, 24, 39, 0.85)',
      border: 'rgba(75, 85, 99, 0.35)',
      textPrimary: '#F9FAFB',
      textSecondary: '#D1D5DB',
      textMuted: '#9CA3AF',
      accent: '#E83A99',
      accentSecondary: '#8B5CF6',
      success: '#10B981',
      warning: '#F59E0B',
      danger: '#EF4444',
      info: '#60A5FA',
    };

    this.gradients = {
      primary: 'linear-gradient(135deg, #E83A99 0%, #8B5CF6 100%)',
      subtle: 'linear-gradient(135deg, rgba(232, 58, 153, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
      success: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.15) 100%)',
      warning: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.15) 100%)',
      danger: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.15) 100%)',
    };

    this.fonts = {
      primary: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      heading: "'Anton', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      mono: "'Fira Code', 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    };

    this.layout = {
      maxWidth: 640,
      borderRadius: 24,
      padding: 32,
      shadow: '0 30px 60px rgba(0, 0, 0, 0.35)',
      glassBorder: '1px solid rgba(255, 255, 255, 0.08)',
    };

    this.elements = {
      dividerGradient: 'linear-gradient(90deg, rgba(232,58,153,0) 0%, rgba(232,58,153,0.7) 50%, rgba(232,58,153,0) 100%)',
      badgeGradient: 'linear-gradient(135deg, rgba(232, 58, 153, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)',
      overlayPattern: 'radial-gradient(circle at 20% 20%, rgba(232, 58, 153, 0.12) 0, transparent 45%), radial-gradient(circle at 80% 0%, rgba(139, 92, 246, 0.12) 0, transparent 40%)',
    };
  }

  /**
   * Base email template with Brum Outloud branding
   */
  getBaseTemplate(content, title = 'Brum Outloud') {
    return `
<!DOCTYPE html>
<html lang="en" style="margin:0; padding:0;">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
        :root { color-scheme: dark; }

        html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            font-family: ${this.fonts.primary};
            background: ${this.colors.backgroundGradient};
            color: ${this.colors.textPrimary};
        }

        table { border-collapse: collapse; border-spacing: 0; }
        img { border: 0; line-height: 100%; text-decoration: none; }

        .wrapper { width: 100%; padding: 40px 0; }

        .container {
            width: 100%;
            max-width: 620px;
            margin: 0 auto;
            background: rgba(17, 24, 39, 0.88);
            border-radius: 20px;
            border: 1px solid rgba(148, 163, 184, 0.18);
            box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
            overflow: hidden;
        }

        .masthead {
            padding: 24px 32px;
            background: rgba(8, 11, 20, 0.75);
            border-bottom: 1px solid rgba(148, 163, 184, 0.18);
        }

        .brand {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            font-family: ${this.fonts.heading};
            font-size: 26px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        .subject-line {
            margin-top: 6px;
            font-size: 13px;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: ${this.colors.textMuted};
        }

        .content {
            padding: 32px;
            background: rgba(12, 16, 29, 0.9);
        }

        .panel {
            background: rgba(17, 24, 39, 0.82);
            border-radius: 16px;
            padding: 24px;
            border: 1px solid rgba(148, 163, 184, 0.2);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }

        .footer {
            padding: 24px 32px 30px;
            background: rgba(8, 11, 20, 0.82);
            border-top: 1px solid rgba(148, 163, 184, 0.18);
            text-align: center;
        }

        .footer-links {
            display: inline-flex;
            gap: 16px;
            padding: 10px 18px;
            border-radius: 9999px;
            background: rgba(17, 24, 39, 0.65);
            border: 1px solid rgba(148, 163, 184, 0.18);
            margin-bottom: 18px;
        }

        .footer-link {
            color: ${this.colors.textSecondary};
            text-decoration: none;
            font-size: 12px;
            letter-spacing: 0.05em;
            text-transform: uppercase;
        }

        .footer-copy {
            color: ${this.colors.textMuted};
            font-size: 12px;
            line-height: 1.8;
        }

        .unsubscribe {
            display: inline-block;
            margin-top: 16px;
            color: ${this.colors.textMuted};
            text-decoration: none;
            font-size: 11px;
        }

        @media (max-width: 640px) {
            .wrapper { padding: 24px 0; }
            .container { border-radius: 0; }
            .content { padding: 24px; }
            .panel { padding: 20px; }
        }
    </style>
</head>
<body>
    <table role="presentation" class="wrapper" width="100%">
        <tr>
            <td align="center">
                <table role="presentation" class="container" width="100%">
                    <tr>
                        <td class="masthead">
                            <div class="brand">BRUM OUTLOUD</div>
                            <div class="subject-line">${title.toUpperCase()}</div>
                        </td>
                    </tr>
                    <tr>
                        <td class="content">
                            <div class="panel">
                                ${content}
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td class="footer">
                            <div class="footer-links">
                                <a href="https://brumoutloud.co.uk" class="footer-link">Website</a>
                                <a href="https://brumoutloud.co.uk/events" class="footer-link">Events</a>
                                <a href="https://brumoutloud.co.uk/contact" class="footer-link">Contact</a>
                            </div>
                            <div class="footer-copy">
                                Powered by Brum Outloud · Supporting Birmingham's LGBTQ+ community.
                            </div>
                            <div>
                                <a href="https://brumoutloud.co.uk/unsubscribe" class="unsubscribe">Manage preferences</a>
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
  }

  /**
   * Submission Confirmation Template
   */
  getSubmissionConfirmationTemplate(eventName, eventId) {
    const submittedAt = new Date().toLocaleString();
    const content = `
      <table role="presentation" width="100%" style="border-collapse:collapse;">
        <tr>
          <td style="font-size:18px;font-weight:600;color:${this.colors.textPrimary};padding-bottom:12px;">
            Thanks for submitting “${eventName}”.
          </td>
        </tr>
        <tr>
          <td style="color:${this.colors.textSecondary};font-size:15px;line-height:1.7;padding-bottom:18px;">
            Your event is in review. We’ll let you know once it’s live or if we need anything else.
          </td>
        </tr>
        <tr>
          <td>
            <table role="presentation" width="100%" style="border-collapse:collapse;background:rgba(17,24,39,0.6);border-radius:12px;border:1px solid rgba(148,163,184,0.18);">
              <tr>
                <td style="padding:14px 18px;color:${this.colors.textMuted};font-size:12px;letter-spacing:0.1em;text-transform:uppercase;">Submission ID</td>
                <td style="padding:14px 18px;font-family:${this.fonts.mono};font-size:14px;color:${this.colors.textPrimary};">${eventId}</td>
              </tr>
              <tr>
                <td style="padding:14px 18px;color:${this.colors.textMuted};font-size:12px;letter-spacing:0.1em;text-transform:uppercase;">Submitted</td>
                <td style="padding:14px 18px;color:${this.colors.textPrimary};">${submittedAt}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding-top:20px;color:${this.colors.textSecondary};font-size:14px;line-height:1.7;">
            Next steps: gather imagery, keep your inbox handy, and be ready to share once approved.
          </td>
        </tr>
        <tr>
          <td style="padding-top:24px;">
            <a href="https://brumoutloud.co.uk/promoter-tool" style="display:inline-block;background:${this.gradients.primary};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:14px;font-weight:600;font-size:13px;letter-spacing:0.05em;text-transform:uppercase;">
              Open promoter hub
            </a>
          </td>
        </tr>
      </table>
    `;

    return this.getBaseTemplate(content, `Event Submitted · Brum Outloud`);
  }

  /**
   * Approval Notification Template
   */
  getApprovalTemplate(eventName, eventUrl) {
    const content = `
      <table role="presentation" width="100%" style="border-collapse:collapse;">
        <tr>
          <td style="font-size:18px;font-weight:600;color:${this.colors.textPrimary};padding-bottom:12px;">
            Your event is live.
          </td>
        </tr>
        <tr>
          <td style="color:${this.colors.textSecondary};font-size:15px;line-height:1.7;padding-bottom:18px;">
            “${eventName}” is published on Brum Outloud. Share the link and keep details current so attendees know what to expect.
          </td>
        </tr>
        <tr>
          <td style="background:rgba(17,24,39,0.6);border-radius:12px;border:1px solid rgba(148,163,184,0.18);padding:18px;color:${this.colors.textPrimary};">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.12em;color:${this.colors.accent};padding-bottom:6px;">Listing</div>
            <a href="${eventUrl}" style="color:${this.colors.textPrimary};text-decoration:none;font-weight:600;word-break:break-all;">${eventUrl}</a>
          </td>
        </tr>
        <tr>
          <td style="padding-top:20px;color:${this.colors.textSecondary};font-size:14px;line-height:1.7;">
            Next steps: post the link on socials, confirm on-the-day logistics, and tag @brumoutloud so we can amplify.
          </td>
        </tr>
        <tr>
          <td style="padding-top:24px;">
            <a href="${eventUrl}" style="display:inline-block;background:${this.gradients.primary};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:14px;font-weight:600;font-size:13px;letter-spacing:0.05em;text-transform:uppercase;">
              View listing
            </a>
          </td>
        </tr>
      </table>
    `;

    return this.getBaseTemplate(content, `Event Approved · Brum Outloud`);
  }

  /**
   * Rejection Notification Template
   */
  getRejectionTemplate(eventName, reason) {
    const updatedAt = new Date().toLocaleString();
    const content = `
      <table role="presentation" width="100%" style="border-collapse:collapse;">
        <tr>
          <td style="font-size:18px;font-weight:600;color:${this.colors.textPrimary};padding-bottom:12px;">
            We need an update before “${eventName}” can go live.
          </td>
        </tr>
        <tr>
          <td style="color:${this.colors.textSecondary};font-size:15px;line-height:1.7;padding-bottom:18px;">
            Please review the feedback below and resubmit when ready. We’ll fast-track the follow-up check.
          </td>
        </tr>
        <tr>
          <td style="background:${this.gradients.warning};border-radius:12px;border:1px solid rgba(245,158,11,0.35);padding:18px;color:${this.colors.textPrimary};line-height:1.7;font-size:14px;">
            ${reason || 'Please add more detail so the listing shines and sets clear expectations for attendees.'}
          </td>
        </tr>
        <tr>
          <td style="padding-top:18px;color:${this.colors.textSecondary};font-size:14px;">
            Reviewed: ${updatedAt}
          </td>
        </tr>
        <tr>
          <td style="padding-top:22px;">
            <a href="https://brumoutloud.co.uk/promoter-tool" style="display:inline-block;background:${this.gradients.primary};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:14px;font-weight:600;font-size:13px;letter-spacing:0.05em;text-transform:uppercase;">
              Update details
            </a>
          </td>
        </tr>
      </table>
    `;

    return this.getBaseTemplate(content, `Update Requested · Brum Outloud`);
  }

  /**
   * Event Reminder Template
   */
  getEventReminderTemplate(eventName, eventDate, eventUrl) {
    const content = `
      <table role="presentation" width="100%" style="border-collapse:collapse;">
        <tr>
          <td style="font-size:18px;font-weight:600;color:${this.colors.textPrimary};padding-bottom:12px;">
            Reminder: “${eventName}” happens ${eventDate}.
          </td>
        </tr>
        <tr>
          <td style="color:${this.colors.textSecondary};font-size:15px;line-height:1.7;padding-bottom:18px;">
            Make a final pass on promotion and logistics so everything runs smoothly.
          </td>
        </tr>
        <tr>
          <td style="background:${this.gradients.subtle};border-radius:12px;border:1px solid rgba(232,58,153,0.28);padding:18px;color:${this.colors.textPrimary};line-height:1.7;font-size:14px;">
            • Share the event link today.<br>
            • Confirm performer and staff call times.<br>
            • Prep assets you want to capture during the night.
          </td>
        </tr>
        <tr>
          <td style="padding-top:22px;">
            <a href="${eventUrl}" style="display:inline-block;background:${this.gradients.primary};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:14px;font-weight:600;font-size:13px;letter-spacing:0.05em;text-transform:uppercase;">
              View event page
            </a>
          </td>
        </tr>
      </table>
    `;

    return this.getBaseTemplate(content, `Event Reminder · Brum Outloud`);
  }

  /**
   * Admin Submission Alert Template
   */
  getAdminSubmissionTemplate(eventName, promoterEmail, eventId) {
    const submittedAt = new Date().toLocaleString();
    const content = `
      <table role="presentation" width="100%" style="border-collapse:collapse;">
        <tr>
          <td style="font-size:18px;font-weight:600;color:${this.colors.textPrimary};padding-bottom:12px;">
            New submission waiting in the review queue.
          </td>
        </tr>
        <tr>
          <td style="color:${this.colors.textSecondary};font-size:15px;line-height:1.7;padding-bottom:16px;">
            Event: ${eventName}. Submitted ${submittedAt}. Promoter: ${promoterEmail || 'not provided'}.
          </td>
        </tr>
        <tr>
          <td style="background:rgba(17,24,39,0.6);border-radius:12px;border:1px solid rgba(148,163,184,0.18);padding:16px;color:${this.colors.textPrimary};font-family:${this.fonts.mono};font-size:14px;">
            Submission ID: ${eventId}
          </td>
        </tr>
        <tr>
          <td style="padding-top:18px;color:${this.colors.textSecondary};font-size:14px;line-height:1.7;">
            Checks: validate copy and imagery, confirm venue, make sure contact info works.
          </td>
        </tr>
        <tr>
          <td style="padding-top:22px;">
            <a href="https://brumoutloud.co.uk/admin-approvals.html" style="display:inline-block;background:${this.gradients.primary};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:14px;font-weight:600;font-size:13px;letter-spacing:0.05em;text-transform:uppercase;">
              Open approvals
            </a>
          </td>
        </tr>
      </table>
    `;

    return this.getBaseTemplate(content, `New Submission · Admin Alert`);
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

  generatePlainText(name, data) {
    switch (name) {
      case 'submission_confirmation':
        return `Event Submitted Successfully\n\n` +
          `Event: ${data.eventName}\n` +
          `Submission ID: ${data.eventId}\n` +
          `We have received your submission and will review it shortly. Visit https://brumoutloud.co.uk/promoter-tool to manage your listings.\n` +
          `Need help? Email hello@brumoutloud.co.uk`;
      case 'approval_notification':
        return `Your Event Is Live\n\n` +
          `Event: ${data.eventName}\n` +
          `Listing: ${data.eventUrl}\n` +
          `Your event is now live on Brum Outloud. Share your listing and explore the promoter hub for assets.\n` +
          `Questions? hello@brumoutloud.co.uk`;
      case 'rejection_notification':
        return `Update Requested\n\n` +
          `Event: ${data.eventName}\n` +
          `Feedback: ${data.reason || 'Please review and provide missing details.'}\n` +
          `Update your submission at https://brumoutloud.co.uk/promoter-tool.\n` +
          `Need assistance? hello@brumoutloud.co.uk`;
      case 'event_reminder':
        return `Event Reminder\n\n` +
          `Event: ${data.eventName}\n` +
          `Schedule: ${data.eventDate}\n` +
          `Listing: ${data.eventUrl}\n` +
          `Share the listing, confirm logistics, and tag @brumoutloud on the night.\n` +
          `Support: hello@brumoutloud.co.uk`;
      case 'admin_submission_alert':
        return `New Submission Alert\n\n` +
          `Event: ${data.eventName}\n` +
          `Promoter: ${data.promoterEmail || 'Unknown'}\n` +
          `Submission ID: ${data.eventId}\n` +
          `Review required in the admin queue.`;
      default:
        return null;
    }
  }
}

module.exports = EmailTemplates;
