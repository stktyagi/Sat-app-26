import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { FirebaseEvent } from "@/types/models";
import { getEventByIdForAdmin } from "@/api/admin";
import EventInfo from "./EventInfo";
import EventRegistrations from "./EventRegistrations";
import { useUserStore } from "@/state/userStore";
import { useLocalSearchParams } from "expo-router";
import { useAdminNavigation } from "@/hooks/useAdminNavigation";

export default function EventDetails() {
  const navigation = useAdminNavigation();
  const params = useLocalSearchParams();
  const eventId = String(params.eventId || "");
  let passedEvent: FirebaseEvent | undefined;
  try {
    passedEvent = params.event ? JSON.parse(String(params.event)) : undefined;
  } catch {
    passedEvent = undefined;
  }
  //if the roles include event_admin , admin , outreach_admin , outreach_member , hospitality_admin , hospitality_member , event_coordinator show registrations tab
  const showRegistrationsTab = () => {
    if (!userProfile) return false;

    const allowedRoles = [
      "event_admin",
      "admin",
      "outreach_admin",
      "outreach_member",
      "hospitality_member",
      "hospitality_admin",
      // "event_coordinator",
    ];
    //event_coordinator only if they are coordinator for this event
    if (userProfile.roles?.includes("event_coordinator")) {
      const isCoordinator = event?.coordinators?.some(
        (coordinator) => coordinator.email === userProfile.email
      );
      if (isCoordinator) return true;
    }

    return userProfile.roles?.some((role) => allowedRoles.includes(role));
  };

  const [event, setEvent] = useState<FirebaseEvent | null>(passedEvent || null);
  const { userData: userProfile } = useUserStore();
  const [loading, setLoading] = useState(!passedEvent);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("info"); // 'info' or 'registrations'

  useEffect(() => {
    if (!passedEvent) {
      loadEventDetails();
    }
  }, [eventId, passedEvent]);

  const loadEventDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const eventData = await getEventByIdForAdmin(eventId);
      if (eventData) {
        setEvent(eventData);
      } else {
        setError("Event not found");
      }
    } catch (err) {
      setError("Failed to load event details");
    } finally {
      setLoading(false);
    }
  };

  const handleEventUpdate = (updatedEvent: FirebaseEvent) => {
    setEvent(updatedEvent);
  };

  // Custom Tab Button Component (matching your TeamScreen pattern)
  const TabButton = ({ title, tabKey }: { title: string; tabKey: string }) => (
    <TouchableOpacity
      className={`flex-1 items-center py-3 border-b-2 ${
        activeTab === tabKey ? "border-[#EEB170]" : "border-transparent"
      }`}
      onPress={() => setActiveTab(tabKey)}
      activeOpacity={0.7}
    >
      <Text
        className={`text-lg font-semibold ${
          activeTab === tabKey ? "text-[#EEB170]" : "text-[#2175C0]"
        }`}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View className="flex-1 bg-transparent items-center justify-center">
        <ActivityIndicator size="large" color="#EEB170" />
        <Text className="text-[#2175C0] mt-4">Loading event details...</Text>
      </View>
    );
  }

  if (error || !event) {
    return (
      <View className="flex-1 bg-transparent items-center justify-center px-6">
        <Text className="text-red-400 text-lg font-bold mb-2">Error</Text>
        <Text className="text-[#2175C0] text-center mb-6">
          {error || "Event not found"}
        </Text>
        <TouchableOpacity
          className="bg-[#EEB170] px-6 py-3 rounded-xl"
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text className="text-[#121212] font-bold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-transparent">
      {/* Header */}
      <View className="bg-[#EEB170] pt-4 rounded-b-2xl pb-6 px-6 flex-row items-center">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="mr-4"
          activeOpacity={0.7}
        >
          <ArrowLeft size={28} color="#121212" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text style={{ fontFamily: "Outfit_600SemiBold" }} className="text-[#121212] text-xl" numberOfLines={2}>
            {event.title}
          </Text>
          <Text style={{ fontFamily: "Outfit_400Regular" }} className="text-[#121212] text-sm opacity-80">
            Event Management
          </Text>
        </View>
      </View>

      {/* Custom Tabs */}
      <View className="flex-row justify-around mb-4 mt-3 px-6">
        <TabButton title="Event Info" tabKey="info" />
        { showRegistrationsTab() && (
          <TabButton title="Registrations" tabKey="registrations" />
        )}
      </View>

      {/* Tab Content */}
      {activeTab === "info" ? (
        <EventInfo
          event={event}
          onEventUpdate={handleEventUpdate}
          navigation={navigation}
        />
      ) : (
        <EventRegistrations
          eventId={eventId}
          event={event}
          navigation={navigation}
        />
      )}
    </View>
  );
}
