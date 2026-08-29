// src/screens/App/Store/CartScreen.tsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Platform,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Button, showAlert } from "@/components";
import { useStoreContext } from "@/state/StoreContext";
import { useUserStore } from "@/state/userStore";
import { initializeEasebuzzCheckout } from "react-native-easebuzz-sdk";
// Memoized Cart Item Card Component for better performance
/* Removed API call */

const CartScreen = () => {
  const router = useRouter();
  const [updatingItem, setUpdatingItem] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollViewRef = React.useRef<ScrollView>(null);

  // Use store context
  const { cart, loading, refreshing, refresh, updateCart } = useStoreContext();

  // User data for coins
  const { userData, refreshUserProfile } = useUserStore();
  //refresh user profile on mount to get latest coins
  useEffect(() => {
    refreshUserProfile();
  }, []);
  const userCoins = userData?.coins || 0;

  // Discount state
  const [couponCode, setCouponCode] = useState("");
  const [useCoins, setUseCoins] = useState(false);
  /* Removed API call */
  const [calculatingDiscount, setCalculatingDiscount] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  // Payment status
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);

  // Payment response handler
  const handlePaymentResponse = (response: any) => {
    let parsedResponse;

    try {
      if (typeof response === "string") {
        parsedResponse = JSON.parse(response);
      } else if (typeof response === "object" && response !== null) {
        parsedResponse = response;
      } else {
        // Handle unexpected formats
        throw new Error(
          "Unexpected response format received from Easebuzz SDK."
        );
      }
    } catch (e) {
      console.error("Failed to parse the payment response:", e);
      showAlert(
        "Error",
        "Failed to read the payment result. Please check your transactions."
      );
      setPaymentStatus("Payment Failed: Parsing Error");
      return; // Stop execution if parsing fails
    }

    // From this point on, 'parsedResponse' is a guaranteed JavaScript object.
    // console.log("Normalized Parsed Response: ", parsedResponse);
    const transactionResult = parsedResponse.result;
    const detailedResponseObject = parsedResponse.payment_response; // This is usually an object
    const details = detailedResponseObject || null;

    // console.log("Transaction Result: ", transactionResult);
    // console.log("Detailed Response Object: ", detailedResponseObject);

    switch (transactionResult) {
      case "payment_successfull":
        setPaymentStatus("Payment Successful");
        showAlert(
          "Success",
          "Store payment was successful! Please check your Orders in Profile",
          [
            {
              text: "OK",
              onPress: () => {
                // Clear cart and navigate back to store
                updateCart(null);
                router.replace("/store");
              },
            },
          ]
        );
        break;

      case "payment_failed":
      case "error_server_error":
      case "error_noretry":
      case "retry_fail_error":
      case "trxn_not_allowed":
        setPaymentStatus("Payment Failed");
        showAlert(
          "Failure",
          `Payment failed. Reason: ${
            details?.error_Message || "Unknown error"
          }`,
          [
            {
              text: "OK",
              onPress: () => {
                // Clear cart and navigate back to store
                updateCart(null);
                router.replace("/store");
              },
            },
          ]
        );
        break;

      case "user_cancelled":
      case "back_pressed":
      case "bank_back_pressed":
        setPaymentStatus("Payment Cancelled by User");
        showAlert("Cancelled", "You cancelled the payment process.", [
          {
            text: "OK",
            onPress: () => {
              // Clear cart and navigate back to store
              updateCart(null);
              router.replace("/store");
            },
          },
        ]);
        break;

      case "txn_session_timeout":
        setPaymentStatus("Transaction Session Timeout");
        showAlert("Timeout", "The transaction session has expired.");
        break;

      case "invalid_input_data":
        setPaymentStatus("Invalid Input Data");
        showAlert("Error", "Invalid data was provided to the SDK.");
        break;

      default:
        setPaymentStatus(`Unknown Status: ${transactionResult}`);
        showAlert(
          "Unknown Response",
          "An unknown response was received from the payment gateway.",
          [
            {
              text: "OK",
              onPress: () => {
                // Clear cart and navigate back to store
                updateCart(null);
                router.replace("/store");
              },
            },
          ]
        );
        break;
    }
  };

  // Calculate discount when coupon or coins change

  const handleCalculateDiscount = useCallback(async () => {
    // If user intends to use coins, get the latest balance first
    if (useCoins) {
      await refreshUserProfile();
    }

    if (!cart || cart.items.length === 0) {
      setDiscountData(null);
      return;
    }

    if (!couponCode.trim() && !useCoins) {
      setDiscountData(null);
      return;
    }

    setCalculatingDiscount(true);
    try {
      /* Removed API call */

      if (result.success) {
        setDiscountData(result.data);
      } else {
        setDiscountData(null);
        if (couponCode.trim()) {
          showAlert("Error", result.error);
        }
      }
    } catch (error) {
      console.error("Error calculating discount:", error);
      setDiscountData(null);
    } finally {
      setCalculatingDiscount(false);
    }
  }, [cart, couponCode, useCoins, refreshUserProfile]);

  const handleToggleUseCoins = useCallback(async () => {
    const nextUseCoinsState = !useCoins;
    setUseCoins(nextUseCoinsState);

    // Call calculate discount immediately with the new value to avoid stale state
    handleCalculateDiscount();
  }, [useCoins, handleCalculateDiscount]);

  const handleRemoveCoupon = useCallback(() => {
    // Set coupon to empty and immediately re-calculate discounts
    setCouponCode("");

    // We need to re-calculate because coins might still be applied.
    // Use a timeout to ensure the state update is processed before calculating.
    setTimeout(() => {
      handleCalculateDiscount();
    }, 0);
  }, [handleCalculateDiscount]);

  /* Removed API call */

  const handleClearCart = useCallback(() => {
    /* Removed API call */
  }, [updateCart]);

  const handleCheckout = useCallback(async () => {
    if (!cart || cart.items.length === 0) {
      showAlert("Error", "Your cart is empty");
      return;
    }

    const finalAmount = discountData
      ? discountData.finalAmount
      : cart.totalAmount;
    const transactionFees = Math.ceil(finalAmount * 0.0175); // 1.75%
    const totalToPay = finalAmount + transactionFees;

    /* Removed API call */
  }, [cart, discountData, couponCode, useCoins, updateCart]);

  // Handle scroll event to show/hide scroll button
  const handleScroll = useCallback((event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= 
      contentSize.height - paddingToBottom;
    
    // Show button if not at bottom and content is scrollable
    setShowScrollButton(!isCloseToBottom && contentSize.height > layoutMeasurement.height);
  }, []);

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, []);

  // Memoize scroll view content style for better performance
  const scrollContentStyle = useMemo(() => ({ paddingBottom: 80 }), []);

  if (loading) {
    return (
      <View className="flex-1 bg-transparent items-center justify-center">
        <ActivityIndicator size="large" color="#FFBA00" />
        <Text
          style={{ fontFamily: "Outfit_500Medium" }}
          className="text-[#0C3572] mt-4"
        >
          Loading cart...
        </Text>
      </View>
    );
  }

  const isEmpty = !cart || cart.items.length === 0;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-transparent"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >

        <View className="flex-1 bg-transparent">
          {/* Header */}

          {isEmpty ? (
        <View className="flex-1">
          <View className="flex-row items-center justify-between px-6 pt-12 pb-4">
            <TouchableOpacity
              onPress={() => router.back()}
              className="p-2"
            >
              <Ionicons name="arrow-back" size={24} color="#0C3572" />
            </TouchableOpacity>
            <Text
              style={{ fontFamily: "Outfit_700Bold" }}
              className="text-[#0C3572] text-xl"
            >
              My Cart
            </Text>
            {!isEmpty && (
              <TouchableOpacity onPress={handleClearCart} className="p-2">
                <Ionicons name="trash-outline" size={24} color="#EF4444" />
              </TouchableOpacity>
            )}
            {isEmpty && <View className="w-10" />}
          </View>
          <View className="flex-1 items-center justify-center px-6">
            <View className="bg-[#FFFFFF66] rounded-full p-8 mb-6">
              <Ionicons name="cart-outline" size={64} color="#6B7280" />
            </View>
            <Text
              style={{ fontFamily: "Outfit_700Bold" }}
              className="text-[#0C3572] text-2xl mb-2"
            >
              Your Cart is Empty
            </Text>
            <Text
              style={{ fontFamily: "Outfit_400Regular" }}
              className="text-[#2175C0] text-center mb-8 leading-6"
            >
              Add items to your cart to see them here
            </Text>
            <TouchableOpacity
              onPress={() => router.back()}
              className="bg-[#FFBA00] rounded-xl px-8 py-4 flex-row items-center"
            >
              <Ionicons name="storefront" size={20} color="#000" />
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className="text-black ml-2"
              >
                Browse Store
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          {/* Header - Outside ScrollView */}
          <View className="flex-row items-center justify-between px-6 pt-12 pb-4">
            <TouchableOpacity
              onPress={() => router.back()}
              className="p-2"
            >
              <Ionicons name="arrow-back" size={24} color="#0C3572" />
            </TouchableOpacity>
            <Text
              style={{ fontFamily: "Outfit_700Bold" }}
              className="text-[#0C3572] text-xl"
            >
              My Cart
            </Text>
            <TouchableOpacity onPress={handleClearCart} className="p-2">
              <Ionicons name="trash-outline" size={24} color="#EF4444" />
            </TouchableOpacity>
          </View>

          {/* Cart Items */}
          <ScrollView
            ref={scrollViewRef}
            className="flex-1 px-6"
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={refresh}
                tintColor="#FFBA00"
              />
            }
            contentContainerStyle={scrollContentStyle}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={Platform.OS === 'android'}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {/* Items Count */}
            <View className="mb-4">
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className="text-[#0C3572] text-lg"
              >
                {cart.items.length} {cart.items.length === 1 ? "Item" : "Items"}{" "}
                in Cart
              </Text>
            </View>

            {cart.items.map((item) => (
              <CartItemCard
                key={`${item.itemId}-${item.selectedSize}`}
                item={item}
                onRemove={handleRemoveItem}
                isUpdating={updatingItem === item.itemId}
              />
            ))}

            <View className="bg-[#FFFFFF66] rounded-2xl p-4 mb-4 mt-4">
              <View className="flex-row items-center justify-between mb-3">
                <Text
                  style={{ fontFamily: "Outfit_600SemiBold" }}
                  className="text-[#0C3572] text-base"
                >
                  Discounts & Savings
                </Text>
                <Ionicons name="pricetag" size={20} color="#FFBA00" />
              </View>

              {/* Coupon Input */}
              {discountData && discountData.couponApplied ? (
                <View className="bg-green-900/20 border border-green-600/30 rounded-xl p-3 flex-row items-center justify-between mb-4">
                  <View className="flex-row items-center flex-1">
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#10B981"
                    />
                    <View className="ml-3 flex-1">
                      <Text
                        style={{ fontFamily: "Outfit_600SemiBold" }}
                        className="text-green-400"
                      >
                        Coupon Applied!
                      </Text>
                      <Text
                        style={{ fontFamily: "Outfit_400Regular" }}
                        className="text-green-300 text-xs"
                      >
                        {discountData.couponMessage}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={handleRemoveCoupon}>
                    <Ionicons name="close-circle" size={24} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View className="mb-4">
                  <TextInput
                    className="bg-white rounded-xl px-4 py-3 text-[#0C3572]"
                    style={{ fontFamily: "Outfit_500Medium" }}
                    placeholder="Enter coupon code"
                    placeholderTextColor="#6B7280"
                    value={couponCode}
                    onChangeText={(text) => setCouponCode(text.toUpperCase())}
                    autoCapitalize="characters"
                    editable={!calculatingDiscount}
                  />
                </View>
              )}

              {/* Coins Toggle */}
              <TouchableOpacity
                onPress={() => {
                  const nextUseCoinsState = !useCoins;
                  setUseCoins(nextUseCoinsState);

                  // If the user is toggling coins OFF and a discount was already applied,
                  // clear the discount data to give immediate visual feedback.
                  if (!nextUseCoinsState && discountData) {
                    setDiscountData(null);
                  }
                }}
                disabled={userCoins === 0 || calculatingDiscount}
                className="flex-row items-center justify-between"
              >
                <View className="flex-row items-center flex-1">
                  <Ionicons
                    name={useCoins ? "checkbox" : "square-outline"}
                    size={24}
                    color={useCoins ? "#FFBA00" : "#6B7280"}
                  />
                  <View className="ml-3 flex-1">
                    <Text
                      style={{ fontFamily: "Outfit_600SemiBold" }}
                      className="text-[#0C3572]"
                    >
                      Use Saturnalia Coins
                    </Text>
                    <Text
                      style={{ fontFamily: "Outfit_400Regular" }}
                      className="text-[#2175C0] text-xs"
                    >
                      Available: {userCoins} coins (10 coins = ₹1)
                    </Text>
                    {discountData && discountData.coinsUsed > 0 && (
                      <Text
                        style={{ fontFamily: "Outfit_500Medium" }}
                        className="text-[#FFBA00] text-sm mt-1"
                      >
                        Using: {discountData.coinsUsed} coins = ₹
                        {discountData.coinsDiscount}
                      </Text>
                    )}
                  </View>
                </View>
                <Ionicons name="diamond" size={20} color="#FFBA00" />
              </TouchableOpacity>
              {userCoins === 0 && (
                <Text
                  style={{ fontFamily: "Outfit_400Regular" }}
                  className="text-red-500 text-xs mt-2"
                >
                  You have no Saturnalia Coins to use.
                </Text>
              )}

              {/* Divider and Apply Button */}
              <View className="border-t border-[#A0B3D0] my-4" />
              <Button
                title="Apply Discounts"
                variant="none" className="bg-[#95aad3] border-[#0C3572] border-2 py-3 rounded-xl" textClassName="text-[#0C3572]"
                onPress={handleCalculateDiscount}
                disabled={calculatingDiscount}
              />
            </View>
            {/* Bottom Summary & Checkout */}
            <View className="px-2 pb-8 pt-4 bg-white  border rounded-xl border-[#A0B3D0]">
              {/* Summary */}
              <View className="bg-[#FFFFFF66] rounded-2xl p-4 mb-4">
                <View className="flex-row justify-between items-center mb-2">
                  <Text
                    style={{ fontFamily: "Outfit_500Medium" }}
                    className="text-[#2175C0]"
                  >
                    Subtotal
                  </Text>
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className="text-[#0C3572] text-lg"
                  >
                    ₹{cart.totalAmount}
                  </Text>
                </View>

                {/* Coupon Discount */}
                {discountData && discountData.couponDiscount > 0 && (
                  <View className="flex-row justify-between items-center mb-2">
                    <Text
                      style={{ fontFamily: "Outfit_500Medium" }}
                      className="text-green-400"
                    >
                      Coupon Discount
                    </Text>
                    <Text
                      style={{ fontFamily: "Outfit_500Medium" }}
                      className="text-green-400"
                    >
                      -₹{discountData.couponDiscount}
                    </Text>
                  </View>
                )}

                {/* Coins Discount */}
                {discountData && discountData.coinsDiscount > 0 && (
                  <View className="flex-row justify-between items-center mb-2">
                    <Text
                      style={{ fontFamily: "Outfit_500Medium" }}
                      className="text-[#FFBA00]"
                    >
                      Coins Discount ({discountData.coinsUsed} coins)
                    </Text>
                    <Text
                      style={{ fontFamily: "Outfit_500Medium" }}
                      className="text-[#FFBA00]"
                    >
                      -₹{discountData.coinsDiscount}
                    </Text>
                  </View>
                )}

                <View className="flex-row justify-between items-center mb-2">
                  <Text
                    style={{ fontFamily: "Outfit_500Medium" }}
                    className="text-[#2175C0]"
                  >
                    Total Items
                  </Text>
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className="text-[#0C3572]"
                  >
                    {cart.items.reduce((sum, item) => sum + item.quantity, 0)}
                  </Text>
                </View>

                {/* Transaction Fees */}
                {discountData ? (
                  <View className="flex-row justify-between items-center mb-2">
                    <Text
                      style={{ fontFamily: "Outfit_400Regular" }}
                      className="text-[#0C3572]/70 text-sm"
                    >
                      Transaction Fees 
                    </Text>
                    <Text
                      style={{ fontFamily: "Outfit_400Regular" }}
                      className="text-[#0C3572]/70 text-sm"
                    >
                      ₹{Math.ceil(discountData.finalAmount * 0.015)}
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row justify-between items-center mb-2">
                    <Text
                      style={{ fontFamily: "Outfit_400Regular" }}
                      className="text-[#0C3572]/70 text-sm"
                    >
                      Transaction Fees (1.5%)
                    </Text>
                    <Text
                      style={{ fontFamily: "Outfit_400Regular" }}
                      className="text-[#0C3572]/70 text-sm"
                    >
                      ₹{Math.ceil(cart.totalAmount * 0.015)}
                    </Text>
                  </View>
                )}

                <View className="border-t border-[#A0B3D0] my-2" />
                <View className="flex-row justify-between items-center">
                  <Text
                    style={{ fontFamily: "Outfit_700Bold" }}
                    className="text-[#0C3572] text-lg"
                  >
                    Total
                  </Text>
                  <View className="flex-row items-center">
                    <View className="w-4 h-4 bg-[#FFBA00] rounded-full mr-2" />
                    <Text
                      style={{ fontFamily: "Outfit_700Bold" }}
                      className="text-[#FFBA00] text-2xl"
                    >
                      ₹
                      {discountData
                        ? discountData.finalAmount +
                          Math.ceil(discountData.finalAmount * 0.015)
                        : cart.totalAmount +
                          Math.ceil(cart.totalAmount * 0.015)}
                    </Text>
                  </View>
                </View>

                {/* Savings Display */}
                {discountData && discountData.savings > 0 && (
                  <View className="mt-3 bg-green-900/20 border border-green-600/30 rounded-lg p-2">
                    <Text
                      style={{ fontFamily: "Outfit_600SemiBold" }}
                      className="text-green-400 text-center text-sm"
                    >
                      You're saving ₹{discountData.savings}!
                    </Text>
                  </View>
                )}
              </View>

              {/* Checkout Button */}
              <TouchableOpacity
                onPress={handleCheckout}
                disabled={processingPayment || calculatingDiscount}
                className={`bg-[#FFBA00] rounded-xl py-4 items-center ${
                  processingPayment || calculatingDiscount ? "opacity-50" : ""
                }`}
              >
                {processingPayment || calculatingDiscount ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text
                    style={{ fontFamily: "Outfit_700Bold" }}
                    className="text-black text-lg"
                  >
                    Proceed to Checkout
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Scroll to Bottom Button */}
          {showScrollButton && (
            <TouchableOpacity
              onPress={scrollToBottom}
              className="absolute bottom-16 right-6 bg-[#FFBA00] rounded-full p-3 shadow-lg"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3.84,
                elevation: 5,
              }}
            >
              <Ionicons name="chevron-down" size={24} color="#000" />
            </TouchableOpacity>
          )}
        </>
      )}
        </View>
    </KeyboardAvoidingView>
  );
};

export default CartScreen;
