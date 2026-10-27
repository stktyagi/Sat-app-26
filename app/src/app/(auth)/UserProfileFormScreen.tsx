// src/screens/Auth/UserProfileFormScreen.tsx

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Modal,
  StatusBar,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { showAlert } from "../../components";
import Input from "@/components/ui/Input";
import { UserProfile } from "@/types/models";
import { Ionicons } from "@expo/vector-icons";
import { CollegeDropdown } from "@/components/ui/CollegeDropdown";
import { getDeleteFlag } from "@/utils/versionCheck";
import { getAuthInstance } from "@/config/firebase";
import { useThemeStore } from "@/state/themeStore";

import { API_BASE_URL } from "@/config/api";
import { useUserStore } from "@/state/userStore";
import { useRouter, Redirect } from "expo-router";
import { handleSignOut, uploadProfilePhoto, uploadCollegeId } from "@/api/auth";
import { LiveCameraCapture } from "@/components/profile/LiveCameraCapture";

interface UserProfileFormProps {
  user: any; // Firebase user
  onProfileCreated: (profile: UserProfile) => void;
}

interface FormData {
  displayName: string;
  email: string;
  phoneNumber: string;
  rollNumber?: string;
  refferedBy?: string;
  applyCampusAmbassador?: boolean;
  appleId: string;
  age: string;
  collegeName: string;
  graduationYear: string;
  gender: "male" | "female" | "other" | "";
  isHostCollegeStudent: boolean;
  accommodationNeeded: boolean;
  isVerified: boolean;
}

const GRADUATION_YEARS = [
  "2025",
  "2026",
  "2027",
  "2028",
  "2029",
  "2030",
  "2031",
];

// Regex to check if email belongs to Thapar University
const THAPAR_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@thapar\.edu$/i;
const HOST_COLLEGE_NAME = "Thapar Institute of Engineering and Technology";

export const UserProfileFormScreen: React.FC<UserProfileFormProps> = ({
  user,
  onProfileCreated,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const { logout } = useUserStore();

  const [currentStage, setCurrentStage] = useState<1 | 2 | 3>(1);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [savedProfile, setSavedProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showGraduationDropdown, setShowGraduationDropdown] = useState(false);
  const [deleteFlagChecked, setDeleteFlagChecked] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    displayName: user?.displayName || "User",
    email: user?.email || "",
    phoneNumber: "",
    rollNumber: "",
    refferedBy: "",
    applyCampusAmbassador: false,
    appleId: user?.uid || "",
    age: "",
    collegeName: "",
    graduationYear: "",
    gender: "",
    isHostCollegeStudent: user?.email
      ? THAPAR_EMAIL_REGEX.test(user.email)
      : false,
    accommodationNeeded: false,
    isVerified: true,
  });

  const isHost =
    formData.isHostCollegeStudent ||
    THAPAR_EMAIL_REGEX.test(formData.email || user?.email || "");
  const totalStages = isHost ? 2 : 3;

  const handleBackPress = () => {
    if (currentStage === 3) {
      setCurrentStage(2);
    } else if (currentStage === 2) {
      setCurrentStage(1);
    } else {
      handleSignOutPress();
    }
  };

  const bgColor = isDark ? "#131316" : "#E0E0E0";
  const cardBg = isDark ? "#1C1C20" : "#FFFFFF";
  const cardBorder = isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)";
  const textColor = isDark ? "#FFFFFF" : "#111827";
  const subTextColor = isDark ? "#9CA3AF" : "#6B7280";
  const inputBg = isDark ? "#1C1C20" : "#FFFFFF";
  const inputBorder = isDark ? "rgba(255, 255, 255, 0.14)" : "#D1D5DB";

  const updateField = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    if (!user) return;
    setFormData((prev) => ({
      ...prev,
      displayName: user.displayName || prev.displayName,
      email: user.email || prev.email,
      appleId: user.uid || prev.appleId,
      isHostCollegeStudent: user.email
        ? THAPAR_EMAIL_REGEX.test(user.email)
        : prev.isHostCollegeStudent,
    }));
  }, [user]);

  useEffect(() => {
    const checkDeleteFlag = async () => {
      const shouldDelete = await getDeleteFlag();
      setDeleteFlagChecked(shouldDelete);
    };
    checkDeleteFlag();
  }, []);

  const validateForm = (): string | null => {
    if (!formData.phoneNumber.trim() && !deleteFlagChecked)
      return "Please enter your phone number";
    if (formData.phoneNumber.length !== 10 && !deleteFlagChecked)
      return "Please enter a valid 10-digit phone number";
    if (!formData.gender && !deleteFlagChecked)
      return "Please select your gender";
    if (!formData.graduationYear)
      return "Please select your graduation year";

    if (!formData.age.trim() && !deleteFlagChecked)
      return "Please enter your age";
    if (!formData.rollNumber)
      return "Please enter your roll number";
    if (!formData.isHostCollegeStudent) {
      if (!formData.collegeName.trim())
        return "Please select your college name";
    }

    return null;
  };

  const handleSignOutPress = () => {
    showAlert(
      "Sign Out",
      "Are you sure you want to sign out and use a different account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              await handleSignOut();
              logout();
              router.replace("/(auth)");
            } catch (error) {
              console.error("Sign out error:", error);
              showAlert("Error", "Failed to log out properly");
            }
          },
        },
      ]
    );
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      showAlert("Validation Error", validationError);
      return;
    }

    setIsLoading(true);
    try {
      const currentUser = getAuthInstance().currentUser;
      if (!currentUser) throw new Error("No authenticated user found");

      const idToken = await currentUser.getIdToken(false);

      const isHost =
        formData.isHostCollegeStudent ||
        THAPAR_EMAIL_REGEX.test(currentUser.email || "");
      const collegeName = isHost
        ? HOST_COLLEGE_NAME
        : formData.collegeName;

      const response = await fetch(`${API_BASE_URL}/me`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber: formData.phoneNumber,
          gender: formData.gender,
          graduationYear: formData.graduationYear,
          age: formData.age,
          rollNumber: formData.rollNumber,
          collegeName,
          referredBy: formData.refferedBy,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({} as any));
        const msg =
          errorData?.error?.message ||
          errorData?.message ||
          "Failed to update profile";
        throw new Error(msg);
      }

      const responseBody = await response.json();
      const updatedProfile = responseBody?.user;

      if (!updatedProfile) {
        throw new Error("Failed to retrieve updated profile.");
      }

      setSavedProfile(updatedProfile);
      // Advance to Stage 2: Profile photo live capture
      setCurrentStage(2);
    } catch (error: any) {
      const errorMessage =
        error?.message ||
        error?.toString() ||
        "An error occurred while creating your profile.";
      showAlert("Profile Creation Error", errorMessage);
      console.error("Profile creation error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Top Header Bar */}
      <View
        style={{
          paddingTop: Math.max(insets.top + 8, 44),
          paddingBottom: 14,
          paddingHorizontal: 20,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: bgColor,
        }}
      >
        <TouchableOpacity
          onPress={handleBackPress}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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
            marginRight: 14,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={textColor} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: "Talina",
              fontSize: 22,
              color: textColor,
              letterSpacing: 0.5,
            }}
          >
            {currentStage === 1
              ? "COMPLETE PROFILE"
              : currentStage === 2
              ? "PROFILE PHOTO"
              : "COLLEGE ID CARD"}
          </Text>
          <Text
            style={{
              fontFamily: "Poppins_500Medium",
              fontSize: 12,
              color: "#41B8F0",
            }}
          >
            Saturnalia '26 Registration
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleSignOutPress}
          activeOpacity={0.7}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 12,
            backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
            borderWidth: 1,
            borderColor: cardBorder,
          }}
        >
          <Text
            style={{
              fontFamily: "Poppins_500Medium",
              fontSize: 12,
              color: subTextColor,
            }}
          >
            Sign Out
          </Text>
        </TouchableOpacity>
      </View>

      {/* Dynamic Progress Bar */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingBottom: 14,
          backgroundColor: bgColor,
          borderBottomWidth: 1,
          borderBottomColor: cardBorder,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
                backgroundColor: isDark
                  ? "rgba(65, 184, 240, 0.15)"
                  : "rgba(65, 184, 240, 0.12)",
                marginRight: 8,
              }}
            >
              <Text
                style={{
                  fontFamily: "Poppins_600SemiBold",
                  fontSize: 11,
                  color: "#41B8F0",
                  letterSpacing: 0.5,
                }}
              >
                STAGE {currentStage} OF {totalStages}
              </Text>
            </View>
            <Text
              style={{
                fontFamily: "Poppins_600SemiBold",
                fontSize: 13,
                color: textColor,
              }}
            >
              {currentStage === 1
                ? "Personal Details"
                : currentStage === 2
                ? "Profile Photo"
                : "College ID Card"}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: "Poppins_600SemiBold",
              fontSize: 12,
              color: "#41B8F0",
            }}
          >
            {Math.round((currentStage / totalStages) * 100)}%
          </Text>
        </View>

        {/* Segmented Progress Track */}
        <View style={{ flexDirection: "row", height: 6, gap: 6 }}>
          {Array.from({ length: totalStages }).map((_, index) => {
            const stepNum = index + 1;
            const isCompletedOrCurrent = currentStage >= stepNum;
            return (
              <View
                key={index}
                style={{
                  flex: 1,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: isCompletedOrCurrent
                    ? "#41B8F0"
                    : isDark
                    ? "rgba(255, 255, 255, 0.1)"
                    : "rgba(0, 0, 0, 0.1)",
                }}
              />
            );
          })}
        </View>
      </View>

      {currentStage === 1 ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 18,
          paddingBottom: Math.max(insets.bottom + 40, 50),
        }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
      >
        {/* User Identity Banner Card */}
        <View
          style={{
            backgroundColor: cardBg,
            borderWidth: 1,
            borderColor: cardBorder,
            borderRadius: 24,
            padding: 18,
            marginBottom: 16,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.2 : 0.04,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: isDark
                  ? "rgba(65, 184, 240, 0.15)"
                  : "rgba(65, 184, 240, 0.12)",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 14,
                borderWidth: 1,
                borderColor: "rgba(65, 184, 240, 0.3)",
              }}
            >
              <Text
                style={{
                  fontFamily: "Talina",
                  color: "#41B8F0",
                  fontSize: 24,
                }}
              >
                {formData.displayName?.charAt(0).toUpperCase() || "U"}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: "Poppins_600SemiBold",
                  color: textColor,
                  fontSize: 16,
                  marginBottom: 2,
                }}
              >
                {formData.displayName || "User"}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: "Poppins_400Regular",
                  color: subTextColor,
                  fontSize: 12.5,
                  marginBottom: 6,
                }}
              >
                {formData.email || "Signed in"}
              </Text>

              {/* Status Pill */}
              <View
                style={{
                  alignSelf: "flex-start",
                  backgroundColor: isDark ? "#26262B" : "#F3F4F6",
                  borderColor: cardBorder,
                  borderWidth: 1,
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  borderRadius: 10,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <Ionicons
                  name={formData.isHostCollegeStudent ? "school-outline" : "business-outline"}
                  size={12}
                  color="#FFBA00"
                />
                <Text
                  style={{
                    fontFamily: "Poppins_500Medium",
                    color: textColor,
                    fontSize: 11,
                    marginLeft: 5,
                  }}
                >
                  {formData.isHostCollegeStudent
                    ? "Thapar Student (Host)"
                    : "External Participant"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section 1: Personal Information Card */}
        <View
          style={{
            backgroundColor: cardBg,
            borderWidth: 1,
            borderColor: cardBorder,
            borderRadius: 24,
            padding: 20,
            marginBottom: 16,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.2 : 0.04,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <Ionicons
              name="person-outline"
              size={18}
              color="#FFBA00"
              style={{ marginRight: 8 }}
            />
            <Text
              style={{
                fontFamily: "Poppins_600SemiBold",
                fontSize: 16,
                color: textColor,
              }}
            >
              Personal Details
            </Text>
          </View>

          <Input
            label="Full Name"
            value={formData.displayName}
            onChangeText={() => {}}
            editable={false}
            placeholder="Enter your full name"
            className="mb-4"
          />

          <Input
            label="Email"
            value={formData.email}
            onChangeText={() => {}}
            placeholder="Enter your email"
            keyboardType="email-address"
            editable={!user?.email}
            className="mb-4"
          />

          <Input
            label="Phone Number *"
            value={formData.phoneNumber}
            onChangeText={(value) => updateField("phoneNumber", value)}
            placeholder="Enter 10-digit mobile number"
            keyboardType="numeric"
            maxLength={10}
            className="mb-4"
          />

          <Input
            label="Age *"
            value={formData.age}
            onChangeText={(value) => updateField("age", value)}
            placeholder="Enter your age (e.g. 20)"
            keyboardType="numeric"
            maxLength={2}
            className="mb-4"
          />

          {/* Gender Selection */}
          <View className="mb-2">
            <Text
              style={{
                fontFamily: "Poppins_600SemiBold",
                color: textColor,
                fontSize: 14,
                marginBottom: 8,
              }}
            >
              Gender *
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["male", "female", "other"] as const).map((gender) => {
                const isSelected = formData.gender === gender;
                return (
                  <TouchableOpacity
                    key={gender}
                    activeOpacity={0.75}
                    onPress={() => updateField("gender", gender)}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      paddingHorizontal: 8,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "row",
                      backgroundColor: isSelected
                        ? isDark
                          ? "rgba(255, 186, 0, 0.15)"
                          : "rgba(255, 186, 0, 0.12)"
                        : isDark
                        ? "#26262B"
                        : "#F9FAFB",
                      borderWidth: isSelected ? 1.5 : 1,
                      borderColor: isSelected ? "#FFBA00" : inputBorder,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: isSelected
                          ? "Poppins_600SemiBold"
                          : "Poppins_500Medium",
                        fontSize: 13.5,
                        color: isSelected ? "#FFBA00" : subTextColor,
                      }}
                    >
                      {gender.charAt(0).toUpperCase() + gender.slice(1)}
                    </Text>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color="#FFBA00"
                        style={{ marginLeft: 6 }}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Section 2: Academic Information Card */}
        <View
          style={{
            backgroundColor: cardBg,
            borderWidth: 1,
            borderColor: cardBorder,
            borderRadius: 24,
            padding: 20,
            marginBottom: 16,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.2 : 0.04,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <Ionicons
              name="school-outline"
              size={18}
              color="#41B8F0"
              style={{ marginRight: 8 }}
            />
            <Text
              style={{
                fontFamily: "Poppins_600SemiBold",
                fontSize: 16,
                color: textColor,
              }}
            >
              Academic Information
            </Text>
          </View>

          <Input
            label="Roll Number / Student ID *"
            value={formData.rollNumber || ""}
            onChangeText={(value) => updateField("rollNumber", value)}
            placeholder="Enter your student roll number"
            keyboardType="default"
            className="mb-4"
          />

          {!formData.isHostCollegeStudent && (
            <CollegeDropdown
              value={formData.collegeName}
              onSelect={(college) => updateField("collegeName", college)}
              className="mb-4"
            />
          )}

          {/* Graduation Year Dropdown */}
          <View className="mb-2">
            <Text
              style={{
                fontFamily: "Poppins_600SemiBold",
                color: textColor,
                fontSize: 14,
                marginBottom: 6,
              }}
            >
              Graduation Year *
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowGraduationDropdown(true)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: inputBg,
                borderWidth: 1.5,
                borderColor: inputBorder,
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 12,
                minHeight: 50,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isDark ? 0.2 : 0.04,
                shadowRadius: 4,
                elevation: 1,
              }}
            >
              <Text
                style={{
                  fontFamily: "Poppins_500Medium",
                  fontSize: 14.5,
                  color: formData.graduationYear ? textColor : subTextColor,
                }}
              >
                {formData.graduationYear || "Select your graduation year"}
              </Text>
              <Ionicons
                name="calendar-outline"
                size={18}
                color={subTextColor}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Section 3: Referral Code Card */}
        <View
          style={{
            backgroundColor: cardBg,
            borderWidth: 1,
            borderColor: cardBorder,
            borderRadius: 24,
            padding: 20,
            marginBottom: 24,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.2 : 0.04,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <Ionicons
              name="gift-outline"
              size={18}
              color="#FFBA00"
              style={{ marginRight: 8 }}
            />
            <Text
              style={{
                fontFamily: "Poppins_600SemiBold",
                fontSize: 16,
                color: textColor,
              }}
            >
              Referral Code (Optional)
            </Text>
          </View>

          <Input
            value={formData.refferedBy || ""}
            onChangeText={(value) => updateField("refferedBy", value.toUpperCase())}
            placeholder="Enter referral code if you have one"
            autoCapitalize="characters"
            maxLength={8}
            className="mb-0"
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleSubmit}
          disabled={isLoading}
          style={{
            width: "100%",
            height: 54,
            backgroundColor: "#FFBA00",
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            marginBottom: 16,
            shadowColor: "#FFBA00",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 10,
            elevation: 4,
            opacity: isLoading ? 0.75 : 1,
          }}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#131316" style={{ marginRight: 8 }} />
          ) : (
            <Ionicons
              name="arrow-forward-circle"
              size={22}
              color="#131316"
              style={{ marginRight: 8 }}
            />
          )}
          <Text
            style={{
              fontFamily: "Poppins_600SemiBold",
              fontSize: 16,
              color: "#131316",
              letterSpacing: 0.3,
            }}
          >
            {isLoading ? "Saving Details..." : "Continue to Photo Verification"}
          </Text>
        </TouchableOpacity>

        {/* Terms & Privacy */}
        <Text
          style={{
            fontFamily: "Poppins_400Regular",
            fontSize: 12,
            color: subTextColor,
            textAlign: "center",
            lineHeight: 18,
            marginBottom: 20,
          }}
        >
          By creating your profile, you agree to our{" "}
          <Text
            style={{ color: "#FFBA00", textDecorationLine: "underline" }}
            onPress={() => Linking.openURL("https://saturnalia.in/policies")}
          >
            Terms of Service
          </Text>{" "}
          and{" "}
          <Text
            style={{ color: "#FFBA00", textDecorationLine: "underline" }}
            onPress={() => Linking.openURL("https://saturnalia.in/policies")}
          >
            Privacy Policy
          </Text>
          .
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  ) : currentStage === 2 ? (
    <LiveCameraCapture
      mode="selfie"
      title="Take Profile Photo"
      subtitle="Live selfie verification for festival accreditation & pass."
      instruction="Center your face inside the oval guide in good lighting. Face the camera directly."
      confirmButtonText={isHost ? "Complete Profile" : "Continue to College ID"}
      isUploading={isUploadingMedia}
      onBack={handleBackPress}
      onConfirm={async (uri) => {
        try {
          setIsUploadingMedia(true);
          const updated = await uploadProfilePhoto(uri);
          setSavedProfile(updated);
          if (isHost) {
            onProfileCreated(updated);
          } else {
            setCurrentStage(3);
          }
        } catch (err: any) {
          showAlert("Upload Failed", err?.message || "Failed to upload profile photo");
        } finally {
          setIsUploadingMedia(false);
        }
      }}
    />
  ) : (
    <LiveCameraCapture
      mode="document"
      title="Scan College ID Card"
      subtitle="Live capture of your physical student ID card."
      instruction="Align your physical college ID card inside the frame. Ensure your name and roll number are legible."
      confirmButtonText="Complete Profile"
      isUploading={isUploadingMedia}
      onBack={handleBackPress}
      onConfirm={async (uri) => {
        try {
          setIsUploadingMedia(true);
          const updated = await uploadCollegeId(uri);
          setSavedProfile(updated);
          onProfileCreated(updated);
        } catch (err: any) {
          showAlert("Upload Failed", err?.message || "Failed to upload college ID card");
        } finally {
          setIsUploadingMedia(false);
        }
      }}
    />
  )}

      {/* Graduation Year Modal */}
      <Modal
        visible={showGraduationDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowGraduationDropdown(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.65)",
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 20,
          }}
          onPress={() => setShowGraduationDropdown(false)}
        >
          <Pressable
            style={{
              backgroundColor: cardBg,
              borderRadius: 24,
              width: "100%",
              maxWidth: 380,
              borderWidth: 1,
              borderColor: cardBorder,
              padding: 20,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.35,
              shadowRadius: 16,
              elevation: 8,
              overflow: "hidden",
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
                paddingBottom: 12,
                borderBottomWidth: 1,
                borderBottomColor: cardBorder,
              }}
            >
              <View>
                <Text
                  style={{
                    fontFamily: "Poppins_600SemiBold",
                    fontSize: 17,
                    color: textColor,
                  }}
                >
                  Select Graduation Year
                </Text>
                <Text
                  style={{
                    fontFamily: "Poppins_400Regular",
                    fontSize: 12,
                    color: subTextColor,
                  }}
                >
                  Choose your expected passing-out year
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowGraduationDropdown(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={24} color={subTextColor} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: 300 }}
              showsVerticalScrollIndicator={false}
            >
              {GRADUATION_YEARS.map((item) => {
                const isSelected = formData.graduationYear === item;
                return (
                  <TouchableOpacity
                    key={item}
                    activeOpacity={0.7}
                    onPress={() => {
                      updateField("graduationYear", item);
                      setShowGraduationDropdown(false);
                    }}
                    style={{
                      paddingVertical: 13,
                      paddingHorizontal: 16,
                      marginBottom: 8,
                      borderRadius: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: isSelected
                        ? isDark
                          ? "rgba(255, 186, 0, 0.15)"
                          : "rgba(255, 186, 0, 0.12)"
                        : isDark
                        ? "#26262B"
                        : "#F9FAFB",
                      borderWidth: isSelected ? 1.5 : 1,
                      borderColor: isSelected ? "#FFBA00" : cardBorder,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: isSelected
                          ? "Poppins_600SemiBold"
                          : "Poppins_500Medium",
                        fontSize: 15,
                        color: isSelected ? "#FFBA00" : textColor,
                      }}
                    >
                      Class of {item}
                    </Text>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#FFBA00"
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

export default function UserProfileFormRoute() {
  const { authUser, setUserData } = useUserStore();
  const router = useRouter();
  const firebaseUser = authUser ?? getAuthInstance().currentUser;

  if (!firebaseUser) {
    return <Redirect href="/(auth)" />;
  }

  return (
    <UserProfileFormScreen
      user={firebaseUser}
      onProfileCreated={(profile) => {
        setUserData(profile);
        router.replace("/(tabs)");
      }}
    />
  );
}