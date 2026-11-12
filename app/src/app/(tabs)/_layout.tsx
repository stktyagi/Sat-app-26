import React from "react";
import { Tabs, Redirect } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  House,
  CalendarRange as Calendar,
  Play,
  User,
} from "lucide-react-native";
import { GlassView } from "expo-glass-effect";
import { useThemeStore } from "@/state/themeStore";
import { useAdminDrawerStore } from "@/state/adminDrawerStore";
import { useUserStore, hasCompletedProfile } from "@/state/userStore";
import AdminDrawer from "@/components/layout/AdminDrawer";
import { getUserRoles } from "@/utils/roles";

const ACTIVE_LOGO_COLOR = "#41B8F0";

const TAB_ICONS: Record<string, { label: string; Icon: React.ComponentType<any> }> = {
  index: { label: "Home", Icon: House },
  events: { label: "Events", Icon: Calendar },
  reels: { label: "Reels", Icon: Play },
  profile: { label: "Profile", Icon: User },
};

function CustomTabBar({
  state,
  descriptors,
  navigation,
  insets,
}: {
  state: any;
  descriptors: any;
  navigation: any;
  insets: any;
}) {
  const { isDark } = useThemeStore();

  const focusedOptions = descriptors[state.routes[state.index].key]?.options;
  if (
    focusedOptions?.tabBarStyle &&
    (focusedOptions.tabBarStyle as any)?.display === "none"
  ) {
    return null;
  }

  const inactiveColor = isDark
    ? "rgba(255, 255, 255, 0.45)"
    : "rgba(0, 0, 0, 0.4)";

  // Dark mode navbar: #212121 with glassmorphism
  // Light mode navbar: translucent with blur
  const navBgColor = isDark
    ? "rgba(33, 33, 33, 1)"
    : "rgba(255, 255, 255,1)";

  const navBorderColor = isDark
    ? "#FFFFFF33"
    : "rgba(0, 0, 0,1)";

  return (
    <View
      style={{
        position: "absolute",
        left: 14,
        right: 14,
        bottom: Math.max(insets.bottom, 12),
        height: 68,
        // Ambient glassmorphic shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: isDark ? 0.45 : 0.12,
        shadowRadius: 16,
        elevation: 10,
      }}
    >
      <View
        style={{
          flex: 1,
          borderRadius: 34,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: navBorderColor,
          backgroundColor: navBgColor,
        }}
      >
        {/* iOS Native Liquid Glass / Glass Effect */}
        <GlassView
          glassEffectStyle="regular"
          colorScheme={isDark ? "dark" : "light"}
          tintColor={isDark ? "rgba(33, 33, 33, 0.85)" : "rgba(255, 255, 255, 0.65)"}
          style={StyleSheet.absoluteFill}
        />

        {/* Tab Items Row */}
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-around",
            paddingHorizontal: 4,
          }}
        >
          {state.routes.map((route: any, index: number) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;
            const tabMeta = TAB_ICONS[route.name] || {
              label: options.title || route.name,
              Icon: House,
            };
            const IconComponent = tabMeta.Icon;
            const label = options.title !== undefined ? options.title : tabMeta.label;

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: "tabLongPress",
                target: route.key,
              });
            };

            // Active pill background: White stadium pill as shown in mockup
            const activePillBg = "#FFFFFF";

            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarButtonTestID}
                onPress={onPress}
                onLongPress={onLongPress}
                activeOpacity={0.75}
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                }}
              >
                {isFocused ? (
                  <View
                    style={{
                      width: 72,
                      height: 54,
                      borderRadius: 27,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 3 },
                      shadowOpacity: 0.22,
                      shadowRadius: 8,
                      elevation: 5,
                    }}
                  >
                    <View
                      style={{
                        flex: 1,
                        borderRadius: 27,
                        overflow: "hidden",
                        backgroundColor: activePillBg,
                        borderWidth: 1,
                        borderColor: "rgba(255, 255, 255, 0.6)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <IconComponent
                        size={21}
                        color={ACTIVE_LOGO_COLOR}
                        strokeWidth={2.5}
                        {...(route.name === "reels" ? { fill: ACTIVE_LOGO_COLOR } : {})}
                      />
                      <Text
                        style={{
                          fontFamily: "Poppins_600SemiBold",
                          fontSize: 10,
                          marginTop: 2,
                          color: ACTIVE_LOGO_COLOR,
                        }}
                        numberOfLines={1}
                      >
                        {label}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View
                    style={{
                      width: 72,
                      height: 54,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <IconComponent
                      size={21}
                      color={inactiveColor}
                      strokeWidth={1.8}
                    />
                    <Text
                      style={{
                        fontFamily: "Poppins_500Medium",
                        fontSize: 10,
                        marginTop: 2,
                        color: inactiveColor,
                      }}
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { isDark } = useThemeStore();
  const { isOpen, closeDrawer } = useAdminDrawerStore();
  const { userData, authUser, isAuthReady, isRehydrating } = useUserStore();

  if (isRehydrating || !isAuthReady) {
    return null;
  }
  if (!authUser) {
    return <Redirect href="/(auth)" />;
  }
  if (!hasCompletedProfile(userData)) {
    return <Redirect href="/(auth)/UserProfileFormScreen" />;
  }

  const userRoles = getUserRoles(userData);

  // iOS uses native UITabBar with SF symbols and native blur/haptics
  if (Platform.OS === "ios") {
    return (
      <>
        <NativeTabs
          backBehavior="initialRoute"
          tintColor={ACTIVE_LOGO_COLOR}
          labelStyle={{ fontFamily: "Poppins_500Medium", fontSize: 10 }}
        >
          <NativeTabs.Trigger
            name="index"
            contentStyle={{ backgroundColor: isDark ? "#131316" : "#E0E0E0" }}
          >
            <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon
              sf={{ default: "house", selected: "house.fill" }}
              md="home"
            />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger
            name="events"
            contentStyle={{ backgroundColor: isDark ? "#131316" : "#E0E0E0" }}
          >
            <NativeTabs.Trigger.Label>Events</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon
              sf={{ default: "calendar", selected: "calendar" }}
              md="calendar_month"
            />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger
            name="reels"
            contentStyle={{ backgroundColor: isDark ? "#131316" : "#E0E0E0" }}
          >
            <NativeTabs.Trigger.Label>Reels</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon
              sf={{ default: "play.rectangle", selected: "play.rectangle.fill" }}
              md="play_circle"
            />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger
            name="profile"
            contentStyle={{ backgroundColor: isDark ? "#131316" : "#E0E0E0" }}
          >
            <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon
              sf={{ default: "person", selected: "person.fill" }}
              md="person"
            />
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

  // Android uses custom floating glassmorphic Tabs
  return (
    <>
      <Tabs
        backBehavior="initialRoute"
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          sceneStyle: { backgroundColor: isDark ? "#131316" : "#E0E0E0" },
          headerShown: false,
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="events" options={{ title: "Events" }} />
        <Tabs.Screen name="reels" options={{ title: "Reels" }} />
        <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      </Tabs>

      <AdminDrawer
        visible={isOpen}
        onClose={closeDrawer}
        userRoles={userRoles}
      />
    </>
  );
}
