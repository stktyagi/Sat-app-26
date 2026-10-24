import {
  View,
  ScrollView,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { showAlert } from "@/components";
import { useEffect, useState } from "react";
import { Venue } from "@/types/models";
import {
  getVenues,
  createVenue,
  updateVenue,
  deleteVenue,
} from "@/api/admin";
import { Input } from "@/components";
import { ArrowLeft, Plus, Trash2, Edit, MapPin } from "lucide-react-native";
import { useAdminNavigation } from "@/hooks/useAdminNavigation";
import { useThemeStore } from "@/state/themeStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useContentCacheStore } from "@/state/contentCacheStore";

export default function VenueManagement() {
  const navigation = useAdminNavigation();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();

  const [data, setData] = useState<Venue[]>([]);
  const [createData, setCreateData] = useState<Partial<Venue>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Venue>>({});
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const bgColor = isDark ? "#131316" : "#E0E0E0";
  const cardBg = isDark ? "#1C1C20" : "#FFFFFF";
  const cardBorder = isDark ? "#2A2A30" : "#D5D5D5";
  const textPrimary = isDark ? "#FFFFFF" : "#111827";
  const textSecondary = isDark ? "#A0A0A0" : "#6B7280";

  const loadData = async () => {
    setLoading(true);
    const res = await getVenues();
    setData(res);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteVenue = async (item: Venue) => {
    showAlert(
      "Delete Venue",
      `Are you sure you want to delete ${item.venueName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingId(item.venueId);
            const success = await deleteVenue(item.venueId);
            if (success) {
              setData(data.filter((d) => d.venueId !== item.venueId));
              useContentCacheStore.getState().invalidateVenues();
            } else {
              showAlert("Error", "Failed to delete venue");
            }
            setDeletingId(null);
          },
        },
      ]
    );
  };

  const handleCreateVenue = async () => {
    if (!createData.venueName) {
      showAlert("Error", "Please enter venue name");
      return;
    }
    if (createData.lat === undefined || createData.lng === undefined) {
      showAlert("Error", "Please enter latitude and longitude");
      return;
    }

    setCreating(true);
    try {
      const success = await createVenue({
        venueName: createData.venueName,
        lat: createData.lat,
        lng: createData.lng,
      });

      if (success) {
        await loadData();
        setCreateData({});
        useContentCacheStore.getState().invalidateVenues();
        showAlert("Success", "Venue created successfully!");
      } else {
        showAlert("Error", "Failed to create venue");
      }
    } catch (error) {
      showAlert("Error", "Failed to create venue");
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateVenue = async () => {
    if (!editingId) return;

    try {
      const updates: Partial<Venue> = {};
      if (editData.venueName) updates.venueName = editData.venueName;
      if (editData.lat !== undefined) updates.lat = editData.lat;
      if (editData.lng !== undefined) updates.lng = editData.lng;

      const success = await updateVenue(editingId, updates);

      if (success) {
        await loadData();
        setEditingId(null);
        setEditData({});
        useContentCacheStore.getState().invalidateVenues();
        showAlert("Success", "Venue updated successfully!");
      } else {
        showAlert("Error", "Failed to update venue");
      }
    } catch (error) {
      showAlert("Error", "Failed to update venue");
      console.error(error);
    }
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
            Venue Management
          </Text>
          <Text
            style={{
              fontFamily: "Poppins_400Regular",
              fontSize: 12,
              color: "#41B8F0",
              marginTop: 1,
            }}
          >
            Create and manage event venues
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Create Venue Section */}
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 20,
            padding: 20,
            marginBottom: 24,
            borderWidth: 1,
            borderColor: cardBorder,
          }}
        >
          <Text
            style={{
              fontFamily: "Poppins_600SemiBold",
              color: textPrimary,
              fontSize: 18,
              marginBottom: 16,
            }}
          >
            Create New Venue
          </Text>

          <Input
            label="Venue Name"
            value={createData.venueName || ""}
            onChangeText={(value) => {
              setCreateData({
                ...createData,
                venueName: value,
              });
            }}
            placeholder="e.g., C Hall, OAT"
            style={{ marginBottom: 14 }}
          />

          <Input
            label="Latitude"
            value={createData.lat?.toString() || ""}
            onChangeText={(value) => {
              setCreateData({
                ...createData,
                lat: parseFloat(value) || 0,
              });
            }}
            placeholder="e.g., 30.353536"
            keyboardType="numeric"
            style={{ marginBottom: 14 }}
          />

          <Input
            label="Longitude"
            value={createData.lng?.toString() || ""}
            onChangeText={(value) => {
              setCreateData({
                ...createData,
                lng: parseFloat(value) || 0,
              });
            }}
            placeholder="e.g., 76.371240"
            keyboardType="numeric"
            style={{ marginBottom: 16 }}
          />

          <TouchableOpacity
            style={{
              backgroundColor: "#41B8F0",
              opacity: creating ? 0.7 : 1,
              paddingVertical: 14,
              borderRadius: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            }}
            disabled={creating}
            onPress={handleCreateVenue}
            activeOpacity={0.8}
          >
            {creating ? (
              <>
                <ActivityIndicator color="#FFFFFF" />
                <Text
                  style={{
                    fontFamily: "Poppins_600SemiBold",
                    color: "#FFFFFF",
                    fontSize: 15,
                    marginLeft: 8,
                  }}
                >
                  Creating...
                </Text>
              </>
            ) : (
              <>
                <Plus size={18} color="#FFFFFF" />
                <Text
                  style={{
                    fontFamily: "Poppins_600SemiBold",
                    color: "#FFFFFF",
                    fontSize: 15,
                    marginLeft: 8,
                  }}
                >
                  Create Venue
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Existing Venues */}
        <Text
          style={{
            fontFamily: "Poppins_600SemiBold",
            color: textPrimary,
            fontSize: 18,
            marginBottom: 14,
          }}
        >
          Active Venues ({data.length})
        </Text>

        {loading ? (
          <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 40 }}>
            <ActivityIndicator size="large" color="#41B8F0" />
            <Text style={{ fontFamily: "Poppins_400Regular", color: textSecondary, marginTop: 12 }}>
              Loading venues...
            </Text>
          </View>
        ) : data.length === 0 ? (
          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: 20,
              padding: 32,
              alignItems: "center",
              borderWidth: 1,
              borderColor: cardBorder,
            }}
          >
            <MapPin size={42} color={textSecondary} />
            <Text
              style={{
                fontFamily: "Poppins_500Medium",
                color: textSecondary,
                textAlign: "center",
                marginTop: 12,
              }}
            >
              No venues yet. Create your first venue above!
            </Text>
          </View>
        ) : (
          data.map((item, index) => (
            <View
              key={item.venueId || index}
              style={{
                backgroundColor: cardBg,
                borderRadius: 20,
                padding: 18,
                marginBottom: 14,
                borderWidth: 1,
                borderColor: cardBorder,
              }}
            >
              {editingId === item.venueId ? (
                // Edit Mode
                <View>
                  <Text
                    style={{
                      fontFamily: "Poppins_600SemiBold",
                      color: textPrimary,
                      fontSize: 16,
                      marginBottom: 14,
                    }}
                  >
                    Editing: {item.venueName}
                  </Text>

                  <Input
                    label="Venue Name"
                    value={editData.venueName || item.venueName}
                    onChangeText={(value) => {
                      setEditData({
                        ...editData,
                        venueName: value,
                      });
                    }}
                    style={{ marginBottom: 12 }}
                  />

                  <Input
                    label="Latitude"
                    value={editData.lat?.toString() || item.lat.toString()}
                    onChangeText={(value) => {
                      setEditData({
                        ...editData,
                        lat: parseFloat(value) || item.lat,
                      });
                    }}
                    keyboardType="numeric"
                    style={{ marginBottom: 12 }}
                  />

                  <Input
                    label="Longitude"
                    value={editData.lng?.toString() || item.lng.toString()}
                    onChangeText={(value) => {
                      setEditData({
                        ...editData,
                        lng: parseFloat(value) || item.lng,
                      });
                    }}
                    keyboardType="numeric"
                    style={{ marginBottom: 14 }}
                  />

                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        backgroundColor: "#41B8F0",
                        paddingVertical: 12,
                        borderRadius: 12,
                        alignItems: "center",
                      }}
                      onPress={handleUpdateVenue}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#FFFFFF" }}>
                        Save
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
                        paddingVertical: 12,
                        borderRadius: 12,
                        alignItems: "center",
                      }}
                      onPress={() => {
                        setEditingId(null);
                        setEditData({});
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontFamily: "Poppins_500Medium", color: textSecondary }}>
                        Cancel
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                // View Mode
                <View>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: "#41B8F020",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 10,
                      }}
                    >
                      <MapPin size={20} color="#41B8F0" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontFamily: "Poppins_600SemiBold",
                          color: textPrimary,
                          fontSize: 16,
                        }}
                      >
                        {item.venueName}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={{
                      backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.03)",
                      borderRadius: 12,
                      padding: 10,
                      marginBottom: 12,
                    }}
                  >
                    <Text style={{ fontFamily: "Poppins_400Regular", color: textSecondary, fontSize: 11 }}>
                      ID: {item.venueId}
                    </Text>
                    <Text style={{ fontFamily: "Poppins_500Medium", color: textPrimary, fontSize: 12, marginTop: 2 }}>
                      Lat: {item.lat.toFixed(6)} • Lng: {item.lng.toFixed(6)}
                    </Text>
                  </View>

                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        backgroundColor: isDark ? "rgba(65, 184, 240, 0.15)" : "#E0F2FE",
                        paddingVertical: 10,
                        borderRadius: 12,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      onPress={() => {
                        setEditingId(item.venueId);
                        setEditData({
                          venueName: item.venueName,
                          lat: item.lat,
                          lng: item.lng,
                        });
                      }}
                      activeOpacity={0.75}
                    >
                      <Edit size={16} color="#41B8F0" />
                      <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#41B8F0", marginLeft: 6, fontSize: 13 }}>
                        Edit
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{
                        flex: 1,
                        backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEE2E2",
                        paddingVertical: 10,
                        borderRadius: 12,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      onPress={() => handleDeleteVenue(item)}
                      disabled={deletingId === item.venueId}
                      activeOpacity={0.75}
                    >
                      {deletingId === item.venueId ? (
                        <>
                          <ActivityIndicator color="#EF4444" size="small" />
                          <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#EF4444", marginLeft: 6, fontSize: 13 }}>
                            Deleting...
                          </Text>
                        </>
                      ) : (
                        <>
                          <Trash2 size={16} color="#EF4444" />
                          <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#EF4444", marginLeft: 6, fontSize: 13 }}>
                            Delete
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
