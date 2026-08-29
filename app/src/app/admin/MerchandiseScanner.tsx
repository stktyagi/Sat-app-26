import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  ScrollView,
  Image,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useFocusEffect } from "expo-router";
import { ArrowLeft, QrCode, Package, Scan } from "lucide-react-native";
import { Button, showAlert } from "@/components";
import {
  getOrderByQR,
  updateOrderStatus,
  UserOrder,
  getAllOrders,
} from "@/api/admin";
import { getStoreItems, StoreItem } from "@/api/admin";
import { Ionicons } from "@expo/vector-icons";
import Header from "@/components/layout/Header";
import { useAdminNavigation } from "@/hooks/useAdminNavigation";

interface MerchandiseScannerProps {
  navigation: any;
  setShowBottomNav?: (show: boolean) => void;
}

interface ItemWithOrders extends StoreItem {
  orders: UserOrder[];
  totalOrders: number;
  deliveredCount: number;
  pendingCount: number;
}

export default function MerchandiseScanner({
  setShowBottomNav,
}: { setShowBottomNav?: (show: boolean) => void }) {
  const navigation = useAdminNavigation();
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [cameraKey, setCameraKey] = useState(Date.now());
  const [cameraReady, setCameraReady] = useState(false);

  const [items, setItems] = useState<ItemWithOrders[]>([]);
  const [unknownOrders, setUnknownOrders] = useState<UserOrder[]>([]);
  const [selectedItem, setSelectedItem] = useState<ItemWithOrders | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);

  // Filter state
  const [selectedFilterItemId, setSelectedFilterItemId] = useState<string | null>(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderData, setOrderData] = useState<UserOrder | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  // Camera management
  useFocusEffect(
    React.useCallback(() => {
      if (showScanner) {
        setCameraReady(false);
        setScanned(false);

        const timer = setTimeout(() => {
          setCameraKey(Date.now());
          setTimeout(() => {
            setCameraReady(true);
          }, 200);
        }, 100);

        return () => clearTimeout(timer);
      }
    }, [showScanner])
  );

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch items (including inactive) and orders in parallel
      const [itemsResult, orders] = await Promise.all([
        getStoreItems(true), // Include inactive items for admin
        getAllOrders(),
      ]);

      if (!itemsResult.success) {
        showAlert("Error", "Failed to load store items");
        return;
      }

      const storeItems = itemsResult.data;

      // Map items with their orders
      const itemsWithOrders: ItemWithOrders[] = storeItems.map((item) => {
        const itemOrders = orders.filter((order) =>
          order.items.some((orderItem) => orderItem.itemId === item.id)
        );

        const deliveredCount = itemOrders.filter(
          (o) => o.status === "delivered"
        ).length;
        const pendingCount = itemOrders.filter(
          (o) => o.status === "confirmed"
        ).length;

        return {
          ...item,
          orders: itemOrders,
          totalOrders: itemOrders.length,
          deliveredCount,
          pendingCount,
        };
      });

      // Find zombie orders (orders with items not in store catalog)
      const allItemIds = new Set(storeItems.map((item) => item.id));
      const orphanOrders = orders.filter((order) =>
        order.items.some((item) => !allItemIds.has(item.itemId))
      );

      setItems(itemsWithOrders);
      setUnknownOrders(orphanOrders);
    } catch (error) {
      console.error("Error fetching data:", error);
      showAlert("Error", "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeScanned = async ({
    type,
    data,
  }: {
    type: string;
    data: string;
  }) => {
    if (scanned) return;

    setScanned(true);

    try {
      const result = await getOrderByQR(data.trim());

      if (result.success && result.order) {
        setOrderData(result.order);
        setShowScanner(false);
        setShowOrderModal(true);
      } else {
        showAlert(
          "Order Not Found",
          result.error || "Failed to fetch order details",
          [{ text: "Try Again", onPress: () => setScanned(false) }]
        );
      }
    } catch (error) {
      showAlert("Error", "An unexpected error occurred. Please try again.", [
        { text: "Try Again", onPress: () => setScanned(false) },
      ]);
    }
  };

  const handleMarkAsDelivered = async () => {
    if (!orderData) return;

    if (orderData.status === "delivered") {
      showAlert(
        "Already Delivered",
        "This order has already been marked as delivered."
      );
      return;
    }

    if (orderData.status !== "confirmed") {
      showAlert(
        "Cannot Deliver",
        `This order is currently ${orderData.status}. Only confirmed orders can be delivered.`
      );
      return;
    }

    setUpdatingStatus(true);
    try {
      const result = await updateOrderStatus(orderData.orderId, "delivered");
      console.log("Update order status result:", result);
      if (result.success) {
        // Show inline success banner instead of modal alert to avoid freeze
        setSuccessMessage("Order marked as delivered successfully!");
        setUpdateSuccess(true);
        setTimeout(() => {
          setUpdateSuccess(false);
          setShowOrderModal(false);
          setOrderData(null);
          fetchData(); // Refresh data
        }, 2000);
      } else {
        showAlert("Error", result.error || "Failed to update order status");
      }
    } catch (error) {
      showAlert(
        "Error",
        "Failed to mark order as delivered. Please try again."
      );
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Filtered data based on selected item
  const filteredData = React.useMemo(() => {
    if (!selectedFilterItemId) {
      // Show all items
      return {
        items: items,
        totalOrders: items.reduce((sum, item) => sum + item.totalOrders, 0) + unknownOrders.length,
        deliveredCount: items.reduce((sum, item) => sum + item.deliveredCount, 0),
        pendingCount: items.reduce((sum, item) => sum + item.pendingCount, 0),
        showUnknownOrders: true,
      };
    } else {
      // Show only selected item
      const selectedItem = items.find((item) => item.id === selectedFilterItemId);
      if (!selectedItem) {
        return {
          items: [],
          totalOrders: 0,
          deliveredCount: 0,
          pendingCount: 0,
          showUnknownOrders: false,
        };
      }
      return {
        items: [selectedItem],
        totalOrders: selectedItem.totalOrders,
        deliveredCount: selectedItem.deliveredCount,
        pendingCount: selectedItem.pendingCount,
        showUnknownOrders: false,
      };
    }
  }, [selectedFilterItemId, items, unknownOrders]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-500/20 text-green-400 border-green-500";
      case "pending":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500";
      case "delivered":
        return "bg-blue-500/20 text-blue-400 border-blue-500";
      case "cancelled":
        return "bg-red-500/20 text-red-400 border-red-500";
      default:
        return "bg-gray-500/20 text-[#2175C0] border-gray-500";
    }
  };

  // Scanner View
  if (showScanner) {
    if (!permission) {
      return (
        <View className="flex-1 bg-transparent items-center justify-center">
          <Text className="text-[#0C3572] text-lg">
            Requesting camera permission...
          </Text>
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View className="flex-1 bg-transparent items-center justify-center px-6">
          <Package size={64} color="#EEB170" />
          <Text className="text-[#0C3572] text-lg text-center mt-4 mb-6">
            Camera permission is required to scan order QR codes
          </Text>
          <TouchableOpacity
            className="bg-[#EEB170] px-6 py-3 rounded-xl"
            onPress={requestPermission}
            activeOpacity={0.7}
          >
            <Text className="text-[#121212] font-bold text-lg">
              Grant Permission
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View className="flex-1 bg-black">
        {cameraReady ? (
          <CameraView
            key={`merchandise-camera-${cameraKey}`}
            style={{ flex: 1 }}
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
          />
        ) : (
          <View className="flex-1 bg-black items-center justify-center">
            <ActivityIndicator size="large" color="#EEB170" />
            <Text
              style={{ fontFamily: "Outfit_500Medium" }}
              className="text-[#0C3572] text-base mt-4"
            >
              Initializing camera...
            </Text>
          </View>
        )}

        {/* Scanner Frame - Absolutely Positioned */}
        {cameraReady && (
          <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
            <View className="relative">
              <View
                className="rounded-2xl bg-transparent"
                style={{ width: 250, height: 250 }}
              >
                <View className="absolute -top-1 -left-1 w-8 h-8 border-l-4 border-t-4 border-[#EEB170] rounded-tl-lg" />
                <View className="absolute -top-1 -right-1 w-8 h-8 border-r-4 border-t-4 border-[#EEB170] rounded-tr-lg" />
                <View className="absolute -bottom-1 -left-1 w-8 h-8 border-l-4 border-b-4 border-[#EEB170] rounded-bl-lg" />
                <View className="absolute -bottom-1 -right-1 w-8 h-8 border-r-4 border-b-4 border-[#EEB170] rounded-br-lg" />
              </View>
            </View>
          </View>
        )}

        <View className="absolute inset-0" pointerEvents="box-none">
          <View className="absolute top-12 left-6 right-6 flex-row items-center">
            <TouchableOpacity
              onPress={() => setShowScanner(false)}
              className="bg-black/70 rounded-full p-3 mr-4"
              activeOpacity={0.7}
            >
              <ArrowLeft size={24} color="white" />
            </TouchableOpacity>

            <View className="flex-1 items-center" pointerEvents="none">
              <Text className="text-[#0C3572] text-xl font-bold text-center">
                Scan Order QR Code
              </Text>
            </View>

            <View style={{ width: 56 }} pointerEvents="none" />
          </View>

          <View
            className="absolute bottom-28 left-4 right-4"
            pointerEvents="none"
          >
            <View className="bg-black/70 rounded-xl px-4 py-3">
              <Text className="text-[#0C3572] text-center font-semibold text-base">
                {scanned
                  ? "Processing order..."
                  : "Point camera at order QR code"}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // Dashboard View
  return (
    <View className="flex-1 bg-transparent">
      <Header />

      <View className="flex-row items-center justify-between mb-4 px-6 mt-6">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text
          style={{ fontFamily: "Outfit_700Bold" }}
          className="text-[#0C3572] text-2xl"
        >
          Merchandise Dashboard
        </Text>
        <View className="w-6" />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#EEB170" />
          <Text className="text-[#0C3572] mt-4">Loading merchandise data...</Text>
        </View>
      ) : (
        <>
          <ScrollView
            className="flex-1 px-6"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
          >
            {/* Item Filter Dropdown */}
            <View className="mb-4">
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className="text-[#0C3572] text-sm mb-2"
              >
                Filter by Item
              </Text>
              <TouchableOpacity
                className="bg-[#FFFFFF66] rounded-xl p-4 flex-row items-center justify-between"
                onPress={() => setShowFilterDropdown(!showFilterDropdown)}
                activeOpacity={0.7}
              >
                <View className="flex-row items-center flex-1">
                  <Package size={20} color="#EEB170" />
                  <Text
                    style={{ fontFamily: "Outfit_500Medium" }}
                    className="text-[#0C3572] text-base ml-3 flex-1"
                    numberOfLines={1}
                  >
                    {selectedFilterItemId
                      ? items.find((item) => item.id === selectedFilterItemId)
                          ?.name || "All Items"
                      : "All Items"}
                  </Text>
                </View>
                <Ionicons
                  name={showFilterDropdown ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>

              {/* Dropdown Menu */}
              {showFilterDropdown && (
                <View className="bg-[#FFFFFF66] rounded-xl mt-2 overflow-hidden border border-[#3C3C3C]">
                  <TouchableOpacity
                    className="p-4 border-b border-[#3C3C3C]"
                    onPress={() => {
                      setSelectedFilterItemId(null);
                      setShowFilterDropdown(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View className="flex-row items-center">
                      <View
                        className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${
                          selectedFilterItemId === null
                            ? "border-[#EEB170] bg-[#EEB170]"
                            : "border-gray-500"
                        }`}
                      >
                        {selectedFilterItemId === null && (
                          <View className="w-2 h-2 rounded-full bg-black" />
                        )}
                      </View>
                      <Text
                        style={{ fontFamily: "Outfit_500Medium" }}
                        className="text-[#0C3572] text-base"
                      >
                        All Items
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <ScrollView style={{ maxHeight: 300 }}>
                    {items.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        className="p-4 border-b border-[#3C3C3C] last:border-b-0"
                        onPress={() => {
                          setSelectedFilterItemId(item.id);
                          setShowFilterDropdown(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <View className="flex-row items-center">
                          <View
                            className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${
                              selectedFilterItemId === item.id
                                ? "border-[#EEB170] bg-[#EEB170]"
                                : "border-gray-500"
                            }`}
                          >
                            {selectedFilterItemId === item.id && (
                              <View className="w-2 h-2 rounded-full bg-black" />
                            )}
                          </View>
                          <Image
                            source={{ uri: item.images[0] }}
                            className="w-10 h-10 rounded-lg mr-3"
                          />
                          <View className="flex-1">
                            <Text
                              style={{ fontFamily: "Outfit_500Medium" }}
                              className="text-[#0C3572] text-base"
                              numberOfLines={1}
                            >
                              {item.name}
                            </Text>
                            <Text
                              style={{ fontFamily: "Outfit_400Regular" }}
                              className="text-[#2175C0] text-xs"
                            >
                              {item.totalOrders} orders • {item.pendingCount}{" "}
                              pending
                            </Text>
                          </View>
                          {!item.isActive && (
                            <View className="bg-red-500/20 px-2 py-1 rounded-full">
                              <Text
                                style={{ fontFamily: "Outfit_600SemiBold" }}
                                className="text-red-400 text-xs"
                              >
                                Inactive
                              </Text>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <Button
            onPress={() => setShowScanner(true)}
            className="mb-6 bg-[#EEB170] rounded-xl py-4 items-center"
            >
            <Scan size={32} color="#000" />
              <Text className="text-black text-lg font-semibold ml-4">Scan QR Code</Text>
            </Button>

            {/* Stats Summary */}
            <View className="bg-[#FFFFFF66] rounded-2xl p-5 mb-6">
              <View className="flex-row items-center justify-between mb-4">
                <Text
                  style={{ fontFamily: "Outfit_600SemiBold" }}
                  className="text-[#0C3572] text-lg"
                >
                  {selectedFilterItemId ? "Item Overview" : "Overview"}
                </Text>
                {selectedFilterItemId && (
                  <TouchableOpacity
                    onPress={() => setSelectedFilterItemId(null)}
                    className="bg-[#1A1A1A] px-3 py-1 rounded-lg"
                    activeOpacity={0.7}
                  >
                    <Text
                      style={{ fontFamily: "Outfit_500Medium" }}
                      className="text-[#EEB170] text-xs"
                    >
                      Clear Filter
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <View className="flex-row justify-between">
                <View className="items-center">
                  <Text
                    style={{ fontFamily: "Outfit_700Bold" }}
                    className="text-[#EEB170] text-2xl"
                  >
                    {filteredData.totalOrders}
                  </Text>
                  <Text
                    style={{ fontFamily: "Outfit_400Regular" }}
                    className="text-[#2175C0] text-sm"
                  >
                    Total Orders
                  </Text>
                </View>
                <View className="items-center">
                  <Text
                    style={{ fontFamily: "Outfit_700Bold" }}
                    className="text-blue-400 text-2xl"
                  >
                    {filteredData.deliveredCount}
                  </Text>
                  <Text
                    style={{ fontFamily: "Outfit_400Regular" }}
                    className="text-[#2175C0] text-sm"
                  >
                    Delivered
                  </Text>
                </View>
                <View className="items-center">
                  <Text
                    style={{ fontFamily: "Outfit_700Bold" }}
                    className="text-green-400 text-2xl"
                  >
                    {filteredData.pendingCount}
                  </Text>
                  <Text
                    style={{ fontFamily: "Outfit_400Regular" }}
                    className="text-[#2175C0] text-sm"
                  >
                    Pending
                  </Text>
                </View>
              </View>
            </View>

            {/* Items List */}
            {!selectedFilterItemId && (
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className="text-[#0C3572] text-lg mb-4"
              >
                Merchandise Items
              </Text>
            )}

            {selectedFilterItemId && filteredData.items.length > 0 && (
              <Text
                style={{ fontFamily: "Outfit_600SemiBold" }}
                className="text-[#0C3572] text-lg mb-4"
              >
                Orders for {filteredData.items[0].name}
              </Text>
            )}

            {!selectedFilterItemId && filteredData.items.map((item) => (
              <TouchableOpacity
                key={item.id}
                className="bg-[#FFFFFF66] rounded-2xl p-4 mb-4"
                onPress={() => {
                  setSelectedItem(item);
                  setShowItemModal(true);
                }}
                activeOpacity={0.7}
              >
                <View className="flex-row items-start">
                  <View className="relative">
                    <Image
                      source={{ uri: item.images[0] }}
                      className="w-20 h-20 rounded-xl"
                    />
                    {!item.isActive && (
                      <View className="absolute inset-0 bg-black/70 rounded-xl items-center justify-center">
                        <Text
                          style={{ fontFamily: "Outfit_600SemiBold" }}
                          className="text-red-400 text-xs"
                        >
                          INACTIVE
                        </Text>
                      </View>
                    )}
                  </View>
                  <View className="flex-1 ml-4">
                    <View className="flex-row items-center mb-1">
                      <Text
                        style={{ fontFamily: "Outfit_600SemiBold" }}
                        className="text-[#0C3572] text-base flex-1"
                      >
                        {item.name}
                      </Text>
                      {!item.isActive && (
                        <View className="bg-red-500/20 px-2 py-1 rounded-full">
                          <Text
                            style={{ fontFamily: "Outfit_600SemiBold" }}
                            className="text-red-400 text-xs"
                          >
                            Inactive
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={{ fontFamily: "Outfit_400Regular" }}
                      className="text-[#2175C0] text-sm mb-2"
                      numberOfLines={2}
                    >
                      {item.description}
                    </Text>
                    <View className="flex-row items-center gap-3">
                      <View className="flex-row items-center">
                        <Text
                          style={{ fontFamily: "Outfit_500Medium" }}
                          className="text-[#EEB170] text-sm"
                        >
                          {item.totalOrders} orders
                        </Text>
                      </View>
                      <View className="flex-row items-center">
                        <Text
                          style={{ fontFamily: "Outfit_500Medium" }}
                          className="text-green-400 text-sm"
                        >
                          {item.pendingCount} pending
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#6B7280" />
                </View>
              </TouchableOpacity>
            ))}

            {/* Show orders when a specific item is selected */}
            {selectedFilterItemId && filteredData.items.length > 0 && (
              <>
                {filteredData.items[0].orders.length > 0 ? (
                  filteredData.items[0].orders.map((order) => (
                    <TouchableOpacity
                      key={order.orderId}
                      className="bg-[#FFFFFF66] rounded-2xl p-4 mb-4"
                      onPress={() => {
                        setOrderData(order);
                        setShowOrderModal(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <View className="flex-row justify-between items-start mb-3">
                        <View className="flex-1">
                          <Text
                            style={{ fontFamily: "Outfit_600SemiBold" }}
                            className="text-[#0C3572] text-base mb-1"
                          >
                            Order #{order.orderId.slice(-8).toUpperCase()}
                          </Text>
                          <Text
                            style={{ fontFamily: "Outfit_400Regular" }}
                            className="text-[#2175C0] text-sm mb-2"
                          >
                            {order.userName || "Unknown User"}
                          </Text>
                          <Text
                            style={{ fontFamily: "Outfit_400Regular" }}
                            className="text-gray-500 text-xs"
                          >
                            {new Date(order.orderDate).toLocaleDateString(
                              "en-US",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </Text>
                        </View>
                        <View
                          className={`px-3 py-1 rounded-full ${getStatusColor(
                            order.status
                          )
                            .split(" ")
                            .slice(0, 2)
                            .join(" ")}`}
                        >
                          <Text
                            style={{ fontFamily: "Outfit_500Medium" }}
                            className={`text-sm ${
                              getStatusColor(order.status).split(" ")[1]
                            }`}
                          >
                            {order.status.charAt(0).toUpperCase() +
                              order.status.slice(1)}
                          </Text>
                        </View>
                      </View>

                      <View className="border-t border-gray-700 pt-3">
                        <View className="flex-row justify-between items-center">
                          <View className="flex-row items-center gap-3">
                            <Text
                              style={{ fontFamily: "Outfit_500Medium" }}
                              className="text-[#2175C0] text-sm"
                            >
                              {order.items.length} item(s)
                            </Text>
                            <Text
                              style={{ fontFamily: "Outfit_500Medium" }}
                              className="text-[#2175C0] text-sm"
                            >
                              •
                            </Text>
                            <Text
                              style={{ fontFamily: "Outfit_600SemiBold" }}
                              className="text-[#EEB170] text-sm"
                            >
                              ₹{order.finalAmount}
                            </Text>
                          </View>
                          <Ionicons
                            name="chevron-forward"
                            size={20}
                            color="#6B7280"
                          />
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View className="bg-[#FFFFFF66] rounded-2xl p-6 items-center">
                    <Package size={40} color="#6B7280" />
                    <Text
                      style={{ fontFamily: "Outfit_500Medium" }}
                      className="text-[#2175C0] text-center mt-3"
                    >
                      No orders found for this item
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* Zombie Orders Section */}
            {filteredData.showUnknownOrders && unknownOrders.length > 0 && (
              <>
                <Text
                  style={{ fontFamily: "Outfit_600SemiBold" }}
                  className="text-[#0C3572] text-lg mb-4 mt-2"
                >
                  Zombie Orders
                </Text>
                <View className="bg-[#FFFFFF66] rounded-2xl p-4 mb-4">
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center">
                      <Ionicons name="alert-circle" size={24} color="#F59E0B" />
                      <Text
                        style={{ fontFamily: "Outfit_600SemiBold" }}
                        className="text-[#0C3572] text-base ml-2"
                      >
                        Orders with deleted items
                      </Text>
                    </View>
                    <Text
                      style={{ fontFamily: "Outfit_500Medium" }}
                      className="text-[#EEB170]"
                    >
                      {unknownOrders.length} orders
                    </Text>
                  </View>
                  {unknownOrders.map((order) => (
                    <TouchableOpacity
                      key={order.orderId}
                      className="bg-[#1A1A1A] rounded-xl p-3 mb-2"
                      onPress={() => {
                        setOrderData(order);
                        setShowOrderModal(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <View className="flex-row justify-between items-center">
                        <View className="flex-1">
                          <Text
                            style={{ fontFamily: "Outfit_500Medium" }}
                            className="text-[#0C3572] text-sm mb-1"
                          >
                            Order #{order.orderId.slice(-8).toUpperCase()}
                          </Text>
                          <Text
                            style={{ fontFamily: "Outfit_400Regular" }}
                            className="text-[#2175C0] text-xs mb-1"
                          >
                            {order.userName || "Unknown User"}
                          </Text>
                          <View className="flex-row items-center gap-2">
                            <View
                              className={`px-2 py-1 rounded-full ${getStatusColor(
                                order.status
                              )
                                .split(" ")
                                .slice(0, 2)
                                .join(" ")}`}
                            >
                              <Text
                                style={{ fontFamily: "Outfit_500Medium" }}
                                className={`text-xs ${
                                  getStatusColor(order.status).split(" ")[1]
                                }`}
                              >
                                {order.status}
                              </Text>
                            </View>
                            <Text
                              style={{ fontFamily: "Outfit_400Regular" }}
                              className="text-gray-500 text-xs"
                            >
                              {order.items.length} item(s)
                            </Text>
                          </View>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={20}
                          color="#6B7280"
                        />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </ScrollView>
        </>
      )}

      {/* Item Details Modal */}
      <Modal
        visible={showItemModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowItemModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center px-6">
          <View className="bg-[#FFFFFF66] rounded-2xl p-6 w-full max-w-md border border-[#A0B3D0] max-h-[85%]">
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedItem && (
                <>
                  <View className="items-center mb-6">
                    <Image
                      source={{ uri: selectedItem.images[0] }}
                      className="w-32 h-32 rounded-2xl mb-4"
                    />
                    <Text
                      style={{ fontFamily: "Outfit_700Bold" }}
                      className="text-[#0C3572] text-2xl text-center mb-2"
                    >
                      {selectedItem.name}
                    </Text>
                    <Text
                      style={{ fontFamily: "Outfit_400Regular" }}
                      className="text-[#2175C0] text-sm text-center"
                    >
                      {selectedItem.description}
                    </Text>
                  </View>

                  {/* Stats */}
                  <View className="bg-[#FFFFFF66] rounded-xl p-4 mb-4">
                    <View className="flex-row justify-between items-center mb-3">
                      <Text
                        style={{ fontFamily: "Outfit_500Medium" }}
                        className="text-[#2175C0]"
                      >
                        Total Orders
                      </Text>
                      <Text
                        style={{ fontFamily: "Outfit_600SemiBold" }}
                        className="text-[#EEB170] text-lg"
                      >
                        {selectedItem.totalOrders}
                      </Text>
                    </View>
                    <View className="flex-row justify-between items-center mb-3">
                      <Text
                        style={{ fontFamily: "Outfit_500Medium" }}
                        className="text-[#2175C0]"
                      >
                        Delivered
                      </Text>
                      <Text
                        style={{ fontFamily: "Outfit_600SemiBold" }}
                        className="text-blue-400 text-lg"
                      >
                        {selectedItem.deliveredCount}
                      </Text>
                    </View>
                    <View className="flex-row justify-between items-center">
                      <Text
                        style={{ fontFamily: "Outfit_500Medium" }}
                        className="text-[#2175C0]"
                      >
                        Pending Delivery
                      </Text>
                      <Text
                        style={{ fontFamily: "Outfit_600SemiBold" }}
                        className="text-green-400 text-lg"
                      >
                        {selectedItem.pendingCount}
                      </Text>
                    </View>
                  </View>

                  {/* Orders List */}
                  {selectedItem.orders.length > 0 && (
                    <>
                      <Text
                        style={{ fontFamily: "Outfit_600SemiBold" }}
                        className="text-[#0C3572] text-base mb-3"
                      >
                        Recent Orders
                      </Text>
                      {selectedItem.orders.slice(0, 5).map((order) => (
                        <TouchableOpacity
                          key={order.orderId}
                          className="bg-[#FFFFFF66] rounded-xl p-3 mb-2"
                          onPress={() => {
                            setOrderData(order);
                            setShowItemModal(false);
                            setShowOrderModal(true);
                          }}
                          activeOpacity={0.7}
                        >
                          <View className="flex-row justify-between items-center mb-1">
                            <Text
                              style={{ fontFamily: "Outfit_500Medium" }}
                              className="text-[#0C3572] text-sm"
                            >
                              #{order.orderId.slice(-8).toUpperCase()}
                            </Text>
                            <View className="flex-row items-center gap-2">
                              <View
                                className={`px-2 py-1 rounded-full ${getStatusColor(
                                  order.status
                                )
                                  .split(" ")
                                  .slice(0, 2)
                                  .join(" ")}`}
                              >
                                <Text
                                  style={{ fontFamily: "Outfit_500Medium" }}
                                  className={`text-xs ${
                                    getStatusColor(order.status).split(" ")[1]
                                  }`}
                                >
                                  {order.status}
                                </Text>
                              </View>
                              <Ionicons
                                name="chevron-forward"
                                size={16}
                                color="#6B7280"
                              />
                            </View>
                          </View>
                          <Text
                            style={{ fontFamily: "Outfit_400Regular" }}
                            className="text-[#2175C0] text-xs"
                          >
                            {order.userName || "Unknown"} •{" "}
                            {new Date(order.orderDate).toLocaleDateString()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </>
                  )}

                  <TouchableOpacity
                    className="bg-[#EEB170] rounded-xl py-4 items-center mt-4"
                    onPress={() => setShowItemModal(false)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={{ fontFamily: "Outfit_600SemiBold" }}
                      className="text-[#121212] text-base"
                    >
                      Close
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Order Details Modal (from QR scan) */}
      <Modal
        visible={showOrderModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowOrderModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center px-6">
          <View className="bg-[#FFFFFF66] rounded-2xl p-6 w-full max-w-md border border-[#A0B3D0] max-h-[85%]">
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Success Banner */}
              {updateSuccess && (
                <View className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 mb-4">
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className="text-green-400 text-center text-sm"
                  >
                    ✓ {successMessage}
                  </Text>
                </View>
              )}

              {orderData && (
                <>
                  <View className="items-center mb-6">
                    <Package size={40} color="#EEB170" />
                    <Text
                      style={{ fontFamily: "Outfit_700Bold" }}
                      className="text-[#0C3572] text-2xl mt-3 mb-2"
                    >
                      Order #{orderData.orderId.slice(-8).toUpperCase()}
                    </Text>
                    <Text
                      style={{ fontFamily: "Outfit_400Regular" }}
                      className="text-[#2175C0] text-xs mb-3"
                      selectable={true}
                    >
                      {orderData.orderId}
                    </Text>
                    <View
                      className={`px-4 py-2 rounded-full border ${getStatusColor(
                        orderData.status
                      )
                        .split(" ")
                        .slice(0, 3)
                        .join(" ")}`}
                    >
                      <Text
                        style={{ fontFamily: "Outfit_600SemiBold" }}
                        className={`text-base ${
                          getStatusColor(orderData.status).split(" ")[1]
                        }`}
                      >
                        {orderData.status.charAt(0).toUpperCase() +
                          orderData.status.slice(1)}
                      </Text>
                    </View>
                  </View>

                  <View className="bg-[#FFFFFF66] rounded-xl p-4 mb-4">
                    <Text className="text-[#2175C0] text-sm mb-3">
                      Customer Details
                    </Text>
                    <View className="flex-row items-center mb-2">
                      <Ionicons name="person" size={16} color="#6B7280" />
                      <Text
                        style={{ fontFamily: "Outfit_500Medium" }}
                        className="text-[#0C3572] text-sm ml-2"
                      >
                        {orderData.userName || "N/A"}
                      </Text>
                    </View>
                    <View className="flex-row items-center mb-2">
                      <Ionicons name="mail" size={16} color="#6B7280" />
                      <Text
                        style={{ fontFamily: "Outfit_400Regular" }}
                        className="text-[#2175C0] text-xs ml-2"
                      >
                        {orderData.email || "N/A"}
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <Ionicons name="finger-print" size={16} color="#6B7280" />
                      <Text
                        style={{ fontFamily: "Outfit_400Regular" }}
                        className="text-[#2175C0] text-xs ml-2"
                        selectable={true}
                      >
                        User ID: {orderData.userId}
                      </Text>
                    </View>
                  </View>

                  <View className="bg-[#FFFFFF66] rounded-xl p-4 mb-4">
                    <Text className="text-[#2175C0] text-sm mb-3">
                      Order Timeline
                    </Text>
                    <View className="flex-row items-start mb-2">
                      <Ionicons name="calendar" size={16} color="#6B7280" />
                      <View className="flex-1 ml-2">
                        <Text
                          style={{ fontFamily: "Outfit_500Medium" }}
                          className="text-[#0C3572] text-xs mb-1"
                        >
                          Order Date
                        </Text>
                        <Text
                          style={{ fontFamily: "Outfit_400Regular" }}
                          className="text-[#2175C0] text-xs"
                        >
                          {new Date(orderData.orderDate).toLocaleDateString(
                            "en-US",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </Text>
                      </View>
                    </View>
                    <View className="flex-row items-start mb-2">
                      <Ionicons name="time" size={16} color="#6B7280" />
                      <View className="flex-1 ml-2">
                        <Text
                          style={{ fontFamily: "Outfit_500Medium" }}
                          className="text-[#0C3572] text-xs mb-1"
                        >
                          Created At
                        </Text>
                        <Text
                          style={{ fontFamily: "Outfit_400Regular" }}
                          className="text-[#2175C0] text-xs"
                        >
                          {new Date(orderData.createdAt).toLocaleDateString(
                            "en-US",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </Text>
                      </View>
                    </View>
                    <View className="flex-row items-start">
                      <Ionicons name="sync" size={16} color="#6B7280" />
                      <View className="flex-1 ml-2">
                        <Text
                          style={{ fontFamily: "Outfit_500Medium" }}
                          className="text-[#0C3572] text-xs mb-1"
                        >
                          Last Updated
                        </Text>
                        <Text
                          style={{ fontFamily: "Outfit_400Regular" }}
                          className="text-[#2175C0] text-xs"
                        >
                          {new Date(orderData.updatedAt).toLocaleDateString(
                            "en-US",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View className="bg-[#FFFFFF66] rounded-xl p-4 mb-4">
                    <Text className="text-[#2175C0] text-sm mb-3">
                      Order Items ({orderData.items.length})
                    </Text>
                    {orderData.items.map((item, index) => {
                      // Check if item exists in store catalog
                      const itemExistsInStore = items.some(
                        (storeItem) => storeItem.id === item.itemId
                      );

                      return (
                        <View
                          key={`${item.itemId}-${index}`}
                          className={`${
                            index < orderData.items.length - 1
                              ? "mb-3 pb-3 border-b border-gray-700"
                              : ""
                          }`}
                        >
                          {!itemExistsInStore && (
                            <View className="bg-red-500/20 border border-red-500/30 rounded-lg p-2 mb-2">
                              <View className="flex-row items-center">
                                <Ionicons
                                  name="alert-circle"
                                  size={16}
                                  color="#EF4444"
                                />
                                <Text
                                  style={{ fontFamily: "Outfit_500Medium" }}
                                  className="text-red-400 text-xs ml-2"
                                >
                                  This item no longer exists in catalog
                                </Text>
                              </View>
                            </View>
                          )}
                          <View className="flex-row items-center mb-2">
                            <View className="relative">
                              <Image
                                source={{ uri: item.images[0] }}
                                className="w-14 h-14 rounded-lg"
                              />
                              {!itemExistsInStore && (
                                <View className="absolute inset-0 bg-black/60 rounded-lg items-center justify-center">
                                  <Ionicons
                                    name="close-circle"
                                    size={24}
                                    color="#EF4444"
                                  />
                                </View>
                              )}
                            </View>
                            <View className="flex-1 ml-3">
                              <Text
                                style={{ fontFamily: "Outfit_500Medium" }}
                                className="text-[#0C3572] text-sm"
                                numberOfLines={1}
                              >
                                {item.name}
                              </Text>
                              <Text
                                style={{ fontFamily: "Outfit_400Regular" }}
                                className="text-[#2175C0] text-xs"
                              >
                                Item ID: {item.itemId.slice(0, 8)}...
                              </Text>
                            </View>
                            <Text
                              style={{ fontFamily: "Outfit_600SemiBold" }}
                              className="text-[#EEB170] text-sm"
                            >
                              ₹{item.totalPrice}
                            </Text>
                          </View>
                        <View className="ml-1 flex-row flex-wrap gap-2">
                          {item.selectedSize && (
                            <View className="bg-[#1A1A1A] px-2 py-1 rounded-md">
                              <Text
                                style={{ fontFamily: "Outfit_400Regular" }}
                                className="text-[#2175C0] text-xs"
                              >
                                Size:{" "}
                                <Text className="text-[#0C3572]">
                                  {item.selectedSize}
                                </Text>
                              </Text>
                            </View>
                          )}
                          <View className="bg-[#1A1A1A] px-2 py-1 rounded-md">
                            <Text
                              style={{ fontFamily: "Outfit_400Regular" }}
                              className="text-[#2175C0] text-xs"
                            >
                              Qty:{" "}
                              <Text className="text-[#0C3572]">
                                {item.quantity}
                              </Text>
                            </Text>
                          </View>
                          <View className="bg-[#1A1A1A] px-2 py-1 rounded-md">
                            <Text
                              style={{ fontFamily: "Outfit_400Regular" }}
                              className="text-[#2175C0] text-xs"
                            >
                              Base:{" "}
                              <Text className="text-[#0C3572]">₹{item.price}</Text>
                            </Text>
                          </View>
                          {item.sizePrice > 0 && (
                            <View className="bg-[#1A1A1A] px-2 py-1 rounded-md">
                              <Text
                                style={{ fontFamily: "Outfit_400Regular" }}
                                className="text-[#2175C0] text-xs"
                              >
                                Size Price:{" "}
                                <Text className="text-[#0C3572]">
                                  ₹{item.sizePrice}
                                </Text>
                              </Text>
                            </View>
                          )}
                        </View>
                        </View>
                      );
                    })}
                  </View>

                  <View className="bg-[#FFFFFF66] rounded-xl p-4 mb-4">
                    <Text className="text-[#2175C0] text-sm mb-3">
                      Payment Details
                    </Text>

                    <View className="flex-row justify-between items-center mb-2">
                      <Text
                        style={{ fontFamily: "Outfit_500Medium" }}
                        className="text-[#2175C0] text-sm"
                      >
                        Subtotal
                      </Text>
                      <Text
                        style={{ fontFamily: "Outfit_500Medium" }}
                        className="text-[#0C3572] text-sm"
                      >
                        ₹{orderData.totalAmount}
                      </Text>
                    </View>

                    {orderData.transactionFees > 0 && (
                      <View className="flex-row justify-between items-center mb-2">
                        <Text
                          style={{ fontFamily: "Outfit_500Medium" }}
                          className="text-[#2175C0] text-sm"
                        >
                          Transaction Fees
                        </Text>
                        <Text
                          style={{ fontFamily: "Outfit_500Medium" }}
                          className="text-[#0C3572] text-sm"
                        >
                          ₹{orderData.transactionFees}
                        </Text>
                      </View>
                    )}

                    <View className="flex-row justify-between items-center pt-2 mb-3 border-t border-gray-700">
                      <Text
                        style={{ fontFamily: "Outfit_600SemiBold" }}
                        className="text-[#0C3572] text-base"
                      >
                        Total Amount
                      </Text>
                      <Text
                        style={{ fontFamily: "Outfit_700Bold" }}
                        className="text-[#EEB170] text-lg"
                      >
                        ₹{orderData.finalAmount}
                      </Text>
                    </View>

                    <View className="flex-row items-center">
                      <Ionicons
                        name={
                          orderData.paymentStatus === "completed"
                            ? "checkmark-circle"
                            : orderData.paymentStatus === "pending"
                            ? "time"
                            : "close-circle"
                        }
                        size={16}
                        color={
                          orderData.paymentStatus === "completed"
                            ? "#10B981"
                            : orderData.paymentStatus === "pending"
                            ? "#F59E0B"
                            : "#EF4444"
                        }
                      />
                      <Text
                        style={{ fontFamily: "Outfit_500Medium" }}
                        className="text-[#0C3572] text-sm ml-2"
                      >
                        Payment:
                        <Text
                          style={{ fontFamily: "Outfit_600SemiBold" }}
                          className={
                            orderData.paymentStatus === "completed"
                              ? "text-green-400"
                              : orderData.paymentStatus === "pending"
                              ? "text-yellow-400"
                              : "text-red-400"
                          }
                        >
                          {" "}
                          {orderData.paymentStatus.charAt(0).toUpperCase() +
                            orderData.paymentStatus.slice(1)}
                        </Text>
                      </Text>
                    </View>
                  </View>

                  {orderData.status === "confirmed" && (
                    <TouchableOpacity
                      className="bg-green-600 rounded-xl py-4 items-center mb-3"
                      onPress={handleMarkAsDelivered}
                      disabled={updatingStatus}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={{ fontFamily: "Outfit_600SemiBold" }}
                        className="text-[#0C3572] text-base"
                      >
                        {updatingStatus
                          ? "Marking as Delivered..."
                          : "Mark as Delivered"}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {orderData.status === "delivered" && (
                    <View className="bg-blue-500/20 border border-blue-500 rounded-xl p-4 mb-3">
                      <Text
                        style={{ fontFamily: "Outfit_600SemiBold" }}
                        className="text-blue-400 text-center"
                      >
                        This order has been delivered
                      </Text>
                    </View>
                  )}

                  {orderData.status !== "confirmed" &&
                    orderData.status !== "delivered" && (
                      <View className="bg-yellow-500/20 border border-yellow-500 rounded-xl p-4 mb-3">
                        <Text
                          style={{ fontFamily: "Outfit_500Medium" }}
                          className="text-yellow-400 text-center text-sm"
                        >
                          Order status: {orderData.status}
                          {"\n"}
                          Only confirmed orders can be delivered
                        </Text>
                      </View>
                    )}

                  <TouchableOpacity
                    className="bg-[#FFFFFF66] rounded-xl py-4 items-center"
                    onPress={() => setShowOrderModal(false)}
                    activeOpacity={0.7}
                    disabled={updatingStatus}
                  >
                    <Text
                      style={{ fontFamily: "Outfit_600SemiBold" }}
                      className="text-[#0C3572] text-base"
                    >
                      Close
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>

            {updatingStatus && (
              <View className="absolute inset-0 bg-black/50 rounded-2xl items-center justify-center">
                <ActivityIndicator size="large" color="#EEB170" />
                <Text className="text-[#0C3572] text-sm mt-2">Updating...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
