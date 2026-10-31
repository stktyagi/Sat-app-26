import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { setStringAsync } from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MetallicButton from "@/components/MetallicButton";
import { FirebaseEvent } from '@/types/models';
import { useUserStore } from '@/state/userStore';
import { showAlert } from "../index";
import { useRouter } from "expo-router";
import { useThemeStore } from "@/state/themeStore";
import { API_BASE_URL } from "@/config/api";
import { getAuthInstance } from "@/config/firebase";
import {
  registerForEvent,
  createEventTeam,
  joinEventTeam,
  responsesFromFields,
} from "@/api/events";
import { isIdentityVerificationComplete, getMissingIdentityRequirements } from "@/utils/identityUpload";

interface RegistrationModalProps {
  visible: boolean;
  event: FirebaseEvent;
  onClose: () => void;
  onSuccess: () => void;
}

type RegistrationStep =
  | "choice"
  | "create-team"
  | "join-team"
  | "custom-fields";

const showModalAlert = (title?: string, message?: string) => {
  if (Platform.OS === "ios") {
    Alert.alert(title || "", message || "");
  } else {
    showAlert(title, message);
  }
};

const RegistrationModal: React.FC<RegistrationModalProps> = ({
  visible,
  event,
  onClose,
  onSuccess,
}: RegistrationModalProps) => {
  const router = useRouter();
  const { isDark } = useThemeStore();
  const userData = useUserStore((state) => state.userData);
  const [registrationStep, setRegistrationStep] =
    useState<RegistrationStep>("choice");
  const insets = useSafeAreaInsets();

  const isHost =
    userData?.isHostCollegeStudent ||
    userData?.collegeName?.toLowerCase().includes("thapar") ||
    userData?.email?.toLowerCase().endsWith("@thapar.edu") ||
    false;
  const eventFee = event.paymentRequired
    ? (isHost ? (event.registrationFee?.host || 0) : (event.registrationFee?.other || 0))
    : 0;
  const requiresPayment = event.paymentRequired && eventFee > 0;
  const [teamName, setTeamName] = useState("");
  const [teamInviteCode, setTeamInviteCode] = useState("");
  const [customFieldsData, setCustomFieldsData] = useState<Record<string, any>>(
    {}
  );
  const [isLoading, setIsLoading] = useState(false);
  const [createdInviteCode, setCreatedInviteCode] = useState<string>("");
  const [createdTeamId, setCreatedTeamId] = useState<string>("");
  const [hasReferralCode, setHasReferralCode] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [currentTeamSize, setCurrentTeamSize] = useState<number>(0);
  const [isCreateTeamFlow, setIsCreateTeamFlow] = useState(false);
  const [detailPhone, setDetailPhone] = useState("");
  const [detailAge, setDetailAge] = useState("");
  const [detailGender, setDetailGender] = useState<"" | "male" | "female" | "other">("");

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setCustomFieldsData({});
      setTeamName("");
      setTeamInviteCode("");
      setCreatedInviteCode("");
      setHasReferralCode(false);
      setReferralCode("");
      setCurrentTeamSize(0);
      setIsCreateTeamFlow(false);

      const profile = useUserStore.getState().userData;
      setDetailPhone(profile?.phoneNumber ?? "");
      setDetailAge(profile?.age ?? "");
      setDetailGender(profile?.gender ?? "");

      if (event.eventType === "team") {
        setRegistrationStep("choice");
      } else {
        setRegistrationStep("custom-fields");
      }
    }
  }, [visible, event.eventType]);

  const canGoBack =
    event.eventType === "team" &&
    (registrationStep === "create-team" ||
      registrationStep === "join-team" ||
      (registrationStep === "custom-fields" && !createdInviteCode));

  const handleBack = () => {
    if (registrationStep === "create-team" || registrationStep === "join-team") {
      setRegistrationStep("choice");
    } else if (registrationStep === "custom-fields") {
      if (isCreateTeamFlow) {
        setRegistrationStep("create-team");
      } else {
        setRegistrationStep("join-team");
      }
    }
  };

  const handleCreateTeam = async () => {
    if (!isIdentityVerificationComplete(userData)) {
      const missing = getMissingIdentityRequirements(userData);
      showModalAlert(
        "Verification Required",
        `Outside college participants must upload their ${missing.join(" and ")} before creating a team.`
      );
      return;
    }

    if (!teamName.trim()) {
      showModalAlert("Error", "Please enter a team name");
      return;
    }

    if (event.customFields?.length) {
      setIsCreateTeamFlow(true);
      setRegistrationStep("custom-fields");
      return;
    }

    try {
      setIsLoading(true);
      const result = await createEventTeam(event.eventId, teamName.trim(), []);
      setCreatedInviteCode(result.inviteCode || result.team?.inviteCode);
      setCreatedTeamId(result.team?.teamId || "");
      setCurrentTeamSize(1);
      setIsCreateTeamFlow(true);
      showModalAlert("Team Created!", "Share the invite code with your teammates.");
      setRegistrationStep("custom-fields");
      onSuccess();
    } catch (error: any) {
      showModalAlert("Error", error.message || "Failed to create team");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinTeam = async () => {
    if (!isIdentityVerificationComplete(userData)) {
      const missing = getMissingIdentityRequirements(userData);
      showModalAlert(
        "Verification Required",
        `Outside college participants must upload their ${missing.join(" and ")} before joining a team.`
      );
      return;
    }

    if (!teamInviteCode.trim()) {
      showModalAlert("Error", "Please enter a team invite code");
      return;
    }

    if (event.customFields?.length) {
      setIsCreateTeamFlow(false);
      setRegistrationStep("custom-fields");
      return;
    }

    try {
      setIsLoading(true);
      await joinEventTeam(event.eventId, teamInviteCode.trim(), []);
      showModalAlert("Success", "Successfully joined the team!");
      onSuccess();
      onClose();
      router.push({ pathname: '/events/MyEventDetails', params: { eventId: event.eventId } });
    } catch (error: any) {
      showModalAlert("Error", error.message || "Failed to join team");
    } finally {
      setIsLoading(false);
    }
  };

  const buildDetailsPayload = () => {
    const payload: Record<string, string> = {};
    if (detailPhone.trim()) {
      const digits = detailPhone.replace(/\D/g, "");
      if (digits.length !== 10) throw new Error("Phone number must be 10 digits");
      payload.phoneNumber = digits;
    }
    const age = detailAge.trim();
    if (age) {
      if (!/^\d{1,3}$/.test(age)) throw new Error("Please enter a valid age");
      payload.age = age;
    }
    if (detailGender) payload.gender = detailGender;
    return payload;
  };

  const saveRegistrationDetails = async (payload: Record<string, string>) => {
    if (Object.keys(payload).length === 0) return;
    const currentUser = getAuthInstance().currentUser;
    if (!currentUser) throw new Error("No authenticated user found");
    const idToken = await currentUser.getIdToken(false);
    const response = await fetch(`${API_BASE_URL}/me`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({} as any));
      throw new Error(errorData?.error?.message || errorData?.message || "Failed to save your details");
    }
    const responseBody = await response.json();
    if (responseBody?.user) useUserStore.getState().setUserData(responseBody.user);
  };

  const handleCompleteRegistration = async () => {
    if (!isIdentityVerificationComplete(userData)) {
      const missing = getMissingIdentityRequirements(userData);
      showModalAlert(
        "Verification Required",
        `Outside college participants must upload their ${missing.join(" and ")} before completing registration.`
      );
      return;
    }

    try {
      setIsLoading(true);

      await saveRegistrationDetails(buildDetailsPayload());
      const registrationData = responsesFromFields(event.customFields || [], customFieldsData);

      if (event.eventType === "team") {
        if (isCreateTeamFlow) {
          const result = await createEventTeam(event.eventId, teamName.trim(), registrationData);
          setCreatedInviteCode(result.inviteCode || result.team?.inviteCode);
          setCreatedTeamId(result.team?.teamId || "");
          setCurrentTeamSize(1);
          showModalAlert("Team Created!", "Share the invite code with your teammates.");
          onSuccess();
          onClose();
          router.push({ pathname: '/events/MyEventDetails', params: { eventId: event.eventId } });
          return;
        } else {
          await joinEventTeam(event.eventId, teamInviteCode.trim(), registrationData);
          showModalAlert("Success", "Successfully joined the team!");
        }
        onSuccess();
        onClose();
        router.push({ pathname: '/events/MyEventDetails', params: { eventId: event.eventId } });
        return;
      }

      await registerForEvent(event.eventId, registrationData);
      onSuccess();
      onClose();
      if (requiresPayment) {
        router.push({ pathname: '/events/Payment', params: { eventId: event.eventId } });
      } else {
        showModalAlert("Success", "Registration completed successfully!");
        router.push({ pathname: '/events/MyEventDetails', params: { eventId: event.eventId } });
      }
    } catch (error: any) {
      showModalAlert("Error", error.message || "Failed to complete registration");
    } finally {
      setIsLoading(false);
    }
  };

  const expression =
    /[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
  const linkRegex = new RegExp(expression);

  function isResponseValid(field: any, response: any) {
    if (
      field.isRequired &&
      (response == undefined ||
        (typeof response == "string" && response.trim() == "") ||
        (Array.isArray(response) && response.length == 0))
    )
      return false;
    if (
      response == undefined ||
      (typeof response == "string" && response.trim() == "") ||
      (Array.isArray(response) && response.length == 0)
    )
      return true;

    if (field.type == "number") {
      const num = parseInt(response);
      if (Number.isNaN(num)) return false;
      if (num > field.maxValue) return false;
      if (num < field.minValue) return false;
      return true;
    }
    if (field.type == "link") {
      return response.match(linkRegex);
    }
    if (field.type == "select") {
      return field.options?.includes(response);
    }
    if (field.type == "multi-select") {
      if (!Array.isArray(response)) return false;
      for (const optionSelected of response) {
        if (!field.options?.includes(optionSelected)) return false;
      }
    }
    return true;
  }

  const renderField = (field: any) => {
    const value = customFieldsData[field.fieldId];

    switch (field.type) {
      case "text":
      case "link":
        return (
          <TextInput
            value={value || ""}
            onChangeText={(text) => {
              setCustomFieldsData({
                ...customFieldsData,
                [field.fieldId]: text,
              });
            }}
            placeholder={field.placeholder || field.label}
            placeholderTextColor={modalPlaceholder}
            style={{
              fontFamily: "Poppins_500Medium",
              backgroundColor: modalCardBg,
              color: modalTextPrimary,
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: modalBorderColor,
              fontSize: 15,
            }}
            keyboardType={field.type === "link" ? "url" : "default"}
            autoCapitalize={field.type === "link" ? "none" : "sentences"}
          />
        );

      case "number":
        return (
          <>
            <TextInput
              value={value?.toString() || ""}
              onChangeText={(text) => {
                const numValue = text ? parseFloat(text) : "";
                setCustomFieldsData({
                  ...customFieldsData,
                  [field.fieldId]: numValue,
                });
              }}
              style={{
                fontFamily: "Poppins_500Medium",
                backgroundColor: modalCardBg,
                color: modalTextPrimary,
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: modalBorderColor,
                fontSize: 15,
              }}
              placeholder={field.placeholder || field.label}
              placeholderTextColor={modalPlaceholder}
              keyboardType="numeric"
            />
            <Text
              style={{
                fontFamily: "Poppins_500Medium",
                color: modalTextSecondary,
                marginTop: 6,
                fontSize: 12,
              }}
            >
              Minimum value of {field.minValue}, Maximum value of {field.maxValue}
            </Text>
          </>
        );

      case "select":
        return (
          <View>
            {customFieldsData[field.fieldId] ? (
              <TouchableOpacity
                onPress={() => {
                  setCustomFieldsData({
                    ...customFieldsData,
                    [field.fieldId]: undefined,
                  });
                }}
              >
                <Text
                  style={{
                    fontFamily: "Poppins_500Medium",
                    color: "#38BDF8",
                    marginBottom: 6,
                    fontSize: 12,
                    textAlign: "right",
                  }}
                >
                  Clear selection
                </Text>
              </TouchableOpacity>
            ) : null}
            <View style={{ gap: 10 }}>
              {field.options?.map((option: string, idx: number) => {
                const isSelected = value === option;
                return (
                  <TouchableOpacity
                    key={idx}
                    onPress={() =>
                      setCustomFieldsData({
                        ...customFieldsData,
                        [field.fieldId]: option,
                      })
                    }
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: isSelected ? "#38BDF8" : modalBorderColor,
                      backgroundColor: isSelected ? "rgba(56, 189, 248, 0.12)" : modalCardBg,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: isSelected ? "Poppins_600SemiBold" : "Poppins_500Medium",
                        color: isSelected ? "#38BDF8" : modalTextPrimary,
                        fontSize: 14,
                      }}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );

      case "multi-select":
        return (
          <View style={{ gap: 10 }}>
            {field.options?.map((option: string, idx: number) => {
              const currentValues = value || [];
              const isSelected = currentValues.includes(option);

              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => {
                    let newValues;
                    if (isSelected) {
                      newValues = currentValues.filter((v: string) => v !== option);
                    } else {
                      newValues = [...currentValues, option];
                    }
                    setCustomFieldsData({
                      ...customFieldsData,
                      [field.fieldId]: newValues,
                    });
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: isSelected ? "#38BDF8" : modalBorderColor,
                    backgroundColor: isSelected ? "rgba(56, 189, 248, 0.12)" : modalCardBg,
                  }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      borderWidth: 1.5,
                      marginRight: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      borderColor: isSelected ? "#38BDF8" : modalPlaceholder,
                      backgroundColor: isSelected ? "#38BDF8" : "transparent",
                    }}
                  >
                    {isSelected && <Ionicons name="checkmark" size={14} color="#000000" />}
                  </View>
                  <Text
                    style={{
                      fontFamily: isSelected ? "Poppins_600SemiBold" : "Poppins_500Medium",
                      color: isSelected ? "#38BDF8" : modalTextPrimary,
                      fontSize: 14,
                    }}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );

      default:
        return null;
    }
  };

  const renderCustomFields = () => {
    const isNonHostStudent = userData && !userData.isHostCollegeStudent;
    let isValid = true;
    for (const field of event.customFields || []) {
      const response = customFieldsData[field.fieldId];
      isValid = isResponseValid(field, response);
      if (!isValid) break;
    }

    return (
      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 }}>
        {!createdInviteCode && (
          <View style={{ gap: 16, marginBottom: 16 }}>
            <Text
              style={{
                fontFamily: "Poppins_600SemiBold",
                color: modalTextPrimary,
                fontSize: 15,
              }}
            >
              Your details (optional)
            </Text>
            <View>
              <Text style={{ fontFamily: "Poppins_500Medium", color: modalTextPrimary, fontSize: 14, marginBottom: 8 }}>
                Phone number
              </Text>
              <TextInput
                value={detailPhone}
                onChangeText={setDetailPhone}
                placeholder="10-digit mobile number"
                placeholderTextColor={modalPlaceholder}
                keyboardType="phone-pad"
                style={{
                  fontFamily: "Poppins_500Medium",
                  backgroundColor: modalCardBg,
                  color: modalTextPrimary,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: modalBorderColor,
                  fontSize: 15,
                }}
              />
            </View>
            <View>
              <Text style={{ fontFamily: "Poppins_500Medium", color: modalTextPrimary, fontSize: 14, marginBottom: 8 }}>
                Age
              </Text>
              <TextInput
                value={detailAge}
                onChangeText={setDetailAge}
                placeholder="e.g. 20"
                placeholderTextColor={modalPlaceholder}
                keyboardType="number-pad"
                maxLength={3}
                style={{
                  fontFamily: "Poppins_500Medium",
                  backgroundColor: modalCardBg,
                  color: modalTextPrimary,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: modalBorderColor,
                  fontSize: 15,
                }}
              />
            </View>
            <View>
              <Text style={{ fontFamily: "Poppins_500Medium", color: modalTextPrimary, fontSize: 14, marginBottom: 8 }}>
                Gender
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(["male", "female", "other"] as const).map((option) => {
                  const isSelected = detailGender === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      onPress={() => setDetailGender(isSelected ? "" : option)}
                      style={{
                        flex: 1,
                        alignItems: "center",
                        paddingVertical: 12,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: isSelected ? "#38BDF8" : modalBorderColor,
                        backgroundColor: isSelected ? "rgba(56, 189, 248, 0.12)" : modalCardBg,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: isSelected ? "Poppins_600SemiBold" : "Poppins_500Medium",
                          color: isSelected ? "#38BDF8" : modalTextPrimary,
                          fontSize: 14,
                          textTransform: "capitalize",
                        }}
                      >
                        {option}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {!createdInviteCode && event.customFields && event.customFields.length > 0 && (
          <View style={{ gap: 16 }}>
            {event.customFields.map((field: any) => (
              <View key={field.fieldId}>
                <Text
                  style={{
                    fontFamily: "Poppins_500Medium",
                    color: modalTextPrimary,
                    fontSize: 14,
                    marginBottom: 8,
                  }}
                >
                  {field.label}
                  {field.isRequired && (
                    <Text style={{ color: "#EF4444" }}> *</Text>
                  )}
                </Text>
                {renderField(field)}
              </View>
            ))}
          </View>
        )}

        {/* Team Invite Code Display if already created */}
        {createdInviteCode && (
          <View
            style={{
              backgroundColor: modalCardBg,
              padding: 18,
              borderRadius: 16,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: modalBorderColor,
            }}
          >
            <Text
              style={{
                fontFamily: "Poppins_600SemiBold",
                color: modalTextSecondary,
                fontSize: 13,
                marginBottom: 8,
              }}
            >
              Your Team Invite Code:
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: isDark ? "#202024" : "#F3F4F6",
                padding: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: modalBorderColor,
              }}
            >
              <Text
                style={{
                  fontFamily: "Poppins_700Bold",
                  color: modalTextPrimary,
                  fontSize: 18,
                  letterSpacing: 2,
                  flex: 1,
                }}
                selectable={true}
              >
                {createdInviteCode}
              </Text>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    await setStringAsync(createdInviteCode);
                    showModalAlert("Copied", "Invite code copied to clipboard!");
                  } catch (err) {
                    showModalAlert("Error", "Failed to copy code");
                  }
                }}
                style={{
                  backgroundColor: modalButtonBg,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Ionicons name="copy-outline" size={16} color={modalTextPrimary} />
                <Text style={{ fontFamily: "Poppins_600SemiBold", color: modalTextPrimary, fontSize: 12 }}>
                  Copy
                </Text>
              </TouchableOpacity>
            </View>
            <Text
              style={{
                fontFamily: "Poppins_400Regular",
                color: modalTextSecondary,
                fontSize: 13,
                marginTop: 8,
              }}
            >
              Share this code with your team members
            </Text>
            {event.minTeamSize && (
              <View
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderTopColor: "rgba(255, 255, 255, 0.08)",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Poppins_600SemiBold",
                    fontSize: 13,
                    color: currentTeamSize >= event.minTeamSize ? "#4ADE80" : "#F59E0B",
                  }}
                >
                  Team Size: {currentTeamSize} / {event.minTeamSize}-{event.maxTeamSize || "∞"}
                </Text>
                {currentTeamSize < event.minTeamSize && (
                  <Text
                    style={{
                      fontFamily: "Poppins_400Regular",
                      color: "#F59E0B",
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    ⚠️ Need {event.minTeamSize - currentTeamSize} more member
                    {event.minTeamSize - currentTeamSize !== 1 ? "s" : ""} to submit
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Referral Code Section - Only for non-host college students */}
        {isNonHostStudent && !createdInviteCode && (
          <View
            style={{
              paddingTop: 16,
              borderTopWidth: 1,
              borderTopColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
              marginTop: 16,
            }}
          >
            <TouchableOpacity
              onPress={() => {
                setHasReferralCode(!hasReferralCode);
                if (hasReferralCode) setReferralCode("");
              }}
              style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  borderWidth: 1.5,
                  marginRight: 10,
                  alignItems: "center",
                  justifyContent: "center",
                  borderColor: hasReferralCode ? "#38BDF8" : modalPlaceholder,
                  backgroundColor: hasReferralCode ? "#38BDF8" : "transparent",
                }}
              >
                {hasReferralCode && <Ionicons name="checkmark" size={14} color="#000000" />}
              </View>
              <Text style={{ fontFamily: "Poppins_500Medium", color: modalTextPrimary, fontSize: 14 }}>
                I have a referral code
              </Text>
            </TouchableOpacity>

            {hasReferralCode && (
              <View>
                <Text
                  style={{
                    fontFamily: "Poppins_500Medium",
                    color: modalTextSecondary,
                    marginBottom: 6,
                    fontSize: 13,
                  }}
                >
                  Referral Code
                </Text>
                <TextInput
                  style={{
                    fontFamily: "Poppins_500Medium",
                    backgroundColor: modalCardBg,
                    color: modalTextPrimary,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: modalBorderColor,
                    fontSize: 15,
                  }}
                  value={referralCode}
                  onChangeText={(text) => setReferralCode(text.toUpperCase())}
                  placeholder="Enter your referral code"
                  placeholderTextColor={modalPlaceholder}
                  autoCapitalize="characters"
                />
              </View>
            )}
          </View>
        )}

        {/* Submit Action Button */}
        <View style={{ marginTop: 28 }}>
          {event.eventType !== "team" ? (
            <MetallicButton
              title={isLoading ? "Registering..." : "Complete Registration"}
              onPress={handleCompleteRegistration}
              disabled={isLoading || !isValid}
              height={54}
              borderRadius={27}
              fontSize={16}
              style={{ width: "100%" }}
              contentStyle={{ width: "100%", height: 51 }}
              textStyle={{ fontFamily: "Poppins_700Bold", letterSpacing: 0.3 }}
            />
          ) : createdInviteCode ? (
            <MetallicButton
              title={requiresPayment ? "Complete Payment" : "View Registration"}
              onPress={() => {
                onClose();
                if (requiresPayment) {
                  router.push({
                    pathname: '/events/Payment',
                    params: { eventId: event.eventId, teamId: createdTeamId },
                  });
                } else {
                  router.push({
                    pathname: '/events/MyEventDetails',
                    params: { eventId: event.eventId },
                  });
                }
              }}
              disabled={isLoading}
              height={54}
              borderRadius={27}
              fontSize={16}
              style={{ width: "100%" }}
              contentStyle={{ width: "100%", height: 51 }}
              textStyle={{ fontFamily: "Poppins_700Bold", letterSpacing: 0.3 }}
            />
          ) : (
            <MetallicButton
              title={isLoading ? "Registering..." : "Complete Registration"}
              onPress={handleCompleteRegistration}
              disabled={isLoading || !isValid}
              height={54}
              borderRadius={27}
              fontSize={16}
              style={{ width: "100%" }}
              contentStyle={{ width: "100%", height: 51 }}
              textStyle={{ fontFamily: "Poppins_700Bold", letterSpacing: 0.3 }}
            />
          )}
        </View>
      </View>
    );
  };

  const modalBg = isDark ? "#131316" : "#E0E0E0";
  const modalCardBg = isDark ? "#1C1C20" : "#FFFFFF";
  const modalBorderColor = isDark ? "rgba(255, 255, 255, 0.14)" : "#D0D0D0";
  const modalTextPrimary = isDark ? "#FFFFFF" : "#000000";
  const modalTextSecondary = isDark ? "#9CA3AF" : "#666666";
  const modalPlaceholder = isDark ? "#71717A" : "#888888";
  const modalButtonBg = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: modalBg }}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Header Bar */}
          <View
            style={{
              paddingTop: Math.max(insets.top + 8, 16),
              paddingHorizontal: 20,
              paddingBottom: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {/* Left back button (if can go back) */}
            {canGoBack ? (
              <TouchableOpacity
                onPress={handleBack}
                activeOpacity={0.8}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: modalButtonBg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="chevron-back" size={22} color={modalTextPrimary} />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 40 }} />
            )}

            {/* Pill: Complete Registration */}
            <View
              style={{
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 9999,
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#FFFFFF",
                borderWidth: 1,
                borderColor: modalBorderColor,
              }}
            >
              <Text
                style={{
                  fontFamily: "Poppins_700Bold",
                  fontSize: 16,
                  color: modalTextPrimary,
                  letterSpacing: 0.3,
                }}
              >
                Complete Registration
              </Text>
            </View>

            {/* Close 'X' Button on Right */}
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.8}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: modalButtonBg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="close" size={22} color={modalTextPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentContainerStyle={{
              paddingBottom: Math.max(insets.bottom + 20, 30),
            }}
          >
            {/* Team Choice */}
            {registrationStep === "choice" && (
              <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 16 }}>
                {/* Create Team Card */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setRegistrationStep("create-team")}
                  style={{
                    backgroundColor: modalCardBg,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: modalBorderColor,
                    padding: 24,
                    minHeight: 90,
                    justifyContent: "center",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 8,
                    elevation: 3,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Poppins_700Bold",
                      fontSize: 20,
                      color: modalTextPrimary,
                    }}
                  >
                    Create Team
                  </Text>
                </TouchableOpacity>

                {/* Join Team Card */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setRegistrationStep("join-team")}
                  style={{
                    backgroundColor: modalCardBg,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: modalBorderColor,
                    padding: 24,
                    minHeight: 90,
                    justifyContent: "center",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 8,
                    elevation: 3,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Poppins_700Bold",
                      fontSize: 20,
                      color: modalTextPrimary,
                    }}
                  >
                    Join Team
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Create Team */}
            {registrationStep === "create-team" && (
              <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
                <Text
                  style={{
                    fontFamily: "Poppins_700Bold",
                    fontSize: 22,
                    color: modalTextPrimary,
                    marginBottom: 6,
                  }}
                >
                  Create Team
                </Text>
                <Text
                  style={{
                    fontFamily: "Poppins_400Regular",
                    fontSize: 14,
                    color: modalTextSecondary,
                    marginBottom: 20,
                  }}
                >
                  Choose a unique name for your team
                </Text>

                <Text
                  style={{
                    fontFamily: "Poppins_500Medium",
                    fontSize: 14,
                    color: modalTextPrimary,
                    marginBottom: 8,
                  }}
                >
                  Team Name
                </Text>

                <TextInput
                  value={teamName}
                  onChangeText={setTeamName}
                  placeholder="Enter team name"
                  placeholderTextColor={modalPlaceholder}
                  style={{
                    fontFamily: "Poppins_500Medium",
                    backgroundColor: modalCardBg,
                    color: modalTextPrimary,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: modalBorderColor,
                    fontSize: 15,
                    marginBottom: 12,
                  }}
                />

                <Text
                  style={{
                    fontFamily: "Poppins_400Regular",
                    fontSize: 13,
                    color: modalTextSecondary,
                    marginBottom: 24,
                  }}
                >
                  Team size: {event.minTeamSize || 1} - {event.maxTeamSize || 5} members
                </Text>

                <MetallicButton
                  title={isLoading ? "Creating..." : "Create Team"}
                  onPress={handleCreateTeam}
                  disabled={isLoading || !teamName.trim()}
                  height={54}
                  borderRadius={27}
                  fontSize={16}
                  style={{ width: "100%" }}
                  contentStyle={{ width: "100%", height: 51 }}
                  textStyle={{ fontFamily: "Poppins_700Bold", letterSpacing: 0.3 }}
                />
              </View>
            )}

            {/* Join Team */}
            {registrationStep === "join-team" && (
              <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
                <Text
                  style={{
                    fontFamily: "Poppins_700Bold",
                    fontSize: 22,
                    color: modalTextPrimary,
                    marginBottom: 6,
                  }}
                >
                  Join Team
                </Text>
                <Text
                  style={{
                    fontFamily: "Poppins_400Regular",
                    fontSize: 14,
                    color: modalTextSecondary,
                    marginBottom: 20,
                  }}
                >
                  Enter the invite code shared by your team leader
                </Text>

                <Text
                  style={{
                    fontFamily: "Poppins_500Medium",
                    fontSize: 14,
                    color: modalTextPrimary,
                    marginBottom: 8,
                  }}
                >
                  Team Invite Code
                </Text>

                <TextInput
                  value={teamInviteCode}
                  onChangeText={setTeamInviteCode}
                  placeholder="Enter invite code"
                  placeholderTextColor={modalPlaceholder}
                  autoCapitalize="characters"
                  style={{
                    fontFamily: "Poppins_500Medium",
                    backgroundColor: modalCardBg,
                    color: modalTextPrimary,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: modalBorderColor,
                    fontSize: 16,
                    letterSpacing: 1.5,
                    marginBottom: 12,
                  }}
                />

                <Text
                  style={{
                    fontFamily: "Poppins_400Regular",
                    fontSize: 13,
                    color: modalTextSecondary,
                    marginBottom: 24,
                  }}
                >
                  Ask your team leader for the invite code
                </Text>

                <MetallicButton
                  title={isLoading ? "Joining..." : "Join Team"}
                  onPress={handleJoinTeam}
                  disabled={isLoading || !teamInviteCode.trim()}
                  height={54}
                  borderRadius={27}
                  fontSize={16}
                  style={{ width: "100%" }}
                  contentStyle={{ width: "100%", height: 51 }}
                  textStyle={{ fontFamily: "Poppins_700Bold", letterSpacing: 0.3 }}
                />
              </View>
            )}

            {/* Custom Fields */}
            {registrationStep === "custom-fields" && renderCustomFields()}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

export default RegistrationModal;
