const admin = require('firebase-admin');

// Version: 2025-01-27-v1 - Firestore-based settings function

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
    });
}

const db = admin.firestore();

exports.handler = async function (event, context) {
    console.log("get-settings function called");
    
    try {
        const queryParams = event.queryStringParameters || {};
        const settingKey = queryParams.key; // Optional: get specific setting

        if (settingKey) {
            // Get specific setting
            const setting = await getSpecificSetting(settingKey);
            
            if (!setting) {
                return {
                    statusCode: 404,
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-cache'
                    },
                    body: JSON.stringify({
                        error: 'Setting not found',
                        key: settingKey
                    })
                };
            }

            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
                },
                body: JSON.stringify({
                    key: settingKey,
                    value: setting.value,
                    updatedAt: setting.updatedAt
                })
            };
        } else {
            // Get all settings
            const settings = await getAllSettings();
            
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
                },
                body: JSON.stringify({
                    settings: settings,
                    totalCount: Object.keys(settings).length
                })
            };
        }

    } catch (error) {
        console.error('Error in get-settings:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message
            })
        };
    }
};

async function getSpecificSetting(key) {
    try {
        const settingsRef = db.collection('settings');
        const doc = await settingsRef.doc(key).get();
        
        if (!doc.exists) {
            return null;
        }
        
        const data = doc.data();
        return {
            key: key,
            value: data.value,
            description: data.description,
            updatedAt: data.updatedAt,
            updatedBy: data.updatedBy
        };
        
    } catch (error) {
        console.error('Error fetching specific setting:', error);
        return null;
    }
}

async function getAllSettings() {
    try {
        const settingsRef = db.collection('settings');
        const snapshot = await settingsRef.get();
        
        const settings = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            settings[doc.id] = {
                value: data.value,
                description: data.description,
                updatedAt: data.updatedAt,
                updatedBy: data.updatedBy
            };
        });
        
        return settings;
        
    } catch (error) {
        console.error('Error fetching all settings:', error);
        return {};
    }
}