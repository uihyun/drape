#!/usr/bin/env node
// Seed/rotate the marketing publisher tokens (marketingConfig/tokens).
// Values come from the Meta app dashboard token generators — see
// resources/marketing/README.md.
//
// Run:  node scripts/seed-marketing-tokens.cjs --from-file=/path/tokens.json
//       (JSON keys: igToken, igUserId, threadsToken — any subset; the file
//       should live outside the repo and be deleted after seeding, so the
//       token never touches argv/shell history)
// Auth: ADC (gcloud auth application-default login), project drape-9e532.

const path = require('path');
const fs = require('fs');
const admin = require(path.join(__dirname, '../functions/node_modules/firebase-admin'));

const fileArg = process.argv.find((a) => a.startsWith('--from-file='));
if (!fileArg) { console.error('usage: --from-file=/path/tokens.json'); process.exit(1); }
const input = JSON.parse(fs.readFileSync(fileArg.split('=')[1], 'utf8'));
const args = { 'ig-token': input.igToken, 'ig-user-id': input.igUserId, 'threads-token': input.threadsToken };

admin.initializeApp({ projectId: 'drape-9e532' });

(async () => {
  const patch = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
  if (args['ig-token']) { patch.igToken = args['ig-token']; patch.igRefreshedAt = admin.firestore.FieldValue.serverTimestamp(); }
  if (args['ig-user-id']) patch.igUserId = args['ig-user-id'];
  if (args['threads-token']) { patch.threadsToken = args['threads-token']; patch.threadsRefreshedAt = admin.firestore.FieldValue.serverTimestamp(); }
  if (Object.keys(patch).length === 1) { console.error('nothing to set — pass --ig-token / --ig-user-id / --threads-token'); process.exit(1); }
  await admin.firestore().doc('marketingConfig/tokens').set(patch, { merge: true });
  console.log('marketingConfig/tokens updated:', Object.keys(patch).filter((k) => k !== 'updatedAt').join(', '));
})();
