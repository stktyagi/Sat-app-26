import { Platform } from "react-native";
import {
  GoogleSignin,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { getApp } from "@react-native-firebase/app";
import {
  getAuth,
  signInWithCredential,
  signOut,
  GoogleAuthProvider,
  OAuthProvider,
} from "@react-native-firebase/auth";
import type { User as FirebaseUser } from "@react-native-firebase/auth";
import * as AppleAuthentication from "expo-apple-authentication";

import { API_BASE_URL, GOOGLE_WEB_CLIENT_ID } from "../config/api";
import { UserProfile } from "../types/models";

export const initializeGoogleSignIn = () => {
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
  });
};

const auth = () => getAuth(getApp());

const authedFetch = async (path: string, firebaseUser: FirebaseUser, init: RequestInit = {}) => {
  let idToken: string;
  try {
    idToken = await firebaseUser.getIdToken(true);
  } catch (error: any) {
    // Stale session — user was deleted from Firebase Auth. Sign out locally.
    if (error?.code === "auth/user-not-found" || error?.code === "auth/user-token-expired") {
      try { await signOut(auth()); } catch (_) { /* already signed out */ }
    }
    throw error;
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  return response;
};

const readError = async (response: Response, fallback: string) => {
  const errorData = await response.json().catch(() => ({} as any));
  // Backend returns { error: { code, message } }
  return errorData?.error?.message || errorData?.message || fallback;
};

export const syncBackendSession = async (
  firebaseUser: FirebaseUser
): Promise<{ user: UserProfile; created: boolean }> => {
  if (!firebaseUser) throw new Error("No user returned from Firebase Auth");

  const response = await authedFetch("/auth/session", firebaseUser, { method: "POST" });

  if (!response.ok) {
    throw new Error(await readError(response, "Failed to authenticate with backend"));
  }

  return response.json();
};

export const getToken = async (): Promise<string | null> => {
  const user = auth().currentUser;
  if (!user) return null;
  return user.getIdToken(false);
};

export const fetchCurrentUser = async (firebaseUser: FirebaseUser): Promise<UserProfile> => {
  const response = await authedFetch("/me", firebaseUser);

  if (!response.ok) {
    throw new Error(await readError(response, "Failed to load profile"));
  }

  const data = await response.json();
  return data.user;
};

export const handleGoogleSignIn = async (): Promise<{
  firebaseUser: FirebaseUser;
  profile: UserProfile;
  isFirstTime: boolean;
}> => {
  try {
    initializeGoogleSignIn();

    if (Platform.OS === "android") {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    const userInfo = await GoogleSignin.signIn();

    if (!isSuccessResponse(userInfo)) {
      throw new Error("SIGN_IN_CANCELLED");
    }

    const idToken = userInfo.data.idToken;
    if (!idToken) {
      throw new Error("No ID token received from Google");
    }

    const googleCredential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth(), googleCredential);

    if (!result.user) {
      throw new Error("No user returned from Firebase Auth");
    }

    const backendResult = await syncBackendSession(result.user);

    return {
      firebaseUser: result.user,
      profile: backendResult.user,
      isFirstTime: backendResult.created,
    };
  } catch (error: any) {
    if (
      error?.message === "SIGN_IN_CANCELLED" ||
      error?.code === statusCodes.SIGN_IN_CANCELLED
    ) {
      throw new Error("SIGN_IN_CANCELLED");
    }
    console.error("Google Sign-In error:", {
      message: error?.message,
      code: error?.code,
      statusCode: error?.statusCode,
      toString: error?.toString?.(),
    });
    throw error;
  }
};

export const handleAppleSignIn = async (): Promise<{
  firebaseUser: FirebaseUser;
  profile: UserProfile;
  isFirstTime: boolean;
}> => {
  try {
    const appleAuthRequestResponse = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    const { identityToken } = appleAuthRequestResponse;
    if (!identityToken) {
      throw new Error("No identity token received from Apple");
    }

    const appleProvider = new OAuthProvider("apple.com");
    const appleCredential = appleProvider.credential({ idToken: identityToken });
    const result = await signInWithCredential(auth(), appleCredential);

    if (!result.user) {
      throw new Error("No user returned from Firebase Auth");
    }

    const backendResult = await syncBackendSession(result.user);

    return {
      firebaseUser: result.user,
      profile: backendResult.user,
      isFirstTime: backendResult.created,
    };
  } catch (error: any) {
    if (error.code === "ERR_REQUEST_CANCELED") {
      throw new Error("SIGN_IN_CANCELLED");
    }
    console.error("Apple Sign-In error:", error?.message || error);
    throw error;
  }
};

export const handleSignOut = async (): Promise<void> => {
  try {
    initializeGoogleSignIn();
    await GoogleSignin.signOut();
    await signOut(auth());
  } catch (error) {
    console.error("Sign out error:", error);
  }
};
