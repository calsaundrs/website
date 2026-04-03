# BrumOutLoud - Birmingham's LGBTQ+ Events Platform

> The definitive, bold, and unapologetic guide to Birmingham's LGBTQ+ scene

BrumOutLoud is a comprehensive, open-source events platform designed to be the go-to resource for LGBTQ+ events, venues, and community activities in Birmingham, UK. The platform utilizes a completely serverless backend, employing modern web technologies for maximum performance, excellent user experience, and accessibility.

## 🌟 Platform Features

### For Event-Goers
- **Comprehensive Event Listings:** View up-to-date and recurring LGBTQ+ events across Birmingham.
- **Venue Directory:** Explore LGBTQ+-friendly venues, along with mapped locations and info.
- **Community Focus:** Specialized listings for the Birmingham Pride page and individual Club series.
- **Fast Performance:** Using a Static Site Generation (SSG) strategy for main landing pages, providing instant load times.
- **Mobile-First & PWA:** Optimized for all devices, functioning as a Progressive Web App (PWA) with offline capabilities.
- **Calendar & Social Integration:** Add events to Apple/Google calendars or share on social networks.

### For Event Organizers
- **Intelligent Submission:** Drop an event poster, and our Gemini AI integration automatically extracts data to fill in the submission form.
- **Recurring Events System:** Complete support for weekly, monthly, and custom recurring events.
- **Media Optimization:** Cloudinary integration automatically transforms, scales, and compresses poster uploads.
- **Rich Media Export:** Automated social media Reels and Stories generation using Remotion for Instagram/TikTok cross-promotion.

### For Administrators
- **Moderation Workflow:** A fully secured admin dashboard (Firebase Auth) to manage, approve, or reject submissions.
- **Batch Processing & SEO Tools:** Admin tools to rebuild the Static Site Generation, optimize sitemaps, and automatically generate essential SEO structured data.

---

## 🏗️ Architecture & Technology Stack

The project heavily relies on the JAMstack approach, ensuring decoupled front-end rendering from back-end logic.

### Frontend
- **HTML5 & Vanilla JS:** Clean semantic HTML with ES6+ JavaScript.
- **Tailwind CSS:** Utility-first CSS framework for rapid and robust styling.
- **Static Site Generation (SSG):** Custom Node.js scripts handle fetching data from Firestore and pre-rendering `events.html` and `venues.html` prior to deployment.

### Backend (Serverless)
- **Netlify Functions:** Over 35 Node.js serverless functions acting as the core API for dynamic requests, admin actions, and scheduled cron jobs.
- **Firebase (Firestore):** The primary NoSQL database containing Events, Venues, and Pending submissions.
- **Firebase Authentication:** Handles authentication and security rules for admin dashboard access.

### Third-Party Integrations
- **Cloudinary:** Stores and serves optimized event poster and venue images.
- **Google Gemini API:** AI-powered analysis extracting event details directly from uploaded posters.
- **Resend API:** Transactional email handling to notify promoters and admins of submission statuses.
- **Remotion:** Generates automated video reels and stories using data from the database.

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js** v20+
- **npm** v9+
- Accounts configured for: Firebase, Cloudinary, Resend, and Google Gemini.

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd brumoutloud-site
   npm install
   ```

2. **Set up Environment Variables:**
   Copy the `.env.example` to `.env` or set the following variables locally (these must be added to your Netlify Environment dashboard for production):
   ```bash
   FIREBASE_PROJECT_ID="your_project_id"
   FIREBASE_CLIENT_EMAIL="your_client_email"
   FIREBASE_PRIVATE_KEY="your_private_key"
   CLOUDINARY_CLOUD_NAME="your_cloud_name"
   CLOUDINARY_API_KEY="your_api_key"
   CLOUDINARY_API_SECRET="your_secret"
   GEMINI_API_KEY="your_gemini_key"
   RESEND_API_KEY="your_resend_key"
   ADMIN_EMAIL="admin@brumoutloud.co.uk"
   ```

3. **Build the assets:**
   ```bash
   npm run build:css
   ```

4. **Run a local development server:**
   You can either run the Netlify CLI or a simple server like `npx serve`:
   ```bash
   # Using Netlify CLI (Recommended to test serverless functions)
   netlify dev

   # Or using a simple static server
   npx serve -l 8888
   ```

### Important Scripts (`package.json`)
- `npm run build:css` - Compiles Tailwind CSS.
- `npm run build` - Full site build combining CSS compilation, SSG events/venues building, and sitemap generation.
- `npm run optimize:all` - Optimizes CSS assets (minify + critical CSS extraction).
- `npm test` - Runs Playwright smoke tests.
- `npm run render:reel` - Generates the weekly social reel via Remotion.

---

## 📂 Project Structure

```
brumoutloud-site/
├── css/                  # Tailwind configuration and output stylesheets
├── global/               # Shared global UI components (header, footer)
├── js/                   # Main frontend JavaScript logic
├── netlify/
│   └── functions/        # Serverless API endpoints & cron jobs (Node.js)
├── remotion-templates/   # Remotion video generation templates
├── tests/                # Playwright E2E and smoke tests
├── *.html                # Pre-rendered HTML templates and static pages
├── package.json          # Dependencies and scripts
└── netlify.toml          # Netlify build configurations and redirects
```

---

## 📖 Core Documentation

To dig deeper into specific parts of the project architecture, consult the specific documentation files available in the root:

- **[Frontend Documentation](FRONTEND_DOCUMENTATION.md)** - Explains the Vanilla JS, PWA implementation, styling, and UI architecture.
- **[Functions Documentation](FUNCTIONS_DOCUMENTATION.md)** - Details all Netlify serverless functions, endpoints, and scheduled cron jobs.
- **[API Documentation](API_DOCUMENTATION.md)** - RESTful interaction schemas.
- **[Email System Documentation](EMAIL_SYSTEM_DOCUMENTATION.md)** - Explains the transactional email flow (Resend API).
- **[SSG & FOUC Guide](SSG_AND_FOUC_GUIDE.md)** - Details the Static Site Generation implementation and Flash of Unstyled Content prevention.
- **[SEO & Performance Guide](SEO_PERFORMANCE_GUIDE.md)** - Explains JSON-LD structured data and optimization efforts.

---

## 🧪 Testing

We use [Playwright](https://playwright.dev/) for end-to-end smoke testing.
To execute tests and verify functionality (ensure the local server is running or `baseURL` is correctly mapped):

```bash
npm run test
# OR
npm run test:smoke
```

---

## 🤝 Contributing

We welcome community engagement! If you want to contribute:
1. Ensure your code strictly follows standard conventions outlined in the codebase.
2. Read the `AGENTS.md` guidelines for automated tools running on this repository.
3. Test locally using `npm test`.
4. Ensure the `.env` variables do not get committed.
5. Create a descriptive Pull Request highlighting your changes.

---

## 🏳️‍🌈 Community Impact

BrumOutLoud actively shapes the ecosystem of LGBTQ+ life in Birmingham by providing an accessible, fast, and centralized repository for our communities' events. We lower the barrier to entry for smaller promoters using AI and automated toolings, aiming to keep our safe spaces visible and thriving.

**Built with ❤️ for Birmingham's LGBTQ+ community**