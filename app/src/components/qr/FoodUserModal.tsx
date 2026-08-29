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
import {
  UserGateData,
  getCurrentEventDay,
  updateUserMealStatus,
  checkMealAvailability,
} from "@/api/admin";
import { showAlert } from "@/components";

interface FoodUserModalProps {
  visible: boolean;
  onClose: () => void;
  userData: UserGateData | null;
  selectedMeal: string | null;
  onUserDataUpdate?: (updatedData: UserGateData) => void;
}

const FoodUserModal: React.FC<FoodUserModalProps> = ({
  visible,
  onClose,
  userData,
  selectedMeal,
  onUserDataUpdate,
}) => {
  const [loading, setLoading] = useState(false);
  const [currentUserData, setCurrentUserData] = useState<UserGateData | null>(
    userData
  );
  const [mealAvailable, setMealAvailable] = useState<boolean | null>(null);
  const [availabilityMessage, setAvailabilityMessage] = useState<string>("");
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Update local state when userData prop changes
  React.useEffect(() => {
    setCurrentUserData(userData);
  }, [userData]);

  // Check meal availability when modal opens
  React.useEffect(() => {
    const checkAvailability = async () => {
      if (currentUserData && selectedMeal) {
        const currentDay = getCurrentEventDay();
        const mealIndex = getMealIndex(selectedMeal);

        const result = await checkMealAvailability(
          currentUserData.userId,
          currentDay,
          mealIndex
        );

        setMealAvailable(result.available);
        setAvailabilityMessage(result.message);
      }
    };

    if (visible && currentUserData && selectedMeal) {
      checkAvailability();
    }
  }, [visible, currentUserData, selectedMeal]);

  if (!currentUserData || !selectedMeal) return null;

  // Get meal index (0: breakfast, 1: lunch, 2: dinner)
  const getMealIndex = (meal: string) => {
    switch (meal.toLowerCase()) {
      case "breakfast":
        return 0;
      case "lunch":
        return 1;
      case "dinner":
        return 2;
      default:
        return 0;
    }
  };

  const handleProvideMeal = async () => {
    if (!currentUserData || !selectedMeal) return;

    setLoading(true);
    try {
      const currentDay = getCurrentEventDay();
      const mealIndex = getMealIndex(selectedMeal);

      const result = await updateUserMealStatus(
        currentUserData.userId,
        currentDay,
        mealIndex
      );

      if (result.success) {
        // Update local availability state
        setMealAvailable(false);
        setAvailabilityMessage(`${selectedMeal} has been provided`);

        // Show success banner
        setSuccessMessage(`${selectedMeal} provided successfully to ${currentUserData.displayName}!`);
        setUpdateSuccess(true);

        // Auto close modal after showing success
        setTimeout(() => {
          setUpdateSuccess(false);
          onClose();
        }, 2000);
      } else {
        showAlert(
          result.error || "Update Failed",
          result.message || "Failed to update meal status"
        );
      }
    } catch (error) {
      showAlert("Error", "Failed to update meal status. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const mealEmoji = {
    breakfast: "🍳",
    lunch: "🍽️",
    dinner: "🍽️",
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-center items-center px-6">
        <View className="bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-sm border border-[#2C2C2C] max-h-[80%]">
          {/* Success Banner */}
          {updateSuccess && (
            <View className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 mb-4">
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className="text-green-400 text-center"
              >
                ✓ {successMessage}
              </Text>
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View className="items-center mb-6">
              <View className="w-20 h-20 bg-[#F59E0B] rounded-full items-center justify-center mb-4">
                <Text className="text-4xl">
                  {mealEmoji[selectedMeal as keyof typeof mealEmoji]}
                </Text>
              </View>
              <Text
                style={{ fontFamily: "Outfit_700Bold" }}
                className="text-white text-2xl mb-2 text-center"
              >
                {currentUserData.displayName}
              </Text>
              <View className="bg-[#2C2C2C] rounded-full px-3 py-1 mb-2">
                <Text className="text-gray-300 text-sm">Food Collection</Text>
              </View>
              <View className="bg-[#FFBA00] rounded-full px-4 py-2">
                <Text className="text-[#121212] text-sm font-semibold capitalize">
                  {getCurrentEventDay()} - {selectedMeal}
                </Text>
              </View>
            </View>

            {/* User Information */}
            <View className="gap-4">
              {/* Email */}
              <View className="bg-[#2C2C2C] rounded-xl p-4">
                <Text className="text-gray-400 text-sm mb-1">Email</Text>
                <Text
                  style={{ fontFamily: "Outfit_500Medium" }}
                  className="text-white text-base"
                >
                  {currentUserData.email}
                </Text>
              </View>

              {/* College */}
              <View className="bg-[#2C2C2C] rounded-xl p-4">
                <Text className="text-gray-400 text-sm mb-1">College</Text>
                <Text
                  style={{ fontFamily: "Outfit_500Medium" }}
                  className="text-white text-base"
                >
                  {currentUserData.collegeName}
                </Text>
              </View>

              {/* Meal Status */}
              <View className="bg-[#2C2C2C] rounded-xl p-4">
                <Text className="text-gray-400 text-sm mb-3">
                  {selectedMeal.charAt(0).toUpperCase() + selectedMeal.slice(1)}{" "}
                  Status
                </Text>

                {mealAvailable === null ? (
                  <View className="items-center">
                    <ActivityIndicator size="small" color="#FFBA00" />
                    <Text className="text-gray-400 text-sm mt-2">
                      Checking availability...
                    </Text>
                  </View>
                ) : mealAvailable ? (
                  <View className="items-center">
                    <View className="bg-green-500/20 px-4 py-2 rounded-full mb-4">
                      <Text className="text-green-400 text-sm font-semibold">
                        ✅ Meal Available
                      </Text>
                    </View>

                    <TouchableOpacity
                      className="bg-[#F59E0B] py-4 px-8 rounded-xl w-full"
                      onPress={handleProvideMeal}
                      disabled={loading}
                      activeOpacity={0.7}
                    >
                      <Text className="text-[#121212] text-center font-bold text-base">
                        {loading
                          ? "Processing..."
                          : `Provide ${
                              selectedMeal.charAt(0).toUpperCase() +
                              selectedMeal.slice(1)
                            }`}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View className="items-center">
                    <View className="bg-red-500/20 px-4 py-2 rounded-full mb-4">
                      <Text className="text-red-400 text-sm font-semibold">
                        ❌ Meal Not Available
                      </Text>
                    </View>

                    <View className="bg-red-500/20 p-4 rounded-xl w-full">
                      <Text className="text-red-400 text-center text-sm">
                        {availabilityMessage ||
                          "Either not purchased or already taken"}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* Close Button */}
            <TouchableOpacity
              className="bg-[#2C2C2C] py-4 rounded-xl mt-6"
              onPress={onClose}
              activeOpacity={0.7}
              disabled={loading}
            >
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className="text-white text-center text-base"
              >
                Close
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Loading Overlay */}
          {loading && (
            <View className="absolute inset-0 bg-black/50 rounded-2xl items-center justify-center">
              <ActivityIndicator size="large" color="#FFBA00" />
              <Text className="text-white text-sm mt-2">Processing...</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default FoodUserModal;
