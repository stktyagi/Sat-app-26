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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useUserStore } from '@/state/userStore';
import Header from '@/components/layout/Header';
import UserQRCodeModal from "@/components/profile/UserQRCodeModal";
import { getAppVersion } from "@/utils/appVersion";
import { setStringAsync } from "expo-clipboard";
import { showAlert } from "@/components";
import { checkAppStatus } from "@/utils/versionCheck";
import { runAllDebugChecks } from "@/utils/debugVersion";

const ProfileScreen = () => {
  const router = useRouter();
  const { userData: userProfile } = useUserStore();
  const [showQRModal, setShowQRModal] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [debugTapCount, setDebugTapCount] = useState(0);

  const boysHairStyles = ['turban','fonze']
  const girlsHairStyles = ['full','pixie']
  //build the profile pic url ?hair= random hairstyle based on user.gender
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
      // Reset counter
      setDebugTapCount(0);

      // Run debug checks
      console.log('\n\n🔍 Running Firebase Debug Checks...\n');
      await runAllDebugChecks();

      showAlert(
        "🔍 Debug Mode",
        "Firebase debug checks have been run. Check the console logs for detailed information.",
        [{ text: "OK" }]
      );
    } else if (newCount >= 4) {
      // Give feedback that they're getting close
      console.log(`Debug mode: ${newCount}/7 taps`);
    }

    // Reset counter after 2 seconds of no taps
    setTimeout(() => setDebugTapCount(0), 2000);
  };

  const handleSignOutPress = async () => {
    try {
      const { handleSignOut } = await import('@/api/auth');
      await handleSignOut();
      useUserStore.getState().logout();
      router.replace('/(auth)');
    } catch (error) {
      console.error('Logout error:', error);
      showAlert('Error', 'Failed to log out properly');
    }
  };
  const handleCheckForUpdates = async () => {
    setCheckingUpdate(true);
    try {
      const currentVersion = getAppVersion();
      console.log('[ProfileScreen] ========== MANUAL UPDATE CHECK ==========');
      console.log('[ProfileScreen] Current version:', currentVersion);
      console.log('[ProfileScreen] Platform:', Platform.OS);

      const result = await checkAppStatus(currentVersion);

      console.log('[ProfileScreen] ========== CHECK RESULTS ==========');
      console.log('[ProfileScreen] Full result:', JSON.stringify(result, null, 2));
      console.log('[ProfileScreen] Maintenance under maintenance?', result.maintenanceInfo.isUnderMaintenance);
      console.log('[ProfileScreen] Update required?', result.versionInfo.updateRequired);
      console.log('[ProfileScreen] =====================================');

      if (result.maintenanceInfo.isUnderMaintenance) {
        showAlert(
          "🚧 Maintenance Mode",
          `The app is currently under maintenance for ${result.maintenanceInfo.platform}.\n\nPlease check back later. We apologize for the inconvenience.`,
          [
            { text: "OK" },
          ]
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

    let appStoreUrl =
      Platform.OS === "ios"
        ? result.appLinks.appleStore
        : result.appLinks.playStore;

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

  const handleContactUs = () => {
    Linking.openURL("mailto:styagi_be23@thapar.edu");
  };
  const handleFollowUs = () => {
    Linking.openURL("https://www.instagram.com/saturnalia.thapar");
  };

  const handleRateApp = async () => {
    const currentVersion = getAppVersion();
    const result = await checkAppStatus(currentVersion);

    let appStoreUrl =
      Platform.OS === "ios"
        ? result.appLinks.appleStore
        : result.appLinks.playStore;

    showAlert("Rate App", "Please rate our app on the app store!", [
      { text: "Cancel", style: "cancel" },
      { text: "Rate", onPress: () => Linking.openURL(appStoreUrl) },
    ]);
  };

  const MenuIcon = ({ iconName, color }: { iconName: any; color: string }) => (
    <View className={`rounded-full items-center justify-center mr-4`}>
      <Ionicons name={iconName} size={30} color={color} />
    </View>
  );

  const MenuItem = ({
    icon,
    title,
    onPress,
    iconColor,
  }: {
    icon: any;
    title: string;
    onPress: () => void;
    iconColor: string;
  }) => (
    <TouchableOpacity
      className="bg-[#2D1E2F]/40 mb-4 p-[2px] rounded-[10px] shadow-sm"
      onPress={onPress}
    >
      <View className="flex-row items-center border-[1.5px] border-[#6b6474] p-3 rounded-[8px]">
        <MenuIcon iconName={icon} color={iconColor} />
        <Text className="text-white text-base font-medium flex-1">{title}</Text>
        <Ionicons name="chevron-forward" size={20} color="#fff" />
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-transparent">
      {/* Scrollable Black Content */}
      <Header />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <View className="bg-transparent rounded-t-3xl min-h-screen px-6 pt-8">
          {/* Profile Section */}
          <View className="items-center mb-4">
            {/* Profile Image with QR Code Button */}
            <TouchableOpacity
              onPress={handleDebugTap}
              activeOpacity={0.9}
              className="w-28 h-28 relative mb-4"
            >
              <Image
                source={{
                  uri: profilePicUrl,
                }}
                className="w-28 h-28 rounded-full bg-white"
              />

              {/* QR Code Button - GPay style */}
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  setShowQRModal(true);
                }}
                className="absolute -bottom-1 -right-1 w-10 h-10 bg-[#EEB170] rounded-full items-center justify-center shadow-lg"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 3.84,
                  elevation: 5,
                }}
              >
                <Ionicons name="qr-code" size={20} color="#000" />
              </TouchableOpacity>
            </TouchableOpacity>

            {/* User Info */}
            <Text
              style={{ fontFamily: "Outfit_700Bold" }}
              className="text-[#0C3572] text-2xl mb-1"
            >
              {userProfile?.displayName || "User123"}
            </Text>
            <Text
              style={{ fontFamily: "Outfit_500Medium" }}
              className="text-[#2175C0] text-base mb-6"
            >
              {userProfile?.email || "email@email.com"}
            </Text>
            <View>
              {/* Referral code with copy option */}
              <View className="flex-row w-60 items-center my-2 bg-[#1A1A1A] rounded-xl p-4">
                <View className="flex-1 flex-col">
                  <Text
                    style={{ fontFamily: "Outfit_500Medium" }}
                    className="text-gray-400 text-sm "
                  >
                    Your Referral Code:
                  </Text>
                  <Text
                    style={{ fontFamily: "Outfit_500Medium" }}
                    className="text-white text-sm flex-1"
                  >
                    {userProfile?.referralCode || "Not available"}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={async () => {
                    const code = userProfile?.referralCode;
                    if (!code) {
                      showAlert("No Code", "Referral code not available");
                      return;
                    }
                    try {
                      await setStringAsync(code);
                      showAlert("Copied", "Referral code copied to clipboard");
                    } catch (err) {
                      console.error("Copy failed", err);
                      showAlert("Error", "Failed to copy referral code");
                    }
                  }}
                  className="ml-3 p-2 bg-[#1A1A1A] rounded-full"
                  accessibilityLabel="Copy referral code"
                >
                  <Ionicons name="copy" size={16} color="#EEB170" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Menu Items */}
          <View>
            {/* <MenuItem
              icon="wallet"
              title="My Wallet"
              onPress={() => router.push("/WalletDashboard")}
              iconColor="#0C3572"
            /> */}

            <MenuItem
              icon="person-circle"
              title="Profile Details"
              onPress={() => router.push("/profile/ProfileDetails")}
              iconColor="#0C3572"
            />

            {!isHostCollegeStudent && (
              <MenuItem
                icon="home"
                title="Accommodation"
                onPress={() => router.push("/profile/Accommodation")}
                iconColor="#0C3572"
              />
            )}

            <MenuItem
              icon="calendar"
              title="Your Events"
              onPress={() => router.push("/profile/UserEvents")}
              iconColor="#0C3572"
            />

            <MenuItem
              icon="receipt"
              title="Your Orders"
              onPress={() => router.push("/profile/UserOrders")}
              iconColor="#0C3572"
            />

            <MenuItem
              icon="people"
              title="Our Team"
              onPress={() => router.push("/profile/Team")}
              iconColor="#0C3572"
            />

            <MenuItem
              icon="share-social"
              title="Share App"
              onPress={handleShareApp}
              iconColor="#0C3572"
            />

            <MenuItem
              icon="help-circle"
              title="FAQ"
              onPress={() => router.push("/profile/FAQ")}
              iconColor="#0C3572"
            />

            <MenuItem
              icon="alert-circle"
              title="Report a Problem"
              onPress={() => router.push("/profile/ReportProblem")}
              iconColor="#0C3572"
            />

            <MenuItem
              icon="star"
              title="Rate App"
              onPress={handleRateApp}
              iconColor="#0C3572"
            />

            <TouchableOpacity
              className="flex-row items-center bg-[#0C3572] mb-4 p-4 rounded-2xl shadow-sm"
              onPress={handleCheckForUpdates}
              disabled={checkingUpdate}
            >
              <MenuIcon
                iconName={checkingUpdate ? "hourglass" : "cloud-download"}
                color="#00CC9C"
              />
              <Text className="text-white text-base font-medium flex-1">
                {checkingUpdate ? "Checking for Updates..." : "Check for Updates"}
              </Text>
              <View className="bg-[#ffffff3d] px-3 py-1 rounded-full">
                <Text
                  style={{ fontFamily: "Outfit_600SemiBold" }}
                  className="text-[#00CC9C] text-xs"
                >
                  v{getAppVersion()}
                </Text>
              </View>
            </TouchableOpacity>

            <MenuItem
              icon="call"
              title="Contact Us"
              onPress={handleContactUs}
              iconColor="#0C3572"
            />

            <MenuItem
              icon="logo-instagram"
              title="Follow Us"
              onPress={handleFollowUs}
              iconColor="#0C3572"
            />

            <MenuItem
              icon="log-out"
              title="Log Out"
              onPress={handleSignOutPress}
              iconColor="#0C3572"
            />
          </View>
        </View>
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
