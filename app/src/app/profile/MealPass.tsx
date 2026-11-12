import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Animated,
  Easing,
  Vibration,
  Platform,
  Dimensions,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Zap,
  ZapOff,
  Check,
  X,
  Utensils,
  Camera,
  RotateCcw,
  ShieldCheck,
  AlertCircle,
  Building,
  User,
  Sparkles,
} from "lucide-react-native";
import { useUserStore } from "@/state/userStore";
import { useThemeStore } from "@/state/themeStore";
import { verifyMealPassQR, MealVerificationResult } from "@/api/mealPass";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SCANNER_SIZE = Math.min(SCREEN_WIDTH * 0.72, 280);

export default function MealPassScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const { userData: user, refreshUserProfile } = useUserStore();

  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraKey, setCameraKey] = useState(Date.now());
  const [torchOn, setTorchOn] = useState(false);

  // Scanning & verification state
  const [scanned, setScanned] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<MealVerificationResult | null>(null);
  const [showCheckInAlert, setShowCheckInAlert] = useState(true);

  // ── Animations ────────────────────────────────────────────────────────────
  // 1. Scanning laser beam animation
  const laserAnim = useRef(new Animated.Value(0)).current;

  // 2. Result modal entrance spring & opacity
  const modalScale = useRef(new Animated.Value(0.85)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;

  // 3. Success badge pop & rotation
  const badgeScale = useRef(new Animated.Value(0)).current;

  // 4. Expanding pulsing halo rings
  const ring1Scale = useRef(new Animated.Value(1)).current;
  const ring1Opacity = useRef(new Animated.Value(0.7)).current;
  const ring2Scale = useRef(new Animated.Value(1)).current;
  const ring2Opacity = useRef(new Animated.Value(0.7)).current;

  // 5. Celebration burst particles (scale & spread)
  const particlesAnim = useRef(new Animated.Value(0)).current;

  // 6. Shake animation for negative result
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Start continuous scanner laser animation
  useEffect(() => {
    const laserLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(laserAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(laserAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    laserLoop.start();
    return () => laserLoop.stop();
  }, [laserAnim]);

  // Reset camera when screen gains focus
  useFocusEffect(
    useCallback(() => {
      setScanned(false);
      setVerifying(false);
      setVerificationResult(null);
      setCameraReady(false);
      setTorchOn(false);

      const timer = setTimeout(() => {
        setCameraKey(Date.now());
        setTimeout(() => {
          setCameraReady(true);
        }, 150);
      }, 100);

      // Refresh profile silently in background
      refreshUserProfile().catch(() => {});

      return () => {
        clearTimeout(timer);
        setCameraReady(false);
        setTorchOn(false);
      };
    }, [refreshUserProfile])
  );

  // Play celebration animation when result is PAID
  const playPaidAnimation = () => {
    // Reset values
    modalScale.setValue(0.85);
    modalOpacity.setValue(0);
    badgeScale.setValue(0);
    particlesAnim.setValue(0);
    ring1Scale.setValue(1);
    ring1Opacity.setValue(0.7);
    ring2Scale.setValue(1);
    ring2Opacity.setValue(0.7);

    // Modal entrance
    Animated.parallel([
      Animated.timing(modalOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(modalScale, {
        toValue: 1,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.spring(badgeScale, {
        toValue: 1,
        friction: 5,
        tension: 40,
        delay: 100,
        useNativeDriver: true,
      }),
      Animated.timing(particlesAnim, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.back(1.5)),
        delay: 150,
        useNativeDriver: true,
      }),
    ]).start();

    // Looping pulsing halo rings
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(ring1Scale, {
            toValue: 1.6,
            duration: 1600,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(ring1Scale, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(ring1Opacity, {
            toValue: 0,
            duration: 1600,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(ring1Opacity, {
            toValue: 0.7,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(400),
          Animated.timing(ring2Scale, {
            toValue: 1.8,
            duration: 1600,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(ring2Scale, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(400),
          Animated.timing(ring2Opacity, {
            toValue: 0,
            duration: 1600,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(ring2Opacity, {
            toValue: 0.6,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();
  };

  // Play shake animation for unpaid/rejected result
  const playUnpaidAnimation = () => {
    modalScale.setValue(0.85);
    modalOpacity.setValue(0);
    shakeAnim.setValue(0);

    Animated.parallel([
      Animated.timing(modalOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(modalScale, {
        toValue: 1,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();
    });
  };

  // ── Handle Barcode Scanned ────────────────────────────────────────────────
  const handleBarcodeScanned = async ({ data }: { type: string; data: string }) => {
    if (scanned || verifying || !data) return;

    setScanned(true);
    setVerifying(true);

    // Subtle tactile confirmation
    try {
      Vibration.vibrate(Platform.OS === "android" ? 60 : [0, 60]);
    } catch {
      // ignore
    }

    try {
      const res = await verifyMealPassQR(data, user);
      setVerificationResult(res);

      if (res.paid) {
        playPaidAnimation();
      } else {
        playUnpaidAnimation();
      }
    } catch (err: any) {
      const fallback: MealVerificationResult = {
        paid: false,
        statusText: "ERROR",
        message: err.message || "Could not process QR code",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setVerificationResult(fallback);
      playUnpaidAnimation();
    } finally {
      setVerifying(false);
    }
  };

  const handleResetScanner = () => {
    setScanned(false);
    setVerifying(false);
    setVerificationResult(null);
    setShowCheckInAlert(true);
  };

  // Particle positions for celebration burst around center
  const particleAngles = [0, 45, 90, 135, 180, 225, 270, 315];
  const particleColors = [
    "#10B981", // emerald
    "#41B8F0", // cyan
    "#F59E0B", // amber
    "#10B981", // emerald
    "#38BDF8", // sky blue
    "#F59E0B", // amber
    "#10B981", // emerald
    "#A78BFA", // lavender
  ];

  // Colors & Theme
  const bgColor = isDark ? "#131316" : "#E0E0E0";
  const cardBg = isDark ? "#1C1C20" : "#FFFFFF";
  const cardBorder = isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)";
  const textPrimary = isDark ? "#FFFFFF" : "#111827";
  const textSecondary = isDark ? "#9CA3AF" : "#6B7280";

  // Laser translation interpolation
  const laserTranslateY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCANNER_SIZE - 6],
  });

  // Camera Permission Handling
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

        {/* Header */}
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
            Meal Pass
          </Text>
        </View>

        {/* Permission Request Body */}
        <View style={{ alignItems: "center", paddingHorizontal: 12 }}>
          <View
            style={{
              width: 90,
              height: 90,
              borderRadius: 45,
              backgroundColor: "rgba(65, 184, 240, 0.15)",
              borderWidth: 2,
              borderColor: "#41B8F0",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <Camera size={44} color="#41B8F0" />
          </View>

          <Text
            style={{
              fontFamily: "Poppins_600SemiBold",
              fontSize: 20,
              color: textPrimary,
              textAlign: "center",
              marginBottom: 10,
            }}
          >
            Camera Access Required
          </Text>

          <Text
            style={{
              fontFamily: "Poppins_400Regular",
              fontSize: 14,
              color: textSecondary,
              textAlign: "center",
              lineHeight: 22,
            }}
          >
            To scan the QR code placed at your hostel mess counter and verify your meal pass, camera permission is required.
          </Text>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          onPress={requestPermission}
          activeOpacity={0.8}
          style={{
            backgroundColor: "#41B8F0",
            paddingVertical: 15,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 16, color: "#FFFFFF" }}>
            Enable Camera
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
      <StatusBar barStyle="light-content" />

      {/* ── Camera Viewfinder ── */}
      {cameraReady ? (
        <CameraView
          key={`meal-camera-${cameraKey}`}
          style={{ flex: 1 }}
          facing="back"
          enableTorch={torchOn}
          onBarcodeScanned={scanned || verifying ? undefined : handleBarcodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
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

      {/* ── Scanner Mask & Frame Overlay ── */}
      <View
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          alignItems: "center",
          justifyContent: "center",
        }}
        pointerEvents="none"
      >
        {/* Scanner Target Box */}
        <View
          style={{
            width: SCANNER_SIZE,
            height: SCANNER_SIZE,
            borderRadius: 24,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Subtle translucent dark tint inside box */}
          <View
            style={{
              ...Platform.select({
                ios: { backgroundColor: "rgba(255, 255, 255, 0.03)" },
                android: { backgroundColor: "rgba(255, 255, 255, 0.02)" },
              }),
              flex: 1,
            }}
          />

          {/* Animated Laser Scanning Beam */}
          {!scanned && cameraReady && (
            <Animated.View
              style={{
                position: "absolute",
                left: 12,
                right: 12,
                height: 3,
                backgroundColor: "#41B8F0",
                borderRadius: 2,
                shadowColor: "#41B8F0",
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.9,
                shadowRadius: 8,
                elevation: 6,
                transform: [{ translateY: laserTranslateY }],
              }}
            />
          )}

          {/* Neon Corner Brackets */}
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: 38,
              height: 38,
              borderLeftWidth: 4,
              borderTopWidth: 4,
              borderColor: "#41B8F0",
              borderTopLeftRadius: 20,
            }}
          />
          <View
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 38,
              height: 38,
              borderRightWidth: 4,
              borderTopWidth: 4,
              borderColor: "#41B8F0",
              borderTopRightRadius: 20,
            }}
          />
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              width: 38,
              height: 38,
              borderLeftWidth: 4,
              borderBottomWidth: 4,
              borderColor: "#41B8F0",
              borderBottomLeftRadius: 20,
            }}
          />
          <View
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 38,
              height: 38,
              borderRightWidth: 4,
              borderBottomWidth: 4,
              borderColor: "#41B8F0",
              borderBottomRightRadius: 20,
            }}
          />
        </View>

        {/* Viewfinder Instructions Banner */}
        <View
          style={{
            marginTop: 28,
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 20,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.15)",
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Utensils size={16} color="#41B8F0" />
          <Text
            style={{
              fontFamily: "Poppins_500Medium",
              fontSize: 13,
              color: "#FFFFFF",
              letterSpacing: 0.2,
            }}
          >
            Scan hostel mess QR to verify meal
          </Text>
        </View>
      </View>

      {/* ── Top Bar Overlay (Back, Title, Torch) ── */}
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
          onPress={() => router.back()}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: "rgba(0, 0, 0, 0.65)",
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.2)",
            alignItems: "center",
            justifyContent: "center",
          }}
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <View
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.65)",
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.15)",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontFamily: "Talina",
              fontSize: 18,
              color: "#FFFFFF",
              letterSpacing: 0.5,
            }}
          >
            Meal Pass
          </Text>
          <Text
            style={{
              fontFamily: "Poppins_400Regular",
              fontSize: 11,
              color: "#41B8F0",
            }}
          >
            Mess Verification
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setTorchOn((prev) => !prev)}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: torchOn ? "#41B8F0" : "rgba(0, 0, 0, 0.65)",
            borderWidth: 1,
            borderColor: torchOn ? "#41B8F0" : "rgba(255, 255, 255, 0.2)",
            alignItems: "center",
            justifyContent: "center",
          }}
          activeOpacity={0.7}
        >
          {torchOn ? <Zap size={20} color="#FFFFFF" /> : <ZapOff size={20} color="#FFFFFF" />}
        </TouchableOpacity>
      </View>

      {/* ── Verifying Loading Indicator ── */}
      {verifying && (
        <View
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 40,
          }}
        >
          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: 20,
              padding: 24,
              alignItems: "center",
              borderWidth: 1,
              borderColor: cardBorder,
              maxWidth: 280,
            }}
          >
            <ActivityIndicator size="large" color="#41B8F0" />
            <Text
              style={{
                fontFamily: "Poppins_600SemiBold",
                fontSize: 16,
                color: textPrimary,
                marginTop: 14,
                textAlign: "center",
              }}
            >
              Verifying Meal Pass...
            </Text>
            <Text
              style={{
                fontFamily: "Poppins_400Regular",
                fontSize: 12,
                color: textSecondary,
                marginTop: 4,
                textAlign: "center",
              }}
            >
              Checking hostel mess payment
            </Text>
          </View>
        </View>
      )}

      {/* ── Verification Result Modal with Normal Nice Animation ── */}
      {verificationResult && !verifying && (
        <View
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "rgba(0, 0, 0, 0.82)",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 20,
            zIndex: 50,
          }}
        >
          <Animated.View
            style={{
              width: "100%",
              maxWidth: 380,
              backgroundColor: cardBg,
              borderRadius: 28,
              borderWidth: 2,
              borderColor: verificationResult.paid
                ? "rgba(16, 185, 129, 0.6)"
                : "rgba(239, 68, 68, 0.6)",
              paddingHorizontal: 22,
              paddingTop: 32,
              paddingBottom: 24,
              alignItems: "center",
              opacity: modalOpacity,
              transform: [
                { scale: modalScale },
                { translateX: shakeAnim },
              ],
              shadowColor: verificationResult.paid ? "#10B981" : "#EF4444",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.35,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            {/* ── Paid Celebration Icon Animation ── */}
            {verificationResult.paid ? (
              <View style={{ width: 140, height: 140, alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                {/* Expanding Halo Ring 1 */}
                <Animated.View
                  style={{
                    position: "absolute",
                    width: 100,
                    height: 100,
                    borderRadius: 50,
                    borderWidth: 3,
                    borderColor: "#10B981",
                    opacity: ring1Opacity,
                    transform: [{ scale: ring1Scale }],
                  }}
                />

                {/* Expanding Halo Ring 2 */}
                <Animated.View
                  style={{
                    position: "absolute",
                    width: 100,
                    height: 100,
                    borderRadius: 50,
                    borderWidth: 2,
                    borderColor: "#34D399",
                    opacity: ring2Opacity,
                    transform: [{ scale: ring2Scale }],
                  }}
                />

                {/* Celebration Particles Starburst */}
                {particleAngles.map((angle, idx) => {
                  const rad = (angle * Math.PI) / 180;
                  const distance = 58;
                  const tx = particlesAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, Math.cos(rad) * distance],
                  });
                  const ty = particlesAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, Math.sin(rad) * distance],
                  });
                  const pScale = particlesAnim.interpolate({
                    inputRange: [0, 0.6, 1],
                    outputRange: [0, 1.4, 1],
                  });

                  return (
                    <Animated.View
                      key={`particle-${idx}`}
                      style={{
                        position: "absolute",
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: particleColors[idx],
                        transform: [{ translateX: tx }, { translateY: ty }, { scale: pScale }],
                      }}
                    />
                  );
                })}

                {/* Center Badge Pop */}
                <Animated.View
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: 44,
                    backgroundColor: "#10B981",
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: "#10B981",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.5,
                    shadowRadius: 12,
                    elevation: 8,
                    transform: [{ scale: badgeScale }],
                  }}
                >
                  <Utensils size={42} color="#FFFFFF" strokeWidth={2.3} />
                  <View
                    style={{
                      position: "absolute",
                      bottom: -2,
                      right: -2,
                      width: 30,
                      height: 30,
                      borderRadius: 15,
                      backgroundColor: "#059669",
                      borderWidth: 2,
                      borderColor: "#FFFFFF",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Check size={18} color="#FFFFFF" strokeWidth={3} />
                  </View>
                </Animated.View>
              </View>
            ) : (
              /* ── Unpaid / Rejected Icon Badge ── */
              <View
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: 45,
                  backgroundColor: "rgba(239, 68, 68, 0.15)",
                  borderWidth: 3,
                  borderColor: "#EF4444",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <X size={48} color="#EF4444" strokeWidth={2.5} />
              </View>
            )}

            {/* Title & Status Pill */}
            <Text
              style={{
                fontFamily: "Talina",
                fontSize: 24,
                color: verificationResult.paid ? "#10B981" : "#EF4444",
                textAlign: "center",
                marginBottom: 6,
                letterSpacing: 0.5,
              }}
            >
              {verificationResult.paid ? "MEAL PASS VERIFIED" : "MEAL NOT PAID"}
            </Text>

            {/* Status Chip */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: verificationResult.paid
                  ? "rgba(16, 185, 129, 0.12)"
                  : "rgba(239, 68, 68, 0.12)",
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderRadius: 20,
                marginBottom: 12,
              }}
            >
              {verificationResult.paid ? (
                <ShieldCheck size={15} color="#10B981" />
              ) : (
                <AlertCircle size={15} color="#EF4444" />
              )}
              <Text
                style={{
                  fontFamily: "Poppins_600SemiBold",
                  fontSize: 12,
                  color: verificationResult.paid ? "#10B981" : "#EF4444",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {verificationResult.statusText}
              </Text>
            </View>

            {/* Subtitle / Message */}
            <Text
              style={{
                fontFamily: "Poppins_400Regular",
                fontSize: 13,
                color: textSecondary,
                textAlign: "center",
                lineHeight: 19,
                paddingHorizontal: 8,
                marginBottom: 18,
              }}
            >
              {verificationResult.message}
            </Text>

            {/* Closable Accommodation Check-in Notice */}
            {verificationResult.paid && verificationResult.needsAccommodationCheckIn && showCheckInAlert && (
              <View
                style={{
                  width: "100%",
                  backgroundColor: isDark ? "rgba(245, 158, 11, 0.15)" : "#FEF3C7",
                  borderWidth: 1,
                  borderColor: isDark ? "rgba(245, 158, 11, 0.35)" : "#FDE68A",
                  borderRadius: 14,
                  padding: 12,
                  marginBottom: 16,
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <AlertCircle size={18} color="#F59E0B" style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: "Poppins_600SemiBold",
                      fontSize: 12,
                      color: isDark ? "#FBBF24" : "#B45309",
                      marginBottom: 2,
                    }}
                  >
                    Hostel Check-in Reminder
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Poppins_400Regular",
                      fontSize: 11,
                      color: isDark ? "#FCD34D" : "#92400E",
                      lineHeight: 16,
                    }}
                  >
                    You have not checked into your hostel accommodation yet. Please visit the accommodation desk to check in.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowCheckInAlert(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{
                    padding: 4,
                    borderRadius: 12,
                    backgroundColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.05)",
                  }}
                  activeOpacity={0.7}
                >
                  <X size={14} color={isDark ? "#FCD34D" : "#B45309"} />
                </TouchableOpacity>
              </View>
            )}

            {/* Student & Pass Verification Details Card */}
            <View
              style={{
                width: "100%",
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.03)",
                borderRadius: 16,
                borderWidth: 1,
                borderColor: cardBorder,
                padding: 14,
                gap: 8,
                marginBottom: 20,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <User size={13} color="#41B8F0" />
                  <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 12, color: textSecondary }}>
                    Student
                  </Text>
                </View>
                <Text
                  style={{
                    fontFamily: "Poppins_600SemiBold",
                    fontSize: 13,
                    color: textPrimary,
                    maxWidth: 180,
                  }}
                  numberOfLines={1}
                >
                  {user?.displayName || "Participant"}
                </Text>
              </View>

              {user?.rollNumber ? (
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 12, color: textSecondary, marginLeft: 19 }}>
                    Roll No
                  </Text>
                  <Text style={{ fontFamily: "Poppins_500Medium", fontSize: 12, color: textPrimary }}>
                    {user.rollNumber}
                  </Text>
                </View>
              ) : null}

              {user?.collegeName ? (
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Building size={13} color="#41B8F0" />
                    <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 12, color: textSecondary }}>
                      College
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontFamily: "Poppins_500Medium",
                      fontSize: 12,
                      color: textPrimary,
                      maxWidth: 180,
                    }}
                    numberOfLines={1}
                  >
                    {user.collegeName}
                  </Text>
                </View>
              ) : null}

              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: cardBorder,
                  paddingTop: 8,
                  marginTop: 2,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 11, color: textSecondary }}>
                  Scanned At
                </Text>
                <Text style={{ fontFamily: "Poppins_500Medium", fontSize: 11, color: textPrimary }}>
                  {verificationResult.timestamp}
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={{ width: "100%", gap: 10 }}>
              <TouchableOpacity
                onPress={handleResetScanner}
                activeOpacity={0.8}
                style={{
                  width: "100%",
                  backgroundColor: verificationResult.paid ? "#10B981" : "#41B8F0",
                  paddingVertical: 14,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 8,
                }}
              >
                <RotateCcw size={18} color="#FFFFFF" />
                <Text
                  style={{
                    fontFamily: "Poppins_600SemiBold",
                    fontSize: 15,
                    color: "#FFFFFF",
                  }}
                >
                  {verificationResult.paid ? "Done / Scan Another" : "Scan Again"}
                </Text>
              </TouchableOpacity>

              {/* If unpaid, provide shortcut to buy food/accommodation pass */}
              {!verificationResult.paid && (
                <TouchableOpacity
                  onPress={() => {
                    handleResetScanner();
                    router.push("/profile/Accommodation");
                  }}
                  activeOpacity={0.75}
                  style={{
                    width: "100%",
                    paddingVertical: 12,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isDark ? "#24242A" : "#E5E7EB",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Poppins_500Medium",
                      fontSize: 13,
                      color: textPrimary,
                    }}
                  >
                    Get Food & Accommodation Pass
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        </View>
      )}
    </View>
  );
}
