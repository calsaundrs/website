# BrumOutLoud Developer Guide

## Overview

Welcome to the BrumOutLoud developer documentation! This guide provides everything you need to understand, develop, and maintain the Birmingham LGBTQ+ events platform.

**Project Type:** Static website with serverless backend
**Deployment:** Netlify with continuous deployment
**License:** Private/Commercial

---

## Quick Start

### Prerequisites
- **Node.js** 18+ and npm
- **Git** for version control
- **Netlify CLI** (optional, for local development)
- **Firebase account** (for authentication)
- **Firebase account** (for database)
- **Cloudinary account** (for image storage)
- **Google Cloud account** (for AI features)

### Installation

1. **Clone the repository:**
```bash
git clone <repository-url>
cd brumoutloud-site
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables:**
```bash
# Create .env file for local development
cp .env.example .env
# Edit .env with your API keys
```

4. **Build CSS:**
```bash
npm run build:css
```

5. **Start local development:**
```bash
# Option 1: Use Netlify CLI (recommended)
netlify dev

# Option 2: Use any static server
npx live-server
```

---

## Project Structure

```
brumoutloud-site/
├── netlify/
│   └── functions/           # Serverless functions
│       ├── get-events.js
│       ├── event-submission.js
│       └── ...
├── js/
│   ├── main.js             # Core JavaScript
│   └── auth-guard.js       # Authentication
├── css/
│   ├── main.css           # Custom styles
│   └── tailwind.css       # Compiled Tailwind
├── global/
│   ├── header.html        # Shared header
│   └── footer.html        # Shared footer
├── *.html                 # Page files
├── package.json           # Dependencies
├── netlify.toml          # Netlify configuration
├── tailwind.config.js    # Tailwind configuration
└── manifest.json         # PWA manifest
```

---

## Architecture Overview

### Frontend Architecture
```
Browser
    ↓
Static HTML/CSS/JS (Netlify CDN)
    ↓
Netlify Functions (AWS Lambda)
    ↓
External Services (Firestore, Cloudinary, Firebase, Gemini)
```

### Key Components

1. **Static Frontend**
   - HTML pages with Tailwind CSS
   - Vanilla JavaScript for interactivity
   - Progressive Web App features

2. **Serverless Backend**
   - Netlify Functions (Node.js)
   - RESTful API endpoints
   - Authentication middleware

3. **External Services**
   - **Airtable:** Database for events and venues
   - **Cloudinary:** Image storage and optimization
   - **Firebase:** User authentication
   - **Google Gemini:** AI processing

---

## Development Workflow

### Local Development

1. **Environment Setup:**
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Link to your site
netlify link

# Start development server
netlify dev
```

2. **Environment Variables:**
Create `.env` file in project root:
```bash
AIRTABLE_PERSONAL_ACCESS_TOKEN=patXXXXXXXXXXXXXX
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=your-secret
GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

3. **CSS Development:**
```bash
# Watch for changes and rebuild CSS
npm run build:css -- --watch

# Or build once
npm run build:css
```

### Testing

#### Manual Testing Checklist
- [ ] Event submission forms work
- [ ] Image uploads function correctly
- [ ] Admin authentication flows
- [ ] Responsive design on mobile/tablet
- [ ] Accessibility with screen readers
- [ ] PWA installation and offline features

#### Function Testing
```bash
# Test individual functions locally
netlify functions:invoke get-events --no-identity

# Test with sample data
netlify functions:invoke event-submission --payload='{"eventName":"Test"}'
```

### Deployment

#### Automatic Deployment
- Push to `main` branch triggers automatic deployment
- Netlify builds and deploys automatically
- Functions are deployed with the site

#### Manual Deployment
```bash
# Build and deploy
netlify build
netlify deploy --prod

# Deploy only functions
netlify deploy --functions
```

---

## API Integration

### Frontend to Backend Communication

#### Standard API Call Pattern
```javascript
class BrumOutLoudAPI {
  constructor() {
    this.baseURL = '/.netlify/functions';
    this.authToken = null;
  }

  async get(endpoint, params = {}) {
    const url = new URL(`${this.baseURL}/${endpoint}`, window.location.origin);
    Object.keys(params).forEach(key => 
      url.searchParams.append(key, params[key])
    );

    const response = await fetch(url.toString(), {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }

  async post(endpoint, data) {
    const response = await fetch(`${this.baseURL}/${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: data instanceof FormData ? data : JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }

  setAuthToken(token) {
    this.authToken = token;
  }

  getHeaders() {
    const headers = {};
    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }
    if (arguments[0] && !(arguments[0] instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    return headers;
  }
}

// Usage
const api = new BrumOutLoudAPI();
const events = await api.get('get-events');
```

#### Error Handling
```javascript
async function handleAPICall(apiFunction) {
  try {
    const result = await apiFunction();
    return { success: true, data: result };
  } catch (error) {
    console.error('API Error:', error);
    
    // Show user-friendly error message
    const userMessage = error.message.includes('401') 
      ? 'Please log in to continue'
      : 'Something went wrong. Please try again.';
    
    showNotification(userMessage, 'error');
    
    return { success: false, error: error.message };
  }
}
```

### Authentication Integration

#### Firebase Setup
```javascript
// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAg8EIRoDGo3uPP0oCXAtDL7xNreJQeY7k",
  authDomain: "brumoutloud-3dd92.firebaseapp.com",
  projectId: "brumoutloud-3dd92",
  storageBucket: "brumoutloud-3dd92.appspot.com",
  messagingSenderId: "803476014859",
  appId: "1:803476014859:web:660ab2967e64955b0d440e"
};

// Initialize Firebase
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
```

#### Authentication Flow
```javascript
// Login function
async function login(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const token = await userCredential.user.getIdToken();
    
    // Store token for API calls
    api.setAuthToken(token);
    localStorage.setItem('authToken', token);
    
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Check authentication state
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const token = await user.getIdToken();
    api.setAuthToken(token);
  } else {
    api.setAuthToken(null);
    localStorage.removeItem('authToken');
  }
});
```

---

## Database Schema (Airtable)

### Events Table
| Field Name | Type | Description |
|------------|------|-------------|
| Event Name | Single line text | Event title |
| Description | Long text | Event description |
| Date | Date | Event date |
| Start Time | Single line text | Event start time |
| End Time | Single line text | Event end time |
| Venue | Link to Venues | Linked venue record |
| Venue Name | Lookup | Auto-populated from venue |
| VenueText | Single line text | Venue address text |
| Category | Multiple select | Event categories |
| Promo Image | Attachment | Event promotional image |
| Slug | Single line text | URL-friendly identifier |
| Status | Single select | Approval status |
| Recurring Info | Single line text | Human-readable recurrence |
| Recurring JSON | Long text | Structured recurrence data |
| Series ID | Single line text | Parent event for recurring series |
| Submitter Name | Single line text | Person who submitted |
| Submitter Email | Email | Submitter contact |

### Venues Table
| Field Name | Type | Description |
|------------|------|-------------|
| Venue Name | Single line text | Venue name |
| Description | Long text | Venue description |
| Address | Single line text | Full address |
| Venue Type | Multiple select | Venue categories |
| Accessibility Features | Multiple select | Accessibility options |
| Image | Attachment | Venue photo |
| Slug | Single line text | URL-friendly identifier |
| Status | Single select | Approval status |
| Submitter Name | Single line text | Person who submitted |
| Submitter Email | Email | Submitter contact |

---

## Best Practices

### Code Style

#### JavaScript
```javascript
// Use modern ES6+ syntax
const getData = async () => {
  try {
    const response = await fetch('/api/data');
    return await response.json();
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
};

// Use descriptive variable names
const upcomingEvents = events.filter(event => 
  new Date(event.date) > new Date()
);

// Handle async operations properly
const [events, venues] = await Promise.all([
  api.get('get-events'),
  api.get('get-venues')
]);
```

#### CSS/Tailwind
```html
<!-- Use semantic class names -->
<div class="event-card bg-white rounded-lg shadow-md p-6">
  <h3 class="event-title text-xl font-bold text-gray-900">Event Name</h3>
  <p class="event-date text-sm text-gray-600">July 15, 2024</p>
</div>

<!-- Responsive design -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <!-- Event cards -->
</div>
```

#### HTML
```html
<!-- Use semantic HTML -->
<main role="main">
  <section aria-labelledby="upcoming-events">
    <h2 id="upcoming-events">Upcoming Events</h2>
    <article class="event-card">
      <header>
        <h3>Event Title</h3>
      </header>
      <p>Event description...</p>
      <footer>
        <time datetime="2024-07-15">July 15, 2024</time>
      </footer>
    </article>
  </section>
</main>
```

### Security Guidelines

#### Input Validation
```javascript
// Validate all user inputs
function validateEventData(data) {
  const errors = [];
  
  if (!data.eventName || data.eventName.trim().length < 3) {
    errors.push('Event name must be at least 3 characters');
  }
  
  if (!data.date || !isValidDate(data.date)) {
    errors.push('Valid date is required');
  }
  
  if (data.eventName.length > 200) {
    errors.push('Event name too long');
  }
  
  return errors;
}

// Sanitize inputs
function sanitizeInput(input) {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .substring(0, 1000); // Limit length
}
```

#### Authentication
```javascript
// Always verify authentication for admin functions
async function requireAuth(event) {
  const authHeader = event.headers.authorization;
  if (!authHeader) {
    throw new Error('Authentication required');
  }
  
  const token = authHeader.replace('Bearer ', '');
  const decodedToken = await admin.auth().verifyIdToken(token);
  return decodedToken;
}
```

### Performance Optimization

#### Image Optimization
```javascript
// Use Cloudinary transformations
function getOptimizedImageUrl(publicId, width = 800, height = 600) {
  return `https://res.cloudinary.com/${cloudinaryCloudName}/image/upload/f_auto,q_auto,w_${width},h_${height},c_limit/${publicId}`;
}

// Implement lazy loading
const imageObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const img = entry.target;
      img.src = img.dataset.src;
      img.classList.remove('lazy');
      imageObserver.unobserve(img);
    }
  });
});
```

#### API Optimization
```javascript
// Cache frequently accessed data
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedData(key, fetchFunction) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const data = await fetchFunction();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}

// Use parallel requests where possible
const [events, venues, categories] = await Promise.all([
  api.get('get-events'),
  api.get('get-venues'),
  api.get('get-categories')
]);
```

---

## Debugging & Troubleshooting

### Common Issues

#### 1. Function Deployment Errors
```bash
# Check function logs
netlify functions:log

# Test function locally
netlify functions:invoke function-name

# Check environment variables
netlify env:list
```

#### 2. Authentication Issues
```javascript
// Debug Firebase auth
onAuthStateChanged(auth, (user) => {
  console.log('Auth state changed:', user ? 'logged in' : 'logged out');
  if (user) {
    user.getIdToken().then(token => {
      console.log('Token length:', token.length);
    });
  }
});
```

#### 3. API Connection Issues
```javascript
// Test API connectivity
async function testAPI() {
  try {
    const response = await fetch('/.netlify/functions/get-events');
    console.log('API Status:', response.status);
    const data = await response.json();
    console.log('API Data:', data);
  } catch (error) {
    console.error('API Error:', error);
  }
}
```

#### 4. CSS Build Issues
```bash
# Check Tailwind configuration
npx tailwindcss build --dry-run

# Rebuild CSS with verbose output
npx tailwindcss build -i css/main.css -o css/tailwind.css --verbose
```

### Debugging Tools

#### Browser DevTools
```javascript
// Add debugging helpers
window.debugAPI = api;
window.debugEvents = events;

// Log API calls
api.get = new Proxy(api.get, {
  apply(target, thisArg, args) {
    console.log('API GET:', args[0], args[1]);
    return target.apply(thisArg, args);
  }
});
```

#### Function Debugging
```javascript
// Add debug logging to functions
console.log('Function input:', JSON.stringify(event, null, 2));
console.log('Environment vars loaded:', {
  airtable: !!process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
  cloudinary: !!process.env.CLOUDINARY_API_KEY,
  gemini: !!process.env.GEMINI_API_KEY
});
```

---

## Contributing

### Pull Request Process

1. **Create feature branch:**
```bash
git checkout -b feature/new-feature-name
```

2. **Make changes and test:**
```bash
# Test locally
npm run build:css
netlify dev

# Run any tests
npm test
```

3. **Commit with clear messages:**
```bash
git commit -m "feat: add event filtering by category

- Add category filter dropdown to events page
- Update API to handle category filtering
- Add tests for filter functionality"
```

4. **Create pull request:**
- Clear description of changes
- Screenshots for UI changes
- Link to any related issues

### Code Review Guidelines

#### What to Look For
- [ ] Code follows project conventions
- [ ] Functions have proper error handling
- [ ] Security best practices followed
- [ ] Performance considerations addressed
- [ ] Accessibility requirements met
- [ ] Mobile responsiveness maintained

#### Testing Requirements
- [ ] Manual testing completed
- [ ] All forms function correctly
- [ ] API endpoints work as expected
- [ ] No console errors
- [ ] Responsive design verified

---

## Deployment Checklist

### Pre-Deployment
- [ ] All tests pass
- [ ] CSS builds without errors
- [ ] Environment variables configured
- [ ] Database schema updated if needed
- [ ] Performance checks completed

### Post-Deployment
- [ ] Verify site loads correctly
- [ ] Test critical user flows
- [ ] Check function logs for errors
- [ ] Monitor site performance
- [ ] Update documentation if needed

---

## Resources

### Documentation Links
- [Netlify Functions Documentation](https://docs.netlify.com/functions/overview/)
- [Airtable API Documentation](https://airtable.com/developers/web/api/introduction)
- [Firebase Auth Documentation](https://firebase.google.com/docs/auth)
- [Cloudinary Documentation](https://cloudinary.com/documentation)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

### Tools & Extensions
- **VS Code Extensions:**
  - Tailwind CSS IntelliSense
  - ES6+ snippets
  - Prettier code formatter
- **Browser Extensions:**
  - React Developer Tools (for debugging)
  - Web Developer toolbar
  - Accessibility insights

### Community & Support
- Project maintainers: [Contact information]
- Issue tracking: GitHub Issues
- Development discussions: [Communication channels]

---

## Changelog

### Version 1.0.0 (Current)
- Initial platform launch
- Event and venue submission system
- Admin approval workflow
- Recurring events support
- AI-powered content processing
- Progressive Web App features

### Upcoming Features
- Enhanced search and filtering
- User accounts and favorites
- Real-time notifications
- Mobile app development
- Advanced analytics dashboard

---

*Last updated: [Current Date]*
*Developer Guide Version: 1.0*