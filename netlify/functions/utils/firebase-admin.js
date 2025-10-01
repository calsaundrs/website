const admin = require('firebase-admin');

function initializeFirebase() {
  if (admin.apps.length) {
    return admin;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.warn('⚠️ Firebase service account environment variables are not set. Firestore access will be disabled for this process.');
    return {
      firestore: () => ({
        collection: () => ({
          add: async () => ({}),
          doc: () => ({
            get: async () => ({ exists: false, data: () => ({}) }),
            update: async () => {},
          }),
        }),
      }),
      apps: [],
    };
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error) {
    console.error('Failed to initialize Firebase admin:', error.message);
    throw error;
  }

  return admin;
}

module.exports = {
  admin: initializeFirebase(),
  initializeFirebase,
};


