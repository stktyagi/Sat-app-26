// src/components/admin/RoleManagementModal.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { X, Check, User, Crown } from "lucide-react-native";
import { AdminUserProfile } from '@/types/adminTypes';
import { showAlert } from "../index";

interface RoleManagementModalProps {
  visible: boolean;
  user: AdminUserProfile | null;
  onClose: () => void;
  onRolesUpdate?: (userId: string, updatedUser: AdminUserProfile) => void;
}

const ROLE_COLORS = {
  admin: "#EF4444",
  event_admin: "#F59E0B",
  event_coordinator: "#10B981",
  outreach_admin: "#3B82F6",
  outreach_member: "#6366F1",
  finance: "#8B5CF6",
  hospitality_admin: "#14B8A6",
  hospitality_member: "#22D3EE",
  eb_member: "#E879F9",
  executive_committee: "#F472B6",
  media: "#EC4899",
  core_member: "#6B7280",
  user: "#6B7280",
};


// const ROLE_HIERARCHY = {
//   admin: 12,
//   event_admin: 11,
//   event_coordinator: 10,
//   outreach_admin: 9,
//   outreach_member: 8,
//   finance: 7,
//   hospitality_admin: 6,
//   hospitality_member: 5,
//   eb_member: 4,
//   executive_committee: 3,
//   core_member: 2,
//   user: 1,
// };

const RoleManagementModal: React.FC<RoleManagementModalProps> = ({
  visible,
  user,
  onClose,
  onRolesUpdate,
}) => {
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  /* Removed API call */
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Initialize selected roles when user changes
  useEffect(() => {
    if (user) {
      // For now, we'll use the current role field to initialize
      // Later this will be replaced with the roles array from the user object
      const currentRoles = user.roles || (user.role ? [user.role] : []);
      setSelectedRoles(currentRoles);
    }
  }, [user]);

  const toggleRole = (roleId: string) => {
    setSelectedRoles((prev) => {
      if (prev.includes(roleId)) {
        return prev.filter((r) => r !== roleId);
      } else {
        return [...prev, roleId];
      }
    });
  };

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);
    try {
      console.log("Updating roles for user:", user.userId, selectedRoles);

      // Call the updateUserRoles API function
      /* Removed API call */

      if (result.success) {
        // Create updated user object
        const updatedUser: AdminUserProfile = {
          ...user,
          role: user.role,
          roles: result.roles,
        };

        // Call the callback to update parent component
        onRolesUpdate?.(user.userId, updatedUser);

        // Show success banner instead of alert modal
        setSuccessMessage(result.message || "User roles updated successfully");
        setUpdateSuccess(true);
        setTimeout(() => {
          setUpdateSuccess(false);
          onClose();
        }, 2000);
      } else {
        // Show error message
        showAlert("Error", result.error || "Failed to update user roles");
      }
    } catch (error) {
      console.error("Error updating roles:", error);
      showAlert("Error", "Failed to update user roles. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  if (!user) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-black/50 justify-center items-center px-4">
        <View className="bg-[#1A1A1A] rounded-2xl w-full max-w-md">
          {/* Success Banner */}
          {updateSuccess && (
            <View className="bg-green-500/20 border border-green-500/30 rounded-t-2xl p-4">
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className="text-green-400 text-center"
              >
                ✓ {successMessage}
              </Text>
            </View>
          )}

          {/* Header */}
          <View className="flex-row items-center justify-between p-6 border-b border-gray-700">
            <View className="flex-row items-center flex-1">
              <User size={20} color="#FFBA00" />
              <View className="ml-3 flex-1">
                <Text
                  style={{ fontFamily: "Outfit_600SemiBold" }}
                  className="text-white text-lg"
                  numberOfLines={1}
                >
                  {user.displayName}
                </Text>
                <Text
                  style={{ fontFamily: "Outfit_400Regular" }}
                  className="text-gray-400 text-sm"
                  numberOfLines={1}
                >
                  {user.email}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleClose}
              className="p-2 rounded-full bg-[#2C2C2C]"
              disabled={loading}
            >
              <X size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Roles Section */}
          <View className="p-6">
            <View className="flex-row items-center mb-4">
              <Crown size={18} color="#FFBA00" />
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className="text-white text-lg ml-2"
              >
                Roles
              </Text>
            </View>

            <Text
              style={{ fontFamily: "Outfit_400Regular" }}
              className="text-gray-400 text-sm mb-4"
            >
              Select multiple roles for this user. The highest priority role
              will be set as the primary role.
            </Text>

            {/* Roles List */}
            <ScrollView
              className="max-h-80"
              showsVerticalScrollIndicator={false}
            >
              <View className="space-y-3 flex-col flex gap-3">
                {availableRoles.map((role) => {
                  const isSelected = selectedRoles.includes(role.id);
                  const roleColor =
                    ROLE_COLORS[role.id as keyof typeof ROLE_COLORS] ||
                    "#6B7280";

                  return (
                    <TouchableOpacity
                      key={role.id}
                      onPress={() => toggleRole(role.id)}
                      className={`flex-row items-center justify-between p-4 rounded-xl border ${
                        isSelected
                          ? "bg-[#2C2C2C] border-[#FFBA00]"
                          : "bg-[#252525] border-gray-600"
                      }`}
                      disabled={loading}
                    >
                      <View className="flex-row items-center flex-1">
                        <View
                          className="w-3 h-3 rounded-full mr-3"
                          style={{ backgroundColor: roleColor }}
                        />
                        <Text
                          style={{ fontFamily: "Outfit_500Medium" }}
                          className={`text-base ${
                            isSelected ? "text-white" : "text-gray-300"
                          }`}
                        >
                          {role.label}
                        </Text>
                      </View>

                      {isSelected && (
                        <View className="w-6 h-6 bg-[#FFBA00] rounded-full items-center justify-center">
                          <Check size={14} color="#000" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Selected Roles Summary */}
            {selectedRoles.length > 0 && (
              <View className="mt-4 p-3 bg-[#2C2C2C] rounded-xl">
                <Text
                  style={{ fontFamily: "Outfit_500Medium" }}
                  className="text-gray-300 text-sm mb-2"
                >
                  Selected Roles ({selectedRoles.length}):
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {selectedRoles.map((roleId) => {
                    const role = availableRoles.find((r) => r.id === roleId);
                    return (
                      <View
                        key={roleId}
                        className="bg-[#FFBA00]/20 px-2 py-1 rounded-full"
                      >
                        <Text
                          style={{ fontFamily: "Outfit_500Medium" }}
                          className="text-[#FFBA00] text-xs"
                        >
                          {role?.label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </View>

          {/* Footer */}
          <View className="flex-row space-x-3 gap-2 p-6 border-t border-gray-700">
            <TouchableOpacity
              onPress={handleClose}
              className="flex-1 py-3 rounded-xl bg-[#2C2C2C]"
              disabled={loading}
            >
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className="text-gray-300 text-center"
              >
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSave}
              className="flex-1 py-3 rounded-xl bg-[#FFBA00]"
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text
                  style={{ fontFamily: "Outfit_600SemiBold" }}
                  className="text-black text-center"
                >
                  Save Changes
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default RoleManagementModal;
