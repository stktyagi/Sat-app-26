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
import * as FileSystem from "expo-file-system/legacy";

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
    try {
      await GoogleSignin.signOut();
    } catch (_) {}

    if (auth().currentUser) {
      await signOut(auth());
    }
  } catch (error: any) {
    if (error?.code !== "auth/no-current-user") {
      console.error("Sign out error:", error);
    }
  }
};

export const deleteAccount = async (): Promise<void> => {
  const firebaseUser = auth().currentUser;
  if (!firebaseUser) throw new Error("No authenticated user");

  const response = await authedFetch("/deleteuser", firebaseUser, { method: "POST" });
  if (!response.ok) {
    throw new Error(await readError(response, "Failed to delete account"));
  }

  try {
    await firebaseUser.delete();
  } catch (_) {
    // Backend already deleted user from Firebase Auth or session is invalidated
  }

  await handleSignOut();
};

export const uploadProfilePhoto = async (fileUri: string): Promise<UserProfile> => {
  const firebaseUser = auth().currentUser;
  if (!firebaseUser) throw new Error("No authenticated user");

  const idToken = await firebaseUser.getIdToken(false);

  if (Platform.OS === "web") {
    const resp = await fetch(fileUri);
    const blob = await resp.blob();
    const formData = new FormData();
    formData.append("file", blob, "photo.jpg");

    const res = await fetch(`${API_BASE_URL}/me/photo`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
      body: formData,
    });
    if (!res.ok) {
      throw new Error(await readError(res, "Failed to upload photo"));
    }
    const data = await res.json();
    return data.user;
  }

  const result = await FileSystem.uploadAsync(`${API_BASE_URL}/me/photo`, fileUri, {
    fieldName: "file",
    httpMethod: "POST",
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (result.status < 200 || result.status >= 300) {
    let errMsg = "Failed to upload photo";
    try {
      const parsed = JSON.parse(result.body);
      errMsg = parsed?.error?.message || parsed?.error || parsed?.message || errMsg;
    } catch (_) {}
    throw new Error(errMsg);
  }

  const data = JSON.parse(result.body);
  return data.user;
};

export const uploadCollegeId = async (fileUri: string): Promise<UserProfile> => {
  const firebaseUser = auth().currentUser;
  if (!firebaseUser) throw new Error("No authenticated user");

  const idToken = await firebaseUser.getIdToken(false);

  if (Platform.OS === "web") {
    const resp = await fetch(fileUri);
    const blob = await resp.blob();
    const formData = new FormData();
    formData.append("file", blob, "college-id.jpg");

    const res = await fetch(`${API_BASE_URL}/me/college-id`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
      body: formData,
    });
    if (!res.ok) {
      throw new Error(await readError(res, "Failed to upload college ID"));
    }
    const data = await res.json();
    return data.user;
  }

  const result = await FileSystem.uploadAsync(`${API_BASE_URL}/me/college-id`, fileUri, {
    fieldName: "file",
    httpMethod: "POST",
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (result.status < 200 || result.status >= 300) {
    let errMsg = "Failed to upload college ID";
    try {
      const parsed = JSON.parse(result.body);
      errMsg = parsed?.error?.message || parsed?.error || parsed?.message || errMsg;
    } catch (_) {}
    throw new Error(errMsg);
  }

  const data = JSON.parse(result.body);
  return data.user;
};

