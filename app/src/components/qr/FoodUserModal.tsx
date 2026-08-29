import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../index";

interface FoodUserModalProps {
  visible: boolean;
  onClose: () => void;
  userData: UserGateData | null;
  selectedMeal: string | null;
  onUserDataUpdate?: (updatedData: UserGateData) => void;
}

/* Removed API call */

export default FoodUserModal;
