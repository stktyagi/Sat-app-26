import React from "react";
import { Tabs } from "expo-router";
import { Image, View } from "react-native";
import {
  House,
  CalendarRange as Calendar,
  Play,
  Store,
  User,
} from "lucide-react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        sceneStyle: { backgroundColor: '#DBE2ED' },
        headerShown: false,
        tabBarBackground: () => (
          <View style={{ flex: 1, borderRadius: 50, overflow: 'hidden', backgroundColor: '#2D4593' }}>
            <Image
              source={require("@/assets/mosaic.png")}
              style={{ width: '100%', height: '150%', resizeMode: 'cover', position: 'absolute', top: -50, transform: [{ scale: 1.5 }] }}
            />
          </View>
        ),
        tabBarStyle: {
          zIndex: 10,
          position: "absolute",
          marginHorizontal: 12,
          marginVertical: 15,
          height: 70,
          backgroundColor: "transparent",
          paddingHorizontal: 18,
          borderRadius: 50,
          borderTopWidth: 0,
          paddingBottom: 0,
          paddingTop: 6,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontFamily: "Outfit_600SemiBold",
          fontSize: 12,
          fontWeight: "600",
        },
        tabBarActiveTintColor: "#EEB170",
        tabBarInactiveTintColor: "#FFFFFF",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <House size={26} color={"#232323"} fill={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarIcon: ({ color }) => <Calendar size={26} color={"#232323"} fill={color} />,
        }}
      />
      <Tabs.Screen
        name="reels"
        options={{
          title: "Reels",
          tabBarIcon: ({ color }) => <Play size={26} color={"#232323"} fill={color} />,
        }}
      />
      <Tabs.Screen
        name="store"
        options={{
          title: "Store",
          tabBarIcon: ({ color }) => <Store size={26} color={"#232323"} fill={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <User size={26} color={"#232323"} fill={color} />,
        }}
      />
    </Tabs>
  );
}
