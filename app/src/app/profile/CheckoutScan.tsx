import React, { useState, useEffect, useRef } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  StatusBar,
  Dimensions,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Flashlight,
  Building,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Bed,
  MapPin,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  User,
  Home,
  Check,
  X,
} from "lucide-react-native";
import { useUserStore } from "@/state/userStore";
import { useThemeStore } from "@/state/themeStore";
import { submitUserCheckout } from "@/api/admin";
import { formatHostelDisplay } from "@/data/hostels";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SCANNER_SIZE = Math.min(SCREEN_WIDTH * 0.72, 280);

interface ScannedState {
  raw: string;
  timestamp: string;
}

export default function CheckoutScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const { userData: user, refreshUserProfile } = useUserStore();

  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // Scanning & Confirming state
  const [scannedQR, setScannedQR] = useState<ScannedState | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState<{
    success: boolean;
    message: string;
    already?: boolean;
    unreturned?: string[];
  } | null>(null);

  // Laser animation
  const laserAnim = useRef(new Animated.Value(0)).current;

  // Modal entrance animations
  const modalScale = useRef(new Animated.Value(0.85)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(laserAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(laserAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [laserAnim]);

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scannedQR || confirming || confirmed) return;

    const trimmed = String(data || "").trim();
    setScannedQR({ raw: trimmed, timestamp: new Date().toLocaleTimeString() });

    // Animate details card in
    Animated.parallel([
      Animated.spring(modalScale, {
        toValue: 1,
        tension: 70,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleConfirmCheckout = async () => {
    if (!scannedQR) return;
    setConfirming(true);
    try {
      const res = await submitUserCheckout(scannedQR.raw);
      setConfirmed(true);
      setCheckoutResult(res);
      await refreshUserProfile().catch(() => {});
    } catch (err: any) {
      Alert.alert(
        "Checkout Failed",
        err?.message || "Could not complete checkout. Please verify the QR or visit the hospitality desk."
      );
      setScannedQR(null);
    } finally {
      setConfirming(false);
    }
  };

  const handleReset = () => {
    setScannedQR(null);
    setConfirmed(false);
    setCheckoutResult(null);
    modalScale.setValue(0.85);
    modalOpacity.setValue(0);
  };

  // Theme constants
  const bgColor = isDark ? "#131316" : "#F3F4F6";
  const cardBg = isDark ? "#1C1C20" : "#FFFFFF";
  const cardBorder = isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)";
  const textPrimary = isDark ? "#FFFFFF" : "#111827";
  const textSecondary = isDark ? "#9CA3AF" : "#6B7280";
  const accentColor = "#41B8F0";

  const hostelName = user?.checkInStatus?.Hostel || (user as any)?.hostel || "Not Assigned";
  const roomNo = user?.checkInStatus?.RoomNo || (user as any)?.roomNo || "-";
  const isAlreadyCheckedOut = Boolean(user?.checkInStatus?.checkedOut);
  const formattedHostel = formatHostelDisplay(hostelName, roomNo);

  const laserTranslateY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCANNER_SIZE - 6],
  });

  if (!permission) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000000", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#41B8F0" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: bgColor,
          paddingTop: Math.max(insets.top + 16, 24),
          paddingHorizontal: 24,
          justifyContent: "space-between",
          paddingBottom: Math.max(insets.bottom + 20, 24),
        }}
      >
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.75}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: cardBg,
              borderWidth: 1,
              borderColor: cardBorder,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowLeft size={20} color={textPrimary} />
          </TouchableOpacity>
          <Text style={{ fontFamily: "Talina", fontSize: 22, color: textPrimary }}>
            Hostel Checkout
          </Text>
        </View>

        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: cardBorder,
            padding: 24,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: "rgba(65, 184, 240, 0.15)",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Building size={32} color="#41B8F0" />
          </View>
          <Text
            style={{
              fontFamily: "Poppins_600SemiBold",
              fontSize: 18,
              color: textPrimary,
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            Camera Access Needed
          </Text>
          <Text
            style={{
              fontFamily: "Poppins_400Regular",
              fontSize: 13,
              color: textSecondary,
              textAlign: "center",
              lineHeight: 20,
            }}
          >
            Camera permission is required to scan the Hostel Checkout QR code.
          </Text>
        </View>

        <TouchableOpacity
          onPress={requestPermission}
          activeOpacity={0.8}
          style={{
            backgroundColor: "#41B8F0",
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: "center",
          }}
        >
          <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#FFFFFF", fontSize: 16 }}>
            Grant Permission
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Camera Preview */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torchOn}
        onCameraReady={() => setCameraReady(true)}
        onBarcodeScanned={scannedQR ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
      />

      {/* Dark Vignette Overlay */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.65)" }} />
        <View style={{ flexDirection: "row", height: SCANNER_SIZE }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.65)" }} />
          <View style={{ width: SCANNER_SIZE, height: SCANNER_SIZE }} />
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.65)" }} />
        </View>
        <View style={{ flex: 1.4, backgroundColor: "rgba(0,0,0,0.65)" }} />
      </View>

      {/* Header Overlay */}
      <View
        style={{
          position: "absolute",
          top: Math.max(insets.top + 8, 20),
          left: 0,
          right: 0,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          zIndex: 20,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: "rgba(0,0,0,0.55)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.2)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ArrowLeft size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={{ alignItems: "center" }}>
          <Text style={{ fontFamily: "Talina", fontSize: 22, color: "#FFFFFF", letterSpacing: 0.5 }}>
            Hostel Checkout
          </Text>
          <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
            Scan Hostel Desk QR
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setTorchOn((prev) => !prev)}
          activeOpacity={0.7}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: torchOn ? "#41B8F0" : "rgba(0,0,0,0.55)",
            borderWidth: 1,
            borderColor: torchOn ? "#41B8F0" : "rgba(255,255,255,0.2)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Flashlight size={19} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Center Viewfinder Box */}
      {!scannedQR && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
          pointerEvents="none"
        >
          <View
            style={{
              width: SCANNER_SIZE,
              height: SCANNER_SIZE,
              borderRadius: 24,
              overflow: "hidden",
            }}
          >
            {/* Viewfinder Corners */}
            <View style={{ position: "absolute", top: 0, left: 0, width: 32, height: 32, borderTopWidth: 4, borderLeftWidth: 4, borderColor: "#41B8F0", borderTopLeftRadius: 18 }} />
            <View style={{ position: "absolute", top: 0, right: 0, width: 32, height: 32, borderTopWidth: 4, borderRightWidth: 4, borderColor: "#41B8F0", borderTopRightRadius: 18 }} />
            <View style={{ position: "absolute", bottom: 0, left: 0, width: 32, height: 32, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: "#41B8F0", borderBottomLeftRadius: 18 }} />
            <View style={{ position: "absolute", bottom: 0, right: 0, width: 32, height: 32, borderBottomWidth: 4, borderRightWidth: 4, borderColor: "#41B8F0", borderBottomRightRadius: 18 }} />

            {/* Laser Beam */}
            <Animated.View
              style={{
                width: "100%",
                height: 3,
                backgroundColor: "#41B8F0",
                shadowColor: "#41B8F0",
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 1,
                shadowRadius: 8,
                elevation: 4,
                transform: [{ translateY: laserTranslateY }],
              }}
            />
          </View>

          <Text
            style={{
              fontFamily: "Poppins_500Medium",
              fontSize: 13,
              color: "rgba(255,255,255,0.85)",
              marginTop: 24,
              textAlign: "center",
            }}
          >
            Align the Hostel Checkout QR in the frame
          </Text>
        </View>
      )}

      {/* Scanned Details / Confirmation Modal Dialog */}
      {scannedQR && (
        <View
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "rgba(0, 0, 0, 0.78)",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 20,
            zIndex: 40,
          }}
        >
          <Animated.View
            style={{
              width: "100%",
              maxWidth: 390,
              maxHeight: "88%",
              backgroundColor: cardBg,
              borderRadius: 28,
              borderWidth: 1.5,
              borderColor: confirmed ? "rgba(16, 185, 129, 0.5)" : "rgba(65, 184, 240, 0.35)",
              paddingHorizontal: 22,
              paddingTop: 24,
              paddingBottom: 22,
              shadowColor: confirmed ? "#10B981" : "#000",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.35,
              shadowRadius: 20,
              elevation: 10,
              transform: [{ scale: modalScale }],
              opacity: modalOpacity,
            }}
          >
            {/* Close / Dismiss Bar */}
            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 4 }}>
              <TouchableOpacity
                onPress={confirmed ? () => router.back() : handleReset}
                activeOpacity={0.7}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={18} color={textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {/* Success state after confirmation */}
              {confirmed && checkoutResult ? (
                <View style={{ alignItems: "center", paddingVertical: 10 }}>
                  <View
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 36,
                      backgroundColor: "rgba(16, 185, 129, 0.15)",
                      borderWidth: 2,
                      borderColor: "rgba(16, 185, 129, 0.35)",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 16,
                    }}
                  >
                    <CheckCircle2 size={44} color="#10B981" />
                  </View>

                  <Text
                    style={{
                      fontFamily: "Poppins_700Bold",
                      fontSize: 22,
                      color: textPrimary,
                      textAlign: "center",
                      marginBottom: 4,
                    }}
                  >
                    Checkout Completed!
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Poppins_400Regular",
                      fontSize: 13,
                      color: textSecondary,
                      textAlign: "center",
                      marginBottom: 16,
                    }}
                  >
                    {user?.displayName || "Guest"}, your hostel stay has been concluded.
                  </Text>

                  {/* Move to gate instruction card */}
                  <View
                    style={{
                      backgroundColor: isDark ? "rgba(59, 130, 246, 0.15)" : "#EFF6FF",
                      borderRadius: 18,
                      paddingHorizontal: 18,
                      paddingVertical: 16,
                      marginBottom: 20,
                      borderWidth: 1.5,
                      borderColor: "rgba(59, 130, 246, 0.35)",
                      width: "100%",
                      alignItems: "center",
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <MapPin size={20} color="#3B82F6" />
                      <Text
                        style={{
                          fontFamily: "Poppins_700Bold",
                          fontSize: 16,
                          color: "#3B82F6",
                          textAlign: "center",
                        }}
                      >
                        Please move to the gate
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontFamily: "Poppins_400Regular",
                        fontSize: 12.5,
                        color: isDark ? "#BFDBFE" : "#1E40AF",
                        textAlign: "center",
                        lineHeight: 18,
                      }}
                    >
                      Your checkout timestamp has been registered with hospitality. Show your festival ID pass at the main campus gate when exiting.
                    </Text>
                  </View>

                  {/* Summary row */}
                  <View
                    style={{
                      backgroundColor: isDark ? "#24242A" : "#F8FAFC",
                      borderRadius: 14,
                      padding: 14,
                      width: "100%",
                      borderWidth: 1,
                      borderColor: cardBorder,
                      marginBottom: 20,
                      gap: 8,
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 12, color: textSecondary }}>
                        Hostel
                      </Text>
                      <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 13, color: textPrimary }}>
                        {formattedHostel}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 12, color: textSecondary }}>
                        Checkout Time
                      </Text>
                      <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 13, color: "#10B981" }}>
                        {scannedQR.timestamp}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => router.back()}
                    activeOpacity={0.8}
                    style={{
                      width: "100%",
                      backgroundColor: "#41B8F0",
                      borderRadius: 14,
                      paddingVertical: 14,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#FFFFFF", fontSize: 15 }}>
                      Done
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* Pre-confirmation review of user and hostel details */
                <View style={{ paddingVertical: 4 }}>
                  <View style={{ alignItems: "center", marginBottom: 16 }}>
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        backgroundColor: "rgba(65, 184, 240, 0.15)",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 10,
                      }}
                    >
                      <LogOut size={28} color="#41B8F0" />
                    </View>
                    <Text style={{ fontFamily: "Poppins_700Bold", fontSize: 20, color: textPrimary, textAlign: "center" }}>
                      Confirm Checkout
                    </Text>
                    <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 12, color: textSecondary, textAlign: "center", marginTop: 2 }}>
                      Review your details before confirming hostel departure
                    </Text>
                  </View>

                  {/* User & Allotment Details Card */}
                  <View
                    style={{
                      backgroundColor: isDark ? "#24242A" : "#F8FAFC",
                      borderRadius: 18,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: cardBorder,
                      gap: 12,
                      marginBottom: 18,
                    }}
                  >
                    {/* Participant Name */}
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <User size={15} color={textSecondary} />
                        <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 12, color: textSecondary }}>
                          Participant
                        </Text>
                      </View>
                      <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 13, color: textPrimary }}>
                        {user?.displayName || "Guest"}
                      </Text>
                    </View>

                    {/* College */}
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Building size={15} color={textSecondary} />
                        <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 12, color: textSecondary }}>
                          College
                        </Text>
                      </View>
                      <Text
                        numberOfLines={1}
                        style={{
                          fontFamily: "Poppins_500Medium",
                          fontSize: 12.5,
                          color: textPrimary,
                          maxWidth: "60%",
                          textAlign: "right",
                        }}
                      >
                        {user?.collegeName || "Outside College"}
                      </Text>
                    </View>

                    {/* Assigned Hostel & Room */}
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Home size={15} color="#41B8F0" />
                        <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 12, color: textSecondary }}>
                          Hostel / Room
                        </Text>
                      </View>
                      <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 13, color: "#41B8F0" }}>
                        {formattedHostel || "No hostel allotted"}
                      </Text>
                    </View>

                    {/* Current Status */}
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <ShieldCheck size={15} color={isAlreadyCheckedOut ? "#F59E0B" : "#10B981"} />
                        <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 12, color: textSecondary }}>
                          Status
                        </Text>
                      </View>
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 8,
                          backgroundColor: isAlreadyCheckedOut ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.15)",
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: "Poppins_600SemiBold",
                            fontSize: 11,
                            color: isAlreadyCheckedOut ? "#F59E0B" : "#10B981",
                          }}
                        >
                          {isAlreadyCheckedOut ? "Already Checked Out" : "In-House (Active)"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Bedding Notice */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      backgroundColor: isDark ? "rgba(245, 158, 11, 0.12)" : "#FEF3C7",
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderRadius: 12,
                      marginBottom: 18,
                    }}
                  >
                    <AlertCircle size={16} color="#F59E0B" />
                    <Text
                      style={{
                        fontFamily: "Poppins_400Regular",
                        fontSize: 11.5,
                        color: isDark ? "#FDE68A" : "#B45309",
                        flex: 1,
                      }}
                    >
                      Please ensure all issued bedding items (mattress, pillow, bedsheet) are handed over to the desk.
                    </Text>
                  </View>

                  {/* Action Buttons */}
                  <View style={{ gap: 10 }}>
                    <TouchableOpacity
                      onPress={handleConfirmCheckout}
                      disabled={confirming}
                      activeOpacity={0.8}
                      style={{
                        backgroundColor: "#EF4444",
                        borderRadius: 14,
                        paddingVertical: 14,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                      }}
                    >
                      {confirming ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <LogOut size={18} color="#FFFFFF" />
                          <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#FFFFFF", fontSize: 15 }}>
                            Confirm Checkout
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleReset}
                      activeOpacity={0.7}
                      style={{
                        paddingVertical: 10,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ fontFamily: "Poppins_500Medium", color: textSecondary, fontSize: 13 }}>
                        Cancel & Rescan
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      )}
    </View>
  );
}
