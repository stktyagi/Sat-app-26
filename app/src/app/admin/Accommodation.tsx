import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  TextInput,
} from "react-native";
import {
  ArrowLeft,
  Home,
  Utensils,
  Phone,
  Mail,
  ArrowDown,
  ArrowUp,
  CheckCircle,
  XCircle,
  Clock,
  Building,
  House,
  Search,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react-native";
import {
  fetchAccommodationStats,
  fetchIncomingUsers,
  fetchOutgoingUsers,
  clearAccommodationCache,
} from "@/api/admin";
import { useAdminNavigation } from "@/hooks/useAdminNavigation";
import type {
  AccommodationStats,
  UserAccommodation,
} from "@/api/admin";

interface DayMapping {
  date: number;
  backendDay: string;
  day: string;
}

const dayMappings: DayMapping[] = [
  { date: 18, backendDay: "00", day: "Tuesday" },
  { date: 19, backendDay: "0", day: "Wednesday" },
  { date: 20, backendDay: "1", day: "Thursday" },
  { date: 21, backendDay: "2", day: "Friday" },
  { date: 22, backendDay: "3", day: "Saturday" },
  { date: 23, backendDay: "4", day: "Sunday" },
];

const Accommodation: React.FC = () => {
  const navigation = useAdminNavigation();
  const [selectedTab, setSelectedTab] = useState<"incoming" | "outgoing">(
    "incoming"
  );
  const [selectedDate, setSelectedDate] = useState<string>("00");
  const [stats, setStats] = useState<AccommodationStats[]>([]);
  const [users, setUsers] = useState<UserAccommodation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingFromCache, setLoadingFromCache] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState<"normal" | "hostel">("normal");

  useEffect(() => {
    loadStats();
    console.log("Fetching accommodation stats");
  }, []);

  useEffect(() => {
    loadUsers();
  }, [selectedDate, selectedTab]);

  const loadStats = async (forceRefresh: boolean = false) => {
    try {
      const data = await fetchAccommodationStats(forceRefresh);
      setStats(data);
      setError(null);
    } catch (err) {
      setError("Failed to load accommodation statistics");
      console.error(err);
    }
  };

  const loadUsers = async (forceRefresh: boolean = false) => {
    // Only show loading on initial load or force refresh
    if (forceRefresh || users.length === 0) {
      setLoading(true);
    } else {
      // Show subtle cache loading indicator
      setLoadingFromCache(true);
    }

    try {
      const data =
        selectedTab === "incoming"
          ? await fetchIncomingUsers(selectedDate, forceRefresh)
          : await fetchOutgoingUsers(selectedDate, forceRefresh);
      setUsers(data);
      setError(null);
    } catch (err) {
      setError("Failed to load user data");
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingFromCache(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // Clear cache and force refresh
    clearAccommodationCache();
    await Promise.all([loadStats(true), loadUsers(true)]);
    setRefreshing(false);
  };

  // Memoize stats lookup for better performance
  const statsLookup = useMemo(() => {
    return stats.reduce((acc, stat) => {
      acc[stat.backendDay] = stat;
      return acc;
    }, {} as Record<string, AccommodationStats>);
  }, [stats]);

  const getStatsForDay = (backendDay: string) => {
    return (
      statsLookup[backendDay] || {
        accommodationCount: 0,
        foodCount: 0,
        date: "",
        backendDay,
      }
    );
  };

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) {
      return users;
    }

    const escapeRegExp = (s: string) =>
      s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const raw = searchQuery.trim();
    if (!raw) return users;

    const lower = raw.toLowerCase();

    // Hostel-specific search mode
    if (searchMode === "hostel") {
      if (!raw) return users;

      const hostelRegex = new RegExp(`^${escapeRegExp(raw)}`, "i");

      return users.filter((user) => {
        const hostel = user.checkInStatus?.Hostel ?? "";
        if (!hostel) return false;
        const firstPart = hostel.split("-")[0] ?? "";
        return hostelRegex.test(firstPart);
      });
    }

    // Normal search mode - search across all fields
    const query = lower;
    const queryDigits = query.replace(/\D/g, "");

    return users.filter((user) => {
      const name = user.displayName?.toLowerCase() ?? "";
      const college = user.collegeName?.toLowerCase() ?? "";
      const email = user.email?.toLowerCase() ?? "";
      const phone = (user.phoneNumber ?? "").replace(/\D/g, "");
      const hostelFull = (user.checkInStatus?.Hostel ?? "").toLowerCase();

      const phoneMatches =
        queryDigits.length > 0 ? phone.includes(queryDigits) : false;

      return (
        name.includes(query) ||
        college.includes(query) ||
        email.includes(query) ||
        phoneMatches ||
        hostelFull.includes(query)
      );
    });
  }, [users, searchQuery, searchMode]);

  const renderDayCell = ({ item: day }: { item: DayMapping }) => {
    const dayStats = getStatsForDay(day.backendDay);
    const isSelected = selectedDate === day.backendDay;

    return (
      <TouchableOpacity
        className={`p-3 mx-2 mt-1 mb-0 rounded-xl min-w-[85px] items-center ${
          isSelected ? "bg-[#EEB170]" : "bg-[#FFFFFF66]"
        }`}
        onPress={() => setSelectedDate(day.backendDay)}
        activeOpacity={0.7}
      >
        <Text
          style={{ fontFamily: "Outfit_700Bold" }}
          className={`text-base ${isSelected ? "text-black" : "text-[#0C3572]"}`}
        >
          {`${day.date} Nov`}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderUserItem = ({ item: user }: { item: UserAccommodation }) => {
    const isExpanded = expandedUserId === user.userId;

    return (
      <TouchableOpacity
        className="bg-[#FFFFFF66] rounded-xl p-4 mx-4 mb-3"
        onPress={() => setExpandedUserId(isExpanded ? null : user.userId)}
        activeOpacity={0.7}
      >
        {/* Collapsed View - Name and Email */}
        <View className="flex-row justify-between items-center">
          <View className="flex-1">
            <Text
              style={{ fontFamily: "Outfit_700Bold" }}
              className="text-[#0C3572] text-base"
            >
              {user.displayName}
            </Text>
            <View className="flex-row items-center mt-1">
              <Building size={12} color="#9CA3AF" />
              <Text
                style={{ fontFamily: "Outfit_500Medium" }}
                className="text-[#2175C0] text-xs ml-2 flex-1"
                numberOfLines={1}
              >
                {user.collegeName}
              </Text>
            </View>
          </View>
          {isExpanded ? (
            <ChevronUp size={20} color="#EEB170" />
          ) : (
            <ChevronDown size={20} color="#9CA3AF" />
          )}
        </View>

        {/* Expanded View - All Details */}
        {isExpanded && (
          <View className="mt-4 pt-4 border-t border-[#A0B3D0]">
            {/* College and Contact Info */}
            <View className="flex-col gap-2 mb-4">
              <View className="flex-row items-center">
                <Mail size={14} color="#9CA3AF" />
                <Text
                  style={{ fontFamily: "Outfit_500Medium" }}
                  className="text-[#2175C0] text-sm ml-2 flex-1"
                  numberOfLines={2}
                >
                  {user.email}
                </Text>
              </View>

              <View className="flex-row items-center">
                <Phone size={14} color="#9CA3AF" />
                <Text
                  style={{ fontFamily: "Outfit_500Medium" }}
                  className="text-[#2175C0] text-sm ml-2"
                >
                  {user.phoneNumber}
                </Text>
              </View>

              {user.checkInStatus.Hostel && (
                <View className="flex-row items-center">
                  <House size={14} color="#9CA3AF" />
                  <Text
                    style={{ fontFamily: "Outfit_500Medium" }}
                    className="text-[#0C3572] text-sm ml-2"
                  >
                    Hostel Alloted - {user.checkInStatus.Hostel}
                  </Text>
                </View>
              )}
            </View>

            {/* Status Badges */}
            <View className="flex-row gap-2 mb-4">
              {user.isHostCollegeStudent && (
                <View className="bg-blue-500/20 px-3 py-1.5 rounded-full flex-row items-center">
                  <Building size={12} color="#3B82F6" />
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className="text-blue-400 text-xs ml-1"
                  >
                    Host College
                  </Text>
                </View>
              )}
              {user.accommodationNeeded && (
                <View className="bg-green-500/20 px-3 py-1.5 rounded-full flex-row items-center">
                  <Home size={12} color="#10B981" />
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className="text-green-400 text-xs ml-1"
                  >
                    Needs Stay
                  </Text>
                </View>
              )}
            </View>

            {/* Status Row */}
            <View className="flex-col gap-3 pt-3 border-t border-gray-700">
              <View className="flex-row justify-between">
                <View className="flex-row items-center">
                  <Home size={14} color="#9CA3AF" />
                  <Text
                    style={{ fontFamily: "Outfit_500Medium" }}
                    className="text-[#2175C0] text-xs ml-1 mr-2"
                  >
                    Stay:
                  </Text>
                  {user.accommodationStatus ? (
                    <CheckCircle size={14} color="#10B981" />
                  ) : (
                    <XCircle size={14} color="#EF4444" />
                  )}
                  <Text
                    style={{ fontFamily: "Outfit_500Medium" }}
                    className={`text-xs ml-1 ${
                      user.accommodationStatus ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {user.accommodationStatus ? "Booked" : "Not Booked"}
                  </Text>
                </View>

                <View className="flex-row items-center">
                  <Utensils size={14} color="#9CA3AF" />
                  <Text
                    style={{ fontFamily: "Outfit_500Medium" }}
                    className="text-[#2175C0] text-xs ml-1 mr-2"
                  >
                    Food:
                  </Text>
                  {user.foodStatus ? (
                    <CheckCircle size={14} color="#10B981" />
                  ) : (
                    <XCircle size={14} color="#EF4444" />
                  )}
                  <Text
                    style={{ fontFamily: "Outfit_500Medium" }}
                    className={`text-xs ml-1 ${
                      user.foodStatus ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {user.foodStatus ? "Booked" : "Not Booked"}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center">
                <Clock size={14} color="#9CA3AF" />
                <Text
                  style={{ fontFamily: "Outfit_500Medium" }}
                  className="text-[#2175C0] text-xs ml-1 mr-2"
                >
                  Check-in:
                </Text>
                {user.checkInStatus.accommodation ? (
                  <CheckCircle size={14} color="#10B981" />
                ) : (
                  <Clock size={14} color="#F59E0B" />
                )}
                <Text
                  style={{ fontFamily: "Outfit_500Medium" }}
                  className={`text-xs ml-1 ${
                    user.checkInStatus.accommodation
                      ? "text-green-400"
                      : "text-yellow-400"
                  }`}
                >
                  {user.checkInStatus.accommodation ? "Done" : "Pending"}
                </Text>
              </View>
            </View>
          </View>
        )}
      </TouchableOpacity>
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
            Accommodation
          </Text>
          <Text
            style={{ fontFamily: "Outfit_500Medium" }}
            className="text-[#121212] text-sm opacity-80"
          >
            {filteredUsers.length > 0
              ? `${filteredUsers.length} ${selectedTab} users for ${
                  dayMappings.find((d) => d.backendDay === selectedDate)?.day ||
                  "selected day"
                }`
              : "Track arrivals and departures"}
          </Text>
        </View>
      </View>

      {/* Calendar Strip */}
      <View className="bg-transparent pb-2 pt-4">
        <FlatList
          horizontal
          data={dayMappings}
          renderItem={renderDayCell}
          keyExtractor={(day) => day.backendDay}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 8 }}
        />
      </View>

      {/* Tab Buttons */}
      <View className="flex-row p-4 bg-transparent">
        <TouchableOpacity
          className={`flex-1 py-3 rounded-xl mx-1 items-center ${
            selectedTab === "incoming" ? "bg-[#EEB170]" : "bg-[#FFFFFF66]"
          }`}
          onPress={() => setSelectedTab("incoming")}
          activeOpacity={0.7}
        >
          <View className="flex-row items-center">
            <ArrowDown
              size={16}
              color={selectedTab === "incoming" ? "#121212" : "#9CA3AF"}
            />
            <Text
              style={{ fontFamily: "Outfit_600SemiBold" }}
              className={`text-base ml-2 ${
                selectedTab === "incoming" ? "text-black" : "text-[#2175C0]"
              }`}
            >
              Incoming
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 py-3 rounded-xl mx-1 items-center ${
            selectedTab === "outgoing" ? "bg-[#EEB170]" : "bg-[#FFFFFF66]"
          }`}
          onPress={() => setSelectedTab("outgoing")}
          activeOpacity={0.7}
        >
          <View className="flex-row items-center">
            <ArrowUp
              size={16}
              color={selectedTab === "outgoing" ? "#121212" : "#9CA3AF"}
            />
            <Text
              style={{ fontFamily: "Outfit_600SemiBold" }}
              className={`text-base ml-2 ${
                selectedTab === "outgoing" ? "text-black" : "text-[#2175C0]"
              }`}
            >
              Outgoing
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View className="px-4 pb-3 bg-transparent">
         <View className="flex-row mb-3 gap-2">
          <TouchableOpacity
            className={`flex-1 py-2.5 rounded-lg items-center ${
              searchMode === "normal" ? "bg-[#EEB170]" : "bg-[#FFFFFF66]"
            }`}
            onPress={() => setSearchMode("normal")}
            activeOpacity={0.7}
          >
            <Text
              style={{ fontFamily: "Outfit_600SemiBold" }}
              className={`text-sm ${
                searchMode === "normal" ? "text-black" : "text-[#2175C0]"
              }`}
            >
              Normal Search
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-2.5 rounded-lg items-center flex-row justify-center ${
              searchMode === "hostel" ? "bg-[#EEB170]" : "bg-[#FFFFFF66]"
            }`}
            onPress={() => setSearchMode("hostel")}
            activeOpacity={0.7}
          >
            <House
              size={14}
              color={searchMode === "hostel" ? "#121212" : "#9CA3AF"}
            />
            <Text
              style={{ fontFamily: "Outfit_600SemiBold" }}
              className={`text-sm ml-1.5 ${
                searchMode === "hostel" ? "text-black" : "text-[#2175C0]"
              }`}
            >
              Hostel Search
            </Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row items-center bg-[#FFFFFF66] rounded-xl px-4 py-1">
          <Search size={20} color="#9CA3AF" />
          <TextInput
            style={{ fontFamily: "Outfit_500Medium" }}
            className="flex-1 text-[#0C3572] text-base ml-3"
            placeholder={
              searchMode === "hostel"
                ? "Search by hostel (e.g., M, F, D)..."
                : "Search by name, college, email, phone..."
            }
            placeholderTextColor="#6B7280"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              activeOpacity={0.7}
              className="ml-2"
            >
              <X size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
        {searchQuery.length > 0 && (
          <Text
            style={{ fontFamily: "Outfit_400Regular" }}
            className="text-[#2175C0] text-xs mt-2 ml-1"
          >
            {filteredUsers.length === 0
              ? "No results found"
              : `Found ${filteredUsers.length} result${
                  filteredUsers.length === 1 ? "" : "s"
                }`}
          </Text>
        )}
      </View>

      {/* Error Message */}
      {error && (
        <View className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 mx-4 mb-4">
          <View className="flex-row items-center justify-center">
            <XCircle size={20} color="#EF4444" />
            <Text
              style={{ fontFamily: "Outfit_500Medium" }}
              className="text-red-400 text-center ml-2"
            >
              {error}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onRefresh}
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
      )}

      {/* Users List */}
      {loading ? (
        <View className="flex-1 justify-center items-center py-20">
          <ActivityIndicator size="large" color="#EEB170" />
          <Text
            style={{ fontFamily: "Outfit_500Medium" }}
            className="text-[#2175C0] mt-4 text-center"
          >
            Loading {selectedTab} users...
          </Text>
          <Text
            style={{ fontFamily: "Outfit_400Regular" }}
            className="text-gray-500 text-sm text-center mt-2"
          >
            Please wait while we fetch the data
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          renderItem={renderUserItem}
          keyExtractor={(user) => user.userId}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#EEB170"]}
              tintColor="#EEB170"
            />
          }
          ListEmptyComponent={() => (
            <View
              className="items-center justify-center py-20"
              style={{ minHeight: 300 }}
            >
              {selectedTab === "incoming" ? (
                <ArrowDown size={48} color="#6B7280" />
              ) : (
                <ArrowUp size={48} color="#6B7280" />
              )}
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className="text-[#2175C0] text-xl mt-4 text-center"
              >
                No {selectedTab} users found
              </Text>
              <Text
                style={{ fontFamily: "Outfit_400Regular" }}
                className="text-gray-500 text-center mt-2 px-8"
              >
                {selectedTab === "incoming"
                  ? "No users starting accommodation on this day"
                  : "No users ending accommodation on this day"}
              </Text>

              <View className="mt-6 bg-[#FFFFFF66] rounded-xl p-4 mx-8">
                <Text
                  style={{ fontFamily: "Outfit_500Medium" }}
                  className="text-[#2175C0] text-center text-sm"
                >
                  💡 Tip: Try selecting a different date or check the other tab
                  for user activity
                </Text>
              </View>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

export default Accommodation;
