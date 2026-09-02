import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Users, Info } from "lucide-react-native";

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
  const hasPaymentStatus = team.status === "confirmed" || team.paymentStatus === "completed";

  return (
    <View className="bg-white rounded-2xl p-5 mb-4 border border-gray-100 shadow-sm" style={{ elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 }}>
      {/* Team Header */}
      <TouchableOpacity
        className="flex-row items-start justify-between"
        onPress={() => onPress(team)}
        activeOpacity={0.7}
      >
        <View className="flex-1 gap-1 mr-3">
          <Text style={{fontFamily:'Outfit_700Bold'}} className="text-[#0C3572] text-lg">{team.teamName}</Text>
          <Text style={{fontFamily:'Outfit_400Regular'}} className="text-gray-500 text-sm">Team ID: {team.teamId}</Text>
          <Text style={{fontFamily:'Outfit_400Regular'}} className="text-[#2175C0] text-xs">
            Tap to view members →
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          {hasPaymentStatus && onViewPayment && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onViewPayment(team);
              }}
              className=" bg-opacity-20 p-2 rounded-full"
              activeOpacity={0.7}
            >
              <Info size={18} color="#0C3572" />
            </TouchableOpacity>
          )}
          <View
            className="px-3 py-1 rounded-full"
            style={{ backgroundColor: getStatusColor(team.status) + "20" }}
          >
            <Text
              className="text-xs"
              style={{ color: getStatusColor(team.status),fontFamily: "Outfit_600SemiBold"}}
            >
              {getStatusText(team.status)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}
