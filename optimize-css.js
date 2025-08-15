const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

async function optimizeCSS() {
    console.log('🎨 Starting CSS Optimization...');
    
    try {
        // Step 1: Check if we have the required tools
        console.log('📦 Checking dependencies...');
        
        // Step 2: Create optimized Tailwind CSS
        console.log('🔧 Optimizing Tailwind CSS...');
        
        // Create a temporary config for production build with better content patterns
        const tailwindConfig = `
module.exports = {
    content: [
        './*.html',
        './admin-*.html',
        './event/*.html',
        './venue/*.html',
        './js/*.js',
        './netlify/functions/*.js'
    ],
    theme: {
        extend: {
            fontFamily: {
                'anton': ['Anton', 'sans-serif'],
                'omnes': ['Omnes Pro', 'sans-serif']
            },
            colors: {
                'purple': {
                    500: '#B564F7',
                    600: '#9333EA',
                    700: '#7C3AED'
                },
                'pink': {
                    500: '#E83A99',
                    600: '#DB2777'
                }
            }
        }
    },
    plugins: []
}`;
        
        await fs.writeFile('tailwind.config.prod.js', tailwindConfig);
        
        // Build optimized Tailwind CSS
        execSync('npx tailwindcss -c tailwind.config.prod.js -i css/tailwind.css -o css/tailwind.optimized.css --minify', { stdio: 'inherit' });
        
        // Step 3: Minify main.css with more aggressive optimization
        console.log('🔧 Minifying main.css...');
        const mainCSS = await fs.readFile('css/main.css', 'utf8');
        
        // More aggressive minification
        const minifiedMain = mainCSS
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .replace(/\s*{\s*/g, '{') // Remove spaces around braces
            .replace(/\s*}\s*/g, '}') // Remove spaces around braces
            .replace(/\s*:\s*/g, ':') // Remove spaces around colons
            .replace(/\s*;\s*/g, ';') // Remove spaces around semicolons
            .replace(/\s*,\s*/g, ',') // Remove spaces around commas
            .replace(/;\s*}/g, '}') // Remove trailing semicolons before closing braces
            .replace(/:\s*0\s*px/g, ':0') // Remove px from 0 values
            .replace(/:\s*0\s*em/g, ':0') // Remove em from 0 values
            .replace(/:\s*0\s*rem/g, ':0') // Remove rem from 0 values
            .replace(/:\s*0\s*%/g, ':0') // Remove % from 0 values
            .trim();
        
        await fs.writeFile('css/main.min.css', minifiedMain);
        
        // Step 4: Combine and create final optimized CSS
        console.log('🔧 Creating final optimized CSS...');
        const optimizedTailwind = await fs.readFile('css/tailwind.optimized.css', 'utf8');
        const minifiedMainCSS = await fs.readFile('css/main.min.css', 'utf8');
        
        const finalCSS = `/* Optimized CSS - Generated on ${new Date().toISOString()} */
${minifiedMainCSS}

${optimizedTailwind}`;
        
        await fs.writeFile('css/optimized.css', finalCSS);
        
        // Step 5: Clean up temporary files
        console.log('🧹 Cleaning up temporary files...');
        await fs.unlink('tailwind.config.prod.js');
        await fs.unlink('css/tailwind.optimized.css');
        await fs.unlink('css/main.min.css');
        
        // Step 6: Get file sizes
        const originalTailwindSize = await fs.stat('css/tailwind.css');
        const originalMainSize = await fs.stat('css/main.css');
        const optimizedSize = await fs.stat('css/optimized.css');
        
        const originalTotalKB = Math.round((originalTailwindSize.size + originalMainSize.size) / 1024);
        const optimizedKB = Math.round(optimizedSize.size / 1024);
        const savings = Math.round(((originalTailwindSize.size + originalMainSize.size - optimizedSize.size) / (originalTailwindSize.size + originalMainSize.size)) * 100);
        
        console.log('✅ CSS Optimization Complete!');
        console.log(`📊 Original total size: ${originalTotalKB}KB`);
        console.log(`📊 Optimized size: ${optimizedKB}KB`);
        console.log(`📊 Size reduction: ${savings}%`);
        console.log(`📁 Output file: css/optimized.css`);
        
    } catch (error) {
        console.error('❌ CSS Optimization failed:', error);
        process.exit(1);
    }
}

// Run the optimization
optimizeCSS();
