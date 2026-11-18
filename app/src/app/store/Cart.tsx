import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeStore } from '@/state/themeStore';
import { useUserStore } from '@/state/userStore';
import { useCartStore } from '@/state/cartStore';
import { showAlert } from '@/components';
import { Coins } from 'lucide-react-native';

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const { userData } = useUserStore();
  const { items, updateQuantity, removeFromCart, clearCart, getTotalAmount, getTotalCount } = useCartStore();

  const totalAmount = getTotalAmount();
  const totalCount = getTotalCount();
  const userCoins = userData?.coins ?? 0;

  const handleCheckout = () => {
    if (items.length === 0) return;

    showAlert(
      'Confirm Reservation',
      `Reserve ${totalCount} item${totalCount > 1 ? 's' : ''} for ₹${totalAmount}? You can collect your merchandise at the Saturnalia Fest Store booth.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Reserve',
          onPress: () => {
            clearCart();
            showAlert(
              'Order Placed! 🎉',
              'Your merchandise reservation has been confirmed! Please show your registered festival pass at the Saturnalia Merchandise Desk.',
              [
                {
                  text: 'Back to Store',
                  onPress: () => router.replace('/(tabs)/store' as any),
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#131316' : '#F3F4F6' }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Top Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: Math.max(insets.top + 8, 16),
          paddingHorizontal: 16,
          paddingBottom: 14,
          borderBottomWidth: 1,
          borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.75}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: isDark ? '#1C1C20' : '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
          }}
        >
          <Ionicons name="arrow-back" size={20} color={isDark ? '#FFFFFF' : '#111827'} />
        </TouchableOpacity>

        <Text
          style={{
            fontFamily: 'Poppins_700Bold',
            fontSize: 18,
            color: isDark ? '#FFFFFF' : '#111827',
          }}
        >
          My Cart {totalCount > 0 ? `(${totalCount})` : ''}
        </Text>

        {items.length > 0 ? (
          <TouchableOpacity onPress={clearCart} activeOpacity={0.75}>
            <Text
              style={{
                fontFamily: 'Poppins_600SemiBold',
                fontSize: 13,
                color: '#EF4444',
              }}
            >
              Clear
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {items.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: isDark ? '#1C1C20' : '#E5E7EB',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 18,
            }}
          >
            <Ionicons name="cart-outline" size={44} color={isDark ? '#6B7280' : '#9CA3AF'} />
          </View>
          <Text
            style={{
              fontFamily: 'Poppins_700Bold',
              fontSize: 20,
              color: isDark ? '#FFFFFF' : '#111827',
              marginBottom: 6,
            }}
          >
            Your Cart is Empty
          </Text>
          <Text
            style={{
              fontFamily: 'Poppins_400Regular',
              fontSize: 14,
              color: isDark ? '#9CA3AF' : '#6B7280',
              textAlign: 'center',
              lineHeight: 20,
              marginBottom: 24,
            }}
          >
            Explore our curated Saturnalia festival merchandise and add your favorites to cart!
          </Text>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.back()}
            style={{
              backgroundColor: '#38BDF8',
              paddingHorizontal: 28,
              paddingVertical: 12,
              borderRadius: 24,
            }}
          >
            <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: '#000000' }}>
              Explore Store
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Cart Items List */}
          <View style={{ gap: 12, marginBottom: 20 }}>
            {items.map((cartItem) => (
              <View
                key={cartItem.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isDark ? '#1C1C20' : '#FFFFFF',
                  borderRadius: 18,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: isDark ? 0.2 : 0.04,
                  shadowRadius: 5,
                  elevation: 2,
                }}
              >
                {/* Item Thumbnail */}
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    backgroundColor: isDark ? '#27272A' : '#F3F4F6',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 14,
                    overflow: 'hidden',
                  }}
                >
                  {cartItem.image ? (
                    <Image
                      source={{ uri: cartItem.image }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="contain"
                    />
                  ) : (
                    <Ionicons name="help" size={26} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  )}
                </View>

                {/* Details */}
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: 'Poppins_600SemiBold',
                      fontSize: 15,
                      color: isDark ? '#FFFFFF' : '#111827',
                    }}
                    numberOfLines={1}
                  >
                    {cartItem.name}
                  </Text>
                  {cartItem.selectedSize && (
                    <Text
                      style={{
                        fontFamily: 'Poppins_500Medium',
                        fontSize: 12,
                        color: isDark ? '#9CA3AF' : '#6B7280',
                        marginTop: 1,
                      }}
                    >
                      Size: {cartItem.selectedSize}
                    </Text>
                  )}
                  <Text
                    style={{
                      fontFamily: 'Outfit_700Bold',
                      fontSize: 15,
                      color: '#38BDF8',
                      marginTop: 3,
                    }}
                  >
                    ₹{cartItem.price * cartItem.quantity}
                  </Text>
                </View>

                {/* Quantity Controls */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isDark ? '#27272A' : '#F3F4F6',
                    borderRadius: 12,
                    paddingHorizontal: 4,
                    paddingVertical: 2,
                    gap: 8,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => updateQuantity(cartItem.id, cartItem.quantity - 1)}
                    style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name="remove" size={16} color={isDark ? '#FFFFFF' : '#111827'} />
                  </TouchableOpacity>

                  <Text
                    style={{
                      fontFamily: 'Poppins_600SemiBold',
                      fontSize: 14,
                      color: isDark ? '#FFFFFF' : '#111827',
                      minWidth: 16,
                      textAlign: 'center',
                    }}
                  >
                    {cartItem.quantity}
                  </Text>

                  <TouchableOpacity
                    onPress={() => updateQuantity(cartItem.id, cartItem.quantity + 1)}
                    style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name="add" size={16} color={isDark ? '#FFFFFF' : '#111827'} />
                  </TouchableOpacity>
                </View>

                {/* Remove button */}
                <TouchableOpacity
                  onPress={() => removeFromCart(cartItem.id)}
                  style={{ marginLeft: 10, padding: 4 }}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* User Coins Info Box */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? '#1C1917' : '#FEF3C7',
              borderWidth: 1,
              borderColor: '#F59E0B',
              borderRadius: 16,
              padding: 14,
              marginBottom: 16,
              gap: 10,
            }}
          >
            <Coins size={22} color={isDark ? "#FBBF24" : "#D97706"} />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: 'Poppins_600SemiBold',
                  fontSize: 13,
                  color: isDark ? '#FBBF24' : '#92400E',
                }}
              >
                Saturnalia Wallet: {userCoins} Coins
              </Text>
              <Text
                style={{
                  fontFamily: 'Poppins_400Regular',
                  fontSize: 11.5,
                  color: isDark ? '#D6D3D1' : '#78350F',
                }}
              >
                Complete daily games & quizzes to earn more coins for exclusive fest perks!
              </Text>
            </View>
          </View>

          {/* Order Summary Card */}
          <View
            style={{
              backgroundColor: isDark ? '#1C1C20' : '#FFFFFF',
              borderRadius: 20,
              padding: 18,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
              marginBottom: 20,
            }}
          >
            <Text
              style={{
                fontFamily: 'Poppins_700Bold',
                fontSize: 16,
                color: isDark ? '#FFFFFF' : '#111827',
                marginBottom: 12,
              }}
            >
              Order Summary
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 13.5, color: isDark ? '#9CA3AF' : '#6B7280' }}>
                Items Total ({totalCount})
              </Text>
              <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: isDark ? '#FFFFFF' : '#111827' }}>
                ₹{totalAmount}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 13.5, color: isDark ? '#9CA3AF' : '#6B7280' }}>
                Festival Convenience
              </Text>
              <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: '#10B981' }}>
                FREE
              </Text>
            </View>

            <View
              style={{
                height: 1,
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                marginVertical: 10,
              }}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 16, color: isDark ? '#FFFFFF' : '#111827' }}>
                Total Payable
              </Text>
              <Text style={{ fontFamily: 'Outfit_800ExtraBold', fontSize: 20, color: '#38BDF8' }}>
                ₹{totalAmount}
              </Text>
            </View>
          </View>

          {/* Place Order Button */}
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={handleCheckout}
            style={{
              backgroundColor: '#38BDF8',
              borderRadius: 18,
              paddingVertical: 15,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Text
              style={{
                fontFamily: 'Poppins_700Bold',
                fontSize: 15,
                color: '#000000',
              }}
            >
              Reserve Merchandise • ₹{totalAmount}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}
