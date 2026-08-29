import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { showAlert } from "@/components";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { CheckCircle, Tag, Home } from "lucide-react-native";
import { useUserStore } from "@/state/userStore";
import { initializeEasebuzzCheckout } from "react-native-easebuzz-sdk";
import Button from "@/components/ui/Button";
import Header from "@/components/layout/Header";
import { useRouter } from "expo-router";

/* Removed API call */

const AccommodationScreen = () => {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Accommodation Screen (Under Construction)</Text>
    </View>
  );
};

export default AccommodationScreen;
