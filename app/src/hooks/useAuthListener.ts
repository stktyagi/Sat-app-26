import { useEffect } from "react";
import { getApp } from "@react-native-firebase/app";
import { getAuth, onAuthStateChanged } from "@react-native-firebase/auth";
import { useUserStore } from "@/state/userStore";
import { initializeGoogleSignIn, syncBackendSession } from "@/api/auth";

export const useAuthListener = () => {
  const { setAuthUser, setUserData, setAuthReady, clearUserState } = useUserStore();

  useEffect(() => {
    initializeGoogleSignIn();

    let unsubscribe = () => {};

    try {
      unsubscribe = onAuthStateChanged(getAuth(getApp()), async (user) => {
        if (!user) {
          clearUserState();
          setAuthReady(true);
          return;
        }

        setAuthUser(user);

        try {
          const session = await syncBackendSession(user);
          setUserData(session.user);
        } catch (error) {
          console.error("Failed to restore backend session:", error);
        } finally {
          setAuthReady(true);
        }
      });
    } catch (error) {
      console.error("Firebase Auth is not available. Use a development build.", error);
      setAuthReady(true);
    }

    return () => unsubscribe();
  }, [setAuthUser, setUserData, setAuthReady, clearUserState]);
};
