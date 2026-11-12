import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../index";
import { useThemeStore } from "@/state/themeStore";
import { HostelPickerModal } from "@/components/admin/HostelPickerModal";
import { formatHostelDisplay } from "@/data/hostels";
import {
  UserGateData,
  updateHostelStatus,
  getUserRegisteredEvents,
  getCurrentEventDay,
} from "@/api/admin";

interface HostelUserModalProps {
  visible: boolean;
  onClose: () => void;
  userData: UserGateData | null;
  onUserDataUpdate?: (updatedData: UserGateData) => void;
}

type DayCode = "day00" | "day0" | "day1" | "day2" | "day3" | "day4";

const getDayLabel = (dayCode: string): string => {
  const dayLabels: { [key: string]: string } = {
    day00: "Day 00 (Pre-Fest)",
    day0: "Day 0",
    day1: "Day 1",
    day2: "Day 2",
    day3: "Day 3",
    day4: "Day 4",
  };
  return dayLabels[dayCode] || dayCode.toUpperCase();
};

const HostelUserModal: React.FC<HostelUserModalProps> = ({
  visible,
  onClose,
  userData,
  onUserDataUpdate,
}) => {
  const { isDark } = useThemeStore();
  const [loading, setLoading] = useState(false);
  const [showHostelInput, setShowHostelInput] = useState(false);
  const [selectedHostelCode, setSelectedHostelCode] = useState("");
  const [roomNo, setRoomNo] = useState("");
  const [showHostelPicker, setShowHostelPicker] = useState(false);
  const [currentUserData, setCurrentUserData] = useState<UserGateData | null>(
    userData
  );
  const [userEvents, setUserEvents] = useState<any[]>(
    userData?.userEvents || []
  );
  const [showEventsList, setShowEventsList] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const modalBg = isDark ? "#1C1C20" : "#FFFFFF";
  const modalBorder = isDark ? "#2A2A30" : "#D5D5D5";
  const cardBg = isDark ? "#131316" : "#F3F4F6";
  const cardBorder = isDark ? "#2A2A30" : "#E5E7EB";
  const textPrimary = isDark ? "#FFFFFF" : "#111827";
  const textSecondary = isDark ? "#9CA3AF" : "#6B7280";
  const inputBg = isDark ? "#18181C" : "#FFFFFF";

  // Update local state when userData prop changes
  React.useEffect(() => {
    setCurrentUserData(userData);
    setUserEvents(userData?.userEvents || []);
    setShowHostelInput(false);
    setSelectedHostelCode(userData?.checkInStatus?.Hostel || "");
    setRoomNo(userData?.checkInStatus?.RoomNo || "");
  }, [userData]);

  // Fetch user events when modal opens
  React.useEffect(() => {
    const fetchEvents = async () => {
      if (
        visible &&
        userData?.userId &&
        (!userData.userEvents || userData.userEvents.length === 0)
      ) {
        setLoadingEvents(true);
        try {
          const events = await getUserRegisteredEvents(userData.userId);
          setUserEvents(events);
        } catch (e) {
          console.error("Failed to load user events:", e);
        } finally {
          setLoadingEvents(false);
        }
      }
    };
    fetchEvents();
  }, [visible, userData?.userId]);

  if (!currentUserData) return null;

  const currentDay: DayCode = (getCurrentEventDay() as DayCode) || "day1";

  const handleHostelCheckin = async () => {
    if (!selectedHostelCode.trim()) {
      showAlert("Error", "Please select a hostel from the list");
      return;
    }

    setLoading(true);
    try {
      const result = await updateHostelStatus(
        currentUserData.userId,
        true,
        selectedHostelCode.trim(),
        roomNo.trim()
      );

      if (result.success) {
        const updatedData = {
          ...currentUserData,
          checkInStatus: {
            ...currentUserData.checkInStatus,
            accommodation: true,
            Hostel: selectedHostelCode.trim(),
            RoomNo: roomNo.trim(),
          },
        };
        setCurrentUserData(updatedData);

        if (onUserDataUpdate) {
          onUserDataUpdate(updatedData);
        }

        setShowHostelInput(false);
        setSuccessMessage("Hostel check-in confirmed successfully!");
        setUpdateSuccess(true);
        setTimeout(() => setUpdateSuccess(false), 3000);
      } else {
        showAlert(
          result.error || "Update Failed",
          result.message || "Failed to update accommodation status"
        );
      }
    } catch (error) {
      showAlert(
        "Error",
        "Failed to update accommodation status. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRevertCheckin = async () => {
    setLoading(true);
    try {
      const result = await updateHostelStatus(
        currentUserData.userId,
        false,
        ""
      );

      if (result.success) {
        const updatedData = {
          ...currentUserData,
          checkInStatus: {
            ...currentUserData.checkInStatus,
            accommodation: false,
            Hostel: null,
            RoomNo: null,
          },
        };
        setCurrentUserData(updatedData);

        if (onUserDataUpdate) {
          onUserDataUpdate(updatedData);
        }

        setSuccessMessage("Hostel check-in reverted to pending!");
        setUpdateSuccess(true);
        setTimeout(() => setUpdateSuccess(false), 3000);
      } else {
        showAlert(
          result.error || "Update Failed",
          result.message || "Failed to revert accommodation status"
        );
      }
    } catch (error) {
      showAlert(
        "Error",
        "Failed to revert accommodation status. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const bookedDays = Object.entries(currentUserData.accommodation || {})
    .filter(([_, booked]) => Boolean(booked))
    .map(([dayKey]) => dayKey);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.75)",
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 20,
        }}
      >
        <View
          style={{
            backgroundColor: modalBg,
            borderRadius: 24,
            padding: 22,
            width: "100%",
            maxWidth: 380,
            borderWidth: 1,
            borderColor: modalBorder,
            maxHeight: "84%",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.35,
            shadowRadius: 16,
            elevation: 8,
          }}
        >
          {/* Success Banner */}
          {updateSuccess && (
            <View
              style={{
                backgroundColor: "rgba(16, 185, 129, 0.15)",
                borderWidth: 1,
                borderColor: "rgba(16, 185, 129, 0.35)",
                borderRadius: 14,
                padding: 12,
                marginBottom: 14,
              }}
            >
              <Text
                style={{
                  fontFamily: "Poppins_600SemiBold",
                  color: "#10B981",
                  textAlign: "center",
                  fontSize: 13,
                }}
              >
                ✓ {successMessage}
              </Text>
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={{ alignItems: "center", marginBottom: 20 }}>
              <Text
                style={{
                  fontFamily: "Talina",
                  color: textPrimary,
                  fontSize: 22,
                  textAlign: "center",
                  marginBottom: 6,
                }}
              >
                {currentUserData.displayName || currentUserData.name || "User"}
              </Text>
              <View
                style={{
                  backgroundColor: isDark ? "rgba(65, 184, 240, 0.15)" : "rgba(65, 184, 240, 0.12)",
                  borderRadius: 20,
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                  borderWidth: 1,
                  borderColor: "rgba(65, 184, 240, 0.3)",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Poppins_600SemiBold",
                    color: "#41B8F0",
                    fontSize: 12,
                  }}
                >
                  Hostel Accommodation
                </Text>
              </View>
            </View>

            {/* Information Cards */}
            <View style={{ gap: 12 }}>
              {/* College */}
              <View
                style={{
                  backgroundColor: cardBg,
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: cardBorder,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Poppins_400Regular",
                    color: textSecondary,
                    fontSize: 12,
                    marginBottom: 4,
                  }}
                >
                  College
                </Text>
                <Text
                  style={{
                    fontFamily: "Poppins_600SemiBold",
                    color: textPrimary,
                    fontSize: 15,
                  }}
                >
                  {currentUserData.collegeName || "Not specified"}
                </Text>
                {currentUserData.isHostCollegeStudent && (
                  <View
                    style={{
                      backgroundColor: "rgba(65, 184, 240, 0.15)",
                      borderRadius: 12,
                      paddingHorizontal: 10,
                      paddingVertical: 3,
                      marginTop: 8,
                      alignSelf: "flex-start",
                      borderWidth: 1,
                      borderColor: "rgba(65, 184, 240, 0.3)",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Poppins_600SemiBold",
                        color: "#41B8F0",
                        fontSize: 11,
                      }}
                    >
                      Host College Student
                    </Text>
                  </View>
                )}
              </View>

              {/* Fest Gate Entry Status */}
              <View
                style={{
                  backgroundColor: cardBg,
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: cardBorder,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Poppins_600SemiBold",
                    color: textPrimary,
                    fontSize: 14,
                    marginBottom: 10,
                  }}
                >
                  Fest Gate Entry
                </Text>

                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 13 }}>
                    Gate Verification:
                  </Text>
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 20,
                      backgroundColor: currentUserData.checkInStatus.fest
                        ? "rgba(16, 185, 129, 0.2)"
                        : "rgba(239, 68, 68, 0.2)",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Poppins_600SemiBold",
                        fontSize: 12,
                        color: currentUserData.checkInStatus.fest ? "#10B981" : "#EF4444",
                      }}
                    >
                      {currentUserData.checkInStatus.fest ? "Confirmed" : "Not Entered"}
                    </Text>
                  </View>
                </View>

                {currentUserData.checkInStatus.remark && (
                  <View
                    style={{
                      backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)",
                      borderRadius: 10,
                      padding: 10,
                      marginTop: 10,
                    }}
                  >
                    <Text style={{ fontFamily: "Poppins_500Medium", color: textSecondary, fontSize: 11 }}>
                      Gate Remark:
                    </Text>
                    <Text style={{ fontFamily: "Poppins_400Regular", color: textPrimary, fontSize: 12, marginTop: 2 }}>
                      {currentUserData.checkInStatus.remark}
                    </Text>
                  </View>
                )}

                {!currentUserData.checkInStatus.fest && (
                  <View
                    style={{
                      backgroundColor: "rgba(239, 68, 68, 0.12)",
                      borderWidth: 1,
                      borderColor: "rgba(239, 68, 68, 0.25)",
                      borderRadius: 10,
                      padding: 10,
                      marginTop: 10,
                    }}
                  >
                    <Text style={{ fontFamily: "Poppins_500Medium", color: "#EF4444", fontSize: 12, textAlign: "center" }}>
                      ⚠️ User must enter through the gate first
                    </Text>
                  </View>
                )}
              </View>

              {/* User Events Accordion */}
              <TouchableOpacity
                style={{
                  backgroundColor: cardBg,
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: cardBorder,
                }}
                onPress={() => {
                  if (userEvents.length > 0) {
                    setShowEventsList(!showEventsList);
                  }
                }}
                disabled={userEvents.length === 0}
                activeOpacity={userEvents.length > 0 ? 0.7 : 1}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontFamily: "Poppins_600SemiBold", color: textPrimary, fontSize: 14 }}>
                    Events Registered
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {loadingEvents ? (
                      <ActivityIndicator size="small" color="#41B8F0" />
                    ) : (
                      <>
                        <View
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 12,
                            backgroundColor: userEvents.length > 0 ? "rgba(65, 184, 240, 0.15)" : "rgba(107, 114, 128, 0.15)",
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: "Poppins_600SemiBold",
                              fontSize: 12,
                              color: userEvents.length > 0 ? "#41B8F0" : textSecondary,
                            }}
                          >
                            {userEvents.length}
                          </Text>
                        </View>
                        {userEvents.length > 0 && (
                          <Ionicons
                            name={showEventsList ? "chevron-up" : "chevron-down"}
                            size={16}
                            color="#41B8F0"
                          />
                        )}
                      </>
                    )}
                  </View>
                </View>

                {showEventsList && userEvents.length > 0 && (
                  <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: cardBorder, gap: 8 }}>
                    {userEvents.map((event, index) => (
                      <View
                        key={event.eventId || index}
                        style={{
                          paddingVertical: 6,
                          borderBottomWidth: index !== userEvents.length - 1 ? 1 : 0,
                          borderBottomColor: cardBorder,
                        }}
                      >
                        <Text style={{ fontFamily: "Poppins_500Medium", color: textPrimary, fontSize: 13 }}>
                          {event.eventName}
                        </Text>
                        <Text style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 11, marginTop: 2 }}>
                          Status: {event.status} {event.checkingStatus ? `(${event.checkingStatus})` : ""}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </TouchableOpacity>

              {/* Accommodation Status & Actions */}
              <View
                style={{
                  backgroundColor: cardBg,
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: cardBorder,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Poppins_600SemiBold",
                    color: textPrimary,
                    fontSize: 14,
                    marginBottom: 12,
                  }}
                >
                  Accommodation Details
                </Text>

                {/* Day-wise Booking Breakdown */}
                <View style={{ gap: 8, marginBottom: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 13 }}>
                      Today ({getDayLabel(currentDay)}):
                    </Text>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 12,
                        backgroundColor: currentUserData.accommodation?.[currentDay]
                          ? "rgba(16, 185, 129, 0.2)"
                          : "rgba(107, 114, 128, 0.15)",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Poppins_600SemiBold",
                          fontSize: 11,
                          color: currentUserData.accommodation?.[currentDay] ? "#10B981" : textSecondary,
                        }}
                      >
                        {currentUserData.accommodation?.[currentDay] ? "Booked" : "Not Booked"}
                      </Text>
                    </View>
                  </View>

                  {bookedDays
                    .filter((day) => day !== currentDay)
                    .map((day) => (
                      <View key={day} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Text style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 13 }}>
                          {getDayLabel(day)}:
                        </Text>
                        <View
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 12,
                            backgroundColor: "rgba(16, 185, 129, 0.2)",
                          }}
                        >
                          <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 11, color: "#10B981" }}>
                            Booked
                          </Text>
                        </View>
                      </View>
                    ))}
                </View>

                {/* Current Hostel Check-in Status */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <Text style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 13 }}>
                    Check-in Status:
                  </Text>
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 20,
                      backgroundColor: currentUserData.checkInStatus.accommodation
                        ? "rgba(16, 185, 129, 0.2)"
                        : "rgba(234, 179, 8, 0.2)",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Poppins_600SemiBold",
                        fontSize: 12,
                        color: currentUserData.checkInStatus.accommodation ? "#10B981" : "#FBBF24",
                      }}
                    >
                      {currentUserData.checkInStatus.accommodation ? "Checked In" : "Pending"}
                    </Text>
                  </View>
                </View>

                {/* Assigned Hostel */}
                {(currentUserData.checkInStatus.Hostel || currentUserData.checkInStatus.RoomNo) && (
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <Text style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 13 }}>
                      Assigned Hostel:
                    </Text>
                    <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#41B8F0", fontSize: 13, flex: 1, textAlign: "right", marginLeft: 8 }}>
                      {formatHostelDisplay(currentUserData.checkInStatus.Hostel, currentUserData.checkInStatus.RoomNo)}
                    </Text>
                  </View>
                )}

                {/* Check-in Action Button */}
                {currentUserData.checkInStatus.fest ? (
                  !currentUserData.checkInStatus.accommodation ? (
                    <TouchableOpacity
                      style={{
                        backgroundColor: "#41B8F0",
                        paddingVertical: 12,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        marginTop: 4,
                      }}
                      onPress={() => setShowHostelInput(true)}
                      disabled={loading}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#FFFFFF", fontSize: 13 }}>
                        Confirm Hostel Check-in
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={{
                        backgroundColor: "#EF4444",
                        paddingVertical: 12,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        marginTop: 4,
                      }}
                      onPress={handleRevertCheckin}
                      disabled={loading}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#FFFFFF", fontSize: 13 }}>
                        {loading ? "Updating..." : "Revert to Pending"}
                      </Text>
                    </TouchableOpacity>
                  )
                ) : (
                  <View
                    style={{
                      backgroundColor: "rgba(239, 68, 68, 0.12)",
                      borderRadius: 10,
                      padding: 10,
                      marginTop: 4,
                    }}
                  >
                    <Text style={{ fontFamily: "Poppins_500Medium", color: "#EF4444", fontSize: 12, textAlign: "center" }}>
                      ❌ Cannot check-in: User must enter through gate first
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Close Button */}
            <TouchableOpacity
              style={{
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.06)",
                paddingVertical: 14,
                borderRadius: 14,
                marginTop: 20,
                alignItems: "center",
                justifyContent: "center",
              }}
              onPress={onClose}
              activeOpacity={0.7}
              disabled={loading}
            >
              <Text
                style={{
                  fontFamily: "Poppins_600SemiBold",
                  color: textPrimary,
                  fontSize: 14,
                }}
              >
                Close
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Loading Overlay */}
          {loading && (
            <View
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: "rgba(0, 0, 0, 0.6)",
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ActivityIndicator size="large" color="#41B8F0" />
              <Text style={{ fontFamily: "Poppins_500Medium", color: "#FFFFFF", fontSize: 13, marginTop: 8 }}>
                Updating...
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Hostel & Room Input Modal */}
      <Modal
        visible={showHostelInput}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowHostelInput(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 20,
          }}
        >
          <View
            style={{
              backgroundColor: modalBg,
              borderRadius: 22,
              padding: 20,
              width: "100%",
              maxWidth: 350,
              borderWidth: 1,
              borderColor: modalBorder,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.35,
              shadowRadius: 16,
              elevation: 8,
            }}
          >
            <Text
              style={{
                fontFamily: "Talina",
                color: textPrimary,
                fontSize: 20,
                marginBottom: 6,
                textAlign: "center",
              }}
            >
              Assign Hostel & Room
            </Text>
            <Text
              style={{
                fontFamily: "Poppins_400Regular",
                color: textSecondary,
                fontSize: 12,
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              Select the hostel and enter room number
            </Text>

            {/* Hostel Dropdown Trigger */}
            <Text
              style={{
                fontFamily: "Poppins_600SemiBold",
                fontSize: 11,
                color: textSecondary,
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Hostel Name
            </Text>
            <TouchableOpacity
              onPress={() => setShowHostelPicker(true)}
              style={{
                backgroundColor: inputBg,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderRadius: 12,
                marginBottom: 14,
                borderWidth: 1,
                borderColor: selectedHostelCode ? "#41B8F0" : cardBorder,
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
                    fontSize: 13,
                    color: selectedHostelCode ? textPrimary : textSecondary,
                  }}
                  numberOfLines={1}
                >
                  {selectedHostelCode
                    ? formatHostelDisplay(selectedHostelCode)
                    : "Select Hostel..."}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={16} color={textSecondary} />
            </TouchableOpacity>

            {/* Room Number Input */}
            <Text
              style={{
                fontFamily: "Poppins_600SemiBold",
                fontSize: 11,
                color: textSecondary,
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Room Number
            </Text>
            <TextInput
              style={{
                backgroundColor: inputBg,
                color: textPrimary,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderRadius: 12,
                marginBottom: 18,
                fontSize: 13,
                fontFamily: "Poppins_500Medium",
                borderWidth: 1,
                borderColor: cardBorder,
              }}
              placeholder="e.g. 102, B-204"
              placeholderTextColor={textSecondary}
              value={roomNo}
              onChangeText={setRoomNo}
              autoCapitalize="characters"
            />

            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onPress={() => {
                  setShowHostelInput(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={{ fontFamily: "Poppins_500Medium", color: textSecondary, fontSize: 13 }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: !selectedHostelCode.trim() || loading ? "rgba(65, 184, 240, 0.5)" : "#41B8F0",
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onPress={handleHostelCheckin}
                disabled={!selectedHostelCode.trim() || loading}
                activeOpacity={0.7}
              >
                <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#FFFFFF", fontSize: 13 }}>
                  {loading ? "Confirming..." : "Confirm"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Hostel Picker Modal */}
      <HostelPickerModal
        visible={showHostelPicker}
        onClose={() => setShowHostelPicker(false)}
        selectedCode={selectedHostelCode}
        onSelect={(code) => setSelectedHostelCode(code)}
      />
    </Modal>
  );
};

export default HostelUserModal;
