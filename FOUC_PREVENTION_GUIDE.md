# FOUC Prevention Implementation Guide

## Overview

This guide explains the Flash of Unstyled Content (FOUC) prevention system implemented for the Brum Outloud website. FOUC occurs when HTML content is displayed before CSS styles are fully loaded, causing a brief flash of unstyled content.

## What Was Implemented

### 1. Loading Screen
- **Purpose**: Provides visual feedback while resources load
- **Features**: 
  - Animated logo with pulse effect
  - Loading spinner
  - Branded gradient background
  - Smooth fade-out transition

### 2. Critical CSS Inline
- **Purpose**: Prevents layout shifts and provides basic styling immediately
- **Includes**:
  - Body background and typography
  - Basic layout containers
  - Pride flag image sizing
  - Loading screen styles

### 3. Resource Loading Optimization
- **Font Loading**: Uses `font-display: swap` and preloading
- **CSS Loading**: Preloads critical CSS files
- **Script Loading**: Defers non-critical scripts
- **External Resources**: Optimized loading with fallbacks

### 4. JavaScript FOUC Prevention
- **Class**: `FOUCPrevention` in `/js/fouc-prevention.js`
- **Features**:
  - Monitors CSS, font, and script loading
  - Fallback timeout (2 seconds)
  - Custom event system
  - Graceful degradation

## Files Modified/Created

### New Files
- `/js/fouc-prevention.js` - Main FOUC prevention utility
- `fouc-template.html` - Template for implementing on other pages
- `FOUC_PREVENTION_GUIDE.md` - This documentation

### Modified Files
- `/index.html` - Added loading screen and FOUC prevention
- `/js/main.js` - Refactored to work with FOUC prevention system

## How It Works

### 1. Initial Load
```html
<body class="antialiased fouc-prevention">
    <div class="loading-screen" id="loadingScreen">
        <!-- Loading content -->
    </div>
    <!-- Page content -->
</body>
```

### 2. CSS Classes
- `.fouc-prevention` - Hides content initially
- `.fouc-prevention.loaded` - Shows content when ready
- `.loading-screen` - Loading screen container
- `.loading-screen.hidden` - Hides loading screen

### 3. JavaScript Flow
1. `FOUCPrevention` class initializes
2. Monitors resource loading (CSS, fonts, scripts)
3. Shows content when ready or after timeout
4. Triggers `foucContentLoaded` event
5. Main app initializes after content is shown

## Implementation on Other Pages

### Option 1: Use the Template
Copy `fouc-template.html` and modify for your page:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <!-- Copy the critical CSS and resource loading from fouc-template.html -->
</head>
<body class="antialiased fouc-prevention">
    <!-- Loading Screen -->
    <div class="loading-screen" id="loadingScreen">
        <img src="/progressflag.svg.png" alt="Brum Outloud" class="loading-logo">
        <div class="loading-text">Loading Brum Outloud...</div>
        <div class="loading-spinner"></div>
    </div>
    
    <!-- Your page content -->
</body>
</html>
```

### Option 2: Add to Existing Pages
Add these elements to existing pages:

1. **Add to `<head>`**:
```html
<style>
    /* Copy critical CSS from fouc-template.html */
</style>
<script src="/js/fouc-prevention.js"></script>
```

2. **Add to `<body>`**:
```html
<body class="antialiased fouc-prevention">
    <div class="loading-screen" id="loadingScreen">
        <img src="/progressflag.svg.png" alt="Brum Outloud" class="loading-logo">
        <div class="loading-text">Loading Brum Outloud...</div>
        <div class="loading-spinner"></div>
    </div>
    <!-- Existing content -->
</body>
```

## Customization

### Loading Screen
Modify the loading screen appearance in the critical CSS:

```css
.loading-screen {
    background: linear-gradient(135deg, #121212 0%, #1a1a1a 50%, #2d1b69 100%);
    /* Customize colors, animations, etc. */
}

.loading-logo {
    width: 80px;
    height: 80px;
    /* Customize size, animation */
}
```

### Timeout Duration
Change the fallback timeout in `/js/fouc-prevention.js`:

```javascript
this.loadTimeout = setTimeout(() => {
    this.showContent();
}, 2000); // Change this value (in milliseconds)
```

### Resource Monitoring
Add custom resource checks in the `checkResourcesLoaded()` method:

```javascript
checkResourcesLoaded() {
    const checks = [];
    
    // Add your custom checks here
    checks.push(this.checkCustomResource());
    
    return Promise.all(checks);
}
```

## Performance Benefits

### Before FOUC Prevention
- Content flashes unstyled
- Layout shifts as styles load
- Poor user experience
- Potential CLS (Cumulative Layout Shift) issues

### After FOUC Prevention
- Smooth loading experience
- No layout shifts
- Professional appearance
- Better Core Web Vitals scores

## Browser Support

- **Modern Browsers**: Full support
- **Older Browsers**: Graceful degradation
- **JavaScript Disabled**: Loading screen remains (use `<noscript>` fallbacks)

## Testing

### Manual Testing
1. Open browser dev tools
2. Go to Network tab
3. Set throttling to "Slow 3G"
4. Reload page
5. Verify loading screen appears and content loads smoothly

### Automated Testing
```javascript
// Test FOUC prevention
document.addEventListener('foucContentLoaded', () => {
    console.log('FOUC prevention completed');
    // Add your tests here
});
```

## Troubleshooting

### Loading Screen Stays Visible
- Check if `fouc-prevention.js` is loaded
- Verify `loadingScreen` element exists
- Check browser console for errors

### Content Doesn't Show
- Verify `.fouc-prevention.loaded` class is added
- Check if CSS is loading properly
- Ensure no JavaScript errors

### Performance Issues
- Reduce timeout duration
- Optimize critical CSS
- Remove unnecessary resource checks

## Best Practices

1. **Keep Critical CSS Minimal**: Only include essential styles
2. **Optimize Resource Loading**: Use preload, defer, and async appropriately
3. **Test on Slow Connections**: Ensure good experience on all connection speeds
4. **Monitor Performance**: Use tools like Lighthouse to measure improvements
5. **Graceful Degradation**: Ensure site works without JavaScript

## Future Enhancements

- **Progressive Enhancement**: Load content progressively
- **Service Worker Integration**: Cache critical resources
- **Analytics Integration**: Track loading performance
- **A/B Testing**: Compare with/without FOUC prevention

## Support

For questions or issues with the FOUC prevention system:
1. Check this documentation
2. Review browser console for errors
3. Test with different connection speeds
4. Verify all required files are present