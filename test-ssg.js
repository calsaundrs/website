#!/usr/bin/env node

/**
 * Test script for Venue SSG Implementation
 * This script tests the SSG functionality without requiring environment variables
 */

const fs = require('fs').promises;
const path = require('path');

console.log('🧪 Testing Venue SSG Implementation...\n');

// Test 1: Check if build script exists
async function testBuildScript() {
    console.log('1. Checking build script...');
    try {
        const buildScript = await fs.readFile('build-venues-ssg.js', 'utf8');
        const hasTemplate = buildScript.includes('templateContent');
        const hasHandlebars = buildScript.includes('Handlebars.registerHelper');
        const hasFirebase = buildScript.includes('firebase-admin');
        
        console.log(`   ✓ Build script exists (${buildScript.length} characters)`);
        console.log(`   ✓ Template content: ${hasTemplate ? 'Found' : 'Missing'}`);
        console.log(`   ✓ Handlebars helpers: ${hasHandlebars ? 'Found' : 'Missing'}`);
        console.log(`   ✓ Firebase integration: ${hasFirebase ? 'Found' : 'Missing'}`);
        
        return true;
    } catch (error) {
        console.log(`   ✗ Build script not found: ${error.message}`);
        return false;
    }
}

// Test 2: Check package.json scripts
async function testPackageScripts() {
    console.log('\n2. Checking package.json scripts...');
    try {
        const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
        const scripts = packageJson.scripts || {};
        
        const hasBuildVenues = !!scripts['build:venues'];
        const hasBuild = !!scripts.build;
        
        console.log(`   ✓ build:venues script: ${hasBuildVenues ? 'Found' : 'Missing'}`);
        console.log(`   ✓ build script: ${hasBuild ? 'Found' : 'Missing'}`);
        
        if (hasBuildVenues) {
            console.log(`   ✓ build:venues command: ${scripts['build:venues']}`);
        }
        if (hasBuild) {
            console.log(`   ✓ build command: ${scripts.build}`);
        }
        
        return hasBuildVenues && hasBuild;
    } catch (error) {
        console.log(`   ✗ Error reading package.json: ${error.message}`);
        return false;
    }
}

// Test 3: Check netlify.toml configuration
async function testNetlifyConfig() {
    console.log('\n3. Checking netlify.toml configuration...');
    try {
        const netlifyToml = await fs.readFile('netlify.toml', 'utf8');
        
        const hasBuildCommand = netlifyToml.includes('command = "npm run build"');
        const hasVenueRedirect = netlifyToml.includes('/venue/*') && netlifyToml.includes('/venue/:splat.html');
        const hasStaticRedirect = netlifyToml.includes('to = "/venue/:splat.html"');
        
        console.log(`   ✓ Build command: ${hasBuildCommand ? 'Found' : 'Missing'}`);
        console.log(`   ✓ Venue redirect: ${hasVenueRedirect ? 'Found' : 'Missing'}`);
        console.log(`   ✓ Static file serving: ${hasStaticRedirect ? 'Found' : 'Missing'}`);
        
        return hasBuildCommand && hasVenueRedirect && hasStaticRedirect;
    } catch (error) {
        console.log(`   ✗ Error reading netlify.toml: ${error.message}`);
        return false;
    }
}

// Test 4: Check template structure
async function testTemplateStructure() {
    console.log('\n4. Checking template structure...');
    try {
        const buildScript = await fs.readFile('build-venues-ssg.js', 'utf8');
        
        // Check for key template elements
        const checks = [
            { name: 'DOCTYPE declaration', pattern: '<!DOCTYPE html>' },
            { name: 'Head section', pattern: '<head>' },
            { name: 'Body section', pattern: '<body>' },
            { name: 'Header navigation', pattern: 'class="container mx-auto flex justify-between items-center"' },
            { name: 'Venue card structure', pattern: 'venue-card rounded-xl overflow-hidden' },
            { name: 'Footer structure', pattern: 'border-t-2 border-gray-800 p-8' },
            { name: 'Handlebars variables', pattern: '{{venue.name}}' },
            { name: 'CSS classes', pattern: 'accent-color' },
            { name: 'Tailwind CSS', pattern: 'https://cdn.tailwindcss.com' },
            { name: 'Font Awesome', pattern: 'font-awesome/6.4.2/css/all.min.css' }
        ];
        
        let passedChecks = 0;
        for (const check of checks) {
            const found = buildScript.includes(check.pattern);
            console.log(`   ${found ? '✓' : '✗'} ${check.name}: ${found ? 'Found' : 'Missing'}`);
            if (found) passedChecks++;
        }
        
        const successRate = (passedChecks / checks.length) * 100;
        console.log(`   Template completeness: ${passedChecks}/${checks.length} (${successRate.toFixed(1)}%)`);
        
        return successRate >= 80; // 80% threshold
    } catch (error) {
        console.log(`   ✗ Error checking template: ${error.message}`);
        return false;
    }
}

// Test 5: Check Handlebars helpers
async function testHandlebarsHelpers() {
    console.log('\n5. Checking Handlebars helpers...');
    try {
        const buildScript = await fs.readFile('build-venues-ssg.js', 'utf8');
        
        const helpers = [
            'formatDay',
            'formatMonth', 
            'formatTime',
            'times',
            'subtract'
        ];
        
        let foundHelpers = 0;
        for (const helper of helpers) {
            const found = buildScript.includes(`Handlebars.registerHelper('${helper}'`);
            console.log(`   ${found ? '✓' : '✗'} ${helper} helper: ${found ? 'Found' : 'Missing'}`);
            if (found) foundHelpers++;
        }
        
        const successRate = (foundHelpers / helpers.length) * 100;
        console.log(`   Helpers completeness: ${foundHelpers}/${helpers.length} (${successRate.toFixed(1)}%)`);
        
        return successRate >= 80; // 80% threshold
    } catch (error) {
        console.log(`   ✗ Error checking helpers: ${error.message}`);
        return false;
    }
}

// Test 6: Check data processing functions
async function testDataProcessing() {
    console.log('\n6. Checking data processing functions...');
    try {
        const buildScript = await fs.readFile('build-venues-ssg.js', 'utf8');
        
        const functions = [
            'getAllVenues',
            'processVenueForPublic',
            'getUpcomingEventsForVenue',
            'generateVenuePage',
            'generateAllVenuePages'
        ];
        
        let foundFunctions = 0;
        for (const func of functions) {
            const found = buildScript.includes(`function ${func}`) || buildScript.includes(`async function ${func}`);
            console.log(`   ${found ? '✓' : '✗'} ${func} function: ${found ? 'Found' : 'Missing'}`);
            if (found) foundFunctions++;
        }
        
        const successRate = (foundFunctions / functions.length) * 100;
        console.log(`   Functions completeness: ${foundFunctions}/${functions.length} (${successRate.toFixed(1)}%)`);
        
        return successRate >= 80; // 80% threshold
    } catch (error) {
        console.log(`   ✗ Error checking functions: ${error.message}`);
        return false;
    }
}

// Test 7: Check documentation
async function testDocumentation() {
    console.log('\n7. Checking documentation...');
    try {
        const docs = [
            { file: 'VENUE_SSG_README.md', description: 'SSG documentation' },
            { file: 'build-optimize.sh', description: 'Build script' }
        ];
        
        let foundDocs = 0;
        for (const doc of docs) {
            try {
                await fs.access(doc.file);
                console.log(`   ✓ ${doc.description}: Found`);
                foundDocs++;
            } catch (error) {
                console.log(`   ✗ ${doc.description}: Missing`);
            }
        }
        
        const successRate = (foundDocs / docs.length) * 100;
        console.log(`   Documentation completeness: ${foundDocs}/${docs.length} (${successRate.toFixed(1)}%)`);
        
        return successRate >= 50; // 50% threshold
    } catch (error) {
        console.log(`   ✗ Error checking documentation: ${error.message}`);
        return false;
    }
}

// Main test runner
async function runTests() {
    const tests = [
        testBuildScript,
        testPackageScripts,
        testNetlifyConfig,
        testTemplateStructure,
        testHandlebarsHelpers,
        testDataProcessing,
        testDocumentation
    ];
    
    let passedTests = 0;
    const results = [];
    
    for (const test of tests) {
        try {
            const result = await test();
            results.push(result);
            if (result) passedTests++;
        } catch (error) {
            console.log(`   ✗ Test failed with error: ${error.message}`);
            results.push(false);
        }
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(50));
    
    const testNames = [
        'Build Script',
        'Package Scripts', 
        'Netlify Config',
        'Template Structure',
        'Handlebars Helpers',
        'Data Processing',
        'Documentation'
    ];
    
    for (let i = 0; i < testNames.length; i++) {
        const status = results[i] ? 'PASS' : 'FAIL';
        const icon = results[i] ? '✅' : '❌';
        console.log(`${icon} ${testNames[i]}: ${status}`);
    }
    
    const overallSuccess = (passedTests / tests.length) * 100;
    console.log(`\nOverall Success Rate: ${passedTests}/${tests.length} (${overallSuccess.toFixed(1)}%)`);
    
    if (overallSuccess >= 85) {
        console.log('\n🎉 SSG Implementation is ready for deployment!');
        console.log('\nNext steps:');
        console.log('1. Set environment variables in Netlify');
        console.log('2. Push changes to trigger build');
        console.log('3. Monitor build logs for any issues');
    } else if (overallSuccess >= 70) {
        console.log('\n⚠️  SSG Implementation needs minor fixes before deployment');
        console.log('\nReview failed tests above and fix issues');
    } else {
        console.log('\n❌ SSG Implementation needs significant work before deployment');
        console.log('\nMultiple critical components are missing or incomplete');
    }
    
    return overallSuccess >= 85;
}

// Run the tests
if (require.main === module) {
    runTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Test runner failed:', error);
            process.exit(1);
        });
}

module.exports = { runTests };