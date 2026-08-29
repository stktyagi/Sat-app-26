import {
  View,
  ScrollView,
  TouchableOpacity,
  Text,
  Image,
  Linking,
  ActivityIndicator,
} from "react-native";
import { showAlert } from "@/components";
import { useEffect, useState } from "react";
import { Corousal } from "@/types/models";
import {
  createCorousal,
  deleteCorousal,
  getCorousal,
} from "@/api/admin";
import { launchImageLibrary } from "react-native-image-picker";
import ImageResizer from "react-native-image-resizer";
import { Input } from "@/components";
import { Timestamp } from "@react-native-firebase/firestore";
import { ArrowLeft, Upload, Trash2, ExternalLink, ImagePlus } from "lucide-react-native";
import { uploadStoryMedia } from "@/api/admin";

// this is the resolution of the prototype image we used, therefore, don't you fucking question the values
const BANNER_IMAGE_RESOLUTION = [350, 166];

function fixDomain(url: string) {
  // replace https://saturnalia.ce83aab07d9a2dfff9ae6c6f9f6754d2.r2.cloudflarestorage.com with https://itsakarsh.tech/
  return url.replace(
    "https://saturnalia.ce83aab07d9a2dfff9ae6c6f9f6754d2.r2.cloudflarestorage.com",
    "https://itsakarsh.tech"
  );
}

export default function Banner({ navigation }: { navigation: any }) {
  const [data, setData] = useState<Corousal[]>([]);
  const [createData, setCreateData] = useState<Partial<Corousal>>({});
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const res = await getCorousal();
    console.log("Res", res);
    setData(res);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteBanner = async (item: Corousal) => {
    showAlert(
      "Delete Banner",
      "Are you sure you want to delete this banner?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingId(item.id);
            await deleteCorousal(item.id);
            setData(data.filter((d) => d.id !== item.id));
            setDeletingId(null);
          },
        },
      ]
    );
  };

  const handleCreateBanner = async () => {
    if (!createData.imageUrl) {
      showAlert("Error", "Please upload an image");
      return;
    }
    if (!createData.link) {
      showAlert("Error", "Please enter a link");
      return;
    }

    setCreating(true);
    try {
      const scaleUpFactor = 2;
      const compressedImage = await ImageResizer.createResizedImage(
        createData.imageUrl,
        BANNER_IMAGE_RESOLUTION[0] * scaleUpFactor,
        BANNER_IMAGE_RESOLUTION[1] * scaleUpFactor,
        "PNG",
        80
      );
      
      // Upload using the story upload API
      const uploadResult = await uploadStoryMedia(compressedImage.uri, 'image');
      
      if (!uploadResult.success || !uploadResult.url) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      console.log("Creating banner with link:", createData.link, "and imageUrl:", uploadResult.url);
      await createCorousal({
        link: createData.link,
        imageUrl: uploadResult.url,
        corousalType: 0,
        isPublic: true,
        date: Timestamp.now(),
      });
      await loadData();
      setCreateData({});
      showAlert("Success", "Banner created successfully!");
    } catch (error) {
      showAlert("Error", "Failed to create banner");
      console.error(error);
    } finally {
      setCreating(false);
    }
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
          <Text style={{ fontFamily: "Outfit_700Bold" }} className="text-[#121212] text-2xl ">Banner Management</Text>
          <Text style={{ fontFamily: "Outfit_400Regular" }} className="text-[#121212] text-sm opacity-80">
            Create and manage app banners
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
        {/* Create Banner Section */}
        <View className="p-6">
          <View className="bg-[#FFFFFF66] rounded-2xl p-6 mb-6 border border-[#A0B3D0]">
            <Text style={{ fontFamily: "Outfit_700Bold" }} className="text-[#EEB170] text-xl mb-4">
              Create New Banner
            </Text>

            {/* Image Upload */}
            <TouchableOpacity
              className="bg-[#FFFFFF66] border-2 border-dashed border-[#EEB170] rounded-xl p-6 mb-4 items-center justify-center"
              onPress={() => {
                launchImageLibrary({ mediaType: "photo" }, (response) => {
                  if (!response.assets || response.assets.length === 0) {
                    return;
                  }
                  const asset = response.assets[0];
                  setCreateData({
                    ...createData,
                    imageUrl: asset.uri,
                  });
                });
              }}
              activeOpacity={0.7}
              style={{ minHeight: 150 }}
            >
              {createData.imageUrl ? (
                <Image
                  source={{ uri: createData.imageUrl }}
                  className="w-full h-32 rounded-lg"
                  resizeMode="cover"
                />
              ) : (
                <>
                  <ImagePlus size={48} color="#EEB170" />
                  <Text style={{ fontFamily: "Outfit_400Regular" }} className="text-[#0C3572] text-base mt-3">
                    Tap to upload banner image
                  </Text>
                  <Text style={{ fontFamily: "Outfit_400Regular" }}  className="text-[#2175C0] text-sm mt-1">
                    Recommended: 350x166px
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Link Input */}
            <Input
              label="Banner Link"
              value={createData.link || ""}
              onChangeText={(value) => {
                setCreateData({
                  ...createData,
                  link: value,
                });
              }}
              placeholder="https://example.com"
              className="mb-4"
            />

            {/* Create Button */}
            <TouchableOpacity
              className={`${
                creating ? "bg-[#EEB170]/50" : "bg-[#EEB170]"
              } py-4 rounded-xl flex-row items-center justify-center`}
              disabled={creating}
              onPress={handleCreateBanner}
              activeOpacity={0.7}
            >
              {creating ? (
                <>
                  <ActivityIndicator color="#121212" />
                  <Text style={{ fontFamily: "Outfit_400Regular" }} className="text-[#121212]  text-base ml-2">
                    Creating...
                  </Text>
                </>
              ) : (
                <>
                  <Upload size={20} color="#121212" />
                  <Text style={{ fontFamily: "Outfit_700Bold" }} className="text-[#121212]  text-base ml-2">
                    Create Banner
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Existing Banners */}
          <Text style={{ fontFamily: "Outfit_700Bold" }} className="text-[#EEB170] text-xl mb-4">
            Active Banners ({data.length})
          </Text>

          {loading ? (
            <View className="items-center justify-center py-12">
              <ActivityIndicator size="large" color="#EEB170" />
              <Text style={{ fontFamily: "Outfit_400Regular" }} className="text-[#2175C0] mt-4">Loading banners...</Text>
            </View>
          ) : data.length === 0 ? (
            <View className="bg-[#FFFFFF66] rounded-2xl p-8 items-center border border-[#A0B3D0]">
              <ImagePlus size={48} color="#555" />
              <Text style={{ fontFamily: "Outfit_400Regular" }} className="text-[#2175C0] text-center mt-4">
                No banners yet. Create your first banner above!
              </Text>
            </View>
          ) : (
            data.map((item, index) => (
              <View
                key={index}
                className="bg-[#FFFFFF66] rounded-2xl overflow-hidden mb-4 border border-[#A0B3D0]"
              >
                {/* Banner Image */}
                <TouchableOpacity
                  onPress={() => {
                    (async () => {
                      if (!item.link) return;
                      const supported = await Linking.canOpenURL(item.link);
                      if (!supported) return;
                      await Linking.openURL(item.link);
                    })();
                  }}
                  activeOpacity={0.8}
                >
                  <Image
                    className="w-full h-48"
                    source={
                      item.imageUrl != null
                        ? { uri: fixDomain(item.imageUrl) }
                        : require("../../assets/banner.png")
                    }
                    resizeMode="cover"
                  />
                  {item.link && (
                    <View className="absolute top-3 right-3 bg-transparent/70 px-3 py-1.5 rounded-full flex-row items-center">
                      <ExternalLink size={14} color="#EEB170" />
                      <Text style={{ fontFamily: "Outfit_400Regular" }} className="text-[#EEB170] text-xs ml-1">
                        Link
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Banner Actions */}
                <View className="p-4">
                  {item.link && (
                    <Text style={{ fontFamily: "Outfit_400Regular" }} className="text-[#2175C0] text-sm mb-3" numberOfLines={1}>
                      🔗 {item.link}
                    </Text>
                  )}
                  <TouchableOpacity
                    className="bg-[#E84054] py-3 rounded-xl flex-row items-center justify-center"
                    onPress={() => handleDeleteBanner(item)}
                    disabled={deletingId === item.id}
                    activeOpacity={0.7}
                  >
                    {deletingId === item.id ? (
                      <>
                        <ActivityIndicator color="#fff" size="small" />
                        <Text style={{ fontFamily: "Outfit_400Regular" }} className="text-[#0C3572] ml-2">
                          Deleting...
                        </Text>
                      </>
                    ) : (
                      <>
                        <Trash2 size={18} color="#fff" />
                        <Text style={{ fontFamily: "Outfit_400Regular" }} className="text-[#0C3572] ml-2">
                          Delete Banner
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
