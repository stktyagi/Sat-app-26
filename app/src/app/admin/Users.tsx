// src/screens/Admin/Users.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { ArrowLeft, Users as UsersIcon, QrCode } from "lucide-react-native";
import { AdminUserProfile, UserFilters } from "@/types/adminTypes";
import {
  fetchUsers,
  clearUsersCache,
  hasActiveFilters,
  getUserById,
} from "@/api/admin";
import UserCard from "@/components/admin/UserCard";

import UserSearchBar from "@/components/admin/UserSearchBar";
import UserDetailsModal from "@/components/admin/UserDetailsModal";
import UserQRScannerModal from "@/components/admin/UserQRScannerModal";

import { useThemeStore } from "@/state/themeStore";
import { useUserStore } from "@/state/userStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { showAlert } from "@/components";
import { useAdminNavigation } from "@/hooks/useAdminNavigation";
import {
  getUserRoles,
  isFullAdmin,
  ROLE_ADMIN,
  ROLE_EB_EVENTS,
  ROLE_EB_OUTREACH,
  ROLE_EB_FINANCE,
  ROLE_EB_HOSPITALITY,
} from "@/utils/roles";

interface UsersProps {
  navigation: any;
}

const Users: React.FC = () => {
  const navigation = useAdminNavigation();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const { userData: userProfile } = useUserStore();

  const roles = getUserRoles(userProfile);
  const isSuperOrAdmin = isFullAdmin(userProfile);
  const allowedRoles = [
    ROLE_ADMIN,
    ROLE_EB_EVENTS,
    ROLE_EB_OUTREACH,
    ROLE_EB_FINANCE,
    ROLE_EB_HOSPITALITY,
  ];
  const hasAccess =
    isSuperOrAdmin || roles.some((r) => allowedRoles.includes(r));

  const [users, setUsers] = useState<AdminUserProfile[]>([]);
  const [searchLoading, setSearchLoading] = useState(false); // Search/filter loading
  const [refreshing, setRefreshing] = useState(false);

  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User details modal state
  const [userDetailsModalVisible, setUserDetailsModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserProfile | null>(
    null
  );

  // QR scanner modal state
  const [qrScannerVisible, setQrScannerVisible] = useState(false);
  const [loadingQRUser, setLoadingQRUser] = useState(false);

  const [filters, setFilters] = useState<UserFilters>({
    searchTerm: "",
    campusFilter: "all",
    ambassadorFilter: "all",
  });

  // Load users when filters change
  useEffect(() => {
    if (hasActiveFilters(filters)) {
      loadUsers();
    } else {
      // Clear users when no filters are active
      setUsers([]);
      setHasMore(false);
      setSearchLoading(false); // Clear search loading when no filters
    }
  }, [filters.searchTerm]);

  const loadUsers = async () => {
    try {
      setSearchLoading(true);
      const result = await fetchUsers(filters, false);
      setUsers(result.users);
      setHasMore(result.hasMore);
      setError(null);
    } catch (err) {
      console.error("Error loading users:", err);
      setError("Failed to load users. Please try again.");
      showAlert(
        "Error",
        "Failed to load users. Please check your connection and try again."
      );
    } finally {
      setSearchLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    clearUsersCache();
    try {
      await loadUsers();
    } catch (err) {
      console.error("Error refreshing:", err);
    } finally {
      setRefreshing(false);
    }
  }, [filters]);


  const handleUserClick = (user: AdminUserProfile) => {
    setSelectedUser(user);
    setUserDetailsModalVisible(true);
  };

  const handleUserDetailsModalClose = () => {
    setUserDetailsModalVisible(false);
    setSelectedUser(null);
  };

  const handleUserDelete = (userId: string) => {
    setUsers((prev) => prev.filter((u) => u.userId !== userId));
    setUserDetailsModalVisible(false);
  };

  const handleUserUpdate = (userId: string, updatedUser: AdminUserProfile) => {
    console.log("handleUserUpdate called with userId:", userId);
    console.log("Updated user data:", updatedUser);

    // Update the user in the local state
    setUsers((prev) =>
      prev.map((user) => (user.userId === userId ? updatedUser : user))
    );
    // Also update the selected user to reflect changes in the modal
    setSelectedUser(updatedUser);

    console.log("User state updated");
  };

  const handleQRScan = async (userId: string) => {
    // Close the scanner first
    setQrScannerVisible(false);

    setLoadingQRUser(true);
    try {
      const result = await getUserById(userId);

      if (result.success && result.user) {
        setSelectedUser(result.user);
        setUserDetailsModalVisible(true);
      } else {
        showAlert(
          "User Not Found",
          result.error || "Could not find user with this QR code"
        );
      }
    } catch (error) {
      console.error("Error fetching user from QR:", error);
      showAlert("Error", "Failed to load user details. Please try again.");
    } finally {
      setLoadingQRUser(false);
    }
  };

  const renderEmptyState = () => {
    const hasFilters = hasActiveFilters(filters);

    return (
      <View
        className="items-center justify-center py-20"
        style={{ minHeight: 400 }}
      >
        <UsersIcon size={64} color="#6B7280" />
        <Text
          style={{ fontFamily: "Outfit_600SemiBold" }}
          className="text-[#2175C0] text-xl mt-4 text-center"
        >
          {hasFilters ? "No users found" : "Ready to search"}
        </Text>
        <Text
          style={{ fontFamily: "Outfit_400Regular" }}
          className="text-gray-500 text-center mt-2 px-8"
        >
          {hasFilters
            ? "Try adjusting your search term"
            : "Enter an email address to search for users"}
        </Text>

        {!hasFilters && (
          <View className="mt-6 bg-[#FFFFFF66] rounded-xl p-4 mx-8">
            <Text
              style={{ fontFamily: "Outfit_500Medium" }}
              className="text-[#2175C0] text-center text-sm"
            >
              💡 Email Search: Enter the exact email address to find users
              instantly!
            </Text>
          </View>
        )}
      </View>
    );
  };

  const cardBg = isDark ? "#1C1C20" : "#FFFFFF";
  const cardBorder = isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)";
  const textPrimary = isDark ? "#FFFFFF" : "#111827";
  const textSecondary = isDark ? "#9CA3AF" : "#6B7280";

  if (!hasAccess) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? "#131316" : "#E0E0E0", justifyContent: "center", alignItems: "center", padding: 24 }}>
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 20,
            padding: 24,
            alignItems: "center",
            maxWidth: 340,
            width: "100%",
            borderWidth: 1,
            borderColor: cardBorder,
          }}
        >
          <Text style={{ fontFamily: "Talina", fontSize: 20, color: textPrimary, marginBottom: 8, textAlign: "center" }}>
            Access Restricted
          </Text>
          <Text style={{ fontSize: 14, color: textSecondary, textAlign: "center", marginBottom: 20 }}>
            You do not have permission to access Users Management.
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("Dashboard")}
            style={{
              backgroundColor: "#A855F7",
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? "#131316" : "#E0E0E0" }}>
      {/* Header */}
      <View
        style={{
          paddingTop: Math.max(insets.top + 8, 16),
          paddingBottom: 16,
          paddingHorizontal: 20,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: cardBg,
          borderBottomWidth: 1,
          borderBottomColor: cardBorder,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.3 : 0.05,
          shadowRadius: 6,
          elevation: 4,
        }}
      >
        <TouchableOpacity
          onPress={() => navigation.navigate("Dashboard")}
          activeOpacity={0.7}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.06)",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
          }}
        >
          <ArrowLeft size={22} color={textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: "Talina",
              fontSize: 22,
              color: textPrimary,
              letterSpacing: 0.5,
            }}
          >
            Users Management
          </Text>
          <Text
            style={{
              fontFamily: "Poppins_400Regular",
              fontSize: 12,
              color: "#41B8F0",
              marginTop: 1,
            }}
          >
            {hasActiveFilters(filters)
              ? `${users.length} users loaded${
                  hasMore ? " (more available)" : ""
                }`
              : "Search and manage users"}
          </Text>
        </View>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={["#EEB170"]}
            tintColor="#EEB170"
          />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Search Bar */}
        <UserSearchBar
          searchTerm={filters.searchTerm}
          onSearchChange={(term) =>
            setFilters((prev) => ({ ...prev, searchTerm: term }))
          }
          loading={searchLoading}
        />

        {/* QR Scanner Button */}
        <View className="px-4 my-4">
          <TouchableOpacity
            onPress={() => setQrScannerVisible(true)}
            style={{
              backgroundColor: "#41B8F0",
              borderRadius: 16,
              padding: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
              elevation: 3,
            }}
            activeOpacity={0.75}
          >
            <QrCode size={22} color="#FFFFFF" />
            <Text
              style={{ fontFamily: "Poppins_600SemiBold", color: "#FFFFFF", fontSize: 15, marginLeft: 8 }}
            >
              Scan User QR Code
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Loading Indicator */}
        {searchLoading && (
          <View className="flex-row items-center justify-center py-4 mx-4">
            <ActivityIndicator size="small" color="#EEB170" />
            <Text
              style={{ fontFamily: "Outfit_500Medium" }}
              className="text-[#2175C0] ml-2"
            >
              {filters.searchTerm.trim()
                ? `Searching for "${filters.searchTerm.trim()}" in names, emails, and IDs...`
                : "Loading users..."}
            </Text>
          </View>
        )}

        {/* Short Search Term Message */}
        {filters.searchTerm.trim() !== "" &&
          filters.searchTerm.trim().length < 2 &&
          filters.campusFilter === "all" &&
          filters.ambassadorFilter === "all" && (
            <View className="mx-4 mb-4">
              <View className="bg-yellow-500/20 border border-yellow-500/30 rounded-xl p-4">
                <Text
                  style={{ fontFamily: "Outfit_500Medium" }}
                  className="text-yellow-400 text-center"
                >
                  Type at least 2 characters to search by name, email, or ID
                </Text>
              </View>
            </View>
          )}

        {/* Users List */}
        {users.length > 0 ? (
          <>
            {users.map((user) => (
              <UserCard
                key={user.userId}
                user={user}
                onUserUpdate={(updatedUser) => {
                  setUsers((prev) =>
                    prev.map((u) =>
                      u.userId === updatedUser.userId ? updatedUser : u
                    )
                  );
                }}
                onUserClick={handleUserClick}
              />
            ))}

            {/* End of results message */}
            {!hasMore && users.length > 0 && (
              <View className="px-4 py-4">
                <View className="bg-gray-500/20 border border-gray-500/30 rounded-xl p-3">
                  <Text
                    style={{ fontFamily: "Outfit_500Medium" }}
                    className="text-[#2175C0] text-center text-sm"
                  >
                    All {users.length} users loaded
                  </Text>
                </View>
              </View>
            )}
          </>
        ) : (
          !searchLoading && renderEmptyState()
        )}

        {/* Error State */}
        {error && (
          <View className="mx-4 mb-4">
            <View className="bg-red-500/20 border border-red-500/30 rounded-xl p-4">
              <Text
                style={{ fontFamily: "Outfit_500Medium" }}
                className="text-red-400 text-center"
              >
                {error}
              </Text>
              <TouchableOpacity
                onPress={() => loadUsers()}
                className="mt-2 bg-red-500 py-2 px-4 rounded-lg"
              >
                <Text
                  style={{ fontFamily: "Outfit_600SemiBold" }}
                  className="text-[#0C3572] text-center"
                >
                  Retry
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* User Details Modal */}
      <UserDetailsModal
        visible={userDetailsModalVisible}
        user={selectedUser}
        onClose={handleUserDetailsModalClose}
        onUserUpdate={handleUserUpdate}
        onUserDelete={handleUserDelete}
      />

      {/* QR Scanner Modal */}
      <UserQRScannerModal
        visible={qrScannerVisible}
        onClose={() => setQrScannerVisible(false)}
        onUserIdScanned={handleQRScan}
      />

      {/* Loading Overlay for QR User Fetch */}
      {loadingQRUser && (
        <View className="absolute inset-0 bg-black/70 items-center justify-center">
          <View className="bg-[#1A1A1A] rounded-2xl p-6">
            <ActivityIndicator size="large" color="#EEB170" />
            <Text
              style={{ fontFamily: "Outfit_500Medium" }}
              className="text-[#0C3572] text-center mt-4"
            >
              Loading user details...
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

export default Users;
