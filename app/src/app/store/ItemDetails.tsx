// src/screens/App/Store/ItemDetailsScreen.tsx
import React, { useState, useEffect } from "react";
import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { showAlert } from "@/components";
import { useStoreContext } from "@/state/StoreContext";

const { width } = Dimensions.get("window");

const ItemDetailsScreen = () => {
  const router = useRouter();
  const { itemId } = useLocalSearchParams() as { itemId: string };
  /* Removed API call */
  const [loading, setLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [addingToCart, setAddingToCart] = useState(false);

  // Use store context
  const { cart, updateCart, isItemInCart: checkItemInCart } = useStoreContext();

  useEffect(() => {
    fetchItemDetails();
  }, [itemId]);

  const fetchItemDetails = async () => {
    try {
      setLoading(true);
      /* Removed API call */

      if (result.success) {
        setItem(result.data);
        // Set default size if available
        if (result.data.sizeOptions && result.data.sizeOptions.length > 0) {
          setSelectedSize(result.data.sizeOptions[0].size);
        }
      } else {
        showAlert("Error", result.error);
        router.back();
      }
    } catch (error) {
      console.error("Error fetching item details:", error);
      showAlert("Error", "Failed to load item details");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async () => {
    if (!item) return;

    if (item.sizeOptions.length > 0 && !selectedSize) {
      showAlert("Select Size", "Please select a size before adding to cart");
      return;
    }

    // Check if size is available (negative inventory means unlimited)
    const sizeOption = item.sizeOptions.find((s) => s.size === selectedSize);
    if (
      sizeOption &&
      sizeOption.qtyAvailable >= 0 &&
      sizeOption.qtyAvailable < quantity
    ) {
      showAlert(
        "Insufficient Stock",
        `Only ${sizeOption.qtyAvailable} items available in size ${selectedSize}`
      );
      return;
    }

    try {
      setAddingToCart(true);
      /* Removed API call */

      if (result.success) {
        // Update cart in context
        updateCart(result.data);
        showAlert("Success", "Item added to cart successfully");
      } else {
        showAlert("Error", result.error);
      }
    } catch (error) {
      console.error("Error adding to cart:", error);
      showAlert("Error", "Failed to add item to cart");
    } finally {
      setAddingToCart(false);
    }
  };

  const handleBuyNow = async () => {
    if (!item) return;

    if (item.sizeOptions.length > 0 && !selectedSize) {
      showAlert("Select Size", "Please select a size before purchasing");
      return;
    }

    try {
      setAddingToCart(true);
      /* Removed API call */

      if (result.success) {
        router.push("/store/Cart");
      } else {
        showAlert("Error", result.error);
      }
    } catch (error) {
      console.error("Error:", error);
      showAlert("Error", "Failed to proceed with purchase");
    } finally {
      setAddingToCart(false);
    }
  };

  const getTotalPrice = () => {
    if (!item) return 0;
    let price = item.price;

    if (selectedSize) {
      const sizeOption = item.sizeOptions.find((s) => s.size === selectedSize);
      if (sizeOption) {
        price += sizeOption.priceModifier;
      }
    }

    return price * quantity;
  };

  const getMaxQuantity = () => {
    if (!item) return 1;

    let maxQty = item.maxQtyPerUser;

    // Check size-specific inventory (negative means unlimited)
    if (selectedSize) {
      const sizeOption = item.sizeOptions.find((s) => s.size === selectedSize);
      if (sizeOption && sizeOption.qtyAvailable >= 0) {
        maxQty = Math.min(maxQty, sizeOption.qtyAvailable);
      }
      // If qtyAvailable is negative, it's unlimited - don't limit
    }

    // Check overall inventory (negative means unlimited)
    if (item.currentInventory >= 0) {
      maxQty = Math.min(maxQty, item.currentInventory);
    }
    // If currentInventory is negative, it's unlimited - don't limit

    return Math.max(1, maxQty);
  };

  const isItemInCartCheck = () => {
    if (!item) return false;
    return checkItemInCart(item.id);
  };

  if (loading) {
    return (
      <View className="flex-1 bg-transparent items-center justify-center">
        <ActivityIndicator size="large" color="#FFBA00" />
        <Text
          style={{ fontFamily: "Outfit_500Medium" }}
          className="text-[#0C3572] mt-4"
        >
          Loading item...
        </Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View className="flex-1 bg-transparent items-center justify-center">
        <Text style={{ fontFamily: "Outfit_500Medium" }} className="text-[#0C3572]">
          Item not found
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-transparent">
      {/* Header */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center justify-between px-6 pt-12 pb-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="p-3 bg-[#FFFFFF66] rounded-full"
          >
            <Ionicons name="arrow-back" size={24} color="#0C3572" />
          </TouchableOpacity>
          <Text
            style={{ fontFamily: "Outfit_700Bold" }}
            className="text-[#0C3572] text-xl"
          >
            Item Details
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/store/Cart")}
            className="p-3 bg-[#FFFFFF66] rounded-full"
          >
            <Ionicons name="cart" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Image Carousel */}
        <View className="my-6">
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(event) => {
              const index = Math.round(
                event.nativeEvent.contentOffset.x / width
              );
              setCurrentImageIndex(index);
            }}
            scrollEventThrottle={16}
          >
            {item.images && item.images.length > 0 ? (
              item.images.map((image, index) => (
                <View
                  key={index}
                  style={{ width }}
                  className="bg-transparent px-6 h-80"
                >
                  <Image
                    source={{ uri: image }}
                    className="w-full rounded-2xl h-full"
                    resizeMode="cover"
                  />
                </View>
              ))
            ) : (
              <View
                style={{ width }}
                className="bg-white h-96 items-center justify-center"
              >
                <Ionicons name="image-outline" size={64} color="#6B7280" />
              </View>
            )}
          </ScrollView>

          {/* Image Indicators */}
          {item.images && item.images.length > 1 && (
            <View className="flex-row justify-center mt-4">
              {item.images.map((_, index) => (
                <View
                  key={index}
                  className={`h-2 rounded-full mx-1 ${
                    index === currentImageIndex
                      ? "bg-[#FFBA00] w-6"
                      : "bg-gray-600 w-2"
                  }`}
                />
              ))}
            </View>
          )}
        </View>

        <View className="px-6">
          {/* Item Info */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-2">
              <Text
                style={{ fontFamily: "Outfit_700Bold" }}
                className="text-[#0C3572] text-2xl flex-1"
              >
                {item.name}
              </Text>
              <View className="bg-[#FFBA00]/20 px-3 py-1 rounded-full">
                <Text
                  style={{ fontFamily: "Outfit_600SemiBold" }}
                  className="text-[#FFBA00] capitalize"
                >
                  {item.category}
                </Text>
              </View>
            </View>

            <Text
              style={{ fontFamily: "Outfit_400Regular" }}
              className="text-[#2175C0] text-base leading-6"
            >
              {item.description}
            </Text>
          </View>

          {/* Price */}
          <View className="bg-[#FFFFFF66] rounded-2xl p-4 mb-6">
            <Text
              style={{ fontFamily: "Outfit_500Medium" }}
              className="text-[#2175C0] mb-2"
            >
              Price
            </Text>
            <View className="flex-row items-center">
              <View className="w-4 h-4 bg-[#FFBA00] rounded-full mr-2" />
              <Text
                style={{ fontFamily: "Outfit_700Bold" }}
                className="text-[#0C3572] text-3xl"
              >
                ₹{getTotalPrice()}
              </Text>
            </View>
            {selectedSize &&
              item.sizeOptions.find((s) => s.size === selectedSize)
                ?.priceModifier !== 0 && (
                <Text
                  style={{ fontFamily: "Outfit_400Regular" }}
                  className="text-[#2175C0] text-sm mt-1"
                >
                  Base price: ₹{item.price} + ₹
                  {
                    item.sizeOptions.find((s) => s.size === selectedSize)
                      ?.priceModifier
                  }{" "}
                  (size)
                </Text>
              )}
          </View>

          {/* Size Selection */}
          {item.sizeOptions.length > 0 && (
            <View className="mb-6">
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className="text-[#0C3572] text-lg mb-3"
              >
                Select Size
              </Text>
              <View className="flex-row flex-wrap">
                {item.sizeOptions.map((sizeOption) => {
                  const isAvailable =
                    sizeOption.qtyAvailable === -1 ||
                    sizeOption.qtyAvailable > 0;
                  const isSelected = selectedSize === sizeOption.size;

                  return (
                    <TouchableOpacity
                      key={sizeOption.size}
                      disabled={!isAvailable}
                      onPress={() => setSelectedSize(sizeOption.size)}
                      className={`px-6 py-3 rounded-xl mr-3 mb-3 ${
                        isSelected
                          ? "bg-[#FFBA00]"
                          : isAvailable
                          ? "bg-[#FFFFFF66] border-2 border-[#A0B3D0]"
                          : "bg-white border-2 border-[#A0B3D0]"
                      }`}
                    >
                      <Text
                        style={{ fontFamily: "Outfit_600SemiBold" }}
                        className={`text-base ${
                          isSelected
                            ? "text-black"
                            : isAvailable
                            ? "text-[#0C3572]"
                            : "text-gray-600"
                        }`}
                      >
                        {sizeOption.size}
                      </Text>
                      {sizeOption.priceModifier > 0 && isAvailable && (
                        <Text
                          style={{ fontFamily: "Outfit_400Regular" }}
                          className={`text-xs ${
                            isSelected ? "text-black" : "text-[#2175C0]"
                          }`}
                        >
                          +₹{sizeOption.priceModifier}
                        </Text>
                      )}
                      {!isAvailable && (
                        <Text
                          style={{ fontFamily: "Outfit_400Regular" }}
                          className="text-xs text-gray-600"
                        >
                          Out
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Quantity Selection */}
          {isItemInCartCheck() ? null : (
            <View className="mb-6">
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className="text-[#0C3572] text-lg mb-3"
              >
                Quantity
              </Text>
              <View className="flex-row items-center">
                <TouchableOpacity
                  onPress={() => setQuantity(Math.max(1, quantity - 1))}
                  className="bg-[#FFFFFF66] p-3 rounded-xl"
                  disabled={quantity <= 1}
                >
                  <Ionicons
                    name="remove"
                    size={24}
                    color={quantity <= 1 ? "#6B7280" : "#FFBA00"}
                  />
                </TouchableOpacity>

                <Text
                  style={{ fontFamily: "Outfit_700Bold" }}
                  className="text-[#0C3572] text-2xl mx-8"
                >
                  {quantity}
                </Text>

                <TouchableOpacity
                  onPress={() =>
                    setQuantity(Math.min(getMaxQuantity(), quantity + 1))
                  }
                  className="bg-[#FFFFFF66] p-3 rounded-xl"
                  disabled={quantity >= getMaxQuantity()}
                >
                  <Ionicons
                    name="add"
                    size={24}
                    color={quantity >= getMaxQuantity() ? "#6B7280" : "#FFBA00"}
                  />
                </TouchableOpacity>

                <Text
                  style={{ fontFamily: "Outfit_400Regular" }}
                  className="text-[#2175C0] ml-4"
                >
                  Max: {getMaxQuantity()}
                </Text>
              </View>
            </View>
          )}

          {isItemInCartCheck() && (
            <View className="mb-6">
              <Text
                style={{ fontFamily: "Outfit_500Medium" }}
                className="text-green-500"
              >
                This item is already in your cart.
              </Text>
            </View>
          )}

          {/* Stock Info */}
          <View className="bg-[#FFFFFF66] rounded-2xl p-4 mb-6">
            <View className="flex-row items-center">
              <Ionicons
                name={
                  item.currentInventory < 0 || item.currentInventory > 10
                    ? "checkmark-circle"
                    : item.currentInventory === 0
                    ? "close-circle"
                    : "warning"
                }
                size={20}
                color={
                  item.currentInventory < 0 || item.currentInventory > 10
                    ? "#10B981"
                    : item.currentInventory === 0
                    ? "#EF4444"
                    : "#F59E0B"
                }
              />
              <Text
                style={{ fontFamily: "Outfit_500Medium" }}
                className="text-[#0C3572] ml-2"
              >
                {item.currentInventory < 0
                  ? "In Stock"
                  : item.currentInventory > 10
                  ? "In Stock"
                  : item.currentInventory === 0
                  ? "Out of Stock"
                  : `Only ${item.currentInventory} left in stock`}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action Buttons */}
      <View className="px-6 pb-8 pt-4 bg-white border-t border-[#A0B3D0]">
        {isItemInCartCheck() ? (
          /* Item is already in cart - show View Cart button */
          <TouchableOpacity
            onPress={() => router.push("/store/Cart")}
            className="bg-[#FFBA00] rounded-xl py-4 items-center"
          >
            <View className="flex-row items-center">
              <Ionicons name="cart" size={20} color="#000" />
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className="text-black ml-2"
              >
                View Cart
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          /* Item not in cart - show Add to Cart button */
          <TouchableOpacity
            onPress={handleAddToCart}
            disabled={addingToCart || item.currentInventory === 0}
            className={`bg-[#FFBA00] rounded-xl py-4 items-center ${
              addingToCart || item.currentInventory === 0 ? "opacity-50" : ""
            }`}
          >
            {addingToCart ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <View className="flex-row items-center">
                <Ionicons name="cart-outline" size={20} color="#000" />
                <Text
                  style={{ fontFamily: "Outfit_600SemiBold" }}
                  className="text-black ml-2"
                >
                  Add to Cart
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default ItemDetailsScreen;
