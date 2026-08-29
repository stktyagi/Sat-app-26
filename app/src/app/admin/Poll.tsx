import {
  View,
  ScrollView,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Switch,
} from "react-native";
import { showAlert } from "@/components";
import { useEffect, useState } from "react";
import { Poll, Update, FirebaseEvent } from "@/types/models";
import {
  createPoll,
  getAllPolls,
  togglePollStatus,
} from "@/api/admin";
import { Input } from "@/components";
import {
  ArrowLeft,
  Upload,
  Plus,
  X,
  Power,
  PowerOff,
  MessageSquarePlus,
  ChevronDown,
  Trash2, // Add this import
} from "lucide-react-native";
import { createUpdate, getUpdates, deleteUpdate } from "@/api/admin"; // Add getUpdates and deleteUpdate
import { subscribeToEvents } from "@/api/events";
import { useAdminNavigation } from "@/hooks/useAdminNavigation";

export default function PollScreen() {
  const navigation = useAdminNavigation();
  const [data, setData] = useState<Poll[]>([]);
  const [createData, setCreateData] = useState<Partial<Poll>>({
    options: [""],
  });
  const [updateData, setUpdateData] = useState<Partial<Update>>({});
  const [updates, setUpdates] = useState<Update[]>([]); // Add state for updates
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null); // Add state for deleting
  const [activeTab, setActiveTab] = useState("Polls");
  const [events, setEvents] = useState<FirebaseEvent[]>([]);
  const [showEventDropdown, setShowEventDropdown] = useState(false);
  const [linkType, setLinkType] = useState<'none' | 'event' | 'external'>('none');

  useEffect(() => {
    setLoading(true);
    const unsubscribe = getAllPolls((polls) => {
      setData(polls);
      setLoading(false);
    });

    const unsubscribeEvents = subscribeToEvents((fetchedEvents) => {
      setEvents(fetchedEvents);
    });

    // Subscribe to updates
    const unsubscribeUpdates = getUpdates((fetchedUpdates) => {
      setUpdates(fetchedUpdates);
    });

    return () => {
      unsubscribe();
      unsubscribeEvents();
      unsubscribeUpdates(); // Cleanup
    };
  }, []);

  const handleToggleStatus = async (item: Poll) => {
    setTogglingId(item.id);
    try {
      await togglePollStatus(item.id, item.isActive);
      setData(
        data.map((d) =>
          d.id === item.id ? { ...d, isActive: !d.isActive } : d
        )
      );
    } catch (error) {
      showAlert("Error", "Failed to update poll status.");
      console.error(error);
    } finally {
      setTogglingId(null);
    }
  };

  const handleCreatePoll = async () => {
    if (!createData.question) {
      showAlert("Error", "Please enter a question");
      return;
    }
    if (
      !createData.options ||
      createData.options.length < 2 ||
      createData.options.some((o) => o.trim() === "")
    ) {
      showAlert("Error", "Please provide at least two valid options");
      return;
    }

    setCreating(true);
    try {
      await createPoll({
        question: createData.question,
        options: createData.options.filter((o) => o.trim() !== ""),
      });
      // await loadData(); No longer needed due to real-time updates
      setCreateData({ options: [""] });
      showAlert("Success", "Poll created successfully!");
    } catch (error) {
      showAlert("Error", "Failed to create poll");
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  const handleCreateUpdate = async () => {
    if (!updateData.title || !updateData.description) {
      showAlert("Error", "Please enter a title and description");
      return;
    }

    setUpdating(true);
    try {
      const updatePayload: Omit<Update, "id" | "createdAt"> = {
        title: updateData.title,
        description: updateData.description,
      };

      // Only add link-related fields if they are provided
      if (linkType === 'event' && updateData.eventId) {
        updatePayload.linkType = 'event';
        updatePayload.eventId = updateData.eventId;
        updatePayload.eventName = updateData.eventName;
      } else if (linkType === 'external' && updateData.link?.trim()) {
        updatePayload.linkType = 'external';
        updatePayload.link = updateData.link;
      }

      await createUpdate(updatePayload);
      setUpdateData({});
      setLinkType('none');
      showAlert("Success", "Update created successfully!");
    } catch (error) {
      showAlert("Error", "Failed to create update");
      console.error(error);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteUpdate = async (updateId: string, title: string) => {
    // Show confirmation alert
    showAlert(
      "Delete Update",
      `Are you sure you want to delete "${title}"?`,
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingId(updateId);
            try {
              await deleteUpdate(updateId);
              showAlert("Success", "Update deleted successfully!");
            } catch (error) {
              showAlert("Error", "Failed to delete update");
              console.error(error);
            } finally {
              setDeletingId(null);
            }
          }
        }
      ]
    );
  };

  const handleOptionChange = (text: string, index: number) => {
    const newOptions = [...(createData.options || [])];
    newOptions[index] = text;
    setCreateData({ ...createData, options: newOptions });
  };

  const addOption = () => {
    const newOptions = [...(createData.options || []), ""];
    setCreateData({ ...createData, options: newOptions });
  };

  const removeOption = (index: number) => {
    const newOptions = [...(createData.options || [])];
    newOptions.splice(index, 1);
    setCreateData({ ...createData, options: newOptions });
  };

  return (
    <View className="flex-1 bg-transparent">
      {/* Header */}
      <View className="bg-[#EEB170] pt-4 rounded-b-2xl pb-6 px-6 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => navigation.navigate("Dashboard")}
          className="mr-4"
          activeOpacity={0.7}
        >
          <ArrowLeft size={28} color="#121212" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text style={{ fontFamily: "Outfit_700Bold" }} className="text-[#121212] text-2xl ">
            Content Management
          </Text>
          <Text style={{ fontFamily: "Outfit_400Regular" }} className="text-[#121212] text-sm opacity-80">
            Create and manage polls and updates
          </Text>
        </View>
      </View>

      <View className="flex-row mb-6">
        <TouchableOpacity
          onPress={() => setActiveTab("Polls")}
          className={`flex-1 py-3 items-center justify-center border-b-2 ${
            activeTab === "Polls" ? "border-[#EEB170]" : "border-transparent"
          }`}
        >
          <Text

            className={`text-lg ${
              activeTab === "Polls" ? "text-[#EEB170]" : "text-[#2175C0]"
            }`}
            style={{ fontFamily: "Outfit_600SemiBold" }}
          >
            Polls
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab("Updates")}
          className={`flex-1 py-3 items-center justify-center border-b-2 ${
            activeTab === "Updates" ? "border-[#EEB170]" : "border-transparent"
          }`}
        >
          <Text
            className={`text-lg ${
              activeTab === "Updates" ? "text-[#EEB170]" : "text-[#2175C0]"
            }`}
            style={{ fontFamily: "Outfit_600SemiBold" }}
          >
            Updates
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
        {activeTab === "Polls" ? (
          <View>
            {/* Create Poll Section */}
            <View className="p-6">
              <View className="bg-[#FFFFFF66] rounded-2xl p-6 mb-6 border border-[#A0B3D0]">
                <Text style={{ fontFamily: "Outfit_700Bold" }} className="text-[#EEB170] text-xl mb-4">
                  Create New Poll
                </Text>

                <Input
                  label="Poll Question"
                  value={createData.question || ""}
                  onChangeText={(value) => {
                    setCreateData({
                      ...createData,
                      question: value,
                    });
                  }}
                  placeholder="What's your favorite color?"
                  className="mb-4 py-3"
                />

                {createData.options?.map((option, index) => (
                  <View
                    key={index}
                    className="flex-row justify-center items-center mb-2"
                  >
                    <View className="flex-1 mr-2">
                      <Input
                        value={option}
                        onChangeText={(text) => handleOptionChange(text, index)}
                        placeholder={`Option ${index + 1}`}
                        className="text-base px-4 py-3"
                      />
                    </View>
                    <View className="flex-row justify-center mb-4 items-center">
                      {createData.options && createData.options.length > 1 && (
                        <TouchableOpacity
                          onPress={() => removeOption(index)}
                          className="p-3 rounded-full bg-[#FFFFFF66]"
                        >
                          <X size={18} color="#E84054" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}

                <TouchableOpacity
                  className="flex-row items-center justify-center py-2 px-4 bg-[#FFFFFF66] rounded-lg my-4"
                  onPress={addOption}
                >
                  <Plus size={16} color="#EEB170" />
                  <Text style={{ fontFamily: "Outfit_400Regular" }} className="text-[#EEB170] ml-2">Add Option</Text>
                </TouchableOpacity>

                {/* Create Button */}
                <TouchableOpacity
                  className={`${
                    creating ? "bg-[#EEB170]/50" : "bg-[#EEB170]"
                  } py-4 rounded-xl flex-row items-center justify-center`}
                  disabled={creating}
                  onPress={handleCreatePoll}
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
                      <Upload size={20} color="#121212" />
                      <Text className="text-[#121212] font-bold text-base ml-2">
                        Create Poll
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Existing Polls */}
              <Text className="text-[#EEB170] text-xl font-bold mb-4">
                Active Polls ({data.length})
              </Text>

              {loading ? (
                <View className="items-center justify-center py-12">
                  <ActivityIndicator size="large" color="#EEB170" />
                  <Text className="text-[#2175C0] mt-4">Loading polls...</Text>
                </View>
              ) : data.length === 0 ? (
                <View className="bg-[#FFFFFF66] rounded-2xl p-8 items-center border border-[#A0B3D0]">
                  <Text style={{ fontFamily: "Outfit_400Regular" }} className="text-[#2175C0] text-center mt-4">
                    No polls yet. Create your first poll above!
                  </Text>
                </View>
              ) : (
                data.map((item, index) => (
                  <View
                    key={index}
                    className="bg-[#FFFFFF66] rounded-2xl overflow-hidden mb-4 border border-[#A0B3D0]"
                  >
                    <View className="p-4">
                      <View className="flex-row justify-between items-start">
                        <Text style={{ fontFamily: "Outfit_700Bold" }} className="text-[#0C3572] text-lg mb-3 flex-1">
                          {item.question}
                        </Text>
                        <View
                          className={`px-2 py-1 rounded-full ${
                            item.isActive ? "bg-green-500/20" : "bg-red-500/20"
                          }`}
                        >
                          <Text
                            style={{ fontFamily: "Outfit_600SemiBold" }}
                            className={` text-xs ${
                              item.isActive
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            {item.isActive ? "ACTIVE" : "INACTIVE"}
                          </Text>
                        </View>
                      </View>
                      {item.options.map((option, i) => (
                        <View
                          key={i}
                          className="flex-row justify-between items-center py-2"
                        >
                          <Text style={{ fontFamily: "Outfit_400Regular" }} className="text-[#2175C0]">{option}</Text>
                          <Text style={{ fontFamily: "Outfit_700Bold" }} className="text-[#0C3572]">
                            {item.votes[option] || 0} votes
                          </Text>
                        </View>
                      ))}
                      <TouchableOpacity
                        className={`${
                          item.isActive ? "bg-[#E84054]" : "bg-green-500"
                        } py-3 rounded-xl flex-row items-center justify-center mt-4`}
                        onPress={() => handleToggleStatus(item)}
                        disabled={togglingId === item.id}
                        activeOpacity={0.7}
                      >
                        {togglingId === item.id ? (
                          <>
                            <ActivityIndicator color="#fff" size="small" />
                            <Text className="text-[#0C3572] font-semibold ml-2">
                              {item.isActive
                                ? "Deactivating..."
                                : "Activating..."}
                            </Text>
                          </>
                        ) : (
                          <>
                            {item.isActive ? (
                              <PowerOff size={18} color="#fff" />
                            ) : (
                              <Power size={18} color="#fff" />
                            )}
                            <Text className="text-[#0C3572] font-semibold ml-2">
                              {item.isActive
                                ? "Deactivate Poll"
                                : "Activate Poll"}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        ) : (
          <View className="p-6">
            {/* Create New Update Form */}
            <View className="bg-[#FFFFFF66] rounded-2xl p-6 mb-6 border border-[#A0B3D0]">
              <Text style={{ fontFamily: "Outfit_700Bold" }} className="text-[#EEB170] text-xl mb-4">
                Create New Update
              </Text>

              <Input
                label="Update Title"
                value={updateData.title || ""}
                onChangeText={(value) => {
                  setUpdateData({
                    ...updateData,
                    title: value,
                  });
                }}
                placeholder="e.g., Event Schedule Change"
                className="mb-4 py-3"
              />

              <Input
                label="Update Description"
                value={updateData.description || ""}
                onChangeText={(value) => {
                  setUpdateData({
                    ...updateData,
                    description: value,
                  });
                }}
                placeholder="Describe the update in detail..."
                multiline
                numberOfLines={4}
                className="mb-4 py-3 h-24"
              />

              {/* Link Type Selection */}
              <Text className="text-[#0C3572] text-sm mb-2 font-semibold">
                Action Button (Optional)
              </Text>
              <View className="flex-row mb-4 gap-2">
                <TouchableOpacity
                  onPress={() => setLinkType('none')}
                  className={`flex-1 py-3 rounded-lg border-2 ${
                    linkType === 'none'
                      ? 'bg-[#EEB170] border-[#EEB170]'
                      : 'bg-[#FFFFFF66] border-[#A0B3D0]'
                  }`}
                >
                  <Text
                    className={`text-center font-semibold ${
                      linkType === 'none' ? 'text-black' : 'text-[#2175C0]'
                    }`}
                  >
                    None
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setLinkType('external')}
                  className={`flex-1 py-3 rounded-lg border-2 ${
                    linkType === 'external'
                      ? 'bg-[#EEB170] border-[#EEB170]'
                      : 'bg-[#FFFFFF66] border-[#A0B3D0]'
                  }`}
                >
                  <Text
                    className={`text-center font-semibold ${
                      linkType === 'external' ? 'text-black' : 'text-[#2175C0]'
                    }`}
                  >
                    External Link
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setLinkType('event')}
                  className={`flex-1 py-3 rounded-lg border-2 ${
                    linkType === 'event'
                      ? 'bg-[#EEB170] border-[#EEB170]'
                      : 'bg-[#FFFFFF66] border-[#A0B3D0]'
                  }`}
                >
                  <Text
                    className={`text-center font-semibold ${
                      linkType === 'event' ? 'text-black' : 'text-[#2175C0]'
                    }`}
                  >
                    Event
                  </Text>
                </TouchableOpacity>
              </View>

              {linkType === 'external' ? (
                <Input
                  label="External Link"
                  value={updateData.link || ""}
                  onChangeText={(value) => {
                    setUpdateData({
                      ...updateData,
                      link: value,
                    });
                  }}
                  placeholder="https://example.com/event-details"
                  className="mb-4 py-3"
                />
              ) : linkType === 'event' ? (
                <View className="mb-4">
                  <Text className="text-[#0C3572] text-sm mb-2 font-semibold">
                    Select Event
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowEventDropdown(!showEventDropdown)}
                    className="bg-[#FFFFFF66] rounded-lg px-4 py-3 flex-row justify-between items-center"
                  >
                    <Text className={updateData.eventName ? "text-[#0C3572]" : "text-[#2175C0]"}>
                      {updateData.eventName || "Choose an event"}
                    </Text>
                    <ChevronDown size={20} color="#EEB170" />
                  </TouchableOpacity>
                  
                  {showEventDropdown && (
                    <View className="bg-[#FFFFFF66] rounded-lg mt-2 max-h-60">
                      <ScrollView>
                        {events.map((event) => (
                          <TouchableOpacity
                            key={event.eventId}
                            onPress={() => {
                              setUpdateData({
                                ...updateData,
                                eventId: event.eventId,
                                eventName: event.title,
                              });
                              setShowEventDropdown(false);
                            }}
                            className="px-4 py-3 border-b border-[#3C3C3C]"
                          >
                            <Text className="text-[#0C3572]">{event.title}</Text>
                            <Text className="text-[#2175C0] text-xs mt-1">
                              {event.category}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              ) : null}

              <TouchableOpacity
                className={`${
                  updating ? "bg-[#EEB170]/50" : "bg-[#EEB170]"
                } py-4 rounded-xl flex-row items-center justify-center`}
                disabled={updating}
                onPress={handleCreateUpdate}
                activeOpacity={0.7}
              >
                {updating ? (
                  <>
                    <ActivityIndicator color="#121212" />
                    <Text className="text-[#121212] font-bold text-base ml-2">
                      Creating...
                    </Text>
                  </>
                ) : (
                  <>
                    <MessageSquarePlus size={20} color="#121212" />
                    <Text className="text-[#121212] font-bold text-base ml-2">
                      Create Update
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Existing Updates */}
            <Text style={{ fontFamily: "Outfit_700Bold" }} className="text-[#EEB170] text-xl mb-4">
              All Updates ({updates.length})
            </Text>

            {loading ? (
              <View className="items-center justify-center py-12">
                <ActivityIndicator size="large" color="#EEB170" />
                <Text style={{ fontFamily: "Outfit_400Regular" }} className="text-[#2175C0] mt-4">Loading updates...</Text>
              </View>
            ) : updates.length === 0 ? (
              <View className="bg-[#FFFFFF66] rounded-2xl p-8 items-center border border-[#A0B3D0]">
                <Text style={{ fontFamily: "Outfit_400Regular" }} className="text-[#2175C0] text-center mt-4">
                  No updates yet. Create your first update above!
                </Text>
              </View>
            ) : (
              updates.map((update) => (
                <View
                  key={update.id}
                  className="bg-[#FFFFFF66] rounded-2xl p-5 mb-4 border border-[#A0B3D0]"
                >
                  <View className="flex-row justify-between items-start mb-2">
                    <Text style={{ fontFamily: "Outfit_700Bold" }} className="text-[#EEB170] text-lg flex-1 mr-2">
                      {update.title}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleDeleteUpdate(update.id, update.title)}
                      disabled={deletingId === update.id}
                      className="bg-[#E84054]/20 p-2 rounded-lg"
                      activeOpacity={0.7}
                    >
                      {deletingId === update.id ? (
                        <ActivityIndicator size="small" color="#E84054" />
                      ) : (
                        <Trash2 size={18} color="#E84054" />
                      )}
                    </TouchableOpacity>
                  </View>

                  <Text style={{ fontFamily: "Outfit_400Regular" }} className="text-[#2175C0] text-sm mb-3 leading-5">
                    {update.description}
                  </Text>

                  {/* Show action button info */}
                  {update.linkType === 'external' && update.link && (
                    <View className="bg-[#FFFFFF66] px-3 py-2 rounded-lg flex-row items-center">
                      <View className="bg-[#EEB170] px-2 py-1 rounded mr-2">
                        <Text style={{ fontFamily: "Outfit_700Bold" }} className="text-black text-xs">LINK</Text>
                      </View>
                      <Text style={{ fontFamily: "Outfit_400Regular" }} className="text-[#2175C0] text-xs flex-1" numberOfLines={1}>
                        {update.link}
                      </Text>
                    </View>
                  )}

                  {update.linkType === 'event' && update.eventName && (
                    <View className="bg-[#FFFFFF66] px-3 py-2 rounded-lg flex-row items-center">
                      <View className="bg-[#EEB170] px-2 py-1 rounded mr-2">
                        <Text style={{ fontFamily: "Outfit_700Bold" }} className="text-black text-xs">EVENT</Text>
                      </View>
                      <Text style={{ fontFamily: "Outfit_400Regular" }} className="text-[#2175C0] text-xs flex-1" numberOfLines={1}>
                        {update.eventName}
                      </Text>
                    </View>
                  )}

                  {/* Show creation date */}
                  <Text style={{ fontFamily: "Outfit_400Regular" }} className="text-gray-500 text-xs mt-3">
                    Created: {update.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
