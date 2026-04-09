const admin = require('firebase-admin');

/**
 * Verifies the Firebase ID token in the Authorization header.
 * @param {Object} event - The Netlify function event object.
 * @returns {Promise<Object>} - The decoded token if valid.
 * @throws {Error} - If authentication fails.
 */
async function verifyAuth(event) {
    const authHeader = event.headers.authorization || event.headers.Authorization;

    if (!authHeader) {
        const error = new Error('Authentication required');
        error.statusCode = 401;
        throw error;
    }

    if (!authHeader.startsWith('Bearer ')) {
        const error = new Error('Invalid authorization format. Expected "Bearer <token>"');
        error.statusCode = 401;
        throw error;
    }

    const token = authHeader.split(' ')[1];

    try {
        // Ensure Firebase is initialized (it should be in the calling function, but safe to check)
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                }),
            });
        }

        const decodedToken = await admin.auth().verifyIdToken(token);
        return decodedToken;
    } catch (error) {
        console.error('Authentication error:', error.message);
        const authError = new Error('Invalid or expired token');
        authError.statusCode = 401;
        throw authError;
    }
}

module.exports = { verifyAuth };
