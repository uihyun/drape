// Central place for the Cloud Functions base URL. Some legacy services
// reach the v2 HTTP endpoints by URL (rather than via httpsCallable + the
// Firebase Functions SDK), so they need to know the project id.
//
// When you set up the drape Firebase project, paste its id into FIREBASE_PROJECT_ID.
// Or override per-build with VITE_FIREBASE_PROJECT_ID in .env.

const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'REPLACE_ME_DRAPE_PROJECT';
const REGION = import.meta.env.VITE_FIREBASE_REGION || 'us-central1';

export const FUNCTIONS_BASE = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net`;

export function fnUrl(name) {
  return `${FUNCTIONS_BASE}/${name}`;
}
