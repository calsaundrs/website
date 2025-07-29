/**
 * SSG FOUC Integration Utility
 * Ensures all SSG-generated pages have FOUC prevention
 */

const fs = require('fs').promises;
const path = require('path');

// FOUC prevention critical CSS
const foucCriticalCSS = `
    <!-- FOUC Prevention: Critical CSS and Loading Screen -->
    <style>
        /* FOUC Prevention - Hide content until styles are loaded */
        .fouc-prevention {
            visibility: hidden;
            opacity: 0;
            transition: opacity 0.3s ease, visibility 0.3s ease;
        }
        
        .fouc-prevention.loaded {
            visibility: visible;
            opacity: 1;
        }
        
        /* Loading screen */
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
    </style>`;

// FOUC prevention scripts
const foucScripts = `
    <!-- FOUC Prevention Script -->
    <script src="/js/fouc-prevention.js"></script>`;

// Loading screen HTML
const loadingScreenHTML = `
    <!-- Loading Screen -->
    <div class="loading-screen" id="loadingScreen">
        <img src="/progressflag.svg.png" alt="Brum Outloud" class="loading-logo">
        <div class="loading-text">Loading Brum Outloud...</div>
        <div class="loading-spinner"></div>
    </div>`;

/**
 * Add FOUC prevention to a template string
 * @param {string} templateContent - The HTML template content
 * @returns {string} - Template with FOUC prevention added
 */
function addFOUCToTemplate(templateContent) {
    let modifiedContent = templateContent;
    
    // Check if FOUC prevention is already present
    if (modifiedContent.includes('fouc-prevention.js') || modifiedContent.includes('loading-screen')) {
        console.log('⚠️  Template already has FOUC prevention');
        return modifiedContent;
    }
    
    // Add critical CSS before </head>
    if (!modifiedContent.includes('FOUC Prevention: Critical CSS')) {
        const headEndIndex = modifiedContent.lastIndexOf('</head>');
        if (headEndIndex !== -1) {
            modifiedContent = modifiedContent.slice(0, headEndIndex) + foucCriticalCSS + '\n    ' + modifiedContent.slice(headEndIndex);
        }
    }
    
    // Add FOUC prevention script before main.js or before </head>
    if (!modifiedContent.includes('fouc-prevention.js')) {
        const mainJsIndex = modifiedContent.indexOf('<script src="/js/main.js"');
        if (mainJsIndex !== -1) {
            modifiedContent = modifiedContent.slice(0, mainJsIndex) + foucScripts + '\n    ' + modifiedContent.slice(mainJsIndex);
        } else {
            // If no main.js, add before </head>
            const headEndIndex = modifiedContent.lastIndexOf('</head>');
            if (headEndIndex !== -1) {
                modifiedContent = modifiedContent.slice(0, headEndIndex) + foucScripts + '\n    ' + modifiedContent.slice(headEndIndex);
            }
        }
    }
    
    // Add loading screen after <body> tag
    if (!modifiedContent.includes('loading-screen')) {
        const bodyStartIndex = modifiedContent.indexOf('<body');
        if (bodyStartIndex !== -1) {
            const bodyEndIndex = modifiedContent.indexOf('>', bodyStartIndex) + 1;
            const bodyTag = modifiedContent.slice(bodyStartIndex, bodyEndIndex);
            
            // Add fouc-prevention class to body
            if (!bodyTag.includes('fouc-prevention')) {
                if (bodyTag.includes('class="')) {
                    const newBodyTag = bodyTag.replace('class="', 'class="fouc-prevention ');
                    modifiedContent = modifiedContent.replace(bodyTag, newBodyTag);
                } else {
                    const newBodyTag = bodyTag.replace('<body', '<body class="fouc-prevention"');
                    modifiedContent = modifiedContent.replace(bodyTag, newBodyTag);
                }
            }
            
            // Add loading screen after body tag
            modifiedContent = modifiedContent.slice(0, bodyEndIndex) + '\n    ' + loadingScreenHTML + '\n\n    ' + modifiedContent.slice(bodyEndIndex);
        }
    }
    
    return modifiedContent;
}

/**
 * Update SSG templates with FOUC prevention
 */
async function updateSSGTemplates() {
    console.log('🔄 Updating SSG templates with FOUC prevention...\n');
    
    const templates = [
        'event-template.html',
        'venue-template.html'
    ];
    
    for (const template of templates) {
        try {
            if (await fs.access(template).then(() => true).catch(() => false)) {
                const content = await fs.readFile(template, 'utf8');
                const updatedContent = addFOUCToTemplate(content);
                
                if (content !== updatedContent) {
                    await fs.writeFile(template, updatedContent, 'utf8');
                    console.log(`✅ Updated ${template} with FOUC prevention`);
                } else {
                    console.log(`⏭️  ${template} already has FOUC prevention`);
                }
            } else {
                console.log(`⚠️  Template not found: ${template}`);
            }
        } catch (error) {
            console.error(`❌ Error updating ${template}:`, error.message);
        }
    }
}

/**
 * Create a Handlebars helper for FOUC prevention
 * Use this in your SSG build scripts
 */
function createFOUCHelpers() {
    return {
        // Helper to add FOUC prevention to any template
        addFOUCPrevention: function(templateContent) {
            return addFOUCToTemplate(templateContent);
        },
        
        // Helper to check if FOUC prevention is needed
        needsFOUCPrevention: function(templateContent) {
            return !templateContent.includes('fouc-prevention.js') && !templateContent.includes('loading-screen');
        }
    };
}

/**
 * Post-process SSG generated files to ensure FOUC prevention
 * @param {string} outputDir - Directory containing generated files
 */
async function postProcessSSGFiles(outputDir = '.') {
    console.log(`🔄 Post-processing SSG files in ${outputDir}...\n`);
    
    const htmlFiles = await findHtmlFiles(outputDir);
    let processedCount = 0;
    
    for (const filePath of htmlFiles) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            
            // Skip files that already have FOUC prevention
            if (content.includes('fouc-prevention.js') || content.includes('loading-screen')) {
                continue;
            }
            
            const updatedContent = addFOUCToTemplate(content);
            
            if (content !== updatedContent) {
                await fs.writeFile(filePath, updatedContent, 'utf8');
                console.log(`✅ Added FOUC prevention to ${filePath}`);
                processedCount++;
            }
        } catch (error) {
            console.error(`❌ Error processing ${filePath}:`, error.message);
        }
    }
    
    console.log(`\n📊 Post-processing complete: ${processedCount} files updated`);
}

/**
 * Find all HTML files in a directory recursively
 */
async function findHtmlFiles(dir, fileList = []) {
    try {
        const files = await fs.readdir(dir);
        
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = await fs.stat(filePath);
            
            if (stat.isDirectory()) {
                if (file !== '.git' && file !== 'node_modules') {
                    await findHtmlFiles(filePath, fileList);
                }
            } else if (file.endsWith('.html')) {
                fileList.push(filePath);
            }
        }
    } catch (error) {
        console.error(`Error scanning directory ${dir}:`, error.message);
    }
    
    return fileList;
}

/**
 * Integration function for SSG build scripts
 * Call this after generating pages
 */
async function integrateFOUCIntoSSG() {
    console.log('🚀 Integrating FOUC prevention into SSG build...\n');
    
    // Update templates
    await updateSSGTemplates();
    
    // Post-process generated files
    await postProcessSSGFiles();
    
    console.log('\n✅ FOUC prevention integration complete!');
}

// Export functions for use in other modules
module.exports = {
    addFOUCToTemplate,
    createFOUCHelpers,
    postProcessSSGFiles,
    integrateFOUCIntoSSG,
    updateSSGTemplates
};

// Run if called directly
if (require.main === module) {
    integrateFOUCIntoSSG().catch(console.error);
}