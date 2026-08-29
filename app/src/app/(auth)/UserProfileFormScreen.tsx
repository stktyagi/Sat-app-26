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
} from "react-native";
import { showAlert } from "../../components";
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { UserProfile } from '@/types/models';
import { Ionicons } from "@expo/vector-icons";
import Header from '@/components/Header';
import { CollegeDropdown } from '@/components/ui/CollegeDropdown';
import { getDeleteFlag } from '@/utils/versionCheck';
import { getAuthInstance } from '@/config/firebase';
import { getIdToken } from '@react-native-firebase/auth';
import { API_BASE_URL } from '@/config/api';
import { useUserStore } from '@/state/userStore';
import { useRouter, Redirect } from 'expo-router';

interface UserProfileFormProps {
  user: any; // Firebase user
  onProfileCreated: (profile: UserProfile) => void;
}

interface FormData {
  displayName: string; // Keep for display only
  email: string; // Keep for display only
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
      isHostCollegeStudent: user.email ? THAPAR_EMAIL_REGEX.test(user.email) : prev.isHostCollegeStudent,
    }));
  }, [user]);

  useEffect(() => {
    const checkDeleteFlag = async () => {
      const shouldDelete = await getDeleteFlag();
      setDeleteFlagChecked(shouldDelete);
    }
    checkDeleteFlag();
  }, []);

  const validateForm = (): string | null => {
    if (!formData.phoneNumber.trim() && !deleteFlagChecked) return "Please enter your phone number";
    if (formData.phoneNumber.length !== 10 && !deleteFlagChecked)
      return "Please enter a valid 10-digit phone number";
    if (!formData.gender && !deleteFlagChecked) return "Please select your gender";
    if (!formData.graduationYear) return "Please select your graduation year";

    if (!formData.age.trim() && !deleteFlagChecked) return "Please enter your age";
    if (!formData.rollNumber) return "Please enter your roll number";
    if (!formData.isHostCollegeStudent) {
      if (!formData.collegeName.trim()) return "Please select your college name";
    }

    return null;
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
      if (!currentUser) throw new Error("Not authenticated");
      const idToken = await getIdToken(currentUser, true);

      const isHost = formData.isHostCollegeStudent || THAPAR_EMAIL_REGEX.test(currentUser.email || "");
      const collegeName = isHost
        ? HOST_COLLEGE_NAME
        : formData.collegeName;

      const response = await fetch(`${API_BASE_URL}/me`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${idToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          phoneNumber: formData.phoneNumber,
          gender: formData.gender,
          graduationYear: formData.graduationYear,
          age: formData.age,
          rollNumber: formData.rollNumber,
          collegeName,
          referredBy: formData.refferedBy,
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update profile");
      }

      const { user: updatedProfile } = await response.json();
      
      if (onProfileCreated && updatedProfile) {
        onProfileCreated(updatedProfile);
      } else {
        showAlert("Error", "Failed to retrieve updated profile.");
      }
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || "An error occurred while creating your profile.";
      showAlert("Profile Creation Error", errorMessage);
      console.error("Profile creation error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View className="flex-1 bg-transparent flex-col m-0">
        {/* Header with Back Button */}
        <Header
          left={
            <TouchableOpacity
              onPress={async () => {
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
                          /* Removed API call */
                        } catch (error) {
                          console.error("Sign out error:", error);
                        }
                      },
                    },
                  ]
                );
              }}
              className="flex-row items-center relative z-10"
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          }
        />
        <ScrollView
          className="flex-1 flex px-6"
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 50 }}
        >
        <View className="my-8">
          <Text style={{fontFamily:'Outfit_700Bold'}} className="text-3xl text-[#0C3572] mx-auto mb-2">
            Sign Up
          </Text>
        </View>

        {/* Basic Information */}
        <View className="mb-6">
          <Input
            label="Full Name"
            value={formData.displayName}
            onChangeText={() => {}} // No-op for display-only field
            editable={false}
            placeholder="Enter your full name"
            className="mb-4"
          />

          <Input
            label="Email"
            value={formData.email}
            onChangeText={() => {}} // No-op for display-only field
            placeholder="Enter your email"
            keyboardType="email-address"
            editable={user?.email ? false : true}
            className="mb-4"
          />

          <Input
            label="Phone Number"
            value={formData.phoneNumber}
            onChangeText={(value) => updateField("phoneNumber", value)}
            placeholder="Enter 10-digit phone number"
            keyboardType="numeric"
            maxLength={10}
            className="mb-4"
          />

          <Input
            label="Age"
            value={formData.age}
            onChangeText={(value) => updateField("age", value)}
            placeholder="Enter your age"
            keyboardType="numeric"
            maxLength={2}
            className="mb-4"
          />

          {/* Gender Selection */}
          <Text style={{fontFamily:'Outfit_500Medium'}} className="text-lg text-[#0C3572] mb-2">Gender</Text>
          <View className="flex-row mb-4">
            {(["male", "female", "other"] as const).map((gender) => (
              <TouchableOpacity
                key={gender}
                className={`flex-1 py-3 px-4 mr-2 rounded-lg border ${
                  formData.gender === gender
                    ? "bg-transparent border-[#FFBA00]"
                    : "bg-transparent border-[#0C3572]"
                }`}
                onPress={() => updateField("gender", gender)}
              >
                <Text
                  style={{fontFamily:'Outfit_500Medium'}}
                  className={`text-center ${
                    formData.gender === gender ? "text-[#FFBA00]" : "text-[#0C3572]"
                  }`}
                >
                  {gender.charAt(0).toUpperCase() + gender.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Academic Information */}
        <View className="mb-6">
          <Text style={{fontFamily:'Outfit_700SemiBold'}} className="text-xl  text-[#0C3572] mb-4">
            Academic Information
          </Text>

            <Input
              label="Roll Number"
              value={formData.rollNumber || ""}
              onChangeText={(value) => updateField("rollNumber", value)}
              placeholder="Enter your roll number"
              keyboardType="numeric"
              className="mb-1"
            />
          {!formData.isHostCollegeStudent && (
            <CollegeDropdown
            value={formData.collegeName}
            onSelect={(college) => updateField("collegeName", college)}
            className="mb-4"
            />
          )}

          {/* Graduation Year Dropdown */}
          <View className="relative z-10">
            <Text style={{fontFamily:'Outfit_500Medium'}} className="text-lg text-[#0C3572] mb-2">
              Graduation Year
            </Text>
            <TouchableOpacity
              className="mb-4 p-4 bg-transparent rounded-lg border border-[#0C3572] flex-row justify-between items-center"
              onPress={() => setShowGraduationDropdown(!showGraduationDropdown)}
            >
              <Text
                className={
                  formData.graduationYear ? "text-[#0C3572]" : "text-[#2175C0]"
                }
              >
                {formData.graduationYear || "Select graduation year"}
              </Text>
              <Ionicons
                name={showGraduationDropdown ? "chevron-up" : "chevron-down"}
                size={20}
                color="#0C3572"
              />
            </TouchableOpacity>
          </View>
        </View>

          <Input
            label="Referral Code (Optional)"
            value={formData.refferedBy || ""}
            onChangeText={(value) => updateField("refferedBy", value)}
            placeholder="Enter referral code if you have one"
            maxLength={8}
            className="mb-6"
          />

        {/* Submit Button */}
        <Button
          onPress={handleSubmit}
          disabled={isLoading}
          loading={isLoading}
          title="Create Profile"
          variant="none" 
          className="mb-6 bg-[#95aad3] border-[#0C3572] border-2 py-3 rounded-xl" 
          textClassName="text-[#0C3572]"
        />

        <Text className="text-gray-500 text-sm text-center mb-6">
          By creating your profile, you agree to our Terms of Service and
          Privacy Policy.
        </Text>
      </ScrollView>

      {/* Graduation Year Modal */}
      <Modal
        visible={showGraduationDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowGraduationDropdown(false)}
      >
        <Pressable 
          className="flex-1 bg-black/50 justify-center items-center"
          onPress={() => setShowGraduationDropdown(false)}
        >
          <Pressable 
            className="bg-[#DBE2ED] rounded-xl w-4/5 max-h-90 overflow-hidden border-2 border-[#0C3572]"
            onPress={(e) => e.stopPropagation()}
          >
            
            <ScrollView className="p-4 ">
              {GRADUATION_YEARS.map((item) => (
                <TouchableOpacity
                  key={item}
                  onPress={() => {
                    updateField('graduationYear', item);
                    setShowGraduationDropdown(false);
                  }}
                  className={`
                    p-3 mb-2 rounded-lg flex-row items-center justify-between
                    ${formData.graduationYear === item 
                      ? 'border-2 border-[#FFBA00] bg-[#FFF7E6]' 
                      : 'border border-[#0C3572] bg-white'
                    }
                  `}
                >
                  <Text
                    style={{ fontFamily: formData.graduationYear === item ? 'Outfit_600SemiBold' : 'Outfit_400Regular' }}
                    className={`text-base ${
                      formData.graduationYear === item ? 'text-black' : 'text-[#0C3572]'
                    }`}
                  >
                    {item}
                  </Text>
                  {formData.graduationYear === item && (
                    <Ionicons name="checkmark-circle" size={24} color="#FFBA00" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      </View>
    </KeyboardAvoidingView>
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
        router.replace('/(tabs)');
      }}
    />
  );
}