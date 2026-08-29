// src/utils/debugVersion.ts
// Debug utility to test Firebase version and maintenance checks
import { Platform } from 'react-native';

/**
 * Debug function to manually check Firebase maintenance document
 */
export async function debugMaintenanceCheck() {
  try {
    console.log('========== DEBUG MAINTENANCE CHECK ==========');
    /* Removed Firebase API call */
    /* Removed Firebase API call */

    console.log('Firebase app initialized:', !!app);
    console.log('Firestore instance:', !!firestore);
    console.log('Attempting to read path: app/maintenance');

    /* Removed Firebase API call */
    console.log('Document reference created:', !!docRef);
    console.log('Document path:', docRef.path);

    /* Removed Firebase API call */

    console.log('Document exists:', maintenanceDoc.exists());
    console.log('Document ID:', maintenanceDoc.id);

    if (maintenanceDoc.exists()) {
      const data = maintenanceDoc.data();
      console.log('Raw document data:', JSON.stringify(data, null, 2));
      console.log('Platform:', Platform.OS);
      console.log(`Value for ${Platform.OS}:`, data?.[Platform.OS]);
      console.log('Type:', typeof data?.[Platform.OS]);
    } else {
      console.log('❌ DOCUMENT DOES NOT EXIST!');
      console.log('Expected path: app/maintenance');
      console.log('Please verify:');
      console.log('  1. Collection name is "app" (lowercase)');
      console.log('  2. Document ID is "maintenance" (lowercase)');
      console.log('  3. Firestore security rules allow read access');
    }

    console.log('============================================');
    return maintenanceDoc.exists();
  } catch (error: any) {
    console.error('❌ DEBUG maintenance check failed:', error);
    console.error('Error name:', error?.name);
    console.error('Error message:', error?.message);
    console.error('This might be a permissions issue or network error');
    return false;
  }
}

/**
 * Debug function to manually check Firebase versions document
 */
export async function debugVersionCheck() {
  try {
    console.log('========== DEBUG VERSION CHECK ==========');
    /* Removed Firebase API call */
    /* Removed Firebase API call */
    console.log('Attempting to read path: app/versions');

    /* Removed Firebase API call */
    console.log('Document reference created:', !!docRef);
    console.log('Document path:', docRef.path);

    /* Removed Firebase API call */

    console.log('Document exists:', versionsDoc.exists());
    console.log('Document ID:', versionsDoc.id);

    if (versionsDoc.exists()) {
      const data = versionsDoc.data();
      console.log('Raw document data:', JSON.stringify(data, null, 2));
      console.log('Platform:', Platform.OS);
      console.log(`Version for ${Platform.OS}:`, data?.[Platform.OS]);
      console.log('Type:', typeof data?.[Platform.OS]);
    } else {
      console.log('❌ DOCUMENT DOES NOT EXIST!');
      console.log('Expected path: app/versions');
      console.log('Please verify:');
      console.log('  1. Collection name is "app" (lowercase)');
      console.log('  2. Document ID is "versions" (lowercase)');
      console.log('  3. Document contains platform keys (android/ios)');
    }

    console.log('=========================================');
    return versionsDoc.exists();
  } catch (error: any) {
    console.error('❌ DEBUG version check failed:', error);
    console.error('Error name:', error?.name);
    console.error('Error message:', error?.message);
    return false;
  }
}

/**
 * Run all debug checks
 */
export async function runAllDebugChecks() {
  console.log('\n\n========== STARTING ALL DEBUG CHECKS ==========\n');
  await debugMaintenanceCheck();
  console.log('\n');
  await debugVersionCheck();
  console.log('\n========== DEBUG CHECKS COMPLETE ==========\n\n');
}
