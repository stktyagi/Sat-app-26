import { useEffect } from "react";
import { getApp } from "@react-native-firebase/app";
import { getAuth, onAuthStateChanged } from "@react-native-firebase/auth";
import { useUserStore } from "@/state/userStore";
import { initializeGoogleSignIn, syncBackendSession } from "@/api/auth";

export const useAuthListener = () => {
  const { setAuthUser, setUserData, setAuthReady, setLoadingInitialData, clearUserState } = useUserStore();

  useEffect(() => {
    initializeGoogleSignIn();

    let unsubscribe = () => {};

    try {
      unsubscribe = onAuthStateChanged(getAuth(getApp()), async (user) => {
        if (!user) {
          clearUserState();
          setAuthReady(true);
          setLoadingInitialData(false);
          return;
        }

        setAuthUser(user);

        try {
          // Check if we already have the user data in our local Zustand cache
          const existingUserData = useUserStore.getState().userData;
          
          if (!existingUserData) {
            // Only hit the backend to sync session if we don't have the profile cached
            const session = await syncBackendSession(user);
            setUserData(session.user);
          }
        } catch (error) {
          console.error("Failed to restore backend session:", error);
        } finally {
          setAuthReady(true);
          setLoadingInitialData(false);
        }
      });
    } catch (error) {
      console.error("Firebase Auth is not available. Use a development build.", error);
      setAuthReady(true);
      setLoadingInitialData(false);
    }

    return () => unsubscribe();
  }, [setAuthUser, setUserData, setAuthReady, setLoadingInitialData, clearUserState]);
};
