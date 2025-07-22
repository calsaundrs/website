const fetch = require('node-fetch');
const parser = require('lambda-multipart-parser');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
try {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            }),
        });
    }
} catch (error) {
    console.error("Firebase Admin Initialization Error:", error);
}
const db = admin.firestore();

// Helper to get Gemini model name from Firestore
async function getGeminiModelName() {
    try {
        const doc = await db.collection('settings').doc('gemini').get();
        if (doc.exists && doc.data().modelName) {
            return doc.data().modelName;
        }
    } catch (error) {
        console.error("Error fetching Gemini model from Firestore:", error);
    }
    return 'gemini-2.5-flash';
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

exports.handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Parse multipart form data
        const boundary = event.headers['content-type'].split('boundary=')[1];
        const body = Buffer.from(event.body, 'base64');
        
        // Simple multipart parser for the poster file
        const parts = body.toString().split(`--${boundary}`);
        let posterFile = null;
        
        for (const part of parts) {
            if (part.includes('Content-Type: image/')) {
                const lines = part.split('\r\n');
                const contentStart = lines.findIndex(line => line === '') + 1;
                const content = lines.slice(contentStart, -1).join('\r\n');
                posterFile = Buffer.from(content, 'binary');
                break;
            }
        }
        
        if (!posterFile) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'No poster file found' })
            };
        }

        // For now, we'll simulate AI processing since we don't have Vision API set up
        // In a real implementation, you'd use Google Cloud Vision API here
        
        // Simulate extracted data
        const extractedData = {
            eventName: "Sample Event Name",
            date: "2024-08-15",
            time: "20:00",
            description: "Sample event description extracted from poster"
        };
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                extractedData: extractedData
            })
        };

    } catch (error) {
        console.error('Error processing poster:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: 'Failed to process poster'
            })
        };
    }
};
