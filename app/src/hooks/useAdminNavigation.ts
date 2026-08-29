import { useRouter } from "expo-router";

export function useAdminNavigation() {
  const router = useRouter();

  return {
    goBack: () => {
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)");
    },
    navigate: (name: string, params?: Record<string, any>) => {
      if (name === "Dashboard") {
        if (router.canGoBack()) router.back();
        else router.replace("/(tabs)");
        return;
      }
      if (name === "AdminEventDetails") {
        router.push({
          pathname: "/admin/EventDetails",
          params: {
            eventId: params?.eventId,
            event: params?.event ? JSON.stringify(params.event) : undefined,
          },
        } as any);
        return;
      }
      router.push(`/admin/${name}` as any);
    },
  };
}
