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

interface HostelUserModalProps {
  visible: boolean;
  onClose: () => void;
  userData: UserGateData | null;
  onUserDataUpdate?: (updatedData: UserGateData) => void;
}

// Type for valid day codes
type DayCode = "day00" | "day0" | "day1" | "day2" | "day3" | "day4";

// Helper function to convert day code to readable date
const getDayDate = (dayCode: string): string => {
  const day00Date = new Date("2025-11-12");
  const dayMap: { [key: string]: number } = {
    day00: 0,
    day0: 1,
    day1: 2,
    day2: 3,
    day3: 4,
    day4: 5,
  };

  const daysToAdd = dayMap[dayCode] ?? 0;
  const targetDate = new Date(day00Date);
  targetDate.setDate(targetDate.getDate() + daysToAdd);

  return targetDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const HostelUserModal: React.FC<HostelUserModalProps> = ({
  visible,
  onClose,
  userData,
  onUserDataUpdate,
}) => {
  const [loading, setLoading] = useState(false);
  const [showHostelInput, setShowHostelInput] = useState(false);
  const [hostelName, setHostelName] = useState("");
  /* Removed API call */
  /* Removed API call */
  const [showEventsList, setShowEventsList] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Update local state when userData prop changes
  React.useEffect(() => {
    setCurrentUserData(userData);
    setShowHostelInput(false);
    setHostelName("");
  }, [userData]);

  // Fetch user events when modal opens
  /* Removed API call */

  if (!currentUserData) return null;

  // Get current day as typed value
  /* Removed API call */

  const handleHostelCheckin = async () => {
    if (!hostelName.trim()) {
      showAlert("Error", "Please enter a hostel name");
      return;
    }

    setLoading(true);
    try {
      /* Removed API call */

      if (result.success) {
        // Update local state
        const updatedData = {
          ...currentUserData,
          checkInStatus: {
            ...currentUserData.checkInStatus,
            accommodation: true,
            Hostel: hostelName.trim(),
          },
        };
        setCurrentUserData(updatedData);

        // Notify parent component
        if (onUserDataUpdate) {
          onUserDataUpdate(updatedData);
        }

        setShowHostelInput(false);
        setHostelName("");

        // Show success banner
        setSuccessMessage("Accommodation check-in confirmed successfully!");
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
      /* Removed API call */

      if (result.success) {
        // Update local state
        const updatedData = {
          ...currentUserData,
          checkInStatus: {
            ...currentUserData.checkInStatus,
            accommodation: false,
            Hostel: null,
          },
        };
        setCurrentUserData(updatedData);

        // Notify parent component
        if (onUserDataUpdate) {
          onUserDataUpdate(updatedData);
        }

        // Show success banner
        setSuccessMessage("Accommodation check-in reverted to pending!");
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

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-center items-center px-6">
        <View className="bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-sm border border-[#2C2C2C] max-h-[80%]">
          {/* Success Banner */}
          {updateSuccess && (
            <View className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 mb-4">
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className="text-green-400 text-center"
              >
                ✓ {successMessage}
              </Text>
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View className="items-center mb-6">
      
              <Text
                style={{ fontFamily: "Outfit_700Bold" }}
                className="text-white text-2xl mb-2 text-center"
              >
                {currentUserData.displayName}
              </Text>
              <View className="bg-[#2C2C2C] rounded-full px-3 py-1">
                <Text className="text-gray-300 text-sm">Hostel Check-in</Text>
              </View>
            </View>

            {/* User Information */}
            <View className="gap-6">
              {/* Email */}
        

              {/* College */}
              <View className="bg-[#2C2C2C] rounded-xl p-5 mx-2">
                <Text className="text-gray-400 text-sm mb-2">College</Text>
                <Text
                  style={{ fontFamily: "Outfit_500Medium" }}
                  className="text-white text-base"
                >
                  {currentUserData.collegeName}
                </Text>
                {currentUserData.isHostCollegeStudent && (
                  <View className="bg-[#FFBA00] rounded-full px-3 py-1 mt-3 self-start">
                    <Text className="text-[#121212] text-xs font-semibold">
                      Host College
                    </Text>
                  </View>
                )}
              </View>

              {/* Fest Entry Status */}
              <View className="bg-[#2C2C2C] rounded-xl p-5 mx-2">
                <Text className="text-gray-400 text-sm mb-4">
                  Fest Entry Status
                </Text>

                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-white text-sm">Gate Entry</Text>
                  <View
                    className={`px-3 py-1 rounded-full ${
                      currentUserData.checkInStatus.fest
                        ? "bg-green-500/20"
                        : "bg-red-500/20"
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        currentUserData.checkInStatus.fest
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {currentUserData.checkInStatus.fest
                        ? "Confirmed"
                        : "Not Confirmed"}
                    </Text>
                  </View>
                </View>

                {/* Gate Remark */}
                {currentUserData.checkInStatus.remark && (
                  <View className="bg-[#1a1a1a] rounded-xl p-3 mb-3">
                    <Text className="text-gray-400 text-xs mb-1">Gate Remark:</Text>
                    <Text
                      style={{ fontFamily: "Outfit_400Regular" }}
                      className="text-white text-sm"
                    >
                      {currentUserData.checkInStatus.remark}
                    </Text>
                  </View>
                )}

                {!currentUserData.checkInStatus.fest && (
                  <View className="bg-red-500/20 p-3 rounded-xl">
                    <Text className="text-red-400 text-center text-xs">
                      ⚠️ User has not entered through the gate
                    </Text>
                  </View>
                )}
              </View>

              {/* User Events */}
              <TouchableOpacity
                className="bg-[#2C2C2C] rounded-xl p-5 mx-2"
                onPress={() => {
                  if (userEvents.length > 0) {
                    setShowEventsList(!showEventsList);
                  }
                }}
                disabled={userEvents.length === 0}
                activeOpacity={userEvents.length > 0 ? 0.7 : 1}
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-gray-400 text-sm">
                    Events User Participated
                  </Text>
                  <View className="flex-row items-center gap-2">
                    {loadingEvents ? (
                      <ActivityIndicator size="small" color="#FFBA00" />
                    ) : (
                      <>
                        <View
                          className={`px-3 py-1 rounded-full ${
                            userEvents.length > 0
                              ? "bg-[#FFBA00]/20"
                              : "bg-gray-500/20"
                          }`}
                        >
                          <Text
                            className={`text-xs font-semibold ${
                              userEvents.length > 0
                                ? "text-[#FFBA00]"
                                : "text-gray-400"
                            }`}
                          >
                            {userEvents.length}
                          </Text>
                        </View>
                        {userEvents.length > 0 && (
                          <Ionicons
                            name={
                              showEventsList ? "chevron-up" : "chevron-down"
                            }
                            size={16}
                            color="#FFBA00"
                          />
                        )}
                      </>
                    )}
                  </View>
                </View>

                {/* Events List */}
                {showEventsList && userEvents.length > 0 && (
                  <View className="mt-4 pt-4 border-t border-gray-600">
                    {userEvents.map((event, index) => (
                      <View
                        key={event.eventId}
                        className={`py-2 ${
                          index !== userEvents.length - 1
                            ? "border-b border-gray-700"
                            : ""
                        }`}
                      >
                        <Text
                          style={{ fontFamily: "Outfit_500Medium" }}
                          className="text-white text-sm"
                        >
                          {event.eventName}
                        </Text>
                        <Text className="text-gray-400 text-xs mt-1">
                          Registration Status: {event.status}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </TouchableOpacity>

              {/* Accommodation Status & Actions */}
              <View className="bg-[#2C2C2C] rounded-xl p-5 mx-2">
                <Text className="text-gray-400 text-sm mb-4">
                  Accommodation Check-in Status
                </Text>

                {/* Accommodation for Current Day */}
                <View className="flex-col mb-4">
                  {/* not in serial order */}
                  {/* show  days accommodation */}
                  {/* show for today date also */}
                  <View
                    key={currentDay}
                    className={`flex-row items-center justify-between mb-2`}
                  >
                    <Text className="text-white text-sm">
                      Accommodation - {getDayDate(currentDay)}
                    </Text>
                    <View className={`px-3 py-1 rounded-full ${
                      currentUserData.accommodation && currentUserData.accommodation[currentDay] ? "bg-green-500/20" : "bg-red-500/20"
                    }`}>
                      <Text className={`text-xs font-semibold ${currentUserData.accommodation && currentUserData.accommodation[currentDay] ? "text-green-400" : "text-red-400"}`}>{currentUserData.accommodation && currentUserData.accommodation[currentDay] ? "Yes" : "No"}</Text>
                    </View>
                  </View>

                  {(Object.keys(currentUserData.accommodation || {}) as DayCode[])
                    .filter(
                      (dayKey) =>
                        currentUserData.accommodation &&
                        currentUserData.accommodation[dayKey]
                    )
                    .map((dayKey) => (
                      <View
                        key={dayKey}
                        className="flex-row items-center justify-between mb-2"
                      >
                        <Text className="text-white text-sm">
                          Accommodation - {getDayDate(dayKey)}
                        </Text>
                        <View className="px-3 py-1 rounded-full bg-green-500/20">
                          <Text className="text-xs font-semibold text-green-400">Yes</Text>
                        </View>
                      </View>
                    ))}
                </View>

                {/* Check-in Status */}
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-white text-sm">Current Status</Text>
                  <View
                    className={`px-3 py-1 rounded-full ${
                      currentUserData.checkInStatus.accommodation
                        ? "bg-green-500/20"
                        : "bg-gray-500/20"
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        currentUserData.checkInStatus.accommodation
                          ? "text-green-400"
                          : "text-gray-400"
                      }`}
                    >
                      {currentUserData.checkInStatus.accommodation
                        ? "Checked In"
                        : "Pending"}
                    </Text>
                  </View>
                </View>

                {/* Assigned Hostel */}
                {currentUserData.checkInStatus.Hostel && (
                  <View className="flex-row items-center justify-between mb-4">
                    <Text className="text-white text-sm">Assigned Hostel</Text>
                    <Text className="text-[#FFBA00] text-sm font-semibold">
                      {currentUserData.checkInStatus.Hostel}
                    </Text>
                  </View>
                )}

                {/* Action Buttons */}
               
                    {currentUserData.checkInStatus.fest ? (
                      // User has valid gate entry
                      <>
                        {!currentUserData.checkInStatus.accommodation ? (
                          // Show check-in button if not checked in
                          <TouchableOpacity
                            className="bg-[#3B82F6] py-3 rounded-xl mb-3"
                            onPress={() => setShowHostelInput(true)}
                            disabled={loading}
                            activeOpacity={0.7}
                          >
                            <Text className="text-white text-center font-semibold text-sm">
                              Confirm Check-in
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          // Show revert button if already checked in
                          <TouchableOpacity
                            className="bg-red-600 py-3 rounded-xl mb-3"
                            onPress={handleRevertCheckin}
                            disabled={loading}
                            activeOpacity={0.7}
                          >
                            <Text className="text-white text-center font-semibold text-sm">
                              {loading ? "Updating..." : "Revert to Pending"}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </>
                    ) : (
                      // User hasn't entered through gate
                      <View className="bg-red-500/20 p-3 rounded-xl">
                        <Text className="text-red-400 text-center text-sm">
                          ❌ Cannot check-in: User must enter through gate first
                        </Text>
                      </View>
                    )}

              </View>
            </View>

            {/* Close Button */}
            <TouchableOpacity
              className="bg-[#FFBA00] py-4 rounded-xl mt-8 mx-2"
              onPress={onClose}
              activeOpacity={0.7}
              disabled={loading}
            >
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className="text-[#121212] text-center text-base"
              >
                Close
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Loading Overlay */}
          {loading && (
            <View className="absolute inset-0 bg-black/50 rounded-2xl items-center justify-center">
              <ActivityIndicator size="large" color="#FFBA00" />
              <Text className="text-white text-sm mt-2">Updating...</Text>
            </View>
          )}
        </View>
      </View>

      {/* Hostel Name Input Modal */}
      <Modal
        visible={showHostelInput}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowHostelInput(false)}
      >
        <View className="flex-1 bg-black/70 justify-center items-center px-6">
          <View className="bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-sm border border-[#2C2C2C]">
            <Text
              style={{ fontFamily: "Outfit_600SemiBold" }}
              className="text-white text-xl mb-4 text-center"
            >
              Enter Hostel Name
            </Text>

            <TextInput
              className="bg-[#2C2C2C] text-white p-4 rounded-xl mb-6 text-base"
              placeholder="Enter hostel name..."
              placeholderTextColor="#666"
              value={hostelName}
              onChangeText={setHostelName}
              autoFocus={true}
              style={{ fontFamily: "Outfit_400Regular" }}
            />

            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 bg-gray-600 py-3 rounded-xl"
                onPress={() => {
                  setShowHostelInput(false);
                  setHostelName("");
                }}
                activeOpacity={0.7}
              >
                <Text className="text-white text-center font-semibold">
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 bg-[#3B82F6] py-3 rounded-xl"
                onPress={handleHostelCheckin}
                disabled={!hostelName.trim() || loading}
                activeOpacity={0.7}
              >
                <Text className="text-white text-center font-semibold">
                  {loading ? "Confirming..." : "Confirm"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

export default HostelUserModal;
