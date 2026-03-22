const fs = require('fs');
let rawKeyData = fs.readFileSync('/tmp/key.txt', 'utf8').trim();
let serviceAccount;

try {
  serviceAccount = JSON.parse(rawKeyData);
} catch (e) {
  try {
     const { execSync } = require('child_process');
     const email = execSync('netlify env:get FIREBASE_CLIENT_EMAIL').toString().trim();
     const projectId = execSync('netlify env:get FIREBASE_PROJECT_ID').toString().trim();
     let formattedKey = rawKeyData.replace(/\\n/g, '\n');
     if (!formattedKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
         formattedKey = formattedKey.replace(/^['"]|['"]$/g, '');
         formattedKey = formattedKey.replace(/\\n/g, '\n');
     }

     serviceAccount = { projectId, clientEmail: email, privateKey: formattedKey };
  } catch (e2) {
      process.exit(1);
  }
}

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function run() {
  const eventsRef = db.collection('events');
  // the-fox-202 rainbow book club
  await eventsRef.doc('hG1Z1MqunaJ2w2FBd5BT').delete();
  await eventsRef.doc('jHvqmzrBhjV6718aV6La').delete();

  // undefined werking men's club
  await eventsRef.doc('jmVVTBU69mAAwE6cRc8h').delete();
  await eventsRef.doc('zGbpsEBcfLJJb7jJv1wP').delete();
  
  // undefined The Fox and Goose bingo (duplicate)
  await eventsRef.doc('CxbC64OmIhmSRtJu5HUk').delete();
  await eventsRef.doc('GkJwjs5TbrleMeWKlBQz').delete();

  // "EVAL7UaGMdkHCNbDtRcL" -> "Working Men's club" correctly tied into Fox ID. Leave alone.
  // "recbz2uGFXTNy3xig" -> "LGBT+ Craft Fayre" "The Fox & Equator Bar" - Leave for now unless asked to remap.

  console.log('Duplicates deleted');
}

run().catch(console.error);
