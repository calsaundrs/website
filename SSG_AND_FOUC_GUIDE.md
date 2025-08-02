# Static Site Generation (SSG) & FOUC Prevention Guide

## Overview

This comprehensive guide covers the Static Site Generation (SSG) system and Flash of Unstyled Content (FOUC) prevention implementation for the BrumOutLoud website.

**Last Updated:** December 2024  
**Status:** Production Ready ✅

---

## 📖 Table of Contents

1. [Static Site Generation](#static-site-generation)
2. [FOUC Prevention](#fouc-prevention)
3. [Build Process](#build-process)
4. [Implementation Guide](#implementation-guide)
5. [Troubleshooting](#troubleshooting)
6. [Maintenance](#maintenance)

---

## 🏗️ Static Site Generation

### What is SSG?

Static Site Generation automatically creates individual HTML pages for each event and venue, improving:
- **SEO**: Each page has unique URLs and meta tags
- **Performance**: Pre-built pages load faster
- **Social Sharing**: Rich Open Graph and Twitter Card data

### Current Implementation

#### Event Pages
- **Source**: `build-events-ssg.js`
- **Template**: `event-template.html`
- **Output**: `event/[slug].html`
- **Data Source**: Firestore `events` collection

#### Venue Pages
- **Source**: `build-venues-ssg.js`
- **Template**: Built-in template in the script
- **Output**: `venue/[slug].html`
- **Data Source**: Firestore `venues` collection

### Build Commands

```bash
# Build event pages
node build-events-ssg.js

# Build venue pages
node build-venues-ssg.js

# Build everything with FOUC prevention
node build-with-fouc.js

# Optimize build process
chmod +x build-optimize.sh && ./build-optimize.sh
```

---

## 🎨 FOUC Prevention

### What is FOUC?

Flash of Unstyled Content (FOUC) occurs when HTML content displays before CSS styles load, creating a poor user experience with layout shifts and unstyled content.

### Implementation Status

- **Total HTML Files**: 134
- **Files with FOUC Prevention**: 134 (100% ✅)
- **Coverage**: All pages including SSG-generated content

### FOUC Prevention Components

#### 1. Loading Screen
Professional loading experience with:
- Animated Brum Outloud logo with pulse effect
- Loading spinner
- Branded gradient background
- Smooth fade-out transition

#### 2. Critical CSS
Inline essential styles for immediate loading:
- Body background and typography
- Basic layout containers
- Pride flag image sizing
- Loading screen styles

#### 3. Resource Loading Optimization
- Font loading with `font-display: swap`
- CSS preloading with `<link rel="preload">`
- Script deferring for non-critical resources
- External resource optimization

#### 4. JavaScript FOUC Prevention
- `FOUCPrevention` class monitors resource loading
- Fallback timeout (2 seconds)
- Custom event system
- Graceful degradation

### Implementation Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <!-- Critical CSS inline -->
    <style>
        /* FOUC Prevention - Hide content until styles are loaded */
        .fouc-prevention { opacity: 0; transition: opacity 0.3s ease-in-out; }
        .fouc-prevention.loaded { opacity: 1; }
        
        /* Loading screen styles */
        .loading-screen {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        }
        
        .loading-logo {
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
    </style>
    
    <!-- Preload critical resources -->
    <link rel="preload" href="/css/tailwind.css" as="style">
    <link rel="preload" href="/js/fouc-prevention.js" as="script">
</head>
<body class="antialiased fouc-prevention">
    <!-- Loading Screen -->
    <div class="loading-screen" id="loadingScreen">
        <div class="loading-logo">
            <h1>Brum Outloud</h1>
            <div class="loading-spinner"></div>
        </div>
    </div>
    
    <!-- Page Content -->
    <main>
        <!-- Your content here -->
    </main>
    
    <!-- FOUC Prevention Script -->
    <script src="/js/fouc-prevention.js"></script>
</body>
</html>
```

---

## 🔧 Build Process

### Integrated Build Script

Use `build-with-fouc.js` for complete builds:

```bash
# Full build with FOUC prevention
node build-with-fouc.js

# Verify existing files
node build-with-fouc.js --verify

# Update templates only
node build-with-fouc.js --templates
```

### Build Script Features

1. **Runs SSG builds** for events and venues
2. **Applies FOUC prevention** to all generated files
3. **Verifies implementation** with automated checks
4. **Post-processes** existing files if needed

### Automated Build Pipeline

The `build-optimize.sh` script provides:
- Dependency management
- Sequential build execution
- Error handling and rollback
- Performance monitoring
- Success verification

---

## 🛠️ Implementation Guide

### For New Static Pages

1. **Use the template** from `fouc-template.html`
2. **Include critical CSS** inline in `<head>`
3. **Add loading screen** with branded styling
4. **Include FOUC prevention script**

### For SSG Templates

Templates automatically include FOUC prevention:
- `event-template.html` ✅
- Venue template in `build-venues-ssg.js` ✅

### Manual Integration

If adding FOUC to existing files:

```bash
# Use the integration utility
node ssg-fouc-integration.js

# Or apply to specific directory
node ssg-fouc-integration.js --dir venue/
```

---

## 🧪 Testing

### Manual Testing

1. **Fast Connection**: Brief loading screen should appear
2. **Slow Connection**: Loading screen until resources load
3. **No FOUC**: No unstyled content should flash
4. **Smooth Transition**: Content appears smoothly

### Test Page

Visit `test-fouc.html` to verify FOUC prevention is working correctly.

### Browser Testing

Tested and working on:
- Chrome/Chromium ✅
- Firefox ✅
- Safari ✅
- Edge ✅
- Mobile browsers ✅

### Connection Testing

Verified on:
- Fast 4G/LTE ✅
- Slow 3G ✅
- 2G ✅
- Offline (service worker) ✅

---

## 🔧 Troubleshooting

### Common Issues

#### SSG Build Failures

**Problem**: Build scripts fail with Firebase errors
**Solution**: 
```bash
# Check environment variables
echo $FIREBASE_PROJECT_ID
echo $FIREBASE_CLIENT_EMAIL

# Verify Firebase connection
node netlify/functions/test-firestore-connection.js
```

#### FOUC Still Occurring

**Problem**: Content flashes despite prevention
**Solutions**:
1. Check if critical CSS is inline
2. Verify loading screen appears
3. Test on slower connections
4. Check browser console for errors

#### Missing Templates

**Problem**: Template files not found
**Solution**:
```bash
# Ensure templates exist
ls -la event-template.html
ls -la venue-template.html

# Recreate if missing
cp fouc-template.html event-template.html
```

### Debug Commands

```bash
# Check FOUC implementation
grep -r "fouc-prevention.js" *.html

# Verify all pages have FOUC
find . -name "*.html" -exec grep -l "loading-screen" {} \;

# Test specific page
curl -s http://localhost:8888/event/test-event | grep "fouc-prevention"
```

---

## 🔄 Maintenance

### Regular Tasks

#### Monthly Reviews
- Verify all new pages have FOUC prevention
- Test loading performance across devices
- Update templates if needed
- Review and update documentation

#### When Adding New Pages
1. Use `fouc-template.html` as base
2. Test on slow connections
3. Verify smooth transitions
4. Update this documentation if patterns change

#### For SSG Updates
1. Always use `build-with-fouc.js`
2. Test generated pages immediately
3. Verify template updates propagate
4. Monitor build performance

### Performance Monitoring

- **Critical CSS Size**: Keep under 2KB
- **Loading Screen Duration**: Aim for <500ms on fast connections
- **Transition Smoothness**: No visible layout shifts
- **Build Time**: Monitor for performance degradation

---

## 📊 Performance Impact

### Benefits
- **Faster Perceived Load**: Users see loading screen instead of unstyled content
- **Better UX**: Smooth transitions improve user experience
- **No Layout Shift**: Critical CSS prevents cumulative layout shift
- **Better Core Web Vitals**: Improved scores across all metrics

### Costs
- **Minimal Size Impact**: ~2KB of critical CSS per page
- **Build Time**: Slight increase due to post-processing
- **Maintenance**: Regular verification needed

---

## 🎯 Future Improvements

### Planned Enhancements
- **Dynamic Critical CSS**: Generate based on page content
- **Progressive Loading**: Load non-critical content progressively
- **Advanced Caching**: Improve repeat visit performance
- **Build Optimization**: Faster build times for large sites

### Monitoring
- Set up performance monitoring
- Track Core Web Vitals
- Monitor user experience metrics
- Regular performance audits

---

## 📞 Support

### Quick Reference
- **Templates**: Use `fouc-template.html` for new pages
- **Build**: Use `build-with-fouc.js` for SSG
- **Test**: Visit `test-fouc.html` to verify implementation
- **Debug**: Check browser console for errors

### Documentation
- **FOUC Prevention**: `/js/fouc-prevention.js`
- **Build Scripts**: `build-with-fouc.js`, `build-optimize.sh`
- **Templates**: `event-template.html`, `venue-template.html`
- **Integration**: `ssg-fouc-integration.js`

---

*This guide consolidates all SSG and FOUC prevention documentation. For the most current information, always refer to the actual implementation files.* 