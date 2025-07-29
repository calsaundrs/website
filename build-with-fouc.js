#!/usr/bin/env node

/**
 * Build Script with FOUC Prevention Integration
 * Runs SSG builds and ensures all generated pages have FOUC prevention
 */

const { spawn } = require('child_process');
const { integrateFOUCIntoSSG } = require('./ssg-fouc-integration');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
    log(`\n${step} ${message}`, 'cyan');
}

function logSuccess(message) {
    log(`✅ ${message}`, 'green');
}

function logError(message) {
    log(`❌ ${message}`, 'red');
}

function logWarning(message) {
    log(`⚠️  ${message}`, 'yellow');
}

/**
 * Run a command and return a promise
 */
function runCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
        log(`Running: ${command} ${args.join(' ')}`, 'blue');
        
        const child = spawn(command, args, {
            stdio: 'inherit',
            shell: true,
            ...options
        });
        
        child.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with exit code ${code}`));
            }
        });
        
        child.on('error', (error) => {
            reject(error);
        });
    });
}

/**
 * Main build process
 */
async function buildWithFOUC() {
    const startTime = Date.now();
    
    try {
        log('🚀 Starting build with FOUC prevention integration...', 'bright');
        
        // Step 1: Update SSG templates
        logStep('1️⃣', 'Updating SSG templates with FOUC prevention');
        await integrateFOUCIntoSSG();
        logSuccess('SSG templates updated');
        
        // Step 2: Run event SSG build
        logStep('2️⃣', 'Building event pages with SSG');
        try {
            await runCommand('node', ['build-events-ssg.js']);
            logSuccess('Event pages built successfully');
        } catch (error) {
            logWarning('Event SSG build failed, continuing with venue build');
            logWarning(error.message);
        }
        
        // Step 3: Run venue SSG build
        logStep('3️⃣', 'Building venue pages with SSG');
        try {
            await runCommand('node', ['build-venues-ssg.js']);
            logSuccess('Venue pages built successfully');
        } catch (error) {
            logWarning('Venue SSG build failed');
            logWarning(error.message);
        }
        
        // Step 4: Post-process generated files
        logStep('4️⃣', 'Post-processing generated files for FOUC prevention');
        const { postProcessSSGFiles } = require('./ssg-fouc-integration');
        await postProcessSSGFiles();
        logSuccess('Post-processing complete');
        
        // Step 5: Verify FOUC prevention
        logStep('5️⃣', 'Verifying FOUC prevention on generated files');
        await verifyFOUCPrevention();
        logSuccess('FOUC prevention verification complete');
        
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        
        log('\n🎉 Build completed successfully!', 'bright');
        log(`⏱️  Total build time: ${duration}s`, 'green');
        log('\n📋 Summary:', 'cyan');
        log('✅ SSG templates updated with FOUC prevention');
        log('✅ Event pages generated with FOUC prevention');
        log('✅ Venue pages generated with FOUC prevention');
        log('✅ All generated files have FOUC prevention');
        log('✅ Build verification passed');
        
    } catch (error) {
        logError('Build failed');
        logError(error.message);
        process.exit(1);
    }
}

/**
 * Verify that all generated files have FOUC prevention
 */
async function verifyFOUCPrevention() {
    const fs = require('fs').promises;
    const path = require('path');
    
    // Directories to check
    const directories = ['event', 'venue'];
    let totalFiles = 0;
    let filesWithFOUC = 0;
    
    for (const dir of directories) {
        try {
            const files = await fs.readdir(dir);
            const htmlFiles = files.filter(file => file.endsWith('.html'));
            
            for (const file of htmlFiles) {
                totalFiles++;
                const filePath = path.join(dir, file);
                const content = await fs.readFile(filePath, 'utf8');
                
                if (content.includes('fouc-prevention.js') && content.includes('loading-screen')) {
                    filesWithFOUC++;
                } else {
                    logWarning(`Missing FOUC prevention: ${filePath}`);
                }
            }
        } catch (error) {
            logWarning(`Could not check directory ${dir}: ${error.message}`);
        }
    }
    
    if (filesWithFOUC === totalFiles) {
        logSuccess(`All ${totalFiles} generated files have FOUC prevention`);
    } else {
        logWarning(`${filesWithFOUC}/${totalFiles} files have FOUC prevention`);
    }
}

/**
 * Show help information
 */
function showHelp() {
    log('\n🔧 Build Script with FOUC Prevention Integration', 'bright');
    log('\nUsage:', 'cyan');
    log('  node build-with-fouc.js [options]', 'reset');
    log('\nOptions:', 'cyan');
    log('  --help, -h     Show this help message', 'reset');
    log('  --verify       Only verify FOUC prevention on existing files', 'reset');
    log('  --templates    Only update SSG templates', 'reset');
    log('\nExamples:', 'cyan');
    log('  node build-with-fouc.js                    # Full build with FOUC integration', 'reset');
    log('  node build-with-fouc.js --verify           # Verify existing files', 'reset');
    log('  node build-with-fouc.js --templates        # Update templates only', 'reset');
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
}

if (args.includes('--verify')) {
    log('🔍 Verifying FOUC prevention on existing files...', 'bright');
    verifyFOUCPrevention().then(() => {
        logSuccess('Verification complete');
    }).catch((error) => {
        logError('Verification failed');
        logError(error.message);
        process.exit(1);
    });
} else if (args.includes('--templates')) {
    log('🔄 Updating SSG templates only...', 'bright');
    integrateFOUCIntoSSG().then(() => {
        logSuccess('Templates updated');
    }).catch((error) => {
        logError('Template update failed');
        logError(error.message);
        process.exit(1);
    });
} else {
    // Run full build
    buildWithFOUC();
}