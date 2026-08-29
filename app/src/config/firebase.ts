import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';

const app = getApp(); // default Firebase app instance

export const authInstance = getAuth(app);
