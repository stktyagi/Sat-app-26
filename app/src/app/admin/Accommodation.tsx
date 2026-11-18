import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  TextInput,
  StatusBar,
  Alert,
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
  LogOut,
  Undo2,
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
  updateAccommodationCheckIn,
  allotHostel,
  clearAccommodationCache,
} from "@/api/admin";
import { useAdminNavigation } from "@/hooks/useAdminNavigation";
import { useThemeStore } from "@/state/themeStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HostelPickerModal } from "@/components/admin/HostelPickerModal";
import { formatHostelDisplay, matchHostelSearch } from "@/data/hostels";
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
  { date: 19, backendDay: "0", day: "Wednesday" },
  { date: 20, backendDay: "1", day: "Thursday" },
  { date: 21, backendDay: "2", day: "Friday" },
  { date: 22, backendDay: "3", day: "Saturday" },
  { date: 23, backendDay: "4", day: "Sunday" },
  { date: 24, backendDay: "5", day: "Monday" },
];

const DAY_DATE_LABELS: Record<string, string> = {
  day0: "19 Nov",
  day1: "20 Nov",
  day2: "21 Nov",
  day3: "22 Nov",
  day4: "23 Nov",
};

const CHECKOUT_DATE_LABELS: Record<string, string> = {
  day0: "20 Nov",
  day1: "21 Nov",
  day2: "22 Nov",
  day3: "23 Nov",
  day4: "24 Nov",
};

function formatStaySummary(acc?: Record<string, boolean>): string {
  if (!acc) return "No dates booked";
  const bookedDays = ["day0", "day1", "day2", "day3", "day4"].filter((k) => acc[k]);
  if (bookedDays.length === 0) return "No dates booked";
  const first = DAY_DATE_LABELS[bookedDays[0]];
  const last = DAY_DATE_LABELS[bookedDays[bookedDays.length - 1]];
  if (bookedDays.length === 1) {
    return first;
  }
  return first + " - " + last;
}

function getCheckoutDate(acc?: Record<string, boolean>): string | null {
  if (!acc) return null;
  const bookedDays = ["day0", "day1", "day2", "day3", "day4"].filter((k) => acc[k]);
  if (bookedDays.length === 0) return null;
  const last = bookedDays[bookedDays.length - 1];
  return CHECKOUT_DATE_LABELS[last] || null;
}

const Accommodation: React.FC = () => {
  const navigation = useAdminNavigation();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();

  const [selectedTab, setSelectedTab] = useState<"incoming" | "outgoing">(
    "incoming"
  );
  const [selectedDate, setSelectedDate] = useState<string>("0");
  const [stats, setStats] = useState<AccommodationStats[]>([]);
  const [users, setUsers] = useState<UserAccommodation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingFromCache, setLoadingFromCache] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState<"normal" | "hostel">("normal");
  const [editingHostelUser, setEditingHostelUser] = useState<{ [userId: string]: string }>({});
  const [editingRoomUser, setEditingRoomUser] = useState<{ [userId: string]: string }>({});
  const [activeHostelPickerUserId, setActiveHostelPickerUserId] = useState<string | null>(null);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);

  const bgColor = isDark ? "#131316" : "#E0E0E0";
  const cardBg = isDark ? "#1C1C20" : "#FFFFFF";
  const cardBorder = isDark ? "#2A2A30" : "#D5D5D5";
  const textPrimary = isDark ? "#FFFFFF" : "#111827";
  const textSecondary = isDark ? "#A0A0A0" : "#6B7280";

  const currentDayStats = useMemo(() => {
    const idx = Number(selectedDate);
    if (stats && stats[idx]) {
      return stats[idx];
    }
    return { total: 0, checkedIn: 0, checkedOut: 0, pending: 0 };
  }, [stats, selectedDate]);

  const handleCheckIn = async (user: UserAccommodation) => {
    const hostelToSave =
      editingHostelUser[user.userId] !== undefined
        ? editingHostelUser[user.userId]
        : user.checkInStatus?.Hostel || "";
    const roomToSave =
      editingRoomUser[user.userId] !== undefined
        ? editingRoomUser[user.userId]
        : user.checkInStatus?.RoomNo || "";

    try {
      setUpdatingUser(user.userId);
      await updateAccommodationCheckIn(user.userId, true, hostelToSave, roomToSave, 'checkin');

      setUsers((prev) =>
        prev.map((u) => {
          if (u.userId === user.userId) {
            return {
              ...u,
              checkInStatus: {
                ...u.checkInStatus,
                accommodation: true,
                checkedOut: false,
                checkedOutAt: null,
                Hostel: hostelToSave,
                RoomNo: roomToSave,
              },
            };
          }
          return u;
        })
      );
      loadStats(true);
      Alert.alert("Success", `${user.displayName} marked as Checked In.`);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update accommodation check-in");
    } finally {
      setUpdatingUser(null);
    }
  };

  const handleCheckOut = (user: UserAccommodation) => {
    Alert.alert(
      "Confirm Check-Out",
      `Are you sure you want to check out ${user.displayName} from ${formatHostelDisplay(user.checkInStatus?.Hostel, user.checkInStatus?.RoomNo) || "hostel"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Check Out",
          style: "destructive",
          onPress: async () => {
            try {
              setUpdatingUser(user.userId);
              await updateAccommodationCheckIn(user.userId, true, undefined, undefined, 'checkout');

              setUsers((prev) =>
                prev.map((u) => {
                  if (u.userId === user.userId) {
                    return {
                      ...u,
                      checkInStatus: {
                        ...u.checkInStatus,
                        accommodation: true,
                        checkedOut: true,
                        checkedOutAt: new Date().toISOString(),
                      },
                    };
                  }
                  return u;
                })
              );
              loadStats(true);
              Alert.alert("Checked Out", `${user.displayName} has been checked out successfully.`);
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to check out user");
            } finally {
              setUpdatingUser(null);
            }
          },
        },
      ]
    );
  };

  const handleUndoCheckOut = (user: UserAccommodation) => {
    Alert.alert(
      "Undo Check-Out",
      `Restore ${user.displayName}'s status to Checked In?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore Check-In",
          onPress: async () => {
            try {
              setUpdatingUser(user.userId);
              await updateAccommodationCheckIn(user.userId, true, undefined, undefined, 'undo_checkout');

              setUsers((prev) =>
                prev.map((u) => {
                  if (u.userId === user.userId) {
                    return {
                      ...u,
                      checkInStatus: {
                        ...u.checkInStatus,
                        accommodation: true,
                        checkedOut: false,
                        checkedOutAt: null,
                      },
                    };
                  }
                  return u;
                })
              );
              loadStats(true);
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to undo check-out");
            } finally {
              setUpdatingUser(null);
            }
          },
        },
      ]
    );
  };

  const handleUndoCheckIn = (user: UserAccommodation) => {
    Alert.alert(
      "Undo Check-In",
      `Revert ${user.displayName}'s status back to Pending? This will clear their hostel check-in and room allotment.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Undo Check-In",
          style: "destructive",
          onPress: async () => {
            try {
              setUpdatingUser(user.userId);
              await updateAccommodationCheckIn(user.userId, false, "", "", 'revert');

              setUsers((prev) =>
                prev.map((u) => {
                  if (u.userId === user.userId) {
                    return {
                      ...u,
                      checkInStatus: {
                        ...u.checkInStatus,
                        accommodation: false,
                        checkedOut: false,
                        checkedOutAt: null,
                        Hostel: null,
                        RoomNo: null,
                      },
                    };
                  }
                  return u;
                })
              );
              loadStats(true);
              Alert.alert("Undone", `${user.displayName}'s check-in has been reverted to Pending.`);
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to undo check-in");
            } finally {
              setUpdatingUser(null);
            }
          },
        },
      ]
    );
  };

  const handleSaveHostel = async (user: UserAccommodation) => {
    const hostelToSave =
      editingHostelUser[user.userId] !== undefined
        ? editingHostelUser[user.userId]
        : user.checkInStatus?.Hostel || "";
    const roomToSave =
      editingRoomUser[user.userId] !== undefined
        ? editingRoomUser[user.userId]
        : user.checkInStatus?.RoomNo || "";

    try {
      setUpdatingUser(user.userId);
      // A changed hostel goes through the desk allotment so the per-hostel
      // counters move; a room-only change is a plain field update.
      if (hostelToSave && hostelToSave !== (user.checkInStatus?.Hostel || "")) {
        const res = await allotHostel(user.userId, hostelToSave, roomToSave);
        if (!res.success) throw new Error(res.error || "Failed to allot hostel");
      } else {
        await updateAccommodationCheckIn(user.userId, true, undefined, roomToSave, "items");
      }

      setUsers((prev) =>
        prev.map((u) => {
          if (u.userId === user.userId) {
            return {
              ...u,
              checkInStatus: {
                ...u.checkInStatus,
                Hostel: hostelToSave,
                RoomNo: roomToSave,
              },
            };
          }
          return u;
        })
      );
      Alert.alert("Success", "Hostel & Room allotment updated successfully");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update hostel allotment");
    } finally {
      setUpdatingUser(null);
    }
  };

  useEffect(() => {
    loadStats();
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
    if (forceRefresh || users.length === 0) {
      setLoading(true);
    } else {
      setLoadingFromCache(true);
    }

    try {
      let data: UserAccommodation[];
      if (selectedTab === "incoming") {
        data = await fetchIncomingUsers(selectedDate, forceRefresh);
      } else {
        data = await fetchOutgoingUsers(selectedDate, forceRefresh);
      }
      setUsers(data);
      setError(null);
    } catch (err) {
      setError(`Failed to load ${selectedTab} users`);
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingFromCache(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    clearAccommodationCache();
    await Promise.all([loadStats(true), loadUsers(true)]);
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) {
      return users;
    }

    const query = searchQuery.toLowerCase().trim();

    if (searchMode === "hostel") {
      return users.filter((user) => {
        const hostel = user.checkInStatus?.Hostel || "";
        const roomNo = user.checkInStatus?.RoomNo || "";
        return matchHostelSearch(hostel, roomNo, query);
      });
    }

    return users.filter((user) => {
      const name = user.displayName?.toLowerCase() || "";
      const college = user.collegeName?.toLowerCase() || "";
      const email = user.email?.toLowerCase() || "";
      const phone = user.phoneNumber?.toLowerCase() || "";
      const hostel = user.checkInStatus?.Hostel || "";
      const roomNo = user.checkInStatus?.RoomNo || "";

      return (
        name.includes(query) ||
        college.includes(query) ||
        email.includes(query) ||
        phone.includes(query) ||
        matchHostelSearch(hostel, roomNo, query)
      );
    });
  }, [users, searchQuery, searchMode]);

  const renderDayCell = ({ item: day }: { item: DayMapping }) => {
    const isSelected = selectedDate === day.backendDay;

    return (
      <TouchableOpacity
        style={{
          paddingVertical: 10,
          paddingHorizontal: 14,
          marginHorizontal: 4,
          borderRadius: 14,
          alignItems: "center",
          backgroundColor: isSelected ? "#41B8F0" : cardBg,
          borderWidth: 1,
          borderColor: isSelected ? "#41B8F0" : cardBorder,
        }}
        onPress={() => setSelectedDate(day.backendDay)}
        activeOpacity={0.7}
      >
        <Text
          style={{
            fontFamily: "Poppins_600SemiBold",
            fontSize: 13,
            color: isSelected ? "#FFFFFF" : textPrimary,
          }}
        >
          {`${day.date} Nov`}
        </Text>
        <Text
          style={{
            fontFamily: "Poppins_400Regular",
            fontSize: 10,
            color: isSelected ? "rgba(255, 255, 255, 0.85)" : textSecondary,
            marginTop: 1,
          }}
        >
          {day.day.slice(0, 3)}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderUserItem = ({ item: user }: { item: UserAccommodation }) => {
    const isExpanded = expandedUserId === user.userId;

    return (
      <TouchableOpacity
        style={{
          backgroundColor: cardBg,
          borderRadius: 18,
          padding: 16,
          marginHorizontal: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: cardBorder,
        }}
        onPress={() => setExpandedUserId(isExpanded ? null : user.userId)}
        activeOpacity={0.75}
      >
        {/* Collapsed View */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text
              style={{
                fontFamily: "Poppins_600SemiBold",
                color: textPrimary,
                fontSize: 15,
              }}
            >
              {user.displayName}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 3 }}>
              <Building size={12} color="#41B8F0" />
              <Text
                style={{
                  fontFamily: "Poppins_400Regular",
                  color: textSecondary,
                  fontSize: 12,
                  marginLeft: 5,
                  flex: 1,
                }}
                numberOfLines={1}
              >
                {user.collegeName}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
                backgroundColor: user.checkInStatus?.checkedOut
                  ? "rgba(168, 85, 247, 0.15)"
                  : user.checkInStatus?.accommodation
                  ? (selectedTab === "outgoing" ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)")
                  : "rgba(245, 158, 11, 0.15)",
                borderWidth: selectedTab === "outgoing" && user.checkInStatus?.accommodation && !user.checkInStatus?.checkedOut ? 1 : 0,
                borderColor: "rgba(239, 68, 68, 0.4)",
              }}
            >
              <Text
                style={{
                  fontFamily: "Poppins_600SemiBold",
                  fontSize: 10,
                  color: user.checkInStatus?.checkedOut
                    ? "#A855F7"
                    : user.checkInStatus?.accommodation
                    ? (selectedTab === "outgoing" ? "#EF4444" : "#10B981")
                    : "#F59E0B",
                }}
              >
                {user.checkInStatus?.checkedOut
                  ? "Checked Out"
                  : user.checkInStatus?.accommodation
                  ? (selectedTab === "outgoing" ? "Needs Checkout" : "Checked In")
                  : "Pending"}
              </Text>
            </View>
            {isExpanded ? (
              <ChevronUp size={20} color="#41B8F0" />
            ) : (
              <ChevronDown size={20} color={textSecondary} />
            )}
          </View>
        </View>

        {/* Expanded View */}
        {isExpanded && (
          <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: cardBorder }}>
            {/* Contact Details */}
            <View style={{ gap: 6, marginBottom: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Mail size={13} color="#41B8F0" />
                <Text
                  style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 12, marginLeft: 6, flex: 1 }}
                  numberOfLines={1}
                >
                  {user.email}
                </Text>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Phone size={13} color="#41B8F0" />
                <Text
                  style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 12, marginLeft: 6 }}
                >
                  {user.phoneNumber}
                </Text>
              </View>

              {(user.checkInStatus?.Hostel || user.checkInStatus?.RoomNo) && (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <House size={13} color="#41B8F0" />
                  <Text
                    style={{ fontFamily: "Poppins_500Medium", color: textPrimary, fontSize: 12, marginLeft: 6 }}
                  >
                    Allotted: {formatHostelDisplay(user.checkInStatus.Hostel, user.checkInStatus.RoomNo)}
                  </Text>
                </View>
              )}
            </View>

            {/* Booked Stay & Checkout Information */}
            <View
              style={{
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.03)",
                borderRadius: 12,
                padding: 12,
                marginBottom: 10,
                gap: 6,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 12, color: textSecondary }}>
                  Booked Stay:
                </Text>
                <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 12, color: textPrimary }}>
                  {formatStaySummary(user.accommodation)}
                </Text>
              </View>
              {getCheckoutDate(user.accommodation) && (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 12, color: textSecondary }}>
                    Departure / Checkout:
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <LogOut size={12} color={selectedTab === "outgoing" ? "#EF4444" : "#41B8F0"} style={{ marginRight: 4 }} />
                    <Text
                      style={{
                        fontFamily: "Poppins_600SemiBold",
                        fontSize: 12,
                        color: selectedTab === "outgoing" ? "#EF4444" : "#41B8F0",
                      }}
                    >
                      {getCheckoutDate(user.accommodation)} {selectedTab === "outgoing" ? "(Today)" : ""}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Status Row */}
            <View
              style={{
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.03)",
                borderRadius: 12,
                padding: 12,
                gap: 8,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Home size={13} color={textSecondary} />
                  <Text style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 12, marginLeft: 5, marginRight: 6 }}>
                    Stay:
                  </Text>
                  {user.accommodationStatus ? (
                    <CheckCircle size={13} color="#10B981" />
                  ) : (
                    <XCircle size={13} color="#EF4444" />
                  )}
                  <Text
                    style={{
                      fontFamily: "Poppins_600SemiBold",
                      fontSize: 12,
                      marginLeft: 4,
                      color: user.accommodationStatus ? "#10B981" : "#EF4444",
                    }}
                  >
                    {user.accommodationStatus ? "Booked" : "Not Booked"}
                  </Text>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Utensils size={13} color={textSecondary} />
                  <Text style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 12, marginLeft: 5, marginRight: 6 }}>
                    Food:
                  </Text>
                  {user.foodStatus ? (
                    <CheckCircle size={13} color="#10B981" />
                  ) : (
                    <XCircle size={13} color="#EF4444" />
                  )}
                  <Text
                    style={{
                      fontFamily: "Poppins_600SemiBold",
                      fontSize: 12,
                      marginLeft: 4,
                      color: user.foodStatus ? "#10B981" : "#EF4444",
                    }}
                  >
                    {user.foodStatus ? "Booked" : "Not Booked"}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Clock size={13} color={textSecondary} />
                <Text style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 12, marginLeft: 5, marginRight: 6 }}>
                  Status:
                </Text>
                {user.checkInStatus?.checkedOut ? (
                  <>
                    <LogOut size={13} color="#A855F7" />
                    <Text
                      style={{
                        fontFamily: "Poppins_600SemiBold",
                        fontSize: 12,
                        marginLeft: 4,
                        color: "#A855F7",
                      }}
                    >
                      Checked Out
                    </Text>
                  </>
                ) : user.checkInStatus?.accommodation ? (
                  <>
                    <CheckCircle size={13} color="#10B981" />
                    <Text
                      style={{
                        fontFamily: "Poppins_600SemiBold",
                        fontSize: 12,
                        marginLeft: 4,
                        color: "#10B981",
                      }}
                    >
                      Checked In
                    </Text>
                  </>
                ) : (
                  <>
                    <Clock size={13} color="#F59E0B" />
                    <Text
                      style={{
                        fontFamily: "Poppins_600SemiBold",
                        fontSize: 12,
                        marginLeft: 4,
                        color: "#F59E0B",
                      }}
                    >
                      Pending
                    </Text>
                  </>
                )}
              </View>
            </View>

            {/* Hostel & Room Allotment Section */}
            <View style={{ marginTop: 14, marginBottom: 12 }}>
              <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 12, color: textPrimary, marginBottom: 6 }}>
                Hostel & Room Allotment:
              </Text>
              <View style={{ gap: 8 }}>
                {/* Hostel Dropdown Trigger */}
                <TouchableOpacity
                  onPress={() => setActiveHostelPickerUserId(user.userId)}
                  style={{
                    backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)",
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    borderWidth: 1,
                    borderColor: (editingHostelUser[user.userId] !== undefined ? editingHostelUser[user.userId] : user.checkInStatus?.Hostel) ? "#41B8F0" : cardBorder,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text
                      style={{
                        fontFamily: "Poppins_500Medium",
                        fontSize: 12,
                        color: (editingHostelUser[user.userId] !== undefined ? editingHostelUser[user.userId] : user.checkInStatus?.Hostel) ? textPrimary : textSecondary,
                      }}
                      numberOfLines={1}
                    >
                      {formatHostelDisplay(
                        editingHostelUser[user.userId] !== undefined
                          ? editingHostelUser[user.userId]
                          : user.checkInStatus?.Hostel || ""
                      ) || "Select Hostel..."}
                    </Text>
                  </View>
                  <ChevronDown size={15} color={textSecondary} />
                </TouchableOpacity>

                {/* Room No Input + Save Button */}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TextInput
                    style={{
                      flex: 1,
                      backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)",
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      fontSize: 12,
                      fontFamily: "Poppins_400Regular",
                      color: textPrimary,
                      borderWidth: 1,
                      borderColor: cardBorder,
                    }}
                    placeholder="Room No (e.g. 102, B-204)"
                    placeholderTextColor={textSecondary}
                    value={
                      editingRoomUser[user.userId] !== undefined
                        ? editingRoomUser[user.userId]
                        : user.checkInStatus?.RoomNo || ""
                    }
                    onChangeText={(text) =>
                      setEditingRoomUser((prev) => ({ ...prev, [user.userId]: text }))
                    }
                    autoCapitalize="characters"
                  />
                  <TouchableOpacity
                    disabled={updatingUser === user.userId}
                    onPress={() => handleSaveHostel(user)}
                    style={{
                      backgroundColor: "#41B8F0",
                      borderRadius: 10,
                      paddingHorizontal: 14,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 12, color: "#FFFFFF" }}>
                      Save
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Check-In & Check-Out Action Buttons */}
            {user.checkInStatus?.checkedOut ? (
              <View style={{ gap: 8 }}>
                <View
                  style={{
                    backgroundColor: "rgba(168, 85, 247, 0.15)",
                    borderColor: "#A855F7",
                    borderWidth: 1,
                    borderRadius: 12,
                    paddingVertical: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                  }}
                >
                  <LogOut size={15} color="#A855F7" style={{ marginRight: 6 }} />
                  <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 13, color: "#A855F7" }}>
                    Checked Out
                  </Text>
                </View>
                <TouchableOpacity
                  disabled={updatingUser === user.userId}
                  onPress={() => handleUndoCheckOut(user)}
                  activeOpacity={0.8}
                  style={{
                    paddingVertical: 10,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    backgroundColor: isDark ? "rgba(168, 85, 247, 0.15)" : "rgba(168, 85, 247, 0.1)",
                    borderWidth: 1,
                    borderColor: "#A855F7",
                  }}
                >
                  {updatingUser === user.userId ? (
                    <ActivityIndicator size="small" color="#A855F7" />
                  ) : (
                    <>
                      <Undo2 size={15} color="#A855F7" style={{ marginRight: 6 }} />
                      <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 13, color: "#A855F7" }} numberOfLines={1}>
                        Undo Check-Out
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : user.checkInStatus?.accommodation ? (
              <View style={{ gap: 8 }}>
                <TouchableOpacity
                  disabled={updatingUser === user.userId}
                  onPress={() => handleCheckOut(user)}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: "#EF4444",
                    borderColor: "#EF4444",
                    borderWidth: 1,
                    borderRadius: 12,
                    paddingVertical: 11,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                  }}
                >
                  {updatingUser === user.userId ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <LogOut size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 13, color: "#FFFFFF" }} numberOfLines={1}>
                        Check Out
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={updatingUser === user.userId}
                  onPress={() => handleUndoCheckIn(user)}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: isDark ? "rgba(239, 68, 68, 0.12)" : "rgba(239, 68, 68, 0.08)",
                    borderColor: isDark ? "rgba(239, 68, 68, 0.3)" : "rgba(239, 68, 68, 0.25)",
                    borderWidth: 1,
                    borderRadius: 12,
                    paddingVertical: 11,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                  }}
                >
                  {updatingUser === user.userId ? (
                    <ActivityIndicator size="small" color="#EF4444" />
                  ) : (
                    <>
                      <Undo2 size={15} color="#EF4444" style={{ marginRight: 6 }} />
                      <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 13, color: "#EF4444" }} numberOfLines={1}>
                        Undo Check-In
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                disabled={updatingUser === user.userId}
                onPress={() => handleCheckIn(user)}
                activeOpacity={0.8}
                style={{
                  backgroundColor: "#10B981",
                  borderColor: "#10B981",
                  borderWidth: 1,
                  borderRadius: 12,
                  paddingVertical: 10,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                }}
              >
                {updatingUser === user.userId ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <CheckCircle size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 13, color: "#FFFFFF" }}>
                      Mark Checked In
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 16,
          paddingHorizontal: 20,
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 1,
          borderBottomColor: cardBorder,
          backgroundColor: bgColor,
        }}
      >
        <TouchableOpacity
          onPress={() => navigation.navigate("Dashboard")}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.06)",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
          }}
          activeOpacity={0.7}
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
            Accommodation
          </Text>
          <Text
            style={{
              fontFamily: "Poppins_400Regular",
              fontSize: 12,
              color: "#41B8F0",
              marginTop: 1,
            }}
          >
            {filteredUsers.length > 0
              ? `${filteredUsers.length} ${selectedTab} users for ${
                  dayMappings.find((d) => d.backendDay === selectedDate)?.day || "selected day"
                }`
              : selectedTab === "outgoing"
              ? "Track hostel departures & check-outs"
              : "Track hostel arrivals & check-ins"}
          </Text>
        </View>
      </View>

      {/* Calendar Strip */}
      <View style={{ paddingVertical: 12 }}>
        <FlatList
          horizontal
          data={dayMappings}
          renderItem={renderDayCell}
          keyExtractor={(day) => day.backendDay}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        />
      </View>

      {/* Daily Stats Overview Cards */}
      <View style={{ flexDirection: "row", paddingHorizontal: 16, marginBottom: 14, gap: 8 }}>
        <View
          style={{
            flex: 1,
            backgroundColor: cardBg,
            borderRadius: 14,
            paddingVertical: 10,
            paddingHorizontal: 8,
            borderWidth: 1,
            borderColor: cardBorder,
            alignItems: "center",
          }}
        >
          <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 10, color: textSecondary }}>
            Booked
          </Text>
          <Text style={{ fontFamily: "Poppins_700Bold", fontSize: 16, color: "#38BDF8", marginTop: 2 }}>
            {currentDayStats.total}
          </Text>
        </View>

        <View
          style={{
            flex: 1,
            backgroundColor: cardBg,
            borderRadius: 14,
            paddingVertical: 10,
            paddingHorizontal: 8,
            borderWidth: 1,
            borderColor: cardBorder,
            alignItems: "center",
          }}
        >
          <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 10, color: textSecondary }}>
            Checked In
          </Text>
          <Text style={{ fontFamily: "Poppins_700Bold", fontSize: 16, color: "#10B981", marginTop: 2 }}>
            {currentDayStats.checkedIn}
          </Text>
        </View>

        <View
          style={{
            flex: 1,
            backgroundColor: cardBg,
            borderRadius: 14,
            paddingVertical: 10,
            paddingHorizontal: 8,
            borderWidth: 1,
            borderColor: cardBorder,
            alignItems: "center",
          }}
        >
          <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 10, color: textSecondary }}>
            Checked Out
          </Text>
          <Text style={{ fontFamily: "Poppins_700Bold", fontSize: 16, color: "#A855F7", marginTop: 2 }}>
            {currentDayStats.checkedOut || 0}
          </Text>
        </View>

        <View
          style={{
            flex: 1,
            backgroundColor: cardBg,
            borderRadius: 14,
            paddingVertical: 10,
            paddingHorizontal: 8,
            borderWidth: 1,
            borderColor: cardBorder,
            alignItems: "center",
          }}
        >
          <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 10, color: textSecondary }}>
            Pending
          </Text>
          <Text style={{ fontFamily: "Poppins_700Bold", fontSize: 16, color: "#F59E0B", marginTop: 2 }}>
            {currentDayStats.pending}
          </Text>
        </View>
      </View>

      {/* Tab Buttons */}
      <View style={{ flexDirection: "row", paddingHorizontal: 16, marginBottom: 12, gap: 10 }}>
        <TouchableOpacity
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 14,
            alignItems: "center",
            backgroundColor: selectedTab === "incoming" ? "#41B8F0" : cardBg,
            borderWidth: 1,
            borderColor: selectedTab === "incoming" ? "#41B8F0" : cardBorder,
          }}
          onPress={() => setSelectedTab("incoming")}
          activeOpacity={0.75}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <ArrowDown
              size={16}
              color={selectedTab === "incoming" ? "#FFFFFF" : textSecondary}
            />
            <Text
              style={{
                fontFamily: "Poppins_600SemiBold",
                fontSize: 14,
                marginLeft: 6,
                color: selectedTab === "incoming" ? "#FFFFFF" : textPrimary,
              }}
            >
              Incoming
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 14,
            alignItems: "center",
            backgroundColor: selectedTab === "outgoing" ? "#41B8F0" : cardBg,
            borderWidth: 1,
            borderColor: selectedTab === "outgoing" ? "#41B8F0" : cardBorder,
          }}
          onPress={() => setSelectedTab("outgoing")}
          activeOpacity={0.75}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <ArrowUp
              size={16}
              color={selectedTab === "outgoing" ? "#FFFFFF" : textSecondary}
            />
            <Text
              style={{
                fontFamily: "Poppins_600SemiBold",
                fontSize: 14,
                marginLeft: 6,
                color: selectedTab === "outgoing" ? "#FFFFFF" : textPrimary,
              }}
            >
              Outgoing
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Search Mode Toggle & Input */}
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
          <TouchableOpacity
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 10,
              alignItems: "center",
              backgroundColor: searchMode === "normal"
                ? (isDark ? "rgba(65, 184, 240, 0.15)" : "#E0F2FE")
                : cardBg,
              borderWidth: 1,
              borderColor: searchMode === "normal" ? "#41B8F0" : cardBorder,
            }}
            onPress={() => setSearchMode("normal")}
            activeOpacity={0.7}
          >
            <Text
              style={{
                fontFamily: "Poppins_600SemiBold",
                fontSize: 12,
                color: searchMode === "normal" ? "#41B8F0" : textSecondary,
              }}
            >
              Normal Search
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 10,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              backgroundColor: searchMode === "hostel"
                ? (isDark ? "rgba(65, 184, 240, 0.15)" : "#E0F2FE")
                : cardBg,
              borderWidth: 1,
              borderColor: searchMode === "hostel" ? "#41B8F0" : cardBorder,
            }}
            onPress={() => setSearchMode("hostel")}
            activeOpacity={0.7}
          >
            <House
              size={13}
              color={searchMode === "hostel" ? "#41B8F0" : textSecondary}
            />
            <Text
              style={{
                fontFamily: "Poppins_600SemiBold",
                fontSize: 12,
                marginLeft: 6,
                color: searchMode === "hostel" ? "#41B8F0" : textSecondary,
              }}
            >
              Hostel Search
            </Text>
          </TouchableOpacity>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: cardBg,
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: cardBorder,
          }}
        >
          <Search size={18} color="#41B8F0" />
          <TextInput
            style={{
              fontFamily: "Poppins_400Regular",
              fontSize: 13,
              color: textPrimary,
              flex: 1,
              marginLeft: 10,
            }}
            placeholder={
              searchMode === "hostel"
                ? "Search by hostel (e.g. Agira, Hostel A, FRF) or room..."
                : "Search by name, college, email..."
            }
            placeholderTextColor={textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} activeOpacity={0.7}>
              <X size={18} color={textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Users List */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 40 }}>
          <ActivityIndicator size="large" color="#41B8F0" />
          <Text style={{ fontFamily: "Poppins_500Medium", color: textSecondary, marginTop: 12 }}>
            Loading {selectedTab} users...
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
              colors={["#41B8F0"]}
              tintColor="#41B8F0"
            />
          }
          ListEmptyComponent={() => (
            <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 50, paddingHorizontal: 30 }}>
              {selectedTab === "incoming" ? (
                <ArrowDown size={42} color={textSecondary} />
              ) : (
                <ArrowUp size={42} color={textSecondary} />
              )}
              <Text style={{ fontFamily: "Poppins_600SemiBold", color: textPrimary, fontSize: 16, marginTop: 14, textAlign: "center" }}>
                No {selectedTab} users found
              </Text>
              <Text style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 12, textAlign: "center", marginTop: 4 }}>
                {selectedTab === "incoming"
                  ? "No users starting accommodation on this day"
                  : "No users scheduled to check out on this day"}
              </Text>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Hostel Picker Modal */}
      <HostelPickerModal
        visible={!!activeHostelPickerUserId}
        onClose={() => setActiveHostelPickerUserId(null)}
        selectedCode={
          activeHostelPickerUserId
            ? (editingHostelUser[activeHostelPickerUserId] !== undefined
                ? editingHostelUser[activeHostelPickerUserId]
                : users.find((u) => u.userId === activeHostelPickerUserId)?.checkInStatus?.Hostel || "")
            : ""
        }
        onSelect={(code) => {
          if (activeHostelPickerUserId) {
            setEditingHostelUser((prev) => ({ ...prev, [activeHostelPickerUserId]: code }));
          }
        }}
      />
    </View>
  );
};

export default Accommodation;
