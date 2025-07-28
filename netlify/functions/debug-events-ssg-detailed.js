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
        console.log('Detailed Event SSG Debug: Starting diagnostic');
        
        // Collect diagnostic information
        const diagnostics = {
            timestamp: new Date().toISOString(),
            environment: {
                NODE_ENV: process.env.NODE_ENV,
                NETLIFY: process.env.NETLIFY,
                PWD: process.env.PWD,
                __dirname: __dirname
            },
            firebase: {
                FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ? 'SET' : 'NOT SET',
                FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ? 'SET' : 'NOT SET',
                FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? 'SET' : 'NOT SET'
            },
            cloudinary: {
                CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ? 'SET' : 'NOT SET'
            },
            paths: {},
            files: {},
            buildScript: {}
        };

        // Check paths
        const buildScriptPath = path.join(__dirname, '..', '..', 'build-events-ssg.js');
        const eventDir = path.join(__dirname, '..', '..', 'event');
        const templatePath = path.join(__dirname, '..', '..', 'event-template.html');
        
        diagnostics.paths = {
            buildScriptPath,
            eventDir,
            templatePath,
            currentDir: __dirname,
            projectRoot: path.join(__dirname, '..', '..')
        };

        // Check if files exist
        diagnostics.files = {
            buildScriptExists: fs.existsSync(buildScriptPath),
            eventDirExists: fs.existsSync(eventDir),
            templateExists: fs.existsSync(templatePath)
        };

        // List files in event directory if it exists
        if (diagnostics.files.eventDirExists) {
            try {
                const eventFiles = fs.readdirSync(eventDir);
                diagnostics.files.eventFiles = eventFiles.filter(f => f.endsWith('.html'));
            } catch (error) {
                diagnostics.files.eventDirError = error.message;
            }
        }

        // Test build script execution
        if (diagnostics.files.buildScriptExists) {
            try {
                console.log('Detailed Event SSG Debug: Testing build script execution');
                
                const result = await new Promise((resolve, reject) => {
                    const command = `node "${buildScriptPath}"`;
                    console.log('Detailed Event SSG Debug: Executing:', command);
                    
                    exec(command, { 
                        maxBuffer: 1024 * 1024 * 10,
                        timeout: 60000, // 1 minute timeout
                        cwd: path.join(__dirname, '..', '..'),
                        env: {
                            ...process.env,
                            FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
                            FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
                            FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
                            CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME
                        }
                    }, (error, stdout, stderr) => {
                        resolve({
                            error: error ? {
                                message: error.message,
                                code: error.code,
                                signal: error.signal
                            } : null,
                            stdout: stdout || '',
                            stderr: stderr || '',
                            exitCode: error ? error.code : 0
                        });
                    });
                });

                diagnostics.buildScript = {
                    executed: true,
                    exitCode: result.exitCode,
                    hasError: !!result.error,
                    error: result.error,
                    stdout: result.stdout,
                    stderr: result.stderr,
                    outputLength: result.stdout ? result.stdout.length : 0,
                    errorLength: result.stderr ? result.stderr.length : 0
                };

                // Check if any new files were created
                if (diagnostics.files.eventDirExists) {
                    try {
                        const afterFiles = fs.readdirSync(eventDir);
                        const afterHtmlFiles = afterFiles.filter(f => f.endsWith('.html'));
                        diagnostics.buildScript.filesAfterExecution = afterHtmlFiles;
                        diagnostics.buildScript.htmlFileCount = afterHtmlFiles.length;
                    } catch (error) {
                        diagnostics.buildScript.filesAfterError = error.message;
                    }
                }

            } catch (error) {
                diagnostics.buildScript = {
                    executed: false,
                    error: error.message
                };
            }
        } else {
            diagnostics.buildScript = {
                executed: false,
                error: 'Build script not found'
            };
        }

        // Check if we can access Firebase directly
        try {
            const admin = require('firebase-admin');
            let firebaseInitialized = false;
            
            try {
                admin.app();
                firebaseInitialized = true;
            } catch (error) {
                // Firebase not initialized, try to initialize
                if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
                    try {
                        admin.initializeApp({
                            credential: admin.credential.cert({
                                projectId: process.env.FIREBASE_PROJECT_ID,
                                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
                            })
                        });
                        firebaseInitialized = true;
                    } catch (initError) {
                        diagnostics.firebase.initializationError = initError.message;
                    }
                } else {
                    diagnostics.firebase.initializationError = 'Missing credentials';
                }
            }

            if (firebaseInitialized) {
                try {
                    const db = admin.firestore();
                    const eventsRef = db.collection('events');
                    const snapshot = await eventsRef.limit(5).get();
                    diagnostics.firebase.testQuery = {
                        success: true,
                        eventCount: snapshot.size,
                        hasEvents: snapshot.size > 0
                    };
                } catch (queryError) {
                    diagnostics.firebase.testQuery = {
                        success: false,
                        error: queryError.message
                    };
                }
            } else {
                diagnostics.firebase.testQuery = {
                    success: false,
                    error: 'Firebase not initialized'
                };
            }
        } catch (firebaseError) {
            diagnostics.firebase.testQuery = {
                success: false,
                error: firebaseError.message
            };
        }

        console.log('Detailed Event SSG Debug: Diagnostic complete');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Detailed diagnostic completed',
                diagnostics
            })
        };

    } catch (error) {
        console.error('Detailed Event SSG Debug: Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Diagnostic failed',
                details: error.message
            })
        };
    }
}; 