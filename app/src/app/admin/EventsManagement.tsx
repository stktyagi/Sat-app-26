import {
  View,
  ScrollView,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  FlatList,
  Image,
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

export default function EventsManagement({ navigation }: { navigation: any }) {
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
      setEvents(res);
      setFilteredEvents(res);
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
    const registrationDeadline = new Date(event.registrationDeadline);

    if (eventDate < now) return "#6B7280"; // Gray - Past event
    if (registrationDeadline < now) return "#EF4444"; // Red - Registration closed
    if (event.isFeatured) return "#10B981"; // Green - Featured
    return "#3B82F6"; // Blue - Active
  };

  const getEventStatusText = (event: FirebaseEvent) => {
    const now = new Date();
    const eventDate = new Date(event.dateTime || event.startDateTime);
    const registrationDeadline = new Date(event.registrationDeadline);

    if (eventDate < now) return "Completed";
    if (registrationDeadline < now) return "Registration Closed";
    if (event.isFeatured) return "Featured";
    return "Active";
  };

  const renderEventCard = ({ item }: { item: FirebaseEvent }) => (
    <TouchableOpacity
      className="bg-[#FFFFFF66] rounded-2xl mb-4 border border-[#A0B3D0] overflow-hidden"
      onPress={() =>
        navigation.navigate("AdminEventDetails", {
          eventId: item.eventId,
          event: item,
        })
      }
      activeOpacity={0.7}
      style={{ flexDirection: "row", height: 150 }}
    >
      {/* Event Image - Full Height */}
      <View style={{ width: 100, height: "100%", backgroundColor: '#A0B3D0' }}>
        {item.coverImage ? (
          <Image
            source={{
              uri: item.coverImage,
            }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
            onError={() => {
              // Image load error
            }}
            onLoad={() => {
              // Image loaded successfully
            }}
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
            <ImageIcon size={24} color="#666" />
          </View>
        )}
      </View>

      {/* All Event Content on the Right */}
      <View className="flex-1 p-3 justify-between">
        {/* Header with Title and Status */}
        <View className="flex-row items-start justify-between mb-1">
          <View className="flex-1 mr-2">
            <Text
            style={{ fontFamily: "Outfit_600SemiBold" }}
              className="text-[#0C3572] text-base mb-1"
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text style={{ fontFamily: "Outfit_400Regular" }} className="text-[#2175C0] text-xs" numberOfLines={1} ellipsizeMode="tail">
              {item.shortDescription || item.description}
            </Text>
          </View>

          {/* Status Badge */}
          <View
            className="px-2 py-1 rounded-full"
            style={{ backgroundColor: getEventStatusColor(item) + "20" }}
          >
            <Text

              className="text-xs"
              style={{ color: getEventStatusColor(item), fontFamily: "Outfit_500Medium" }}
            >
              {getEventStatusText(item)}
            </Text>
          </View>
        </View>

        {/* Event Details */}
        <View className=" flex-col gap-1">
          {/* Date */}
          <View className="flex-row items-center">
            <Calendar size={12} color="#EEB170" />

            <Text style={{ fontFamily: "Outfit_400Regular" }} className="text-[#2175C0] text-xs ml-2">
              {formatDate(item.dateTime || item.startDateTime)}
            </Text>
          </View>

          {/* Venue */}
          {item.venueName && (
            <View className="flex-row items-center">
              <MapPin size={12} color="#EEB170" />
              <Text style={{ fontFamily: "Outfit_400Regular" }} className="text-[#2175C0] text-xs ml-2" numberOfLines={1}>
                {item.venueName}
              </Text>
            </View>
          )}

          {/* Event Type & Category */}
          <View className="flex-row items-center">
            <Users size={12} color="#EEB170" />
            <Text style={{ fontFamily: "Outfit_400Regular" }} className="text-[#2175C0] text-xs ml-2 capitalize">
              {item.eventType} • {item.category}
            </Text>
          </View>
        </View>

        {/* Event Badges */}
        <View className="flex-row flex-wrap mt-1 gap-1">
          {item.isFeatured && (
            <View className="bg-[#10B981]/20 px-1.5 py-0.5 rounded">
              <Text style={{ fontFamily: "Outfit_500Medium" }} className="text-[#10B981] text-xs">
                Featured
              </Text>
            </View>
          )}
          {item.paymentRequired && (
            <View className="bg-[#F59E0B]/20 px-1.5 py-0.5 rounded">
              <Text style={{ fontFamily: "Outfit_500Medium" }} className="text-[#F59E0B] text-xs">Paid</Text>
            </View>
          )}
          {!item.isPublic && (
            <View className="bg-[#EF4444]/20 px-1.5 py-0.5 rounded">
              <Text style={{ fontFamily: "Outfit_500Medium" }} className="text-[#EF4444] text-xs">Private</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-transparent">
      {/* Header */}
      <View className="bg-[#EEB170] pt-6 rounded-b-2xl pb-6 px-6 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => navigation.navigate("Dashboard")}
          className="mr-4"
          activeOpacity={0.7}
        >
          <ArrowLeft size={28} color="#121212" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-[#121212] text-2xl font-bold">
            Events Management
          </Text>
          <Text className="text-[#121212] text-sm opacity-80">
            Manage all events and registrations
          </Text>
        </View>
      </View>

      {/* Search and Filter */}
      <View className="p-6 pb-0">
        <Input
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search events..."
          className="mb-4"
        />

        {/* Category Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-4"
        >
          <View className="flex-row gap-3">
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                className={`${selectedCategory === category ? 'border-[#E84054]' : 'border-[#A0B3D0]'} w-28 py-2 rounded-2xl border-2 mr-2 items-center justify-center`}
                onPress={() => setSelectedCategory(category)}
                activeOpacity={0.7}
              >
                <Text
                   style={{ fontFamily: 'Outfit_500Medium' }} className={`${selectedCategory === category ? 'text-[#E84054]' : 'text-[#a4a4a4]'}  font-medium`}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Events List */}
      <View className="flex-1 px-6">
        {loading ? (
          <View className="items-center justify-center py-12">
            <ActivityIndicator size="large" color="#EEB170" />
            <Text className="text-[#2175C0] mt-4">Loading events...</Text>
          </View>
        ) : filteredEvents.length === 0 ? (
          <View className="bg-[#FFFFFF66] rounded-2xl p-8 items-center border border-[#A0B3D0]">
            <Calendar size={48} color="#555" />
            <Text className="text-[#2175C0] text-center mt-4">
              {searchQuery || selectedCategory !== "all"
                ? "No events match your search criteria"
                : "No events found"}
            </Text>
          </View>
        ) : (
          <>
            <Text className="text-[#EEB170] text-lg font-bold mb-4">
              {filteredEvents.length} Event
              {filteredEvents.length !== 1 ? "s" : ""} Found
            </Text>
            <FlatList
              data={filteredEvents}
              renderItem={renderEventCard}
              keyExtractor={(item) => item.eventId}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 100 }}
            />
          </>
        )}
      </View>
    </View>
  );
}
