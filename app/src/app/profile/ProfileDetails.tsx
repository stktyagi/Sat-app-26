// src/screens/App/Profile/ProfileDetailsScreen.tsx
import React from "react";
import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from 'expo-router';
import { useUserStore } from "@/state/userStore";
import Header from "@/components/layout/Header";
import { Linking } from "react-native";
import { getDeleteFlag } from "@/utils/versionCheck";
import { Button, showAlert } from "@/components";
import { setStringAsync } from "expo-clipboard";
const ProfileDetailsScreen = () => {
  const router = useRouter();
  const { userData: userProfile } = useUserStore();
  const [isDelete, setIsDelete] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    const fetchDeleteFlag = async () => {
      const flag = await getDeleteFlag();
      setIsDelete(flag);
    };
    fetchDeleteFlag();
  }, []);

  const InfoRow = ({
    label,
    value,
    icon,
  }: {
    label: string;
    value: string;
    icon: any;
  }) => (
    <View className="flex-row items-center py-4 border-b border-[#A0B3D0]/30">
      <View className="w-10 h-10 rounded-full bg-[#EEB170]/20 items-center justify-center mr-4">
        <Ionicons name={icon} size={20} color="#EEB170" />
      </View>
      <View className="flex-1">
        <Text
          style={{ fontFamily: "Outfit_400Regular" }}
          className="text-[#2175C0] text-sm mb-1"
        >
          {label}
        </Text>
        <Text
          style={{ fontFamily: "Outfit_500Medium" }}
          className="text-[#0C3572] text-base"
        >
          {value}
        </Text>
      </View>
    </View>
  );

  const handleDeleteAccount = async () => {
    if (!isDelete) {
      Linking.openURL("https://saturnalia.in/deleteuser");
      return;
    }

    if (!userProfile?.userId) {
      showAlert(
        "Error",
        "Cannot delete account: user information not available"
      );
      return;
    }

    showAlert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently removed.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            try {
              /* Removed API call */
              showAlert(
                "Account Deleted",
                "Your account has been successfully deleted.",
                [
                  {
                    text: "OK",
                    onPress: async () => {
                      /* Removed API call */
                    },
                  },
                ]
              );
            } catch (error: any) {
              console.error("Account deletion error:", error);
              showAlert(
                "Deletion Failed",
                error?.message ||
                  "Failed to delete account. Please try again or contact support."
              );
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-transparent">
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <Header />

      <View className="flex-row items-center justify-between mb-4 px-6 mt-6">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="#0C3572" />
        </TouchableOpacity>
        <Text
          style={{ fontFamily: "Outfit_700Bold" }}
          className="text-[#0C3572] text-2xl"
        >
          Profile Details
        </Text>
        <View className="w-12" />
      </View>

      <ScrollView
        className="flex-1 px-6"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Profile Summary Card */}
        <View className="bg-[#FFFFFF] rounded-2xl p-6 mb-6">
          <View className="flex-row items-center mb-4">
            <View className="w-16 h-16 rounded-full bg-[#EEB170]/20 items-center justify-center mr-4">
              <Text
                style={{ fontFamily: "Outfit_700Bold" }}
                className="text-[#EEB170] text-2xl"
              >
                {userProfile?.displayName?.charAt(0).toUpperCase() || "U"}
              </Text>
            </View>
            <View className="flex-1">
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className="text-[#0C3572] text-xl mb-1"
              >
                {userProfile?.displayName || "User Name"}
              </Text>
              <Text
                style={{ fontFamily: "Outfit_400Regular" }}
                className="text-[#2175C0] text-sm"
              >
                {userProfile?.email || "email@example.com"}
              </Text>
            </View>
          </View>

          {/* Quick Info Pills */}
          <View className="flex-row flex-wrap gap-2 mt-2">
            <View className="bg-[#FFFFFF66] px-3 py-2 rounded-full flex-row items-center border-[1px]">
              <Ionicons name="school" size={14} color="#EEB170" />
              <Text
                style={{ fontFamily: "Outfit_400Regular" }}
                className="text-[#2175C0] text-xs ml-1"
              >
                {userProfile?.email?.includes("thapar")
                  ? "Host College"
                  : "Visitor"}
              </Text>
            </View>
            {userProfile?.graduationYear && (
              <View className="bg-[#FFFFFF66] px-3 py-2 rounded-full flex-row items-center border-[1px]">
                <Ionicons name="calendar" size={14} color="#EEB170" />
                <Text
                  style={{ fontFamily: "Outfit_400Regular" }}
                  className="text-[#2175C0] text-xs ml-1"
                >
                  Class of {userProfile.graduationYear}
                </Text>
              </View>
            )}
          </View>
        
        </View>

        {/* Personal Information Card */}
        <View className="bg-[#FFFFFF] rounded-2xl p-6 mb-6">
          <View className="flex-row items-center mb-4">
            <Ionicons name="person-circle" size={24} color="#EEB170" />
            <Text
              style={{ fontFamily: "Outfit_600SemiBold" }}
              className="text-[#0C3572] text-lg ml-2"
            >
              Personal Information
            </Text>
          </View>

          <InfoRow
            label="Full Name"
            value={userProfile?.displayName || "Not provided"}
            icon="person"
          />
          <InfoRow
            label="Email Address"
            value={userProfile?.email || "Not provided"}
            icon="mail"
          />
      {!isDelete && (
        <InfoRow
        label="Phone Number"
        value={userProfile?.phoneNumber || "Not provided"}
        icon="call"
        />
      )}
        </View>

        {/* Academic Information Card */}
        <View className="bg-[#FFFFFF] rounded-2xl p-6 mb-6">
          <View className="flex-row items-center mb-4">
            <Ionicons name="school" size={24} color="#EEB170" />
            <Text
              style={{ fontFamily: "Outfit_600SemiBold" }}
              className="text-[#0C3572] text-lg ml-2"
            >
              Academic Information
            </Text>
          </View>

          <InfoRow
            label="College/University"
            value={userProfile?.collegeName || "Not provided"}
            icon="business"
          />
          <InfoRow
            label="Roll Number"
            value={userProfile?.rollNumber || "Not provided"}
            icon="card"
          />
          <View className="flex-row items-center py-4">
            <View className="w-10 h-10 rounded-full bg-[#EEB170]/20 items-center justify-center mr-4">
              <Ionicons name="calendar" size={20} color="#EEB170" />
            </View>
            <View className="flex-1">
              <Text
                style={{ fontFamily: "Outfit_400Regular" }}
                className="text-[#2175C0] text-sm mb-1"
              >
                Graduation Year
              </Text>
              <Text
                style={{ fontFamily: "Outfit_500Medium" }}
                className="text-[#0C3572] text-base"
              >
                {userProfile?.graduationYear?.toString() || "Not provided"}
              </Text>
            </View>
          </View>
        </View>

        {/* Account Statistics Card */}
        <View className="bg-[#FFFFFF] rounded-2xl p-6 mb-6">
          <View className="flex-row items-center mb-4">
            <Ionicons name="stats-chart" size={24} color="#EEB170" />
            <Text
              style={{ fontFamily: "Outfit_600SemiBold" }}
              className="text-[#0C3572] text-lg ml-2"
            >
              Account Info
            </Text>
          </View>

          <View className="bg-[#FFFFFF66] rounded-xl p-4">
            <View className="flex-row items-center">
              <Ionicons name="shield-checkmark" size={20} color="#10B981" />
              <View className="flex-1 ml-3">
                <Text
                  style={{ fontFamily: "Outfit_500Medium" }}
                  className="text-[#0C3572] text-sm mb-1"
                >
                  Account Status
                </Text>
                <Text
                  style={{ fontFamily: "Outfit_400Regular" }}
                  className="text-[#2175C0] text-xs"
                >
                  Your account is active and verified
                </Text>
              </View>
              <View className="bg-green-500/20 px-3 py-1 rounded-full">
                <Text
                  style={{ fontFamily: "Outfit_500Medium" }}
                  className="text-green-400 text-xs"
                >
                  Active
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Help Section */}
        <View className="bg-[#FFFFFF] rounded-2xl p-6 mb-6">
          <View className="flex-row items-center mb-4">
            <Ionicons name="information-circle" size={24} color="#EEB170" />
            <Text
              style={{ fontFamily: "Outfit_600SemiBold" }}
              className="text-[#0C3572] text-lg ml-2"
            >
              Need Help?
            </Text>
          </View>

          <Text
            style={{ fontFamily: "Outfit_400Regular" }}
            className="text-[#2175C0] text-sm leading-6"
          >
            If you need to update your profile information or have any
            questions, please contact the event organizers.
          </Text>

          <Button
            title="Delete My Account"
            variant="danger"
            className="mt-4"
            loading={isDeleting}
            disabled={isDeleting}
            onPress={handleDeleteAccount}
          />
        </View>
      </ScrollView>
    </View>
  );
};

export default ProfileDetailsScreen;
