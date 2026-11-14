import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Phone, School, Users, Info, Trash2, ChevronDown } from "lucide-react-native";
import { UserEventRegistration } from "@/api/admin";
import { useThemeStore } from "@/state/themeStore";

interface RegistrationCardProps {
  registration: UserEventRegistration;
  onViewPayment?: (registration: UserEventRegistration) => void;
  onUpdateStatus?: (
    registration: UserEventRegistration,
    newStatus: "confirmed" | "pending" | "payment_pending" | "rejected"
  ) => void;
  onDelete?: (registration: UserEventRegistration) => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "confirmed":
      return "#10B981";
    case "awaited":
      return "#F59E0B";
    case "pending":
      return "#F59E0B";
    case "payment_pending":
      return "#3B82F6";
    case "rejected":
      return "#EF4444";
    default:
      return "#6B7280";
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case "confirmed":
      return "Confirmed";
    case "awaited":
      return "Awaited";
    case "pending":
      return "Pending";
    case "payment_pending":
      return "Payment Pending";
    case "rejected":
      return "Rejected";
    default:
      return "Unknown";
  }
};

const STATUS_CHOICES: Array<"confirmed" | "pending" | "payment_pending" | "rejected"> = [
  "confirmed",
  "pending",
  "payment_pending",
  "rejected",
];

const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Date unknown";
  }
};

export default function RegistrationCard({
  registration,
  onViewPayment,
  onUpdateStatus,
  onDelete,
}: RegistrationCardProps) {
  const { isDark } = useThemeStore();
  const cardBg = isDark ? "#1C1C20" : "#FFFFFF";
  const cardBorder = isDark ? "#2A2A30" : "#D5D5D5";
  const textPrimary = isDark ? "#FFFFFF" : "#111827";
  const textSecondary = isDark ? "#A0A0A0" : "#6B7280";
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  // Priority: Rejected > Pending > Payment Pending > Confirmed
  let displayStatus = registration.status || "confirmed";
  if (registration.status === "rejected") {
    displayStatus = "rejected";
  } else if (registration.status === "pending") {
    displayStatus = "pending";
  } else if (
    registration.paymentStatus === "pending" ||
    registration.status === "payment_pending"
  ) {
    displayStatus = "payment_pending";
  } else {
    displayStatus = "confirmed";
  }

  const isPaymentPending = displayStatus === "payment_pending";
  const hasPaymentStatus =
    !isPaymentPending &&
    displayStatus !== "pending" &&
    (registration?.paymentStatus === "completed" || registration?.paymentStatus === "success");

  return (
    <View
      style={{ backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1 }}
      className="rounded-2xl p-5 mb-4 shadow-sm"
    >
      {/* Header */}
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1 mr-3">
          <Text
            style={{ fontFamily: "Poppins_600SemiBold", color: textPrimary, fontSize: 16, marginBottom: 2 }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {registration.user?.name || registration.user?.displayName || "Unknown User"}
          </Text>
          <Text
            style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 13 }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {registration.user?.email}
          </Text>
        </View>
        <View className="flex-row items-center gap-2 flex-shrink-0">
          {hasPaymentStatus && onViewPayment && (
            <TouchableOpacity
              onPress={() => onViewPayment(registration)}
              style={{ backgroundColor: isDark ? "#2A2A30" : "#F3F4F6" }}
              className="p-2 rounded-full"
              activeOpacity={0.7}
            >
              <Info size={16} color="#41B8F0" />
            </TouchableOpacity>
          )}

          {onDelete && (
            <TouchableOpacity
              onPress={() => onDelete(registration)}
              style={{ backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEE2E2" }}
              className="p-2 rounded-full"
              activeOpacity={0.7}
            >
              <Trash2 size={16} color="#EF4444" />
            </TouchableOpacity>
          )}

          {onUpdateStatus ? (
            <TouchableOpacity
              onPress={() => setShowStatusPicker((prev) => !prev)}
              activeOpacity={0.7}
              style={{
                backgroundColor: getStatusColor(displayStatus) + "20",
                borderColor: getStatusColor(displayStatus) + "40",
                borderWidth: 1,
              }}
              className="flex-row items-center px-3 py-1 rounded-full gap-1"
            >
              <Text
                style={{ color: getStatusColor(displayStatus), fontFamily: "Poppins_600SemiBold", fontSize: 11 }}
              >
                {getStatusText(displayStatus)}
              </Text>
              <ChevronDown size={12} color={getStatusColor(displayStatus)} />
            </TouchableOpacity>
          ) : (
            <View
              className="px-3 py-1 rounded-full"
              style={{ backgroundColor: getStatusColor(displayStatus) + "20" }}
            >
              <Text
                style={{ color: getStatusColor(displayStatus), fontFamily: "Poppins_600SemiBold", fontSize: 11 }}
              >
                {getStatusText(displayStatus)}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Inline Status Picker for Admin Editing */}
      {showStatusPicker && onUpdateStatus && (
        <View
          style={{
            backgroundColor: isDark ? "#26262B" : "#F3F4F6",
            borderColor: cardBorder,
            borderWidth: 1,
            borderRadius: 12,
            padding: 8,
            marginBottom: 12,
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          {STATUS_CHOICES.map((choice) => {
            const isSelected = choice === displayStatus;
            const choiceColor = getStatusColor(choice);
            return (
              <TouchableOpacity
                key={choice}
                onPress={() => {
                  onUpdateStatus(registration, choice);
                  setShowStatusPicker(false);
                }}
                activeOpacity={0.7}
                style={{
                  backgroundColor: isSelected ? choiceColor : choiceColor + "18",
                  borderColor: choiceColor + "50",
                  borderWidth: 1,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 14,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Poppins_600SemiBold",
                    fontSize: 11,
                    color: isSelected ? "#FFFFFF" : choiceColor,
                  }}
                >
                  {getStatusText(choice)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* User Details */}
      <View className="space-y-2 mb-3">
        {registration.user?.phoneNumber && (
          <View className="flex-row items-center">
            <Phone size={15} color="#41B8F0" />
            <Text style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 13, marginLeft: 8 }}>
              {registration.user.phoneNumber}
            </Text>
          </View>
        )}

        {registration.user?.collegeName && (
          <View className="flex-row items-center mt-1">
            <School size={15} color="#41B8F0" />
            <Text style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 13, marginLeft: 8 }}>
              {registration.user.collegeName}
            </Text>
          </View>
        )}

        {registration.user?.rollNumber && (
          <View className="flex-row items-center mt-1">
            <Users size={15} color="#41B8F0" />
            <Text style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 13, marginLeft: 8 }}>
              Roll: {registration.user.rollNumber}
            </Text>
          </View>
        )}
      </View>

      {/* Team Info */}
      {registration.eventType === "team" && registration.teamId && (
        <View
          style={{ backgroundColor: isDark ? "#26262B" : "#F3F4F6", borderColor: cardBorder, borderWidth: 1 }}
          className="rounded-lg p-3 mb-3"
        >
          <Text style={{ fontFamily: "Poppins_600SemiBold", color: textPrimary, fontSize: 13, marginBottom: 2 }}>
            Team Registration
          </Text>
          <Text style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 12 }}>
            Team ID: {registration.teamId}
          </Text>
          {registration.teamInviteCode && (
            <Text style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 12 }}>
              Invite Code: {registration.teamInviteCode}
            </Text>
          )}
        </View>
      )}

      {/* Registration Date */}
      <View className="flex-row items-center justify-between">
        <Text style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 11 }}>
          Registered: {formatDate(registration.registeredAt)}
        </Text>
        <Text style={{ fontFamily: "Poppins_500Medium", color: textSecondary, fontSize: 11, textTransform: "capitalize" }}>
          {registration.eventType || "individual"} Registration
        </Text>
      </View>

      {/* Custom Responses */}
      {registration.responses && registration.responses.length > 0 && (
        <View style={{ borderTopWidth: 1, borderTopColor: cardBorder, marginTop: 12, paddingTop: 12 }}>
          <Text style={{ fontFamily: "Poppins_600SemiBold", color: textPrimary, fontSize: 13, marginBottom: 6 }}>
            Custom Responses
          </Text>
          {registration.responses.map((response: any, index: number) => (
            <View key={index} className="mb-1.5">
              <Text style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 12 }}>
                {response.label}: <Text style={{ fontFamily: "Poppins_500Medium", color: textPrimary }}>{response.value}</Text>
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
