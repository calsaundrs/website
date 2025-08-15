# 🔧 System Monitoring & Testing Guide

## Overview

The system monitoring and testing system provides comprehensive health checks for your event management platform. It automatically tests all critical functions and sends push notifications when issues are detected.

## 🚀 Features

### Automated Testing
- **10 comprehensive tests** covering all critical system components
- **Real-time monitoring** with configurable intervals
- **Performance metrics** tracking response times and error rates
- **Cache functionality** validation
- **Environment variable** verification

### Push Notifications
- **Browser push notifications** for admin users
- **Automatic permission requests** when accessing admin pages
- **Real-time polling** for new notifications
- **Firestore storage** for notification history
- **Severity levels** (high, medium, low)

### Admin Dashboard
- **Real-time status** display
- **Manual testing** capabilities
- **Historical data** viewing
- **Auto-refresh** functionality
- **Detailed test results** with performance metrics

## 📋 Test Coverage

### 1. Firestore Connection Test
- **Purpose**: Verifies database connectivity
- **Tests**: Connection speed, collection access, document retrieval
- **Threshold**: < 5000ms response time

### 2. EventService Test
- **Purpose**: Validates core event management functionality
- **Tests**: Event retrieval, caching, admin mode
- **Threshold**: Successful data retrieval

### 3. SeriesManager Test
- **Purpose**: Ensures series management works correctly
- **Tests**: Series retrieval, instance management
- **Threshold**: Series data accessible

### 4. API Endpoint Tests
- **get-events**: Public event listing
- **get-pending-events**: Admin pending events
- **get-recurring-events**: Series management
- **get-event-details**: Individual event pages
- **Threshold**: HTTP 200 responses

### 5. Data Integrity Tests
- **Series Slug Uniqueness**: Ensures no duplicate slugs
- **Cache Functionality**: Validates caching system
- **Environment Variables**: Checks required config

## 🛠️ Setup Instructions

### 1. Environment Variables

Add these to your Netlify dashboard:

```bash
# Required
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_PRIVATE_KEY=your_private_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 2. Firestore Setup

The system automatically creates a "system_notifications" collection in Firestore with these fields:

| Field Name | Type | Description |
|------------|------|-------------|
| type | String | Notification type (system_alert, etc.) |
| title | String | Alert title |
| message | String | Alert message |
| severity | String | high, medium, low |
| details | Object | JSON details |
| timestamp | Timestamp | When alert was created |
| status | String | New, Read, Resolved |

### 3. Scheduled Functions

The system automatically runs health checks every 15 minutes. To modify the schedule, update `netlify.toml`:

```toml
[functions."scheduled-health-check"]
  schedule = "0 */15 * * *"  # Cron syntax
```

Common schedules:
- `0 */15 * * *` - Every 15 minutes
- `0 */30 * * *` - Every 30 minutes
- `0 0 * * *` - Daily at midnight
- `0 */6 * * *` - Every 6 hours

## 📊 Admin Dashboard Usage

### Accessing the Dashboard

Navigate to `/admin-system-status.html` in your admin panel.

### Key Features

#### 1. Overall Status
- **Green**: All systems operational
- **Yellow**: Some issues detected
- **Red**: Critical issues
- **Gray**: Status unknown

#### 2. Manual Testing
- Click "Run Health Check" to test immediately
- View detailed results for each test
- See performance metrics and error rates

#### 3. Auto Refresh
- Enable automatic status updates every 30 seconds
- Real-time monitoring without manual intervention

#### 4. Notifications
- View all system alerts
- Filter by severity level
- Mark notifications as read/resolved

## 🔔 Notification System

### Browser Push Notifications

The system uses browser push notifications to alert admin users when issues are detected. This approach is simpler and more direct than external webhook services.

#### How It Works

1. **Automatic Permission Request**: When an admin visits any admin page, the system automatically requests notification permissions
2. **Real-time Polling**: The system polls for new notifications every 30 seconds when admin is logged in
3. **Instant Alerts**: When system issues are detected, browser notifications are sent immediately
4. **Click to Navigate**: Clicking a notification takes you directly to the system status page

#### Setup

No additional setup required! The system will:
- Request notification permissions automatically
- Start polling when you visit admin pages
- Send notifications when issues are detected

### Notification Types

#### System Alerts
- **Trigger**: Test failures
- **Severity**: High
- **Content**: Failed test names and error messages

#### Performance Warnings
- **Trigger**: Slow response times
- **Severity**: Medium
- **Content**: Performance metrics

#### Maintenance Notices
- **Trigger**: Manual admin actions
- **Severity**: Low
- **Content**: System maintenance updates

## 📈 Performance Metrics

### Response Times
- **Excellent**: < 1000ms
- **Good**: 1000-3000ms
- **Warning**: 3000-5000ms
- **Critical**: > 5000ms

### Error Rates
- **Healthy**: 0%
- **Warning**: 1-5%
- **Critical**: > 5%

### Cache Hit Rate
- **Target**: > 80%
- **Warning**: 60-80%
- **Critical**: < 60%

## 🚨 Troubleshooting

### Common Issues

#### 1. Tests Failing
- Check environment variables
- Verify Airtable permissions
- Review function logs in Netlify

#### 2. Notifications Not Sending
- Verify webhook URLs
- Check Slack/Discord permissions
- Review Airtable table structure

#### 3. High Response Times
- Check Airtable API limits
- Review function cold starts
- Optimize database queries

### Debug Mode

Enable debug logging by adding to environment variables:

```bash
DEBUG=true
NODE_ENV=development
```

### Manual Testing

Test individual components:

```bash
# Test Airtable connection
curl -X POST https://your-site.netlify.app/.netlify/functions/run-system-tests

# Get system status
curl https://your-site.netlify.app/.netlify/functions/get-system-status

# Get notifications
curl https://your-site.netlify.app/.netlify/functions/get-notifications
```

## 🔧 Customization

### Adding New Tests

1. Add test method to `SystemMonitor` class:

```javascript
async testCustomFunction() {
  const startTime = Date.now();
  
  try {
    // Your test logic here
    const result = await yourFunction();
    
    const duration = Date.now() - startTime;
    
    return {
      duration,
      details: {
        // Test-specific details
      }
    };
  } catch (error) {
    throw new Error(`Custom test failed: ${error.message}`);
  }
}
```

2. Add to test array in `runAllTests()`:

```javascript
const tests = [
  // ... existing tests
  { name: 'custom-function', test: () => this.testCustomFunction() }
];
```

### Custom Notifications

Add new notification types:

```javascript
await this.sendNotification({
  type: 'custom_alert',
  title: 'Custom Alert',
  message: 'Custom message',
  details: { custom: 'data' },
  severity: 'medium'
});
```

### Performance Thresholds

Modify thresholds in test methods:

```javascript
// Example: Change response time threshold
if (duration > 3000) { // 3 seconds instead of 5
  throw new Error('Response time too slow');
}
```

## 📚 API Reference

### System Monitor Methods

#### `runAllTests()`
Runs all system health checks.

**Returns**: Promise with test results

#### `getSystemStatus()`
Gets current system status without running tests.

**Returns**: System status object

#### `sendNotification(notification)`
Sends a notification to all configured channels.

**Parameters**:
- `notification`: Notification object with type, title, message, severity, details

### Netlify Functions

#### `run-system-tests`
- **Method**: POST
- **Purpose**: Run health checks manually
- **Response**: Test results

#### `get-system-status`
- **Method**: GET
- **Purpose**: Get current status
- **Response**: System status

#### `get-notifications`
- **Method**: GET
- **Purpose**: Get notification history
- **Response**: Array of notifications

#### `scheduled-health-check`
- **Method**: POST (automated)
- **Purpose**: Scheduled health checks
- **Schedule**: Every 15 minutes

## 🎯 Best Practices

### 1. Monitoring Strategy
- Run tests every 15-30 minutes
- Set up multiple notification channels
- Review alerts within 1 hour
- Document resolution procedures

### 2. Performance Optimization
- Cache frequently accessed data
- Optimize database queries
- Use connection pooling
- Monitor API rate limits

### 3. Alert Management
- Set appropriate severity levels
- Avoid alert fatigue
- Create escalation procedures
- Maintain alert history

### 4. Maintenance
- Regular review of test coverage
- Update thresholds based on usage
- Clean up old notifications
- Monitor system resources

## 🔮 Future Enhancements

### Planned Features
- **Email notifications** for critical alerts
- **SMS alerts** for urgent issues
- **Dashboard widgets** for key metrics
- **Custom test builder** UI
- **Performance trending** graphs
- **Automated recovery** actions

### Integration Possibilities
- **PagerDuty** for on-call alerts
- **Datadog** for advanced monitoring
- **Grafana** for metrics visualization
- **Zapier** for workflow automation

---

## 📞 Support

For issues with the monitoring system:

1. Check the admin dashboard for current status
2. Review Netlify function logs
3. Verify environment variables
4. Test individual components manually
5. Contact system administrator

**Remember**: The monitoring system is designed to catch issues before they affect users. Regular review and maintenance ensures optimal system performance.