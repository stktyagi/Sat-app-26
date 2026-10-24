import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { X, Save, ChevronDown, Phone, School, Mail } from "lucide-react-native";
import { showAlert } from "../../index";
import { PrivateRoleComponent } from "../../auth/PrivateRoleComponent";
import { UserEventRegistration } from "@/api/admin";
import { useThemeStore } from "@/state/themeStore";
import { ROLE_ADMIN, ROLE_EB_EVENTS, ROLE_EB_OUTREACH, ROLE_EVENT_POC } from "@/utils/roles";

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

const STATUS_OPTIONS: Array<"confirmed" | "pending" | "payment_pending" | "rejected"> = [
  "confirmed",
  "pending",
  "payment_pending",
  "rejected",
];

export default function TeamDetailsModal({
  visible,
  team,
  eventId,
  loadingMembers,
  onClose,
  onStatusUpdate,
}: TeamDetailsModalProps) {
  const { isDark } = useThemeStore();
  const cardBg = isDark ? "#1C1C20" : "#FFFFFF";
  const cardBorder = isDark ? "#2A2A30" : "#D5D5D5";
  const textPrimary = isDark ? "#FFFFFF" : "#111827";
  const textSecondary = isDark ? "#A0A0A0" : "#6B7280";
  const innerBg = isDark ? "#26262B" : "#F3F4F6";

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

  const isSolo = team.teamId.startsWith("solo-");

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View className="flex-1 justify-end bg-black/70">
        <View
          style={{ backgroundColor: cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderColor: cardBorder, borderTopWidth: 1 }}
          className="max-h-[85%] min-h-[200px]"
        >
          {/* Success Banner */}
          {updateSuccess && (
            <View className="bg-green-500/20 border-b border-green-500/30 p-3.5">
              <Text
                style={{ fontFamily: "Poppins_600SemiBold", color: "#10B981", textAlign: "center", fontSize: 13 }}
              >
                ✓ {successMessage}
              </Text>
            </View>
          )}

          {/* Header */}
          <View
            style={{ borderBottomWidth: 1, borderBottomColor: cardBorder }}
            className="flex-row items-center justify-between px-6 py-4"
          >
            <View className="flex-1 mr-3">
              <Text style={{ fontFamily: "Poppins_700Bold", color: textPrimary, fontSize: 18 }} numberOfLines={1}>
                {team.teamName}
              </Text>
              <Text style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 12 }}>
                {isSolo
                  ? "Individual Registration"
                  : `${team.members?.length ?? team.memberCount} ${
                      (team.members?.length ?? team.memberCount) === 1 ? "Member" : "Members"
                    }`}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={{ backgroundColor: isDark ? "#2A2A30" : "#F3F4F6" }}
              className="p-2 rounded-full"
              activeOpacity={0.7}
            >
              <X size={18} color={textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 }}
          >
            {/* Team or Registration Identifier */}
            <View
              style={{ backgroundColor: innerBg, borderColor: cardBorder, borderWidth: 1 }}
              className="rounded-xl p-4 mb-3"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1 mr-2">
                  <Text style={{ fontFamily: "Poppins_500Medium", color: textSecondary, fontSize: 12, marginBottom: 2 }}>
                    {isSolo ? "Registration ID" : team.inviteCode ? "Invite Code" : "Team ID"}
                  </Text>
                  <Text style={{ fontFamily: "Poppins_600SemiBold", color: textPrimary, fontSize: 14 }}>
                    {isSolo ? team.leaderId || team.teamId : team.inviteCode || team.teamId}
                  </Text>
                </View>
                <View
                  className="px-3 py-1 rounded-full self-start"
                  style={{ backgroundColor: getStatusColor(team.status) + "20" }}
                >
                  <Text style={{ color: getStatusColor(team.status), fontFamily: "Poppins_600SemiBold", fontSize: 11 }}>
                    {getStatusText(team.status)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Status Change Section (Admin, EB Events, EB Outreach, Event POC) */}
            <PrivateRoleComponent allowedRoles={[ROLE_ADMIN, ROLE_EB_EVENTS, ROLE_EB_OUTREACH, ROLE_EVENT_POC]}>
              <View
                style={{ backgroundColor: innerBg, borderColor: cardBorder, borderWidth: 1 }}
                className="rounded-xl p-4 mb-3"
              >
                <Text style={{ fontFamily: "Poppins_500Medium", color: textSecondary, fontSize: 12, marginBottom: 8 }}>
                  Change Registration Status
                </Text>

                <TouchableOpacity
                  style={{ backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1 }}
                  className="rounded-xl p-3 flex-row items-center justify-between"
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
                        style={{ color: getStatusColor(selectedNewStatus), fontFamily: "Poppins_600SemiBold", fontSize: 11 }}
                      >
                        {getStatusText(selectedNewStatus)}
                      </Text>
                    </View>
                  </View>
                  <ChevronDown size={18} color={textSecondary} />
                </TouchableOpacity>

                {showStatusDropdown && (
                  <View
                    style={{ backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1 }}
                    className="rounded-xl overflow-hidden mt-2"
                  >
                    {STATUS_OPTIONS.map((status, index) => (
                      <TouchableOpacity
                        key={status}
                        style={{
                          backgroundColor: selectedNewStatus === status ? "rgba(65, 184, 240, 0.15)" : cardBg,
                          borderBottomWidth: index < STATUS_OPTIONS.length - 1 ? 1 : 0,
                          borderBottomColor: cardBorder,
                        }}
                        className="p-3"
                        onPress={() => {
                          setSelectedNewStatus(status);
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
                            style={{ color: getStatusColor(status), fontFamily: "Poppins_600SemiBold", fontSize: 11 }}
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
                    style={{ backgroundColor: "#41B8F0" }}
                    className={`rounded-xl p-3.5 mt-3 flex-row items-center justify-center shadow-sm ${
                      isSavingStatus ? "opacity-50" : ""
                    }`}
                    onPress={handleSaveStatus}
                    disabled={isSavingStatus}
                    activeOpacity={0.8}
                  >
                    {isSavingStatus ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Save size={18} color="#FFFFFF" />
                    )}
                    <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#FFFFFF", fontSize: 14, marginLeft: 8 }}>
                      {isSavingStatus ? "Saving..." : "Save Status"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </PrivateRoleComponent>

            {/* Members / Participant Section */}
            <View className="mt-2">
              <Text style={{ fontFamily: "Poppins_600SemiBold", color: textPrimary, fontSize: 16, marginBottom: 12 }}>
                {isSolo ? "Participant Details" : `Team Members (${team.members?.length ?? team.memberCount})`}
              </Text>

              {loadingMembers ? (
                <View className="items-center justify-center py-8">
                  <ActivityIndicator size="large" color="#41B8F0" />
                  <Text style={{ fontFamily: "Poppins_500Medium", color: textSecondary, marginTop: 12 }}>
                    Loading team members...
                  </Text>
                </View>
              ) : team.members && team.members.length > 0 ? (
                team.members.map((member, index) => (
                  <View
                    key={index}
                    style={{ backgroundColor: innerBg, borderColor: cardBorder, borderWidth: 1 }}
                    className="rounded-xl p-4 mb-3"
                  >
                    <View className="flex-row items-start justify-between mb-3">
                      <View className="flex-1 mr-2">
                        <Text style={{ fontFamily: "Poppins_600SemiBold", color: textPrimary, fontSize: 15 }}>
                          {member.user.name || (member.user as any).displayName || "Unknown User"}
                        </Text>
                      </View>
                      {!isSolo && member.userId === team.leaderId && (
                        <View className="bg-[#41B8F0]/20 border border-[#41B8F0]/30 px-2.5 py-0.5 rounded-full">
                          <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#41B8F0", fontSize: 10 }}>LEADER</Text>
                        </View>
                      )}
                    </View>

                    <View className="space-y-2">
                      {member.user.phoneNumber ? (
                        <View className="flex-row items-center">
                          <Phone size={14} color="#41B8F0" />
                          <Text style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 13, marginLeft: 8 }}>
                            {member.user.phoneNumber}
                          </Text>
                        </View>
                      ) : null}

                      {member.user.email ? (
                        <View className="flex-row items-center mt-1">
                          <Mail size={14} color="#41B8F0" />
                          <Text style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 13, marginLeft: 8 }}>
                            {member.user.email}
                          </Text>
                        </View>
                      ) : null}

                      {member.user.collegeName ? (
                        <View className="flex-row items-center mt-1">
                          <School size={14} color="#41B8F0" />
                          <Text style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 13, marginLeft: 8 }}>
                            {member.user.collegeName}
                          </Text>
                        </View>
                      ) : null}

                      {member.user.rollNumber ? (
                        <View className="flex-row items-center mt-1">
                          <Text style={{ fontFamily: "Poppins_500Medium", color: textSecondary, fontSize: 12, marginLeft: 22 }}>
                            Roll: {member.user.rollNumber}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ))
              ) : (
                <View className="items-center justify-center py-8">
                  <Text style={{ fontFamily: "Poppins_500Medium", color: textSecondary }}>No members loaded</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

