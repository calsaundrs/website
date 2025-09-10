# Email Notification System Documentation

## Overview

The Brum Outloud platform now includes a comprehensive email notification system powered by the Resend API. This system provides automated communication between the platform, event promoters, and administrators throughout the event lifecycle.

## Features Implemented

### 🎯 Automated Promoter Notifications

#### 1. Submission Confirmation
- **Trigger**: When a promoter submits a new event
- **Recipient**: Event promoter
- **Content**: Confirmation that submission was received, event ID, and next steps
- **Template**: Professional HTML email with event details and promoter tools link

#### 2. Approval/Rejection Emails
- **Trigger**: When admin approves or rejects an event submission
- **Recipient**: Event promoter
- **Content**: 
  - **Approval**: Congratulations message with live event URL
  - **Rejection**: Constructive feedback with resubmission instructions
- **Templates**: Branded HTML emails with clear call-to-action buttons

#### 3. Event Reminders
- **Trigger**: Daily scheduled function (9 AM UTC) for events happening tomorrow
- **Recipient**: Event promoter
- **Content**: Friendly reminder with event details and sharing encouragement
- **Template**: Motivational HTML email with event information

### 🔧 Admin-Facing Tools & Notifications

#### 1. New Submission Alerts
- **Trigger**: When a new event is submitted
- **Recipient**: Admin email address
- **Content**: Event details, promoter information, and direct link to admin panel
- **Template**: Admin-focused HTML email with quick action buttons

#### 2. Central Email Management Hub
- **Location**: `/admin-email-management.html`
- **Features**:
  - **Template Preview**: View all email templates with sample data
  - **Test Email System**: Send test emails to any address
  - **Email Logs**: View all sent emails with status and details
  - **Resend Failed Emails**: One-click resend for failed deliveries
  - **Email Statistics**: Success rates, volume metrics, and performance data

## Technical Implementation

### Core Components

#### 1. Email Service (`/netlify/functions/services/email-service.js`)
- **Purpose**: Central email management service
- **Features**:
  - Resend API integration
  - Email template management
  - Firestore logging
  - Error handling and retry logic

#### 2. Email Notification Function (`/netlify/functions/send-email-notification.js`)
- **Purpose**: Handle email sending requests
- **Supported Types**:
  - `submission_confirmation`
  - `approval_notification`
  - `rejection_notification`
  - `event_reminder`
  - `admin_submission_alert`

#### 3. Email Logs Management (`/netlify/functions/get-email-logs.js`)
- **Purpose**: Retrieve and manage email logs
- **Features**:
  - View email history
  - Filter by status
  - Resend failed emails

#### 4. Scheduled Event Reminders (`/netlify/functions/scheduled-event-reminders.js`)
- **Purpose**: Automated daily reminder system
- **Schedule**: Daily at 9 AM UTC
- **Process**: Query tomorrow's events and send reminders to promoters

### Integration Points

#### Event Submission Flow
1. User submits event via `/promoter-submit-new.html`
2. `event-submission-firestore-only.js` processes submission
3. **NEW**: Sends submission confirmation email to promoter
4. **NEW**: Sends admin notification email
5. Event saved to Firestore with `pending` status

#### Event Approval Flow
1. Admin reviews event in `/admin-approvals.html`
2. Admin approves/rejects event
3. `update-and-notify.js` updates Firestore status
4. **NEW**: Sends approval/rejection email to promoter
5. **NEW**: Logs email delivery status

### Database Schema

#### Email Logs Collection (`email_logs`)
```javascript
{
  to: "promoter@example.com",
  subject: "Event Submitted Successfully - Event Name",
  status: "sent", // "sent", "failed", "pending"
  messageId: "resend-message-id",
  sentAt: "2024-01-15T10:30:00Z",
  content: {
    html: "<html>...</html>",
    text: "Plain text version..."
  },
  error: "Error message if failed",
  createdAt: "2024-01-15T10:30:00Z"
}
```

## Email Templates

### Design Principles
- **Brand Consistency**: Uses Brum Outloud colors and styling
- **Mobile Responsive**: Optimized for all device sizes
- **Accessibility**: High contrast, readable fonts, alt text
- **Professional**: Clean, modern design with clear hierarchy

### Template Types

#### 1. Submission Confirmation
- **Color Scheme**: Blue gradient header
- **Key Elements**: Event name, event ID, next steps
- **Call-to-Action**: Link to promoter tools

#### 2. Approval Notification
- **Color Scheme**: Green gradient header
- **Key Elements**: Congratulations message, live event URL
- **Call-to-Action**: View event button

#### 3. Rejection Notification
- **Color Scheme**: Orange gradient header
- **Key Elements**: Constructive feedback, resubmission instructions
- **Call-to-Action**: Resubmit event button

#### 4. Event Reminder
- **Color Scheme**: Blue gradient header
- **Key Elements**: Event details, encouragement message
- **Call-to-Action**: View event button

#### 5. Admin Submission Alert
- **Color Scheme**: Purple gradient header
- **Key Elements**: Event details, promoter info, admin actions
- **Call-to-Action**: Review submission button

## Configuration

### Environment Variables

Add these to your Netlify dashboard:

```bash
# Resend API Configuration
RESEND_API_KEY=re_xxxxxxxxxx

# Admin Email for Notifications
ADMIN_EMAIL=admin@brumoutloud.co.uk

# Firebase Configuration (existing)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### Netlify Configuration

The system includes scheduled functions in `netlify.toml`:

```toml
[functions."scheduled-event-reminders"]
  schedule = "0 9 * * *"  # Daily at 9 AM UTC
```

## Usage Guide

### For Administrators

#### Accessing Email Management
1. Go to `/admin-settings.html`
2. Click "Email Management" (new green "NEW" badge)
3. Access the comprehensive email management hub

#### Managing Email Templates
1. **Preview Templates**: Click any template button to see the design
2. **Test Emails**: Use the test form to send sample emails
3. **View Logs**: Monitor all email activity and delivery status
4. **Resend Failed Emails**: One-click resend for any failed delivery

#### Email Statistics
- **Total Sent**: Count of all emails sent
- **Failed**: Count of failed deliveries
- **Success Rate**: Percentage of successful deliveries
- **Last 24h**: Emails sent in the last 24 hours

### For Promoters

#### What to Expect
1. **Immediate Confirmation**: After submitting an event
2. **Status Updates**: When your event is approved or needs changes
3. **Event Reminders**: One day before your event (if approved)

#### Email Content
- Professional, branded emails
- Clear information and next steps
- Direct links to relevant pages
- Mobile-friendly design

## Monitoring and Maintenance

### Email Delivery Monitoring
- All emails are logged in Firestore
- Failed deliveries are tracked with error messages
- Success rates are calculated and displayed
- Resend functionality for failed emails

### Performance Metrics
- Email volume tracking
- Delivery success rates
- Response time monitoring
- Error rate analysis

### Troubleshooting

#### Common Issues
1. **Failed Email Delivery**
   - Check Resend API key configuration
   - Verify recipient email addresses
   - Review error logs in admin panel

2. **Missing Notifications**
   - Ensure promoter provided valid email
   - Check Firestore email logs
   - Verify scheduled function execution

3. **Template Issues**
   - Use test email feature to validate templates
   - Check HTML rendering in different email clients
   - Verify all template variables are populated

## Security Considerations

### Data Protection
- Email addresses are stored securely in Firestore
- No sensitive data in email content
- GDPR-compliant data handling

### API Security
- Resend API key stored as environment variable
- Rate limiting handled by Resend service
- Error messages don't expose sensitive information

## Future Enhancements

### Planned Features
- **Email Preferences**: Allow promoters to opt-out of certain emails
- **Custom Templates**: Admin ability to customize email templates
- **Advanced Analytics**: Detailed email engagement metrics
- **A/B Testing**: Test different email versions
- **Bulk Operations**: Send emails to multiple promoters

### Integration Possibilities
- **SMS Notifications**: Add SMS reminders for urgent events
- **Push Notifications**: Browser push notifications for admins
- **Slack Integration**: Admin notifications to Slack channels
- **Webhook Support**: External system notifications

## Support and Maintenance

### Regular Tasks
- Monitor email delivery success rates
- Review failed email logs weekly
- Update email templates as needed
- Test email system monthly

### Backup and Recovery
- Email logs are stored in Firestore (automatically backed up)
- Template configurations are version controlled
- Environment variables are secured in Netlify

---

## Quick Start Checklist

### For New Deployments
- [ ] Add Resend API key to Netlify environment variables
- [ ] Set admin email address in environment variables
- [ ] Deploy the updated functions
- [ ] Test email system using admin panel
- [ ] Verify scheduled function is running
- [ ] Monitor first few email deliveries

### For Existing Deployments
- [ ] Install Resend dependency (`npm install resend`)
- [ ] Add new environment variables
- [ ] Deploy updated functions
- [ ] Test with existing event submissions
- [ ] Update admin panel navigation
- [ ] Train admin users on new features

The email notification system is now fully integrated and ready to improve communication across the Brum Outloud platform! 🎉
