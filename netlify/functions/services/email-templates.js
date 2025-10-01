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
      chipBackground: 'rgba(232, 58, 153, 0.08)',
      chipBorder: 'rgba(232, 58, 153, 0.45)',
      panelHighlight: 'linear-gradient(135deg, rgba(232, 58, 153, 0.18) 0%, rgba(139, 92, 246, 0.15) 100%)',
      imageShadow: '0 18px 35px rgba(0, 0, 0, 0.45)'
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

        .wrapper { width: 100%; padding: 44px 0; background: linear-gradient(160deg, rgba(8,11,20,0.92) 0%, rgba(26,14,46,0.9) 100%); }

        .container {
            width: 100%;
            max-width: 640px;
            margin: 0 auto;
            background: rgba(12, 16, 29, 0.92);
            border-radius: 22px;
            border: 1px solid rgba(148, 163, 184, 0.2);
            box-shadow: 0 32px 58px rgba(0, 0, 0, 0.4);
            overflow: hidden;
        }

        .masthead {
            padding: 26px 34px 24px;
            background: linear-gradient(135deg, rgba(8,11,20,0.9) 0%, rgba(8,11,20,0.96) 40%, rgba(45,22,70,0.92) 100%);
            border-bottom: 1px solid rgba(148, 163, 184, 0.2);
        }

        .brand-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        }

        .brand {
            display: inline-flex;
            align-items: center;
            gap: 12px;
            font-family: ${this.fonts.heading};
            font-size: 28px;
            letter-spacing: 0.06em;
            text-transform: uppercase;
        }

        .brand-flag {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border: 2px solid rgba(255,255,255,0.2);
        }

        .subject-chip {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border-radius: 9999px;
            font-size: 11px;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            background: ${this.elements.chipBackground};
            border: 1px solid ${this.elements.chipBorder};
            color: ${this.colors.textSecondary};
        }

        .content {
            padding: 32px;
            background: rgba(10, 12, 21, 0.92);
        }

        .panel {
            background: rgba(17, 24, 39, 0.86);
            border-radius: 18px;
            padding: 24px;
            border: 1px solid rgba(148, 163, 184, 0.22);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .footer {
            padding: 26px 34px 32px;
            background: rgba(8, 11, 20, 0.88);
            border-top: 1px solid rgba(148, 163, 184, 0.18);
            text-align: center;
        }

        .footer-links {
            display: inline-flex;
            gap: 18px;
            padding: 12px 20px;
            border-radius: 9999px;
            background: rgba(17, 24, 39, 0.7);
            border: 1px solid rgba(148, 163, 184, 0.22);
            margin-bottom: 18px;
        }

        .footer-link {
            color: ${this.colors.textSecondary};
            text-decoration: none;
            font-size: 12px;
            letter-spacing: 0.06em;
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

        .section-title {
            font-family: ${this.fonts.heading};
            letter-spacing: 0.1em;
            text-transform: uppercase;
            font-size: 13px;
            color: ${this.colors.textMuted};
        }

        .event-image {
            width: 100%;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: ${this.elements.imageShadow};
            border: 1px solid rgba(148, 163, 184, 0.18);
        }

        .event-image img {
            display: block;
            width: 100%;
            height: auto;
        }

        .cta-button {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            background: ${this.gradients.primary};
            color: #ffffff;
            text-decoration: none;
            padding: 14px 26px;
            border-radius: 16px;
            font-weight: 600;
            font-size: 13px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            box-shadow: 0 20px 40px rgba(232, 58, 153, 0.35);
        }

        .secondary-link {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: ${this.colors.textSecondary};
            text-decoration: none;
        }

        @media (max-width: 640px) {
            .wrapper { padding: 28px 0; }
            .container { border-radius: 0; }
            .content { padding: 24px; }
            .panel { padding: 22px; }
            .brand { font-size: 26px; }
            .brand-row { flex-direction: column; align-items: flex-start; }
            .subject-chip { margin-top: 16px; }
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
                            <div class="brand-row">
                                <div class="brand">
                                    <span>BRUM OUTLOUD</span>
                                </div>
                                <span class="subject-chip">${title.toUpperCase()}</span>
                            </div>
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
                                <a href="https://brumoutloud.co.uk/promoter-tool" class="footer-link">Promoters</a>
                            </div>
                            <div class="footer-copy">
                                Birmingham’s LGBTQ+ guide to what’s on, where to go, and who to support.
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
  getSubmissionConfirmationTemplate(data) {
    const eventName = data.eventName;
    const eventId = data.eventId;
    const submittedAt = new Date().toLocaleString();
    const promoImage = data.promoImage;
    const venueName = data.venueName;
    const eventDate = data.eventDate;
    const eventTime = data.eventTime;
    const content = `
      <table role="presentation" width="100%" style="border-collapse:collapse;">
        <tr>
          <td style="font-size:20px;font-weight:600;color:${this.colors.textPrimary};padding-bottom:10px;">
            “${eventName}” has landed in our review queue.
          </td>
        </tr>
        <tr>
          <td style="color:${this.colors.textSecondary};font-size:15px;line-height:1.7;padding-bottom:18px;">
            Thanks for submitting your event. The team will review the details and make sure everything’s ready for listing.
          </td>
        </tr>
        ${promoImage ? `
        <tr>
          <td style="padding-bottom:22px;">
            <div class="event-image">
              <img src="${promoImage}" alt="Poster for ${eventName}">
            </div>
          </td>
        </tr>
        ` : ''}
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
              ${eventDate ? `
              <tr>
                <td style="padding:14px 18px;color:${this.colors.textMuted};font-size:12px;letter-spacing:0.1em;text-transform:uppercase;">Event Date</td>
                <td style="padding:14px 18px;color:${this.colors.textPrimary};">${eventDate}${eventTime ? ` · ${eventTime}` : ''}</td>
              </tr>` : ''}
              ${venueName ? `
              <tr>
                <td style="padding:14px 18px;color:${this.colors.textMuted};font-size:12px;letter-spacing:0.1em;text-transform:uppercase;">Venue</td>
                <td style="padding:14px 18px;color:${this.colors.textPrimary};">${venueName}</td>
              </tr>` : ''}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding-top:20px;color:${this.colors.textSecondary};font-size:14px;line-height:1.8;">
            We’ll let you know as soon as the listing goes live or if anything needs adjusting. Keep an eye on your inbox.
          </td>
        </tr>
        <tr>
          <td style="padding-top:24px;">
            <a href="https://brumoutloud.co.uk/promoter-tool" class="cta-button">
              Visit the promoter hub
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
  getApprovalTemplate(data) {
    const eventName = data.eventName;
    const eventUrl = data.eventUrl;
    const promoImage = data.promoImage;
    const venueName = data.venueName;
    const eventDate = data.eventDate;
    const content = `
      <table role="presentation" width="100%" style="border-collapse:collapse;">
        <tr>
          <td style="font-size:20px;font-weight:600;color:${this.colors.textPrimary};padding-bottom:12px;">
            “${eventName}” is live on Brum Outloud.
          </td>
        </tr>
        <tr>
          <td style="color:${this.colors.textSecondary};font-size:15px;line-height:1.7;padding-bottom:18px;">
            Your listing is published and ready to share. Use the link below wherever you promote your event.
          </td>
        </tr>
        ${promoImage ? `
        <tr>
          <td style="padding-bottom:22px;">
            <div class="event-image">
              <img src="${promoImage}" alt="Key art for ${eventName}">
            </div>
          </td>
        </tr>
        ` : ''}
        <tr>
          <td style="background:rgba(17,24,39,0.6);border-radius:12px;border:1px solid rgba(148,163,184,0.18);padding:18px;color:${this.colors.textPrimary};">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.12em;color:${this.colors.accent};padding-bottom:6px;">Listing</div>
            <a href="${eventUrl}" style="color:${this.colors.textPrimary};text-decoration:none;font-weight:600;word-break:break-all;">${eventUrl}</a>
          </td>
        </tr>
        ${eventDate || venueName ? `
        <tr>
          <td style="padding-top:18px;">
            <table role="presentation" width="100%" style="border-collapse:collapse;background:${this.elements.panelHighlight};border-radius:14px;border:1px solid rgba(148,163,184,0.18);">
              ${eventDate ? `
              <tr>
                <td style="padding:14px 18px;color:${this.colors.textMuted};font-size:12px;letter-spacing:0.12em;text-transform:uppercase;">Event Date</td>
                <td style="padding:14px 18px;color:${this.colors.textPrimary};font-weight:600;">${eventDate}</td>
              </tr>` : ''}
              ${venueName ? `
              <tr>
                <td style="padding:14px 18px;color:${this.colors.textMuted};font-size:12px;letter-spacing:0.12em;text-transform:uppercase;">Venue</td>
                <td style="padding:14px 18px;color:${this.colors.textPrimary};font-weight:600;">${venueName}</td>
              </tr>` : ''}
            </table>
          </td>
        </tr>` : ''}
        <tr>
          <td style="padding-top:20px;color:${this.colors.textSecondary};font-size:14px;line-height:1.7;">
            Share the link across your channels and tag <strong style="color:${this.colors.textPrimary};">@brumoutloud</strong> if you’d like us to amplify it.
          </td>
        </tr>
        <tr>
          <td style="padding-top:24px;">
            <a href="${eventUrl}" class="cta-button">View your listing</a>
          </td>
        </tr>
      </table>
    `;

    return this.getBaseTemplate(content, `Event Approved · Brum Outloud`);
  }

  /**
   * Rejection Notification Template
   */
  getRejectionTemplate(data) {
    const eventName = data.eventName;
    const reason = data.reason;
    const updatedAt = new Date().toLocaleString();
    const content = `
      <table role="presentation" width="100%" style="border-collapse:collapse;">
        <tr>
          <td style="font-size:18px;font-weight:600;color:${this.colors.textPrimary};padding-bottom:12px;">
            We need a quick update for “${eventName}”.
          </td>
        </tr>
        <tr>
          <td style="color:${this.colors.textSecondary};font-size:15px;line-height:1.7;padding-bottom:18px;">
            Please review the note below and resubmit when ready. Once we receive the update we’ll check it again promptly.
          </td>
        </tr>
        <tr>
          <td style="background:${this.gradients.warning};border-radius:12px;border:1px solid rgba(245,158,11,0.35);padding:18px;color:${this.colors.textPrimary};line-height:1.7;font-size:14px;">
            ${reason || 'Add a little more detail so the listing shines and gives attendees everything they need.'}
          </td>
        </tr>
        <tr>
          <td style="padding-top:18px;color:${this.colors.textSecondary};font-size:14px;">
            Reviewed: ${updatedAt}
          </td>
        </tr>
        <tr>
          <td style="padding-top:22px;">
            <a href="https://brumoutloud.co.uk/promoter-tool" class="cta-button">Update your submission</a>
          </td>
        </tr>
      </table>
    `;

    return this.getBaseTemplate(content, `Update Requested · Brum Outloud`);
  }

  /**
   * Event Reminder Template
   */
  getEventReminderTemplate(data) {
    const eventName = data.eventName;
    const eventDate = data.eventDate;
    const eventUrl = data.eventUrl;
    const content = `
      <table role="presentation" width="100%" style="border-collapse:collapse;">
        <tr>
          <td style="font-size:18px;font-weight:600;color:${this.colors.textPrimary};padding-bottom:12px;">
            Reminder: “${eventName}” is almost here.
          </td>
        </tr>
        <tr>
          <td style="color:${this.colors.textSecondary};font-size:15px;line-height:1.7;padding-bottom:18px;">
            A few final checks can help the night run smoothly.
          </td>
        </tr>
        <tr>
          <td style="background:${this.gradients.subtle};border-radius:12px;border:1px solid rgba(232,58,153,0.28);padding:18px;color:${this.colors.textPrimary};line-height:1.7;font-size:14px;">
            • Share the event link today.<br>
            • Confirm performer and staff call times.<br>
            • Prep assets you want to capture during the night.
          </td>
        </tr>
        ${eventDate ? `
        <tr>
          <td style="padding-top:18px;color:${this.colors.textSecondary};font-size:13px;letter-spacing:0.08em;text-transform:uppercase;">
            Scheduled for ${eventDate}
          </td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding-top:22px;">
            <a href="${eventUrl}" class="cta-button">Review your listing</a>
          </td>
        </tr>
      </table>
    `;

    return this.getBaseTemplate(content, `Event Reminder · Brum Outloud`);
  }

  /**
   * Admin Submission Alert Template
   */
  getAdminSubmissionTemplate(data) {
    const eventName = data.eventName;
    const promoterEmail = data.promoterEmail;
    const eventId = data.eventId;
    const promoImage = data.promoImage;
    const eventDate = data.eventDate;
    const eventTime = data.eventTime;
    const submittedAt = new Date().toLocaleString();
    const content = `
      <table role="presentation" width="100%" style="border-collapse:collapse;">
        <tr>
          <td style="font-size:18px;font-weight:600;color:${this.colors.textPrimary};padding-bottom:12px;">
            New submission: “${eventName}”.
          </td>
        </tr>
        <tr>
          <td style="color:${this.colors.textSecondary};font-size:15px;line-height:1.7;padding-bottom:16px;">
            Submitted ${submittedAt}${promoterEmail ? ` · Promoter: ${promoterEmail}` : ''}.
          </td>
        </tr>
        ${promoImage ? `
        <tr>
          <td style="padding-bottom:20px;">
            <div class="event-image">
              <img src="${promoImage}" alt="Uploaded artwork for ${eventName}">
            </div>
          </td>
        </tr>
        ` : ''}
        <tr>
          <td style="background:rgba(17,24,39,0.6);border-radius:12px;border:1px solid rgba(148,163,184,0.18);padding:16px;color:${this.colors.textPrimary};font-family:${this.fonts.mono};font-size:14px;">
            Submission ID: ${eventId}
          </td>
        </tr>
        ${eventDate || eventTime ? `
        <tr>
          <td style="padding-top:16px;">
            <table role="presentation" width="100%" style="border-collapse:collapse;background:${this.gradients.subtle};border-radius:12px;border:1px solid rgba(148,163,184,0.18);">
              ${eventDate ? `
              <tr>
                <td style="padding:14px 18px;color:${this.colors.textMuted};font-size:12px;letter-spacing:0.12em;text-transform:uppercase;">Event Date</td>
                <td style="padding:14px 18px;color:${this.colors.textPrimary};">${eventDate}${eventTime ? ` · ${eventTime}` : ''}</td>
              </tr>` : ''}
            </table>
          </td>
        </tr>` : ''}
        <tr>
          <td style="padding-top:18px;color:${this.colors.textSecondary};font-size:14px;line-height:1.7;">
            Checks: validate copy and imagery, confirm venue, make sure contact info works.
          </td>
        </tr>
        <tr>
          <td style="padding-top:22px;">
            <a href="https://brumoutloud.co.uk/admin-approvals.html" class="cta-button">Open approvals</a>
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
