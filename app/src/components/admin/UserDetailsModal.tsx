// src/components/admin/UserDetailsModal.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import {
  X,
  User,
  Mail,
  Phone,
  Building,
  MapPin,
  Calendar,
  Coins,
  Home,
  UtensilsCrossed,
  CheckCircle,
  Crown,
  ShoppingBag,
  Ticket,
} from "lucide-react-native";
import { AdminUserProfile } from '@/types/adminTypes';
import { UserProfile } from '@/types/models';
import { showAlert } from "../index";
import { PrivateRoleComponent } from "../auth/PrivateRoleComponent";

interface UserDetailsModalProps {
  visible: boolean;
  user: AdminUserProfile | UserProfile | null;
  onClose: () => void;
  onUserUpdate?: (userId: string, updatedUser: AdminUserProfile) => void;
  onUserDelete?: (userId: string) => void;
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

const availableRoles = [
  { id: "admin", label: "Admin" },
  { id: "event_admin", label: "Event Admin" },
  { id: "event_coordinator", label: "Event Coordinator" },
  { id: "outreach_admin", label: "Outreach Admin" },
  { id: "outreach_member", label: "Outreach Member" },
  { id: "finance", label: "Finance" },
  { id: "hospitality_admin", label: "Hospitality Admin" },
  { id: "hospitality_member", label: "Hospitality Member" },
  { id: "eb_member", label: "EB Member" },
  { id: "executive_committee", label: "Executive Committee" },
  { id: "media", label: "Media" },
  { id: "core_member", label: "Core Member" },
  { id: "user", label: "User" },
];

const UserDetailsModal: React.FC<UserDetailsModalProps> = ({
  visible,
  user,
  onClose,
  onUserUpdate,
  onUserDelete,
}) => {
  const [loading, setLoading] = useState(false);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [showRoleManagement, setShowRoleManagement] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  /* Removed API call */
  const lastUserIdRef = useRef<string | null>(null);
  const lastRolesRef = useRef<string>("");
  const [updateSuccess, setUpdateSuccess] = useState(false);

  // Fetch user registrations and orders when modal opens or user changes
  useEffect(() => {
    if (visible && user && user.userId !== lastUserIdRef.current) {
      lastUserIdRef.current = user.userId;
      fetchUserData();
    }
  }, [visible, user?.userId]);

  // Initialize selected roles when user changes - only update if roles actually changed
  useEffect(() => {
    if (user) {
      const currentRoles = user.roles || (user.role ? [user.role] : []);
      // Create a sorted string for comparison, but keep original order for state
      const sortedRolesString = JSON.stringify([...currentRoles].sort());

      // Only update if roles have actually changed
      if (sortedRolesString !== lastRolesRef.current) {
        console.log("Roles changed, updating selectedRoles:", currentRoles);
        lastRolesRef.current = sortedRolesString;
        // Keep the original order from the user object, don't sort
        setSelectedRoles([...currentRoles]);
      }
    }
  }, [user]);

  const fetchUserData = async () => {
    if (!user) return;

    // Fetch registrations
    setLoadingRegistrations(true);
    try {
      setRegistrations([]);
    } catch (error) {
      console.error("Error fetching user registrations:", error);
    } finally {
      setLoadingRegistrations(false);
    }

    // Fetch orders
    setLoadingOrders(true);
    try {
      setOrders([]);
    } catch (error) {
      console.error("Error fetching user orders:", error);
    } finally {
      setLoadingOrders(false);
    }
  };

  const toggleRole = (roleId: string) => {
    setSelectedRoles((prev) => {
      if (prev.includes(roleId)) {
        return prev.filter((r) => r !== roleId);
      } else {
        return [...prev, roleId];
      }
    });
  };

  const handleDeleteUser = () => {
    if (!user) return;
    Alert.alert(
      "Delete User",
      `Are you sure you want to delete ${user.displayName}? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            setLoading(true);
            try {
              const { adminDeleteUser } = await import("@/api/admin");
              await adminDeleteUser(user.email);
              showAlert("Success", "User deleted successfully");
              onUserDelete?.(user.userId);
            } catch (error: any) {
              console.error("Error deleting user:", error);
              showAlert("Error", error.message || "Failed to delete user");
            } finally {
              setLoading(false);
            }
          } 
        }
      ]
    );
  };

  const handleSaveRoles = async () => {
    if (!user) return;

    console.log("Starting role update for user:", user.userId);
    console.log("Selected roles:", selectedRoles);

    setLoading(true);
    try {
      const { adminUpdateUser } = await import("@/api/admin");
      await adminUpdateUser(user.email, { roles: selectedRoles });

      const updatedUser: AdminUserProfile = {
        ...(user as AdminUserProfile),
        role: user.role,
        roles: selectedRoles,
      };

      console.log("Updated user object:", updatedUser);

      // Exit role management mode first
      setShowRoleManagement(false);

      // Update parent component state
      onUserUpdate?.(user.userId, updatedUser);

      console.log("Role update completed successfully");

      // Show success banner instead of modal alert
      setUpdateSuccess(true);
      setTimeout(() => {
        setUpdateSuccess(false);
      }, 3000);
    } catch (error: any) {
      console.error("Error updating roles:", error);
      showAlert("Error", error.message || "Failed to update user roles. Please try again.");
    } finally {
      setLoading(false);
      console.log("Loading state set to false");
    }
  };

  if (!user) return null;

  const fullUser = user as UserProfile;

  console.log("Rendering UserDetailsModal for user:", user.userId);
  console.log("Current roles:", user.roles);
  console.log("Show role management:", showRoleManagement);
  console.log("Loading state:", loading);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-3xl min-h-[200px] h-[80%]">
          {/* Header */}
          <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-[#2175C0]/10">
            <View className="flex-row items-center flex-1">
              <User size={24} color="#F05423" />
              <View className="ml-3 flex-1">
                <Text
                  style={{ fontFamily: "Outfit_600SemiBold" }}
                  className="text-[#0C3572] text-xl"
                  numberOfLines={1}
                >
                  {user.displayName}
                </Text>
                <Text
                  style={{ fontFamily: "Outfit_400Regular" }}
                  className="text-[#2175C0] text-sm"
                  numberOfLines={1}
                >
                  {user.email}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              className="p-2 rounded-full bg-[#2175C0]/10"
              activeOpacity={0.7}
            >
              <X size={20} color="#2175C0" />
            </TouchableOpacity>
          </View>

          {/* Success Banner */}
          {updateSuccess && (
            <View className="mx-6 mt-4 bg-green-500/20 border border-green-500/30 rounded-xl p-4">
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className="text-green-400 text-center"
              >
                ✓ Roles updated successfully!
              </Text>
            </View>
          )}

          {/* Content */}
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {/* Basic Information */}
            <View className="px-6 py-4">
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className="text-[#0C3572] text-lg mb-4"
              >
                Basic Information
              </Text>

              <View className="space-y-3 flex flex-col gap-3">
                {/* Email */}
                <View className="flex-row items-center">
                  <View className="w-8">
                    <Mail size={16} color="#2175C0" />
                  </View>
                  <Text
                    style={{ fontFamily: "Outfit_400Regular" }}
                    className="text-[#0C3572] flex-1"
                  >
                    {user.email}
                  </Text>
                </View>

                {/* Phone */}
                {user.phoneNumber && (
                  <View className="flex-row items-center">
                    <View className="w-8">
                      <Phone size={16} color="#2175C0" />
                    </View>
                    <Text
                      style={{ fontFamily: "Outfit_400Regular" }}
                      className="text-[#0C3572] flex-1"
                    >
                      {user.phoneNumber}
                    </Text>
                  </View>
                )}

                {/* College */}
                <View className="flex-row items-center">
                  <View className="w-8">
                    <Building size={16} color="#2175C0" />
                  </View>
                  <Text
                    style={{ fontFamily: "Outfit_400Regular" }}
                    className="text-[#0C3572] flex-1"
                  >
                    {user.collegeName}
                  </Text>
                </View>

                {/* State */}
                {fullUser.collegeState && (
                  <View className="flex-row items-center">
                    <View className="w-8">
                      <MapPin size={16} color="#2175C0" />
                    </View>
                    <Text
                      style={{ fontFamily: "Outfit_400Regular" }}
                      className="text-[#0C3572] flex-1"
                    >
                      {fullUser.collegeState}
                    </Text>
                  </View>
                )}

                {/* Graduation Year */}
                {fullUser.graduationYear && (
                  <View className="flex-row items-center">
                    <View className="w-8">
                      <Calendar size={16} color="#2175C0" />
                    </View>
                    <Text
                      style={{ fontFamily: "Outfit_400Regular" }}
                      className="text-[#0C3572] flex-1"
                    >
                      Graduation: {fullUser.graduationYear}
                    </Text>
                  </View>
                )}

                {/* Roll Number */}
                {fullUser.rollNumber && (
                  <View className="flex-row items-center">
                    <View className="w-8">
                      <Text className="text-[#2175C0] text-xs">#</Text>
                    </View>
                    <Text
                      style={{ fontFamily: "Outfit_400Regular" }}
                      className="text-[#0C3572] flex-1"
                    >
                      Roll No: {fullUser.rollNumber}
                    </Text>
                  </View>
                )}

                {/* Coins */}
                <View className="flex-row items-center">
                  <View className="w-8">
                    <Coins size={16} color="#F05423" />
                  </View>
                  <Text
                    style={{ fontFamily: "Outfit_400Regular" }}
                    className="text-[#0C3572] flex-1"
                  >
                    {user.coins || 0} Coins
                    {fullUser.points !== undefined &&
                      ` • ${fullUser.points} Points`}
                  </Text>
                </View>
              </View>

              {/* Status Badges */}
              <View className="flex-row flex-wrap gap-2 mt-4">
                {user.isHostCollegeStudent && (
                  <View className="bg-blue-500/20 px-3 py-1 rounded-full border border-blue-500/30">
                    <Text
                      style={{ fontFamily: "Outfit_500Medium" }}
                      className="text-blue-400 text-xs"
                    >
                      Host College
                    </Text>
                  </View>
                )}
                {user.isAmbassador && (
                  <View className="bg-purple-500/20 px-3 py-1 rounded-full border border-purple-500/30">
                    <Text
                      style={{ fontFamily: "Outfit_500Medium" }}
                      className="text-purple-400 text-xs"
                    >
                      Ambassador
                    </Text>
                  </View>
                )}
                {user.isVerified && (
                  <View className="bg-green-500/20 px-3 py-1 rounded-full border border-green-500/30">
                    <Text
                      style={{ fontFamily: "Outfit_500Medium" }}
                      className="text-green-400 text-xs"
                    >
                      Verified
                    </Text>
                  </View>
                )}
                {user.fullyRegistered && (
                  <View className="bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30">
                    <Text
                      style={{ fontFamily: "Outfit_500Medium" }}
                      className="text-emerald-400 text-xs"
                    >
                      Fully Registered
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Accommodation Section */}
            {user.accommodationNeeded && fullUser.accommodation && (
              <View className="px-6 py-4 border-t border-[#2175C0]/10">
                <View className="flex-row items-center mb-4">
                  <Home size={18} color="#F05423" />
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className="text-[#0C3572] text-lg ml-2"
                  >
                    Accommodation
                  </Text>
                </View>

                <View className="bg-[#2175C0]/5 rounded-xl p-4">
                  <View className="flex-row flex-wrap gap-2">
                    {Object.entries(fullUser.accommodation).map(
                      ([day, booked]) =>
                        booked && (
                          <View
                            key={day}
                            className="bg-green-500/20 px-3 py-2 rounded-lg border border-green-500/30"
                          >
                            <Text
                              style={{ fontFamily: "Outfit_500Medium" }}
                              className="text-green-400 text-sm capitalize"
                            >
                              {day.replace("day", "Day ")}
                            </Text>
                          </View>
                        )
                    )}
                  </View>

                  {Object.values(fullUser.accommodation).every((v) => !v) && (
                    <Text
                      style={{ fontFamily: "Outfit_400Regular" }}
                      className="text-[#2175C0] text-sm"
                    >
                      No accommodation booked yet
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* Check-In Status Section (if available) */}
            {/* This would require additional API - placeholder for now */}

            {/* Event Registrations Section */}
            <View className="px-6 py-4 border-t border-[#2175C0]/10">
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center">
                  <Ticket size={18} color="#F05423" />
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className="text-[#0C3572] text-lg ml-2"
                  >
                    Event Registrations
                  </Text>
                </View>
                <View className="bg-[#2175C0]/10 px-3 py-1 rounded-full">
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className="text-[#F05423] text-sm"
                  >
                    {registrations.length}
                  </Text>
                </View>
              </View>

              {loadingRegistrations ? (
                <View className="py-8 items-center">
                  <ActivityIndicator size="small" color="#F05423" />
                </View>
              ) : registrations.length > 0 ? (
                <View className="space-y-3 flex flex-col gap-3">
                  {registrations.map((reg, index) => (
                    <View
                      key={index}
                      className="bg-[#2175C0]/5 rounded-xl p-4 border border-[#2175C0]/20"
                    >
                      <Text
                        style={{ fontFamily: "Outfit_600SemiBold" }}
                        className="text-[#0C3572] text-base mb-2"
                      >
                        {reg.eventName}
                      </Text>

                      <View className="flex-row items-center justify-between mb-2">
                        <Text
                          style={{ fontFamily: "Outfit_400Regular" }}
                          className="text-[#2175C0] text-sm"
                        >
                          Type: {reg.eventType}
                        </Text>
                        <View
                          className={`px-3 py-1 rounded-full ${
                            reg.status === "confirmed"
                              ? "bg-green-500/20"
                              : reg.status === "pending"
                              ? "bg-yellow-500/20"
                              : "bg-red-500/20"
                          }`}
                        >
                          <Text
                            style={{ fontFamily: "Outfit_500Medium" }}
                            className={`text-xs capitalize ${
                              reg.status === "confirmed"
                                ? "text-green-400"
                                : reg.status === "pending"
                                ? "text-yellow-400"
                                : "text-red-400"
                            }`}
                          >
                            {reg.status}
                          </Text>
                        </View>
                      </View>

                      {reg.teamId && (
                        <Text
                          style={{ fontFamily: "Outfit_400Regular" }}
                          className="text-[#2175C0] text-sm"
                        >
                          Team ID: {reg.teamId}
                        </Text>
                      )}

                      <Text
                        style={{ fontFamily: "Outfit_400Regular" }}
                        className="text-[#2175C0]/80 text-xs mt-2"
                      >
                        Registered:{" "}
                        {new Date(reg.registeredAt).toLocaleDateString()}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View className="bg-[#2175C0]/5 rounded-xl p-4">
                  <Text
                    style={{ fontFamily: "Outfit_400Regular" }}
                    className="text-[#2175C0] text-center"
                  >
                    No event registrations found
                  </Text>
                </View>
              )}
            </View>

            {/* Orders Section */}
            <View className="px-6 py-4 border-t border-[#2175C0]/10">
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center">
                  <ShoppingBag size={18} color="#F05423" />
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className="text-[#0C3572] text-lg ml-2"
                  >
                    Orders
                  </Text>
                </View>
                <View className="bg-[#2175C0]/10 px-3 py-1 rounded-full">
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className="text-[#F05423] text-sm"
                  >
                    {orders.length}
                  </Text>
                </View>
              </View>

              {loadingOrders ? (
                <View className="py-8 items-center">
                  <ActivityIndicator size="small" color="#F05423" />
                </View>
              ) : orders.length > 0 ? (
                <View className="space-y-3 flex flex-col gap-3">
                  {orders.map((order, index) => (
                    <View
                      key={index}
                      className="bg-[#2175C0]/5 rounded-xl p-4 border border-[#2175C0]/20"
                    >
                      <View className="flex-row items-center justify-between mb-2">
                        <Text
                          style={{ fontFamily: "Outfit_600SemiBold" }}
                          className="text-[#0C3572] text-base"
                        >
                          Order #{order.orderId.slice(-6)}
                        </Text>
                        <View
                          className={`px-3 py-1 rounded-full ${
                            order.status === "confirmed" ||
                            order.status === "delivered"
                              ? "bg-green-500/20"
                              : order.status === "pending"
                              ? "bg-yellow-500/20"
                              : "bg-red-500/20"
                          }`}
                        >
                          <Text
                            style={{ fontFamily: "Outfit_500Medium" }}
                            className={`text-xs capitalize ${
                              order.status === "confirmed" ||
                              order.status === "delivered"
                                ? "text-green-400"
                                : order.status === "pending"
                                ? "text-yellow-400"
                                : "text-red-400"
                            }`}
                          >
                            {order.status}
                          </Text>
                        </View>
                      </View>

                      <View className="flex-row items-center justify-between mb-2">
                        <Text
                          style={{ fontFamily: "Outfit_400Regular" }}
                          className="text-[#2175C0] text-sm"
                        >
                          {order.items.length} item(s)
                        </Text>
                        <Text
                          style={{ fontFamily: "Outfit_600SemiBold" }}
                          className="text-[#F05423] text-base"
                        >
                          ₹{order.finalAmount}
                        </Text>
                      </View>

                      <Text
                        style={{ fontFamily: "Outfit_400Regular" }}
                        className="text-[#2175C0]/80 text-xs"
                      >
                        {new Date(order.orderDate).toLocaleDateString()}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View className="bg-[#2175C0]/5 rounded-xl p-4">
                  <Text
                    style={{ fontFamily: "Outfit_400Regular" }}
                    className="text-[#2175C0] text-center"
                  >
                    No orders found
                  </Text>
                </View>
              )}
            </View>

            <PrivateRoleComponent allowedRoles={['admin']}>

            {/* Role Management Section */}
            <View className="px-6 py-4 border-t border-[#2175C0]/10">
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center">
                  <Crown size={18} color="#F05423" />
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className="text-[#0C3572] text-lg ml-2"
                  >
                    Roles
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowRoleManagement(!showRoleManagement)}
                  className="bg-[#2175C0]/10 px-4 py-2 rounded-lg"
                  activeOpacity={0.7}
                >
                  <Text
                    style={{ fontFamily: "Outfit_500Medium" }}
                    className="text-[#F05423] text-sm"
                  >
                    {showRoleManagement ? "Cancel" : "Edit Roles"}
                  </Text>
                </TouchableOpacity>
              </View>

              {!showRoleManagement ? (
                <View className="flex-row flex-wrap gap-2">
                  {(user.roles || [user.role]).filter(Boolean).map((roleId) => {
                    const role = availableRoles.find((r) => r.id === roleId);
                    const roleColor =
                      ROLE_COLORS[roleId as keyof typeof ROLE_COLORS] ||
                      "#6B7280";

                    return (
                      <View
                        key={roleId}
                        className="flex-row items-center bg-[#2175C0]/5 px-3 py-2 rounded-lg border border-[#2175C0]/20"
                      >
                        <View
                          className="w-2 h-2 rounded-full mr-2"
                          style={{ backgroundColor: roleColor }}
                        />
                        <Text
                          style={{ fontFamily: "Outfit_500Medium" }}
                          className="text-[#0C3572] text-sm"
                        >
                          {role?.label || roleId}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View>
                  <Text
                    style={{ fontFamily: "Outfit_400Regular" }}
                    className="text-[#2175C0] text-sm mb-4"
                  >
                    Select multiple roles for this user. The highest priority
                    role will be set as the primary role.
                  </Text>

                  <View className="space-y-3 flex-col flex gap-3">
                    {availableRoles.map((role) => {
                      const isSelected = selectedRoles.includes(role.id);
                      const roleColor =
                        ROLE_COLORS[
                          role.id as keyof typeof ROLE_COLORS
                        ] || "#6B7280";

                      return (
                        <TouchableOpacity
                          key={role.id}
                          onPress={() => toggleRole(role.id)}
                          className={`flex-row items-center justify-between p-4 rounded-xl border ${
                            isSelected
                              ? "bg-[#2175C0]/10 border-[#F05423]"
                              : "bg-[#2175C0]/5 border-[#2175C0]/20"
                          }`}
                          disabled={loading}
                          activeOpacity={0.7}
                        >
                          <View className="flex-row items-center flex-1">
                            <View
                              className="w-3 h-3 rounded-full mr-3"
                              style={{ backgroundColor: roleColor }}
                            />
                            <Text
                              style={{ fontFamily: "Outfit_500Medium" }}
                              className={`text-base ${
                                isSelected ? "text-[#0C3572]" : "text-[#0C3572]"
                              }`}
                            >
                              {role.label}
                            </Text>
                          </View>

                          {isSelected && (
                            <View className="w-6 h-6 bg-[#F05423] rounded-full items-center justify-center">
                              <CheckCircle size={14} color="#ffffff" />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Save Button */}
                  <TouchableOpacity
                    onPress={handleSaveRoles}
                    className="mt-4 bg-[#F05423] py-3 rounded-xl"
                    disabled={loading}
                    activeOpacity={0.7}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text
                        style={{ fontFamily: "Outfit_600SemiBold" }}
                        className="text-white text-center"
                      >
                        Save Changes
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
            </PrivateRoleComponent>
          </ScrollView>

          {/* Footer */}
          <View className="px-6 py-4 border-t border-[#2175C0]/10 flex-row gap-3">
            <PrivateRoleComponent allowedRoles={['admin']}>
              <TouchableOpacity
                onPress={handleDeleteUser}
                className="flex-1 bg-red-600/20 border border-red-500/50 py-3 rounded-xl mr-3"
                activeOpacity={0.7}
              >
                <Text style={{ fontFamily: "Outfit_600SemiBold" }} className="text-red-400 text-center">Delete</Text>
              </TouchableOpacity>
            </PrivateRoleComponent>
            <TouchableOpacity
              onPress={onClose}
              className="flex-1 bg-[#2175C0]/10 py-3 rounded-xl"
              activeOpacity={0.7}
            >
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className="text-[#0C3572] text-center"
              >
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default UserDetailsModal;
