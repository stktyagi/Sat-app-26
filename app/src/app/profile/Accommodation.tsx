import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Header from "@/components/layout/Header";

// ─── Temporarily hidden — Accommodation coming soon ───────────────────────────
// import { useState, useEffect } from "react";
// import {
//   ScrollView,
//   TouchableOpacity,
//   TextInput,
//   ActivityIndicator,
//   StatusBar,
//   Platform,
//   KeyboardAvoidingView,
// } from "react-native";
// import { showAlert } from "@/components";
// import { useFocusEffect } from "expo-router";
// import { CheckCircle, Tag, Home } from "lucide-react-native";
// import { useUserStore } from "@/state/userStore";
// import { initializeEasebuzzCheckout } from "react-native-easebuzz-sdk";
// import Button from "@/components/ui/Button";
// import { useRouter } from "expo-router";
// ──────────────────────────────────────────────────────────────────────────────

/* Removed API call */

const AccommodationScreen = () => {
  // const router = useRouter();
  // const { userData: userProfile } = useUserStore();

  return (
    <View style={{ flex: 1, backgroundColor: "transparent" }}>
      <Header />

      {/* Coming Soon */}
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
        <Ionicons name="bed-outline" size={72} color="#FFBA00" />
        <Text
          style={{ fontFamily: "Outfit_700Bold", fontSize: 28, color: "#121212", marginTop: 24, marginBottom: 12 }}
        >
          Coming Soon
        </Text>
        <Text
          style={{ fontFamily: "Outfit_400Regular", fontSize: 15, color: "#2175C0", textAlign: "center" }}
        >
          Accommodation booking will be available shortly.{"\n"}Stay tuned!
        </Text>
      </View>
    </View>
  );
};

export default AccommodationScreen;
