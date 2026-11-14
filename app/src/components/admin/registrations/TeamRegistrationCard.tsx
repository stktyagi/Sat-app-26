import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Users, Info } from "lucide-react-native";
import { useThemeStore } from "@/state/themeStore";

interface TeamRegistrationView {
  teamId: string;
  teamName: string;
  leaderId: string;
  members?: any[];
  memberCount: number;
  maxSize: number;
  status: "confirmed" | "pending" | "payment_pending" | "rejected";
  createdAt: string;
  inviteCode: string;
  paymentStatus?: string;
}

interface TeamRegistrationCardProps {
  team: TeamRegistrationView;
  onPress: (team: TeamRegistrationView) => void;
  onViewPayment?: (team: TeamRegistrationView) => void;
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

export default function TeamRegistrationCard({ team, onPress, onViewPayment }: TeamRegistrationCardProps) {
  const { isDark } = useThemeStore();
  const cardBg = isDark ? "#1C1C20" : "#FFFFFF";
  const cardBorder = isDark ? "#2A2A30" : "#D5D5D5";
  const textPrimary = isDark ? "#FFFFFF" : "#111827";
  const textSecondary = isDark ? "#A0A0A0" : "#6B7280";

  // Priority: Rejected > Pending > Payment Pending > Confirmed
  let displayStatus = team.status || "confirmed";
  if (team.status === "rejected") {
    displayStatus = "rejected";
  } else if (team.status === "pending") {
    displayStatus = "pending";
  } else if (
    team.paymentStatus === "pending" ||
    team.status === "payment_pending" ||
    (team.members && team.members.some((m: any) => m.paymentStatus === "pending" || m.status === "payment_pending"))
  ) {
    displayStatus = "payment_pending";
  } else {
    displayStatus = "confirmed";
  }

  const isPaymentPending = displayStatus === "payment_pending";
  const hasPaymentStatus =
    !isPaymentPending &&
    displayStatus !== "pending" &&
    (displayStatus === "confirmed" || team.paymentStatus === "completed" || team.paymentStatus === "success");

  return (
    <View
      style={{ backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1 }}
      className="rounded-2xl p-5 mb-4 shadow-sm"
    >
      {/* Team Header */}
      <TouchableOpacity
        className="flex-row items-start justify-between"
        onPress={() => onPress(team)}
        activeOpacity={0.7}
      >
        <View className="flex-1 mr-3">
          <Text
            style={{ fontFamily: "Poppins_600SemiBold", color: textPrimary, fontSize: 16, marginBottom: 2 }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {team.teamName}
          </Text>
          <Text
            style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 12, marginBottom: 4 }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Team ID: {team.teamId}
          </Text>
          <Text style={{ fontFamily: "Poppins_500Medium", color: "#41B8F0", fontSize: 12 }}>
            Tap to view members →
          </Text>
        </View>
        <View className="flex-row items-center gap-2 flex-shrink-0">
          {hasPaymentStatus && onViewPayment && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onViewPayment(team);
              }}
              style={{ backgroundColor: isDark ? "#2A2A30" : "#F3F4F6" }}
              className="p-2 rounded-full"
              activeOpacity={0.7}
            >
              <Info size={16} color="#41B8F0" />
            </TouchableOpacity>
          )}
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
        </View>
      </TouchableOpacity>
    </View>
  );
}
