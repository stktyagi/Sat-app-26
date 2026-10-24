import {
  View,
  ScrollView,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  FlatList,
  Image,
  StatusBar,
} from "react-native";
import { useEffect, useState } from "react";
import { FirebaseEvent } from "@/types/models";
import { getAllEventsForAdmin } from "@/api/admin";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  Search,
  Filter,
  ImageIcon,
} from "lucide-react-native";
import { Input } from "@/components";
import { useUserStore } from "@/state/userStore";
import { useThemeStore } from "@/state/themeStore";
import { useAdminNavigation } from "@/hooks/useAdminNavigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getUserRoles,
  isEventCoordinator,
  ROLE_ADMIN,
  ROLE_EB_EVENTS,
  ROLE_EVENT_POC,
} from "@/utils/roles";

export default function EventsManagement() {
  const navigation = useAdminNavigation();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const [events, setEvents] = useState<FirebaseEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<FirebaseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const { userData: userProfile } = useUserStore();

  const loadEvents = async () => {
    setLoading(true);
    try {
      const res = await getAllEventsForAdmin();
      const roles = getUserRoles(userProfile);
      const isGlobalEventAdmin = roles.some((r) => [ROLE_ADMIN, ROLE_EB_EVENTS].includes(r));

      let accessibleEvents = res;
      if (!isGlobalEventAdmin && roles.includes(ROLE_EVENT_POC)) {
        accessibleEvents = res.filter((evt) => isEventCoordinator(userProfile, evt));
      }
      setEvents(accessibleEvents);
      setFilteredEvents(accessibleEvents);
    } catch (error) {
      // Error loading events
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  // Filter events based on search and category
  useEffect(() => {
    let filtered = events;

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (event) =>
          event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          event.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          event.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter(
        (event) => event.category === selectedCategory
      );
    }

    setFilteredEvents(filtered);
  }, [events, searchQuery, selectedCategory]);

  // Get unique categories
  const categories = [
    "all",
    ...Array.from(new Set(events.map((event) => event.category))),
  ];

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "Date TBD";
    }
  };

  const getEventStatusColor = (event: FirebaseEvent) => {
    const now = new Date();
    const eventDate = new Date(event.dateTime || event.startDateTime);

    if (eventDate < now) return "#6B7280"; // Gray - Past event
    if (event.isLive) return "#10B981"; // Green - Live now
    return "#41B8F0"; // Cyan/Blue - Upcoming
  };

  const cardBg = isDark ? "#1C1C20" : "#FFFFFF";
  const cardBorder = isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)";
  const textPrimary = isDark ? "#FFFFFF" : "#111827";
  const textSecondary = isDark ? "#9CA3AF" : "#6B7280";

  const renderEventCard = ({ item }: { item: FirebaseEvent }) => (
    <TouchableOpacity
      style={{
        flexDirection: "row",
        height: 140,
        backgroundColor: cardBg,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: cardBorder,
        marginBottom: 14,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 8,
        elevation: 3,
      }}
      onPress={() =>
        navigation.navigate("AdminEventDetails", {
          eventId: item.eventId,
          event: item,
        })
      }
      activeOpacity={0.75}
    >
      {/* Event Image */}
      <View style={{ width: 105, height: "100%", backgroundColor: isDark ? "#2A2A30" : "#E5E7EB" }}>
        {item.coverImage ? (
          <Image
            source={{ uri: item.coverImage }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={{
              width: "100%",
              height: "100%",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <ImageIcon size={26} color={textSecondary} />
          </View>
        )}
      </View>

      {/* Content */}
      <View style={{ flex: 1, padding: 12, justifyContent: "space-between" }}>
        {/* Header with Title and Status */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text
              style={{
                fontFamily: "Poppins_600SemiBold",
                color: textPrimary,
                fontSize: 15,
              }}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text
              style={{
                fontFamily: "Poppins_400Regular",
                color: textSecondary,
                fontSize: 11,
                marginTop: 1,
              }}
              numberOfLines={1}
            >
              {item.shortDescription || item.description}
            </Text>
          </View>

          {/* Status Badge */}
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 12,
              backgroundColor: getEventStatusColor(item) + "20",
            }}
          >
            <Text
              style={{
                fontFamily: "Poppins_600SemiBold",
                fontSize: 10,
                color: getEventStatusColor(item),
              }}
            >
              {new Date(item.dateTime || item.startDateTime) < new Date()
                ? "Past"
                : item.isLive
                ? "Live"
                : "Upcoming"}
            </Text>
          </View>
        </View>

        {/* Details */}
        <View style={{ gap: 4 }}>
          {/* Date */}
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Calendar size={13} color="#41B8F0" />
            <Text
              style={{
                fontFamily: "Poppins_500Medium",
                color: textSecondary,
                fontSize: 11,
                marginLeft: 6,
              }}
              numberOfLines={1}
            >
              {formatDate(item.dateTime || item.startDateTime)}
            </Text>
          </View>

          {/* Venue */}
          {item.venueName && (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <MapPin size={13} color="#41B8F0" />
              <Text
                style={{
                  fontFamily: "Poppins_500Medium",
                  color: textSecondary,
                  fontSize: 11,
                  marginLeft: 6,
                }}
                numberOfLines={1}
              >
                {item.venueName}
              </Text>
            </View>
          )}

          {/* Type & Category */}
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Users size={13} color="#41B8F0" />
            <Text
              style={{
                fontFamily: "Poppins_500Medium",
                color: textSecondary,
                fontSize: 11,
                marginLeft: 6,
                textTransform: "capitalize",
              }}
            >
              {item.eventType} • {item.category}
            </Text>
          </View>
        </View>

        {/* Badges */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 2 }}>
          {item.isFeatured && (
            <View style={{ backgroundColor: "#10B98120", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
              <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#10B981", fontSize: 10 }}>
                Featured
              </Text>
            </View>
          )}
          {item.paymentRequired && (
            <View style={{ backgroundColor: "#F59E0B20", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
              <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#F59E0B", fontSize: 10 }}>Paid</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

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
          backgroundColor: isDark ? "#1C1C20" : "#FFFFFF",
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
          onPress={() => navigation.navigate("Dashboard")}
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
              fontFamily: "Talina",
              fontSize: 22,
              color: textPrimary,
              letterSpacing: 0.5,
            }}
          >
            Events Management
          </Text>
          <Text
            style={{
              fontFamily: "Poppins_400Regular",
              fontSize: 12,
              color: "#41B8F0",
              marginTop: 1,
            }}
          >
            Manage all events and registrations
          </Text>
        </View>
      </View>

      {/* Search and Filter */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <Input
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search events by title, category..."
        />

        {/* Category Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 12 }}
          contentContainerStyle={{ gap: 8 }}
        >
          {categories.map((category) => {
            const isSelected = selectedCategory === category;
            return (
              <TouchableOpacity
                key={category}
                onPress={() => setSelectedCategory(category)}
                activeOpacity={0.75}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 7,
                  borderRadius: 20,
                  backgroundColor: isSelected ? "#41B8F0" : cardBg,
                  borderWidth: 1,
                  borderColor: isSelected ? "#41B8F0" : cardBorder,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: isSelected ? "Poppins_600SemiBold" : "Poppins_500Medium",
                    fontSize: 12.5,
                    color: isSelected ? "#FFFFFF" : textSecondary,
                    textTransform: "capitalize",
                  }}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Events List */}
      <View style={{ flex: 1, paddingHorizontal: 20 }}>
        {loading ? (
          <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 48 }}>
            <ActivityIndicator size="large" color="#41B8F0" />
            <Text style={{ fontFamily: "Poppins_500Medium", color: textSecondary, marginTop: 12 }}>
              Loading events...
            </Text>
          </View>
        ) : filteredEvents.length === 0 ? (
          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: 20,
              padding: 32,
              alignItems: "center",
              borderWidth: 1,
              borderColor: cardBorder,
              marginTop: 16,
            }}
          >
            <Calendar size={42} color={textSecondary} />
            <Text
              style={{
                fontFamily: "Poppins_500Medium",
                color: textSecondary,
                textAlign: "center",
                marginTop: 12,
                fontSize: 14,
              }}
            >
              {searchQuery || selectedCategory !== "all"
                ? "No events match your search criteria"
                : "No events found"}
            </Text>
          </View>
        ) : (
          <>
            <Text
              style={{
                fontFamily: "Poppins_600SemiBold",
                fontSize: 14,
                color: textPrimary,
                marginBottom: 10,
              }}
            >
              {filteredEvents.length} Event{filteredEvents.length !== 1 ? "s" : ""} Found
            </Text>
            <FlatList
              data={filteredEvents}
              renderItem={renderEventCard}
              keyExtractor={(item) => item.eventId}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 60 }}
            />
          </>
        )}
      </View>
    </View>
  );
}
