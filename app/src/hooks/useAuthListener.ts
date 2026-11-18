import { useEffect } from "react";
import { getApp } from "@react-native-firebase/app";
import { getAuth, onAuthStateChanged } from "@react-native-firebase/auth";
import { useUserStore } from "@/state/userStore";
import { initializeGoogleSignIn } from "@/api/auth";

export const useAuthListener = () => {
  const { setAuthUser, syncBackendSession, setAuthReady, setLoadingInitialData, clearUserState } = useUserStore();

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
          const existingUserData = useUserStore.getState().userData;

          if (!existingUserData) {
            await syncBackendSession(user);
          } else {
            // Render the cached profile right away, but revalidate in the
            // background so role changes made while the app was closed apply.
            useUserStore.getState().refreshUserProfile().catch(() => {});
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
  }, [setAuthUser, syncBackendSession, setAuthReady, setLoadingInitialData, clearUserState]);
};
