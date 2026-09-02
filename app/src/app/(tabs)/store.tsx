// src/screens/App/Store/StoreScreen.tsx
import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Header from '@/components/layout/Header';

// ─── Temporarily hidden — Store coming soon ────────────────────────────────
// import { useState } from "react";
// import {
//   ScrollView,
//   TouchableOpacity,
//   Image,
//   FlatList,
//   ActivityIndicator,
//   RefreshControl,
// } from "react-native";
// import { showAlert } from "../../components";
// import { useStoreContext } from '@/state/StoreContext';
// import { useUserStore } from '@/state/userStore';
// import { useRouter } from "expo-router";
// ──────────────────────────────────────────────────────────────────────────────

const StoreScreen = () => {
  // const router = useRouter();
  // const [activeFilter, setActiveFilter] = useState("all");
  // const { userData: userProfile } = useUserStore();
  // const { storeItems, cart, loading, refreshing, refresh, getCartItemCount } =
  //   useStoreContext();

  // const getCategoryIcon = (category: string) => {
  //   switch (category.toLowerCase()) {
  //     case "clothing":  return "shirt";
  //     case "accessories": return "watch";
  //     case "merchandise": return "gift";
  //     case "food":      return "restaurant";
  //     default:          return "pricetag";
  //   }
  // };

  // const filteredItems = storeItems.filter((item) => {
  //   if (activeFilter === "all") return item.isActive;
  //   return item.category === activeFilter && item.isActive;
  // });

  // const categories = [
  //   "all",
  //   ...Array.from(new Set(storeItems.map((item) => item.category))),
  // ];

  // const FilterButton = ({ title, filterKey }: { title: string; filterKey: string }) => (
  //   <TouchableOpacity
  //     className={`px-6 py-2 border-2 rounded-2xl mr-3 ${activeFilter === filterKey ? "border-[#FFBA00]" : "border-[#A0B3D0]"}`}
  //     onPress={() => setActiveFilter(filterKey)}
  //   >
  //     <Text
  //       style={{ fontFamily: "Outfit_500Medium" }}
  //       className={`${activeFilter === filterKey ? "text-[#FFBA00]" : "text-[#0C3572]"}`}
  //     >
  //       {title.charAt(0).toUpperCase() + title.slice(1)}
  //     </Text>
  //   </TouchableOpacity>
  // );

  // if (loading) {
  //   return (
  //     <View className="flex-1 bg-transparent items-center justify-center">
  //       <ActivityIndicator size="large" color="#FFBA00" />
  //       <Text style={{ fontFamily: "Outfit_500Medium" }} className="text-[#0C3572] mt-4">
  //         Loading store...
  //       </Text>
  //     </View>
  //   );
  // }

  return (
    <View className="flex-1 bg-transparent">
      <Header />

      {/* Coming Soon */}
      <View className="flex-1 items-center justify-center px-8">
        <Ionicons name="storefront-outline" size={72} color="#FFBA00" />
        <Text
          style={{ fontFamily: "Outfit_700Bold" }}
          className="text-[#121212] text-3xl mt-6 mb-3"
        >
          Coming Soon
        </Text>
        <Text
          style={{ fontFamily: "Outfit_400Regular" }}
          className="text-[#2175C0] text-base text-center"
        >
          {"\n"}Check back soon for exclusive merch & rewards!
        </Text>
      </View>

      {/* ── Commented out store body ──────────────────────────────────────── */}
      {/* <View className="flex-row items-center justify-between px-6 mt-6 mb-6">
        <Text style={{ fontFamily: "Outfit_700Bold" }} className="text-[#121212] text-2xl">
          Store
        </Text>
        <View className="flex-row items-center h-12">
          <TouchableOpacity
            className="bg-[#FFBA00] rounded-xl p-3 relative"
            onPress={() => router.push("/store/Cart")}
          >
            <Ionicons name="cart" size={24} color="#000" />
            {cart && cart.items.length > 0 && (
              <View className="absolute -top-1 -right-1 bg-red-500 rounded-full w-5 h-5 items-center justify-center">
                <Text style={{ fontFamily: "Outfit_700Bold" }} className="text-[#0C3572] text-xs">
                  {getCartItemCount()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <View className="flex-row items-center ml-4 px-4 bg-[#FFFFFF66] h-full rounded-xl">
            <Text style={{ fontFamily: "Outfit_700Bold" }} className="text-[#FFBA00]">
              {userProfile?.coins || 0}
            </Text>
            <Image source={require("@/assets/Crown.png")} className="w-6 h-6 ml-1 mb-2" />
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#FFBA00" />}
      >
        <View className="bg-transparent min-h-screen px-6">
          <TouchableOpacity
            className="bg-[#157D66] rounded-2xl flex-row items-center justify-between w-full py-4 px-6 mb-6"
            onPress={() => router.push("/Leaderboard")}
          >
            <View className="flex-row items-center">
              <Ionicons name="bar-chart" size={24} color="white" />
              <Text style={{ fontFamily: "Outfit_700Bold" }} className="text-white text-lg ml-3">
                Leaderboard
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="white" />
          </TouchableOpacity>

          {storeItems.length > 0 && (
            <View className="mb-4">
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {categories.map((category) => (
                  <FilterButton key={category} title={category} filterKey={category} />
                ))}
              </ScrollView>
            </View>
          )}

          {filteredItems.length > 0 ? (
            <View className="flex-row flex-wrap justify-between mb-6">
              {filteredItems.map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </View>
          ) : storeItems.length === 0 ? (
            <View className="my-4">...</View>
          ) : (
            <View className="flex-1 justify-center items-center py-16">
              <Ionicons name="search-outline" size={64} color="#6B7280" />
              <Text style={{ fontFamily: "Outfit_600SemiBold" }} className="text-[#0C3572] text-xl mt-4 mb-2">
                No Items Found
              </Text>
              <Text style={{ fontFamily: "Outfit_400Regular" }} className="text-[#2175C0] text-center">
                No items available in this category at the moment.
              </Text>
            </View>
          )}
        </View>
      </ScrollView> */}
      {/* ─────────────────────────────────────────────────────────────────── */}
    </View>
  );
};

export default StoreScreen;

