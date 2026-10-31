// src/screens/Auth/LoginScreen.tsx
import React, { useEffect, useState } from "react";
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
  StatusBar,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useUserStore } from "@/state/userStore";
import { showAlert } from "../../components";
import * as AppleAuthentication from "expo-apple-authentication";
import { useRouter } from "expo-router";
import {
  handleGoogleSignIn,
  handleAppleSignIn,
  handleEmailSignIn,
  initializeGoogleSignIn,
} from "@/api/auth";

const LoginScreen = () => {
  const insets = useSafeAreaInsets();
  const { isSigningIn, setSigningIn, setUserData, setAuthUser } =
    useUserStore();
  const router = useRouter();
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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

    if (
      result.isFirstTime ||
      (result.profile && !result.profile.fullyRegistered)
    ) {
      console.log(`User needs to complete profile (${provider})`);
      router.replace("/(auth)/UserProfileFormScreen");
    } else {
      console.log(`User fully registered, proceeding to tabs (${provider})`);
      router.replace("/(tabs)");
    }
  };

  const onGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      const result = await handleGoogleSignIn();
      handleSignInSuccess(result, "Google");
    } catch (error: any) {
      if (error?.message !== "SIGN_IN_CANCELLED") {
        showAlert("Error", "An error occurred during sign in. Please try again.");
        console.error("Google Login error:", error);
      }
    } finally {
      setSigningIn(false);
    }
  };

  const onEmailSignIn = async () => {
    if (!email.trim() || !password) {
      showAlert("Error", "Enter your email and password.");
      return;
    }
    setSigningIn(true);
    try {
      const result = await handleEmailSignIn(email, password);
      handleSignInSuccess(result, "Email");
    } catch (error: any) {
      showAlert("Error", "Could not sign in with those details.");
      console.error("Email Login error:", error?.code || error?.message);
    } finally {
      setSigningIn(false);
    }
  };

  const onAppleSignIn = async () => {
    setSigningIn(true);
    try {
      const result = await handleAppleSignIn();
      handleSignInSuccess(result, "Apple");
    } catch (error: any) {
      if (error?.message !== "SIGN_IN_CANCELLED") {
        showAlert("Error", "An error occurred during sign in. Please try again.");
        console.error("Apple Login error:", error);
      }
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#131316" }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Full screen artwork poster */}
      <Image
        source={require("@/assets/background.png")}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          height: "100%",
        }}
        resizeMode="cover"
      />

      {/* Subtle top bar branding pill */}
      <View
        style={{
          paddingTop: Math.max(insets.top + 12, 44),
          paddingHorizontal: 20,
          alignItems: "center",
        }}
      >
        
      </View>

      {/* Bottom Auth Card */}
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          paddingHorizontal: 16,
          paddingBottom: Math.max(insets.bottom + 16, 24),
        }}
      >
        <View
          style={{
            // backgroundColor: "rgba(22, 22, 27, 0.92)",
            // borderRadius: 28,
            // borderWidth: 1,
            // borderColor: "rgba(255, 255, 255, 0.12)",
            paddingHorizontal: 20,
            paddingTop: 24,
            paddingBottom: 20,
            // shadowColor: "#000",
            // shadowOffset: { width: 0, height: 8 },
            // shadowOpacity: 0.45,
            // shadowRadius: 16,
            // elevation: 10,
          }}
        >
          

          {/* Action Buttons */}
          <View style={{ width: "100%", gap: 10 }}>
            {/* Apple Sign-in (iOS only) */}
            {Platform.OS === "ios" && (
              <View style={{ width: "100%", height: 52 }}>
                {isSigningIn ? (
                  <View
                    style={{
                      width: "100%",
                      height: 52,
                      backgroundColor: "#000000",
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.2)",
                      borderRadius: 16,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  </View>
                ) : (
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={
                      AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                    }
                    buttonStyle={
                      AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                    }
                    style={{ width: "100%", height: 52, borderRadius: 16 }}
                    cornerRadius={16}
                    onPress={onAppleSignIn}
                  />
                )}
              </View>
            )}

            {/* Google Sign-in */}
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={onGoogleSignIn}
              disabled={isSigningIn}
              style={{
                width: "100%",
                height: 52,
                borderRadius: 16,
                backgroundColor: "rgba(28, 28, 32, 0.95)",
                borderWidth: 1.5,
                borderColor: "#FFBA00",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#FFBA00",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.18,
                shadowRadius: 6,
                elevation: 2,
              }}
            >
              {isSigningIn ? (
                <ActivityIndicator size="small" color="#FFBA00" />
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Image
                    source={require("@/assets/google.png")}
                    style={{ width: 22, height: 22, marginRight: 12 }}
                    resizeMode="contain"
                  />
                  <Text
                    style={{
                      fontFamily: "Poppins_600SemiBold",
                      fontSize: 15,
                      color: "#FFBA00",
                    }}
                  >
                    Continue with Google
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Email sign-in (App Review only; accounts are created in the Firebase console) */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setShowEmailForm((v) => !v)}
              style={{ alignItems: "center", paddingVertical: 4 }}
            >
              <Text
                style={{
                  fontFamily: "Poppins_500Medium",
                  fontSize: 13,
                  color: "rgba(255, 255, 255, 0.75)",
                  textDecorationLine: "underline",
                }}
              >
                {showEmailForm ? "Hide email sign-in" : "Sign in with email"}
              </Text>
            </TouchableOpacity>

            {showEmailForm && (
              <View style={{ gap: 10 }}>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email"
                  placeholderTextColor="rgba(255, 255, 255, 0.45)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="username"
                  style={{
                    height: 48,
                    borderRadius: 14,
                    paddingHorizontal: 14,
                    color: "#FFFFFF",
                    fontFamily: "Poppins_400Regular",
                    fontSize: 15,
                    backgroundColor: "rgba(28, 28, 32, 0.95)",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.2)",
                  }}
                />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor="rgba(255, 255, 255, 0.45)"
                  secureTextEntry
                  autoCapitalize="none"
                  textContentType="password"
                  style={{
                    height: 48,
                    borderRadius: 14,
                    paddingHorizontal: 14,
                    color: "#FFFFFF",
                    fontFamily: "Poppins_400Regular",
                    fontSize: 15,
                    backgroundColor: "rgba(28, 28, 32, 0.95)",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.2)",
                  }}
                />
                <TouchableOpacity
                  activeOpacity={0.82}
                  onPress={onEmailSignIn}
                  disabled={isSigningIn}
                  style={{
                    height: 48,
                    borderRadius: 14,
                    backgroundColor: "#FFBA00",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {isSigningIn ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 15, color: "#000000" }}>
                      Sign in
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Thapar student note pill */}
          <View
            style={{
              backgroundColor: "rgba(13, 80, 112, 1)",
              // borderWidth: 1,
              borderColor: "rgba(65, 184, 240, 0.8)",
              borderRadius: 14,
              paddingVertical: 9,
              paddingHorizontal: 12,
              flexDirection: "row",
              alignItems: "center",
              marginTop: 16,
            }}
          >
            <Ionicons
              name="school-outline"
              size={18}
              color="#41B8F0"
              style={{ marginRight: 9 }}
            />
            <Text
              style={{
                fontFamily: "Poppins_500Medium",
                fontSize: 12,
                color: "#FFFFFF",
                flex: 1,
                lineHeight: 16,
              }}
            >
              Thapar students, kindly sign in using your Thapar Google account (@thapar.edu)
            </Text>
          </View>

          {/* Terms & Privacy */}
          <Text
            style={{
              fontFamily: "Poppins_400Regular",
              fontSize: 11.5,
              color: "rgba(255, 255, 255, 0.65)",
              textAlign: "center",
              lineHeight: 17,
              marginTop: 14,
            }}
          >
            By continuing, you agree to our{" "}
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
        </View>
      </View>
    </View>
  );
};

export default LoginScreen;
