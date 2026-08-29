import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { getApp } from "@react-native-firebase/app";
import authModule, { getAuth, signInWithCredential, signOut, getIdToken, GoogleAuthProvider, OAuthProvider } from "@react-native-firebase/auth";
import * as AppleAuthentication from "expo-apple-authentication";
import { Platform } from "react-native";
// import { UserProfile } from "../types/models"; // Assume this exists or will be created

import { API_BASE_URL, GOOGLE_WEB_CLIENT_ID } from "../config/api";

export const initializeGoogleSignIn = () => {
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: true,
  });
};

/**
 * Handles backend authentication and profile synchronization
 */
export const syncBackendSession = async (firebaseUser: any): Promise<{ user: any, created: boolean }> => {
  if (!firebaseUser) throw new Error("No user returned from Firebase Auth");
  
  const idToken = await getIdToken(firebaseUser, true);
  
  const response = await fetch(`${API_BASE_URL}/auth/session`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${idToken}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to authenticate with backend");
  }

  return await response.json(); // returns { user: UserProfile, created: boolean }
};

export const handleGoogleSignIn = async (): Promise<{
  firebaseUser: any;
  profile: any;
  isFirstTime: boolean;
}> => {
  try {
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();
    
    if (!userInfo.data?.idToken) {
      throw new Error("No ID token received");
    }

    const app = getApp();
    const auth = getAuth(app);
    const googleCredential = GoogleAuthProvider.credential(userInfo.data.idToken);
    const result = await signInWithCredential(auth, googleCredential);

    const backendResult = await syncBackendSession(result.user);

    return { 
      firebaseUser: result.user, 
      profile: backendResult.user, 
      isFirstTime: backendResult.created 
    };

  } catch (error: any) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error("SIGN_IN_CANCELLED");
    }
    console.error("Google Sign-In error:", error?.message || error);
    throw error;
  }
};

export const handleAppleSignIn = async (): Promise<{
  firebaseUser: any;
  profile: any;
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

    const app = getApp();
    const auth = getAuth(app);
    const appleProvider = new OAuthProvider('apple.com');
    const appleCredential = appleProvider.credential({ idToken: identityToken });
    const result = await signInWithCredential(auth, appleCredential);

    const backendResult = await syncBackendSession(result.user);

    return { 
      firebaseUser: result.user, 
      profile: backendResult.user, 
      isFirstTime: backendResult.created 
    };

  } catch (error: any) {
    if (error.code === 'ERR_REQUEST_CANCELED') {
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
    const app = getApp();
    const auth = getAuth(app);
    await signOut(auth);
  } catch (error) {
    console.error("Sign out error:", error);
  }
};

export const checkAuthStatus = (): boolean => {
  const app = getApp();
  const auth = getAuth(app);
  return auth.currentUser !== null;
};
