/**
 * Brum Outloud email templates — brutalist-lite, email-safe.
 *
 * Constraints that drove the rewrite:
 *  - No webfonts (Google Fonts don't load in Gmail mobile / Outlook /
 *    Yahoo). Brutalist character comes from Impact / Arial Black as
 *    a fallback to the site's Syne.
 *  - No CSS variables, no CSS Grid, no background-image gradients —
 *    all stripped or mis-rendered by major clients.
 *  - No `position: absolute` — filtered by Outlook.
 *  - Every style inline on the element that uses it; <style> blocks
 *    get stripped by Yahoo / Outlook.com.
 *  - Table-based layout for anything that needs columns, including
 *    the pride rainbow stripe.
 *  - Max-width 600px with `width: 100%` so it scales on mobile
 *    without a media query.
 *  - Each template returns { html, text } — explicit plain-text
 *    siblings rather than stripping HTML (the strip produces noisy
 *    output and spam filters downgrade mail whose text/html parts
 *    disagree).
 *  - Subject lines contain no emojis (spam-filter signal in 2026).
 */

class EmailTemplates {
  constructor() {
    // Brand palette, emailed straight as hex so no CSS-var resolution
    // is required by the client.
    this.colors = {
      bg: '#0D0115',          // brand dark — header band
      toxic: '#CCFF00',       // accent stripe
      pink: '#E83A99',        // primary CTA
      paper: '#FFFFFF',       // body card bg
      ink: '#111111',         // body text
      mute: '#6B7280',        // small-print grey
      rule: '#E5E7EB',        // dividers
    };

    // Pride 6-stripe used for the footer rainbow (table row).
    // Deliberately the 1978 6-colour flag so each cell gets equal
    // proportion — 2018 flag strip is too many columns at 600px.
    this.pride = ['#E40303', '#FF8C00', '#FFF430', '#008026', '#004DFF', '#750787'];

    this.siteUrl = 'https://brumoutloud.co.uk';
    this.addressLine = 'Brum Outloud · Birmingham, UK';
  }

  // ---- Base chrome --------------------------------------------------------

  /**
   * Wrap content in the shared brutalist-lite shell.
   * `content` can be:
   *   - a string  → rendered inside the padded body only
   *   - an object → { hero, body }; `hero` sits edge-to-edge below
   *     the header (no side padding) so images can fill the 600px
   *     column; `body` sits in the padded body area below.
   */
  getBaseTemplate(content, title = 'Brum Outloud') {
    const c = this.colors;
    const { hero, body } = typeof content === 'string'
      ? { hero: '', body: content }
      : (content || {});
    const prideRow = this.pride.map(hex =>
      `<td width="16.6667%" height="8" style="background:${hex};line-height:8px;font-size:0;">&nbsp;</td>`
    ).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<meta name="x-apple-disable-message-reformatting">
<title>${this.esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${c.ink};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F3F4F6;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${c.paper};border:2px solid ${c.ink};">
      <!-- Dark header band with wordmark -->
      <tr><td style="background:${c.bg};padding:22px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-family:Impact,'Arial Black',sans-serif;font-weight:900;font-size:24px;letter-spacing:0.14em;color:${c.paper};text-transform:uppercase;">Brum Outloud</td>
            <td align="right" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;letter-spacing:0.22em;color:${c.toxic};text-transform:uppercase;">Birmingham · Queer</td>
          </tr>
        </table>
      </td></tr>
      <!-- Toxic-lime accent stripe -->
      <tr><td height="8" style="background:${c.toxic};line-height:8px;font-size:0;">&nbsp;</td></tr>

      ${hero ? `
      <!-- Edge-to-edge hero (opts into full 600px width, no side padding) -->
      <tr><td style="padding:0;">${hero}</td></tr>
      ` : ''}

      <!-- Padded body -->
      <tr><td style="padding:36px 28px 28px 28px;font-size:16px;line-height:1.55;color:${c.ink};">
        ${body}
      </td></tr>

      <!-- Small-print footer -->
      <tr><td style="border-top:1px solid ${c.rule};padding:18px 28px;font-size:12px;line-height:1.55;color:${c.mute};">
        <div>${this.addressLine}</div>
        <div style="margin-top:6px;"><a href="${this.siteUrl}" style="color:${c.mute};text-decoration:underline;">${this.siteUrl.replace(/^https?:\/\//, '')}</a> · <a href="{{unsubscribe}}" style="color:${c.mute};text-decoration:underline;">Unsubscribe</a></div>
      </td></tr>

      <!-- Pride rainbow strip -->
      <tr><td style="padding:0;font-size:0;line-height:0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${prideRow}</tr></table>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
  }

  // ---- Shared bits --------------------------------------------------------

  /** Big-headline block. */
  heading(text) {
    const c = this.colors;
    return `<div style="font-family:Impact,'Arial Black',sans-serif;font-weight:900;font-size:38px;line-height:1.04;letter-spacing:0.01em;color:${c.ink};text-transform:uppercase;margin:0 0 18px 0;">${this.esc(text)}</div>`;
  }

  /** Plain paragraph. */
  para(text) {
    return `<p style="margin:0 0 14px 0;font-size:16px;line-height:1.55;">${text}</p>`;
  }

  /** Pink CTA button (single-cell table is the only reliable pattern). */
  button(label, href) {
    const c = this.colors;
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;"><tr><td style="background:${c.pink};border:2px solid ${c.ink};">
      <a href="${this.esc(href)}" style="display:inline-block;padding:14px 26px;font-family:Impact,'Arial Black',sans-serif;font-weight:900;font-size:16px;letter-spacing:0.12em;color:${c.paper};text-transform:uppercase;text-decoration:none;">${this.esc(label)}</a>
    </td></tr></table>`;
  }

  /** Key/value detail table — used for event summaries and IDs. */
  kvTable(rows) {
    const c = this.colors;
    const body = rows.map(([k, v]) => `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid ${c.rule};font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:${c.mute};width:35%;vertical-align:top;">${this.esc(k)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid ${c.rule};font-size:15px;color:${c.ink};">${v}</td>
      </tr>`).join('');
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${c.rule};margin:6px 0 18px 0;">${body}</table>`;
  }

  /** Escape untrusted strings before interpolating into HTML. */
  esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  // ---- Templates ---------------------------------------------------------

  /** Promoter: "we've got your submission". */
  getSubmissionConfirmationTemplate(eventName, eventId) {
    const name = this.esc(eventName);
    const html = this.getBaseTemplate(`
      ${this.heading('Got it — thanks')}
      ${this.para(`We've received your event <strong>${name}</strong> and it's queued for review.`)}
      ${this.para('We try to turn submissions around within 48 hours. You\'ll get another email when it\'s live — or, if something needs changing, we\'ll tell you what and invite a resubmission.')}
      ${this.kvTable([
        ['Event', name],
        ['Submission ID', this.esc(eventId)],
        ['Status', 'Pending review'],
      ])}
      ${this.para(`Any questions, just reply to this email.`)}
    `, `Submission received — ${eventName}`);

    const text = [
      `Got it — thanks`,
      ``,
      `We've received your event "${eventName}" and it's queued for review.`,
      ``,
      `We try to turn submissions around within 48 hours. You'll get another email when it's live — or, if something needs changing, we'll tell you what and invite a resubmission.`,
      ``,
      `Event: ${eventName}`,
      `Submission ID: ${eventId}`,
      `Status: Pending review`,
      ``,
      `Any questions, just reply to this email.`,
      ``,
      `— Brum Outloud`,
      `${this.siteUrl}`,
    ].join('\n');

    return { html, text };
  }

  /**
   * Promoter: "you're live" — big celebratory mini-poster.
   * `extras` may include: { image, eventDate, eventTime, venueName }.
   * Each field is optional; the template only renders what it's given,
   * so this is safe to call for venues too.
   */
  getApprovalTemplate(eventName, eventUrl, extras = {}) {
    const c = this.colors;
    const name = this.esc(eventName);
    const url = eventUrl || this.siteUrl;

    const imgUrl = this.resolveEmailImage(extras.image, 600, 520);
    const dateLine = this.formatDateLine(extras.eventDate, extras.eventTime);
    const venue = extras.venueName ? this.esc(extras.venueName) : '';

    // Confetti strip — 6 equal pride cells, visible as a row of colour
    // between sections. Renders as a real rainbow bar in every client
    // because it's just table cells with solid backgrounds.
    const confetti = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;">
        <tr>${this.pride.map(hex =>
          `<td width="16.6667%" height="14" style="background:${hex};line-height:14px;font-size:0;">&nbsp;</td>`
        ).join('')}</tr>
      </table>
    `;

    // Hero: image, then toxic-lime YOU'RE LIVE badge spanning full
    // width (big, unmistakable), then a dark poster card with the
    // event name and date/venue in celebration sizing.
    const heroHtml = `
      ${imgUrl ? `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 0 0;">
          <tr><td style="padding:0;font-size:0;line-height:0;background:${c.bg};">
            <img src="${this.esc(imgUrl)}" width="600" alt="${name}"
                 style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:0;">
          </td></tr>
        </table>
      ` : ''}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0;">
        <tr><td align="center" style="background:${c.toxic};padding:18px 20px;font-family:Impact,'Arial Black',sans-serif;font-weight:900;font-size:30px;line-height:1;letter-spacing:0.18em;color:${c.ink};text-transform:uppercase;">
          You're live
        </td></tr>
        <tr><td style="background:${c.bg};padding:28px 24px 28px 24px;">
          <div style="font-family:Impact,'Arial Black',sans-serif;font-weight:900;font-size:42px;line-height:1.02;letter-spacing:0.01em;color:${c.paper};text-transform:uppercase;margin:0 0 14px 0;">
            ${name}
          </div>
          ${(dateLine || venue) ? `
            <div style="font-size:16px;line-height:1.55;color:${c.toxic};letter-spacing:0.08em;font-weight:700;text-transform:uppercase;">
              ${dateLine ? `<span>${dateLine}</span>` : ''}${(dateLine && venue) ? `<span style="opacity:0.6;">  ·  </span>` : ''}${venue ? `<span>${venue}</span>` : ''}
            </div>
          ` : ''}
        </td></tr>
      </table>
    `;

    // Big bold CTA — centred, full-width feel with extra vertical weight.
    const ctaHtml = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 0 0;">
        <tr><td align="center" style="background:${c.pink};border:2px solid ${c.ink};">
          <a href="${this.esc(url)}" style="display:block;padding:18px 22px;font-family:Impact,'Arial Black',sans-serif;font-weight:900;font-size:20px;letter-spacing:0.14em;color:${c.paper};text-transform:uppercase;text-decoration:none;">
            View your listing &rarr;
          </a>
        </td></tr>
      </table>
    `;

    // Share-prompt cards — each ask gets its own coloured left rail so
    // the two actions read as distinct, concrete steps rather than a
    // bullet list.
    const shareHtml = `
      <div style="margin:4px 0 10px 0;font-family:Impact,'Arial Black',sans-serif;font-weight:900;font-size:30px;line-height:1.02;letter-spacing:0.01em;color:${c.ink};text-transform:uppercase;">
        Now make it travel
      </div>
      <p style="margin:0 0 20px 0;font-size:16px;line-height:1.55;">The listing's up — here's how you double the reach:</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px 0;border-left:6px solid ${c.pink};">
        <tr><td style="padding:14px 18px;background:#FAFAFA;">
          <div style="font-family:Impact,'Arial Black',sans-serif;font-weight:900;font-size:14px;letter-spacing:0.22em;color:${c.pink};text-transform:uppercase;margin:0 0 6px 0;">Step 1 · Instagram</div>
          <div style="font-size:16px;line-height:1.55;">
            <strong>Add <a href="https://instagram.com/brumoutloud" style="color:${c.ink};">@brumoutloud</a> as a collaborator</strong> when you post about this event. Your post surfaces in our followers' feeds too — free reach, no double-posting.
          </div>
        </td></tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px 0;border-left:6px solid ${c.toxic};">
        <tr><td style="padding:14px 18px;background:#FAFAFA;">
          <div style="font-family:Impact,'Arial Black',sans-serif;font-weight:900;font-size:14px;letter-spacing:0.22em;color:${c.ink};text-transform:uppercase;margin:0 0 6px 0;">Step 2 · Repost us</div>
          <div style="font-size:16px;line-height:1.55;">
            <strong>Repost anything we put up</strong> about your event — grid, story, reel. Sharing it on means both audiences see it and the algorithm treats it as real signal.
          </div>
        </td></tr>
      </table>

      <p style="margin:18px 0 0 0;font-size:14px;color:${c.mute};">Anything wrong with the listing? Just reply to this email — we'll fix it same day.</p>
    `;

    const html = this.getBaseTemplate({
      hero: heroHtml,
      body: `${ctaHtml}${confetti}${shareHtml}`,
    }, `You're live — ${eventName}`);

    const text = [
      `You're live on Brum Outloud`,
      ``,
      `${eventName}`,
      dateLine ? (venue ? `${dateLine.replace(/<[^>]+>/g, '')} · ${extras.venueName}` : dateLine.replace(/<[^>]+>/g, '')) : (venue ? extras.venueName : ''),
      ``,
      `View your listing: ${url}`,
      ``,
      `HELP IT TRAVEL`,
      `Two things that genuinely move turnout:`,
      ``,
      `  1. Add @brumoutloud as a collaborator when you post your event on Instagram — our audience sees your post in their feed and you get the reach without double-posting.`,
      ``,
      `  2. Repost anything we put up about your event (grid, story, reel). If we cover it and you share it on, both lists see it and the algorithm treats it as signal.`,
      ``,
      `If anything about the listing looks wrong, just reply to this email and we'll fix it.`,
      ``,
      `— Brum Outloud`,
      `${this.siteUrl}`,
    ].filter(Boolean).join('\n');

    return { html, text };
  }

  /**
   * Normalise a Cloudinary image reference into a 600px-wide JPG so
   * the email renders at a predictable size across clients.
   * Returns null if no usable URL can be built.
   */
  resolveEmailImage(raw, width = 600, maxHeight = 520) {
    if (!raw) return null;
    const str = typeof raw === 'object' && raw.url ? raw.url : raw;
    if (typeof str !== 'string' || !str) return null;
    const m = str.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/);
    if (m) {
      // Strip any existing transforms and apply a consistent email
      // preset: width 600, capped height, fill, auto format + quality.
      const tail = m[2].replace(/^[^/]+,[^/]+\//, '');
      return `${m[1]}w_${width},h_${maxHeight},c_fill,g_auto,f_jpg,q_auto/${tail}`;
    }
    return str;
  }

  /** Build a readable date line like "Sat 19 Apr · 8pm". */
  formatDateLine(eventDate, eventTime) {
    if (!eventDate) return '';
    try {
      const d = new Date(eventDate);
      if (Number.isNaN(d.getTime())) return this.esc(eventDate);
      const fmt = d.toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short',
      });
      return eventTime ? `${fmt} · ${this.esc(eventTime)}` : fmt;
    } catch {
      return this.esc(eventDate);
    }
  }

  /** Promoter: "we can't publish this, here's why". */
  getRejectionTemplate(eventName, reason) {
    const name = this.esc(eventName);
    const why = this.esc(reason || 'We need a bit more information before we can publish.');
    const html = this.getBaseTemplate(`
      ${this.heading('Not quite ready')}
      ${this.para(`We can't publish <strong>${name}</strong> in its current form.`)}
      ${this.kvTable([
        ['What needs changing', why],
      ])}
      ${this.para(`Update the details and resubmit — we'll take another look straight away.`)}
      ${this.button('Edit & resubmit', `${this.siteUrl}/submit`)}
      ${this.para(`If you'd rather talk it through, reply to this email.`)}
    `, `Submission update — ${eventName}`);

    const text = [
      `Not quite ready`,
      ``,
      `We can't publish "${eventName}" in its current form.`,
      ``,
      `What needs changing: ${reason || 'We need a bit more information before we can publish.'}`,
      ``,
      `Update the details and resubmit — we'll take another look straight away.`,
      `Edit & resubmit: ${this.siteUrl}/submit`,
      ``,
      `If you'd rather talk it through, reply to this email.`,
      ``,
      `— Brum Outloud`,
      `${this.siteUrl}`,
    ].join('\n');

    return { html, text };
  }

  /** Promoter: "your event is tomorrow". */
  getEventReminderTemplate(eventName, eventDate, eventUrl) {
    const name = this.esc(eventName);
    const when = this.esc(eventDate);
    const url = eventUrl || this.siteUrl;
    const html = this.getBaseTemplate(`
      ${this.heading(`Tomorrow: ${name}`)}
      ${this.para(`A friendly reminder that your event is on — we're looking forward to seeing it run.`)}
      ${this.kvTable([
        ['Event', name],
        ['When', when],
      ])}
      ${this.button('View the listing', url)}
      ${this.para(`Good time to give the link one last push on your socials. If anything's changed, reply and we'll update the listing right away.`)}
    `, `Tomorrow — ${eventName}`);

    const text = [
      `Tomorrow: ${eventName}`,
      ``,
      `A friendly reminder that your event is on — we're looking forward to seeing it run.`,
      ``,
      `Event: ${eventName}`,
      `When:  ${eventDate}`,
      ``,
      `View the listing: ${url}`,
      ``,
      `Good time to give the link one last push on your socials. If anything's changed, reply and we'll update the listing right away.`,
      ``,
      `— Brum Outloud`,
      `${this.siteUrl}`,
    ].join('\n');

    return { html, text };
  }

  /** Admin: "new submission in the queue". */
  getAdminSubmissionTemplate(eventName, promoterEmail, eventId) {
    const name = this.esc(eventName);
    const who = this.esc(promoterEmail || 'anonymous submitter');
    const reviewUrl = `${this.siteUrl}/admin-approvals.html`;
    const html = this.getBaseTemplate(`
      ${this.heading('New submission')}
      ${this.para(`A promoter has submitted an event for review.`)}
      ${this.kvTable([
        ['Event', name],
        ['From', who],
        ['Submission ID', this.esc(eventId)],
      ])}
      ${this.button('Review now', reviewUrl)}
      ${this.para(`This email fires for every submission — including anonymous ones — so nothing slips past the queue.`)}
    `, `New submission — ${eventName}`);

    const text = [
      `New submission`,
      ``,
      `A promoter has submitted an event for review.`,
      ``,
      `Event: ${eventName}`,
      `From:  ${promoterEmail || 'anonymous submitter'}`,
      `Submission ID: ${eventId}`,
      ``,
      `Review now: ${reviewUrl}`,
      ``,
      `— Brum Outloud admin alerts`,
    ].join('\n');

    return { html, text };
  }

  // ---- Back-compat --------------------------------------------------------

  /**
   * Kept so any caller still passing HTML through getPlainTextVersion
   * doesn't break. The new template methods return { html, text }
   * directly — prefer that shape.
   */
  getPlainTextVersion(htmlContent) {
    if (!htmlContent) return '';
    return String(htmlContent)
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}

module.exports = EmailTemplates;
