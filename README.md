# BrumOutLoud - Birmingham's LGBTQ+ Events Platform

[![Netlify Status](https://api.netlify.com/api/v1/badges/your-badge-id/deploy-status)](https://app.netlify.com/sites/your-site/deploys)
[![License](https://img.shields.io/badge/license-Private-red.svg)]()
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)]()

> The definitive, bold, and unapologetic guide to Birmingham's LGBTQ+ scene

BrumOutLoud is a comprehensive events platform designed to be the go-to resource for LGBTQ+ events, venues, and community activities in Birmingham, UK. Built with modern web technologies and a focus on accessibility, performance, and user experience.

## 🌟 Features

### For Event-Goers
- **Comprehensive Event Listings** - Discover upcoming LGBTQ+ events across Birmingham
- **Advanced Filtering** - Find events by category, date, venue, and special features
- **Venue Directory** - Explore LGBTQ+-friendly venues with detailed information
- **Calendar Integration** - Add events directly to your calendar (Google, Apple, Outlook)
- **Mobile-First Design** - Optimized for all devices with Progressive Web App features
- **Accessibility Focused** - Full keyboard navigation and screen reader support

### For Event Organizers
- **Easy Event Submission** - Simple form-based event submission process
- **Recurring Events Support** - Set up weekly, monthly, or custom recurring events
- **Image Uploads** - High-quality image storage with automatic optimization
- **AI-Powered Tools** - Extract event information from posters and spreadsheets
- **Venue Management** - Submit and manage venue information
- **Status Tracking** - Track submission status and approval workflow

### For Administrators
- **Approval Workflow** - Review and approve events and venues
- **Content Management** - Full CRUD operations for events and venues
- **AI Processing Tools** - Bulk process posters and spreadsheets
- **Analytics Dashboard** - Monitor platform usage and performance
- **User Management** - Firebase-based authentication and authorization

## 🏗️ Architecture

### Technology Stack
- **Frontend**: HTML5, CSS3 (Tailwind), Vanilla JavaScript
- **Backend**: Netlify Functions (Node.js serverless)
- **Database**: Airtable
- **Authentication**: Firebase Authentication
- **Image Storage**: Cloudinary
- **AI Processing**: Google Gemini API
- **Deployment**: Netlify with Git-based CI/CD

### Key Components
```
┌─ Frontend (Static) ─────────────────────────┐
│ • HTML pages with Tailwind CSS             │
│ • Vanilla JavaScript for interactivity     │
│ • Progressive Web App features             │
└─────────────────────────────────────────────┘
                      ↓
┌─ Serverless Functions ──────────────────────┐
│ • 33 Netlify Functions (Node.js)           │
│ • RESTful API endpoints                    │
│ • Authentication middleware                │
└─────────────────────────────────────────────┘
                      ↓
┌─ External Services ─────────────────────────┐
│ • Airtable (Database)                      │
│ • Cloudinary (Image Storage)               │
│ • Firebase (Authentication)                │
│ • Google Gemini (AI Processing)            │
└─────────────────────────────────────────────┘
```

## 📚 Documentation

### Core Documentation
- **[API Documentation](API_DOCUMENTATION.md)** - Complete API reference with examples
- **[Frontend Documentation](FRONTEND_DOCUMENTATION.md)** - Frontend components and usage
- **[Functions Documentation](FUNCTIONS_DOCUMENTATION.md)** - Serverless functions reference
- **[Developer Guide](DEVELOPER_GUIDE.md)** - Setup, development, and deployment guide

### Additional Resources
- **[GEMINI.md](GEMINI.md)** - Project overview and development status
- **[Netlify Configuration](netlify.toml)** - Deployment and build settings
- **[Package Configuration](package.json)** - Dependencies and scripts

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Git
- Accounts for: Firebase, Airtable, Cloudinary, Google Cloud

### Installation

1. **Clone and install:**
```bash
git clone <repository-url>
cd brumoutloud-site
npm install
```

2. **Set up environment variables:**
```bash
# Copy example file
cp .env.example .env

# Add your API keys to .env file
AIRTABLE_PERSONAL_ACCESS_TOKEN=your_token
AIRTABLE_BASE_ID=your_base_id
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_secret
GEMINI_API_KEY=your_gemini_key
```

3. **Build and start:**
```bash
npm run build:css
netlify dev  # or npx live-server
```

### Project Structure
```
brumoutloud-site/
├── 📁 netlify/functions/    # 33+ serverless functions
├── 📁 js/                   # Client-side JavaScript
├── 📁 css/                  # Stylesheets (Tailwind + custom)
├── 📁 global/               # Shared components
├── 📄 *.html               # 24 page files
├── 📄 package.json         # Dependencies
└── 📄 netlify.toml        # Deployment config
```

## 🔧 Development

### Available Scripts
```bash
npm run build:css          # Build Tailwind CSS
npm run build:css -- --watch  # Watch for CSS changes
netlify dev                 # Start development server
netlify deploy              # Deploy to staging
netlify deploy --prod       # Deploy to production
```

### Key Development Commands
```bash
# Test functions locally
netlify functions:invoke function-name

# Check function logs
netlify functions:log

# Environment management
netlify env:list
netlify env:set KEY value
```

## 📖 API Overview

### Public Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/get-events` | GET | Retrieve event listings |
| `/get-event-details` | GET | Get individual event details |
| `/get-venues` | GET | Retrieve venue listings |
| `/get-venue-details` | GET | Get individual venue details |
| `/event-submission` | POST | Submit new events |
| `/venue-submission` | POST | Submit new venues |
| `/sitemap` | GET | XML sitemap for SEO |

### Admin Endpoints (Auth Required)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/get-pending-events` | GET | Events awaiting approval |
| `/get-pending-venues` | GET | Venues awaiting approval |
| `/create-approved-event` | POST | Create/update approved events |
| `/update-item-status` | POST | Update approval status |
| `/process-poster` | POST | AI poster processing |
| `/process-spreadsheet` | POST | Spreadsheet data extraction |

### Example Usage
```javascript
// Get upcoming events
const response = await fetch('/.netlify/functions/get-events');
const { events } = await response.json();

// Submit a new event
const formData = new FormData();
formData.append('eventName', 'Pride Night');
formData.append('description', 'Weekly celebration...');
formData.append('date', '2024-07-15');

const result = await fetch('/.netlify/functions/event-submission', {
  method: 'POST',
  body: formData
});
```

## 🎨 Frontend Components

### Page Types

#### Public Pages
- **Homepage** (`index.html`) - Landing page with featured events
- **Events** (`events.html`) - Searchable event listings
- **Venues** (`venues.html`) - Venue directory
- **Community** (`community.html`) - Community information
- **Submission Forms** (`promoter-submit.html`, `get-listed.html`)

#### Admin Interface
- **Login** (`admin-login.html`) - Firebase authentication
- **Approvals** (`admin-approvals.html`) - Content moderation
- **Management** (`admin-edit-events.html`, `admin-manage-venues.html`)
- **Tools** (`admin-poster-tool.html`) - AI processing tools

### JavaScript Components
```javascript
// Core functionality
- js/main.js           // Welcome modal, service worker
- js/auth-guard.js     // Authentication for admin pages

// Usage patterns
- Event handling and form validation
- API communication with error handling
- Image upload with preview
- Authentication state management
```

### CSS Framework
- **Tailwind CSS** for utility-first styling
- **Custom components** for brand-specific elements
- **Responsive design** with mobile-first approach
- **Accessibility features** built-in

## 🔐 Security & Authentication

### Authentication Flow
1. **Firebase Authentication** for admin users
2. **JWT tokens** for API authorization
3. **Route protection** via auth guards
4. **Secure environment variables** for API keys

### Security Features
- Input validation and sanitization
- CORS headers for API security
- Content Security Policy headers
- Rate limiting on API endpoints
- Secure image upload handling

## 🚀 Deployment

### Netlify Deployment
- **Automatic deployment** from Git pushes
- **Environment variables** managed in Netlify dashboard
- **Function deployment** alongside static assets
- **Custom domains** and SSL certificates

### Build Process
1. Install dependencies (`npm install`)
2. Build CSS (`npm run build:css`)
3. Deploy functions and static files
4. Update environment variables
5. Test deployment endpoints

### Environment Configuration
```toml
# netlify.toml
[build]
  command = "npm run build:css"
  functions = "netlify/functions"
  publish = "."

[[redirects]]
  from = "/admin/*"
  to = "/:splat"
  status = 200
```

## 🧪 Testing

### Manual Testing Checklist
- [ ] Event submission and approval workflow
- [ ] Image uploads and optimization
- [ ] Authentication and authorization
- [ ] Responsive design across devices
- [ ] Accessibility with assistive technologies
- [ ] Progressive Web App features

### Function Testing
```bash
# Test individual functions
netlify functions:invoke get-events
netlify functions:invoke event-submission --payload='{"test": true}'

# Test with authentication
netlify functions:invoke get-pending-events --identity
```

## 📊 Performance & Monitoring

### Performance Features
- **Cloudinary CDN** for optimized image delivery
- **Lazy loading** for images and content
- **Service worker** for offline caching
- **Minified assets** for faster loading

### Monitoring
- **Netlify Analytics** for deployment and function metrics
- **Console logging** for error tracking
- **Performance monitoring** via browser tools
- **Uptime monitoring** for critical endpoints

## 🤝 Contributing

### Development Process
1. **Fork repository** and create feature branch
2. **Make changes** following coding standards
3. **Test thoroughly** using manual and automated tests
4. **Submit pull request** with clear description
5. **Code review** and deployment

### Coding Standards
- **ES6+ JavaScript** with async/await patterns
- **Semantic HTML** with accessibility features
- **Tailwind CSS** with component-based styling
- **RESTful API design** with consistent responses
- **Error handling** with user-friendly messages

### Pull Request Guidelines
- Clear description of changes
- Screenshots for UI modifications
- Testing checklist completion
- Documentation updates if needed

## 📈 Analytics & Insights

### Key Metrics
- **Event submissions** per month
- **Venue directory** growth
- **User engagement** on event pages
- **API performance** and error rates
- **Mobile vs desktop** usage patterns

### Future Enhancements
- **User accounts** for event favorites
- **Real-time notifications** for new events
- **Advanced search** with AI-powered recommendations
- **Mobile app** for iOS and Android
- **Community features** like reviews and ratings

## 🆘 Support & Troubleshooting

### Common Issues
1. **Function deployment errors** - Check logs and environment variables
2. **Authentication failures** - Verify Firebase configuration
3. **API connection issues** - Test endpoint connectivity
4. **CSS build problems** - Check Tailwind configuration

### Debug Commands
```bash
# Check function logs
netlify functions:log

# Test API connectivity
curl https://your-site.netlify.app/.netlify/functions/get-events

# Validate environment
netlify env:list
```

### Resources
- **[Netlify Functions Docs](https://docs.netlify.com/functions/overview/)**
- **[Airtable API Reference](https://airtable.com/developers/web/api/introduction)**
- **[Firebase Auth Guide](https://firebase.google.com/docs/auth)**
- **[Tailwind CSS Docs](https://tailwindcss.com/docs)**

## 📄 License

This project is proprietary and confidential. All rights reserved.

## 📞 Contact

For questions, support, or collaboration opportunities:
- **Development Team**: [Contact Information]
- **Project Repository**: [GitHub/GitLab URL]
- **Issue Tracking**: [Issue Tracker URL]
- **Documentation**: Available in this repository

---

## 🏳️‍🌈 Community Impact

BrumOutLoud is more than just an events platform - it's a vital resource for Birmingham's LGBTQ+ community. By providing a centralized, accessible, and user-friendly platform for discovering events and venues, we're helping to:

- **Strengthen community connections** through easier event discovery
- **Support local businesses** by increasing venue visibility
- **Promote inclusive spaces** that welcome all community members
- **Preserve event information** for future community reference
- **Reduce barriers** to community participation

Our commitment extends beyond technology to actively supporting and uplifting Birmingham's diverse LGBTQ+ community through thoughtful design, inclusive practices, and community-centered development.

---

*Last updated: December 2024*
*Platform Version: 1.0.0*

**Built with ❤️ for Birmingham's LGBTQ+ community**