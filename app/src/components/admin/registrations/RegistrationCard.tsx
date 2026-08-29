import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Phone, School, Users, Info } from "lucide-react-native";

interface RegistrationCardProps {
  registration: UserEventRegistration;
  onViewPayment?: (registration: UserEventRegistration) => void;
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

export default function RegistrationCard({ registration, onViewPayment }: RegistrationCardProps) {

  const hasPaymentStatus = registration?.paymentStatus === "completed";

  return (
    <View className="bg-white rounded-2xl p-5 mb-4 border border-gray-100 shadow-sm" style={{ elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 }}>
      {/* Header */}
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1 mr-3">
          <Text className="text-[#0C3572] text-lg font-bold mb-1">
            {registration.user.name || (registration.user as any).displayName || "Unknown User"}
          </Text>
          <Text className="text-gray-500 text-sm">{registration.user.email}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          {hasPaymentStatus && onViewPayment && (
            <TouchableOpacity
              onPress={() => onViewPayment(registration)}
              className=" bg-opacity-20 p-2 rounded-full"
              activeOpacity={0.7}
            >
              <Info size={18} color="#0C3572" />
            </TouchableOpacity>
          )}
          <View
            className="px-3 py-1 rounded-full"
            style={{ backgroundColor: getStatusColor(registration.status) + "20" }}
          >
            <Text
              className="text-xs font-semibold"
              style={{ color: getStatusColor(registration.status) }}
            >
              {getStatusText(registration.status)}
            </Text>
          </View>
        </View>
      </View>

      {/* User Details */}
      <View className="space-y-2 mb-3">
        <View className="flex-row items-center">
          <Phone size={16} color="#EEB170" />
          <Text className="text-gray-600 text-sm ml-2">
            {registration.user.phoneNumber}
          </Text>
        </View>

        <View className="flex-row items-center">
          <School size={16} color="#EEB170" />
          <Text className="text-gray-600 text-sm ml-2">
            {registration.user.collegeName}
          </Text>
        </View>

        {registration.user.rollNumber && (
          <View className="flex-row items-center">
            <Users size={16} color="#EEB170" />
            <Text className="text-gray-600 text-sm ml-2">
              Roll: {registration.user.rollNumber}
            </Text>
          </View>
        )}
      </View>

      {/* Team Info */}
      {registration.eventType === "team" && registration.teamId && (
        <View className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-100">
          <Text className="text-[#0C3572] text-sm font-semibold mb-1">
            Team Registration
          </Text>
          <Text className="text-gray-600 text-sm">Team ID: {registration.teamId}</Text>
          {registration.teamInviteCode && (
            <Text className="text-gray-600 text-sm">
              Invite Code: {registration.teamInviteCode}
            </Text>
          )}
        </View>
      )}

      {/* Registration Date */}
      <View className="flex-row items-center justify-between">
        <Text className="text-gray-500 text-xs">
          Registered: {formatDate(registration.registeredAt)}
        </Text>
        <Text className="text-gray-500 text-xs capitalize">
          {registration.eventType} Registration
        </Text>
      </View>

      {/* Custom Responses */}
      {registration.responses && registration.responses.length > 0 && (
        <View className="mt-3 pt-3 border-t border-gray-200">
          <Text className="text-[#0C3572] text-sm font-semibold mb-2">
            Custom Responses
          </Text>
          {registration.responses.map((response, index) => (
            <View key={index} className="mb-2">
              <Text className="text-gray-600 text-xs">{response.label}: {response.value}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
