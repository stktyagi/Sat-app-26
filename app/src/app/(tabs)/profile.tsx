// src/screens/App/ProfileScreen.tsx
import React, { useState } from "react";
import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  Share,
  Platform,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUserStore } from "@/state/userStore";
import { useThemeStore } from "@/state/themeStore";
import { useAdminDrawerStore } from "@/state/adminDrawerStore";
import { isUserAdmin } from "@/utils/roles";
import UserQRCodeModal from "@/components/profile/UserQRCodeModal";
import { getAppVersion } from "@/utils/appVersion";
import { setStringAsync } from "expo-clipboard";
import { showAlert } from "@/components";
import { checkAppStatus } from "@/utils/versionCheck";
import { runAllDebugChecks } from "@/utils/debugVersion";

const ProfileScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userData: userProfile } = useUserStore();
  const canSeeAdmin = isUserAdmin(userProfile);
  const { isDark, toggleTheme } = useThemeStore();
  const { openDrawer } = useAdminDrawerStore();
  const [showQRModal, setShowQRModal] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [debugTapCount, setDebugTapCount] = useState(0);

  const boysHairStyles = ['turban', 'fonze'];
  const girlsHairStyles = ['full', 'pixie'];
  const getRandomHairStyle = () => {
    const hairStyles = userProfile?.gender === 'male' ? boysHairStyles : girlsHairStyles;
    const randomIndex = Math.floor(Math.random() * hairStyles.length);
    return hairStyles[randomIndex];
  };

  const profilePicUrl = `https://api.dicebear.com/10.x/open-peeps/png?seed=${userProfile?.userId}&hair=${getRandomHairStyle()}`;

  const isHostCollegeStudent =
    userProfile?.collegeName?.toLowerCase().includes("thapar") || false;

  const handleDebugTap = async () => {
    const newCount = debugTapCount + 1;
    setDebugTapCount(newCount);

    if (newCount === 7) {
      setDebugTapCount(0);
      console.log('\n\n🔍 Running Firebase Debug Checks...\n');
      await runAllDebugChecks();
      showAlert(
        "🔍 Debug Mode",
        "Firebase debug checks have been run. Check the console logs for detailed information.",
        [{ text: "OK" }]
      );
    } else if (newCount >= 4) {
      console.log(`Debug mode: ${newCount}/7 taps`);
    }

    setTimeout(() => setDebugTapCount(0), 2000);
  };

  const handleSignOutPress = () => {
    showAlert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          onPress: async () => {
            try {
              const { handleSignOut } = await import('@/api/auth');
              await handleSignOut();
              useUserStore.getState().logout();
              router.replace('/(auth)');
            } catch (error) {
              console.error('Logout error:', error);
              showAlert('Error', 'Failed to log out properly');
            }
          },
          style: "destructive",
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Linking.openURL("https://www.saturnalia.in/deleteuser");
  };

  const handleCheckForUpdates = async () => {
    setCheckingUpdate(true);
    try {
      const currentVersion = getAppVersion();
      const result = await checkAppStatus(currentVersion);

      if (result.maintenanceInfo.isUnderMaintenance) {
        showAlert(
          "🚧 Maintenance Mode",
          `The app is currently under maintenance for ${result.maintenanceInfo.platform}.\n\nPlease check back later. We apologize for the inconvenience.`,
          [{ text: "OK" }]
        );
      } else if (result.versionInfo.updateRequired) {
        const appStoreUrl =
          Platform.OS === "ios"
            ? result.appLinks.appleStore
            : result.appLinks.playStore;

        showAlert(
          "🔄 Update Available",
          `A new version ${result.versionInfo.requiredVersion} is available.\n\nYour current version: ${result.versionInfo.currentVersion}\n\nPlease update to continue using the app.`,
          [
            { text: "Later", style: "cancel" },
            { text: "Update Now", onPress: () => Linking.openURL(appStoreUrl) },
          ]
        );
      } else {
        showAlert(
          "✅ You're Up to Date!",
          `You have the latest version (${currentVersion}) of the app.\n\nNo update is required at this time.`
        );
      }
    } catch (error) {
      console.error('[ProfileScreen] Error checking for updates:', error);
      showAlert("❌ Error", "Failed to check for updates. Please try again later.");
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleShareApp = async () => {
    const currentVersion = getAppVersion();
    const result = await checkAppStatus(currentVersion);
    const appStoreUrl =
      Platform.OS === "ios" ? result.appLinks.appleStore : result.appLinks.playStore;

    try {
      await Share.share({
        message: "Check out this amazing Saturnalia app! Download it now.",
        title: "Saturnalia App",
        url: appStoreUrl,
      });
    } catch (error) {
      console.error("Error sharing app:", error);
    }
  };

  const handleCopyReferral = async () => {
    const code = userProfile?.referralCode;
    if (!code) {
      showAlert("No Code", "Referral code not available");
      return;
    }
    try {
      await setStringAsync(code);
      showAlert("Copied", "Referral code copied to clipboard!");
    } catch (err) {
      showAlert("Error", "Failed to copy referral code");
    }
  };

  // Card Menu Item matching the reference UI screenshot
  const ProfileMenuItem = ({
    icon,
    label,
    onPress,
    extra,
  }: {
    icon: any;
    label: string;
    onPress?: () => void;
    extra?: React.ReactNode;
  }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{
        width: '100%',
        height: 72,
        borderRadius: 20,
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: isDark ? '#1C1C20' : '#FFFFFF',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
        marginBottom: 12,
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.2 : 0.04,
        shadowRadius: 6,
        elevation: 2,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Ionicons
            name={icon}
            size={22}
            color={isDark ? '#9CA3AF' : '#666666'}
          />
          <Text
            style={{
              fontFamily: 'Poppins_600SemiBold',
              fontSize: 14,
              color: isDark ? '#FFFFFF' : '#000000',
              marginTop: 4,
            }}
          >
            {label}
          </Text>
        </View>
        {extra}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#131316' : '#E0E0E0' }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Top Header Bar: Hamburger + Profile */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: Math.max(insets.top + 8, 16),
          paddingHorizontal: 20,
          paddingBottom: 14,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {canSeeAdmin && (
            <TouchableOpacity
              onPress={openDrawer}
              activeOpacity={0.75}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: isDark ? '#1C1C20' : '#FFFFFF',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.1)',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isDark ? 0.25 : 0.06,
                shadowRadius: 4,
                elevation: 2,
              }}
            >
              <Ionicons name="menu" size={22} color={isDark ? '#FFFFFF' : '#000000'} />
            </TouchableOpacity>
          )}
          <Text
            style={{
              fontFamily: 'Talina',
              fontSize: 24,
              color: isDark ? '#FFFFFF' : '#000000',
              letterSpacing: 0.5,
            }}
          >
            Profile
          </Text>
        </View>
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="never"
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 110,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Profile Card matching UI reference */}
        <View
          style={{
            backgroundColor: isDark ? '#1C1C20' : '#FFFFFF',
            borderRadius: 24,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
            padding: 22,
            marginBottom: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDark ? 0.3 : 0.06,
            shadowRadius: 10,
            elevation: 4,
          }}
        >
          {/* Top Row: User Name & Email on left, Circular Avatar on right */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <View style={{ flex: 1, marginRight: 12 }}>
              <TouchableOpacity activeOpacity={0.9} onPress={handleDebugTap}>
                <Text
                  style={{
                    fontFamily: 'Poppins_700Bold',
                    fontSize: 24,
                    lineHeight: 30,
                    color: isDark ? '#FFFFFF' : '#000000',
                  }}
                  numberOfLines={2}
                >
                  {userProfile?.displayName || "User"}
                </Text>
              </TouchableOpacity>
              <Text
                style={{
                  fontFamily: 'Poppins_400Regular',
                  fontSize: 14,
                  color: isDark ? '#9CA3AF' : '#666666',
                  marginTop: 4,
                }}
                numberOfLines={1}
              >
                {userProfile?.email || "LM.thapar.edu"}
              </Text>
            </View>

            {/* Avatar circle with cyan ring */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setShowQRModal(true)}
              style={{
                width: 66,
                height: 66,
                borderRadius: 33,
                borderWidth: 3,
                borderColor: '#38BDF8',
                backgroundColor: isDark ? '#121214' : '#E5E7EB',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {userProfile?.photoURL ? (
                <Image
                  source={{ uri: userProfile.photoURL }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              ) : (
                <Ionicons
                  name="person"
                  size={32}
                  color={isDark ? '#9CA3AF' : '#4B5563'}
                />
              )}
            </TouchableOpacity>
          </View>

          {/* Bottom Row: Logout & Delete Account Buttons */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              alignItems: 'center',
              marginTop: 20,
              gap: 10,
            }}
          >
            {/* Logout Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleSignOutPress}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 12,
                backgroundColor: isDark ? '#1F2228' : '#FEE2E2',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : '#FCA5A5',
              }}
            >
              <Ionicons name="log-out-outline" size={16} color="#EF4444" />
              <Text
                style={{
                  fontFamily: 'Poppins_600SemiBold',
                  fontSize: 13,
                  color: '#EF4444',
                }}
              >
                Logout
              </Text>
            </TouchableOpacity>

            {/* Delete Account Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleDeleteAccount}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 12,
                backgroundColor: isDark ? '#1F2228' : '#FEF2F2',
                borderWidth: 1,
                borderColor: '#EF4444',
              }}
            >
              <Ionicons name="trash-outline" size={15} color="#EF4444" />
              <Text
                style={{
                  fontFamily: 'Poppins_600SemiBold',
                  fontSize: 13,
                  color: '#EF4444',
                }}
              >
                Delete Account
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Menu Items List matching reference UI */}
        <ProfileMenuItem
          icon="bed-outline"
          label="Accommodation & Hostel"
          onPress={() => router.push("/profile/Accommodation")}
        />

        <ProfileMenuItem
          icon="restaurant-outline"
          label="Meal Pass"
          onPress={() => router.push("/profile/MealPass" as any)}
        />

        <ProfileMenuItem
          icon="calendar-outline"
          label="My Events"
          onPress={() => router.push("/profile/UserEvents")}
        />

        <ProfileMenuItem
          icon="person-outline"
          label="Profile Details"
          onPress={() => router.push("/profile/ProfileDetails")}
        />

        {/* Theme Switch Card */}
        <ProfileMenuItem
          icon={isDark ? "moon-outline" : "sunny-outline"}
          label={isDark ? "Dark Theme (Active)" : "Light Theme (Active)"}
          onPress={toggleTheme}
          extra={
            <TouchableOpacity
              onPress={toggleTheme}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderRadius: 12,
                backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                borderWidth: 1,
                borderColor: isDark ? '#38BDF8' : '#F59E0B',
              }}
            >
              <Text
                style={{
                  fontFamily: 'Poppins_600SemiBold',
                  fontSize: 12,
                  color: isDark ? '#38BDF8' : '#F59E0B',
                }}
              >
                Switch
              </Text>
            </TouchableOpacity>
          }
        />

        {/* Referral Code Card */}
        {userProfile?.referralCode ? (
          <ProfileMenuItem
            icon="gift-outline"
            label={`Referral Code: ${userProfile.referralCode}`}
            onPress={handleCopyReferral}
            extra={
              <Ionicons
                name="copy-outline"
                size={18}
                color={isDark ? '#38BDF8' : '#0C3572'}
              />
            }
          />
        ) : null}

        <ProfileMenuItem
          icon="people-outline"
          label="Our Team"
          onPress={() => router.push("/profile/Team")}
        />

        <ProfileMenuItem
          icon="share-social-outline"
          label="Share App"
          onPress={handleShareApp}
        />

        <ProfileMenuItem
          icon="help-circle-outline"
          label="FAQ & Help"
          onPress={() => router.push("/profile/FAQ")}
        />

        <ProfileMenuItem
          icon="cloud-download-outline"
          label={checkingUpdate ? "Checking for Updates..." : `Check for Updates (v${getAppVersion()})`}
          onPress={handleCheckForUpdates}
        />
      </ScrollView>

      {/* User QR Code Modal */}
      <UserQRCodeModal
        visible={showQRModal}
        onClose={() => setShowQRModal(false)}
        userId={userProfile?.userId || ""}
        userName={userProfile?.displayName || "User"}
      />
    </View>
  );
};

export default ProfileScreen;
