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
        :root {
            color-scheme: dark;
        }

        html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            font-family: ${this.fonts.primary};
            background: ${this.colors.backgroundGradient};
            color: ${this.colors.textPrimary};
        }

        table {
            border-collapse: collapse;
            border-spacing: 0;
        }

        img {
            border: 0;
            line-height: 100%;
            text-decoration: none;
        }

        .wrapper {
            width: 100%;
            padding: 40px 0;
        }

        .container {
            width: 100%;
            max-width: ${this.layout.maxWidth}px;
            margin: 0 auto;
            background: ${this.colors.panel};
            border-radius: ${this.layout.borderRadius}px;
            overflow: hidden;
            border: ${this.layout.glassBorder};
            box-shadow: ${this.layout.shadow};
        }

        .header {
            position: relative;
            background: ${this.gradients.primary};
            padding: 56px 32px 64px;
            text-align: center;
            color: #ffffff;
        }

        .header::before {
            content: '';
            position: absolute;
            inset: 0;
            background: ${this.elements.overlayPattern};
            opacity: 0.7;
        }

        .header-content {
            position: relative;
            z-index: 1;
        }

        .brand-chip {
            display: inline-flex;
            align-items: center;
            gap: 12px;
            padding: 14px 22px;
            border-radius: 9999px;
            background: rgba(0, 0, 0, 0.22);
            border: 1px solid rgba(255, 255, 255, 0.18);
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
        }

        .brand-text {
            font-family: ${this.fonts.heading};
            font-size: 36px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        .tagline {
            margin-top: 22px;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            font-size: 14px;
            color: rgba(255, 255, 255, 0.75);
        }

        .headline {
            margin-top: 30px;
            font-family: ${this.fonts.heading};
            letter-spacing: 0.06em;
            text-transform: uppercase;
            font-size: 40px;
            line-height: 1.15;
            max-width: 440px;
            margin-left: auto;
            margin-right: auto;
        }

        .headline span {
            color: ${this.colors.accent};
        }

        .content {
            padding: 48px ${this.layout.padding}px;
            background: rgba(8, 11, 20, 0.65);
        }

        .panel {
            background: rgba(15, 23, 42, 0.72);
            border-radius: 20px;
            padding: 32px;
            border: 1px solid rgba(148, 163, 184, 0.2);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .divider {
            height: 1px;
            background: ${this.elements.dividerGradient};
            border-radius: 9999px;
            margin: 36px 0;
        }

        .footer {
            background: rgba(7, 10, 20, 0.9);
            padding: 40px ${this.layout.padding}px;
            text-align: center;
            border-top: 1px solid rgba(148, 163, 184, 0.18);
        }

        .footer-links {
            display: inline-flex;
            gap: 18px;
            padding: 12px 22px;
            border-radius: 9999px;
            background: rgba(17, 24, 39, 0.65);
            border: 1px solid rgba(148, 163, 184, 0.2);
            margin-bottom: 24px;
        }

        .footer-link {
            color: ${this.colors.textSecondary};
            text-decoration: none;
            font-size: 13px;
            letter-spacing: 0.06em;
            text-transform: uppercase;
        }

        .footer-text {
            color: ${this.colors.textMuted};
            font-size: 13px;
            line-height: 1.8;
            margin-bottom: 24px;
        }

        .social-row {
            display: inline-flex;
            gap: 16px;
        }

        .social-link {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 42px;
            height: 42px;
            border-radius: 50%;
            background: ${this.gradients.primary};
            color: #ffffff;
            text-decoration: none;
            font-size: 18px;
        }

        .unsubscribe {
            display: inline-block;
            margin-top: 18px;
            color: ${this.colors.textMuted};
            text-decoration: none;
            font-size: 12px;
        }

        @media (max-width: 640px) {
            body {
                padding: 0;
            }

            .wrapper {
                padding: 24px 0;
            }

            .container {
                border-radius: 0;
            }

            .content {
                padding: 32px 24px;
            }

            .panel {
                padding: 28px 24px;
            }

            .headline {
                font-size: 32px;
            }
        }
    </style>
</head>
<body>
    <table role="presentation" class="wrapper" width="100%">
        <tr>
            <td align="center">
                <table role="presentation" class="container" width="100%">
                    <tr>
                        <td class="header">
                            <div class="header-content">
                                <span class="brand-chip">
                                    <span class="brand-text">BRUM OUTLOUD</span>
                                </span>
                                <div class="tagline">BE SEEN · BE HEARD · BE PROUD</div>
                                <div class="headline">${title.replace('Brum Outloud', '<span>Brum Outloud</span>')}</div>
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
                                <a href="https://brumoutloud.co.uk/venues" class="footer-link">Venues</a>
                                <a href="https://brumoutloud.co.uk/promoter-tool" class="footer-link">Promoters</a>
                            </div>
                            <div class="footer-text">
                                Celebrating Birmingham's LGBTQ+ community with inclusive events, venues, and resources.<br>
                                You're receiving this because you're part of the Brum Outloud network.
                            </div>
                            <div class="social-row">
                                <a href="https://instagram.com/brumoutloud" class="social-link">📷</a>
                                <a href="https://twitter.com/brumoutloud" class="social-link">🐦</a>
                                <a href="https://facebook.com/brumoutloud" class="social-link">📘</a>
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
          <td align="center" style="padding-bottom:28px;">
            <table role="presentation" width="120" height="120" style="border-radius:9999px;background:${this.gradients.success};box-shadow:0 18px 40px rgba(16,185,129,0.28);">
              <tr><td align="center" style="font-size:48px;">🎉</td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="font-family:${this.fonts.heading};letter-spacing:0.06em;text-transform:uppercase;font-size:32px;color:${this.colors.textPrimary};padding-bottom:12px;">
            Event Submitted Successfully
          </td>
        </tr>
        <tr>
          <td align="center" style="color:${this.colors.textSecondary};font-size:16px;line-height:1.8;padding-bottom:32px;">
            Thank you for your submission! Your event is now in our review queue and we will be in touch soon.
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" style="border-collapse:collapse;background:rgba(15,23,42,0.72);border-radius:20px;border:1px solid rgba(148,163,184,0.2);">
        <tr>
          <td style="padding:28px 32px;">
            <table role="presentation" width="100%" style="border-collapse:collapse;">
              <tr>
                <td style="font-family:${this.fonts.heading};letter-spacing:0.08em;text-transform:uppercase;font-size:12px;color:${this.colors.textMuted};padding-bottom:14px;">
                  Submission Overview
                </td>
              </tr>
              <tr>
                <td style="color:${this.colors.textPrimary};font-size:20px;font-weight:600;padding-bottom:8px;">
                  ${eventName}
                </td>
              </tr>
              <tr>
                <td style="color:${this.colors.textSecondary};font-size:15px;">
                  Submitted on ${submittedAt}
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:22px;">
              <tr>
                <td style="background:${this.gradients.subtle};border-radius:16px;padding:16px 20px;border:1px solid rgba(232,58,153,0.3);">
                  <table role="presentation" width="100%" style="border-collapse:collapse;">
                    <tr>
                      <td style="font-size:12px;text-transform:uppercase;letter-spacing:0.12em;color:${this.colors.accent};padding-bottom:6px;">
                        Submission ID
                      </td>
                    </tr>
                    <tr>
                      <td style="font-family:${this.fonts.mono};font-size:16px;color:${this.colors.textPrimary};">
                        ${eventId}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:26px;">
              <tr>
                <td style="font-family:${this.fonts.heading};letter-spacing:0.08em;text-transform:uppercase;font-size:12px;color:${this.colors.textMuted};padding-bottom:12px;">
                  Next Steps
                </td>
              </tr>
              <tr>
                <td>
                  <table role="presentation" width="100%" style="border-collapse:collapse;">
                    <tr>
                      <td style="padding:12px 0;border-bottom:1px solid rgba(148,163,184,0.18);color:${this.colors.textSecondary};font-size:15px;">
                        <strong style="color:${this.colors.textPrimary};">Review process:</strong> our team checks all required details and supporting material.
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:12px 0;border-bottom:1px solid rgba(148,163,184,0.18);color:${this.colors.textSecondary};font-size:15px;">
                        <strong style="color:${this.colors.textPrimary};">Approval update:</strong> we’ll email you once the listing is live or if updates are needed.
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:12px 0;color:${this.colors.textSecondary};font-size:15px;">
                        <strong style="color:${this.colors.textPrimary};">Your prep:</strong> gather imagery, socials, and any copy you’d like to share for promotion.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:32px;">
              <tr>
                <td align="center">
                  <a href="https://brumoutloud.co.uk/promoter-tool" style="display:inline-flex;align-items:center;gap:10px;background:${this.gradients.primary};color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:16px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;font-size:14px;box-shadow:0 18px 40px rgba(232,58,153,0.35);">
                    Manage Your Submission →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:26px;">
        <tr>
          <td style="color:${this.colors.textMuted};font-size:13px;line-height:1.8;text-align:center;">
            Questions or changes? Reply to this email or contact us at
            <a href="mailto:hello@brumoutloud.co.uk" style="color:${this.colors.accent};text-decoration:none;">hello@brumoutloud.co.uk</a>.
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
          <td align="center" style="padding-bottom:28px;">
            <table role="presentation" width="120" height="120" style="border-radius:9999px;background:${this.gradients.primary};box-shadow:0 18px 40px rgba(232,58,153,0.32);">
              <tr><td align="center" style="font-size:48px;">✨</td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="font-family:${this.fonts.heading};letter-spacing:0.06em;text-transform:uppercase;font-size:32px;color:${this.colors.textPrimary};padding-bottom:12px;">
            Your Event Is Live
          </td>
        </tr>
        <tr>
          <td align="center" style="color:${this.colors.textSecondary};font-size:16px;line-height:1.8;padding-bottom:32px;">
            Congratulations! Your event has been approved and is now discoverable across Brum Outloud.
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" style="border-collapse:collapse;background:rgba(15,23,42,0.72);border-radius:20px;border:1px solid rgba(148,163,184,0.2);">
        <tr>
          <td style="padding:28px 32px;">
            <table role="presentation" width="100%" style="border-collapse:collapse;">
              <tr>
                <td style="font-family:${this.fonts.heading};letter-spacing:0.08em;text-transform:uppercase;font-size:12px;color:${this.colors.textMuted};padding-bottom:14px;">
                  Event Snapshot
                </td>
              </tr>
              <tr>
                <td style="color:${this.colors.textPrimary};font-size:22px;font-weight:600;padding-bottom:12px;">
                  ${eventName}
                </td>
              </tr>
              <tr>
                <td style="color:${this.colors.textSecondary};font-size:15px;">
                  Live now on Brum Outloud. Share your listing with your audience to drive visibility and attendance.
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:26px;">
              <tr>
                <td style="display:flex;gap:16px;background:${this.gradients.subtle};border-radius:16px;padding:18px 20px;border:1px solid rgba(232,58,153,0.3);">
                  <span style="width:36px;height:36px;border-radius:9999px;background:${this.gradients.primary};display:inline-flex;align-items:center;justify-content:center;color:#FFFFFF;font-size:18px;">🔗</span>
                  <div style="color:${this.colors.textPrimary};font-size:15px;">
                    <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.12em;color:${this.colors.accent};padding-bottom:4px;">Live Listing</div>
                    <a href="${eventUrl}" style="color:${this.colors.textPrimary};text-decoration:none;font-weight:600;">${eventUrl}</a>
                  </div>
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:26px;">
              <tr>
                <td style="font-family:${this.fonts.heading};letter-spacing:0.08em;text-transform:uppercase;font-size:12px;color:${this.colors.textMuted};padding-bottom:12px;">
                  Suggested Next Steps
                </td>
              </tr>
              <tr>
                <td>
                  <table role="presentation" width="100%" style="border-collapse:collapse;">
                    <tr>
                      <td style="padding:12px 0;border-bottom:1px solid rgba(148,163,184,0.18);color:${this.colors.textSecondary};font-size:15px;">
                        <strong style="color:${this.colors.textPrimary};">Promote your listing:</strong> share the live link with your community and across social channels.
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:12px 0;border-bottom:1px solid rgba(148,163,184,0.18);color:${this.colors.textSecondary};font-size:15px;">
                        <strong style="color:${this.colors.textPrimary};">Keep your details fresh:</strong> revisit your submission if anything changes and ensure images are high quality.
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:12px 0;color:${this.colors.textSecondary};font-size:15px;">
                        <strong style="color:${this.colors.textPrimary};">Explore more tools:</strong> visit the promoter hub for assets, guidance, and future event planning support.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:32px;">
              <tr>
                <td align="center" style="padding-bottom:12px;">
                  <a href="${eventUrl}" style="display:inline-flex;align-items:center;gap:10px;background:${this.gradients.primary};color:#FFFFFF;text-decoration:none;padding:16px 32px;border-radius:16px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;font-size:14px;box-shadow:0 18px 40px rgba(232,58,153,0.35);">
                    View Your Event →
                  </a>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <a href="https://brumoutloud.co.uk/promoter-tool" style="display:inline-flex;align-items:center;gap:10px;background:rgba(148,163,184,0.14);color:${this.colors.textPrimary};text-decoration:none;padding:12px 24px;border-radius:12px;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;border:1px solid rgba(148,163,184,0.18);">
                    Explore Promoter Hub →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:26px;">
        <tr>
          <td style="color:${this.colors.textMuted};font-size:13px;line-height:1.8;text-align:center;">
            Need success tips or media support? Reach out at
            <a href="mailto:hello@brumoutloud.co.uk" style="color:${this.colors.accent};text-decoration:none;">hello@brumoutloud.co.uk</a>.
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
          <td align="center" style="padding-bottom:28px;">
            <table role="presentation" width="120" height="120" style="border-radius:9999px;background:${this.gradients.warning};box-shadow:0 18px 40px rgba(245,158,11,0.28);">
              <tr><td align="center" style="font-size:48px;">📝</td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="font-family:${this.fonts.heading};letter-spacing:0.06em;text-transform:uppercase;font-size:30px;color:${this.colors.textPrimary};padding-bottom:12px;">
            Update Requested
          </td>
        </tr>
        <tr>
          <td align="center" style="color:${this.colors.textSecondary};font-size:16px;line-height:1.8;padding-bottom:32px;">
            We’ve reviewed your submission and need a few adjustments before we can set it live.
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" style="border-collapse:collapse;background:rgba(15,23,42,0.72);border-radius:20px;border:1px solid rgba(148,163,184,0.2);">
        <tr>
          <td style="padding:28px 32px;">
            <table role="presentation" width="100%" style="border-collapse:collapse;">
              <tr>
                <td style="font-family:${this.fonts.heading};letter-spacing:0.08em;text-transform:uppercase;font-size:12px;color:${this.colors.textMuted};padding-bottom:14px;">
                  Submission Details
                </td>
              </tr>
              <tr>
                <td style="color:${this.colors.textPrimary};font-size:20px;font-weight:600;padding-bottom:10px;">
                  ${eventName}
                </td>
              </tr>
              <tr>
                <td style="color:${this.colors.textSecondary};font-size:15px;">
                  Submitted ${updatedAt}
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:26px;">
              <tr>
                <td style="background:${this.gradients.warning};border-radius:16px;padding:18px 20px;border:1px solid rgba(245,158,11,0.3);color:${this.colors.textPrimary};line-height:1.7;font-size:15px;">
                  <strong>Feedback:</strong><br>${reason || 'Please review your submission and ensure all required information is provided.'}
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:26px;">
              <tr>
                <td style="color:${this.colors.textSecondary};font-size:15px;line-height:1.8;">
                  Update your submission with the changes above and resubmit when you’re ready. Once we receive the new details we’ll prioritise the review.
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:32px;">
              <tr>
                <td align="center">
                  <a href="https://brumoutloud.co.uk/promoter-tool" style="display:inline-flex;align-items:center;gap:10px;background:${this.gradients.primary};color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:16px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;font-size:14px;box-shadow:0 18px 40px rgba(232,58,153,0.35);">
                    Update Submission →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:26px;">
        <tr>
          <td style="color:${this.colors.textMuted};font-size:13px;line-height:1.8;text-align:center;">
            Need guidance? Reply to this email or contact us at
            <a href="mailto:hello@brumoutloud.co.uk" style="color:${this.colors.accent};text-decoration:none;">hello@brumoutloud.co.uk</a>.
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
          <td align="center" style="padding-bottom:28px;">
            <table role="presentation" width="120" height="120" style="border-radius:9999px;background:${this.gradients.primary};box-shadow:0 18px 40px rgba(232,58,153,0.32);">
              <tr><td align="center" style="font-size:48px;">⏰</td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="font-family:${this.fonts.heading};letter-spacing:0.06em;text-transform:uppercase;font-size:30px;color:${this.colors.textPrimary};padding-bottom:12px;">
            Event Reminder
          </td>
        </tr>
        <tr>
          <td align="center" style="color:${this.colors.textSecondary};font-size:16px;line-height:1.8;padding-bottom:32px;">
            Your event is nearly here! Use these final checks to make sure everything’s ready to go.
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" style="border-collapse:collapse;background:rgba(15,23,42,0.72);border-radius:20px;border:1px solid rgba(148,163,184,0.2);">
        <tr>
          <td style="padding:28px 32px;">
            <table role="presentation" width="100%" style="border-collapse:collapse;">
              <tr>
                <td style="font-family:${this.fonts.heading};letter-spacing:0.08em;text-transform:uppercase;font-size:12px;color:${this.colors.textMuted};padding-bottom:14px;">
                  Event Details
                </td>
              </tr>
              <tr>
                <td style="color:${this.colors.textPrimary};font-size:20px;font-weight:600;padding-bottom:10px;">
                  ${eventName}
                </td>
              </tr>
              <tr>
                <td style="color:${this.colors.textSecondary};font-size:15px;">
                  Scheduled for ${eventDate}
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:26px;">
              <tr>
                <td style="background:${this.gradients.subtle};border-radius:16px;padding:18px 20px;border:1px solid rgba(232,58,153,0.3);color:${this.colors.textPrimary};line-height:1.7;font-size:15px;">
                  <strong>Host Checklist:</strong>
                  <ul style="margin:12px 0 0 18px;padding:0;">
                    <li style="padding:6px 0;">Share the event link across socials one last time.</li>
                    <li style="padding:6px 0;">Confirm on-the-day logistics (doors, performers, staff).</li>
                    <li style="padding:6px 0;">Prepare visuals and messaging for post-event recap.</li>
                  </ul>
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:26px;">
              <tr>
                <td style="background:${this.gradients.success};border-radius:16px;padding:18px 20px;border:1px solid rgba(16,185,129,0.25);color:${this.colors.textPrimary};line-height:1.7;font-size:15px;">
                  <strong>Boost Your Reach:</strong>
                  <ul style="margin:12px 0 0 18px;padding:0;">
                    <li style="padding:6px 0;">Tag @brumoutloud so we can amplify your posts.</li>
                    <li style="padding:6px 0;">Encourage RSVPs and early arrival to build momentum.</li>
                    <li style="padding:6px 0;">Capture content on the night for future promotion.</li>
                  </ul>
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:32px;">
              <tr>
                <td align="center" style="padding-bottom:12px;">
                  <a href="${eventUrl}" style="display:inline-flex;align-items:center;gap:10px;background:${this.gradients.primary};color:#FFFFFF;text-decoration:none;padding:16px 32px;border-radius:16px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;font-size:14px;box-shadow:0 18px 40px rgba(232,58,153,0.35);">
                    View Event Listing →
                  </a>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <a href="https://instagram.com/brumoutloud" style="display:inline-flex;align-items:center;gap:10px;background:rgba(148,163,184,0.14);color:${this.colors.textPrimary};text-decoration:none;padding:12px 24px;border-radius:12px;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;border:1px solid rgba(148,163,184,0.18);">
                    Tag Us On Instagram →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:26px;">
        <tr>
          <td style="color:${this.colors.textMuted};font-size:13px;line-height:1.8;text-align:center;">
            Need a last-minute shoutout? Email us at
            <a href="mailto:hello@brumoutloud.co.uk" style="color:${this.colors.accent};text-decoration:none;">hello@brumoutloud.co.uk</a>.
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
          <td align="center" style="padding-bottom:28px;">
            <table role="presentation" width="120" height="120" style="border-radius:9999px;background:${this.gradients.primary};box-shadow:0 18px 40px rgba(232,58,153,0.32);">
              <tr><td align="center" style="font-size:48px;">📥</td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="font-family:${this.fonts.heading};letter-spacing:0.06em;text-transform:uppercase;font-size:30px;color:${this.colors.textPrimary};padding-bottom:12px;">
            New Submission Received
          </td>
        </tr>
        <tr>
          <td align="center" style="color:${this.colors.textSecondary};font-size:16px;line-height:1.8;padding-bottom:32px;">
            A new event has been submitted and is awaiting review.
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" style="border-collapse:collapse;background:rgba(15,23,42,0.72);border-radius:20px;border:1px solid rgba(148,163,184,0.2);">
        <tr>
          <td style="padding:28px 32px;">
            <table role="presentation" width="100%" style="border-collapse:collapse;">
              <tr>
                <td style="font-family:${this.fonts.heading};letter-spacing:0.08em;text-transform:uppercase;font-size:12px;color:${this.colors.textMuted};padding-bottom:14px;">
                  Event Summary
                </td>
              </tr>
              <tr>
                <td style="color:${this.colors.textPrimary};font-size:20px;font-weight:600;padding-bottom:10px;">
                  ${eventName}
                </td>
              </tr>
              <tr>
                <td style="color:${this.colors.textSecondary};font-size:15px;">
                  Submitted ${submittedAt}
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:26px;">
              <tr>
                <td style="background:${this.gradients.subtle};border-radius:16px;padding:18px 20px;border:1px solid rgba(232,58,153,0.3);">
                  <table role="presentation" width="100%" style="border-collapse:collapse;">
                    <tr>
                      <td style="font-size:12px;text-transform:uppercase;letter-spacing:0.12em;color:${this.colors.accent};padding-bottom:6px;">Submission ID</td>
                    </tr>
                    <tr>
                      <td style="font-family:${this.fonts.mono};font-size:16px;color:${this.colors.textPrimary};">${eventId}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:26px;">
              <tr>
                <td style="background:rgba(96,165,250,0.14);border-radius:16px;padding:18px 20px;border:1px solid rgba(96,165,250,0.28);color:${this.colors.textPrimary};line-height:1.7;font-size:15px;">
                  <strong>Promoter Contact:</strong><br>
                  ${promoterEmail || 'No email provided'}
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:26px;">
              <tr>
                <td style="font-family:${this.fonts.heading};letter-spacing:0.08em;text-transform:uppercase;font-size:12px;color:${this.colors.textMuted};padding-bottom:12px;">
                  Review Checklist
                </td>
              </tr>
              <tr>
                <td>
                  <table role="presentation" width="100%" style="border-collapse:collapse;">
                    <tr>
                      <td style="padding:12px 0;border-bottom:1px solid rgba(148,163,184,0.18);color:${this.colors.textSecondary};font-size:15px;">
                        Confirm event metadata: title, schedule, and venue information.
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:12px 0;border-bottom:1px solid rgba(148,163,184,0.18);color:${this.colors.textSecondary};font-size:15px;">
                        Check for appropriate imagery and accessible descriptions.
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:12px 0;color:${this.colors.textSecondary};font-size:15px;">
                        Validate promoter contact details for follow-up if required.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:32px;">
              <tr>
                <td align="center">
                  <a href="https://brumoutloud.co.uk/admin-approvals.html" style="display:inline-flex;align-items:center;gap:10px;background:${this.gradients.primary};color:#FFFFFF;text-decoration:none;padding:16px 32px;border-radius:16px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;font-size:14px;box-shadow:0 18px 40px rgba(232,58,153,0.35);">
                    Review Queue →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:26px;">
        <tr>
          <td style="color:${this.colors.textMuted};font-size:13px;line-height:1.8;text-align:center;">
            Need more context? Visit the admin panel or reach out in the team workspace.
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
