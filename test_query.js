const admin = require("firebase-admin");
const serviceAccount = require("./backend/serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();
async function test() {
  try {
    const snapshot = await db.collection("registrations").where("userId", "==", "test_user").orderBy("registeredAt", "desc").get();
    console.log("Success:", snapshot.size);
  } catch(e) {
    console.error(e.message);
  }
}
test();
