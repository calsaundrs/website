// Test script for migration function
const { handler } = require('./netlify/functions/full-migration.js');

// Mock environment variables for testing
process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN = 'test-token';
process.env.AIRTABLE_BASE_ID = 'test-base';
process.env.FIREBASE_PROJECT_ID = 'test-project';
process.env.FIREBASE_CLIENT_EMAIL = 'test@example.com';
process.env.FIREBASE_PRIVATE_KEY = 'test-key';

// Test the handler
async function testMigration() {
    try {
        console.log('Testing migration function...');
        const result = await handler({
            httpMethod: 'POST',
            body: JSON.stringify({ token: 'test-token' })
        }, {});
        
        console.log('Migration result:', result);
    } catch (error) {
        console.error('Migration error:', error);
    }
}

testMigration();