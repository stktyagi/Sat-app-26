import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { X, Save, ChevronDown, Phone, School } from "lucide-react-native";
import { showAlert } from "../../index";
import { PrivateRoleComponent } from "../../auth/PrivateRoleComponent";

interface TeamRegistrationView {
  teamId: string;
  teamName: string;
  leaderId: string;
  members?: UserEventRegistration[];
  memberCount: number;
  maxSize: number;
  status: "confirmed" | "pending" | "payment_pending" | "rejected";
  createdAt: string;
  inviteCode: string;
}

interface TeamDetailsModalProps {
  visible: boolean;
  team: TeamRegistrationView | null;
  eventId: string;
  loadingMembers: boolean;
  onClose: () => void;
  onStatusUpdate: (
    teamId: string,
    newStatus: "confirmed" | "pending" | "payment_pending" | "rejected"
  ) => Promise<void>;
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

export default function TeamDetailsModal({
  visible,
  team,
  eventId,
  loadingMembers,
  onClose,
  onStatusUpdate,
}: TeamDetailsModalProps) {
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [selectedNewStatus, setSelectedNewStatus] = useState<
    "confirmed" | "pending" | "payment_pending" | "rejected"
  >(team?.status || "pending");
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Update selectedNewStatus when team changes
  React.useEffect(() => {
    if (team) {
      setSelectedNewStatus(team.status);
    }
  }, [team]);

  const handleSaveStatus = async () => {
    if (!team) return;

    setIsSavingStatus(true);
    try {
      await onStatusUpdate(team.teamId, selectedNewStatus);

      // Show success banner instead of alert modal
      setSuccessMessage("Registration status updated successfully");
      setUpdateSuccess(true);
      setTimeout(() => {
        setUpdateSuccess(false);
      }, 3000);
    } catch (error) {
      console.error("Error updating status:", error);
      showAlert("Error", "Failed to update registration status");
    } finally {
      setIsSavingStatus(false);
    }
  };

  if (!team) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View className="flex-1 justify-end border-t-2 border-[#dddddd] bg-black/70">
        <View className="bg-transparent rounded-t-3xl max-h-[80%] min-h-[200px]">
          {/* Success Banner */}
          {updateSuccess && (
            <View className="bg-green-500/20 border-b border-green-500/30 p-4">
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className="text-green-400 text-center"
              >
                ✓ {successMessage}
              </Text>
            </View>
          )}

          <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-300">
            <Text className="text-[#0C3572] text-xl font-bold">{team.teamName}</Text>
            <TouchableOpacity
              onPress={onClose}
              className="p-1 rounded-full bg-white"
              activeOpacity={0.7}
            >
              <X size={20} color="#0C3572" />
            </TouchableOpacity>
          </View>

          <View className="p-6">
            <View className="bg-white rounded-xl p-4 mb-3 border border-gray-200">
                <Text className="text-gray-600 text-sm mb-1">Team Code</Text>
                <Text className="text-black font-mono">{team.teamId}</Text>
            </View>

            <PrivateRoleComponent allowedRoles={["event_admin", "admin","outreach_admin"]}>
            <View className="bg-white rounded-xl px-4 py-2 mb-0 border border-gray-200">
              <Text className="text-gray-600 text-sm mb-3">Registration Status</Text>

              <TouchableOpacity
                className="bg-white border border-gray-200 shadow-sm rounded-xl p-3 mb-3 flex-row items-center justify-between"
                style={{ elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 }}
                onPress={() => setShowStatusDropdown(!showStatusDropdown)}
                activeOpacity={0.7}
              >
                <View className="flex-row items-center flex-1">
                  <View
                    className="px-3 py-1 rounded-full"
                    style={{
                      backgroundColor: getStatusColor(selectedNewStatus) + "20",
                    }}
                  >
                    <Text
                      className="text-xs font-semibold"
                      style={{ color: getStatusColor(selectedNewStatus) }}
                    >
                      {getStatusText(selectedNewStatus)}
                    </Text>
                  </View>
                </View>
                <ChevronDown size={20} color="#0C3572" />
              </TouchableOpacity>

              {showStatusDropdown && (
                <View className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-3">
                  {STATUS_OPTIONS.map((status, index) => (
                    <TouchableOpacity
                      key={status}
                      className={`p-3 ${
                        selectedNewStatus === status ? "bg-[#EEB170]/20" : "bg-white"
                      } ${index < STATUS_OPTIONS.length - 1 ? "border-b border-gray-100" : ""}`}
                      onPress={() => {
                        setSelectedNewStatus(
                          status as "confirmed" | "pending" | "payment_pending" | "rejected"
                        );
                        setShowStatusDropdown(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View
                        className="px-3 py-1 rounded-full self-start"
                        style={{
                          backgroundColor: getStatusColor(status) + "20",
                        }}
                      >
                        <Text
                          className="text-xs font-semibold"
                          style={{ color: getStatusColor(status) }}
                        >
                          {getStatusText(status)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {selectedNewStatus !== team.status && (
                <TouchableOpacity
                  className={`bg-[#FFBA00] rounded-xl p-4 flex-row items-center justify-center ${
                    isSavingStatus ? "opacity-50" : ""
                  }`}
                  onPress={handleSaveStatus}
                  disabled={isSavingStatus}
                  activeOpacity={0.7}
                >
                  {isSavingStatus ? (
                    <ActivityIndicator size="small" color="#121212" />
                  ) : (
                    <Save size={20} color="#121212" />
                  )}
                  <Text className="text-[#0C3572] font-semibold text-base ml-2">
                    {isSavingStatus ? "Saving..." : "Save Status"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            </PrivateRoleComponent>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            <View className="px-6 pb-6">
              <Text className="text-[#0C3572] text-lg font-bold mb-4">Team Members</Text>

              {loadingMembers ? (
                <View className="items-center justify-center py-8">
                  <ActivityIndicator size="large" color="#FFBA00" />
                  <Text className="text-gray-500 mt-4">Loading team members...</Text>
                </View>
              ) : team.members && team.members.length > 0 ? (
                team.members.map((member, index) => (
                  <View key={index} className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
                    <View className="flex-row items-start justify-between mb-3">
                      <Text className="text-[#0C3572] text-lg font-bold flex-1">
                        {member.user.name || (member.user as any).displayName || "Unknown User"}
                      </Text>
                      {member.userId === team.leaderId && (
                        <View className="bg-[#FFBA00] px-3 py-1 rounded-full">
                          <Text className="text-[#121212] text-xs font-bold">LEADER</Text>
                        </View>
                      )}
                    </View>

                    <View className="space-y-3">
                      <View className="flex-row items-center">
                        <Phone size={16} color="#FFBA00" />
                        <Text className="text-gray-300 text-base ml-3">
                          {member.user.phoneNumber}
                        </Text>
                      </View>

                      <View className="flex-row items-center">
                        <Text className="text-[#FFBA00] text-base">📧</Text>
                        <Text className="text-gray-300 text-base ml-3">
                          {member.user.email}
                        </Text>
                      </View>

                      <View className="flex-row items-center">
                        <School size={16} color="#FFBA00" />
                        <Text className="text-gray-300 text-base ml-3">
                          {member.user.collegeName}
                        </Text>
                      </View>

                      {member.user.rollNumber && (
                        <View className="flex-row items-center">
                          <Text className="text-[#FFBA00] text-base">🎓</Text>
                          <Text className="text-gray-300 text-base ml-3">
                            Roll: {member.user.rollNumber}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <View className="items-center justify-center py-8">
                  <Text className="text-gray-400">No members loaded</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
