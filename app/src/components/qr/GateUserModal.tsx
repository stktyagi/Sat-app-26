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
  const [loading, setLoading] = useState(false);
  /* Removed API call */
  /* Removed API call */
  const [showEventsList, setShowEventsList] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [remark, setRemark] = useState("");
  const [showRemarkInput, setShowRemarkInput] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Update local state when userData prop changes
  React.useEffect(() => {
    setCurrentUserData(userData);
    // Set remark from existing data if available
    if (userData?.checkInStatus?.remark) {
      setRemark(userData.checkInStatus.remark);
    } else {
      setRemark("");
    }
    setShowRemarkInput(false);
  }, [userData]);

  // Fetch user events when modal opens
  /* Removed API call */

  if (!currentUserData) return null;

  const handleFestStatusUpdate = async (newStatus: boolean) => {
    setLoading(true);
    try {
      /* Removed API call */

      if (result.success) {
        // Update local state
        const updatedData = {
          ...currentUserData,
          checkInStatus: {
            ...currentUserData.checkInStatus,
            fest: newStatus,
            remark: remark || null,
          },
        };
        setCurrentUserData(updatedData);

        // Notify parent component
        if (onUserDataUpdate) {
          onUserDataUpdate(updatedData);
        }

        setShowRemarkInput(false);

        // Show success banner instead of alert modal
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
                <Text className="text-gray-300 text-sm">Gate Entry</Text>
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

              {/* Fest Entry Status & Actions */}
              <View className="bg-[#2C2C2C] rounded-xl p-5 mx-2">
                <Text className="text-gray-400 text-sm mb-4">
                  Fest Entry Status
                </Text>

                {/* Fest Check-in Status */}
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-white text-sm">Current Status</Text>
                  <View
                    className={`px-3 py-1 rounded-full ${
                      currentUserData.checkInStatus.fest
                        ? "bg-green-500/20"
                        : "bg-gray-500/20"
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        currentUserData.checkInStatus.fest
                          ? "text-green-400"
                          : "text-gray-400"
                      }`}
                    >
                      {currentUserData.checkInStatus.fest
                        ? "Confirmed"
                        : "Pending"}
                    </Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View className="flex-row gap-3">
                  {!currentUserData.checkInStatus.fest ? (
                    <TouchableOpacity
                      className={`flex-1 py-3 rounded-xl ${
                        currentUserData.checkInStatus.fest
                          ? "bg-gray-600"
                          : "bg-green-600"
                      }`}
                      onPress={() => handleFestStatusUpdate(true)}
                      disabled={loading || currentUserData.checkInStatus.fest}
                      activeOpacity={0.7}
                    >
                      <Text className="text-white text-center font-semibold text-sm">
                        {loading ? "Updating..." : "Confirm Entry"}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      className={`flex-1 py-3 rounded-xl ${
                        !currentUserData.checkInStatus.fest
                          ? "bg-gray-600"
                          : "bg-red-600"
                      }`}
                      onPress={() => handleFestStatusUpdate(false)}
                      disabled={loading || !currentUserData.checkInStatus.fest}
                      activeOpacity={0.7}
                    >
                      <Text className="text-white text-center font-semibold text-sm">
                        {loading ? "Updating..." : "Revert to Pending"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Remark Section */}
              <View className="bg-[#2C2C2C] rounded-xl p-5 mx-2">
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-gray-400 text-sm">Remark</Text>
                  {currentUserData.checkInStatus.remark && !showRemarkInput && (
                    <TouchableOpacity
                      onPress={() => setShowRemarkInput(true)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="pencil" size={16} color="#FFBA00" />
                    </TouchableOpacity>
                  )}
                </View>

                {showRemarkInput ? (
                  <>
                    <TextInput
                      className="bg-[#1a1a1a] text-white p-3 rounded-xl mb-3 text-sm"
                      placeholder="Enter remark (optional)..."
                      placeholderTextColor="#666"
                      value={remark}
                      onChangeText={setRemark}
                      multiline
                      numberOfLines={3}
                      style={{ fontFamily: "Outfit_400Regular", minHeight: 80 }}
                    />
                    <View className="flex-row gap-3">
                      <TouchableOpacity
                        className="flex-1 bg-gray-600 py-2 rounded-xl"
                        onPress={() => {
                          setRemark(currentUserData.checkInStatus.remark || "");
                          setShowRemarkInput(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text className="text-white text-center font-semibold text-xs">
                          Cancel
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="flex-1 bg-[#FFBA00] py-2 rounded-xl"
                        onPress={() =>
                          handleFestStatusUpdate(
                            currentUserData.checkInStatus.fest
                          )
                        }
                        disabled={loading}
                        activeOpacity={0.7}
                      >
                        <Text className="text-[#121212] text-center font-semibold text-xs">
                          {loading ? "Saving..." : "Save Remark"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    {currentUserData.checkInStatus.remark ? (
                      <Text
                        style={{ fontFamily: "Outfit_400Regular" }}
                        className="text-white text-sm mb-3"
                      >
                        {currentUserData.checkInStatus.remark}
                      </Text>
                    ) : (
                      <Text className="text-gray-500 text-sm italic mb-3">
                        No remark added
                      </Text>
                    )}
                    {!currentUserData.checkInStatus.fest && (
                      <TouchableOpacity
                        className="bg-[#3B82F6] py-2 rounded-xl"
                        onPress={() => setShowRemarkInput(true)}
                        activeOpacity={0.7}
                      >
                        <Text className="text-white text-center font-semibold text-xs">
                          {currentUserData.checkInStatus.remark
                            ? "Edit Remark"
                            : "Add Remark"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
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
                        <Text className="text-white text-xs mt-1">
                          Registation Status : {event.status}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </TouchableOpacity>

              {/* Accommodation Status */}
              <View className="bg-[#2C2C2C] rounded-xl p-5 mx-2">
                <Text className="text-gray-400 text-sm mb-4">
                  Accommodation Details
                </Text>

                {/* Accommodation Needed */}
                <View className="flex-row items-center justify-between mb-3">
                  <Text
                    style={{ fontFamily: "Outfit_500Medium" }}
                    className="text-white text-sm"
                  >
                    Accommodation Needed
                  </Text>
                  <View
                    className={`px-3 py-1 rounded-full ${
                      currentUserData.accommodationNeeded
                        ? "bg-green-500/20"
                        : "bg-red-500/20"
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        currentUserData.accommodationNeeded
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {currentUserData.accommodationNeeded ? "Yes" : "No"}
                    </Text>
                  </View>
                </View>

                {/* Accommodation Check-in Status */}
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-white text-sm">Check-in Status</Text>
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
                        ? "Confirmed"
                        : "Pending"}
                    </Text>
                  </View>
                </View>

                {/* Hostel Assignment */}
                {currentUserData.checkInStatus.Hostel && (
                  <View className="flex-row items-center justify-between">
                    <Text className="text-white text-sm">Assigned Hostel</Text>
                    <Text className="text-[#FFBA00] text-sm font-semibold">
                      {currentUserData.checkInStatus.Hostel}
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
    </Modal>
  );
};

export default GateUserModal;
