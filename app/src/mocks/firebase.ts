// Mock for @react-native-firebase/*
export const getApp = () => ({});
export const getAuth = () => ({ currentUser: null, signInWithCredential: () => {}, onAuthStateChanged: () => () => {} });
export const getFirestore = () => ({});
export const collection = () => ({});
export const addDoc = async () => ({});
export const getDocs = async () => ({ docs: [] });
export const doc = () => ({});
export const updateDoc = async () => ({});
export const deleteDoc = async () => ({});
export const setDoc = async () => ({});
export const query = () => ({});
export const orderBy = () => ({});
export const getDoc = async () => ({ exists: false, data: () => ({}) });
export const getIdToken = async () => "mock-token";
export class AppleAuthProvider {
  static credential = () => ({});
}
export const Timestamp = { now: () => ({ toDate: () => new Date() }) };

export default {
  getApp,
  getAuth,
  getFirestore,
};
