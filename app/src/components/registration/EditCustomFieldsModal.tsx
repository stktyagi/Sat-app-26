import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeStore } from "@/state/themeStore";
import MetallicButton from "@/components/MetallicButton";
import { updateTeam } from "@/api/events";
import { isProfileRedundantField } from "./RegistrationModal";
import { showAlert } from "..";

interface EditCustomFieldsModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  fields: any[];
  initialResponses: Array<{ fieldId: string; value: any; label?: string; type?: string }>;
  eventId: string;
  teamId?: string;
  isTeam: boolean;
  isLeader: boolean;
  isHostStudent?: boolean;
}

const showModalAlert = (title?: string, message?: string) => {
  if (Platform.OS === "ios") {
    Alert.alert(title || "", message || "");
  } else {
    showAlert(title, message);
  }
};

const isHostOnlyField = (field: any) => {
  return Boolean(
    field.hostOnly ||
    field.audience === 'host_only' ||
    field.audience === 'host' ||
    field.fieldId?.toLowerCase().includes('host') ||
    field.fieldId === 'ppt_drive_link'
  );
};

const EditCustomFieldsModal: React.FC<EditCustomFieldsModalProps> = ({
  visible,
  onClose,
  onSuccess,
  fields = [],
  initialResponses = [],
  eventId,
  teamId,
  isTeam,
  isLeader,
  isHostStudent = false,
}) => {
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const [loading, setLoading] = useState(false);
  const [customFieldsData, setCustomFieldsData] = useState<Record<string, any>>({});

  // Filter out profile-redundant fields (phone, gender, age) and host-only fields for non-host
  const visibleFields = fields.filter((f) => {
    if (isProfileRedundantField(f)) return false;
    if (isHostOnlyField(f) && !isHostStudent) return false;
    return true;
  });

  useEffect(() => {
    if (visible) {
      const data: Record<string, any> = {};
      for (const r of initialResponses) {
        if (r.fieldId) {
          data[r.fieldId] = r.value ?? "";
        }
      }
      setCustomFieldsData(data);
    }
  }, [visible, initialResponses]);

  const modalBg = isDark ? "#131316" : "#E0E0E0";
  const modalCardBg = isDark ? "#1C1C20" : "#FFFFFF";
  const modalBorderColor = isDark ? "rgba(255, 255, 255, 0.14)" : "#D0D0D0";
  const modalTextPrimary = isDark ? "#FFFFFF" : "#000000";
  const modalTextSecondary = isDark ? "#9CA3AF" : "#666666";
  const modalPlaceholder = isDark ? "#71717A" : "#888888";
  const modalButtonBg = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)";

  const isFieldRequired = (field: any) => {
    return Boolean(
      field.isRequired ||
      field.required ||
      (isHostStudent && isHostOnlyField(field))
    );
  };

  const expression =
    /[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
  const linkRegex = new RegExp(expression);

  const isResponseValid = (field: any, val: any): boolean => {
    const req = isFieldRequired(field);
    if (req && (val === undefined || val === null || (typeof val === "string" && !val.trim()) || (Array.isArray(val) && val.length === 0))) {
      return false;
    }
    if (!val || (typeof val === "string" && !val.trim())) {
      return true;
    }
    if (field.type === "link" && typeof val === "string") {
      return linkRegex.test(val.trim());
    }
    return true;
  };

  const isFormValid = visibleFields.every((f) => isResponseValid(f, customFieldsData[f.fieldId]));

  const handleSave = async () => {
    for (const f of visibleFields) {
      const val = customFieldsData[f.fieldId];
      if (isFieldRequired(f) && (!val || (typeof val === "string" && !val.trim()))) {
        showModalAlert("Missing Required Answer", `Please provide an answer for "${f.label}".`);
        return;
      }
      if (f.type === "link" && val && typeof val === "string" && !linkRegex.test(val.trim())) {
        showModalAlert("Invalid Link", `Please enter a valid URL for "${f.label}".`);
        return;
      }
    }

    const payloadResponses = visibleFields.map((f) => ({
      fieldId: f.fieldId,
      label: f.label,
      type: f.type,
      value: customFieldsData[f.fieldId] ?? (f.type === "multi-select" ? [] : ""),
    }));

    try {
      setLoading(true);
      if (teamId) {
        await updateTeam(teamId, { responses: payloadResponses });
      }
      showModalAlert("Success", "Event requirements updated successfully!");
      onSuccess();
      onClose();
    } catch (err: any) {
      showModalAlert("Update Failed", err.message || "Failed to update event responses. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderFieldInput = (field: any) => {
    const value = customFieldsData[field.fieldId];

    switch (field.type) {
      case "text":
      case "link":
        return (
          <TextInput
            value={typeof value === "string" ? value : ""}
            onChangeText={(text) =>
              setCustomFieldsData({ ...customFieldsData, [field.fieldId]: text })
            }
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
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
            autoCapitalize="none"
          />
        );

      case "number":
        return (
          <TextInput
            value={value !== undefined && value !== null ? String(value) : ""}
            onChangeText={(text) =>
              setCustomFieldsData({ ...customFieldsData, [field.fieldId]: text })
            }
            placeholder={field.placeholder || "Enter number"}
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
            keyboardType="numeric"
          />
        );

      case "select":
      case "multi-select": {
        const options: string[] = field.options || [];
        const isMulti = field.type === "multi-select";
        const selectedArr: string[] = Array.isArray(value) ? value : value ? [value] : [];

        return (
          <View style={{ gap: 10 }}>
            {options.map((option: string, optIdx: number) => {
              const isSelected = selectedArr.includes(option);
              const parts = option.split("\n");
              const title = parts[0];
              const desc = parts.slice(1).join("\n");

              const handleToggle = () => {
                if (isMulti) {
                  const next = isSelected
                    ? selectedArr.filter((item) => item !== option)
                    : [...selectedArr, option];
                  setCustomFieldsData({ ...customFieldsData, [field.fieldId]: next });
                } else {
                  setCustomFieldsData({ ...customFieldsData, [field.fieldId]: option });
                }
              };

              return (
                <TouchableOpacity
                  key={optIdx}
                  onPress={handleToggle}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: isSelected
                      ? isDark
                        ? "rgba(56, 189, 248, 0.15)"
                        : "#E0F2FE"
                      : modalCardBg,
                    borderWidth: 1.5,
                    borderColor: isSelected ? "#38BDF8" : modalBorderColor,
                    borderRadius: 14,
                    padding: 14,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text
                        style={{
                          fontFamily: isSelected ? "Poppins_600SemiBold" : "Poppins_500Medium",
                          color: isSelected ? "#38BDF8" : modalTextPrimary,
                          fontSize: 14.5,
                          lineHeight: 20,
                        }}
                      >
                        {title}
                      </Text>
                      {desc ? (
                        <Text
                          style={{
                            fontFamily: "Poppins_400Regular",
                            color: modalTextSecondary,
                            fontSize: 12.5,
                            lineHeight: 18,
                            marginTop: 4,
                          }}
                        >
                          {desc}
                        </Text>
                      ) : null}
                    </View>
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: isMulti ? 6 : 11,
                        borderWidth: 1.5,
                        borderColor: isSelected ? "#38BDF8" : modalBorderColor,
                        backgroundColor: isSelected ? "#38BDF8" : "transparent",
                        alignItems: "center",
                        justifyContent: "center",
                        marginTop: 2,
                      }}
                    >
                      {isSelected && (
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      }

      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: modalBg }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Header */}
          <View
            style={{
              paddingTop: Math.max(insets.top + 8, 20),
              paddingBottom: 14,
              paddingHorizontal: 20,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottomWidth: 1,
              borderBottomColor: modalBorderColor,
            }}
          >
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

            <Text
              style={{
                fontFamily: "Poppins_700Bold",
                fontSize: 17,
                color: modalTextPrimary,
                letterSpacing: 0.3,
              }}
            >
              Edit Event Requirements
            </Text>

            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 20,
              paddingBottom: Math.max(insets.bottom + 24, 34),
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text
              style={{
                fontFamily: "Poppins_400Regular",
                color: modalTextSecondary,
                fontSize: 13.5,
                lineHeight: 20,
                marginBottom: 20,
              }}
            >
              {isTeam
                ? "Update your team's project track and requirements. These will be visible to event organizers and judges."
                : "Update your event requirements and links. These will be visible to event organizers."}
            </Text>

            <View style={{ gap: 20 }}>
              {visibleFields.map((field: any) => (
                <View key={field.fieldId}>
                  <Text
                    style={{
                      fontFamily: "Poppins_600SemiBold",
                      color: modalTextPrimary,
                      fontSize: 14.5,
                      marginBottom: 8,
                    }}
                  >
                    {field.label}
                    {isFieldRequired(field) && (
                      <Text style={{ color: "#EF4444" }}> *</Text>
                    )}
                  </Text>
                  {renderFieldInput(field)}
                </View>
              ))}
            </View>

            <View style={{ marginTop: 32 }}>
              <MetallicButton
                title={loading ? "Saving Changes..." : "Save Changes"}
                onPress={handleSave}
                disabled={loading || !isFormValid}
                height={54}
                borderRadius={27}
                fontSize={16}
                style={{ width: "100%" }}
                contentStyle={{ width: "100%", height: 51 }}
                textStyle={{ fontFamily: "Poppins_700Bold", letterSpacing: 0.3 }}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

export default EditCustomFieldsModal;
