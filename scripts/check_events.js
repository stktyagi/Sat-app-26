const admin = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

admin.initializeApp();
const db = getFirestore();

async function main() {
  const snapshot = await db.collection('events').limit(1).get();
  snapshot.forEach(doc => {
    console.log(doc.data());
  });
  process.exit(0);
}
main();
