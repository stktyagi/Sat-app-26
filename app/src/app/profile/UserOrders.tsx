// src/screens/App/Profile/UserOrdersScreen.tsx
import React, { useState, useEffect } from "react";
import { Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Image, Modal } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUserStore } from "@/state/userStore";
import Header from '@/components/layout/Header';
import QRCode from 'react-native-qrcode-svg';

const UserOrdersScreen: React.FC = () => {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState('all');
  /* Removed API call */
  const [loading, setLoading] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const { userData: userProfile } = useUserStore();
  const userId = userProfile?.userId || '';

  useEffect(() => {
    fetchUserOrders();
  }, []);

  const fetchUserOrders = async () => {
    try {
      setLoading(true);
      /* Removed API call */
      setOrders(userOrders);
    } catch (error) {
      console.error('Error fetching user orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-500/20 text-green-400';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'delivered':
        return 'bg-blue-500/20 text-blue-400';
      case 'cancelled':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/20 text-[#2175C0]';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-400';
      case 'pending':
        return 'bg-orange-500/20 text-orange-400';
      case 'failed':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/20 text-[#2175C0]';
    }
  };

  const filteredOrders = orders.filter(order => {
    if (activeFilter === 'all') return true;
    return order.status === activeFilter;
  });

  const FilterButton = ({ title, filterKey }: { title: string, filterKey: string }) => (
    <TouchableOpacity
      className={`px-8 py-2 border-2 rounded-2xl mr-3 ${
        activeFilter === filterKey ? 'border-[#F22F50]' : 'border-[#A0B3D0]'
      }`}
      onPress={() => setActiveFilter(filterKey)}
    >
      <Text 
        style={{ fontFamily: 'Outfit_500Medium' }} 
        className={`${activeFilter === filterKey ? 'text-[#F22F50]' : 'text-[#0C3572]'}`}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );

  /* Removed API call */

  if (loading) {
    return (
      <View className="flex-1 bg-transparent items-center justify-center">
        <ActivityIndicator size="large" color="#FFBA00" />
        <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#0C3572] mt-4">
          Loading your orders...
        </Text>
      </View>
    );
  }

  const QRModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={showQRModal}
      onRequestClose={() => setShowQRModal(false)}
    >
      <View className="flex-1 bg-black/80 items-center justify-center">
        <View className="bg-[#FFFFFF66] rounded-3xl p-6 mx-6 w-[90%] max-w-md">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-6">
            <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[#0C3572] text-xl">
              Order QR Code
            </Text>
            <TouchableOpacity
              onPress={() => setShowQRModal(false)}
              className="bg-[#FFFFFF66] rounded-full p-2"
            >
              <Ionicons name="close" size={24} color="#0C3572" />
            </TouchableOpacity>
          </View>

          {/* QR Code */}
          <View className="bg-white rounded-2xl p-6 items-center mb-4">
            <QRCode
              value={selectedOrderId}
              size={200}
              color="#0C3572"
              backgroundColor="#FFFFFF"
            />
          </View>

          {/* Order ID */}
          <View className="bg-[#FFFFFF66] rounded-xl p-4 mb-4">
            <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#2175C0] text-xs mb-1 text-center">
              Order ID
            </Text>
            <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#0C3572] text-base text-center">
              #{selectedOrderId.slice(-8).toUpperCase()}
            </Text>
          </View>

          {/* Info */}
          <View className="bg-[#FFBA00]/10 border border-[#FFBA00]/30 rounded-xl p-3">
            <View className="flex-row items-start">
              <Ionicons name="information-circle" size={20} color="#FFBA00" />
              <Text style={{ fontFamily: 'Outfit_400Medium' }} className="text-[#FFBA00] text-xs ml-2 flex-1">
                Show this QR code to collect your order at the merchandise counter
              </Text>
            </View>
          </View>

          {/* Close Button */}
          <TouchableOpacity
            className="bg-[#FFBA00] rounded-xl py-3 items-center mt-4"
            onPress={() => setShowQRModal(false)}
          >
            <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-black">
              Close
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <View className="flex-1 bg-transparent">
      {/* QR Modal */}
      <QRModal />
      {/* Header */}
      <Header />

      <View className="flex-row items-center justify-between mb-4 px-6 mt-6">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="#0C3572" />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[#0C3572] text-2xl">
          My Orders
        </Text>
        <View className="w-12" />
      </View>

      {/* Filters */}
      <View className="px-6 py-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <FilterButton title="All" filterKey="all" />
          <FilterButton title="Confirmed" filterKey="confirmed" />
          <FilterButton title="Pending" filterKey="pending" />
          <FilterButton title="Delivered" filterKey="delivered" />
          <FilterButton title="Cancelled" filterKey="cancelled" />
        </ScrollView>
      </View>

      {/* Orders List */}
      <ScrollView
        className="flex-1 px-6"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {filteredOrders.length === 0 ? (
          <View className="flex-1 justify-center items-center py-16">
            <Ionicons name="cart-outline" size={64} color="#6B7280" />
            <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#0C3572] text-xl mt-4 mb-2">
              {activeFilter === 'all' ? 'No Orders Yet' : `No ${activeFilter} Orders`}
            </Text>
            <Text style={{ fontFamily: 'Outfit_400Medium' }} className="text-[#2175C0] text-center mb-6 leading-6">
              {activeFilter === 'all'
                ? "You haven't placed any orders yet.\nExplore the store and start shopping!"
                : `No orders with ${activeFilter} status found.`
              }
            </Text>

          </View>
        ) : (
          <View>
            {filteredOrders.map((order) => (
              <OrderCard key={order.orderId} order={order} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default UserOrdersScreen;
