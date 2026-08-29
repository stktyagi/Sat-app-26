import React from "react";
import { View, Text, Modal, TouchableOpacity, StatusBar } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";

interface UserQRCodeModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

const UserQRCodeModal: React.FC<UserQRCodeModalProps> = ({
  visible,
  onClose,
  userId,
  userName,
}) => {


  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <StatusBar backgroundColor="#040D2D" barStyle="light-content" />
      <View className="flex-1 bg-black/80 justify-center items-center px-6">
        <View className="bg-white rounded-3xl p-8 w-full max-w-sm relative">
          {/* Close Button */}
          <TouchableOpacity
            onPress={onClose}
            className="absolute top-4 right-4 z-10 bg-gray-100 rounded-full p-2"
          >
            <Ionicons name="close" size={24} color="#0C3572" />
          </TouchableOpacity>

          {/* Header */}
          <View className="items-center mb-6 mt-4">
            <Text
              style={{ fontFamily: "Outfit_700Bold" }}
              className="text-[#0C3572] text-xl mb-2"
            >
              Your QR Code
            </Text>
            <Text
              style={{ fontFamily: "Outfit_500Medium" }}
              className="text-[#2175C0] text-sm text-center"
            >
              Show this QR code to access your profile
            </Text>
          </View>

          {/* QR Code Container */}
          <View className="bg-white rounded-2xl p-10 items-center mb-6">
            {userId && userId.length > 0 ? (
              <QRCode
                value={userId}
                size={200}
                color="#000000"
                backgroundColor="#ffffff"
              />
            ) : (
              <View className="w-[200px] h-[200px] items-center justify-center bg-gray-200 rounded-xl">
                <Text className="text-gray-600 text-center text-sm">
                  No User ID Available
                </Text>
              </View>
            )}
          </View>

          {/* User Info */}
          <View className="items-center">
            <Text
              style={{ fontFamily: "Outfit_600SemiBold" }}
              className="text-[#0C3572] text-lg mb-1"
            >
              {userName}
            </Text>
          </View>

          {/* Info Text */}
          <View className="mt-6 bg-[#FFFFFF66] rounded-xl p-4">
            <Text
              style={{ fontFamily: "Outfit_500Medium" }}
              className="text-[#2175C0] text-xs text-center"
            >
              This QR code contains your unique user ID for quick access to your
              accommodation, food orders, and other services.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default UserQRCodeModal;
