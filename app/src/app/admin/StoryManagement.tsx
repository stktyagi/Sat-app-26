import React, { useEffect, useState } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  Text,
  Image,
  ActivityIndicator,
  StatusBar,
  Modal,
  FlatList,
} from "react-native";
import { showAlert, Input } from "@/components";
import * as ImagePicker from "expo-image-picker";
import {
  ArrowLeft,
  Upload,
  Trash2,
  ImagePlus,
  Calendar,
  Layers,
  Check,
  ChevronDown,
  X,
  Edit,
  Video,
  Play,
} from "lucide-react-native";
import {
  adminListStories,
  adminCreateStory,
  adminUpdateStory,
  adminDeleteStory,
  adminUploadMedia,
  adminListEvents,
  BackendStory,
  BackendStoryItem,
  AdminEvent,
} from "@/api/admin";
import { useAdminNavigation } from "@/hooks/useAdminNavigation";
import { useThemeStore } from "@/state/themeStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useContentCacheStore } from "@/state/contentCacheStore";

interface StoryMediaItem {
  id?: string;
  uri: string;
  type: "image" | "video";
  name?: string;
  isExisting?: boolean;
  ref?: string;
}

export default function StoryManagement() {
  const navigation = useAdminNavigation();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();

  const [stories, setStories] = useState<BackendStory[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Create Form state
  const [name, setName] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<AdminEvent | null>(null);
  const [order, setOrder] = useState("0");
  const [selectedMedia, setSelectedMedia] = useState<StoryMediaItem[]>([]);
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [eventPickerTarget, setEventPickerTarget] = useState<"create" | "edit">("create");

  // Edit Form state
  const [editingStory, setEditingStory] = useState<BackendStory | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState("");
  const [editOrder, setEditOrder] = useState("0");
  const [editSelectedEvent, setEditSelectedEvent] = useState<AdminEvent | null>(null);
  const [editMedia, setEditMedia] = useState<StoryMediaItem[]>([]);
  const [updating, setUpdating] = useState(false);

  const bgColor = isDark ? "#131316" : "#E0E0E0";
  const cardBg = isDark ? "#1C1C20" : "#FFFFFF";
  const cardBorder = isDark ? "#2A2A30" : "#D5D5D5";
  const textPrimary = isDark ? "#FFFFFF" : "#111827";
  const textSecondary = isDark ? "#A0A0A0" : "#6B7280";

  const loadData = async () => {
    setLoading(true);
    try {
      const [storiesRes, eventsRes] = await Promise.all([
        adminListStories(),
        adminListEvents().catch(() => []),
      ]);
      setStories(storiesRes);
      setEvents(eventsRes);
    } catch (e: any) {
      console.error("loadData stories error:", e);
      showAlert("Error", e?.message || "Failed to load stories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const pickMedia = async (target: "create" | "edit") => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsMultipleSelection: true,
        quality: 0.85,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const items: StoryMediaItem[] = result.assets.map((a) => {
          const isVideo =
            a.type === "video" || /\.(mp4|mov|webm|m4v|3gp)/i.test(a.uri);
          return {
            uri: a.uri,
            type: isVideo ? "video" : "image",
            name: a.fileName || (isVideo ? "video.mp4" : "image.jpg"),
            isExisting: false,
          };
        });

        if (target === "create") {
          setSelectedMedia((prev) => [...prev, ...items]);
        } else {
          setEditMedia((prev) => [...prev, ...items]);
        }
      }
    } catch (err: any) {
      console.error("pickMedia error:", err);
      showAlert("Error", "Failed to select media files");
    }
  };

  const removeSelectedMedia = (indexToRemove: number) => {
    setSelectedMedia((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const removeEditMedia = (indexToRemove: number) => {
    setEditMedia((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleCreateStory = async () => {
    if (!name.trim()) {
      showAlert("Validation Error", "Please provide a name for the story.");
      return;
    }
    if (selectedMedia.length === 0) {
      showAlert("Validation Error", "Please select at least one image or video for the story.");
      return;
    }

    setCreating(true);
    try {
      const uploadedUrls: string[] = [];
      const storyItems: BackendStoryItem[] = [];

      for (const item of selectedMedia) {
        const isVid = item.type === "video" || /\.(mp4|mov|webm|m4v|3gp)/i.test(item.uri);
        // Videos go to AWS S3, images go to ImageKit
        const res = await adminUploadMedia(item.uri, {
          folder: isVid ? "stories/videos" : "stories",
          mimeType: isVid ? "video/mp4" : "image/jpeg",
          fileName: item.name,
        });

        uploadedUrls.push(res.url);
        storyItems.push({
          id: Math.random().toString(36).substring(2, 14),
          url: res.url,
          ref: res.ref,
          mediaType: isVid ? "video" : "image",
        });
      }

      await adminCreateStory({
        name: name.trim(),
        eventId: selectedEvent ? selectedEvent.eventId || selectedEvent.id : undefined,
        images: uploadedUrls,
        items: storyItems,
        order: parseInt(order, 10) || 0,
      });

      useContentCacheStore.getState().invalidateStories();

      setName("");
      setSelectedEvent(null);
      setOrder("0");
      setSelectedMedia([]);

      showAlert("Success", "Story created and published successfully!");
      await loadData();
    } catch (error: any) {
      console.error("handleCreateStory error:", error);
      showAlert("Error", error.message || "Failed to create story");
    } finally {
      setCreating(false);
    }
  };

  const handleOpenEdit = (story: BackendStory) => {
    setEditingStory(story);
    setEditName(story.name || "");
    setEditOrder(story.order !== undefined ? String(story.order) : "0");

    const matchedEvent = story.eventId
      ? events.find((e) => (e.eventId || e.id) === story.eventId) || null
      : null;
    setEditSelectedEvent(matchedEvent);

    const initialMedia: StoryMediaItem[] =
      story.items && story.items.length > 0
        ? story.items.map((it) => ({
            id: it.id,
            uri: it.url,
            type:
              it.mediaType === "video" || /\.(mp4|mov|webm|m4v|3gp)/i.test(it.url)
                ? "video"
                : "image",
            isExisting: true,
            ref: it.ref,
          }))
        : (story.images || []).map((img, idx) => ({
            id: `${story.id}-${idx}`,
            uri: img,
            type: /\.(mp4|mov|webm|m4v|3gp)/i.test(img) ? "video" : "image",
            isExisting: true,
          }));

    setEditMedia(initialMedia);
    setEditModalVisible(true);
  };

  const handleUpdateStory = async () => {
    if (!editingStory) return;
    if (!editName.trim()) {
      showAlert("Validation Error", "Please provide a name for the story.");
      return;
    }
    if (editMedia.length === 0) {
      showAlert("Validation Error", "Story must have at least one image or video slide.");
      return;
    }

    setUpdating(true);
    try {
      const finalItems: BackendStoryItem[] = [];
      const finalUrls: string[] = [];

      for (const item of editMedia) {
        if (item.isExisting) {
          finalItems.push({
            id: item.id || Math.random().toString(36).substring(2, 14),
            url: item.uri,
            ref: item.ref,
            mediaType: item.type,
          });
          finalUrls.push(item.uri);
        } else {
          const isVid = item.type === "video" || /\.(mp4|mov|webm|m4v|3gp)/i.test(item.uri);
          // Upload videos to AWS S3, images to ImageKit
          const res = await adminUploadMedia(item.uri, {
            folder: isVid ? "stories/videos" : "stories",
            mimeType: isVid ? "video/mp4" : "image/jpeg",
            fileName: item.name,
          });

          finalItems.push({
            id: Math.random().toString(36).substring(2, 14),
            url: res.url,
            ref: res.ref,
            mediaType: isVid ? "video" : "image",
          });
          finalUrls.push(res.url);
        }
      }

      await adminUpdateStory(editingStory.id, {
        name: editName.trim(),
        eventId: editSelectedEvent ? editSelectedEvent.eventId || editSelectedEvent.id : undefined,
        images: finalUrls,
        items: finalItems,
        order: parseInt(editOrder, 10) || 0,
      });

      useContentCacheStore.getState().invalidateStories();
      setEditModalVisible(false);
      setEditingStory(null);
      showAlert("Success", "Story updated successfully!");
      await loadData();
    } catch (error: any) {
      console.error("handleUpdateStory error:", error);
      showAlert("Error", error.message || "Failed to update story");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteStory = (story: BackendStory) => {
    showAlert(
      "Delete Story",
      `Are you sure you want to delete "${story.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingId(story.id);
            try {
              await adminDeleteStory(story.id);
              useContentCacheStore.getState().invalidateStories();
              setStories((prev) => prev.filter((s) => s.id !== story.id));
              showAlert("Success", "Story deleted successfully");
            } catch (err: any) {
              showAlert("Error", err.message || "Failed to delete story");
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
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
          onPress={() => navigation.goBack()}
          style={{
            padding: 8,
            marginRight: 12,
            borderRadius: 12,
            backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)",
          }}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={textPrimary} />
        </TouchableOpacity>
        <View>
          <Text
            style={{
              fontFamily: "Talina",
              color: textPrimary,
              fontSize: 22,
            }}
          >
            Story Management
          </Text>
          <Text
            style={{
              fontFamily: "Poppins_400Regular",
              color: textSecondary,
              fontSize: 13,
              marginTop: 2,
            }}
          >
            Create, edit, and organize home screen photo and video stories
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Create Story Form */}
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
            Create New Story
          </Text>

          {/* Story Name */}
          <Input
            label="Story Name *"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Battle of the Bands or Day 1 Recap"
            style={{ marginBottom: 14 }}
          />

          {/* Attached Event Picker Button */}
          <View style={{ marginBottom: 14 }}>
            <Text
              style={{
                fontFamily: "Poppins_500Medium",
                color: textPrimary,
                fontSize: 13,
                marginBottom: 6,
              }}
            >
              Link to Event (Optional)
            </Text>
            <TouchableOpacity
              onPress={() => {
                setEventPickerTarget("create");
                setShowEventPicker(true);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: cardBorder,
                backgroundColor: cardBg,
              }}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <Calendar size={18} color="#FFBA00" />
                <Text
                  style={{
                    fontFamily: "Poppins_400Regular",
                    color: selectedEvent ? textPrimary : textSecondary,
                    fontSize: 14,
                    marginLeft: 10,
                  }}
                  numberOfLines={1}
                >
                  {selectedEvent ? selectedEvent.title : "None (select event)"}
                </Text>
              </View>
              <ChevronDown size={18} color={textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Order */}
          <View style={{ marginBottom: 16 }}>
            <Input
              label="Sort Order"
              value={order}
              onChangeText={setOrder}
              keyboardType="numeric"
              placeholder="0"
            />
          </View>

          {/* Media Upload Header & Picker */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                fontFamily: "Poppins_500Medium",
                color: textPrimary,
                fontSize: 14,
              }}
            >
              Story Media ({selectedMedia.length}) *
            </Text>
            <TouchableOpacity
              onPress={() => pickMedia("create")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 10,
                backgroundColor: "rgba(176, 24, 102, 0.14)",
              }}
              activeOpacity={0.8}
            >
              <ImagePlus size={16} color="#B01866" />
              <Text
                style={{
                  fontFamily: "Poppins_500Medium",
                  color: "#B01866",
                  fontSize: 12,
                  marginLeft: 6,
                }}
              >
                Add Media
              </Text>
            </TouchableOpacity>
          </View>

          {/* Media Previews Grid */}
          {selectedMedia.length === 0 ? (
            <TouchableOpacity
              onPress={() => pickMedia("create")}
              style={{
                borderWidth: 2,
                borderStyle: "dashed",
                borderColor: isDark ? "#3A3A42" : "#CBD5E1",
                borderRadius: 16,
                padding: 24,
                marginBottom: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.02)",
              }}
              activeOpacity={0.8}
            >
              <ImagePlus size={36} color="#B01866" />
              <Text
                style={{
                  fontFamily: "Poppins_500Medium",
                  color: textPrimary,
                  fontSize: 14,
                  marginTop: 8,
                }}
              >
                Tap to pick story slides (Images & Videos)
              </Text>
              <Text
                style={{
                  fontFamily: "Poppins_400Regular",
                  color: textSecondary,
                  fontSize: 12,
                  marginTop: 2,
                }}
              >
                Images go to ImageKit • Videos go to AWS S3
              </Text>
            </TouchableOpacity>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingVertical: 6, marginBottom: 20 }}
            >
              {selectedMedia.map((item, idx) => (
                <View
                  key={`${item.uri}-${idx}`}
                  style={{
                    position: "relative",
                    width: 86,
                    height: 124,
                    borderRadius: 12,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: cardBorder,
                    backgroundColor: isDark ? "#2A2A32" : "#E2E8F0",
                  }}
                >
                  <Image source={{ uri: item.uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />

                  {/* Video Badge */}
                  {item.type === "video" && (
                    <View
                      style={{
                        position: "absolute",
                        bottom: 4,
                        left: 4,
                        backgroundColor: "rgba(0, 0, 0, 0.75)",
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 6,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      <Video size={10} color="#FFBA00" />
                      <Text style={{ color: "#FFFFFF", fontSize: 9, fontFamily: "Poppins_600SemiBold" }}>
                        VIDEO
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    onPress={() => removeSelectedMedia(idx)}
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: "rgba(0, 0, 0, 0.65)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={{
              backgroundColor: "#B01866",
              opacity: creating ? 0.7 : 1,
              paddingVertical: 14,
              borderRadius: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            }}
            disabled={creating}
            onPress={handleCreateStory}
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
                  Uploading & Creating Story...
                </Text>
              </>
            ) : (
              <>
                <Upload size={18} color="#FFFFFF" />
                <Text
                  style={{
                    fontFamily: "Poppins_600SemiBold",
                    color: "#FFFFFF",
                    fontSize: 15,
                    marginLeft: 8,
                  }}
                >
                  Publish Story
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Existing Stories */}
        <Text
          style={{
            fontFamily: "Poppins_600SemiBold",
            color: textPrimary,
            fontSize: 18,
            marginBottom: 16,
          }}
        >
          All Stories ({stories.length})
        </Text>

        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator size="large" color="#B01866" />
            <Text
              style={{
                fontFamily: "Poppins_400Regular",
                color: textSecondary,
                fontSize: 14,
                marginTop: 12,
              }}
            >
              Loading stories from server...
            </Text>
          </View>
        ) : stories.length === 0 ? (
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
            <Layers size={40} color={textSecondary} />
            <Text
              style={{
                fontFamily: "Poppins_500Medium",
                color: textSecondary,
                fontSize: 15,
                textAlign: "center",
                marginTop: 10,
              }}
            >
              No stories published yet. Create your first story above!
            </Text>
          </View>
        ) : (
          stories.map((item) => {
            const rawImages =
              item.images && item.images.length > 0
                ? item.images
                : item.items
                ? item.items.map((i) => i.url)
                : [];
            const coverImage = rawImages.length > 0 ? rawImages[0] : null;

            const videoCount = (item.items || []).filter(
              (i) => i.mediaType === "video" || /\.(mp4|mov|webm|m4v|3gp)/i.test(i.url)
            ).length;
            const totalSlides = rawImages.length;
            const imageCount = Math.max(0, totalSlides - videoCount);

            const firstIsVideo =
              (item.items?.[0]?.mediaType === "video") ||
              (coverImage && /\.(mp4|mov|webm|m4v|3gp)/i.test(coverImage));

            return (
              <View
                key={item.id}
                style={{
                  backgroundColor: cardBg,
                  borderRadius: 18,
                  padding: 16,
                  marginBottom: 14,
                  borderWidth: 1,
                  borderColor: cardBorder,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    width: 60,
                    height: 84,
                    borderRadius: 10,
                    backgroundColor: isDark ? "#282830" : "#E2E8F0",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 14,
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  {coverImage ? (
                    <Image
                      source={{ uri: coverImage }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                  ) : (
                    <Layers size={24} color="#B01866" />
                  )}

                  {firstIsVideo && (
                    <View
                      style={{
                        position: "absolute",
                        bottom: 3,
                        left: 3,
                        backgroundColor: "rgba(0,0,0,0.7)",
                        paddingHorizontal: 4,
                        paddingVertical: 1,
                        borderRadius: 4,
                      }}
                    >
                      <Play size={8} color="#FFBA00" />
                    </View>
                  )}
                </View>

                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text
                    style={{
                      fontFamily: "Poppins_600SemiBold",
                      color: textPrimary,
                      fontSize: 15,
                    }}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 4,
                      flexWrap: "wrap",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Poppins_500Medium",
                        color: "#B01866",
                        fontSize: 12,
                      }}
                    >
                      {totalSlides} {totalSlides === 1 ? "Slide" : "Slides"}
                    </Text>

                    {videoCount > 0 && (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          backgroundColor: "rgba(255, 186, 0, 0.15)",
                          paddingHorizontal: 6,
                          paddingVertical: 1,
                          borderRadius: 6,
                          gap: 3,
                        }}
                      >
                        <Video size={10} color="#D97706" />
                        <Text
                          style={{
                            fontFamily: "Poppins_500Medium",
                            color: isDark ? "#FBBF24" : "#B45309",
                            fontSize: 11,
                          }}
                        >
                          {videoCount} {videoCount === 1 ? "Video" : "Videos"}
                        </Text>
                      </View>
                    )}

                    {item.order !== undefined ? (
                      <Text
                        style={{
                          fontFamily: "Poppins_400Regular",
                          color: textSecondary,
                          fontSize: 12,
                        }}
                      >
                        Order: {item.order}
                      </Text>
                    ) : null}
                  </View>

                  {item.eventId ? (
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                      <Calendar size={12} color={textSecondary} />
                      <Text
                        style={{
                          fontFamily: "Poppins_400Regular",
                          color: textSecondary,
                          fontSize: 11,
                          marginLeft: 4,
                        }}
                        numberOfLines={1}
                      >
                        Event: {item.eventId}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  {/* Edit Button */}
                  <TouchableOpacity
                    onPress={() => handleOpenEdit(item)}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      backgroundColor: isDark
                        ? "rgba(255, 255, 255, 0.08)"
                        : "rgba(0, 0, 0, 0.06)",
                    }}
                    activeOpacity={0.7}
                  >
                    <Edit size={17} color={textPrimary} />
                  </TouchableOpacity>

                  {/* Delete Button */}
                  <TouchableOpacity
                    onPress={() => handleDeleteStory(item)}
                    disabled={deletingId === item.id}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      backgroundColor: "rgba(239, 68, 68, 0.1)",
                    }}
                    activeOpacity={0.7}
                  >
                    {deletingId === item.id ? (
                      <ActivityIndicator size="small" color="#EF4444" />
                    ) : (
                      <Trash2 size={17} color="#EF4444" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Edit Story Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!updating) setEditModalVisible(false);
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: cardBg,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: "90%",
              padding: 20,
              paddingBottom: Math.max(insets.bottom, 20),
            }}
          >
            {/* Modal Header */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  fontFamily: "Poppins_600SemiBold",
                  color: textPrimary,
                  fontSize: 18,
                }}
              >
                Edit Story
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (!updating) setEditModalVisible(false);
                }}
                disabled={updating}
              >
                <X size={22} color={textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Story Name */}
              <Input
                label="Story Name *"
                value={editName}
                onChangeText={setEditName}
                placeholder="Story Name"
                style={{ marginBottom: 14 }}
              />

              {/* Event Picker Button */}
              <View style={{ marginBottom: 14 }}>
                <Text
                  style={{
                    fontFamily: "Poppins_500Medium",
                    color: textPrimary,
                    fontSize: 13,
                    marginBottom: 6,
                  }}
                >
                  Link to Event (Optional)
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setEventPickerTarget("edit");
                    setShowEventPicker(true);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 14,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: cardBorder,
                    backgroundColor: cardBg,
                  }}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                    <Calendar size={18} color="#FFBA00" />
                    <Text
                      style={{
                        fontFamily: "Poppins_400Regular",
                        color: editSelectedEvent ? textPrimary : textSecondary,
                        fontSize: 14,
                        marginLeft: 10,
                      }}
                      numberOfLines={1}
                    >
                      {editSelectedEvent ? editSelectedEvent.title : "None (select event)"}
                    </Text>
                  </View>
                  <ChevronDown size={18} color={textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Order */}
              <View style={{ marginBottom: 16 }}>
                <Input
                  label="Sort Order"
                  value={editOrder}
                  onChangeText={setEditOrder}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </View>

              {/* Media Slides Header & Picker */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Poppins_500Medium",
                    color: textPrimary,
                    fontSize: 14,
                  }}
                >
                  Story Slides ({editMedia.length}) *
                </Text>
                <TouchableOpacity
                  onPress={() => pickMedia("edit")}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    backgroundColor: "rgba(176, 24, 102, 0.14)",
                  }}
                  activeOpacity={0.8}
                >
                  <ImagePlus size={16} color="#B01866" />
                  <Text
                    style={{
                      fontFamily: "Poppins_500Medium",
                      color: "#B01866",
                      fontSize: 12,
                      marginLeft: 6,
                    }}
                  >
                    Add Media
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Edit Media Previews */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10, paddingVertical: 6, marginBottom: 20 }}
              >
                {editMedia.map((item, idx) => (
                  <View
                    key={`${item.uri}-${idx}`}
                    style={{
                      position: "relative",
                      width: 86,
                      height: 124,
                      borderRadius: 12,
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: cardBorder,
                      backgroundColor: isDark ? "#2A2A32" : "#E2E8F0",
                    }}
                  >
                    <Image source={{ uri: item.uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />

                    {/* Video Badge */}
                    {item.type === "video" && (
                      <View
                        style={{
                          position: "absolute",
                          bottom: 4,
                          left: 4,
                          backgroundColor: "rgba(0, 0, 0, 0.75)",
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 6,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        <Video size={10} color="#FFBA00" />
                        <Text style={{ color: "#FFFFFF", fontSize: 9, fontFamily: "Poppins_600SemiBold" }}>
                          VIDEO
                        </Text>
                      </View>
                    )}

                    <TouchableOpacity
                      onPress={() => removeEditMedia(idx)}
                      style={{
                        position: "absolute",
                        top: 4,
                        right: 4,
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: "rgba(0, 0, 0, 0.65)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <X size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>

              {/* Save Changes Button */}
              <TouchableOpacity
                style={{
                  backgroundColor: "#B01866",
                  opacity: updating ? 0.7 : 1,
                  paddingVertical: 14,
                  borderRadius: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 10,
                  marginBottom: 10,
                }}
                disabled={updating}
                onPress={handleUpdateStory}
                activeOpacity={0.8}
              >
                {updating ? (
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
                      Saving Changes...
                    </Text>
                  </>
                ) : (
                  <>
                    <Upload size={18} color="#FFFFFF" />
                    <Text
                      style={{
                        fontFamily: "Poppins_600SemiBold",
                        color: "#FFFFFF",
                        fontSize: 15,
                        marginLeft: 8,
                      }}
                    >
                      Save Changes
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Event Selection Modal */}
      <Modal
        visible={showEventPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEventPicker(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: cardBg,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: "75%",
              padding: 20,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  fontFamily: "Poppins_600SemiBold",
                  color: textPrimary,
                  fontSize: 18,
                }}
              >
                Link Event to Story
              </Text>
              <TouchableOpacity onPress={() => setShowEventPicker(false)}>
                <Text
                  style={{
                    fontFamily: "Poppins_500Medium",
                    color: "#B01866",
                    fontSize: 15,
                  }}
                >
                  Done
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => {
                if (eventPickerTarget === "create") {
                  setSelectedEvent(null);
                } else {
                  setEditSelectedEvent(null);
                }
                setShowEventPicker(false);
              }}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 12,
                backgroundColor:
                  (eventPickerTarget === "create" ? !selectedEvent : !editSelectedEvent)
                    ? "rgba(176, 24, 102, 0.15)"
                    : "transparent",
                marginBottom: 8,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  fontFamily: "Poppins_500Medium",
                  color: (eventPickerTarget === "create" ? !selectedEvent : !editSelectedEvent)
                    ? "#B01866"
                    : textPrimary,
                  fontSize: 14,
                }}
              >
                None
              </Text>
              {(eventPickerTarget === "create" ? !selectedEvent : !editSelectedEvent) && (
                <Check size={18} color="#B01866" />
              )}
            </TouchableOpacity>

            <FlatList
              data={events}
              keyExtractor={(item) => item.eventId || item.id}
              renderItem={({ item }) => {
                const currentSelection =
                  eventPickerTarget === "create" ? selectedEvent : editSelectedEvent;
                const isSelected =
                  currentSelection &&
                  (currentSelection.eventId || currentSelection.id) === (item.eventId || item.id);
                return (
                  <TouchableOpacity
                    onPress={() => {
                      if (eventPickerTarget === "create") {
                        setSelectedEvent(item);
                      } else {
                        setEditSelectedEvent(item);
                      }
                      setShowEventPicker(false);
                    }}
                    style={{
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                      backgroundColor: isSelected
                        ? "rgba(176, 24, 102, 0.15)"
                        : "transparent",
                      marginBottom: 4,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontFamily: "Poppins_500Medium",
                          color: isSelected ? "#B01866" : textPrimary,
                          fontSize: 14,
                        }}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      {item.category ? (
                        <Text
                          style={{
                            fontFamily: "Poppins_400Regular",
                            color: textSecondary,
                            fontSize: 12,
                          }}
                        >
                          {item.category}
                        </Text>
                      ) : null}
                    </View>
                    {isSelected && <Check size={18} color="#B01866" />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
