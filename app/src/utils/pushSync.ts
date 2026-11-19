// Keeps this device's push token registered with the backend and lets silent
// "profile_updated" pushes trigger a profile refetch (so role changes show up live).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { getMessaging, getToken } from '@react-native-firebase/messaging';
import { API_BASE_URL } from '@/config/api';
import { deleteFCMToken } from '@/utils/fcm';

const PROFILE_STALE_KEY = 'profileStale';

async function postToken(path: string, fcmToken: string): Promise<boolean> {
  const firebaseUser = getAuth(getApp()).currentUser;
  if (!firebaseUser) return false;
  const idToken = await firebaseUser.getIdToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ fcmToken }),
  });
  return res.ok;
}

export async function registerPushToken(fcmToken: string): Promise<void> {
  try {
    const ok = await postToken('/me/fcm-token', fcmToken);
    if (!ok) console.warn('Failed to register FCM token with backend');
  } catch (e) {
    console.error('Failed to register FCM token with backend:', e);
  }
}

/** Detach this device from the signed-in account. Call before Firebase signOut. */
export async function unregisterPushToken(): Promise<void> {
  try {
    const token = await getToken(getMessaging());
    if (token) await postToken('/me/fcm-token/remove', token);
  } catch (e) {
    console.warn('Failed to unregister FCM token:', e);
  }
  await deleteFCMToken();
}

export function isProfileUpdateMessage(data?: Record<string, unknown>): boolean {
  return data?.type === 'profile_updated';
}

/** Used by the background handler, where the store/UI may not be alive. */
export async function markProfileStale(): Promise<void> {
  try {
    await AsyncStorage.setItem(PROFILE_STALE_KEY, '1');
  } catch {}
}

export async function consumeProfileStale(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(PROFILE_STALE_KEY);
    if (v) await AsyncStorage.removeItem(PROFILE_STALE_KEY);
    return !!v;
  } catch {
    return false;
  }
}
