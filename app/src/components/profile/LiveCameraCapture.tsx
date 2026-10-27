import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from "react-native";
import { CameraView, useCameraPermissions, CameraType } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useThemeStore } from "@/state/themeStore";

interface LiveCameraCaptureProps {
  mode: "selfie" | "document";
  title: string;
  subtitle: string;
  instruction: string;
  confirmButtonText: string;
  isUploading: boolean;
  onConfirm: (uri: string) => Promise<void>;
  onBack?: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export const LiveCameraCapture: React.FC<LiveCameraCaptureProps> = ({
  mode,
  title,
  subtitle,
  instruction,
  confirmButtonText,
  isUploading,
  onConfirm,
  onBack,
}) => {
  const { isDark } = useThemeStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>(mode === "selfie" ? "front" : "back");
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const bgColor = isDark ? "#131316" : "#F3F4F6";
  const cardBg = isDark ? "#1C1C20" : "#FFFFFF";
  const cardBorder = isDark ? "#2A2A30" : "#E2E8F0";
  const textColor = isDark ? "#FFFFFF" : "#111827";
  const subTextColor = isDark ? "#A0A0A0" : "#6B7280";

  // Permission not loaded yet
  if (!permission) {
    return (
      <View style={[styles.centeredContainer, { backgroundColor: bgColor }]}>
        <ActivityIndicator size="large" color="#41B8F0" />
      </View>
    );
  }

  // Permission not granted
  if (!permission.granted) {
    return (
      <View style={[styles.permissionContainer, { backgroundColor: bgColor }]}>
        <View
          style={[
            styles.permissionCard,
            { backgroundColor: cardBg, borderColor: cardBorder },
          ]}
        >
          <View style={styles.permissionIconCircle}>
            <Ionicons name="camera" size={40} color="#41B8F0" />
          </View>
          <Text style={[styles.permissionTitle, { color: textColor }]}>
            Camera Access Required
          </Text>
          <Text style={[styles.permissionDesc, { color: subTextColor }]}>
            For festival security and accreditation, live camera verification is required.
            Please grant camera permission to continue.
          </Text>
          <TouchableOpacity
            style={styles.grantButton}
            activeOpacity={0.8}
            onPress={requestPermission}
          >
            <Ionicons name="shield-checkmark-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.grantButtonText}>Grant Camera Access</Text>
          </TouchableOpacity>

          {onBack && (
            <TouchableOpacity
              style={styles.backLink}
              onPress={onBack}
              activeOpacity={0.7}
            >
              <Text style={{ color: subTextColor, fontFamily: "Poppins_500Medium", fontSize: 13 }}>
                Go Back
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef.current || isTakingPhoto) return;
    try {
      setIsTakingPhoto(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });
      if (photo?.uri) {
        setCapturedUri(photo.uri);
      }
    } catch (err) {
      console.error("Failed to capture picture:", err);
    } finally {
      setIsTakingPhoto(false);
    }
  };

  const handleRetake = () => {
    setCapturedUri(null);
  };

  const handleConfirmPress = async () => {
    if (!capturedUri || isUploading) return;
    await onConfirm(capturedUri);
  };

  const toggleCameraFacing = () => {
    setFacing((prev) => (prev === "front" ? "back" : "front"));
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Instructions header */}
      <View style={styles.headerArea}>
        <Text style={[styles.title, { color: textColor }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: subTextColor }]}>{subtitle}</Text>
      </View>

      {/* Camera Viewfinder or Captured Preview */}
      <View style={styles.viewfinderCard}>
        {capturedUri ? (
          <View style={styles.previewContainer}>
            <Image
              source={{ uri: capturedUri }}
              style={
                mode === "selfie"
                  ? styles.selfiePreviewImage
                  : styles.documentPreviewImage
              }
              resizeMode={mode === "selfie" ? "cover" : "contain"}
            />
            <View style={styles.successBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.successBadgeText}>Photo Captured</Text>
            </View>
          </View>
        ) : (
          <View style={styles.cameraWrapper}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing={facing}
            >
              {/* Framing Guide Overlay */}
              <View style={styles.overlayContainer}>
                {mode === "selfie" ? (
                  <View style={styles.selfieGuideOverlay} />
                ) : (
                  <View style={styles.documentGuideOverlay} />
                )}

                {/* Flip Camera Button */}
                <TouchableOpacity
                  style={styles.flipButton}
                  onPress={toggleCameraFacing}
                  activeOpacity={0.7}
                >
                  <Ionicons name="camera-reverse" size={22} color="#FFFFFF" />
                </TouchableOpacity>

                {/* Live Badge */}
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              </View>
            </CameraView>
          </View>
        )}
      </View>

      {/* Tip Banner */}
      <View
        style={[
          styles.tipBanner,
          {
            backgroundColor: isDark ? "rgba(65, 184, 240, 0.08)" : "#E0F2FE",
            borderColor: "rgba(65, 184, 240, 0.25)",
          },
        ]}
      >
        <Ionicons name="information-circle" size={18} color="#41B8F0" style={{ marginRight: 8 }} />
        <Text style={[styles.tipText, { color: isDark ? "#BAE6FD" : "#0369A1" }]}>
          {instruction}
        </Text>
      </View>

      {/* Action Controls */}
      <View style={styles.controlsArea}>
        {capturedUri ? (
          <View style={styles.confirmActionsRow}>
            {/* Retake Button */}
            <TouchableOpacity
              style={[
                styles.retakeButton,
                { backgroundColor: cardBg, borderColor: cardBorder },
              ]}
              onPress={handleRetake}
              disabled={isUploading}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={18} color={textColor} style={{ marginRight: 6 }} />
              <Text style={[styles.retakeText, { color: textColor }]}>Retake</Text>
            </TouchableOpacity>

            {/* Confirm & Save Button */}
            <TouchableOpacity
              style={[
                styles.confirmButton,
                { opacity: isUploading ? 0.75 : 1 },
              ]}
              onPress={handleConfirmPress}
              disabled={isUploading}
              activeOpacity={0.85}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color="#131316" style={{ marginRight: 8 }} />
              ) : (
                <Ionicons name="cloud-upload" size={18} color="#131316" style={{ marginRight: 6 }} />
              )}
              <Text style={styles.confirmText}>
                {isUploading ? "Uploading..." : confirmButtonText}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.captureActionsColumn}>
            {/* Live Shutter Button */}
            <TouchableOpacity
              style={[
                styles.shutterButtonOuter,
                { opacity: isTakingPhoto ? 0.6 : 1 },
              ]}
              onPress={handleCapture}
              disabled={isTakingPhoto}
              activeOpacity={0.8}
            >
              {isTakingPhoto ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <View style={styles.shutterButtonInner} />
              )}
            </TouchableOpacity>
            <Text style={[styles.shutterHint, { color: subTextColor }]}>
              Tap to capture live photo
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
  },
  centeredContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  permissionCard: {
    width: "100%",
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
  },
  permissionIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(65, 184, 240, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  permissionTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
    textAlign: "center",
    marginBottom: 8,
  },
  permissionDesc: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  grantButton: {
    backgroundColor: "#41B8F0",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  grantButtonText: {
    fontFamily: "Poppins_600SemiBold",
    color: "#FFFFFF",
    fontSize: 14,
  },
  backLink: {
    marginTop: 16,
    padding: 8,
  },
  headerArea: {
    marginBottom: 14,
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 20,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  viewfinderCard: {
    width: "100%",
    height: SCREEN_WIDTH > 400 ? 330 : 290,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#000000",
    marginBottom: 12,
  },
  cameraWrapper: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  camera: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  overlayContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  selfieGuideOverlay: {
    width: 210,
    height: 240,
    borderRadius: 110,
    borderWidth: 2.5,
    borderColor: "#41B8F0",
    borderStyle: "dashed",
    backgroundColor: "transparent",
  },
  documentGuideOverlay: {
    width: "88%",
    height: 185,
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: "#41B8F0",
    borderStyle: "dashed",
    backgroundColor: "transparent",
  },
  flipButton: {
    position: "absolute",
    top: 14,
    right: 14,
    backgroundColor: "rgba(0,0,0,0.55)",
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  liveIndicator: {
    position: "absolute",
    top: 14,
    left: 14,
    backgroundColor: "rgba(0,0,0,0.6)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
    marginRight: 6,
  },
  liveText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 10,
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  previewContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000000",
  },
  selfiePreviewImage: {
    width: 210,
    height: 240,
    borderRadius: 110,
  },
  documentPreviewImage: {
    width: "90%",
    height: 200,
    borderRadius: 16,
  },
  successBadge: {
    position: "absolute",
    bottom: 12,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderColor: "rgba(16, 185, 129, 0.4)",
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  successBadgeText: {
    fontFamily: "Poppins_600SemiBold",
    color: "#10B981",
    fontSize: 12,
    marginLeft: 6,
  },
  tipBanner: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  tipText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  controlsArea: {
    alignItems: "center",
    justifyContent: "center",
  },
  captureActionsColumn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  shutterButtonOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: "#41B8F0",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(65, 184, 240, 0.15)",
    marginBottom: 8,
  },
  shutterButtonInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#41B8F0",
  },
  shutterHint: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  confirmActionsRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  retakeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  retakeText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
  },
  confirmButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "#FFBA00",
  },
  confirmText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
    color: "#131316",
  },
});
