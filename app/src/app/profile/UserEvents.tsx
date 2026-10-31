import React, { useState, useCallback } from "react";
import { Text, View, ScrollView, TouchableOpacity, ActivityIndicator, StatusBar, Alert } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUserStore } from "@/state/userStore";
import { useThemeStore } from "@/state/themeStore";
import { useMyEvents } from '@/hooks/useMyEvents';
import { isEventPaymentDue } from '@/utils/paymentHelpers';

const UserEventsScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const [activeFilter, setActiveFilter] = useState('all');
  const { userData: userProfile } = useUserStore();

  const { data: rows, loading, refresh } = useMyEvents();

  const bgColor = isDark ? '#131316' : '#E0E0E0';
  const cardBg = isDark ? '#1C1C20' : '#FFFFFF';
  const cardBorder = isDark ? '#2A2A30' : '#D5D5D5';
  const textColor = isDark ? '#FFFFFF' : '#111827';
  const subTextColor = isDark ? '#A0A0A0' : '#6B7280';

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const userId = userProfile?.userId;
  const events = rows.map((row: any) => {
    let displayStatus = row.registration?.status || 'confirmed';
    if (
      row.registration?.paymentStatus === 'pending' ||
      isEventPaymentDue({
        event: row.event,
        team: row.team,
        registration: row.registration,
        userId,
      })
    ) {
      displayStatus = 'payment_pending';
    }

    // If event is missing (e.g. deleted or archived from DB), format the eventId into a human-readable title
    const rawEventId = row.registration?.eventId || row.event?.eventId || row.event?.id || "";
    const formattedSlugTitle = rawEventId
      ? rawEventId
          .split("-")
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")
      : "Archived Event";

    const fallbackName = row.registration?.eventName || (formattedSlugTitle || "Archived Event");
    
    return {
      ...row.registration,
      eventId: row.event?.eventId || row.event?.id || row.registration?.eventId,
      eventName: row.event?.title || fallbackName,
      eventCategory: row.event?.category || row.registration?.eventCategory || (row.event ? "General" : "Archived"),
      event: row.event,
      isUnavailable: !row.event,
      status: displayStatus,
    };
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return {
          bg: isDark ? 'rgba(34, 197, 94, 0.15)' : '#DCFCE7',
          color: '#22c55e',
          label: 'Confirmed',
        };
      case 'pending':
        return {
          bg: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7',
          color: '#f59e0b',
          label: 'Pending',
        };
      case 'awaited':
        return {
          bg: isDark ? 'rgba(65, 184, 240, 0.15)' : '#E0F2FE',
          color: '#41B8F0',
          label: 'Awaited',
        };
      case 'payment_pending':
        return {
          bg: isDark ? 'rgba(249, 115, 22, 0.15)' : '#FFEDD5',
          color: '#f97316',
          label: 'Payment Due',
        };
      case 'rejected':
        return {
          bg: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2',
          color: '#ef4444',
          label: 'Rejected',
        };
      default:
        return {
          bg: isDark ? '#26262B' : '#F3F4F6',
          color: subTextColor,
          label: status.charAt(0).toUpperCase() + status.slice(1),
        };
    }
  };

  const filteredEvents = events.filter(event => {
    if (activeFilter === 'all') return true;
    return event.status === activeFilter;
  });

  const availableStatuses = Array.from(new Set(events.map(e => e.status)));

  const FilterButton = ({ title, filterKey }: { title: string, filterKey: string }) => {
    const isSelected = activeFilter === filterKey;
    return (
      <TouchableOpacity
        style={{
          paddingHorizontal: 18,
          paddingVertical: 8,
          borderRadius: 20,
          marginRight: 10,
          borderWidth: 1.5,
          borderColor: isSelected ? '#41B8F0' : cardBorder,
          backgroundColor: isSelected ? (isDark ? 'rgba(65, 184, 240, 0.15)' : '#E0F2FE') : cardBg,
        }}
        onPress={() => setActiveFilter(filterKey)}
      >
        <Text
          style={{
            fontFamily: isSelected ? 'Poppins_600SemiBold' : 'Poppins_500Medium',
            color: isSelected ? '#41B8F0' : subTextColor,
            fontSize: 13,
          }}
        >
          {title}
        </Text>
      </TouchableOpacity>
    );
  };

  const getStatusDisplayTitle = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Confirmed';
      case 'pending': return 'Pending';
      case 'payment_pending': return 'Payment Due';
      case 'rejected': return 'Rejected';
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: bgColor, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#41B8F0" />
        <Text style={{ fontFamily: 'Poppins_500Medium', color: subTextColor, marginTop: 16 }}>
          Loading your registered events...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Top Header */}
      <View
        style={{
          paddingTop: Math.max(insets.top + 8, 44),
          paddingBottom: 16,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: bgColor,
          borderBottomWidth: 1,
          borderBottomColor: cardBorder,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: cardBg,
            borderWidth: 1,
            borderColor: cardBorder,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 14,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={textColor} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text
            style={{ fontFamily: "Talina", fontSize: 24, color: textColor, letterSpacing: 0.5 }}
          >
            MY EVENTS
          </Text>
          <Text style={{ fontFamily: "Poppins_500Medium", fontSize: 13, color: '#41B8F0' }}>
            Registered Competitions & Activities
          </Text>
        </View>
      </View>

      {/* Filters Bar */}
      {events.length > 0 && (
        <View style={{ paddingVertical: 14, paddingHorizontal: 20 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <FilterButton title="All" filterKey="all" />
            {availableStatuses.map(status => (
              <FilterButton 
                key={status} 
                title={getStatusDisplayTitle(status as string)} 
                filterKey={status as string} 
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Events List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {filteredEvents.length === 0 ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 64 }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: cardBg, borderWidth: 1, borderColor: cardBorder, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Ionicons name="calendar-outline" size={40} color={subTextColor} />
            </View>
            <Text style={{ fontFamily: 'Talina', color: textColor, fontSize: 20, marginBottom: 8, textAlign: 'center' }}>
              {activeFilter === 'all' ? 'NO EVENTS REGISTERED' : `NO ${activeFilter.toUpperCase()} EVENTS`}
            </Text>
            <Text style={{ fontFamily: 'Poppins_400Regular', color: subTextColor, textAlign: 'center', marginBottom: 24, lineHeight: 22, fontSize: 14 }}>
              {activeFilter === 'all'
                ? "You haven't registered for any events yet.\nExplore competitions and activities now!"
                : `No registrations found with ${activeFilter} status.`}
            </Text>

            {activeFilter === 'all' && (
              <TouchableOpacity 
                onPress={() => router.push('/(tabs)/events')}
                style={{ backgroundColor: '#41B8F0', borderRadius: 16, paddingHorizontal: 24, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}
              >
                <Ionicons name="compass-outline" size={18} color="#FFFFFF" />
                <Text style={{ fontFamily: 'Poppins_600SemiBold', color: '#FFFFFF', fontSize: 15, marginLeft: 8 }}>
                  Explore Events
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View>
            {filteredEvents.map((event, idx) => {
              const badge = getStatusBadge(event.status);
              return (
                <TouchableOpacity
                  key={event.eventId || event.registrationId || `evt-${idx}`}
                  onPress={() => {
                    if (event.isUnavailable) {
                      Alert.alert(
                        "Event Unavailable",
                        "This event has been archived or removed from the festival schedule."
                      );
                      return;
                    }
                    router.push({ pathname: '/events/MyEventDetails', params: { eventId: event.eventId } });
                  }}
                  style={{
                    backgroundColor: cardBg,
                    borderWidth: 1,
                    borderColor: cardBorder,
                    borderRadius: 20,
                    padding: 18,
                    marginBottom: 14,
                    opacity: event.isUnavailable ? 0.75 : 1,
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={{ fontFamily: 'Poppins_600SemiBold', color: textColor, fontSize: 17, marginBottom: 4 }}>
                        {event.eventName}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ backgroundColor: event.isUnavailable ? (isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2') : (isDark ? 'rgba(65, 184, 240, 0.12)' : 'rgba(65, 184, 240, 0.1)'), paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                          <Text style={{ fontFamily: 'Poppins_500Medium', color: event.isUnavailable ? '#EF4444' : '#41B8F0', fontSize: 11, textTransform: 'capitalize' }}>
                            {event.eventCategory}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={{ backgroundColor: badge.bg, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}>
                      <Text style={{ fontFamily: 'Poppins_600SemiBold', color: badge.color, fontSize: 12 }}>
                        {badge.label}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default UserEventsScreen;
