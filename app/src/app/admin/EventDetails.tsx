import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StatusBar } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { FirebaseEvent } from "@/types/models";
import { getEventByIdForAdmin } from "@/api/admin";
import EventInfo from "./EventInfo";
import EventRegistrations from "./EventRegistrations";
import { useUserStore } from "@/state/userStore";
import { useThemeStore } from "@/state/themeStore";
import { useLocalSearchParams } from "expo-router";
import { useAdminNavigation } from "@/hooks/useAdminNavigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  hasAnyRole,
  isEventCoordinator,
  ROLE_ADMIN,
  ROLE_EB_EVENTS,
  ROLE_EVENT_POC,
} from "@/utils/roles";

export default function EventDetails() {
  const navigation = useAdminNavigation();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const params = useLocalSearchParams();
  const eventId = String(params.eventId || "");
  let passedEvent: FirebaseEvent | undefined;
  try {
    passedEvent = params.event ? JSON.parse(String(params.event)) : undefined;
  } catch {
    passedEvent = undefined;
  }

  const { userData: userProfile } = useUserStore();
  const [event, setEvent] = useState<FirebaseEvent | null>(passedEvent || null);
  const [loading, setLoading] = useState(!passedEvent);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("info"); // 'info' or 'registrations'

  const showRegistrationsTab = () => {
    if (!userProfile) return false;

    if (hasAnyRole(userProfile, [ROLE_ADMIN, ROLE_EB_EVENTS])) return true;

    if (hasAnyRole(userProfile, [ROLE_EVENT_POC])) {
      return isEventCoordinator(userProfile, event);
    }

    return false;
  };

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

  const cardBg = isDark ? "#1C1C20" : "#FFFFFF";
  const cardBorder = isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)";
  const textPrimary = isDark ? "#FFFFFF" : "#111827";
  const textSecondary = isDark ? "#9CA3AF" : "#6B7280";

  const TabButton = ({ title, tabKey }: { title: string; tabKey: string }) => {
    const isSelected = activeTab === tabKey;
    return (
      <TouchableOpacity
        style={{
          flex: 1,
          alignItems: "center",
          paddingVertical: 12,
          borderBottomWidth: 2,
          borderBottomColor: isSelected ? "#41B8F0" : "transparent",
        }}
        onPress={() => setActiveTab(tabKey)}
        activeOpacity={0.75}
      >
        <Text
          style={{
            fontFamily: isSelected ? "Poppins_600SemiBold" : "Poppins_500Medium",
            fontSize: 15,
            color: isSelected ? "#41B8F0" : textSecondary,
          }}
        >
          {title}
        </Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? "#131316" : "#E0E0E0", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#41B8F0" />
        <Text style={{ fontFamily: "Poppins_500Medium", color: textSecondary, marginTop: 12 }}>
          Loading event details...
        </Text>
      </View>
    );
  }

  if (error || !event) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? "#131316" : "#E0E0E0", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
        <Text style={{ fontFamily: "Poppins_700Bold", color: "#EF4444", fontSize: 18, marginBottom: 8 }}>Error</Text>
        <Text style={{ fontFamily: "Poppins_500Medium", color: textSecondary, textAlign: "center", marginBottom: 20 }}>
          {error || "Event not found"}
        </Text>
        <TouchableOpacity
          style={{
            backgroundColor: "#41B8F0",
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 14,
          }}
          onPress={() => navigation.goBack()}
          activeOpacity={0.75}
        >
          <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#FFFFFF", fontSize: 14 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? "#131316" : "#E0E0E0" }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

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
          onPress={() => navigation.goBack()}
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
              fontFamily: "Poppins_600SemiBold",
              color: textPrimary,
              fontSize: 18,
            }}
            numberOfLines={1}
          >
            {event.title}
          </Text>
          <Text
            style={{
              fontFamily: "Poppins_400Regular",
              color: "#41B8F0",
              fontSize: 12,
              marginTop: 1,
            }}
          >
            Event Management
          </Text>
        </View>
      </View>

      {/* Custom Tabs */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-around",
          backgroundColor: cardBg,
          borderBottomWidth: 1,
          borderBottomColor: cardBorder,
          paddingHorizontal: 20,
        }}
      >
        <TabButton title="Event Info" tabKey="info" />
        {showRegistrationsTab() && (
          <TabButton title="Registrations" tabKey="registrations" />
        )}
      </View>

      {/* Tab Content */}
      <View style={{ flex: 1 }}>
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
    </View>
  );
}
