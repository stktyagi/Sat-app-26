// src/components/admin/UserQRScannerModal.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { ArrowLeft, QrCode } from "lucide-react-native";
import { showAlert } from "../index";

const { width } = Dimensions.get("window");

interface UserQRScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onUserIdScanned: (userId: string) => void;
}

const UserQRScannerModal: React.FC<UserQRScannerModalProps> = ({
  visible,
  onClose,
  onUserIdScanned,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [cameraKey, setCameraKey] = useState(Date.now());
  const [cameraReady, setCameraReady] = useState(false);

  // Reset camera when modal opens or closes
  useEffect(() => {
    if (visible) {
      setScanned(false);
      setCameraReady(false);

      const timer = setTimeout(() => {
        setCameraKey(Date.now());
        setTimeout(() => {
          setCameraReady(true);
        }, 200);
      }, 100);

      return () => {
        clearTimeout(timer);
        setScanned(false);
        setCameraReady(false);
      };
    }
  }, [visible]);

  const handleBarcodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;

    setScanned(true);

    // Extract userId from QR data
    // QR data should contain just the userId
    if (data && data.trim()) {
      onUserIdScanned(data.trim());
      // Don't close immediately - let parent handle it
    } else {
      showAlert("Invalid QR Code", "The scanned QR code does not contain valid user information.", [
        { text: "Try Again", onPress: () => setScanned(false) },
      ]);
    }
  };

  if (!permission) {
    return null;
  }

  if (!permission.granted) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View className="flex-1 bg-black/90 justify-center items-center px-6">
          <View className="bg-[#1A1A1A] rounded-2xl p-6 w-full max-w-sm">
            <Text
              style={{ fontFamily: "Outfit_600SemiBold" }}
              className="text-white text-lg text-center mb-4"
            >
              Camera Permission Required
            </Text>
            <Text
              style={{ fontFamily: "Outfit_400Regular" }}
              className="text-gray-400 text-center mb-6"
            >
              Camera permission is required to scan user QR codes
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 bg-[#2C2C2C] px-6 py-3 rounded-xl"
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text
                  style={{ fontFamily: "Outfit_600SemiBold" }}
                  className="text-white text-center"
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-[#FFBA00] px-6 py-3 rounded-xl"
                onPress={requestPermission}
                activeOpacity={0.7}
              >
                <Text
                  style={{ fontFamily: "Outfit_600SemiBold" }}
                  className="text-[#121212] text-center"
                >
                  Grant Permission
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black">
        {/* Camera View */}
        {cameraReady ? (
          <CameraView
            key={`user-qr-camera-${cameraKey}`}
            style={{ flex: 1 }}
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["qr", "pdf417"],
            }}
          >
            {/* Scanner Frame - Centered */}
            <View className="flex-1 items-center justify-center">
              <View className="relative">
                <View
                  className="rounded-2xl bg-transparent"
                  style={{ width: 250, height: 250 }}
                >
                  {/* Corner indicators */}
                  <View className="absolute -top-1 -left-1 w-8 h-8 border-l-4 border-t-4 border-[#FFBA00] rounded-tl-lg" />
                  <View className="absolute -top-1 -right-1 w-8 h-8 border-r-4 border-t-4 border-[#FFBA00] rounded-tr-lg" />
                  <View className="absolute -bottom-1 -left-1 w-8 h-8 border-l-4 border-b-4 border-[#FFBA00] rounded-bl-lg" />
                  <View className="absolute -bottom-1 -right-1 w-8 h-8 border-r-4 border-b-4 border-[#FFBA00] rounded-br-lg" />
                </View>
              </View>
            </View>
          </CameraView>
        ) : (
          <View className="flex-1 bg-black items-center justify-center">
            <Text className="text-white text-base">Initializing camera...</Text>
          </View>
        )}

        {/* Absolute Overlay Container - All UI elements */}
        <View className="absolute inset-0" pointerEvents="box-none">
          {/* Header Row - Back Button and Title */}
          <View className="absolute top-12 left-6 right-6 flex-row items-center">
            <TouchableOpacity
              onPress={onClose}
              className="bg-black/70 rounded-full p-3 mr-4"
              activeOpacity={0.7}
            >
              <ArrowLeft size={24} color="white" />
            </TouchableOpacity>

            <View className="flex-1 items-center" pointerEvents="none">
              <Text className="text-white text-xl font-bold text-center">
                Scan User QR Code
              </Text>
            </View>

            {/* Invisible spacer to balance the layout */}
            <View style={{ width: 56 }} pointerEvents="none" />
          </View>

          {/* Status Message */}
          <View className="absolute bottom-36 left-4 right-4" pointerEvents="none">
            <View className="bg-black/70 rounded-xl px-4 py-3">
              <Text className="text-white text-center font-semibold text-base">
                {scanned ? "Processing..." : "Position QR code in the frame"}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default UserQRScannerModal;
