# Build-Time SSG Solution for Event Pages

## Overview

This document explains the complete build-time Static Site Generation (SSG) solution implemented for event pages on the Brum Outloud website.

## Problem Solved

The original issue was that **Netlify functions cannot write files to the site directory during runtime**. When the `build-events-ssg` function was called, it would generate HTML files in a temporary directory that would be discarded after the function execution.

## Solution Architecture

### 1. Build-Time SSG
- **Build Script**: `build-events-ssg.js` generates static event pages during the Netlify build process
- **Build Command**: `npm run build` includes `npm run build:events` which runs the SSG script
- **Output**: Static HTML files are written to the `event/` directory and deployed with the site

### 2. Static File Serving
- **Primary Route**: `/event/*` requests are served from static files (`/event/:splat.html`)
- **Fallback**: If a static file doesn't exist, the dynamic 404 handler serves the event page

### 3. Dynamic 404 Handler
- **Function**: `netlify/functions/404-handler.js`
- **Purpose**: Serves event pages dynamically when static files don't exist
- **Features**: 
  - Fetches event data from Firestore
  - Generates HTML on-the-fly
  - Includes proper SEO meta tags
  - Responsive design with Tailwind CSS

### 4. Automatic Build Triggers
- **Event Approval**: When an event is approved via admin panel, triggers a new build
- **Auto-Approval**: When events are auto-approved on submission, triggers a new build
- **Build Hook**: Uses Netlify's build hook system to trigger deployments

## File Structure

```
├── build-events-ssg.js          # Main build script
├── event-template.html          # Template for event pages
├── event/                       # Generated static event pages
├── netlify/
│   └── functions/
│       ├── 404-handler.js       # Dynamic event page handler
│       └── trigger-event-rebuild.js  # Build hook trigger
└── netlify.toml                 # Redirect configuration
```

## Configuration

### Netlify.toml Redirects

```toml
# Serve static event pages first
[[redirects]]
  from = "/event/*"
  to = "/event/:splat.html"
  status = 200

# Dynamic 404 handler for missing pages
[[redirects]]
  from = "/*"
  to = "/.netlify/functions/404-handler"
  status = 404
```

### Environment Variables Required

```bash
# Firebase (for data access)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_PRIVATE_KEY=your-private-key

# Cloudinary (for image processing)
CLOUDINARY_CLOUD_NAME=your-cloud-name

# Netlify Build Hook (for automatic rebuilds)
NETLIFY_BUILD_HOOK_URL=https://api.netlify.com/build_hooks/your-hook-id

# Auto-approval (optional)
AUTO_APPROVE_EVENTS=true
```

## How It Works

### 1. Build Process
1. Netlify runs `npm run build`
2. This executes `npm run build:events`
3. `build-events-ssg.js` runs and:
   - Connects to Firebase
   - Fetches all approved events
   - Generates static HTML files for each event
   - Saves files to `event/` directory
   - Creates fallback 404 page

### 2. Page Serving
1. User visits `/event/some-event-slug`
2. Netlify first tries to serve `/event/some-event-slug.html`
3. If the static file exists, it's served immediately
4. If the static file doesn't exist, the 404 handler:
   - Extracts the slug from the URL
   - Fetches event data from Firestore
   - Generates HTML dynamically
   - Returns the page with 200 status

### 3. Automatic Updates
1. Admin approves an event via the admin panel
2. `update-item-status-firestore-only.js` updates the event status
3. If the event is approved, it triggers a build hook
4. Netlify starts a new deployment
5. The build process regenerates all event pages
6. New static files are deployed

## Benefits

### Performance
- **Fast Loading**: Static files serve instantly
- **CDN Caching**: Files can be cached at the edge
- **SEO Friendly**: Search engines can crawl static pages easily

### Reliability
- **Fallback System**: Dynamic pages work when static files don't exist
- **No Runtime Dependencies**: Static files don't depend on function execution
- **Graceful Degradation**: Site works even if build process fails

### Automation
- **Zero Manual Work**: Pages are generated automatically
- **Real-time Updates**: New events get pages within minutes
- **Consistent Process**: All events follow the same generation process

## Monitoring and Debugging

### Build Logs
- Check Netlify build logs for SSG process
- Look for "Event SSG Build Complete" message
- Verify number of generated pages

### Function Logs
- Check 404 handler logs for dynamic page serving
- Monitor build hook trigger logs
- Verify Firebase connection status

### Common Issues
1. **Missing Firebase Credentials**: Build will skip SSG but site continues to work
2. **Build Hook Not Configured**: Manual rebuilds required
3. **Template Errors**: Check `event-template.html` syntax
4. **Redirect Conflicts**: Ensure `netlify.toml` rules are correct

## Future Enhancements

### Potential Improvements
1. **Incremental Builds**: Only rebuild changed events
2. **Background Processing**: Use Netlify background functions
3. **Caching Strategy**: Implement more sophisticated caching
4. **Performance Monitoring**: Add metrics for page generation times

### Scalability Considerations
1. **Event Volume**: Monitor build times as event count grows
2. **Template Complexity**: Keep templates lightweight for faster generation
3. **Build Frequency**: Balance between freshness and build costs

## Conclusion

This build-time SSG solution provides a robust, performant, and automated system for serving event pages. It combines the speed of static files with the flexibility of dynamic generation, ensuring that users always get fast-loading pages while maintaining the ability to serve fresh content when needed.

The solution is production-ready and handles edge cases gracefully, making it suitable for a live event website with frequent content updates. 