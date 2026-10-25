import React, { useEffect, useState } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  Text,
  Image,
  Linking,
  ActivityIndicator,
  StatusBar,
  Switch,
  Modal,
} from "react-native";
import { showAlert, Input } from "@/components";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { ArrowLeft, Upload, Trash2, ExternalLink, ImagePlus, Eye, EyeOff, Edit, X } from "lucide-react-native";
import {
  adminListBanners,
  adminCreateBanner,
  adminUpdateBanner,
  adminDeleteBanner,
  adminUploadMedia,
  Banner as BannerModel,
} from "@/api/admin";
import { useAdminNavigation } from "@/hooks/useAdminNavigation";
import { useThemeStore } from "@/state/themeStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useContentCacheStore } from "@/state/contentCacheStore";

export default function BannerManagement() {
  const navigation = useAdminNavigation();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();

  const [banners, setBanners] = useState<BannerModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [order, setOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [selectedRatio, setSelectedRatio] = useState<[number, number]>([4, 3]);

  // Edit Modal State
  const [editingBanner, setEditingBanner] = useState<BannerModel | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLink, setEditLink] = useState("");
  const [editOrder, setEditOrder] = useState("0");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editImageUri, setEditImageUri] = useState<string | null>(null);
  const [editSelectedRatio, setEditSelectedRatio] = useState<[number, number]>([4, 3]);
  const [updating, setUpdating] = useState(false);

  const RATIO_OPTIONS: { label: string; ratio: [number, number]; desc: string }[] = [
    { label: "4:3", ratio: [4, 3], desc: "Standard" },
    { label: "4:5", ratio: [4, 5], desc: "Tall Hero" },
    { label: "3:2", ratio: [3, 2], desc: "Medium" },
    { label: "16:9", ratio: [16, 9], desc: "Wide" },
  ];

  const bgColor = isDark ? "#131316" : "#E0E0E0";
  const cardBg = isDark ? "#1C1C20" : "#FFFFFF";
  const cardBorder = isDark ? "#2A2A30" : "#D5D5D5";
  const textPrimary = isDark ? "#FFFFFF" : "#111827";
  const textSecondary = isDark ? "#A0A0A0" : "#6B7280";

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await adminListBanners();
      setBanners(res);
    } catch (e: any) {
      console.error("loadData banners error:", e);
      showAlert("Error", e?.message || "Failed to load banners");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const pickImage = async () => {
    try {
      // Android Photo Picker — no READ_MEDIA_IMAGES permission needed
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        // Crop to the selected aspect ratio using expo-image-manipulator
        const asset = result.assets[0];
        const srcW = asset.width;
        const srcH = asset.height;
        const [rW, rH] = selectedRatio;
        const targetAspect = rW / rH;
        const srcAspect = srcW / srcH;
        let cropW = srcW;
        let cropH = srcH;
        if (srcAspect > targetAspect) {
          cropW = Math.round(srcH * targetAspect);
        } else {
          cropH = Math.round(srcW / targetAspect);
        }
        const originX = Math.round((srcW - cropW) / 2);
        const originY = Math.round((srcH - cropH) / 2);
        const cropped = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ crop: { originX, originY, width: cropW, height: cropH } }],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
        );
        setSelectedImageUri(cropped.uri);
      }
    } catch (err: any) {
      console.error("pickImage error:", err);
      showAlert("Error", "Failed to select image");
    }
  };

  const handleCreateBanner = async () => {
    if (!title.trim()) {
      showAlert("Validation Error", "Please provide a banner title.");
      return;
    }
    if (!selectedImageUri) {
      showAlert("Validation Error", "Please pick or upload a banner image.");
      return;
    }
    if (!link.trim()) {
      showAlert("Validation Error", "Please enter a banner destination link.");
      return;
    }

    setCreating(true);
    try {
      // 1. Upload image to ImageKit
      const uploaded = await adminUploadMedia(selectedImageUri, {
        folder: "banners",
      });

      // 2. Create banner via API
      await adminCreateBanner({
        title: title.trim(),
        description: description.trim(),
        imageUrl: uploaded.url,
        imageRef: uploaded.ref,
        link: link.trim(),
        order: parseInt(order, 10) || 0,
        isActive: isActive,
      });

      // 3. Invalidate user session cache
      useContentCacheStore.getState().invalidateBanners();

      // Reset form
      setTitle("");
      setDescription("");
      setLink("");
      setOrder("0");
      setSelectedImageUri(null);
      setIsActive(true);

      showAlert("Success", "Banner created and published successfully!");
      await loadData();
    } catch (error: any) {
      console.error("handleCreateBanner error:", error);
      showAlert("Error", error.message || "Failed to create banner");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (banner: BannerModel) => {
    try {
      const updated = !banner.isActive;
      await adminUpdateBanner(banner.id, { isActive: updated });
      useContentCacheStore.getState().invalidateBanners();
      setBanners((prev) =>
        prev.map((b) => (b.id === banner.id ? { ...b, isActive: updated } : b))
      );
    } catch (err: any) {
      showAlert("Error", err.message || "Failed to update banner status");
    }
  };

  const handleDeleteBanner = (banner: BannerModel) => {
    showAlert(
      "Delete Banner",
      `Are you sure you want to delete "${banner.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingId(banner.id);
            try {
              await adminDeleteBanner(banner.id);
              useContentCacheStore.getState().invalidateBanners();
              setBanners((prev) => prev.filter((b) => b.id !== banner.id));
              showAlert("Success", "Banner deleted successfully");
            } catch (err: any) {
              showAlert("Error", err.message || "Failed to delete banner");
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const handleOpenEdit = (banner: BannerModel) => {
    setEditingBanner(banner);
    setEditTitle(banner.title);
    setEditDescription(banner.description || "");
    setEditLink(banner.link || "");
    setEditOrder(banner.order?.toString() || "0");
    setEditIsActive(banner.isActive);
    setEditImageUri(null);
    setEditSelectedRatio([4, 3]);
    setEditModalVisible(true);
  };

  const pickEditImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const srcW = asset.width;
        const srcH = asset.height;
        const [rW, rH] = editSelectedRatio;
        const targetAspect = rW / rH;
        const srcAspect = srcW / srcH;
        let cropW = srcW;
        let cropH = srcH;
        if (srcAspect > targetAspect) {
          cropW = Math.round(srcH * targetAspect);
        } else {
          cropH = Math.round(srcW / targetAspect);
        }
        const originX = Math.round((srcW - cropW) / 2);
        const originY = Math.round((srcH - cropH) / 2);
        const cropped = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ crop: { originX, originY, width: cropW, height: cropH } }],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
        );
        setEditImageUri(cropped.uri);
      }
    } catch (err: any) {
      console.error("pickEditImage error:", err);
      showAlert("Error", "Failed to select image");
    }
  };

  const handleUpdateBanner = async () => {
    if (!editingBanner) return;
    if (!editTitle.trim()) {
      showAlert("Validation Error", "Please provide a banner title.");
      return;
    }
    if (!editLink.trim()) {
      showAlert("Validation Error", "Please enter a banner destination link.");
      return;
    }

    setUpdating(true);
    try {
      const payload: Partial<BannerModel> = {
        title: editTitle.trim(),
        description: editDescription.trim(),
        link: editLink.trim(),
        order: parseInt(editOrder, 10) || 0,
        isActive: editIsActive,
      };

      if (editImageUri) {
        const uploaded = await adminUploadMedia(editImageUri, {
          folder: "banners",
        });
        payload.imageUrl = uploaded.url;
        payload.imageRef = uploaded.ref;
      }

      const updated = await adminUpdateBanner(editingBanner.id, payload);
      useContentCacheStore.getState().invalidateBanners();

      setBanners((prev) =>
        prev.map((b) => (b.id === editingBanner.id ? { ...b, ...payload, ...(updated || {}) } : b))
      );

      showAlert("Success", "Banner updated successfully!");
      setEditModalVisible(false);
      setEditingBanner(null);
    } catch (error: any) {
      console.error("handleUpdateBanner error:", error);
      showAlert("Error", error.message || "Failed to update banner");
    } finally {
      setUpdating(false);
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
            Banner Management
          </Text>
          <Text
            style={{
              fontFamily: "Poppins_400Regular",
              color: textSecondary,
              fontSize: 13,
              marginTop: 2,
            }}
          >
            Create and manage home screen hero banners
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Create Banner Form */}
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
            Create New Banner
          </Text>

          {/* Aspect Ratio Selector */}
          <View style={{ marginBottom: 14 }}>
            <Text
              style={{
                fontFamily: "Poppins_500Medium",
                color: textSecondary,
                fontSize: 13,
                marginBottom: 8,
              }}
            >
              Crop Aspect Ratio
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {RATIO_OPTIONS.map((opt) => {
                const isSelected = selectedRatio[0] === opt.ratio[0] && selectedRatio[1] === opt.ratio[1];
                return (
                  <TouchableOpacity
                    key={opt.label}
                    onPress={() => setSelectedRatio(opt.ratio)}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      paddingHorizontal: 4,
                      borderRadius: 10,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: isSelected ? "#A855F7" : cardBorder,
                      backgroundColor: isSelected
                        ? isDark
                          ? "rgba(168, 85, 247, 0.16)"
                          : "rgba(168, 85, 247, 0.12)"
                        : isDark
                        ? "rgba(255, 255, 255, 0.03)"
                        : "rgba(0, 0, 0, 0.03)",
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={{
                        fontFamily: isSelected ? "Poppins_600SemiBold" : "Poppins_500Medium",
                        color: isSelected ? "#A855F7" : textPrimary,
                        fontSize: 13,
                      }}
                    >
                      {opt.label}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Poppins_400Regular",
                        color: isSelected ? "#A855F7" : textSecondary,
                        fontSize: 10,
                        marginTop: 2,
                      }}
                    >
                      {opt.desc}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Image Picker */}
          <TouchableOpacity
            style={{
              borderWidth: 2,
              borderStyle: "dashed",
              borderColor: selectedImageUri ? "#FFBA00" : isDark ? "#3A3A42" : "#CBD5E1",
              borderRadius: 16,
              padding: selectedImageUri ? 8 : 16,
              marginBottom: 16,
              alignItems: "center",
              justifyContent: "center",
              minHeight: 160,
              backgroundColor: isDark ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.02)",
            }}
            onPress={pickImage}
            activeOpacity={0.8}
          >
            {selectedImageUri ? (
              <View style={{ width: "100%", alignItems: "center" }}>
                <Image
                  source={{ uri: selectedImageUri }}
                  style={{
                    width: "100%",
                    aspectRatio: selectedRatio[0] / selectedRatio[1],
                    maxHeight: 240,
                    borderRadius: 12,
                  }}
                  resizeMode="cover"
                />
                <Text
                  style={{
                    fontFamily: "Poppins_500Medium",
                    color: "#A855F7",
                    fontSize: 12,
                    marginTop: 8,
                  }}
                >
                  Tap to re-select or re-crop ({selectedRatio[0]}:{selectedRatio[1]})
                </Text>
              </View>
            ) : (
              <>
                <ImagePlus size={36} color="#FFBA00" />
                <Text
                  style={{
                    fontFamily: "Poppins_500Medium",
                    color: textPrimary,
                    fontSize: 14,
                    marginTop: 8,
                  }}
                >
                  Tap to upload banner image
                </Text>
                <Text
                  style={{
                    fontFamily: "Poppins_400Regular",
                    color: textSecondary,
                    fontSize: 12,
                    marginTop: 2,
                  }}
                >
                  Crop ratio: {selectedRatio[0]}:{selectedRatio[1]} (taller for hero banner)
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Title */}
          <Input
            label="Banner Title *"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Jamming Session or TechFest 2026"
            style={{ marginBottom: 14 }}
          />

          {/* Description */}
          <Input
            label="Short Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Catchy subtitle or date information"
            style={{ marginBottom: 14 }}
          />

          {/* Destination Link */}
          <Input
            label="Destination Link *"
            value={link}
            onChangeText={setLink}
            placeholder="https://saturnalia.in or /events/eventId"
            style={{ marginBottom: 14 }}
          />

          {/* Order & Active Toggle */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 20,
              gap: 16,
            }}
          >
            <View style={{ flex: 1 }}>
              <Input
                label="Sort Order"
                value={order}
                onChangeText={setOrder}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>

            <View style={{ alignItems: "center", justifyContent: "center", marginTop: 10 }}>
              <Text
                style={{
                  fontFamily: "Poppins_500Medium",
                  color: textPrimary,
                  fontSize: 13,
                  marginBottom: 6,
                }}
              >
                Is Active
              </Text>
              <Switch
                value={isActive}
                onValueChange={setIsActive}
                trackColor={{ false: "#767577", true: "#FFBA00" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={{
              backgroundColor: "#FFBA00",
              opacity: creating ? 0.7 : 1,
              paddingVertical: 14,
              borderRadius: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            }}
            disabled={creating}
            onPress={handleCreateBanner}
            activeOpacity={0.8}
          >
            {creating ? (
              <>
                <ActivityIndicator color="#000000" />
                <Text
                  style={{
                    fontFamily: "Poppins_600SemiBold",
                    color: "#000000",
                    fontSize: 15,
                    marginLeft: 8,
                  }}
                >
                  Creating Banner...
                </Text>
              </>
            ) : (
              <>
                <Upload size={18} color="#000000" />
                <Text
                  style={{
                    fontFamily: "Poppins_600SemiBold",
                    color: "#000000",
                    fontSize: 15,
                    marginLeft: 8,
                  }}
                >
                  Create Banner
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Existing Banners */}
        <Text
          style={{
            fontFamily: "Poppins_600SemiBold",
            color: textPrimary,
            fontSize: 18,
            marginBottom: 16,
          }}
        >
          All Banners ({banners.length})
        </Text>

        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator size="large" color="#FFBA00" />
            <Text
              style={{
                fontFamily: "Poppins_400Regular",
                color: textSecondary,
                fontSize: 14,
                marginTop: 12,
              }}
            >
              Loading banners from server...
            </Text>
          </View>
        ) : banners.length === 0 ? (
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
            <Text
              style={{
                fontFamily: "Poppins_500Medium",
                color: textSecondary,
                fontSize: 15,
                textAlign: "center",
              }}
            >
              No banners created yet. Use the form above to add your first banner!
            </Text>
          </View>
        ) : (
          banners.map((item) => (
            <View
              key={item.id}
              style={{
                backgroundColor: cardBg,
                borderRadius: 18,
                overflow: "hidden",
                marginBottom: 16,
                borderWidth: 1,
                borderColor: cardBorder,
              }}
            >
              <Image
                source={{ uri: item.imageUrl }}
                style={{ width: "100%", height: 160 }}
                resizeMode="cover"
              />

              <View style={{ padding: 16 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Poppins_600SemiBold",
                      color: textPrimary,
                      fontSize: 16,
                      flex: 1,
                      marginRight: 8,
                    }}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <View
                    style={{
                      backgroundColor: item.isActive ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                      paddingHorizontal: 10,
                      paddingVertical: 3,
                      borderRadius: 12,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Poppins_600SemiBold",
                        color: item.isActive ? "#10B981" : "#EF4444",
                        fontSize: 11,
                      }}
                    >
                      {item.isActive ? "Active" : "Inactive"}
                    </Text>
                  </View>
                </View>

                {item.description ? (
                  <Text
                    style={{
                      fontFamily: "Poppins_400Regular",
                      color: textSecondary,
                      fontSize: 13,
                      marginBottom: 8,
                    }}
                    numberOfLines={2}
                  >
                    {item.description}
                  </Text>
                ) : null}

                {item.link ? (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(item.link)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 14,
                    }}
                  >
                    <ExternalLink size={14} color="#A855F7" />
                    <Text
                      style={{
                        fontFamily: "Poppins_400Regular",
                        color: "#A855F7",
                        fontSize: 13,
                        marginLeft: 6,
                        flex: 1,
                      }}
                      numberOfLines={1}
                    >
                      {item.link}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {/* Actions row */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderTopWidth: 1,
                    borderTopColor: cardBorder,
                    paddingTop: 12,
                    gap: 8,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => handleToggleActive(item)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: 10,
                      backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)",
                    }}
                  >
                    {item.isActive ? (
                      <EyeOff size={16} color={textSecondary} />
                    ) : (
                      <Eye size={16} color="#10B981" />
                    )}
                    <Text
                      style={{
                        fontFamily: "Poppins_500Medium",
                        color: item.isActive ? textSecondary : "#10B981",
                        fontSize: 12,
                        marginLeft: 6,
                      }}
                    >
                      {item.isActive ? "Deactivate" : "Activate"}
                    </Text>
                  </TouchableOpacity>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => handleOpenEdit(item)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 10,
                        backgroundColor: "rgba(65, 184, 240, 0.12)",
                      }}
                    >
                      <Edit size={16} color="#41B8F0" />
                      <Text
                        style={{
                          fontFamily: "Poppins_500Medium",
                          color: "#41B8F0",
                          fontSize: 12,
                          marginLeft: 6,
                        }}
                      >
                        Edit
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleDeleteBanner(item)}
                      disabled={deletingId === item.id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 10,
                        backgroundColor: "rgba(239, 68, 68, 0.1)",
                      }}
                    >
                      {deletingId === item.id ? (
                        <ActivityIndicator size="small" color="#EF4444" />
                      ) : (
                        <>
                          <Trash2 size={16} color="#EF4444" />
                          <Text
                            style={{
                              fontFamily: "Poppins_500Medium",
                              color: "#EF4444",
                              fontSize: 12,
                              marginLeft: 6,
                            }}
                          >
                            Delete
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Edit Banner Modal */}
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
              maxHeight: "85%",
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
                Edit Banner Details
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (!updating) setEditModalVisible(false);
                }}
                disabled={updating}
                style={{
                  padding: 4,
                  borderRadius: 8,
                  backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
                }}
              >
                <X size={20} color={textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Image Preview & Change Option */}
              <View style={{ marginBottom: 16 }}>
                <Text
                  style={{
                    fontFamily: "Poppins_500Medium",
                    color: textSecondary,
                    fontSize: 13,
                    marginBottom: 8,
                  }}
                >
                  Banner Image
                </Text>
                <View
                  style={{
                    borderRadius: 14,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: cardBorder,
                    marginBottom: 10,
                  }}
                >
                  <Image
                    source={{ uri: editImageUri || editingBanner?.imageUrl }}
                    style={{ width: "100%", height: 140 }}
                    resizeMode="cover"
                  />
                </View>

                {/* Aspect Ratio Options for when changing image */}
                <View style={{ marginBottom: 10 }}>
                  <Text
                    style={{
                      fontFamily: "Poppins_400Regular",
                      color: textSecondary,
                      fontSize: 12,
                      marginBottom: 6,
                    }}
                  >
                    Crop Ratio for New Image
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {RATIO_OPTIONS.map((opt) => {
                      const isSel =
                        editSelectedRatio[0] === opt.ratio[0] &&
                        editSelectedRatio[1] === opt.ratio[1];
                      return (
                        <TouchableOpacity
                          key={`edit-ratio-${opt.label}`}
                          onPress={() => setEditSelectedRatio(opt.ratio)}
                          style={{
                            flex: 1,
                            paddingVertical: 6,
                            paddingHorizontal: 8,
                            borderRadius: 8,
                            alignItems: "center",
                            backgroundColor: isSel
                              ? "#41B8F0"
                              : isDark
                              ? "rgba(255, 255, 255, 0.05)"
                              : "rgba(0, 0, 0, 0.04)",
                            borderWidth: 1,
                            borderColor: isSel ? "#41B8F0" : cardBorder,
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: "Poppins_600SemiBold",
                              fontSize: 11,
                              color: isSel ? "#FFFFFF" : textPrimary,
                            }}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <TouchableOpacity
                  onPress={pickEditImage}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: isDark ? "rgba(65, 184, 240, 0.12)" : "rgba(65, 184, 240, 0.08)",
                    borderWidth: 1,
                    borderColor: "#41B8F0",
                  }}
                >
                  <ImagePlus size={16} color="#41B8F0" style={{ marginRight: 6 }} />
                  <Text
                    style={{
                      fontFamily: "Poppins_500Medium",
                      color: "#41B8F0",
                      fontSize: 13,
                    }}
                  >
                    {editImageUri ? "Choose Different Image" : "Change Image (Optional)"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Title */}
              <View style={{ marginBottom: 14 }}>
                <Text
                  style={{
                    fontFamily: "Poppins_500Medium",
                    color: textSecondary,
                    fontSize: 13,
                    marginBottom: 6,
                  }}
                >
                  Title *
                </Text>
                <Input
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholder="e.g., Hackathon 2026"
                />
              </View>

              {/* Description */}
              <View style={{ marginBottom: 14 }}>
                <Text
                  style={{
                    fontFamily: "Poppins_500Medium",
                    color: textSecondary,
                    fontSize: 13,
                    marginBottom: 6,
                  }}
                >
                  Description
                </Text>
                <Input
                  value={editDescription}
                  onChangeText={setEditDescription}
                  placeholder="Optional brief subtitle"
                  multiline
                  numberOfLines={2}
                />
              </View>

              {/* Destination Link */}
              <View style={{ marginBottom: 14 }}>
                <Text
                  style={{
                    fontFamily: "Poppins_500Medium",
                    color: textSecondary,
                    fontSize: 13,
                    marginBottom: 6,
                  }}
                >
                  Destination Link *
                </Text>
                <Input
                  value={editLink}
                  onChangeText={setEditLink}
                  placeholder="https://... or app route"
                />
              </View>

              {/* Order & Active Switch Row */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 20,
                  gap: 16,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: "Poppins_500Medium",
                      color: textSecondary,
                      fontSize: 13,
                      marginBottom: 6,
                    }}
                  >
                    Display Order
                  </Text>
                  <Input
                    value={editOrder}
                    onChangeText={setEditOrder}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>

                <View style={{ alignItems: "center" }}>
                  <Text
                    style={{
                      fontFamily: "Poppins_500Medium",
                      color: textSecondary,
                      fontSize: 13,
                      marginBottom: 8,
                    }}
                  >
                    Active Status
                  </Text>
                  <Switch
                    value={editIsActive}
                    onValueChange={setEditIsActive}
                    trackColor={{ false: "#3F3F46", true: "#41B8F0" }}
                    thumbColor={editIsActive ? "#FFFFFF" : "#A1A1AA"}
                  />
                </View>
              </View>

              {/* Save & Cancel Buttons */}
              <View style={{ flexDirection: "row", gap: 12, marginBottom: 10 }}>
                <TouchableOpacity
                  onPress={() => setEditModalVisible(false)}
                  disabled={updating}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: "center",
                    backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Poppins_500Medium",
                      color: textSecondary,
                      fontSize: 14,
                    }}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleUpdateBanner}
                  disabled={updating}
                  style={{
                    flex: 2,
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#41B8F0",
                  }}
                >
                  {updating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text
                      style={{
                        fontFamily: "Poppins_600SemiBold",
                        color: "#FFFFFF",
                        fontSize: 14,
                      }}
                    >
                      Save Changes
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
