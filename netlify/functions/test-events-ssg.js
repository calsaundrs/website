const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.handler = async function(event, context) {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        console.log('Test Event SSG: Starting function');
        
        // Path to the build script - adjust for local development
        let buildScriptPath;
        if (process.env.NETLIFY) {
            // Production Netlify environment
            buildScriptPath = path.join(__dirname, '..', '..', 'build-events-ssg.js');
        } else {
            // Local development environment
            buildScriptPath = path.join(__dirname, '..', '..', '..', 'build-events-ssg.js');
        }
        
        console.log('Test Event SSG: Build script path:', buildScriptPath);
        console.log('Test Event SSG: Current directory:', __dirname);
        console.log('Test Event SSG: Environment:', { 
            NODE_ENV: process.env.NODE_ENV, 
            NETLIFY: process.env.NETLIFY,
            FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ? 'SET' : 'NOT SET'
        });
        
        // Check if build script exists
        if (!fs.existsSync(buildScriptPath)) {
            console.error('Test Event SSG: Build script not found at:', buildScriptPath);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: 'Build script not found',
                    path: buildScriptPath,
                    currentDir: __dirname
                })
            };
        }
        
        // Check if event directory exists - adjust for local development
        let eventDir, templatePath;
        if (process.env.NETLIFY) {
            // Production Netlify environment
            eventDir = path.join(__dirname, '..', '..', 'event');
            templatePath = path.join(__dirname, '..', '..', 'event-template.html');
        } else {
            // Local development environment
            eventDir = path.join(__dirname, '..', '..', '..', 'event');
            templatePath = path.join(__dirname, '..', '..', '..', 'event-template.html');
        }
        
        const eventDirExists = fs.existsSync(eventDir);
        const templateExists = fs.existsSync(templatePath);
        
        // Return diagnostic information
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Test completed successfully',
                diagnostics: {
                    buildScriptExists: true,
                    buildScriptPath: buildScriptPath,
                    eventDirExists: eventDirExists,
                    eventDirPath: eventDir,
                    templateExists: templateExists,
                    templatePath: templatePath,
                    currentDir: __dirname,
                    environment: {
                        NODE_ENV: process.env.NODE_ENV,
                        NETLIFY: process.env.NETLIFY,
                        FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ? 'SET' : 'NOT SET'
                    }
                }
            })
        };

    } catch (error) {
        console.error('Test Event SSG: Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Test failed',
                details: error.message,
                stack: error.stack
            })
        };
    }
}; 