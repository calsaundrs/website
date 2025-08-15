const fs = require('fs').promises;
const path = require('path');

async function extractCriticalCSS() {
    console.log('🎯 Extracting Critical CSS...');
    
    try {
        // Read the optimized CSS
        const fullCSS = await fs.readFile('css/optimized.css', 'utf8');
        
        // Define critical CSS selectors for above-the-fold content
        const criticalSelectors = [
            // Body and base styles
            'body',
            'body.fouc-prevention',
            'html',
            '*',
            '::before',
            '::after',
            
            // Loading screen
            '.loading-screen',
            '.loading-logo',
            '.loading-text',
            '.loading-spinner',
            
            // Header and navigation
            'header',
            '.header',
            '.navbar',
            '.nav',
            '.nav-link',
            '.mobile-menu',
            '.hamburger',
            
            // Hero section
            '.hero',
            '.hero-content',
            '.hero-title',
            '.hero-subtitle',
            '.hero-buttons',
            '.btn',
            '.btn-primary',
            
            // Typography
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'p', 'span', 'div',
            '.text-', '.font-',
            
            // Layout
            '.container',
            '.grid',
            '.flex',
            '.hidden',
            '.block',
            '.inline-block',
            
            // Colors and backgrounds
            '.bg-',
            '.text-',
            '.border-',
            
            // Spacing
            '.p-', '.px-', '.py-', '.pt-', '.pb-', '.pl-', '.pr-',
            '.m-', '.mx-', '.my-', '.mt-', '.mb-', '.ml-', '.mr-',
            
            // Sizing
            '.w-', '.h-', '.max-w-', '.max-h-', '.min-w-', '.min-h-',
            
            // Position
            '.relative', '.absolute', '.fixed', '.sticky',
            '.top-', '.bottom-', '.left-', '.right-',
            
            // Display
            '.block', '.inline', '.inline-block', '.flex', '.grid',
            '.hidden', '.visible',
            
            // Transforms
            '.transform', '.scale-', '.rotate-', '.translate-',
            
            // Transitions
            '.transition', '.duration-', '.ease-',
            
            // Focus and accessibility
            '.focus', '.focus-visible', '.skip-link',
            
            // Custom classes
            '.heading-gradient',
            '.fouc-prevention',
            '.flag-loaded'
        ];
        
        // Extract CSS rules that match critical selectors
        const cssLines = fullCSS.split('\n');
        const criticalCSS = [];
        let inRule = false;
        let currentRule = '';
        let isCritical = false;
        
        for (const line of cssLines) {
            const trimmedLine = line.trim();
            
            if (trimmedLine.includes('{')) {
                // Check if this rule contains critical selectors
                isCritical = criticalSelectors.some(selector => 
                    trimmedLine.includes(selector) || 
                    trimmedLine.includes('@font-face') ||
                    trimmedLine.includes('@media')
                );
                
                if (isCritical) {
                    inRule = true;
                    currentRule = trimmedLine;
                }
            } else if (trimmedLine.includes('}') && inRule) {
                currentRule += trimmedLine;
                criticalCSS.push(currentRule);
                inRule = false;
                currentRule = '';
                isCritical = false;
            } else if (inRule) {
                currentRule += trimmedLine;
            }
        }
        
        // Create critical CSS content
        const criticalCSSContent = `/* Critical CSS - Above the fold styles */
/* Generated on ${new Date().toISOString()} */
${criticalCSS.join('\n')}`;
        
        await fs.writeFile('css/critical.css', criticalCSSContent);
        
        // Get file sizes
        const fullCSSSize = await fs.stat('css/optimized.css');
        const criticalCSSSize = await fs.stat('css/critical.css');
        
        const fullKB = Math.round(fullCSSSize.size / 1024);
        const criticalKB = Math.round(criticalCSSSize.size / 1024);
        const criticalPercentage = Math.round((criticalCSSSize.size / fullCSSSize.size) * 100);
        
        console.log('✅ Critical CSS Extraction Complete!');
        console.log(`📊 Full CSS size: ${fullKB}KB`);
        console.log(`📊 Critical CSS size: ${criticalKB}KB`);
        console.log(`📊 Critical CSS percentage: ${criticalPercentage}%`);
        console.log(`📁 Output file: css/critical.css`);
        
        // Create inline critical CSS for HTML
        const inlineCriticalCSS = criticalCSSContent
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .replace(/\s*{\s*/g, '{') // Remove spaces around braces
            .replace(/\s*}\s*/g, '}') // Remove spaces around braces
            .replace(/\s*:\s*/g, ':') // Remove spaces around colons
            .replace(/\s*;\s*/g, ';') // Remove spaces around semicolons
            .trim();
        
        await fs.writeFile('css/critical-inline.css', inlineCriticalCSS);
        console.log(`📁 Inline CSS file: css/critical-inline.css`);
        
    } catch (error) {
        console.error('❌ Critical CSS extraction failed:', error);
        process.exit(1);
    }
}

// Run the extraction
extractCriticalCSS();
