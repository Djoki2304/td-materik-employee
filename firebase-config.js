const FIREBASE_CONFIG = {
  projectId: 'materic-id',
  appId: '1:752688427389:web:a680d034b07b0a01345c14',
  storageBucket: 'materic-id.firebasestorage.app',
  apiKey: 'AIzaSyBanj1sH_u-oPn7Osdh2yZAo6e5FS67kMc',
  authDomain: 'materic-id.firebaseapp.com',
  messagingSenderId: '752688427389',
  measurementId: 'G-71N2MMM8L9'
};

// Публичный VAPID-ключ (не секрет) — приватная пара хранится только в Cloudflare Worker.
const VAPID_PUBLIC_KEY = 'BMJy_aSdax_Dgu6Ko04PGb_x67yP7CztbGkQGLSYu-S2CUcoFnq_WvSyX40F29sifFDqVQIKeS1XIW9yr-M1EXo';

firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db = firebase.firestore();
// Safari/WebKit's default streaming transport trips a known Firestore SDK bug
// ("INTERNAL ASSERTION FAILED: Unexpected state") — long-polling avoids it.
db.settings({ experimentalAutoDetectLongPolling: true });
