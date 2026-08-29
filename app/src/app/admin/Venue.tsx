import {
  View,
  ScrollView,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from "react-native";
import { showAlert } from "@/components";
import { useEffect, useState } from "react";
import { Venue } from "@/types/models";
import {
  getVenues,
  addVenueWithId,
  updateVenue,
  deleteVenue,
} from "@/api/admin";
import { Input } from "@/components";
import { ArrowLeft, Plus, Trash2, Edit, MapPin, Database } from "lucide-react-native";

export default function VenueManagement({ navigation }: { navigation: any }) {
  const [data, setData] = useState<Venue[]>([]);
  const [createData, setCreateData] = useState<Partial<Venue>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Venue>>({});
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const res = await getVenues();
    console.log("Venues:", res);
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
    if (!createData.venueId || !createData.venueName) {
      showAlert("Error", "Please enter venue ID and name");
      return;
    }
    if (createData.lat === undefined || createData.lng === undefined) {
      showAlert("Error", "Please enter latitude and longitude");
      return;
    }

    setCreating(true);
    try {
      const success = await addVenueWithId(createData.venueId, {
        venueName: createData.venueName,
        lat: createData.lat,
        lng: createData.lng,
      });

      if (success) {
        await loadData();
        setCreateData({});
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
    <View className="flex-1 bg-transparent">
      {/* Header */}
    <View className="bg-[#EEB170]  pt-4 rounded-b-2xl pb-6 px-6 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => navigation.navigate("Dashboard")}
          className="mr-4"
          activeOpacity={0.7}
        >
          <ArrowLeft size={28} color="#121212" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-[#121212] text-2xl font-bold">Venue Management</Text>
          <Text className="text-[#121212] text-sm opacity-80">
            Create and manage event venues
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Seed Data Button */}
       

        {/* Create Venue Section */}
        <View className="p-6">
          <View className="bg-[#FFFFFF66] rounded-2xl p-6 mb-6 border border-[#A0B3D0]">
            <Text className="text-[#EEB170] text-xl font-bold mb-4">
              Create New Venue
            </Text>

            <Input
              label="Venue ID"
              value={createData.venueId || ""}
              onChangeText={(value) => {
                setCreateData({
                  ...createData,
                  venueId: value,
                });
              }}
              placeholder="e.g., c-hall, oat, tan"
              className="mb-4"
            />

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
              className="mb-4"
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
              placeholder="e.g., 30.35353677777778"
              keyboardType="numeric"
              className="mb-4"
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
              placeholder="e.g., 76.3712401111111"
              keyboardType="numeric"
              className="mb-4"
            />

            <TouchableOpacity
              className={`${
                creating ? "bg-[#EEB170]/50" : "bg-[#EEB170]"
              } py-4 rounded-xl flex-row items-center justify-center`}
              disabled={creating}
              onPress={handleCreateVenue}
              activeOpacity={0.7}
            >
              {creating ? (
                <>
                  <ActivityIndicator color="#121212" />
                  <Text className="text-[#121212] font-bold text-base ml-2">
                    Creating...
                  </Text>
                </>
              ) : (
                <>
                  <Plus size={20} color="#121212" />
                  <Text className="text-[#121212] font-bold text-base ml-2">
                    Create Venue
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Existing Venues */}
          <Text className="text-[#EEB170] text-xl font-bold mb-4">
            Active Venues ({data.length})
          </Text>

          {loading ? (
            <View className="items-center justify-center py-12">
              <ActivityIndicator size="large" color="#EEB170" />
              <Text className="text-[#2175C0] mt-4">Loading venues...</Text>
            </View>
          ) : data.length === 0 ? (
            <View className="bg-[#FFFFFF66] rounded-2xl p-8 items-center border border-[#A0B3D0]">
              <MapPin size={48} color="#555" />
              <Text className="text-[#2175C0] text-center mt-4">
                No venues yet. Create your first venue above!
              </Text>
            </View>
          ) : (
            data.map((item, index) => (
              <View
                key={index}
                className="bg-[#FFFFFF66] rounded-2xl p-5 mb-4 border border-[#A0B3D0]"
              >
                {editingId === item.venueId ? (
                  // Edit Mode
                  <View>
                    <Text className="text-[#EEB170] text-lg font-bold mb-4">
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
                      className="mb-3"
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
                      className="mb-3"
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
                      className="mb-4"
                    />

                    <View className="flex-row gap-3">
                      <TouchableOpacity
                        className="flex-1 bg-[#EEB170] py-3 rounded-xl items-center"
                        onPress={handleUpdateVenue}
                        activeOpacity={0.7}
                      >
                        <Text className="text-[#121212] font-bold">Save</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="flex-1 bg-[#FFFFFF66] py-3 rounded-xl items-center"
                        onPress={() => {
                          setEditingId(null);
                          setEditData({});
                        }}
                        activeOpacity={0.7}
                      >
                        <Text className="text-[#0C3572] font-bold">Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  // View Mode
                  <View>
                    <View className="flex-row items-center mb-3">
                      <MapPin size={24} color="#EEB170" />
                      <Text className="text-[#0C3572] text-xl font-bold ml-2">
                        {item.venueName}
                      </Text>
                    </View>

                    <View className="bg-[#FFFFFF66] rounded-lg p-3 mb-3">
                      <Text className="text-[#2175C0] text-sm">ID: {item.venueId}</Text>
                      <Text className="text-[#2175C0] text-sm mt-1">
                        Lat: {item.lat.toFixed(6)}
                      </Text>
                      <Text className="text-[#2175C0] text-sm mt-1">
                        Lng: {item.lng.toFixed(6)}
                      </Text>
                    </View>

                    <View className="flex-row gap-3">
                      <TouchableOpacity
                        className="flex-1 bg-[#EEB170] py-3 rounded-xl flex-row items-center justify-center"
                        onPress={() => {
                          setEditingId(item.venueId);
                          setEditData({
                            venueName: item.venueName,
                            lat: item.lat,
                            lng: item.lng,
                          });
                        }}
                        activeOpacity={0.7}
                      >
                        <Edit size={18} color="#121212" />
                        <Text className="text-[#121212] font-semibold ml-2">
                          Edit
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        className="flex-1 bg-[#E84054] py-3 rounded-xl flex-row items-center justify-center"
                        onPress={() => handleDeleteVenue(item)}
                        disabled={deletingId === item.venueId}
                        activeOpacity={0.7}
                      >
                        {deletingId === item.venueId ? (
                          <>
                            <ActivityIndicator color="#fff" size="small" />
                            <Text className="text-[#0C3572] font-semibold ml-2">
                              Deleting...
                            </Text>
                          </>
                        ) : (
                          <>
                            <Trash2 size={18} color="#fff" />
                            <Text className="text-[#0C3572] font-semibold ml-2">
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
        </View>
      </ScrollView>
    </View>
  );
}
