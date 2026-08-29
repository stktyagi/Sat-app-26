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

import { showAlert } from "@/components";

interface UsersProps {
  navigation: any;
}

const Users: React.FC<UsersProps> = ({ navigation }) => {
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

  return (
    <View className="flex-1 bg-transparent">
      {/* Header */}
      <View className="bg-[#EEB170] pt-4 rounded-b-2xl pb-6 px-6 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => navigation.navigate("Dashboard")}
          className="mr-4"
          activeOpacity={0.7}
        >
          <ArrowLeft size={28} color="#121212" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text
            style={{ fontFamily: "Outfit_700Bold" }}
            className="text-[#121212] text-2xl"
          >
            Users Management
          </Text>
          <Text
            style={{ fontFamily: "Outfit_500Medium" }}
            className="text-[#121212] text-sm opacity-80"
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
            className="bg-[#EEB170] rounded-xl p-4 flex-row items-center justify-center"
            activeOpacity={0.7}
          >
            <QrCode size={24} color="#121212" />
            <Text
              style={{ fontFamily: "Outfit_600SemiBold" }}
              className="text-[#121212] text-base ml-2"
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
