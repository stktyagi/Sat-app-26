import { useUserStore } from "@/state/userStore";

export const useAuth = () => {
  const { authUser, userData, isAuthReady } = useUserStore();

  return {
    user: authUser,
    userProfile: userData,
    isLoading: !isAuthReady,
    isAuthenticated: !!authUser,
  };
};
