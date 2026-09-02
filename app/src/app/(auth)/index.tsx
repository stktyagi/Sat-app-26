// src/screens/Auth/LoginScreen.tsx
import React, { useEffect } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
} from "react-native";
import { useUserStore } from '@/state/userStore';
import { showAlert } from "../../components";
import * as AppleAuthentication from "expo-apple-authentication";
import { Linking } from "react-native";
import { requestNotificationPermission } from '@/utils/fcm';

import { useRouter } from 'expo-router';
import { handleGoogleSignIn, handleAppleSignIn, initializeGoogleSignIn } from '@/api/auth';

const LoginScreen = () => {
  const { isSigningIn, setSigningIn, setUserData, setAuthUser } = useUserStore();
  const router = useRouter();

  useEffect(() => {
    initializeGoogleSignIn();
  }, []);

  const handleSignInSuccess = (result: any, provider: string) => {
    if (result.firebaseUser) {
      setAuthUser(result.firebaseUser);
    }
    if (result.profile) {
      setUserData(result.profile);
    }

    if (result.isFirstTime || (result.profile && !result.profile.fullyRegistered)) {
      console.log(`User needs to complete profile (${provider})`);
      router.replace('/(auth)/UserProfileFormScreen');
    } else {
      console.log(`User fully registered, proceeding to tabs (${provider})`);
      router.replace('/(tabs)');
    }
  };

  const onGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      const result = await handleGoogleSignIn();
      handleSignInSuccess(result, 'Google');
    } catch (error: any) {
      if (error?.message !== "SIGN_IN_CANCELLED") {
        showAlert('Error', 'An error occurred during sign in. Please try again.');
        console.error('Google Login error:', error);
      }
    } finally {
      setSigningIn(false);
    }
  };

  const onAppleSignIn = async () => {
    setSigningIn(true);
    try {
      const result = await handleAppleSignIn();
      handleSignInSuccess(result, 'Apple');
    } catch (error: any) {
      if (error?.message !== "SIGN_IN_CANCELLED") {
        showAlert('Error', 'An error occurred during sign in. Please try again.');
        console.error('Apple Login error:', error);
      }
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <View className="relative h-screen flex-1 items-center">
      <Image
        source={require("@/assets/background.png")}
        className="absolute h-full w-full"
      />
      <View className="flex-1 flex-col justify-end pb-40 items-center px-4 w-full">
        <View className="w-full flex-col items-center">
          <View className="w-full flex-row items-center gap-3">
            <TouchableOpacity
              className="bg-[#352C06] flex-1 border-2 border-[#FDCE04] rounded-lg flex-row items-center justify-center"
              style={{ height: 52, flex: 1, minWidth: '45%' }}
              onPress={onGoogleSignIn}
              disabled={isSigningIn}
            >
              {isSigningIn ? (
                <ActivityIndicator size="small" color="#FDCE04" />
              ) : (
                <View className="flex-row items-center">
                  <Image
                    source={require("@/assets/google.png")}
                    className="h-6 w-6 mr-3"
                    resizeMode="contain"
                  />
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className="text-[#FDCE04]"
                  >
                    Sign in with Google
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {Platform.OS === "ios" && (
              <View className="flex-1" style={{ flex: 1, minWidth: '45%' }}>
                {isSigningIn ? (
                  <View className="bg-black border-2 border-white rounded-lg flex-row items-center justify-center" style={{ width: "100%", height: 52 }}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  </View>
                ) : (
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                    style={{ width: "100%", height: 52, borderRadius: 12 }}
                    cornerRadius={12}
                    onPress={onAppleSignIn}
                  />
                )}
              </View>
            )}
          </View>
          <Text
            style={{ fontFamily: "Outfit_600SemiBold" }}
            className="text-white mt-5 text-sm"
          >
            Thapar Students Kindly Sign in with Thapar gmail Account
          </Text>
          <Text
            style={{ fontFamily: "Outfit_600SemiBold" }}
            className="text-white text-sm mt-4 text-center"
          >
            By signing in, you agree to our{" "}
            <Text
              style={{ color: "#FDCE04", textDecorationLine: "underline" }}
              onPress={() => Linking.openURL("https://saturnalia.in/policies")}
            >
              Terms of Service and Privacy Policy
            </Text>
          </Text>
        </View>
      </View>
    </View>
  );
};
export default LoginScreen;
