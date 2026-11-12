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
import { formatHostelDisplay } from "@/data/hostels";
import {
  UserGateData,
  updateGateFestStatus,
  getUserRegisteredEvents,
} from "@/api/admin";

interface GateUserModalProps {
  visible: boolean;
  onClose: () => void;
  userData: UserGateData | null;
  onUserDataUpdate?: (updatedData: UserGateData) => void;
}

const GateUserModal: React.FC<GateUserModalProps> = ({
  visible,
  onClose,
  userData,
  onUserDataUpdate,
}) => {
  const { isDark } = useThemeStore();
  const [loading, setLoading] = useState(false);
  const [currentUserData, setCurrentUserData] = useState<UserGateData | null>(
    userData
  );
  const [userEvents, setUserEvents] = useState<any[]>(
    userData?.userEvents || []
  );
  const [showEventsList, setShowEventsList] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [remark, setRemark] = useState("");
  const [showRemarkInput, setShowRemarkInput] = useState(false);
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
    if (userData?.checkInStatus?.remark) {
      setRemark(userData.checkInStatus.remark);
    } else {
      setRemark("");
    }
    setShowRemarkInput(false);
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

  const handleFestStatusUpdate = async (newStatus: boolean) => {
    setLoading(true);
    try {
      const result = await updateGateFestStatus(
        currentUserData.userId,
        newStatus,
        remark
      );

      if (result.success) {
        const updatedData = {
          ...currentUserData,
          checkInStatus: {
            ...currentUserData.checkInStatus,
            fest: newStatus,
            remark: remark || null,
          },
        };
        setCurrentUserData(updatedData);

        if (onUserDataUpdate) {
          onUserDataUpdate(updatedData);
        }

        setShowRemarkInput(false);

        setSuccessMessage(
          `Fest entry ${
            newStatus ? "confirmed" : "reverted to pending"
          } successfully!`
        );
        setUpdateSuccess(true);
        setTimeout(() => {
          setUpdateSuccess(false);
        }, 3000);
      } else {
        showAlert(
          result.error || "Update Failed",
          result.message || "Failed to update fest entry status"
        );
      }
    } catch (error) {
      showAlert(
        "Error",
        "Failed to update fest entry status. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.75)", justifyContent: "center", alignItems: "center", paddingHorizontal: 20 }}>
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
                  Gate Entry Verification
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
                      Host College
                    </Text>
                  </View>
                )}
              </View>

              {/* Fest Entry Status & Actions */}
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
                  Fest Entry Status
                </Text>

                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <Text style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 13 }}>
                    Current Status:
                  </Text>
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 20,
                      backgroundColor: currentUserData.checkInStatus.fest
                        ? "rgba(16, 185, 129, 0.2)"
                        : "rgba(234, 179, 8, 0.2)",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Poppins_600SemiBold",
                        fontSize: 12,
                        color: currentUserData.checkInStatus.fest ? "#10B981" : "#FBBF24",
                      }}
                    >
                      {currentUserData.checkInStatus.fest ? "Confirmed" : "Pending"}
                    </Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {!currentUserData.checkInStatus.fest ? (
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        backgroundColor: "#10B981",
                        paddingVertical: 12,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      onPress={() => handleFestStatusUpdate(true)}
                      disabled={loading}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#FFFFFF", fontSize: 13 }}>
                        {loading ? "Updating..." : "Confirm Entry"}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        backgroundColor: "#EF4444",
                        paddingVertical: 12,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      onPress={() => handleFestStatusUpdate(false)}
                      disabled={loading}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#FFFFFF", fontSize: 13 }}>
                        {loading ? "Updating..." : "Revert to Pending"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Remark Section */}
              <View
                style={{
                  backgroundColor: cardBg,
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: cardBorder,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text style={{ fontFamily: "Poppins_600SemiBold", color: textPrimary, fontSize: 14 }}>
                    Admin Remark
                  </Text>
                  {currentUserData.checkInStatus.remark && !showRemarkInput && (
                    <TouchableOpacity
                      onPress={() => setShowRemarkInput(true)}
                      activeOpacity={0.7}
                      style={{
                        padding: 4,
                      }}
                    >
                      <Ionicons name="pencil" size={16} color="#41B8F0" />
                    </TouchableOpacity>
                  )}
                </View>

                {showRemarkInput ? (
                  <>
                    <TextInput
                      style={{
                        backgroundColor: inputBg,
                        color: textPrimary,
                        padding: 12,
                        borderRadius: 12,
                        marginBottom: 10,
                        fontSize: 13,
                        fontFamily: "Poppins_400Regular",
                        minHeight: 70,
                        borderWidth: 1,
                        borderColor: cardBorder,
                        textAlignVertical: "top",
                      }}
                      placeholder="Enter remark (optional)..."
                      placeholderTextColor={textSecondary}
                      value={remark}
                      onChangeText={setRemark}
                      multiline
                      numberOfLines={3}
                    />
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                          paddingVertical: 10,
                          borderRadius: 10,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        onPress={() => {
                          setRemark(currentUserData.checkInStatus.remark || "");
                          setShowRemarkInput(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontFamily: "Poppins_500Medium", color: textSecondary, fontSize: 12 }}>
                          Cancel
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          backgroundColor: "#41B8F0",
                          paddingVertical: 10,
                          borderRadius: 10,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        onPress={() =>
                          handleFestStatusUpdate(
                            currentUserData.checkInStatus.fest
                          )
                        }
                        disabled={loading}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#FFFFFF", fontSize: 12 }}>
                          {loading ? "Saving..." : "Save Remark"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    {currentUserData.checkInStatus.remark ? (
                      <Text
                        style={{
                          fontFamily: "Poppins_400Regular",
                          color: textPrimary,
                          fontSize: 13,
                          marginBottom: 8,
                        }}
                      >
                        {currentUserData.checkInStatus.remark}
                      </Text>
                    ) : (
                      <Text
                        style={{
                          fontFamily: "Poppins_400Regular",
                          color: textSecondary,
                          fontSize: 13,
                          fontStyle: "italic",
                          marginBottom: 8,
                        }}
                      >
                        No remark added
                      </Text>
                    )}
                    {!currentUserData.checkInStatus.fest && (
                      <TouchableOpacity
                        style={{
                          backgroundColor: isDark ? "rgba(65, 184, 240, 0.15)" : "rgba(65, 184, 240, 0.12)",
                          paddingVertical: 8,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: "rgba(65, 184, 240, 0.3)",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        onPress={() => setShowRemarkInput(true)}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#41B8F0", fontSize: 12 }}>
                          {currentUserData.checkInStatus.remark ? "Edit Remark" : "Add Remark"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
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

              {/* Accommodation Status */}
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

                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <Text style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 13 }}>
                    Accommodation Needed
                  </Text>
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 12,
                      backgroundColor: currentUserData.accommodationNeeded
                        ? "rgba(16, 185, 129, 0.2)"
                        : "rgba(239, 68, 68, 0.2)",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Poppins_600SemiBold",
                        fontSize: 11,
                        color: currentUserData.accommodationNeeded ? "#10B981" : "#EF4444",
                      }}
                    >
                      {currentUserData.accommodationNeeded ? "Yes" : "No"}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: currentUserData.checkInStatus.Hostel ? 10 : 0 }}>
                  <Text style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 13 }}>
                    Check-in Status
                  </Text>
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 12,
                      backgroundColor: currentUserData.checkInStatus.accommodation
                        ? "rgba(16, 185, 129, 0.2)"
                        : "rgba(107, 114, 128, 0.2)",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Poppins_600SemiBold",
                        fontSize: 11,
                        color: currentUserData.checkInStatus.accommodation ? "#10B981" : textSecondary,
                      }}
                    >
                      {currentUserData.checkInStatus.accommodation ? "Confirmed" : "Pending"}
                    </Text>
                  </View>
                </View>

                {(currentUserData.checkInStatus.Hostel || currentUserData.checkInStatus.RoomNo) && (
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 13 }}>
                      Assigned Hostel
                    </Text>
                    <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#41B8F0", fontSize: 13, flex: 1, textAlign: "right", marginLeft: 8 }}>
                      {formatHostelDisplay(currentUserData.checkInStatus.Hostel, currentUserData.checkInStatus.RoomNo)}
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
    </Modal>
  );
};

export default GateUserModal;
