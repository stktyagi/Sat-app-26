const admin = require("firebase-admin");
const serviceAccount = require("./backend/serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const message = {
  notification: {
    title: 'Background Push Test',
    body: 'You successfully received this in the system tray!'
  },
  topic: 'all_users' // The backend subscribes users to 'all_users'
};

async function send() {
  try {
    console.log("Sending in 5 seconds... quickly put the app in the background!");
    await new Promise(resolve => setTimeout(resolve, 5000));
    const response = await admin.messaging().send(message);
    console.log("Successfully sent message:", response);
  } catch (error) {
    console.error("Error sending message:", error);
  }
}

send();
