import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Modal,
  ActivityIndicator,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useFocusEffect } from "expo-router";
import {
  handleQRScan,
  updateUserCheckingStatus,
  UserRegistrationData,
  UserGateData,
} from "@/api/admin";
import GateUserModal from "@/components/qr/GateUserModal";
import HostelUserModal from "@/components/qr/HostelUserModal";
import FoodUserModal from "@/components/qr/FoodUserModal";
import { showAlert } from "@/components";
import {
  ArrowLeft,
  QrCode,
  Home,
  Building,
  UtensilsCrossed,
  Calendar,
} from "lucide-react-native";
import { useUserStore } from "@/state/userStore";
import { useAdminNavigation } from "@/hooks/useAdminNavigation";

// Dimensions available if needed
// const { width, height } = Dimensions.get("window");

interface QRScannerProps {
  navigation: any;
  setShowBottomNav?: (show: boolean) => void;
}

export default function QRScanner({
  setShowBottomNav,
}: { setShowBottomNav?: (show: boolean) => void }) {
  const navigation = useAdminNavigation();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [cameraKey, setCameraKey] = useState(Date.now());
  const [cameraReady, setCameraReady] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showGateModal, setShowGateModal] = useState(false);
  const [showHostelModal, setShowHostelModal] = useState(false);
  const [showFoodModal, setShowFoodModal] = useState(false);
  const [userData, setUserData] = useState<UserRegistrationData | null>(null);
  const [gateUserData, setGateUserData] = useState<UserGateData | null>(null);
  const [hostelUserData, setHostelUserData] = useState<UserGateData | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [showCategorySelection, setShowCategorySelection] = useState(true);
  const { userData: userProfile } = useUserStore();

  const gateAllowedRoles = [
    "admin",
    "outreach_admin",
    "hospitality_admin",
    "hospitality_member",
    "outreach_member",
  ];

  const hostelAllowedRoles = [
    "admin",
    "hospitality_admin",
    "hospitality_member",
  ];

  const foodAllowedRoles = [
    "admin",
    "hospitality_admin",
    "hospitality_member",
    "event_admin",
    "outreach_admin",
    "outreach_member",
  ];

  const eventAllowedRoles = [
    "admin",
    "event_admin",
    "event_coordinator",
    "outreach_admin",
    "outreach_member",
    "core_member",
    "executive_committee",
  ];

  const isHostelAccessAllowed = userProfile?.roles
    ? userProfile.roles.some((role) => hostelAllowedRoles.includes(role))
    : false;

  const isFoodAccessAllowed = userProfile?.roles
    ? userProfile.roles.some((role) => foodAllowedRoles.includes(role))
    : false;

  const isGateAccessAllowed = userProfile?.roles
    ? userProfile.roles.some((role) => gateAllowedRoles.includes(role))
    : false;

  const isEventAccessAllowed = userProfile?.roles
    ? userProfile.roles.some((role) => eventAllowedRoles.includes(role))
    : false;

  // Manage navbar and reset states when screen is focused/unfocused
  useFocusEffect(
    React.useCallback(() => {
      // When screen comes into focus
      setSelectedCategory(null);
      setSelectedMeal(null);
      setScanned(false);
      setShowCategorySelection(true);

      // Hide the main app navbar
      if (setShowBottomNav) {
        setShowBottomNav(false);
      }

      return () => {
        // When screen loses focus
        // Restore the main app navbar
        if (setShowBottomNav) {
          setShowBottomNav(true);
        }
      };
    }, [setShowBottomNav])
  );

  // Initialize camera when category is selected
  useEffect(() => {
    if (!showCategorySelection && selectedCategory) {
      setCameraReady(false);
      const timer = setTimeout(() => {
        setCameraKey(Date.now());
        setTimeout(() => {
          setCameraReady(true);
        }, 200);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [showCategorySelection, selectedCategory]);

  // Filter categories based on user roles
  const allCategories = [
    {
      id: "gate",
      name: "Gate",
      icon: Home,
      color: "#10B981",
      bgColor: "bg-green-500/20",
      borderColor: "border-green-500/30",
      description: "Scan QR codes for fest entry verification",
      isAllowed: isGateAccessAllowed,
    },
    {
      id: "hostel",
      name: "Hostel",
      icon: Building,
      color: "#3B82F6",
      bgColor: "bg-blue-500/20",
      borderColor: "border-blue-500/30",
      description: "Manage hostel accommodation check-ins",
      isAllowed: isHostelAccessAllowed,
    },
    {
      id: "food",
      name: "Food",
      icon: UtensilsCrossed,
      color: "#F59E0B",
      bgColor: "bg-amber-500/20",
      borderColor: "border-amber-500/30",
      description: "Track meal distribution and consumption",
      isAllowed: isFoodAccessAllowed,
    },
    {
      id: "event",
      name: "Event",
      icon: Calendar,
      color: "#EF4444",
      bgColor: "bg-red-500/20",
      borderColor: "border-red-500/30",
      description: "Verify event registrations and attendance",
      isAllowed: isEventAccessAllowed,
    },
  ];

  const categories = allCategories.filter((category) => category.isAllowed);

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setSelectedMeal(null);
    setScanned(false);
    setShowCategorySelection(false);
  };

  const handleBackToSelection = () => {
    setShowCategorySelection(true);
    setSelectedCategory(null);
    setSelectedMeal(null);
    setScanned(false);
    setCameraReady(false);
  };

  const handleMealSelect = (mealType: string) => {
    setSelectedMeal(mealType);
    setScanned(false);
  };

  const handleCheckIn = async () => {
    if (!userData) return;

    setLoading(true);
    try {
      const result = await updateUserCheckingStatus(
        userData.registrationId,
        "checked in"
      );

      if (result.success) {
        showAlert(
          "Success",
          `${userData.name || (userData as any).displayName || "User"} has been checked in successfully!`,
          [{ text: "OK", onPress: closeModal }]
        );
      } else {
        showAlert(
          result.error || "Check-in Failed",
          result.message || "Failed to check in user"
        );
      }
    } catch (error) {
      showAlert("Error", "Failed to check in user. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!userData) return;

    setLoading(true);
    try {
      const result = await updateUserCheckingStatus(
        userData.registrationId,
        "rejected"
      );

      if (result.success) {
        showAlert("User Rejected", `${userData.name || (userData as any).displayName || "User"} has been rejected.`, [
          { text: "OK", onPress: closeModal },
        ]);
      } else {
        showAlert(
          result.error || "Rejection Failed",
          result.message || "Failed to reject user"
        );
      }
    } catch (error) {
      showAlert("Error", "Failed to reject user. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setShowUserModal(false);
    setShowGateModal(false);
    setShowHostelModal(false);
    setShowFoodModal(false);
    setUserData(null);
    setGateUserData(null);
    setHostelUserData(null);
    setScanned(false);
  };

  const handleBarcodeScanned = async ({ data }: { type: string; data: string }) => {
    if (scanned || !selectedCategory) return;

    // For food category, require meal selection
    if (selectedCategory === "food" && !selectedMeal) {
      showAlert(
        "Meal Selection Required",
        "Please select a meal type (Breakfast, Lunch, or Dinner) before scanning.",
        [{ text: "OK" }]
      );
      return;
    }

    setScanned(true);
    setLoading(true);

    try {
      const result = await handleQRScan(data, selectedCategory);

      if (result.success && result.data) {
        if (selectedCategory === "gate") {
          setGateUserData(result.data as UserGateData);
          setShowGateModal(true);
        } else if (selectedCategory === "hostel") {
          setHostelUserData(result.data as UserGateData);
          setShowHostelModal(true);
        } else if (selectedCategory === "food") {
          setGateUserData(result.data as UserGateData);
          setShowFoodModal(true);
        } else {
          setUserData(result.data as UserRegistrationData);
          setShowUserModal(true);
        }
      } else {
        showAlert(
          result.error || "Scan Failed",
          result.message || "Failed to process QR code",
          [{ text: "Try Again", onPress: () => setScanned(false) }]
        );
      }
    } catch (error) {
      showAlert("Error", "An unexpected error occurred. Please try again.", [
        { text: "Try Again", onPress: () => setScanned(false) },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Check camera permissions
  if (!permission) {
    return (
      <View className="flex-1 bg-transparent items-center justify-center">
        <Text className="text-[#0C3572] text-lg">
          Requesting camera permission...
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 bg-transparent items-center justify-center px-6">
        <View className="items-center">
          <QrCode size={80} color="#EEB170" />
          <Text
            style={{ fontFamily: "Outfit_600SemiBold" }}
            className="text-[#0C3572] text-2xl text-center mt-6 mb-4"
          >
            Camera Access Required
          </Text>
          <Text
            style={{ fontFamily: "Outfit_400Regular" }}
            className="text-[#2175C0] text-center mb-8"
          >
            We need camera permission to scan QR codes for user verification
          </Text>
          <TouchableOpacity
            className="bg-[#EEB170] px-8 py-4 rounded-xl"
            onPress={requestPermission}
            activeOpacity={0.7}
          >
            <Text
              style={{ fontFamily: "Outfit_600SemiBold" }}
              className="text-[#121212] text-lg"
            >
              Grant Permission
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Category Selection Screen
  if (showCategorySelection) {
    return (
      <View className="flex-1 bg-transparent">
        {/* Header */}
        <View className="bg-[#EEB170] pt-12 pb-6 px-6 rounded-b-3xl">
          <View className="flex-row items-center mb-4">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="mr-4"
              activeOpacity={0.7}
            >
              <ArrowLeft size={28} color="#121212" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text
                style={{ fontFamily: "Outfit_700Bold" }}
                className="text-[#121212] text-2xl"
              >
                QR Scanner
              </Text>
              <Text
                style={{ fontFamily: "Outfit_500Medium" }}
                className="text-[#121212] text-sm opacity-80"
              >
                Select a scanning category
              </Text>
            </View>
          </View>
        </View>

        {/* Category Cards */}
        <View className="flex-1 px-6 pt-8">
          <Text
            style={{ fontFamily: "Outfit_600SemiBold" }}
            className="text-[#0C3572] text-lg mb-4"
          >
            Choose Scanning Mode
          </Text>

          {categories.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <QrCode size={64} color="#6B7280" />
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className="text-[#2175C0] text-xl mt-4 text-center"
              >
                No Access
              </Text>
              <Text
                style={{ fontFamily: "Outfit_400Regular" }}
                className="text-gray-500 text-center mt-2 px-8"
              >
                You don't have permission to access any scanning categories
              </Text>
            </View>
          ) : (
            <View className="gap-4">
              {categories.map((category) => {
                const IconComponent = category.icon;
                return (
                  <TouchableOpacity
                    key={category.id}
                    onPress={() => handleCategorySelect(category.id)}
                    className={`${category.bgColor} border ${category.borderColor} rounded-2xl p-6`}
                    activeOpacity={0.7}
                  >
                    <View className="flex-row items-center mb-3">
                      <View
                        className="w-14 h-14 rounded-xl items-center justify-center mr-4"
                        style={{ backgroundColor: category.color + "40" }}
                      >
                        <IconComponent size={28} color={category.color} />
                      </View>
                      <View className="flex-1">
                        <Text
                          style={{ fontFamily: "Outfit_600SemiBold" }}
                          className="text-[#0C3572] text-xl mb-1"
                        >
                          {category.name}
                        </Text>
                        <Text
                          style={{ fontFamily: "Outfit_400Regular" }}
                          className="text-[#2175C0] text-sm"
                        >
                          {category.description}
                        </Text>
                      </View>
                      <View
                        className="w-10 h-10 rounded-full items-center justify-center"
                        style={{ backgroundColor: category.color + "20" }}
                      >
                        <Text style={{ fontSize: 20 }}>→</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </View>
    );
  }

  // Camera Scanner Screen
  return (
    <View className="flex-1 bg-black">
      {/* Full Screen Camera */}
      {cameraReady ? (
        <CameraView
          key={`qr-camera-${cameraKey}`}
          style={{ flex: 1 }}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ["qr", "pdf417"],
          }}
        />
      ) : (
        <View className="flex-1 bg-black items-center justify-center">
          <ActivityIndicator size="large" color="#EEB170" />
          <Text
            style={{ fontFamily: "Outfit_500Medium" }}
            className="text-[#0C3572] text-base mt-4"
          >
            Initializing camera...
          </Text>
        </View>
      )}

      {/* Scanner Frame - Absolutely Positioned */}
      {cameraReady && (
        <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
          <View className="relative">
            <View
              className="rounded-2xl bg-transparent"
              style={{ width: 250, height: 250 }}
            >
              {/* Corner indicators */}
              <View className="absolute -top-1 -left-1 w-8 h-8 border-l-4 border-t-4 border-[#EEB170] rounded-tl-lg" />
              <View className="absolute -top-1 -right-1 w-8 h-8 border-r-4 border-t-4 border-[#EEB170] rounded-tr-lg" />
              <View className="absolute -bottom-1 -left-1 w-8 h-8 border-l-4 border-b-4 border-[#EEB170] rounded-bl-lg" />
              <View className="absolute -bottom-1 -right-1 w-8 h-8 border-r-4 border-b-4 border-[#EEB170] rounded-br-lg" />
            </View>
          </View>
        </View>
      )}

      {/* Absolute Overlay Container - All UI elements */}
      <View className="absolute inset-0" pointerEvents="box-none">
        {/* Header Row - Back Button and Title */}
        <View className="absolute top-12 left-6 right-6 flex-row items-center">
          <TouchableOpacity
            onPress={handleBackToSelection}
            className="bg-black/70 rounded-full p-3 mr-4"
            activeOpacity={0.7}
          >
            <ArrowLeft size={24} color="white" />
          </TouchableOpacity>

          <View className="flex-1 items-center" pointerEvents="none">
            <Text
              style={{ fontFamily: "Outfit_600SemiBold" }}
              className="text-[#0C3572] text-xl"
            >
              {selectedCategory?.toUpperCase()} Scanner
            </Text>
            {selectedCategory === "food" && selectedMeal && (
              <Text
                style={{ fontFamily: "Outfit_400Regular" }}
                className="text-[#EEB170] text-sm"
              >
                {selectedMeal.toUpperCase()}
              </Text>
            )}
          </View>

          {/* Invisible spacer to balance the layout */}
          <View style={{ width: 56 }} pointerEvents="none" />
        </View>

        {/* Status Messages */}
        {selectedCategory === "food" && !selectedMeal && (
          <View
            className="absolute bottom-60 left-4 right-4"
            pointerEvents="none"
          >
            <View className="bg-black/70 rounded-xl px-4 py-3">
              <Text
                style={{ fontFamily: "Outfit_500Medium" }}
                className="text-[#0C3572] text-center text-base"
              >
                Select a meal type to start scanning
              </Text>
            </View>
          </View>
        )}

        {selectedCategory === "food" && selectedMeal && !scanned && (
          <View
            className="absolute bottom-60 left-4 right-4"
            pointerEvents="none"
          >
            <View className="bg-black/70 rounded-xl px-4 py-3">
              <Text
                style={{ fontFamily: "Outfit_500Medium" }}
                className="text-[#0C3572] text-center text-base"
              >
                Ready to scan for {selectedMeal}
              </Text>
            </View>
          </View>
        )}

        {/* Meal Selection UI - Only show when Food category is selected */}
        {selectedCategory === "food" && (
          <View className="absolute bottom-32 left-4 right-4">
            <View className="bg-black/80 rounded-2xl border border-white/20 px-4 py-3">
              <Text
                style={{ fontFamily: "Outfit_500Medium" }}
                className="text-[#0C3572] text-center text-sm mb-3"
              >
                Select Meal Type:
              </Text>
              <View className="flex-row justify-between items-center">
                {["breakfast", "lunch", "dinner"].map((meal) => (
                  <TouchableOpacity
                    key={meal}
                    className={`flex-1 items-center justify-center py-3 mx-1 rounded-xl ${
                      selectedMeal === meal ? "bg-[#EEB170]" : "bg-white/10"
                    }`}
                    onPress={() => handleMealSelect(meal)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={{ fontFamily: "Outfit_600SemiBold" }}
                      className={`text-sm capitalize ${
                        selectedMeal === meal
                          ? "text-[#121212]"
                          : "text-[#0C3572]"
                      }`}
                    >
                      {meal}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}
      </View>

      {/* User Information Modal */}
      <Modal
        visible={showUserModal}
        transparent={true}
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View className="flex-1 bg-black/50 justify-center items-center px-6">
          <View className="bg-[#FFFFFF66] rounded-2xl p-6 w-full max-w-sm border border-[#A0B3D0]">
            {userData && (
              <>
                {/* User Info Header */}
                <View className="items-center mb-6">
                  <Text
                    style={{ fontFamily: "Outfit_700Bold" }}
                    className="text-[#0C3572] text-2xl mb-2"
                  >
                    {userData.name || (userData as any).displayName || "Unknown User"}
                  </Text>
                  <View className="bg-[#EEB170] rounded-xl px-4 py-2 mb-2">
                    <Text
                      style={{ fontFamily: "Outfit_600SemiBold" }}
                      className="text-[#121212] text-lg"
                    >
                      {userData.eventName}
                    </Text>
                  </View>
                  <View className="bg-[#FFFFFF66] rounded-full px-3 py-1">
                    <Text
                      style={{ fontFamily: "Outfit_400Regular" }}
                      className="text-[#2175C0] text-sm"
                    >
                      Event Registration
                    </Text>
                  </View>
                </View>

                {/* Status Information */}
                <View className="mb-6">
                  <View className="flex-row justify-between items-center mb-3">
                    <Text
                      style={{ fontFamily: "Outfit_400Regular" }}
                      className="text-[#2175C0] text-base"
                    >
                      Status:
                    </Text>
                    <View
                      className={`px-3 py-1 rounded-full ${
                        userData.status === "confirmed"
                          ? "bg-green-500/20"
                          : userData.status === "payment pending"
                          ? "bg-yellow-500/20"
                          : userData.status === "rejected"
                          ? "bg-red-500/20"
                          : "bg-gray-500/20"
                      }`}
                    >
                      <Text
                        style={{ fontFamily: "Outfit_600SemiBold" }}
                        className={`text-sm capitalize ${
                          userData.status === "confirmed"
                            ? "text-green-400"
                            : userData.status === "payment pending"
                            ? "text-yellow-400"
                            : userData.status === "rejected"
                            ? "text-red-400"
                            : "text-[#2175C0]"
                        }`}
                      >
                        {userData.status}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row justify-between items-center">
                    <Text
                      style={{ fontFamily: "Outfit_400Regular" }}
                      className="text-[#2175C0] text-base"
                    >
                      Check-in Status:
                    </Text>
                    <View
                      className={`px-3 py-1 rounded-full ${
                        userData.checkingStatus === "checked in"
                          ? "bg-green-500/20"
                          : userData.checkingStatus === "rejected"
                          ? "bg-red-500/20"
                          : "bg-yellow-500/20"
                      }`}
                    >
                      <Text
                        style={{ fontFamily: "Outfit_600SemiBold" }}
                        className={`text-sm capitalize ${
                          userData.checkingStatus === "checked in"
                            ? "text-green-400"
                            : userData.checkingStatus === "rejected"
                            ? "text-red-400"
                            : "text-yellow-400"
                        }`}
                      >
                        {userData.checkingStatus}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Action Buttons */}
                {userData.checkingStatus === "pending" && (
                  <View className="mb-4">
                    {userData.status === "confirmed" ? (
                      <View className="flex-row gap-3">
                        <TouchableOpacity
                          className="flex-1 bg-green-600 py-3 rounded-xl"
                          onPress={handleCheckIn}
                          disabled={loading}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={{ fontFamily: "Outfit_600SemiBold" }}
                            className="text-[#0C3572] text-center"
                          >
                            {loading ? "Processing..." : "Check In"}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          className="flex-1 bg-red-600 py-3 rounded-xl"
                          onPress={handleReject}
                          disabled={loading}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={{ fontFamily: "Outfit_600SemiBold" }}
                            className="text-[#0C3572] text-center"
                          >
                            {loading ? "Processing..." : "Reject"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View className="bg-yellow-500/20 p-3 rounded-xl border border-yellow-500/30">
                        <Text
                          style={{ fontFamily: "Outfit_400Regular" }}
                          className="text-yellow-400 text-center text-sm"
                        >
                          Cannot check in: User status is "{userData.status}"
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Close Button */}
                <TouchableOpacity
                  className="bg-[#FFFFFF66] py-3 rounded-xl"
                  onPress={closeModal}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className="text-[#0C3572] text-center"
                  >
                    Close
                  </Text>
                </TouchableOpacity>

                {/* Loading Overlay */}
                {loading && (
                  <View className="absolute inset-0 bg-black/50 rounded-2xl items-center justify-center">
                    <ActivityIndicator size="large" color="#EEB170" />
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Gate User Information Modal */}
      <GateUserModal
        visible={showGateModal}
        onClose={closeModal}
        userData={gateUserData}
        onUserDataUpdate={(updatedData) => setGateUserData(updatedData)}
      />

      {/* Hostel User Information Modal */}
      <HostelUserModal
        visible={showHostelModal}
        onClose={closeModal}
        userData={hostelUserData}
        onUserDataUpdate={(updatedData) => setHostelUserData(updatedData)}
      />

      {/* Food User Information Modal */}
      <FoodUserModal
        visible={showFoodModal}
        onClose={closeModal}
        userData={gateUserData}
        selectedMeal={selectedMeal}
        onUserDataUpdate={(updatedData) => setGateUserData(updatedData)}
      />
    </View>
  );
}
