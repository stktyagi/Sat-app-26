// src/components/admin/UserCard.tsx
import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import {
  User,
  Mail,
  Phone,
  GraduationCap,
  Crown,
  CheckCircle,
  MoreVertical,
} from "lucide-react-native";
import { AdminUserProfile } from '@/types/adminTypes';
import { showAlert } from "../index";

interface UserCardProps {
  user: AdminUserProfile;
  onUserUpdate?: (updatedUser: AdminUserProfile) => void;
  onUserClick?: (user: AdminUserProfile) => void;
}

const UserCard: React.FC<UserCardProps> = ({
  user,
  onUserUpdate,
  onUserClick,
}) => {
  const [loading, setLoading] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const handleToggleAmbassador = async () => {
    setLoading(true);
    try {
      /* Removed API call */

      if (result.success) {
        const updatedUser = { ...user, isAmbassador: !user.isAmbassador };
        onUserUpdate?.(updatedUser);
        showAlert(
          "Success",
          `${user.displayName} ${
            !user.isAmbassador ? "promoted to" : "removed from"
          } ambassador role`
        );
      } else {
        showAlert("Error", result.error || "Failed to update user role");
      }
    } catch (error) {
      showAlert("Error", "Failed to update user role. Please try again.");
    } finally {
      setLoading(false);
      setShowActions(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Unknown";
    }
  };

  return (
    <TouchableOpacity
      onPress={() => onUserClick?.(user)}
      className="bg-[#FFFFFF] rounded-xl p-4 mx-4 mb-3 border border-gray-100"
      style={{ boxShadow: '0px 4px 10px 0px rgba(0, 0, 0, 0.1)' }}
      activeOpacity={0.7}
    >
      {/* Header Row */}
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1">
          <View className="flex-row items-center mb-1">
            <User size={16} color="#0C3572" />
            <Text
              style={{ fontFamily: "Outfit_700Bold" }}
              className="text-[#0C3572] text-lg ml-2 flex-1"
              numberOfLines={1}
            >
              {user.displayName}
            </Text>
          </View>

          {/* Status Badges */}
          <View className="flex-row flex-wrap gap-2 mt-2">
            {/* Current Role Badge */}
            <View className="bg-[#EEB170]/40 px-2 py-1 rounded-full flex-row items-center">
              <Crown size={12} color="#0C3572" />
              <Text className="text-[#0C3572] text-xs ml-1 font-semibold">
                {user.role || "user"}
              </Text>
            </View>

            {/* Additional Roles (if roles array exists) */}
            {user.roles && user.roles.length > 1 && (
              <View className="bg-gray-100 px-2 py-1 rounded-full">
                <Text className="text-gray-600 text-xs font-semibold">
                  +{user.roles.length - 1} more
                </Text>
              </View>
            )}

            {user.isVerified && (
              <View className="bg-green-100 px-2 py-1 rounded-full flex-row items-center">
                <CheckCircle size={12} color="#10B981" />
                <Text className="text-green-700 text-xs ml-1 font-semibold">
                  Verified
                </Text>
              </View>
            )}

            {user.isHostCollegeStudent && (
              <View className="bg-blue-100 px-2 py-1 rounded-full">
                <Text className="text-blue-700 text-xs font-semibold">
                  Host College
                </Text>
              </View>
            )}
          </View>

          {/* Tap to manage roles hint */}
          <View className="mt-2">
            <Text
              style={{ fontFamily: "Outfit_400Regular" }}
              className="text-gray-500 text-xs"
            >
              Tap to manage roles
            </Text>
          </View>
        </View>

        {/* Actions Menu */}
        <TouchableOpacity
          onPress={() => setShowActions(!showActions)}
          className="p-2 rounded-full bg-gray-100"
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#0C3572" />
          ) : (
            <MoreVertical size={16} color="#0C3572" />
          )}
        </TouchableOpacity>
      </View>

      {/* User Details */}
      <View className="space-y-2">
        {/* Email */}
        <View className="flex-row items-center">
          <Mail size={14} color="#9CA3AF" />
          <Text
            style={{ fontFamily: "Outfit_500Medium" }}
            className="text-gray-700 text-sm ml-2 flex-1"
            numberOfLines={1}
          >
            {user.email}
          </Text>
        </View>

        {/* Phone */}
        {user.phoneNumber && (
          <View className="flex-row items-center">
            <Phone size={14} color="#9CA3AF" />
            <Text
              style={{ fontFamily: "Outfit_500Medium" }}
              className="text-gray-700 text-sm ml-2"
            >
              {user.phoneNumber}
            </Text>
          </View>
        )}

        {/* College */}
        <View className="flex-row items-center">
          <GraduationCap size={14} color="#9CA3AF" />
          <Text
            style={{ fontFamily: "Outfit_500Medium" }}
            className="text-gray-700 text-sm ml-2 flex-1"
            numberOfLines={1}
          >
            {user.collegeName}
          </Text>
        </View>
      </View>

      {/* Stats Row */}
      <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-gray-200">
        <View className="flex-row space-x-4">
          <View className="items-center">
            <Text
              style={{ fontFamily: "Outfit_600SemiBold" }}
              className="text-[#0C3572] text-sm"
            >
              {user.coins}
            </Text>
            <Text
              style={{ fontFamily: "Outfit_400Regular" }}
              className="text-gray-500 text-xs"
            >
              Coins
            </Text>
          </View>

          {user.points !== undefined && (
            <View className="items-center">
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className="text-green-700 text-sm"
              >
                {user.points}
              </Text>
              <Text
                style={{ fontFamily: "Outfit_400Regular" }}
                className="text-gray-500 text-xs"
              >
                Points
              </Text>
            </View>
          )}
        </View>

        <Text
          style={{ fontFamily: "Outfit_400Regular" }}
          className="text-gray-500 text-xs"
        >
          Joined {formatDate(user.createdAt)}
        </Text>
      </View>

      {/* Actions Menu */}
      {showActions && (
        <View className="mt-3 pt-3 border-t border-gray-200">
          <TouchableOpacity
            onPress={handleToggleAmbassador}
            className={`py-2 px-4 rounded-lg ${
              user.isAmbassador ? "bg-red-100" : "bg-[#EEB170]/40"
            }`}
            disabled={loading}
          >
            <Text
              style={{ fontFamily: "Outfit_600SemiBold" }}
              className={`text-center text-sm ${
                user.isAmbassador ? "text-red-700" : "text-[#0C3572]"
              }`}
            >
              {user.isAmbassador ? "Remove Ambassador" : "Make Ambassador"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default UserCard;
