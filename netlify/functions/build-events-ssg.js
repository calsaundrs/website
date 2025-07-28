const { exec } = require('child_process');
const path = require('path');

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
        console.log('Event SSG Build: Starting function');
        
        // Check if we're in a Netlify environment or local development
        const isNetlify = process.env.NETLIFY;
        const isLocalDev = process.env.NODE_ENV === 'development' || !isNetlify;
        
        if (!isNetlify && !isLocalDev) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: 'This function can only be run in a Netlify environment or local development'
                })
            };
        }

        // Path to the build script
        const buildScriptPath = path.join(__dirname, '..', '..', 'build-events-ssg.js');
        
        console.log('Event SSG Build: Build script path:', buildScriptPath);
        console.log('Event SSG Build: Current directory:', __dirname);
        console.log('Event SSG Build: Environment:', { 
            NODE_ENV: process.env.NODE_ENV, 
            NETLIFY: process.env.NETLIFY,
            FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ? 'SET' : 'NOT SET'
        });
        
        // Check if build script exists
        const fs = require('fs');
        if (!fs.existsSync(buildScriptPath)) {
            console.error('Event SSG Build: Build script not found at:', buildScriptPath);
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
        
        console.log('Event SSG Build: Build script found, executing...');
        
        // Execute the build script and wait for completion
        return new Promise((resolve, reject) => {
            const command = `node "${buildScriptPath}"`;
            console.log('Event SSG Build: Executing command:', command);
            
            exec(command, { 
                maxBuffer: 1024 * 1024 * 10, // 10MB buffer
                timeout: 300000, // 5 minutes timeout
                cwd: path.join(__dirname, '..', '..'), // Set working directory to project root
                env: {
                    ...process.env,
                    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
                    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
                    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
                    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME
                }
            }, (error, stdout, stderr) => {
                if (error) {
                    console.error('Event SSG Build: Error executing build script:', error);
                    console.error('Event SSG Build: stderr:', stderr);
                    console.error('Event SSG Build: stdout:', stdout);
                    resolve({
                        statusCode: 500,
                        headers,
                        body: JSON.stringify({
                            error: 'Build script execution failed',
                            details: error.message,
                            stderr: stderr,
                            stdout: stdout,
                            code: error.code,
                            signal: error.signal
                        })
                    });
                    return;
                }
                
                console.log('Event SSG Build: Build script output:', stdout);
                
                resolve({
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        message: 'Event pages built successfully',
                        output: stdout,
                        generatedFiles: stdout.match(/Generated (\d+) event pages/) ? 
                            parseInt(stdout.match(/Generated (\d+) event pages/)[1]) : 0,
                        firebaseStatus: stdout.includes('Firebase not initialized') ? 'not_initialized' : 
                                      stdout.includes('Firebase initialized successfully') ? 'initialized' : 'unknown',
                        hasEvents: !stdout.includes('No events found'),
                        environment: process.env.NETLIFY ? 'production' : 'development',
                        firebaseVars: {
                            FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ? 'SET' : 'NOT SET',
                            FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ? 'SET' : 'NOT SET',
                            FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? 'SET' : 'NOT SET'
                        }
                    })
                });
            });
        });

    } catch (error) {
        console.error('Event SSG Build: Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to start event SSG build',
                details: error.message
            })
        };
    }
}; 