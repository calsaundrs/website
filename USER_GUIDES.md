# BrumOutLoud User Guides

## Overview

This guide provides step-by-step instructions for all user types on the BrumOutLoud platform. Whether you're looking for events, submitting content, or managing the platform, you'll find detailed instructions here.

**Last Updated:** July 2025  
**Platform Version:** 1.1.0

---

## 🎯 User Types

### 1. Event Seekers
People looking to discover and attend LGBTQ+ events in Birmingham.

### 2. Event Organizers
Promoters, venues, and community groups submitting events to the platform.

### 3. Venue Owners
Businesses and venues wanting to be listed in the directory.

### 4. Administrators
Platform managers handling content approval and system maintenance.

---

## 🎉 Event Seekers Guide

### Finding Events

#### Browse All Events
1. **Visit the Events Page**
   - Go to `events.html` or click "Events" in the navigation
   - View all upcoming events in chronological order

2. **Use Filters**
   - **Category Filter**: Select specific event types (Party, Social, Arts, etc.)
   - **Date Filter**: Choose specific dates or date ranges
   - **Venue Filter**: Filter by specific venues
   - **Search**: Use the search bar for keywords

3. **Event Information Available**
   - Event name and description
   - Date and time
   - Venue name and address
   - Event categories
   - Promotional images
   - Recurring event information

#### View Event Details
1. **Click on any event** to view full details
2. **Available actions:**
   - Add to calendar (Google, Apple, Outlook)
   - Share on social media
   - View venue information
   - See related events

#### Find Venues
1. **Visit the Venues Page**
   - Go to `venues.html` or click "Venues" in the navigation
   - Browse all LGBTQ+-friendly venues

2. **Venue Information**
   - Venue name and description
   - Address and contact information
   - Upcoming events at the venue
   - Venue type and features

### Mobile Usage
- **Responsive Design**: All pages work perfectly on mobile devices
- **Touch-Friendly**: Large buttons and easy navigation
- **Offline Access**: Service worker provides basic offline functionality
- **PWA Features**: Can be installed as a mobile app

### Accessibility Features
- **Keyboard Navigation**: Full site navigation using Tab, Enter, and Escape
- **Screen Reader Support**: ARIA labels and semantic HTML
- **High Contrast**: Enhanced focus states and color contrast
- **Skip Links**: Quick navigation to main content

---

## 📝 Event Organizers Guide

### Submitting Events

#### Standard Event Submission
1. **Access the Submission Form**
   - Go to `promoter-submit.html`
   - Or click "Submit Event" in the navigation

2. **Fill Out the Form**
   - **Event Name**: Clear, descriptive title
   - **Description**: Detailed event information
   - **Date & Time**: Event start and end times
   - **Venue**: Select from existing venues or add new
   - **Categories**: Select relevant event types
   - **Image**: Upload promotional image (optional but recommended)
   - **Contact Information**: Your contact details

3. **Recurring Events**
   - **Weekly Events**: Select day of week and frequency
   - **Monthly Events**: Choose specific dates or patterns
   - **Custom Recurrence**: Set up complex recurring patterns

4. **Submit and Track**
   - Click "Submit Event"
   - Receive confirmation email
   - Track approval status

#### Bulk Event Submission
1. **Use the AI Poster Tool**
   - Go to `admin-poster-tool.html` (requires admin access)
   - Upload event posters or flyers
   - AI extracts event information automatically
   - Review and edit extracted data
   - Submit multiple events at once

2. **Spreadsheet Upload**
   - Prepare CSV/Excel file with event data
   - Use the spreadsheet processor
   - AI processes and validates data
   - Bulk import events

### Event Management

#### Updating Events
1. **Contact Admin**: Email admin for event updates
2. **Provide Details**: Include event ID and changes needed
3. **Verification**: Admin will verify changes before updating

#### Best Practices
- **Clear Descriptions**: Provide detailed, engaging descriptions
- **High-Quality Images**: Use clear, promotional images
- **Accurate Information**: Double-check dates, times, and venue details
- **Regular Updates**: Keep event information current

### Venue Submission
1. **Submit Venue Information**
   - Go to `get-listed.html`
   - Fill out venue details form
   - Include venue type and features
   - Provide contact information

2. **Venue Approval Process**
   - Admin reviews submission
   - Verification of venue details
   - Approval and listing on platform

---

## 🏢 Venue Owners Guide

### Getting Listed

#### Venue Submission Process
1. **Complete Venue Form**
   - Venue name and description
   - Address and contact information
   - Venue type (Bar, Club, Restaurant, etc.)
   - LGBTQ+ friendly features
   - Operating hours
   - Contact person details

2. **Verification Process**
   - Admin reviews submission
   - May contact for additional information
   - Verification of venue details
   - Approval and listing

#### Venue Profile Management
1. **Update Information**
   - Contact admin for profile updates
   - Provide updated information
   - Include venue ID for reference

2. **Event Listings**
   - Events at your venue appear automatically
   - No additional action required
   - Events are linked to venue profile

### Benefits of Being Listed
- **Increased Visibility**: Reach LGBTQ+ community
- **Event Promotion**: Automatic event listings
- **Community Connection**: Connect with event organizers
- **Business Growth**: Attract new customers

---

## 🔧 Administrators Guide

### Accessing Admin Panel

#### Login Process
1. **Navigate to Admin Login**
   - Go to `admin-login.html`
   - Use Firebase authentication
   - Requires admin credentials

2. **Security Features**
   - Two-factor authentication (if enabled)
   - Session management
   - Secure logout

### Content Management

#### Event Approvals
1. **Review Pending Events**
   - Go to `admin-approvals.html`
   - View all pending submissions
   - Check event details and images

2. **Approval Actions**
   - **Approve**: Event goes live immediately
   - **Reject**: Event is removed with reason
   - **Request Changes**: Send back for editing
   - **Edit**: Make direct changes to event

3. **Bulk Operations**
   - Select multiple events
   - Bulk approve or reject
   - Mass status updates

#### Venue Management
1. **Venue Approvals**
   - Review venue submissions
   - Verify venue information
   - Approve or request changes

2. **Venue Updates**
   - Edit venue information
   - Update contact details
   - Manage venue status

### AI Tools

#### Poster Processing
1. **Upload Posters**
   - Go to `admin-poster-tool.html`
   - Upload event posters or flyers
   - AI extracts event information

2. **Review and Edit**
   - Check extracted data accuracy
   - Edit any incorrect information
   - Add missing details

3. **Bulk Import**
   - Process multiple posters
   - Review all extracted events
   - Bulk approve or edit

#### Spreadsheet Processing
1. **Upload Spreadsheets**
   - Support for CSV and Excel files
   - AI validates and processes data
   - Handles various formats

2. **Data Validation**
   - Check for required fields
   - Validate date formats
   - Verify venue references

### System Maintenance

#### Data Management
1. **Event Management**
   - Edit existing events
   - Remove outdated events
   - Update event information

2. **Venue Management**
   - Update venue details
   - Manage venue listings
   - Handle venue closures

#### Analytics and Monitoring
1. **Platform Usage**
   - Monitor event submissions
   - Track user engagement
   - Review system performance

2. **Error Monitoring**
   - Check function logs
   - Monitor API performance
   - Track user feedback

### Security and Access

#### User Management
1. **Admin Access**
   - Manage admin accounts
   - Control access levels
   - Monitor login activity

2. **Security Best Practices**
   - Regular password updates
   - Secure session management
   - Access logging

---

## 🆘 Troubleshooting

### Common Issues

#### For Event Seekers
**Problem**: Events not loading
- **Solution**: Refresh the page or check internet connection
- **Alternative**: Try accessing the site later

**Problem**: Can't find specific events
- **Solution**: Try different search terms or filters
- **Alternative**: Contact admin for assistance

#### For Event Organizers
**Problem**: Form submission fails
- **Solution**: Check all required fields are filled
- **Alternative**: Try submitting again or contact admin

**Problem**: Image upload issues
- **Solution**: Ensure image is under 5MB and in JPG/PNG format
- **Alternative**: Submit without image and add later

#### For Administrators
**Problem**: Can't access admin panel
- **Solution**: Check Firebase authentication
- **Alternative**: Contact system administrator

**Problem**: AI tools not working
- **Solution**: Check API keys and quotas
- **Alternative**: Process manually

### Getting Help

#### Contact Information
- **Technical Support**: [Admin Email]
- **Content Questions**: [Content Manager Email]
- **General Inquiries**: [General Contact Email]

#### Support Process
1. **Describe the Issue**: Provide detailed description
2. **Include Screenshots**: If applicable
3. **Specify User Type**: Event seeker, organizer, or admin
4. **Provide Context**: What you were trying to do

---

## 📱 Mobile Guide

### Mobile Features
- **Responsive Design**: Optimized for all screen sizes
- **Touch Navigation**: Easy-to-use touch controls
- **Fast Loading**: Optimized for mobile networks
- **Offline Access**: Basic functionality without internet

### Mobile Best Practices
- **Use Landscape Mode**: For better viewing on tablets
- **Enable Notifications**: For event updates
- **Bookmark the Site**: For quick access
- **Install as PWA**: For app-like experience

---

## ♿ Accessibility Guide

### Keyboard Navigation
- **Tab**: Navigate between elements
- **Enter/Space**: Activate buttons and links
- **Escape**: Close modals and menus
- **Arrow Keys**: Navigate within components

### Screen Reader Support
- **ARIA Labels**: All interactive elements labeled
- **Semantic HTML**: Proper heading structure
- **Alt Text**: Images have descriptive alt text
- **Focus Management**: Clear focus indicators

### Visual Accessibility
- **High Contrast**: Enhanced color contrast
- **Large Text**: Scalable text sizes
- **Focus Indicators**: Clear focus outlines
- **Color Independence**: Information not color-dependent

---

## 🔄 Platform Updates

### Recent Updates (July 2025)
- **Enhanced Mobile Menu**: Improved mobile navigation
- **Form Validation**: Better error handling and user feedback
- **Accessibility Improvements**: Enhanced keyboard and screen reader support
- **Performance Optimizations**: Faster loading times
- **AI Tool Enhancements**: Improved poster and spreadsheet processing

### Upcoming Features
- **User Accounts**: Personal event favorites and preferences
- **Real-time Notifications**: Live updates for new events
- **Advanced Search**: AI-powered event recommendations
- **Community Features**: Reviews and ratings system

---

*This guide is regularly updated to reflect the latest platform features and improvements. For the most current information, always refer to the live platform.*