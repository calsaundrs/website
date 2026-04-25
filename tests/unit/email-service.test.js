/**
 * @jest-environment node
 */

jest.mock('firebase-admin', () => {
  const add = jest.fn().mockResolvedValue({ id: 'log-id' });
  return {
    apps: [{ name: 'default' }],
    initializeApp: jest.fn(),
    credential: { cert: jest.fn(() => ({})) },
    firestore: jest.fn(() => ({
      collection: jest.fn(() => ({ add })),
    })),
    __mockAdd: add,
  };
});

jest.mock('resend', () => {
  const send = jest.fn();
  return {
    Resend: jest.fn().mockImplementation(() => ({
      emails: { send },
    })),
    __sendMock: send,
  };
});

const { __sendMock: sendMock } = require('resend');
const EmailService = require('../../netlify/functions/services/email-service');

describe('EmailService', () => {
  let service;

  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: 'msg-1' }, error: null });
    service = new EmailService();
  });

  test('sendSubmissionConfirmation calls Resend with the confirmation subject and template', async () => {
    const result = await service.sendSubmissionConfirmation(
      'promoter@example.com',
      'Drag Brunch',
      'evt-1'
    );

    expect(result).toEqual({ success: true, messageId: 'msg-1' });
    expect(sendMock).toHaveBeenCalledTimes(1);

    const payload = sendMock.mock.calls[0][0];
    expect(payload.to).toEqual(['promoter@example.com']);
    expect(payload.subject).toMatch(/Submission received/);
    expect(payload.subject).toContain('Drag Brunch');
    expect(payload.html).toContain('Drag Brunch');
    expect(payload.html).toContain('evt-1');
    expect(payload.html).not.toContain('{{unsubscribe}}');
    expect(payload.html).toContain('/unsubscribe.html');
    expect(payload.headers['List-Unsubscribe']).toMatch(/unsubscribe\.html/);
    expect(payload.from).toMatch(/Brum Outloud/);
    expect(payload.reply_to).toBeTruthy();
  });

  test('sendApprovalNotification calls Resend with the approval template', async () => {
    await service.sendApprovalNotification(
      'promoter@example.com',
      'Karaoke Night',
      'https://brumoutloud.co.uk/event/karaoke-night'
    );

    const payload = sendMock.mock.calls[0][0];
    expect(payload.subject).toMatch(/live on Brum Outloud/);
    expect(payload.subject).toContain('Karaoke Night');
    expect(payload.html).toContain('Karaoke Night');
    expect(payload.html).toContain('https://brumoutloud.co.uk/event/karaoke-night');
  });

  test('sendRejectionNotification includes the reason text', async () => {
    await service.sendRejectionNotification(
      'promoter@example.com',
      'Needs Work',
      'Description was too short.'
    );

    const payload = sendMock.mock.calls[0][0];
    expect(payload.subject).toMatch(/Submission update/);
    expect(payload.html).toContain('Description was too short');
  });

  test('sendEventReminder uses a "Tomorrow" subject', async () => {
    await service.sendEventReminder(
      'promoter@example.com',
      'Disco Inferno',
      '2026-06-15',
      'https://brumoutloud.co.uk/event/disco-inferno'
    );

    const payload = sendMock.mock.calls[0][0];
    expect(payload.subject).toMatch(/^Tomorrow:/);
    expect(payload.subject).toContain('Disco Inferno');
  });

  test('sendAdminSubmissionAlert routes to the admin recipients list', async () => {
    process.env.ADMIN_EMAIL = 'admin1@example.com,admin2@example.com';
    const adminService = new EmailService();

    await adminService.sendAdminSubmissionAlert(
      'New Event',
      'promoter@example.com',
      'evt-99'
    );

    const payload = sendMock.mock.calls[0][0];
    expect(payload.to).toEqual(['admin1@example.com', 'admin2@example.com']);
    expect(payload.subject).toMatch(/New submission/);
    expect(payload.html).toContain('promoter@example.com');
  });

  test('Anonymous submitter is rendered when promoterEmail is empty', async () => {
    await service.sendAdminSubmissionAlert('Anonymous Event', null, 'evt-anon');
    const payload = sendMock.mock.calls[0][0];
    expect(payload.html).toContain('anonymous submitter');
  });

  test('throws and logs failure when Resend returns an error', async () => {
    sendMock.mockResolvedValueOnce({ data: null, error: { message: 'Rate limited' } });

    const result = await service.sendSubmissionConfirmation(
      'promoter@example.com',
      'Failing Event',
      'evt-fail'
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Rate limited/);
  });
});
