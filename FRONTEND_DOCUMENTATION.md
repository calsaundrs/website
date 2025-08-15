# BrumOutLoud Frontend Documentation

## Overview

This documentation covers all frontend components, pages, and JavaScript functionality for the BrumOutLoud LGBTQ+ events platform.

**Technology Stack:**
- **HTML5**: Semantic markup with accessibility features
- **CSS**: Tailwind CSS framework + custom styles
- **JavaScript**: Vanilla ES6+ with modular approach
- **Authentication**: Firebase Authentication
- **PWA**: Service Worker for offline capabilities

---

## Page Structure & Components

### Public Pages

#### 1. Homepage (`index.html`)
**Purpose:** Landing page showcasing upcoming events and platform features

**Key Features:**
- Welcome modal for first-time visitors
- Featured events carousel
- Quick navigation to events and venues
- Progressive Web App installation prompt

**JavaScript Dependencies:**
- `js/main.js` - Welcome modal and service worker registration

**Example Usage:**
```html
<!-- Welcome Modal Integration -->
<div id="welcomeModal" class="fixed inset-0 bg-black bg-opacity-50 hidden opacity-0 transition-opacity duration-300 z-50">
  <!-- Modal content -->
</div>
```

#### 2. Events Listing (`events.html`)
**Purpose:** Display all upcoming events with filtering and search

**Key Features:**
- Event filtering by category, date, venue
- Search functionality
- Responsive grid layout
- Infinite scroll loading
- SEO-optimized event links

**API Integration:**
```javascript
// Fetch events
fetch('/.netlify/functions/get-events')
  .then(response => response.json())
  .then(data => displayEvents(data.events));
```

#### 3. Event Details (`event-details-form.html`)
**Purpose:** Display detailed information for individual events

**Key Features:**
- Event information display
- Add to calendar functionality (Google Calendar, iCal)
- Social sharing buttons
- Related events suggestions
- Venue information integration

**Dynamic Content Loading:**
```javascript
// Load event by slug from URL
const urlParams = new URLSearchParams(window.location.search);
const eventSlug = urlParams.get('slug');
loadEventDetails(eventSlug);
```

#### 4. Venues Listing (`venues.html`)
**Purpose:** Display all venues with filtering capabilities

**Key Features:**
- Venue type filtering
- Location-based search
- Map integration potential
- Venue detail links

#### 5. All Venues (`all-venues.html`)
**Purpose:** Comprehensive venue directory

**Key Features:**
- Alphabetical sorting
- Category-based filtering
- Venue images and descriptions
- Contact information display

#### 6. Community Page (`community.html`)
**Purpose:** Community guidelines and information

**Key Features:**
- Community standards
- Submission guidelines
- Contact information
- Community resources

#### 7. Contact Page (`contact.html`)
**Purpose:** Contact forms and information

**Key Features:**
- Contact form with validation
- Social media links
- Business hours
- Location information

### Submission Pages

#### 8. Event Submission (`promoter-submit.html`)
**Purpose:** Public event submission form

**Key Features:**
- Multi-step form with validation
- Image upload with preview
- Recurring event configuration
- Venue selection/creation
- Real-time form validation

**Form Configuration:**
```javascript
// Recurring event setup
const recurrenceConfig = {
  type: 'weekly', // 'weekly' | 'monthly' | 'custom'
  days: [1, 3, 5], // Days of week (0 = Sunday)
  endDate: '2024-12-31'
};
```

#### 9. Get Listed Page (`get-listed.html`)
**Purpose:** Information about listing events and venues

**Key Features:**
- Submission guidelines
- Pricing information
- FAQ section
- Quick submission links

#### 10. Promoter Tool (`promoter-tool.html`)
**Purpose:** Advanced tools for event promoters

**Key Features:**
- Bulk event management
- Analytics dashboard
- Event performance metrics
- Promotional tools

### Legal & Info Pages

#### 11. Privacy Policy (`privacy-policy.html`)
#### 12. Terms and Conditions (`terms-and-conditions.html`)
#### 13. Terms of Submission (`terms-of-submission.html`)
#### 14. Design System (`design-system.html`)

---

## Admin Interface

### Authentication Guard

All admin pages use the authentication guard (`js/auth-guard.js`):

```javascript
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";

// Automatic redirect to login if not authenticated
onAuthStateChanged(auth, (user) => {
  if (!user && window.location.pathname !== '/admin-login.html') {
    window.location.href = '/admin/login';
  } else {
    document.body.style.display = 'block';
  }
});
```

### Admin Pages

#### 1. Admin Login (`admin-login.html`)
**Purpose:** Firebase authentication for admin access

**Key Features:**
- Email/password authentication
- "Remember me" functionality
- Password reset capability
- Secure session management

#### 2. Admin Approvals (`admin-approvals.html`)
**Purpose:** Review and approve pending events and venues

**Key Features:**
- Pending items queue
- Bulk approval actions
- Item preview and editing
- Approval workflow management

**API Usage:**
```javascript
// Get pending items
async function loadPendingItems() {
  const [events, venues] = await Promise.all([
    fetch('/.netlify/functions/get-pending-events').then(r => r.json()),
    fetch('/.netlify/functions/get-pending-venues').then(r => r.json())
  ]);
  
  displayPendingItems(events, venues);
}
```

#### 3. Admin Event Management (`admin-edit-events.html`)
**Purpose:** Create, edit, and manage events

**Key Features:**
- Event CRUD operations
- Bulk editing capabilities
- Event status management
- Recurring event handling
- Image management

**Key Functions:**
```javascript
// Event management
async function saveEvent(eventData) {
  const response = await fetch('/.netlify/functions/create-approved-event', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${authToken}` },
    body: new FormData(eventForm)
  });
  return response.json();
}
```

#### 4. Admin Venue Management (`admin-manage-venues.html`)
**Purpose:** Manage venue listings and information

**Key Features:**
- Venue CRUD operations
- Venue image management
- Location and contact info management
- Venue type categorization

#### 5. Admin Add Venue (`admin-add-venue.html`)
**Purpose:** Quick venue addition interface

#### 6. Admin Review (`admin-review.html`)
**Purpose:** Content review and moderation tools

#### 7. Admin Settings (`admin-settings.html`)
**Purpose:** Platform configuration and settings

#### 8. Admin Migrate (`admin-migrate.html`)
**Purpose:** Data migration and import tools

#### 9. Admin Poster Tool (`admin-poster-tool.html`)
**Purpose:** AI-powered poster analysis and event extraction

**Key Features:**
- Image upload and processing
- AI text extraction
- Event data parsing
- Bulk event creation from posters

---

## JavaScript Components

### Core JavaScript Files

#### 1. Main Application (`js/main.js`)

**Purpose:** Core application functionality and initialization

**Key Features:**
- Welcome modal management
- Service worker registration
- Global event handlers
- Progressive Web App functionality

**Functions:**
```javascript
// Welcome Modal Logic
const openModal = () => {
  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    body.classList.add('modal-open');
  }, 10);
};

const closeModal = () => {
  modal.classList.add('opacity-0');
  body.classList.remove('modal-open');
  setTimeout(() => {
    modal.classList.add('hidden');
  }, 300);
  localStorage.setItem('brumOutloudVisited', 'true');
};

// Service Worker Registration
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(registration => console.log('SW registered'))
    .catch(err => console.log('SW registration failed'));
}
```

#### 2. Authentication Guard (`js/auth-guard.js`)

**Purpose:** Firebase authentication management for admin pages

**Key Features:**
- Automatic authentication checking
- Redirect handling
- Session management
- Login state persistence

**Configuration:**
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyAg8EIRoDGo3uPP0oCXAtDL7xNreJQeY7k",
  authDomain: "brumoutloud-3dd92.firebaseapp.com",
  projectId: "brumoutloud-3dd92",
  // ... other config
};
```

### Common JavaScript Patterns

#### API Communication
```javascript
// Standard API call pattern
async function callAPI(endpoint, options = {}) {
  try {
    const response = await fetch(`/.netlify/functions/${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    if (!response.ok) {
      throw new Error(`API call failed: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}
```

#### Form Handling
```javascript
// Standard form submission
async function handleFormSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  
  // Add validation
  if (!validateForm(formData)) {
    showError('Please fill all required fields');
    return;
  }
  
  try {
    const result = await submitForm(formData);
    showSuccess('Submitted successfully!');
    resetForm();
  } catch (error) {
    showError('Submission failed. Please try again.');
  }
}
```

#### Image Upload Handling
```javascript
// Image upload with preview
function handleImageUpload(inputElement) {
  const file = inputElement.files[0];
  if (!file) return;
  
  // Validate file type and size
  if (!file.type.startsWith('image/')) {
    showError('Please select an image file');
    return;
  }
  
  if (file.size > 5 * 1024 * 1024) { // 5MB limit
    showError('Image must be less than 5MB');
    return;
  }
  
  // Show preview
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('imagePreview').src = e.target.result;
  };
  reader.readAsDataURL(file);
}
```

---

## CSS Framework & Styling

### Tailwind CSS Configuration

**Configuration File:** `tailwind.config.js`
```javascript
module.exports = {
  content: ["./**/*.html"],
  theme: {
    extend: {
      fontFamily: {
        'omnes': ['Omnes Pro', 'sans-serif']
      },
      colors: {
        'pride-purple': '#663399',
        'pride-blue': '#0066CC',
        // ... custom colors
      }
    }
  }
}
```

### Custom CSS

**Main Stylesheet:** `css/main.css`
- Custom components
- Utility classes
- Brand-specific styling
- Responsive design patterns

**Built Stylesheet:** `css/tailwind.css`
- Compiled Tailwind CSS
- Optimized for production
- Purged unused styles

### Design System Components

#### Buttons
```html
<!-- Primary Button -->
<button class="bg-pride-purple text-white px-6 py-3 rounded-lg hover:bg-opacity-90 transition-colors">
  Submit Event
</button>

<!-- Secondary Button -->
<button class="border border-pride-purple text-pride-purple px-6 py-3 rounded-lg hover:bg-pride-purple hover:text-white transition-colors">
  Learn More
</button>
```

#### Cards
```html
<!-- Event Card -->
<div class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
  <img src="event-image.jpg" alt="Event" class="w-full h-48 object-cover">
  <div class="p-6">
    <h3 class="text-xl font-bold mb-2">Event Title</h3>
    <p class="text-gray-600 mb-4">Event description...</p>
    <div class="flex justify-between items-center">
      <span class="text-sm text-gray-500">July 15, 2024</span>
      <a href="#" class="text-pride-purple hover:underline">Learn More</a>
    </div>
  </div>
</div>
```

#### Forms
```html
<!-- Form Input -->
<div class="mb-4">
  <label for="eventName" class="block text-sm font-medium text-gray-700 mb-2">
    Event Name *
  </label>
  <input 
    type="text" 
    id="eventName" 
    name="eventName" 
    required
    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pride-purple focus:border-transparent"
    placeholder="Enter event name"
  >
</div>
```

---

## Progressive Web App (PWA)

### Service Worker (`sw.js`)

**Features:**
- Offline page caching
- Static asset caching
- Background sync for form submissions
- Push notification support

```javascript
// Cache strategy
const CACHE_NAME = 'brumoutloud-v1';
const urlsToCache = [
  '/',
  '/css/tailwind.css',
  '/js/main.js',
  '/offline.html'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});
```

### Web App Manifest (`manifest.json`)

```json
{
  "name": "BrumOutLoud",
  "short_name": "BrumOutLoud",
  "description": "Birmingham's LGBTQ+ Events Platform",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#663399",
  "icons": [
    {
      "src": "faviconV2.png",
      "sizes": "192x192",
      "type": "image/png"
    }
  ]
}
```

---

## Responsive Design

### Breakpoints
- **Mobile:** < 640px
- **Tablet:** 640px - 1024px
- **Desktop:** > 1024px

### Mobile-First Approach
```css
/* Mobile styles by default */
.event-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

/* Tablet styles */
@media (min-width: 640px) {
  .event-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Desktop styles */
@media (min-width: 1024px) {
  .event-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

---

## Accessibility Features

### ARIA Labels and Roles
```html
<!-- Navigation -->
<nav role="navigation" aria-label="Main navigation">
  <ul>
    <li><a href="/" aria-current="page">Home</a></li>
    <li><a href="/events">Events</a></li>
  </ul>
</nav>

<!-- Form -->
<form role="form" aria-labelledby="form-title">
  <h2 id="form-title">Submit New Event</h2>
  <input type="text" aria-required="true" aria-describedby="name-help">
  <div id="name-help" class="sr-only">Enter the full name of your event</div>
</form>
```

### Keyboard Navigation
- Tab order management
- Focus indicators
- Skip links for screen readers
- Keyboard shortcuts for common actions

### Screen Reader Support
- Semantic HTML structure
- Alternative text for images
- Form labels and descriptions
- Status announcements for dynamic content

---

## Performance Optimization

### Image Optimization
```javascript
// Cloudinary integration for optimized images
function getOptimizedImageUrl(publicId, width, height) {
  return `https://res.cloudinary.com/brumoutloud/image/upload/f_auto,q_auto,w_${width},h_${height},c_limit/${publicId}`;
}
```

### Lazy Loading
```html
<!-- Native lazy loading -->
<img src="event.jpg" alt="Event" loading="lazy">

<!-- Intersection Observer for custom lazy loading -->
<script>
const imageObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const img = entry.target;
      img.src = img.dataset.src;
      imageObserver.unobserve(img);
    }
  });
});
</script>
```

### Code Splitting
- Separate JS bundles for admin vs public pages
- Dynamic imports for heavy components
- CSS code splitting by page type

---

## Browser Support

### Modern Browsers
- **Chrome:** 80+
- **Firefox:** 75+
- **Safari:** 13+
- **Edge:** 80+

### Polyfills
```html
<!-- For older browsers -->
<script src="https://polyfill.io/v3/polyfill.min.js?features=es6,fetch,IntersectionObserver"></script>
```

### Progressive Enhancement
- Base functionality works without JavaScript
- Enhanced features with JavaScript enabled
- Graceful degradation for unsupported features

---

## Development Workflow

### Build Process
```bash
# Install dependencies
npm install

# Build CSS
npm run build:css

# Development server (if using local server)
npx live-server

# Deploy to Netlify
git push origin main
```

### File Organization
```
/
├── css/
│   ├── main.css (custom styles)
│   └── tailwind.css (built styles)
├── js/
│   ├── main.js (core functionality)
│   └── auth-guard.js (authentication)
├── global/
│   ├── header.html
│   └── footer.html
├── netlify/
│   └── functions/ (serverless functions)
└── *.html (page files)
```

---

## Testing

### Manual Testing Checklist
- [ ] All forms submit correctly
- [ ] Image uploads work
- [ ] Authentication flows function
- [ ] Responsive design across devices
- [ ] Accessibility with screen readers
- [ ] Performance on slow networks

### Browser Testing
- Test on multiple browsers and devices
- Verify PWA installation
- Check offline functionality
- Validate form submissions

---

## SEO Optimization

### Meta Tags
```html
<!-- Dynamic meta tags for event pages -->
<title>Event Name | BrumOutLoud</title>
<meta name="description" content="Event description for SEO">
<meta property="og:title" content="Event Name">
<meta property="og:description" content="Event description">
<meta property="og:image" content="event-image.jpg">
<meta property="og:url" content="https://brumoutloud.co.uk/event/slug">
```

### Structured Data
```html
<!-- Event schema markup -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "Event Name",
  "startDate": "2024-07-15T20:00",
  "location": {
    "@type": "Place",
    "name": "Venue Name",
    "address": "Venue Address"
  }
}
</script>
```

---

## Deployment

### Netlify Configuration
**File:** `netlify.toml`
```toml
[build]
  command = "npm run build:css"
  publish = "."

[[redirects]]
  from = "/admin/*"
  to = "/admin/:splat"
  status = 200

[build.environment]
  NODE_VERSION = "18"
```

### Environment Variables
Required environment variables:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `GEMINI_API_KEY`

---

## Security Considerations

### Content Security Policy
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://www.gstatic.com;
  img-src 'self' https://res.cloudinary.com data:;
  connect-src 'self' https://firestore.googleapis.com;
">
```

### Form Validation
- Client-side validation for UX
- Server-side validation for security
- CSRF protection on forms
- Input sanitization

---

## Troubleshooting

### Common Issues

1. **Authentication Issues**
   - Check Firebase configuration
   - Verify user permissions
   - Clear browser cache

2. **Form Submission Failures**
   - Check network connectivity
   - Verify API endpoints
   - Check browser console for errors

3. **Image Upload Problems**
   - Verify file size limits
   - Check supported formats
   - Ensure Cloudinary configuration

4. **Performance Issues**
   - Optimize images
   - Minimize CSS/JS
   - Use CDN for static assets

---

## Future Enhancements

### Planned Features
- Real-time notifications
- Advanced search with filters
- User accounts for event favorites
- Social sharing improvements
- Enhanced accessibility features
- Mobile app development

### Technical Improvements
- TypeScript migration
- Component-based architecture
- Enhanced testing coverage
- Performance monitoring
- Error tracking integration

---

*Last updated: [Current Date]*
*Frontend Version: 1.0*