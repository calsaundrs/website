/**
 * @jest-environment node
 */

const EmailTemplates = require('../../netlify/functions/services/email-templates');

describe('EmailTemplates', () => {
  let templates;

  beforeEach(() => {
    templates = new EmailTemplates();
  });

  function expectShellElements({ html }) {
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Brum Outloud');
    expect(html).toContain('{{unsubscribe}}');
    for (const hex of templates.pride) {
      expect(html.toLowerCase()).toContain(hex.toLowerCase());
    }
  }

  function expectTextSignature(text) {
    expect(text).toContain('Cal');
    expect(text).toContain('Brum Outloud');
    expect(text).toContain('https://brumoutloud.co.uk');
  }

  test('getSubmissionConfirmationTemplate includes event name and id', () => {
    const result = templates.getSubmissionConfirmationTemplate('Drag Brunch Spectacular', 'evt-123');
    expectShellElements(result);
    expect(result.html).toContain('Drag Brunch Spectacular');
    expect(result.html).toContain('evt-123');
    expect(result.text).toContain('Drag Brunch Spectacular');
    expect(result.text).toContain('evt-123');
    expectTextSignature(result.text);
  });

  test('getApprovalTemplate includes event name and links to event url', () => {
    const result = templates.getApprovalTemplate('Karaoke Night', 'https://brumoutloud.co.uk/event/karaoke-night');
    expectShellElements(result);
    expect(result.html).toContain('Karaoke Night');
    expect(result.html).toContain('https://brumoutloud.co.uk/event/karaoke-night');
  });

  test('getApprovalTemplate accepts optional extras (image, date, venue)', () => {
    const result = templates.getApprovalTemplate('Pride Quiz', 'https://example.com/pride-quiz', {
      image: 'https://example.com/poster.jpg',
      eventDate: '2026-05-23',
      eventTime: '20:00',
      venueName: 'Eden Bar',
    });
    expectShellElements(result);
    expect(result.html).toContain('Pride Quiz');
    expect(result.html).toContain('Eden Bar');
  });

  test('getRejectionTemplate includes the reason and event name', () => {
    const result = templates.getRejectionTemplate('Bad Submission', 'Duplicate listing — already on the site.');
    expectShellElements(result);
    expect(result.html).toContain('Bad Submission');
    expect(result.html).toContain('Duplicate listing');
    expect(result.text).toContain('Duplicate listing');
  });

  test('getRejectionTemplate links to the resubmit URL when provided', () => {
    const result = templates.getRejectionTemplate('Needs Work', 'Description was too short.', {
      resubmitUrl: 'https://brumoutloud.co.uk/promoter-submit-new?resubmit=token123',
    });
    expect(result.html).toContain('resubmit=token123');
  });

  test('getEventReminderTemplate includes event name, date, and url', () => {
    const result = templates.getEventReminderTemplate(
      'Disco Inferno',
      '2026-06-15',
      'https://brumoutloud.co.uk/event/disco-inferno'
    );
    expectShellElements(result);
    expect(result.html).toContain('Disco Inferno');
    expect(result.html).toContain('https://brumoutloud.co.uk/event/disco-inferno');
  });

  test('getAdminSubmissionTemplate includes promoter email and event details', () => {
    const result = templates.getAdminSubmissionTemplate(
      'Sunday Roast Social',
      'promoter@example.com',
      'evt-abc'
    );
    expectShellElements(result);
    expect(result.html).toContain('Sunday Roast Social');
    expect(result.html).toContain('promoter@example.com');
    expect(result.html).toContain('evt-abc');
  });

  test('esc() escapes HTML in interpolated values', () => {
    const result = templates.getSubmissionConfirmationTemplate('Evil <script>alert(1)</script>', 'id');
    expect(result.html).not.toContain('<script>alert(1)</script>');
    expect(result.html).toContain('&lt;script&gt;');
  });
});
