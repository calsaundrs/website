# SSG FOUC Integration Guide

## Overview

This guide explains how to ensure all future SSG (Static Site Generation) pages have FOUC prevention automatically integrated.

## Current Status

✅ **SSG Templates Updated**: Both `event-template.html` and venue template in `build-venues-ssg.js` now include FOUC prevention
✅ **Build Integration**: `build-with-fouc.js` script ensures FOUC prevention is applied during builds
✅ **Post-processing**: `ssg-fouc-integration.js` utility can add FOUC prevention to any generated files

## How to Ensure Future SSG Pages Have FOUC Protection

### 1. Use the Updated Build Script

Instead of running individual SSG scripts, use the integrated build script:

```bash
# Full build with FOUC prevention
node build-with-fouc.js

# Verify existing files
node build-with-fouc.js --verify

# Update templates only
node build-with-fouc.js --templates
```

### 2. Template Requirements

When creating new SSG templates, include these elements:

#### In the `<head>` section:
```html
<!-- FOUC Prevention: Critical CSS and Loading Screen -->
<style>
    /* FOUC Prevention - Hide content until styles are loaded */
    html {
        visibility: hidden;
    }
    
    html.loaded {
        visibility: visible;
    }
    
    body {
        visibility: hidden !important;
        opacity: 0 !important;
        transition: opacity 0.3s ease, visibility 0.3s ease !important;
    }
    
    body.loaded {
        visibility: visible !important;
        opacity: 1 !important;
    }
    
    .fouc-prevention {
        visibility: hidden;
        opacity: 0;
        transition: opacity 0.3s ease, visibility 0.3s ease;
    }
    
    .fouc-prevention.loaded {
        visibility: visible;
        opacity: 1;
    }
    
    /* Loading screen styles */
    .loading-screen {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #121212 0%, #1a1a1a 50%, #2d1b69 100%);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        transition: opacity 0.5s ease, visibility 0.5s ease;
    }
    
    .loading-screen.hidden {
        opacity: 0;
        visibility: hidden;
    }
    
    .loading-logo {
        width: 80px;
        height: 80px;
        margin-bottom: 20px;
        animation: pulse 2s infinite;
    }
    
    .loading-text {
        color: #B564F7;
        font-family: 'Poppins', sans-serif;
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 10px;
    }
    
    .loading-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid rgba(181, 100, 247, 0.3);
        border-top: 3px solid #B564F7;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }
    
    @keyframes pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.05); opacity: 0.8; }
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    /* Critical CSS to prevent flashing */
    body {
        background-color: #121212;
        color: #EAEAEA;
        font-family: 'Poppins', system-ui, -apple-system, sans-serif;
        line-height: 1.6;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        margin: 0;
        padding: 0;
    }
    
    /* Basic layout styles to prevent layout shift */
    .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 1rem;
    }
    
    /* Prevent pride flag from flashing at full size */
    img[src*="progressflag"] {
        height: 1.5rem !important;
        width: auto !important;
        max-width: 1.5rem !important;
        opacity: 0;
        transition: opacity 0.3s ease;
    }
    
    /* Show flag after page loads */
    .flag-loaded img[src*="progressflag"] {
        opacity: 1;
    }
</style>

<!-- Performance: Optimized external resource loading -->
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Poppins:wght@400;600;700&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
<noscript><link href="https://fonts.googleapis.com/css2?family=Anton&family=Poppins:wght@400;600;700&display=swap" rel="stylesheet"></noscript>

<link rel="preload" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css"></noscript>

<link rel="preload" href="/css/main.css" as="style">
<link rel="stylesheet" href="/css/main.css">

<!-- FOUC Prevention Script -->
<script src="/js/fouc-prevention.js"></script>

<!-- Tailwind loaded with defer to avoid render blocking -->
<script src="https://cdn.tailwindcss.com" defer></script>
```

#### In the `<body>` section:
```html
<body class="antialiased fouc-prevention">
    <!-- Loading Screen -->
    <div class="loading-screen" id="loadingScreen">
        <img src="/progressflag.svg.png" alt="Brum Outloud" class="loading-logo">
        <div class="loading-text">Loading Brum Outloud...</div>
        <div class="loading-spinner"></div>
    </div>
    
    <!-- Your content here -->
</body>
```

### 3. Integration with Build Scripts

#### For Handlebars Templates:
```javascript
const { addFOUCToTemplate } = require('./ssg-fouc-integration');

// In your build script
async function generatePage(data, template) {
    let html = template(data);
    
    // Add FOUC prevention if not already present
    if (!html.includes('fouc-prevention.js')) {
        html = addFOUCToTemplate(html);
    }
    
    return html;
}
```

#### For String Templates:
```javascript
const { addFOUCToTemplate } = require('./ssg-fouc-integration');

// In your build script
const templateContent = `<!DOCTYPE html>
<html>
<head>
    <!-- Your head content -->
</head>
<body>
    <!-- Your body content -->
</body>
</html>`;

// Add FOUC prevention
const templateWithFOUC = addFOUCToTemplate(templateContent);
```

### 4. Post-Processing Generated Files

After generating SSG pages, run post-processing:

```javascript
const { postProcessSSGFiles } = require('./ssg-fouc-integration');

// After generating all pages
await postProcessSSGFiles('./output-directory');
```

### 5. Verification

Always verify that generated pages have FOUC prevention:

```javascript
const { verifyFOUCPrevention } = require('./build-with-fouc.js');

// Verify generated files
await verifyFOUCPrevention();
```

## Automated Integration

### 1. CI/CD Integration

Add to your build pipeline:

```yaml
# Example for Netlify
build:
  command: |
    npm install
    node build-with-fouc.js
    # Your other build commands
```

### 2. Pre-commit Hooks

Add a pre-commit hook to verify FOUC prevention:

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Check if generated files have FOUC prevention
node build-with-fouc.js --verify

if [ $? -ne 0 ]; then
    echo "❌ Some files are missing FOUC prevention"
    exit 1
fi
```

### 3. Automated Testing

Create automated tests for FOUC prevention:

```javascript
// test-fouc-prevention.js
const fs = require('fs').promises;
const path = require('path');

async function testFOUCPrevention() {
    const directories = ['event', 'venue'];
    
    for (const dir of directories) {
        const files = await fs.readdir(dir);
        const htmlFiles = files.filter(file => file.endsWith('.html'));
        
        for (const file of htmlFiles) {
            const content = await fs.readFile(path.join(dir, file), 'utf8');
            
            if (!content.includes('fouc-prevention.js') || !content.includes('loading-screen')) {
                throw new Error(`Missing FOUC prevention in ${dir}/${file}`);
            }
        }
    }
    
    console.log('✅ All files have FOUC prevention');
}

testFOUCPrevention().catch(console.error);
```

## Troubleshooting

### Common Issues

1. **FOUC Still Occurs**
   - Check if `/js/fouc-prevention.js` is loading
   - Verify critical CSS is in the `<head>`
   - Ensure loading screen is present

2. **Loading Screen Doesn't Appear**
   - Check if `loadingScreen` element exists
   - Verify CSS animations are working
   - Check for JavaScript errors

3. **Content Doesn't Show**
   - Verify `.loaded` class is being added
   - Check if FOUC prevention script is running
   - Look for CSS conflicts

### Debug Commands

```bash
# Test FOUC prevention
node build-with-fouc.js --verify

# Update templates
node build-with-fouc.js --templates

# Full build with debugging
DEBUG=true node build-with-fouc.js
```

## Best Practices

1. **Always Use the Build Script**: Use `build-with-fouc.js` instead of individual SSG scripts
2. **Test Generated Pages**: Verify FOUC prevention works on generated pages
3. **Keep Templates Updated**: Ensure all templates include FOUC prevention
4. **Monitor Performance**: Check that FOUC prevention doesn't impact load times
5. **Document Changes**: Update this guide when making changes to FOUC prevention

## Future Enhancements

- **Template Generator**: Create a tool to generate new templates with FOUC prevention
- **Build Integration**: Integrate FOUC prevention into all build processes
- **Performance Monitoring**: Add metrics to track FOUC prevention effectiveness
- **Automated Testing**: Create comprehensive tests for FOUC prevention

## Support

For issues with SSG FOUC integration:
1. Check this guide
2. Run `node build-with-fouc.js --verify`
3. Test with `test-fouc.html`
4. Review browser console for errors
5. Check that all required files are present