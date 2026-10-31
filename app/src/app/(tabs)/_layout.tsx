import React from "react";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useThemeStore } from "@/state/themeStore";
import { useAdminDrawerStore } from "@/state/adminDrawerStore";
import { useUserStore } from "@/state/userStore";
import AdminDrawer from "@/components/layout/AdminDrawer";
import { getUserRoles } from "@/utils/roles";

const ACTIVE_LOGO_COLOR = "#41B8F0";

export default function TabLayout() {
  const { isDark } = useThemeStore();
  const { isOpen, closeDrawer } = useAdminDrawerStore();
  const { userData } = useUserStore();

  const userRoles = getUserRoles(userData);

  // Native UITabBar (liquid glass on iOS 26): system sizing, insets and haptics for free.
  return (
    <>
      <NativeTabs
        backBehavior="initialRoute"
        tintColor={ACTIVE_LOGO_COLOR}
        labelStyle={{ fontFamily: "Poppins_500Medium", fontSize: 10 }}
      >
        <NativeTabs.Trigger name="index" contentStyle={{ backgroundColor: isDark ? "#131316" : "#E0E0E0" }}>
          <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="events" contentStyle={{ backgroundColor: isDark ? "#131316" : "#E0E0E0" }}>
          <NativeTabs.Trigger.Label>Events</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: "calendar", selected: "calendar" }} md="calendar_month" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="reels" contentStyle={{ backgroundColor: isDark ? "#131316" : "#E0E0E0" }}>
          <NativeTabs.Trigger.Label>Reels</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: "play.rectangle", selected: "play.rectangle.fill" }} md="play_circle" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile" contentStyle={{ backgroundColor: isDark ? "#131316" : "#E0E0E0" }}>
          <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: "person", selected: "person.fill" }} md="person" />
        </NativeTabs.Trigger>
      </NativeTabs>

      <AdminDrawer
        visible={isOpen}
        onClose={closeDrawer}
        userRoles={userRoles}
      />
    </>
  );
}
