const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();

const db = getFirestore();

async function main() {
  try {
    const eventsSnapshot = await db.collection('events').get();
    
    // Firestore batch limit is 500, we have around 60 events so one batch is fine.
    const batch = db.batch();
    
    let count = 0;
    
    eventsSnapshot.forEach(doc => {
      const days = [21, 22, 23];
      const randomDay = days[Math.floor(Math.random() * days.length)];
      
      // We want time between 9 AM and 8 PM IST.
      // 9 AM IST = 03:30 UTC. 8 PM IST = 14:30 UTC.
      // Let's pick a random hour between 9 and 19 (in IST).
      const startHourIST = Math.floor(Math.random() * 11) + 9; 
      const endHourIST = startHourIST + 1; // 1 hour duration
      
      // Registration deadline is 21 November 2026, let's say 23:59:59 IST (which is 18:29:59 UTC)
      const registrationDeadline = '2026-11-21T18:29:59.000Z';
      
      // Calculate UTC hours for start and end
      let startHourUTC = startHourIST - 5;
      let startMinUTC = 30; // since IST is +5:30, 9 AM IST is 3:30 AM UTC.
      
      let endHourUTC = endHourIST - 5;
      let endMinUTC = 30;
      
      const pad = (num) => num.toString().padStart(2, '0');
      
      const startDateTime = `2026-11-${pad(randomDay)}T${pad(startHourUTC)}:${pad(startMinUTC)}:00.000Z`;
      const endDateTime = `2026-11-${pad(randomDay)}T${pad(endHourUTC)}:${pad(endMinUTC)}:00.000Z`;
      
      const eventRef = db.collection('events').doc(doc.id);
      
      batch.update(eventRef, {
        startDateTime,
        endDateTime,
        registrationDeadline,
        updatedAt: new Date().toISOString()
      });
      
      count++;
    });
    
    await batch.commit();
    console.log(`Successfully updated ${count} events with mocked dates.`);
    process.exit(0);
  } catch (error) {
    console.error("Error updating events:", error);
    process.exit(1);
  }
}

main();
