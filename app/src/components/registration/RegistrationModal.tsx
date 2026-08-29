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
  ActivityIndicator,
  KeyboardAvoidingView,


} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Button from "../ui/Button";
import { FirebaseEvent } from '@/types/models';
import { useUserStore } from '@/state/userStore';
import { useStore } from "zustand";
import { showAlert } from "../index";
import { useRouter } from "expo-router";
import {
  registerForEvent,
  createEventTeam,
  joinEventTeam,
  responsesFromFields,
} from "@/api/events";

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
    // Use native Alert for iOS
    Alert.alert(title || "", message || "");
  } else {
    // Use custom alert for Android
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
  const userData = useUserStore((state) => state.userData);
  const [registrationStep, setRegistrationStep] =
    useState<RegistrationStep>("choice");
  const [teamName, setTeamName] = useState("");
  const [teamInviteCode, setTeamInviteCode] = useState("");
  const [customFieldsData, setCustomFieldsData] = useState<Record<string, any>>(
    {}
  );
  const [isLoading, setIsLoading] = useState(false);
  const [createdInviteCode, setCreatedInviteCode] = useState<string>("");
  const [hasReferralCode, setHasReferralCode] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [currentTeamSize, setCurrentTeamSize] = useState<number>(0);

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

      if (event.eventType === "team") {
        setRegistrationStep("choice");
      } else {
        setRegistrationStep("custom-fields");
      }
    }
  }, [visible, event.eventType]);

  // Fetch team data when invite code is available
  /* Removed API call */

  const handleCreateTeam = async () => {
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
    } catch (error: any) {
      showModalAlert("Error", error.message || "Failed to join team");
    } finally {
      setIsLoading(false);
    }
  };
  const handleCompleteRegistration = async () => {
    try {
      setIsLoading(true);

      // Validate team size for team events
      if (event.eventType === "team" && event.minTeamSize && createdInviteCode) {
        if (currentTeamSize < event.minTeamSize) {
          showModalAlert(
            "Insufficient Team Size",
            `Your team needs at least ${
              event.minTeamSize
            } members to submit. Currently you have ${currentTeamSize} member${
              currentTeamSize !== 1 ? "s" : ""
            }.\n\nPlease share the invite code with your teammates before submitting.`
          );
          setIsLoading(false);
          return;
        }
      }

      // Transform custom fields data to response format
      // Map through event.customFields to maintain field metadata
      const responseData = (event.customFields || []).map((field: any) => ({
        fieldId: field.fieldId,
        label: field.label,
        type: field.type,
        value:
          customFieldsData[field.fieldId] ||
          (field.type === "multi-select" ? [] : ""),
      }));

      // Add referral code to registration if provided
      const registrationData = responsesFromFields(event.customFields || [], customFieldsData);

      if (event.eventType === "team") {
        if (isCreateTeamFlow || teamName.trim()) {
          const result = await createEventTeam(event.eventId, teamName.trim(), registrationData);
          setCreatedInviteCode(result.inviteCode || result.team?.inviteCode);
          showModalAlert("Team Created!", "Share the invite code with your teammates.");
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
      showModalAlert("Success", "Registration completed successfully!");
      onSuccess();
      onClose();
    } catch (error: any) {
      showModalAlert("Error", error.message || "Failed to complete registration");
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepTitle = () => {
    switch (registrationStep) {
      case "choice":
        return "Team Registration";
      case "create-team":
        return "Create Team";
      case "join-team":
        return "Join Team";
      case "custom-fields":
        return "Complete Registration";
      default:
        return "Registration";
    }
  };

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
            placeholderTextColor="#666"
            style={{ fontFamily: "Outfit_500Medium" }}
            className="bg-[#2a2a2a] text-[#0C3572] px-4 py-3 rounded-lg"
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
              style={{ fontFamily: "Outfit_500Medium" }}
              placeholder={field.placeholder || field.label}
              placeholderTextColor="#666"
              className="bg-[#2a2a2a] text-[#0C3572] px-4 py-3 rounded-lg"
              keyboardType="numeric"
            />
            <Text
              style={{ fontFamily: "Outfit_500Medium" }}
              className="text-[#2175C0] mt-2 text-xs"
            >
              Minimum value of {field.minValue}, Maximum value of{" "}
              {field.maxValue}
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
                  style={{ fontFamily: "Outfit_500Medium" }}
                  className="text-[#2175C0] mt-2 text-xs ml-auto"
                >
                  Clear selection
                </Text>
              </TouchableOpacity>
            ) : null}
            <Text
              style={{ fontFamily: "Outfit_500Medium" }}
              className="text-[#2175C0] mb-2"
            >
              {value || `Select ${field.label}`}
            </Text>
            <View className="flex gap-3">
              {field.options?.map((option: string, idx: number) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() =>
                    setCustomFieldsData({
                      ...customFieldsData,
                      [field.fieldId]: option,
                    })
                  }
                  className={`px-4 py-3 rounded-lg border ${
                    value === option
                      ? "bg-yellow-400/20 border-yellow-400"
                      : "bg-[#2a2a2a] border-gray-600"
                  }`}
                >
                  <Text
                    style={{ fontFamily: "Outfit_500Medium" }}
                    className={`${
                      value === option ? "text-yellow-400" : "text-[#0C3572]"
                    }`}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case "multi-select":
        return (
          <View className="flex gap-3">
            {field.options?.map((option: string, idx: number) => {
              const currentValues = value || [];
              const isSelected = currentValues.includes(option);

              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => {
                    let newValues;
                    if (isSelected) {
                      newValues = currentValues.filter(
                        (v: string) => v !== option
                      );
                    } else {
                      newValues = [...currentValues, option];
                    }
                    setCustomFieldsData({
                      ...customFieldsData,
                      [field.fieldId]: newValues,
                    });
                  }}
                  className={`flex-row items-center px-4 py-3 rounded-lg border ${
                    isSelected
                      ? "bg-yellow-400/20 border-yellow-400"
                      : "bg-[#2a2a2a] border-gray-600"
                  }`}
                >
                  <View
                    className={`w-5 h-5 rounded border-2 mr-3 items-center justify-center ${
                      isSelected
                        ? "bg-yellow-400 border-yellow-400"
                        : "border-gray-600"
                    }`}
                  >
                    {isSelected && (
                      <Ionicons name="checkmark" size={16} color="#1a1a1a" />
                    )}
                  </View>
                  <Text
                    style={{ fontFamily: "Outfit_500Medium" }}
                    className={`${
                      isSelected ? "text-yellow-400" : "text-[#0C3572]"
                    }`}
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
      return field.options.includes(response);
    }
    for (const optionSelected of response) {
      if (!field.options.includes(optionSelected)) return false;
    }
    return true;
  }

  const renderCustomFields = () => {
    const isNonHostStudent = userData && !userData.isHostCollegeStudent;
    let isValid = true;
    for (const field of event.customFields) {
      const response = customFieldsData[field.fieldId];
      isValid = isResponseValid(field, response);
      if (!isValid) break;
    }

    return (
      <View>

        {!createdInviteCode && event.customFields && event.customFields.length > 0 && (
          <>
            {event.customFields.map((field: any) => (
              <View key={field.fieldId} className="mb-4">
                <Text
                  style={{ fontFamily: "Outfit_500Medium" }}
                  className="text-[#2175C0] mb-2"
                >
                  {field.label}
                  {field.isRequired && (
                    <Text
                      style={{ fontFamily: "Outfit_500Medium" }}
                      className="text-red-400"
                    >
                      {" "}
                      *
                    </Text>
                  )}
                </Text>
                {renderField(field)}
              </View>
            ))}
          </>
        )}

        {createdInviteCode && (
          <View className="bg-[#2a2a2a] p-4 rounded-lg mb-4">
            <Text
              style={{ fontFamily: "Outfit_500Medium" }}
              className="text-[#2175C0] mb-2"
            >
              Your Team Invite Code:
            </Text>
            <Text
              style={{ fontFamily: "Outfit_700Bold" }}
              className="text-yellow-400 text-lg"
            >
              {createdInviteCode}
            </Text>
            <Text
              style={{ fontFamily: "Outfit_500Medium" }}
              className="text-[#2175C0] text-sm mt-2"
            >
              Share this code with your team members
            </Text>
            {event.minTeamSize && (
              <View className="mt-3 pt-3 border-t border-[#A0B3D0]">
                <Text
                  style={{ fontFamily: "Outfit_500Medium" }}
                  className={`text-sm ${
                    currentTeamSize >= event.minTeamSize
                      ? "text-green-400"
                      : "text-orange-400"
                  }`}
                >
                  Team Size: {currentTeamSize} / {event.minTeamSize}-
                  {event.maxTeamSize || "∞"}
                </Text>
                {currentTeamSize < event.minTeamSize && (
                  <Text
                    style={{ fontFamily: "Outfit_500Medium" }}
                    className="text-orange-400 text-xs mt-1"
                  >
                    ⚠️ Need {event.minTeamSize - currentTeamSize} more member
                    {event.minTeamSize - currentTeamSize !== 1 ? "s" : ""} to
                    submit
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Referral Code Section - Only for non-host college students */}
        {isNonHostStudent && !createdInviteCode && (
          <View className="pt-4 border-t border-[#A0B3D0] mt-4">
            <TouchableOpacity
              onPress={() => {
                setHasReferralCode(!hasReferralCode);
                if (hasReferralCode) setReferralCode("");
              }}
              className="flex-row items-center mb-3"
            >
              <View
                className={`w-5 h-5 rounded border-2 mr-3 items-center justify-center ${
                  hasReferralCode
                    ? "bg-yellow-400 border-yellow-400"
                    : "border-gray-600"
                }`}
              >
                {hasReferralCode && (
                  <Ionicons name="checkmark" size={16} color="#1a1a1a" />
                )}
              </View>
              <Text
                style={{ fontFamily: "Outfit_500Medium" }}
                className="text-[#0C3572]"
              >
                I have a referral code
              </Text>
            </TouchableOpacity>

            {hasReferralCode && (
              <View>
                <Text
                  style={{ fontFamily: "Outfit_500Medium" }}
                  className="text-[#2175C0] mb-2"
                >
                  Referral Code
                </Text>
                <TextInput
                  style={{ fontFamily: "Outfit_500Medium" }}
                  value={referralCode}
                  onChangeText={(text) => setReferralCode(text.toUpperCase())}
                  placeholder="Enter your referral code"
                  placeholderTextColor="#666"
                  className="bg-[#2a2a2a] text-[#0C3572] px-4 py-3 rounded-lg"
                  autoCapitalize="characters"
                />
              </View>
            )}
          </View>
        )}

        {event.eventType !== "team" && !createdInviteCode ? (
          <View className="flex-row space-x-3 flex-1 gap-2 mt-6">
            <Button
              title={isLoading ? "Registering..." : "Complete Registration"}
              onPress={handleCompleteRegistration}
              variant="none" 
              className="flex-1 bg-[#95aad3] border-[#0C3572] border-2 py-3 rounded-xl" 
              textClassName="text-[#0C3572]"
              disabled={isLoading || !isValid}
            />
          </View>
        ) : (
          <View className="flex-row space-x-3 flex-1 gap-2 mt-6">
            <Button
              title={isLoading ? "Registering..." : "View Registration"}
              onPress={() => {
                router.push({ pathname: '/events/MyEventDetails', params: { eventId: event.eventId } });
                return;
              }}
              variant="none"
              className="flex-1 bg-[#95aad3] border-[#0C3572] border-2 py-3 rounded-xl"
              textClassName="text-[#0C3572]"
              disabled={isLoading}
          />
        </View>
        )}
      </View>
    );
  };



  const [isCreateTeamFlow, setIsCreateTeamFlow] = useState(false);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        className="flex-1 justify-end bg-black/50"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >

          <View className="flex-1 justify-end">
            <View className="bg-white rounded-t-3xl p-6 max-h-[80%]">
              {/* Header */}
              <View className="flex-row justify-between items-center mb-4">
                <Text
                  style={{ fontFamily: "Outfit_700Bold" }}
                  className="text-[#0C3572] text-2xl"
                >
                  {renderStepTitle()}
                </Text>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={28} color="#0C3572" />
                </TouchableOpacity>
              </View>

              <ScrollView 
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
            {/* Team Choice */}
            {registrationStep === "choice" && (
              <View>
                <Button
                  title="Create New Team"
                  onPress={() => setRegistrationStep("create-team")}
                  variant="none" 
                  className="mb-4 bg-[#95aad3] border-[#0C3572] border-2 py-3 rounded-xl" 
                  textClassName="text-[#0C3572]"
                />
                <Button
                  title="Join Existing Team"
                  onPress={() => setRegistrationStep("join-team")}
                  variant="secondary"
                />
              </View>
            )}

            {/* Create Team */}
            {registrationStep === "create-team" && (
              <View>
                <Text className="text-[#2175C0] mb-2">Team Name</Text>
                <TextInput
                  value={teamName}
                  onChangeText={setTeamName}
                  placeholder="Enter team name"
                  placeholderTextColor="#666"
                  className="bg-[#2a2a2a] text-[#0C3572] px-4 py-3 rounded-lg mb-4"
                />
                <Text className="text-[#2175C0] text-sm mb-4">
                  Team size: {event.minTeamSize || 1} - {event.maxTeamSize || 5}{" "}
                  members
                </Text>
                <View className="flex-row space-x-3 flex gap-2">
                  <Button
                    title="Back"
                    onPress={() => setRegistrationStep("choice")}
                    variant="secondary"
                    className="flex-1 border border-gray-600"
                  />
                  <Button
                    title={isLoading ? "Creating..." : "Create Team"}
                    onPress={handleCreateTeam}
                    variant="none" 
                    className="flex-1 bg-[#95aad3] border-[#0C3572] border-2 py-3 rounded-xl" 
                    textClassName="text-[#0C3572]"
                    disabled={isLoading}
                  />
                </View>
              </View>
            )}

            {/* Join Team */}
            {registrationStep === "join-team" && (
              <View>
                <Text
                  style={{ fontFamily: "Outfit_500Medium" }}
                  className="text-[#2175C0] mb-2"
                >
                  Team Invite Code
                </Text>
                <TextInput
                  value={teamInviteCode}
                  style={{ fontFamily: "Outfit_500Medium" }}
                  onChangeText={setTeamInviteCode}
                  placeholder="Enter team invite code"
                  placeholderTextColor="#666"
                  className="bg-[#2a2a2a] text-[#0C3572] px-4 py-3 rounded-lg mb-4"
                  autoCapitalize="characters"
                />
                <Text
                  style={{ fontFamily: "Outfit_500Medium" }}
                  className="text-[#2175C0] text-sm mb-4"
                >
                  Ask your team leader for the invite code
                </Text>
                <View className="flex-row space-x-3 flex gap-2">
                  <Button
                    title="Back"
                    onPress={() => {
                      setRegistrationStep("choice");
                      setIsCreateTeamFlow(true);
                    }}
                    variant="secondary"
                    className="flex-1 border border-gray-600"
                  />
                  <Button
                    title={isLoading ? "Joining..." : "Join Team"}
                    onPress={handleJoinTeam}
                    variant="none" 
                    className="flex-1 bg-[#95aad3] border-[#0C3572] border-2 py-3 rounded-xl" 
                    textClassName="text-[#0C3572]"
                    disabled={isLoading}
                  />
                </View>
              </View>
            )}

            {/* Custom Fields */}
            {registrationStep === "custom-fields" && renderCustomFields()}
          </ScrollView>
            </View>
          </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default RegistrationModal;
