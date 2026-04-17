/**
 * Brum Outloud email templates — brutalist-lite, email-safe.
 *
 * Voice direction: Brummie direct, queer, cheeky. No corporate flab,
 * no "kindly" or "we are pleased to". Signed from a human — these are
 * personal emails about somebody's event, not transactional receipts.
 *
 * Visual signatures carried across every template:
 *  - Header dark band with halftone pink dots (data-URI SVG tile so
 *    Apple Mail and Gmail web render the dots; Outlook strips and
 *    falls back to solid dark — still on-brand).
 *  - Misprint text-shadow on main headings (pink + purple offsets,
 *    mirroring the site's Syne treatment). Degrades to flat text in
 *    Outlook.
 *  - Pride 6-stripe footer rainbow — full-width table row.
 *  - Signed sign-off block ("— Cal / Brum Outloud") above the small
 *    print so every email feels like a mate typed it, not a SaaS.
 *
 * Email-client safety: 100% inline styles, table-based layout,
 * no webfonts, no CSS variables, no position:absolute, no CSS grid,
 * no background-image gradients. Every style that matters has a
 * solid-colour fallback.
 */

class EmailTemplates {
  constructor() {
    this.colors = {
      bg: '#0D0115',          // brand dark — header band + poster card
      toxic: '#CCFF00',       // accent stripe, uppercase metadata
      pink: '#E83A99',        // primary CTA, step-1 rail, misprint shadow
      purple: '#9B5DE5',      // misprint shadow right
      paper: '#FFFFFF',       // body card bg
      ink: '#111111',         // body text
      mute: '#6B7280',        // small-print grey
      rule: '#E5E7EB',        // dividers
    };

    // 1978 six-stripe flag (the 2018 eight-stripe is too many columns
    // at 600px to read as a clean rainbow).
    this.pride = ['#E40303', '#FF8C00', '#FFF430', '#008026', '#004DFF', '#750787'];

    this.siteUrl = 'https://brumoutloud.co.uk';
    this.addressLine = 'Brum Outloud · Birmingham';
    this.signature = 'Cal';
    this.signatureTitle = 'Brum Outloud';

    // Halftone dots SVG inlined as a data URI and tiled on the dark
    // header band. Apple Mail and Gmail webmail render it; Outlook
    // strips data URIs and sees the background-color fallback instead.
    const halftoneSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">'
      + '<circle cx="10" cy="10" r="1.4" fill="#E83A99" fill-opacity="0.28"/>'
      + '</svg>';
    this.halftoneDataUri = `data:image/svg+xml;base64,${Buffer.from(halftoneSvg).toString('base64')}`;
  }

  // ---- Base chrome --------------------------------------------------------

  /**
   * Wrap content in the shared brutalist-lite shell.
   * `content` can be a string or { hero, body }. `hero` sits
   * edge-to-edge below the header (no side padding).
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
      <!-- Dark header band with halftone-dot overlay -->
      <tr><td style="background:${c.bg} url('${this.halftoneDataUri}') repeat;padding:22px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-family:Impact,'Arial Black',sans-serif;font-weight:900;font-size:24px;letter-spacing:0.14em;color:${c.paper};text-transform:uppercase;">Brum Outloud</td>
            <td align="right" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;letter-spacing:0.22em;color:${c.toxic};text-transform:uppercase;">Birmingham's queer nights, one list</td>
          </tr>
        </table>
      </td></tr>
      <!-- Toxic accent stripe -->
      <tr><td height="8" style="background:${c.toxic};line-height:8px;font-size:0;">&nbsp;</td></tr>

      ${hero ? `
      <!-- Edge-to-edge hero (full 600px, no side padding) -->
      <tr><td style="padding:0;">${hero}</td></tr>
      ` : ''}

      <!-- Padded body -->
      <tr><td style="padding:36px 28px 12px 28px;font-size:16px;line-height:1.6;color:${c.ink};">
        ${body}
      </td></tr>

      <!-- Signed sign-off — reads as a human, not a transactional receipt -->
      <tr><td style="padding:0 28px 32px 28px;">
        <div style="border-top:3px solid ${c.toxic};width:56px;margin:8px 0 14px 0;font-size:0;line-height:0;">&nbsp;</div>
        <div style="font-size:16px;line-height:1.5;color:${c.ink};">
          Cheers,<br>
          <strong>${this.esc(this.signature)}</strong> <span style="color:${c.mute};"> · ${this.esc(this.signatureTitle)}</span>
        </div>
      </td></tr>

      <!-- Small-print footer -->
      <tr><td style="border-top:1px solid ${c.rule};padding:18px 28px;font-size:12px;line-height:1.55;color:${c.mute};">
        <div>${this.addressLine}</div>
        <div style="margin-top:6px;"><a href="${this.siteUrl}" style="color:${c.mute};text-decoration:underline;">${this.siteUrl.replace(/^https?:\/\//, '')}</a> &nbsp;·&nbsp; <a href="https://instagram.com/brumoutloud" style="color:${c.mute};text-decoration:underline;">@brumoutloud</a> &nbsp;·&nbsp; <a href="{{unsubscribe}}" style="color:${c.mute};text-decoration:underline;">Unsubscribe</a></div>
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

  /**
   * Main headline with a misprint double-shadow (pink + purple offsets)
   * that mirrors the Syne treatment on the site's carousel slides.
   * Gmail + Apple Mail honour text-shadow; Outlook ignores silently.
   */
  heading(text, { size = 38 } = {}) {
    const c = this.colors;
    const shadow = `-3px -2px 0 ${c.pink}, 3px 2px 0 ${c.purple}`;
    return `<div style="font-family:Impact,'Arial Black',sans-serif;font-weight:900;font-size:${size}px;line-height:1.02;letter-spacing:0.01em;color:${c.ink};text-transform:uppercase;margin:0 0 20px 0;text-shadow:${shadow};">${this.esc(text)}</div>`;
  }

  /** Plain paragraph with comfortable line-height for reading. */
  para(text) {
    return `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;">${text}</p>`;
  }

  /** Pink CTA — full-width block button, hard edges. */
  button(label, href, { size = 18 } = {}) {
    const c = this.colors;
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;"><tr>
      <td align="center" style="background:${c.pink};border:2px solid ${c.ink};">
        <a href="${this.esc(href)}" style="display:block;padding:16px 22px;font-family:Impact,'Arial Black',sans-serif;font-weight:900;font-size:${size}px;letter-spacing:0.14em;color:${c.paper};text-transform:uppercase;text-decoration:none;">${this.esc(label)} &rarr;</a>
      </td>
    </tr></table>`;
  }

  /** Key/value detail table for event summaries and IDs. */
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

  /** Promoter: "we've got your submission, it's queued". */
  getSubmissionConfirmationTemplate(eventName, eventId) {
    const name = this.esc(eventName);
    const html = this.getBaseTemplate(`
      ${this.heading(`Cheers, we've got it`)}
      ${this.para(`<strong>${name}</strong> is sitting in the queue with us. We look at everything that comes through — usually within a day or two.`)}
      ${this.para(`You'll hear either way: either it's live on the site, or we'll flag what needs a quick tweak and you can send it back.`)}
      ${this.kvTable([
        ['Event', name],
        ['Submission ID', this.esc(eventId)],
        ['Status', 'Waiting on review'],
      ])}
      ${this.para(`Anything to add or change in the meantime? Just reply.`)}
    `, `Cheers — we've got your submission`);

    const text = [
      `Cheers, we've got it`,
      ``,
      `"${eventName}" is sitting in the queue with us. We look at everything that comes through — usually within a day or two.`,
      ``,
      `You'll hear either way: either it's live on the site, or we'll flag what needs a quick tweak and you can send it back.`,
      ``,
      `Event: ${eventName}`,
      `Submission ID: ${eventId}`,
      `Status: Waiting on review`,
      ``,
      `Anything to add or change in the meantime? Just reply.`,
      ``,
      `Cheers,`,
      `${this.signature} — ${this.signatureTitle}`,
      `${this.siteUrl}`,
    ].join('\n');

    return { html, text };
  }

  /**
   * Promoter: "right, you're on" — big celebratory mini-poster.
   * `extras`: { image, eventDate, eventTime, venueName }. All optional.
   */
  getApprovalTemplate(eventName, eventUrl, extras = {}) {
    const c = this.colors;
    const name = this.esc(eventName);
    const url = eventUrl || this.siteUrl;

    const imgUrl = this.resolveEmailImage(extras.image, 600, 520);
    const dateLine = this.formatDateLine(extras.eventDate, extras.eventTime);
    const venue = extras.venueName ? this.esc(extras.venueName) : '';

    // Confetti strip between the CTA and the share section.
    const confetti = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 22px 0;">
        <tr>${this.pride.map(hex =>
          `<td width="16.6667%" height="14" style="background:${hex};line-height:14px;font-size:0;">&nbsp;</td>`
        ).join('')}</tr>
      </table>
    `;

    // Hero: flyer → toxic YOU'RE ON badge → dark poster card with
    // event name + meta. Badge copy is the voice marker — "RIGHT,
    // YOU'RE ON" reads like a mate, not a confirmation email.
    const heroHtml = `
      ${imgUrl ? `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="padding:0;font-size:0;line-height:0;background:${c.bg};">
            <img src="${this.esc(imgUrl)}" width="600" alt="${name}"
                 style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:0;">
          </td></tr>
        </table>
      ` : ''}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td align="center" style="background:${c.toxic};padding:18px 20px;font-family:Impact,'Arial Black',sans-serif;font-weight:900;font-size:30px;line-height:1;letter-spacing:0.18em;color:${c.ink};text-transform:uppercase;">
          Right, you're on.
        </td></tr>
        <tr><td style="background:${c.bg} url('${this.halftoneDataUri}') repeat;padding:30px 26px;">
          <div style="font-family:Impact,'Arial Black',sans-serif;font-weight:900;font-size:44px;line-height:1.02;letter-spacing:0.01em;color:${c.paper};text-transform:uppercase;margin:0 0 14px 0;text-shadow:-3px -2px 0 ${c.pink}, 3px 2px 0 ${c.purple};">
            ${name}
          </div>
          ${(dateLine || venue) ? `
            <div style="font-size:15px;line-height:1.55;color:${c.toxic};letter-spacing:0.1em;font-weight:700;text-transform:uppercase;">
              ${dateLine ? `<span>${dateLine}</span>` : ''}${(dateLine && venue) ? `<span style="opacity:0.5;">  ·  </span>` : ''}${venue ? `<span>${venue}</span>` : ''}
            </div>
          ` : ''}
        </td></tr>
      </table>
    `;

    const leadCopy = `
      <p style="margin:0 0 8px 0;font-size:18px;line-height:1.5;font-weight:600;">
        <strong>${name}</strong> is on the site. Birmingham can find you.
      </p>
      <p style="margin:0 0 0 0;font-size:16px;line-height:1.6;color:${c.mute};">
        Now the fun bit — getting people through the door.
      </p>
    `;

    const ctaHtml = this.button('See it live', url, { size: 20 });

    // Share-prompt cards — each ask gets a coloured rail so they
    // read as a playbook rather than a bullet list.
    const shareHtml = `
      <div style="font-family:Impact,'Arial Black',sans-serif;font-weight:900;font-size:32px;line-height:1.02;letter-spacing:0.01em;color:${c.ink};text-transform:uppercase;margin:0 0 6px 0;text-shadow:-2px -1px 0 ${c.pink}, 2px 1px 0 ${c.purple};">
        Now make it travel
      </div>
      <p style="margin:0 0 22px 0;font-size:16px;line-height:1.6;">Two things that genuinely move the door:</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px 0;border-left:6px solid ${c.pink};">
        <tr><td style="padding:16px 20px;background:#FAFAFA;">
          <div style="font-family:Impact,'Arial Black',sans-serif;font-weight:900;font-size:13px;letter-spacing:0.24em;color:${c.pink};text-transform:uppercase;margin:0 0 8px 0;">Step 1 · The Insta collab</div>
          <div style="font-size:16px;line-height:1.6;">
            Add <strong><a href="https://instagram.com/brumoutloud" style="color:${c.ink};">@brumoutloud</a></strong> as a collaborator when you post about this on Instagram. Your post, our audience, one upload — their followers see it in their feed too. Free reach.
          </div>
        </td></tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px 0;border-left:6px solid ${c.toxic};">
        <tr><td style="padding:16px 20px;background:#FAFAFA;">
          <div style="font-family:Impact,'Arial Black',sans-serif;font-weight:900;font-size:13px;letter-spacing:0.24em;color:${c.ink};text-transform:uppercase;margin:0 0 8px 0;">Step 2 · The repost</div>
          <div style="font-size:16px;line-height:1.6;">
            Repost anything we put up about your event — grid, story, reel. If we shout, you shout. Both audiences see it and the algorithm reads it as real momentum.
          </div>
        </td></tr>
      </table>

      <p style="margin:20px 0 0 0;font-size:15px;color:${c.mute};line-height:1.6;">Anything off on the listing? Reply — we'll fix it same day.</p>
    `;

    const html = this.getBaseTemplate({
      hero: heroHtml,
      body: `
        <div style="margin-top:-12px;margin-bottom:18px;">${leadCopy}</div>
        ${ctaHtml}
        ${confetti}
        ${shareHtml}
      `,
    }, `Right, you're on — ${eventName}`);

    const text = [
      `Right, you're on.`,
      ``,
      `${eventName}`,
      dateLine ? (venue ? `${dateLine} · ${extras.venueName}` : dateLine) : (venue ? extras.venueName : ''),
      ``,
      `${eventName} is on the site. Birmingham can find you.`,
      `Now the fun bit — getting people through the door.`,
      ``,
      `See it live: ${url}`,
      ``,
      `NOW MAKE IT TRAVEL`,
      `Two things that genuinely move the door:`,
      ``,
      `  1. The Insta collab — add @brumoutloud as a collaborator when you post about this on Instagram. Your post, our audience, one upload — their followers see it in their feed too. Free reach.`,
      ``,
      `  2. The repost — repost anything we put up about your event. Grid, story, reel. If we shout, you shout. Both audiences see it and the algorithm reads it as real momentum.`,
      ``,
      `Anything off on the listing? Reply — we'll fix it same day.`,
      ``,
      `Cheers,`,
      `${this.signature} — ${this.signatureTitle}`,
      `${this.siteUrl}`,
    ].filter(Boolean).join('\n');

    return { html, text };
  }

  /** Normalise a Cloudinary image to a 600px-wide JPG for email. */
  resolveEmailImage(raw, width = 600, maxHeight = 520) {
    if (!raw) return null;
    const str = typeof raw === 'object' && raw.url ? raw.url : raw;
    if (typeof str !== 'string' || !str) return null;
    const m = str.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/);
    if (m) {
      const tail = m[2].replace(/^[^/]+,[^/]+\//, '');
      return `${m[1]}w_${width},h_${maxHeight},c_fill,g_auto,f_jpg,q_auto/${tail}`;
    }
    return str;
  }

  /** "Sat 19 Apr · 8pm" — compact human date. */
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

  /**
   * Promoter: "nearly there, here's what to tweak".
   * When `resubmitUrl` is provided, the button deep-links back into
   * the form with the submission prefilled; otherwise we fall back
   * to a blank /submit link.
   */
  getRejectionTemplate(eventName, reason, { resubmitUrl } = {}) {
    const name = this.esc(eventName);
    const why = this.esc(reason || 'We need a bit more information before we can put it live.');
    const editUrl = resubmitUrl || `${this.siteUrl}/submit`;
    const html = this.getBaseTemplate(`
      ${this.heading('Nearly there')}
      ${this.para(`We can't put <strong>${name}</strong> live just yet — one or two bits need a tweak first.`)}
      ${this.kvTable([
        ['What to change', why],
      ])}
      ${this.para(`Hit the button below and we'll open your submission prefilled — sort the bits we've flagged and send it back. We'll turn it around fast.`)}
      ${this.button('Edit & resubmit', editUrl)}
      ${this.para(`Rather chat it through? Just reply — we'd rather help than bounce it.`)}
    `, `Nearly there — ${eventName}`);

    const text = [
      `Nearly there`,
      ``,
      `We can't put "${eventName}" live just yet — one or two bits need a tweak first.`,
      ``,
      `What to change: ${reason || 'We need a bit more information before we can put it live.'}`,
      ``,
      `Hit the link below and we'll open your submission prefilled — sort the bits we've flagged and send it back. We'll turn it around fast.`,
      `Edit & resubmit: ${editUrl}`,
      ``,
      `Rather chat it through? Just reply — we'd rather help than bounce it.`,
      ``,
      `Cheers,`,
      `${this.signature} — ${this.signatureTitle}`,
      `${this.siteUrl}`,
    ].join('\n');

    return { html, text };
  }

  /** Promoter: "quick nudge — tomorrow". */
  getEventReminderTemplate(eventName, eventDate, eventUrl) {
    const name = this.esc(eventName);
    const when = this.esc(eventDate);
    const url = eventUrl || this.siteUrl;
    const html = this.getBaseTemplate(`
      ${this.heading(`Tomorrow: ${eventName}`, { size: 34 })}
      ${this.para(`Quick nudge — your event's on <strong>tomorrow</strong>. If you've got one last post in you, now's the moment.`)}
      ${this.kvTable([
        ['Event', name],
        ['When', when],
      ])}
      ${this.button('Your listing', url)}
      ${this.para(`Plans changed? Reply and we'll update it tonight.`)}
    `, `Tomorrow — ${eventName}`);

    const text = [
      `Tomorrow: ${eventName}`,
      ``,
      `Quick nudge — your event's on tomorrow. If you've got one last post in you, now's the moment.`,
      ``,
      `Event: ${eventName}`,
      `When:  ${eventDate}`,
      ``,
      `Your listing: ${url}`,
      ``,
      `Plans changed? Reply and we'll update it tonight.`,
      ``,
      `Cheers,`,
      `${this.signature} — ${this.signatureTitle}`,
      `${this.siteUrl}`,
    ].join('\n');

    return { html, text };
  }

  /** Admin: "fresh one in the queue". Internal alert — terser. */
  getAdminSubmissionTemplate(eventName, promoterEmail, eventId) {
    const name = this.esc(eventName);
    const who = this.esc(promoterEmail || 'anonymous submitter');
    const reviewUrl = `${this.siteUrl}/admin-approvals.html`;
    const html = this.getBaseTemplate(`
      ${this.heading('Fresh one in the queue')}
      ${this.para(`<strong>${name}</strong> just landed. From <strong>${who}</strong>.`)}
      ${this.kvTable([
        ['Event', name],
        ['From', who],
        ['Submission ID', this.esc(eventId)],
      ])}
      ${this.button('Review it', reviewUrl)}
    `, `New submission — ${eventName}`);

    const text = [
      `Fresh one in the queue`,
      ``,
      `"${eventName}" just landed. From ${promoterEmail || 'anonymous submitter'}.`,
      ``,
      `Event: ${eventName}`,
      `From:  ${promoterEmail || 'anonymous submitter'}`,
      `Submission ID: ${eventId}`,
      ``,
      `Review it: ${reviewUrl}`,
    ].join('\n');

    return { html, text };
  }

  // ---- Back-compat --------------------------------------------------------

  /** Legacy callers that pass HTML through expecting text. */
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
