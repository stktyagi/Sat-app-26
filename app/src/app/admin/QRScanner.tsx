import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Modal,
  ActivityIndicator,
  StatusBar,
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
import { showAlert } from "@/components";
import {
  ArrowLeft,
  QrCode,
  Home,
  Building,
  Calendar,
} from "lucide-react-native";
import { useUserStore } from "@/state/userStore";
import { useAdminNavigation } from "@/hooks/useAdminNavigation";
import { useThemeStore } from "@/state/themeStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getUserRoles,
  isFullAdmin,
  ROLE_ADMIN,
  ROLE_EB_HOSPITALITY,
  ROLE_EC_HOSPITALITY,
  ROLE_EB_EVENTS,
  ROLE_EVENT_POC,
} from "@/utils/roles";

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
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [cameraKey, setCameraKey] = useState(Date.now());
  const [cameraReady, setCameraReady] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showGateModal, setShowGateModal] = useState(false);
  const [showHostelModal, setShowHostelModal] = useState(false);
  const [userData, setUserData] = useState<UserRegistrationData | null>(null);
  const [gateUserData, setGateUserData] = useState<UserGateData | null>(null);
  const [hostelUserData, setHostelUserData] = useState<UserGateData | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [showCategorySelection, setShowCategorySelection] = useState(true);
  const { userData: userProfile } = useUserStore();

  const roles = getUserRoles(userProfile);
  const isSuperOrAdmin = isFullAdmin(userProfile);

  const gateAllowedRoles = [
    ROLE_ADMIN,
    ROLE_EB_HOSPITALITY,
    ROLE_EC_HOSPITALITY,
  ];

  const hostelAllowedRoles = [
    ROLE_ADMIN,
    ROLE_EB_HOSPITALITY,
    ROLE_EC_HOSPITALITY,
  ];

  const eventAllowedRoles = [
    ROLE_ADMIN,
    ROLE_EB_EVENTS,
    ROLE_EVENT_POC,
  ];

  const isHostelAccessAllowed =
    isSuperOrAdmin || roles.some((role) => hostelAllowedRoles.includes(role));

  const isGateAccessAllowed =
    isSuperOrAdmin || roles.some((role) => gateAllowedRoles.includes(role));

  const isEventAccessAllowed =
    isSuperOrAdmin || roles.some((role) => eventAllowedRoles.includes(role));

  // Manage navbar and reset states when screen is focused/unfocused
  useFocusEffect(
    React.useCallback(() => {
      // When screen comes into focus
      setSelectedCategory(null);
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
    setScanned(false);
    setShowCategorySelection(false);
  };

  const handleBackToSelection = () => {
    setShowCategorySelection(true);
    setSelectedCategory(null);
    setScanned(false);
    setCameraReady(false);
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
    setUserData(null);
    setGateUserData(null);
    setHostelUserData(null);
    setScanned(false);
  };

  const handleBarcodeScanned = async ({ data }: { type: string; data: string }) => {
    if (scanned || !selectedCategory) return;

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

  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const bgColor = isDark ? "#131316" : "#E0E0E0";
  const cardBg = isDark ? "#1C1C20" : "#FFFFFF";
  const cardBorder = isDark ? "#2A2A30" : "#D5D5D5";
  const textPrimary = isDark ? "#FFFFFF" : "#111827";
  const textSecondary = isDark ? "#A0A0A0" : "#6B7280";

  // Check camera permissions
  if (!permission) {
    return (
      <View style={{ flex: 1, backgroundColor: bgColor, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: "Poppins_500Medium", color: textSecondary, fontSize: 16 }}>
          Requesting camera permission...
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: bgColor, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
        <View style={{ alignItems: "center" }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: "#41B8F020",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <QrCode size={48} color="#41B8F0" />
          </View>
          <Text
            style={{
              fontFamily: "Talina",
              color: textPrimary,
              fontSize: 22,
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            Camera Access Required
          </Text>
          <Text
            style={{
              fontFamily: "Poppins_400Regular",
              color: textSecondary,
              textAlign: "center",
              marginBottom: 24,
              fontSize: 13,
            }}
          >
            We need camera permission to scan QR codes for user verification
          </Text>
          <TouchableOpacity
            style={{
              backgroundColor: "#41B8F0",
              paddingHorizontal: 28,
              paddingVertical: 14,
              borderRadius: 14,
            }}
            onPress={requestPermission}
            activeOpacity={0.8}
          >
            <Text
              style={{
                fontFamily: "Poppins_600SemiBold",
                color: "#FFFFFF",
                fontSize: 15,
              }}
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
      <View style={{ flex: 1, backgroundColor: bgColor }}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

        {/* Header */}
        <View
          style={{
            paddingTop: insets.top + 8,
            paddingBottom: 16,
            paddingHorizontal: 20,
            flexDirection: "row",
            alignItems: "center",
            borderBottomWidth: 1,
            borderBottomColor: cardBorder,
            backgroundColor: bgColor,
          }}
        >
          <TouchableOpacity
            onPress={() => navigation.navigate("Dashboard")}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.06)",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 14,
            }}
            activeOpacity={0.7}
          >
            <ArrowLeft size={22} color={textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: "Talina",
                fontSize: 22,
                color: textPrimary,
                letterSpacing: 0.5,
              }}
            >
              QR Scanner
            </Text>
            <Text
              style={{
                fontFamily: "Poppins_400Regular",
                fontSize: 12,
                color: "#41B8F0",
                marginTop: 1,
              }}
            >
              Select verification category
            </Text>
          </View>
        </View>

        {/* Category Cards */}
        <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 20 }}>
          <Text
            style={{
              fontFamily: "Poppins_600SemiBold",
              color: textPrimary,
              fontSize: 16,
              marginBottom: 14,
            }}
          >
            Choose Scanning Mode
          </Text>

          {categories.length === 0 ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <QrCode size={64} color={textSecondary} />
              <Text
                style={{
                  fontFamily: "Poppins_600SemiBold",
                  color: textPrimary,
                  fontSize: 18,
                  marginTop: 16,
                  textAlign: "center",
                }}
              >
                No Access
              </Text>
              <Text
                style={{
                  fontFamily: "Poppins_400Regular",
                  color: textSecondary,
                  textAlign: "center",
                  marginTop: 8,
                  paddingHorizontal: 32,
                  fontSize: 13,
                }}
              >
                You don't have permission to access any scanning categories
              </Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {categories.map((category) => {
                const IconComponent = category.icon;
                return (
                  <TouchableOpacity
                    key={category.id}
                    onPress={() => handleCategorySelect(category.id)}
                    style={{
                      backgroundColor: cardBg,
                      borderWidth: 1,
                      borderColor: cardBorder,
                      borderRadius: 18,
                      padding: 18,
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 14,
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 14,
                          backgroundColor: category.color + "20",
                        }}
                      >
                        <IconComponent size={24} color={category.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontFamily: "Poppins_600SemiBold",
                            color: textPrimary,
                            fontSize: 16,
                            marginBottom: 2,
                          }}
                        >
                          {category.name}
                        </Text>
                        <Text
                          style={{
                            fontFamily: "Poppins_400Regular",
                            color: textSecondary,
                            fontSize: 12,
                          }}
                        >
                          {category.description}
                        </Text>
                      </View>
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 17,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.05)",
                        }}
                      >
                        <Text style={{ fontSize: 16, color: textSecondary }}>→</Text>
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
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
      <StatusBar barStyle="light-content" />

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
        <View style={{ flex: 1, backgroundColor: "#000000", alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#41B8F0" />
          <Text
            style={{
              fontFamily: "Poppins_500Medium",
              color: "#FFFFFF",
              fontSize: 14,
              marginTop: 14,
            }}
          >
            Initializing camera...
          </Text>
        </View>
      )}

      {/* Scanner Frame - Absolutely Positioned */}
      {cameraReady && (
        <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" }} pointerEvents="none">
          <View style={{ width: 250, height: 250, borderRadius: 20, position: "relative" }}>
            {/* Corner indicators in neon cyan */}
            <View style={{ position: "absolute", top: -2, left: -2, width: 34, height: 34, borderLeftWidth: 4, borderTopWidth: 4, borderColor: "#41B8F0", borderTopLeftRadius: 16 }} />
            <View style={{ position: "absolute", top: -2, right: -2, width: 34, height: 34, borderRightWidth: 4, borderTopWidth: 4, borderColor: "#41B8F0", borderTopRightRadius: 16 }} />
            <View style={{ position: "absolute", bottom: -2, left: -2, width: 34, height: 34, borderLeftWidth: 4, borderBottomWidth: 4, borderColor: "#41B8F0", borderBottomLeftRadius: 16 }} />
            <View style={{ position: "absolute", bottom: -2, right: -2, width: 34, height: 34, borderRightWidth: 4, borderBottomWidth: 4, borderColor: "#41B8F0", borderBottomRightRadius: 16 }} />
          </View>
        </View>
      )}

      {/* Absolute Overlay Container - Header */}
      <View
        style={{
          position: "absolute",
          top: Math.max(insets.top + 8, 16),
          left: 16,
          right: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 30,
        }}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          onPress={handleBackToSelection}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: "rgba(0, 0, 0, 0.65)",
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.18)",
            alignItems: "center",
            justifyContent: "center",
          }}
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            borderWidth: 1,
            borderColor: "rgba(65, 184, 240, 0.4)",
          }}
          pointerEvents="none"
        >
          <Text
            style={{
              fontFamily: "Poppins_600SemiBold",
              color: "#FFFFFF",
              fontSize: 13,
              letterSpacing: 0.8,
            }}
          >
            {selectedCategory?.toUpperCase()} VERIFICATION
          </Text>
        </View>

        <View style={{ width: 44 }} pointerEvents="none" />
      </View>

      {/* Bottom Hint Pill */}
      {cameraReady && (
        <View
          style={{
            position: "absolute",
            bottom: Math.max(insets.bottom + 36, 48),
            left: 24,
            right: 24,
            alignItems: "center",
          }}
          pointerEvents="none"
        >
          <View
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.75)",
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.12)",
            }}
          >
            <Text
              style={{
                fontFamily: "Poppins_500Medium",
                color: "#E2E8F0",
                fontSize: 13,
                textAlign: "center",
              }}
            >
              Align QR code within the frame to verify
            </Text>
          </View>
        </View>
      )}

      {/* User Information Modal (Event Verification) */}
      <Modal
        visible={showUserModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.75)", justifyContent: "center", alignItems: "center", paddingHorizontal: 20 }}>
          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: 24,
              padding: 24,
              width: "100%",
              maxWidth: 380,
              borderWidth: 1,
              borderColor: cardBorder,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.35,
              shadowRadius: 16,
              elevation: 8,
            }}
          >
            {userData && (
              <>
                {/* User Info Header */}
                <View style={{ alignItems: "center", marginBottom: 20 }}>
                  <Text
                    style={{
                      fontFamily: "Talina",
                      color: textPrimary,
                      fontSize: 22,
                      textAlign: "center",
                      marginBottom: 8,
                    }}
                  >
                    {userData.name || (userData as any).displayName || "Unknown User"}
                  </Text>

                  <View
                    style={{
                      backgroundColor: isDark ? "rgba(65, 184, 240, 0.15)" : "rgba(65, 184, 240, 0.12)",
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 6,
                      borderWidth: 1,
                      borderColor: "rgba(65, 184, 240, 0.3)",
                      marginBottom: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Poppins_600SemiBold",
                        color: "#41B8F0",
                        fontSize: 15,
                        textAlign: "center",
                      }}
                    >
                      {userData.eventName}
                    </Text>
                  </View>

                  <View
                    style={{
                      backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                      borderRadius: 20,
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Poppins_500Medium",
                        color: textSecondary,
                        fontSize: 12,
                      }}
                    >
                      Event Registration
                    </Text>
                  </View>
                </View>

                {/* Status Information */}
                <View style={{ gap: 10, marginBottom: 20 }}>
                  <View
                    style={{
                      backgroundColor: isDark ? "#131316" : "#F3F4F6",
                      borderRadius: 14,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderWidth: 1,
                      borderColor: cardBorder,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Poppins_400Regular",
                        color: textSecondary,
                        fontSize: 13,
                      }}
                    >
                      Registration Status:
                    </Text>
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 20,
                        backgroundColor:
                          userData.status === "confirmed"
                            ? "rgba(16, 185, 129, 0.2)"
                            : userData.status === "payment pending"
                            ? "rgba(234, 179, 8, 0.2)"
                            : userData.status === "rejected"
                            ? "rgba(239, 68, 68, 0.2)"
                            : "rgba(107, 114, 128, 0.2)",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Poppins_600SemiBold",
                          fontSize: 12,
                          textTransform: "capitalize",
                          color:
                            userData.status === "confirmed"
                              ? "#10B981"
                              : userData.status === "payment pending"
                              ? "#FBBF24"
                              : userData.status === "rejected"
                              ? "#EF4444"
                              : textSecondary,
                        }}
                      >
                        {userData.status}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={{
                      backgroundColor: isDark ? "#131316" : "#F3F4F6",
                      borderRadius: 14,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderWidth: 1,
                      borderColor: cardBorder,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Poppins_400Regular",
                        color: textSecondary,
                        fontSize: 13,
                      }}
                    >
                      Check-in Status:
                    </Text>
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 20,
                        backgroundColor:
                          userData.checkingStatus === "checked in"
                            ? "rgba(16, 185, 129, 0.2)"
                            : userData.checkingStatus === "rejected"
                            ? "rgba(239, 68, 68, 0.2)"
                            : "rgba(234, 179, 8, 0.2)",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Poppins_600SemiBold",
                          fontSize: 12,
                          textTransform: "capitalize",
                          color:
                            userData.checkingStatus === "checked in"
                              ? "#10B981"
                              : userData.checkingStatus === "rejected"
                              ? "#EF4444"
                              : "#FBBF24",
                        }}
                      >
                        {userData.checkingStatus}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Action Buttons */}
                {userData.checkingStatus === "pending" && (
                  <View style={{ marginBottom: 14 }}>
                    {userData.status === "confirmed" ? (
                      <View style={{ flexDirection: "row", gap: 10 }}>
                        <TouchableOpacity
                          style={{
                            flex: 1,
                            backgroundColor: "#10B981",
                            paddingVertical: 13,
                            borderRadius: 14,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          onPress={handleCheckIn}
                          disabled={loading}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={{
                              fontFamily: "Poppins_600SemiBold",
                              color: "#FFFFFF",
                              fontSize: 14,
                            }}
                          >
                            {loading ? "Processing..." : "Check In"}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={{
                            flex: 1,
                            backgroundColor: "#EF4444",
                            paddingVertical: 13,
                            borderRadius: 14,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          onPress={handleReject}
                          disabled={loading}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={{
                              fontFamily: "Poppins_600SemiBold",
                              color: "#FFFFFF",
                              fontSize: 14,
                            }}
                          >
                            {loading ? "Processing..." : "Reject"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View
                        style={{
                          backgroundColor: "rgba(234, 179, 8, 0.15)",
                          padding: 12,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: "rgba(234, 179, 8, 0.3)",
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: "Poppins_400Regular",
                            color: "#FBBF24",
                            textAlign: "center",
                            fontSize: 13,
                          }}
                        >
                          Cannot check in: Status is "{userData.status}"
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Close Button */}
                <TouchableOpacity
                  style={{
                    backgroundColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.06)",
                    paddingVertical: 13,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onPress={closeModal}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      fontFamily: "Poppins_600SemiBold",
                      color: textPrimary,
                      fontSize: 14,
                    }}
                  >
                    Close
                  </Text>
                </TouchableOpacity>

                {/* Loading Overlay */}
                {loading && (
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      left: 0,
                      right: 0,
                      backgroundColor: "rgba(0, 0, 0, 0.6)",
                      borderRadius: 24,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ActivityIndicator size="large" color="#41B8F0" />
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
    </View>
  );
}
