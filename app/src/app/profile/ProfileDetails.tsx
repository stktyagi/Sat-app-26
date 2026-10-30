import React from "react";
import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  Linking,
  Image,
  ActivityIndicator,
} from "react-native";
import {
  promptAndUploadIdentity,
  isOutsideCollegeStudent,
  isIdentityVerificationComplete,
} from "@/utils/identityUpload";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUserStore } from "@/state/userStore";
import { useThemeStore } from "@/state/themeStore";
import { getDeleteFlag } from "@/utils/versionCheck";
import { Button, showAlert } from "@/components";

const ProfileDetailsScreen = () => {
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const router = useRouter();
  const { userData: userProfile } = useUserStore();
  const [isDelete, setIsDelete] = React.useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = React.useState(false);
  const [isUploadingCollegeId, setIsUploadingCollegeId] = React.useState(false);

  const isOutside = isOutsideCollegeStudent(userProfile);
  const isVerified = isIdentityVerificationComplete(userProfile);
  const hasPhoto = Boolean(userProfile?.photoUrl || userProfile?.photoURL);
  const hasCollegeId = Boolean(userProfile?.collegeIdUrl);

  const handleUploadPhoto = () => {
    promptAndUploadIdentity("photo", setIsUploadingPhoto);
  };

  const handleUploadCollegeId = () => {
    promptAndUploadIdentity("collegeId", setIsUploadingCollegeId);
  };

  const bgColor = isDark ? '#131316' : '#E0E0E0';
  const cardBg = isDark ? '#1C1C20' : '#FFFFFF';
  const cardBorder = isDark ? '#2A2A30' : '#D5D5D5';
  const textColor = isDark ? '#FFFFFF' : '#111827';
  const subTextColor = isDark ? '#A0A0A0' : '#6B7280';

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
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: isDark ? '#2A2A30' : '#F3F4F6' }}>
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: isDark ? 'rgba(65, 184, 240, 0.15)' : 'rgba(65, 184, 240, 0.12)', alignItems: "center", justifyContent: "center", marginRight: 14 }}>
        <Ionicons name={icon} size={18} color="#41B8F0" />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{ fontFamily: "Poppins_400Regular", color: subTextColor, fontSize: 12, marginBottom: 2 }}
        >
          {label}
        </Text>
        <Text
          style={{ fontFamily: "Poppins_500Medium", color: textColor, fontSize: 15 }}
        >
          {value}
        </Text>
      </View>
    </View>
  );

  const handleDeleteAccount = () => {
    Linking.openURL("https://www.saturnalia.in/deleteuser");
  };

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Top Header */}
      <View
        style={{
          paddingTop: Math.max(insets.top + 8, 44),
          paddingBottom: 16,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: bgColor,
          borderBottomWidth: 1,
          borderBottomColor: cardBorder,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: cardBg,
            borderWidth: 1,
            borderColor: cardBorder,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 14,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={textColor} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text
            style={{ fontFamily: "Talina", fontSize: 24, color: textColor, letterSpacing: 0.5 }}
          >
            PROFILE DETAILS
          </Text>
          <Text style={{ fontFamily: "Poppins_500Medium", fontSize: 13, color: '#41B8F0' }}>
            Account & Registration Info
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Summary Card */}
        <View
          style={{
            backgroundColor: cardBg,
            borderWidth: 1,
            borderColor: cardBorder,
            borderRadius: 24,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: isDark ? 'rgba(65, 184, 240, 0.15)' : 'rgba(65, 184, 240, 0.12)',
                alignItems: "center",
                justifyContent: "center",
                marginRight: 16,
                overflow: 'hidden',
                borderWidth: 2,
                borderColor: '#41B8F0',
              }}
            >
              {(userProfile?.photoUrl || userProfile?.photoURL) ? (
                <Image
                  source={{ uri: userProfile.photoUrl || userProfile.photoURL }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              ) : (
                <Text
                  style={{ fontFamily: "Talina", color: '#41B8F0', fontSize: 28 }}
                >
                  {userProfile?.displayName?.charAt(0).toUpperCase() || "U"}
                </Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{ fontFamily: "Poppins_600SemiBold", color: textColor, fontSize: 18, marginBottom: 2 }}
              >
                {userProfile?.displayName || "User Name"}
              </Text>
              <Text
                style={{ fontFamily: "Poppins_400Regular", color: subTextColor, fontSize: 13 }}
              >
                {userProfile?.email || "email@example.com"}
              </Text>
            </View>
          </View>

          {/* Quick Info Pills */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <View
              style={{
                backgroundColor: isDark ? '#26262B' : '#F3F4F6',
                borderColor: cardBorder,
                borderWidth: 1,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 12,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Ionicons name="school-outline" size={14} color="#41B8F0" />
              <Text
                style={{ fontFamily: "Poppins_500Medium", color: textColor, fontSize: 12, marginLeft: 6 }}
              >
                {userProfile?.email?.includes("thapar")
                  ? "Host College Student"
                  : "External Participant"}
              </Text>
            </View>
            {userProfile?.graduationYear && (
              <View
                style={{
                  backgroundColor: isDark ? '#26262B' : '#F3F4F6',
                  borderColor: cardBorder,
                  borderWidth: 1,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 12,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <Ionicons name="calendar-outline" size={14} color="#41B8F0" />
                <Text
                  style={{ fontFamily: "Poppins_500Medium", color: textColor, fontSize: 12, marginLeft: 6 }}
                >
                  Class of {userProfile.graduationYear}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Personal Information Card */}
        <View
          style={{
            backgroundColor: cardBg,
            borderWidth: 1,
            borderColor: cardBorder,
            borderRadius: 24,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <Ionicons name="person-circle-outline" size={22} color="#41B8F0" />
            <Text
              style={{ fontFamily: "Poppins_600SemiBold", color: textColor, fontSize: 16, marginLeft: 8 }}
            >
              Personal Information
            </Text>
          </View>

          <InfoRow
            label="Full Name"
            value={userProfile?.displayName || "Not provided"}
            icon="person-outline"
          />
          <InfoRow
            label="Email Address"
            value={userProfile?.email || "Not provided"}
            icon="mail-outline"
          />
          {!isDelete && (
            <InfoRow
              label="Phone Number"
              value={userProfile?.phoneNumber || "Not provided"}
              icon="call-outline"
            />
          )}
        </View>

        {/* Academic Information Card */}
        <View
          style={{
            backgroundColor: cardBg,
            borderWidth: 1,
            borderColor: cardBorder,
            borderRadius: 24,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <Ionicons name="school-outline" size={22} color="#41B8F0" />
            <Text
              style={{ fontFamily: "Poppins_600SemiBold", color: textColor, fontSize: 16, marginLeft: 8 }}
            >
              Academic Information
            </Text>
          </View>

          <InfoRow
            label="College / University"
            value={userProfile?.collegeName || "Not provided"}
            icon="business-outline"
          />
          <InfoRow
            label="Roll Number / Student ID"
            value={userProfile?.rollNumber || "Not provided"}
            icon="card-outline"
          />
          <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14 }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: isDark ? 'rgba(65, 184, 240, 0.15)' : 'rgba(65, 184, 240, 0.12)', alignItems: "center", justifyContent: "center", marginRight: 14 }}>
              <Ionicons name="calendar-outline" size={18} color="#41B8F0" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{ fontFamily: "Poppins_400Regular", color: subTextColor, fontSize: 12, marginBottom: 2 }}
              >
                Graduation Year
              </Text>
              <Text
                style={{ fontFamily: "Poppins_500Medium", color: textColor, fontSize: 15 }}
              >
                {userProfile?.graduationYear?.toString() || "Not provided"}
              </Text>
            </View>
          </View>
        </View>

        {/* Identity & Verification Documents Card */}
        <View
          style={{
            backgroundColor: cardBg,
            borderWidth: 1,
            borderColor: isOutside && !isVerified
              ? (isDark ? "rgba(245, 158, 11, 0.4)" : "#FCD34D")
              : cardBorder,
            borderRadius: 24,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="id-card-outline" size={22} color="#41B8F0" />
              <Text
                style={{ fontFamily: "Poppins_600SemiBold", color: textColor, fontSize: 16, marginLeft: 8 }}
              >
                Verification Documents
              </Text>
            </View>
            {isOutside && (
              <View
                style={{
                  backgroundColor: isVerified
                    ? (isDark ? "rgba(34, 197, 94, 0.15)" : "#DCFCE7")
                    : (isDark ? "rgba(245, 158, 11, 0.15)" : "#FEF3C7"),
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: isVerified ? "#22C55E" : "#F59E0B",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Poppins_600SemiBold",
                    fontSize: 11,
                    color: isVerified ? "#22C55E" : "#F59E0B",
                  }}
                >
                  {isVerified ? "Verified ✓" : "Incomplete"}
                </Text>
              </View>
            )}
          </View>

          {isOutside && (
            <Text
              style={{
                fontFamily: "Poppins_400Regular",
                color: isVerified ? subTextColor : "#F59E0B",
                fontSize: 12,
                lineHeight: 18,
                marginBottom: 16,
              }}
            >
              {isVerified
                ? "Both your profile photo and college ID have been uploaded. You are eligible to register for events."
                : "Outside college students must upload both a live profile photo and college ID card to register for events."}
            </Text>
          )}

          {/* Profile Photo Item */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: isDark ? "#2A2A30" : "#F3F4F6",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginRight: 12 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: isDark ? "#26262B" : "#F3F4F6",
                  borderWidth: 1,
                  borderColor: hasPhoto ? "#41B8F0" : cardBorder,
                  overflow: "hidden",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                {hasPhoto ? (
                  <Image
                    source={{ uri: userProfile?.photoUrl || userProfile?.photoURL }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons name="person-outline" size={22} color={subTextColor} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Poppins_500Medium", color: textColor, fontSize: 14 }}>
                  Profile Photo
                </Text>
                <Text
                  style={{
                    fontFamily: "Poppins_400Regular",
                    fontSize: 12,
                    color: hasPhoto ? "#10B981" : (isOutside ? "#F59E0B" : subTextColor),
                  }}
                >
                  {hasPhoto ? "✓ Uploaded" : (isOutside ? "• Required for events" : "Not uploaded")}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleUploadPhoto}
              disabled={isUploadingPhoto}
              activeOpacity={0.8}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: isDark ? "rgba(65, 184, 240, 0.15)" : "#E0F2FE",
                borderWidth: 1,
                borderColor: "#41B8F0",
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 12,
              }}
            >
              {isUploadingPhoto ? (
                <ActivityIndicator size="small" color="#41B8F0" />
              ) : (
                <>
                  <Ionicons name={hasPhoto ? "refresh-outline" : "camera-outline"} size={16} color="#41B8F0" />
                  <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#41B8F0", fontSize: 12 }}>
                    {hasPhoto ? "Change" : "Upload"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* College ID Card Item */}
          <View style={{ paddingTop: 14 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontFamily: "Poppins_500Medium", color: textColor, fontSize: 14 }}>
                  College Student ID
                </Text>
                <Text
                  style={{
                    fontFamily: "Poppins_400Regular",
                    fontSize: 12,
                    color: hasCollegeId ? "#10B981" : (isOutside ? "#F59E0B" : subTextColor),
                  }}
                >
                  {hasCollegeId ? "✓ Uploaded on file" : (isOutside ? "• Required for events" : "Not uploaded")}
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleUploadCollegeId}
                disabled={isUploadingCollegeId}
                activeOpacity={0.8}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: isDark ? "rgba(65, 184, 240, 0.15)" : "#E0F2FE",
                  borderWidth: 1,
                  borderColor: "#41B8F0",
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 12,
                }}
              >
                {isUploadingCollegeId ? (
                  <ActivityIndicator size="small" color="#41B8F0" />
                ) : (
                  <>
                    <Ionicons name={hasCollegeId ? "refresh-outline" : "card-outline"} size={16} color="#41B8F0" />
                    <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#41B8F0", fontSize: 12 }}>
                      {hasCollegeId ? "Replace ID" : "Upload ID"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* College ID Preview Card */}
            {hasCollegeId ? (
              <View
                style={{
                  height: 160,
                  width: "100%",
                  borderRadius: 14,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: cardBorder,
                  backgroundColor: isDark ? "#121214" : "#F3F4F6",
                  marginTop: 6,
                }}
              >
                <Image
                  source={{ uri: userProfile?.collegeIdUrl }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              </View>
            ) : (
              <View
                style={{
                  paddingVertical: 18,
                  paddingHorizontal: 14,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: isDark ? "#3E3E48" : "#D1D5DB",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isDark ? "#18181C" : "#F9FAFB",
                  marginTop: 6,
                }}
              >
                <Ionicons name="card-outline" size={26} color={subTextColor} style={{ marginBottom: 4 }} />
                <Text style={{ fontFamily: "Poppins_400Regular", color: subTextColor, fontSize: 12 }}>
                  No College ID card uploaded yet
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Account Status Card */}
        <View
          style={{
            backgroundColor: cardBg,
            borderWidth: 1,
            borderColor: cardBorder,
            borderRadius: 24,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
            <Ionicons name="shield-checkmark-outline" size={22} color="#41B8F0" />
            <Text
              style={{ fontFamily: "Poppins_600SemiBold", color: textColor, fontSize: 16, marginLeft: 8 }}
            >
              Account Status
            </Text>
          </View>

          <View style={{ backgroundColor: isDark ? '#26262B' : '#F3F4F6', borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="checkmark-circle" size={22} color="#10B981" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text
                style={{ fontFamily: "Poppins_600SemiBold", color: textColor, fontSize: 14 }}
              >
                Active & Verified
              </Text>
              <Text
                style={{ fontFamily: "Poppins_400Regular", color: subTextColor, fontSize: 12 }}
              >
                Ready for Saturnalia festival
              </Text>
            </View>
            <View style={{ backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
              <Text
                style={{ fontFamily: "Poppins_600SemiBold", color: "#10B981", fontSize: 12 }}
              >
                Verified
              </Text>
            </View>
          </View>
        </View>

        {/* Danger Zone */}
        <View
          style={{
            backgroundColor: cardBg,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FCA5A5',
            borderRadius: 24,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
            <Ionicons name="warning-outline" size={22} color="#EF4444" />
            <Text
              style={{ fontFamily: "Poppins_600SemiBold", color: '#EF4444', fontSize: 16, marginLeft: 8 }}
            >
              Danger Zone
            </Text>
          </View>

          <Text
            style={{ fontFamily: "Poppins_400Regular", color: subTextColor, fontSize: 13, lineHeight: 20, marginBottom: 16 }}
          >
            Deleting your account will remove your event registrations and profile permanently.
          </Text>

          <TouchableOpacity
            onPress={handleDeleteAccount}
            style={{
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2',
              borderColor: '#EF4444',
              borderWidth: 1,
              borderRadius: 16,
              paddingVertical: 14,
              alignItems: "center",
            }}
          >
            <Text style={{ fontFamily: "Poppins_600SemiBold", color: '#EF4444', fontSize: 15 }}>
              Delete My Account
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default ProfileDetailsScreen;
