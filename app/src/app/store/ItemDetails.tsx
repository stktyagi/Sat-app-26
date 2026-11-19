import React, { useState, useEffect } from 'react';
import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showAlert } from '@/components';
import { useThemeStore } from '@/state/themeStore';
import { useCartStore } from '@/state/cartStore';
import { useUserStore } from '@/state/userStore';
import { fetchStoreItem, StoreProduct } from '@/api/store';
import { Coins } from 'lucide-react-native';

const ItemDetailsScreen = () => {
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const router = useRouter();
  const { itemId } = useLocalSearchParams() as { itemId: string };

  const { addToCart, getTotalCount } = useCartStore();
  const { userData: userProfile } = useUserStore();

  const [item, setItem] = useState<StoreProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string>('L');
  const [addingToCart, setAddingToCart] = useState(false);

  const cartCount = getTotalCount();

  useEffect(() => {
    loadItem();
  }, [itemId]);

  const loadItem = async () => {
    if (!itemId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await fetchStoreItem(itemId);
      if (data) {
        setItem(data);
      } else {
        showAlert('Error', 'Merchandise item not found');
        router.back();
      }
    } catch (err) {
      console.warn('Failed to load item:', err);
      showAlert('Error', 'Failed to load item details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const isApparel =
    item?.name.toLowerCase().includes('hoodie') ||
    item?.name.toLowerCase().includes('t-shirt') ||
    item?.name.toLowerCase().includes('tshirt') ||
    item?.name.toLowerCase().includes('shirt');

  const sizes = ['S', 'M', 'L', 'XL', 'XXL'];

  const handleAddToCart = async () => {
    if (!item || addingToCart) return;
    setAddingToCart(true);
    try {
      addToCart(item, quantity, isApparel ? selectedSize : undefined);
      await new Promise((resolve) => setTimeout(resolve, 400));
    } finally {
      setAddingToCart(false);
    }
  };

  const bgColor = isDark ? '#111113' : '#F4F5F7';
  const cardBg = isDark ? '#1C1C20' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';
  const textColor = isDark ? '#FFFFFF' : '#111827';
  const subTextColor = isDark ? '#9CA3AF' : '#6B7280';

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: bgColor, justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <ActivityIndicator size="large" color="#38BDF8" />
        <Text style={{ fontFamily: 'Poppins_500Medium', color: subTextColor, marginTop: 14 }}>
          Loading item details...
        </Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={{ flex: 1, backgroundColor: bgColor, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Text style={{ fontFamily: 'Poppins_600SemiBold', color: textColor, fontSize: 18 }}>
          Item Not Found
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            marginTop: 16,
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: '#38BDF8',
          }}
        >
          <Text style={{ fontFamily: 'Poppins_600SemiBold', color: '#000000' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Top Header */}
      <View
        style={{
          paddingTop: Math.max(insets.top + 8, 16),
          paddingHorizontal: 20,
          paddingBottom: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottomWidth: 1,
          borderBottomColor: cardBorder,
          backgroundColor: isDark ? '#131316' : '#FFFFFF',
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: isDark ? '#222228' : '#F3F4F6',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="arrow-back" size={20} color={textColor} />
        </TouchableOpacity>

        <Text
          style={{
            fontFamily: 'Talina',
            fontSize: 22,
            color: textColor,
            letterSpacing: 0.5,
          }}
        >
          Merch Details
        </Text>

        <TouchableOpacity
          onPress={() => router.push('/store/Cart' as any)}
          activeOpacity={0.7}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: isDark ? '#222228' : '#F3F4F6',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <Ionicons name="cart-outline" size={20} color={textColor} />
          {cartCount > 0 && (
            <View
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                backgroundColor: '#EF4444',
                borderRadius: 9,
                minWidth: 18,
                height: 18,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 4,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>
                {cartCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 140,
        }}
      >
        {/* Product Visual Card */}
        <View
          style={{
            backgroundColor: isDark ? '#251E28' : '#FDF2F8',
            borderRadius: 28,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(244, 114, 182, 0.3)' : 'rgba(244, 114, 182, 0.4)',
            overflow: 'hidden',
            height: 320,
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            marginBottom: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: isDark ? 0.25 : 0.12,
            shadowRadius: 14,
            elevation: 5,
          }}
        >
          {/* Price badge */}
          <View
            style={{
              position: 'absolute',
              top: 16,
              left: 16,
              zIndex: 10,
              backgroundColor: 'rgba(0,0,0,0.5)',
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.2)',
            }}
          >
            <Text
              style={{
                fontFamily: 'Poppins_700Bold',
                color: '#FFFFFF',
                fontSize: 14,
              }}
            >
              {item.price} Coins
            </Text>
          </View>

          {/* Merch Image */}
          {item.image ? (
            <Image
              source={{ uri: item.image }}
              style={{ width: '85%', height: '85%' }}
              resizeMode="contain"
            />
          ) : (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <View
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                  borderWidth: 1.5,
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 10,
                }}
              >
                <Ionicons name="help" size={52} color={isDark ? '#9CA3AF' : '#6B7280'} />
              </View>
              <Text
                style={{
                  fontFamily: 'Poppins_500Medium',
                  fontSize: 13,
                  color: isDark ? '#9CA3AF' : '#6B7280',
                }}
              >
                No image available
              </Text>
            </View>
          )}
        </View>

        {/* Title & Badge */}
        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text
              style={{
                fontFamily: 'Talina',
                fontSize: 26,
                color: textColor,
                flex: 1,
                marginRight: 12,
              }}
            >
              {item.name}
            </Text>
            <View
              style={{
                backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#E0F2FE',
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#38BDF8',
              }}
            >
              <Text
                style={{
                  fontFamily: 'Poppins_600SemiBold',
                  fontSize: 11,
                  color: isDark ? '#38BDF8' : '#0284C7',
                  textTransform: 'uppercase',
                }}
              >
                Official Merch
              </Text>
            </View>
          </View>

          <Text
            style={{
              fontFamily: 'Poppins_400Regular',
              fontSize: 13,
              lineHeight: 20,
              color: subTextColor,
            }}
          >
            {item.description || 'Exclusive official Saturnalia commemorative merchandise for participants and attendees.'}
          </Text>
        </View>

        {/* Size Selection (if Apparel) */}
        {isApparel && (
          <View style={{ marginBottom: 20 }}>
            <Text
              style={{
                fontFamily: 'Poppins_600SemiBold',
                fontSize: 14,
                color: textColor,
                marginBottom: 10,
              }}
            >
              Select Size
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {sizes.map((size) => {
                const isSelected = selectedSize === size;
                return (
                  <TouchableOpacity
                    key={size}
                    onPress={() => setSelectedSize(size)}
                    activeOpacity={0.8}
                    style={{
                      width: 52,
                      height: 44,
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isSelected
                        ? '#38BDF8'
                        : isDark
                        ? '#1F2228'
                        : '#FFFFFF',
                      borderWidth: 1,
                      borderColor: isSelected
                        ? '#38BDF8'
                        : isDark
                        ? 'rgba(255, 255, 255, 0.12)'
                        : 'rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: isSelected ? 'Poppins_700Bold' : 'Poppins_600SemiBold',
                        fontSize: 14,
                        color: isSelected ? '#000000' : textColor,
                      }}
                    >
                      {size}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Quantity Controls */}
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: cardBorder,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}
        >
          <View>
            <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: textColor }}>
              Quantity
            </Text>
            <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 11, color: subTextColor }}>
              Select number of units
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity
              onPress={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: isDark ? '#27272A' : '#E5E7EB',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: quantity <= 1 ? 0.4 : 1,
              }}
            >
              <Ionicons name="remove" size={18} color={textColor} />
            </TouchableOpacity>

            <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 18, color: textColor, minWidth: 20, textAlign: 'center' }}>
              {quantity}
            </Text>

            <TouchableOpacity
              onPress={() => setQuantity(quantity + 1)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: isDark ? '#27272A' : '#E5E7EB',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="add" size={18} color={textColor} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Fest Desk Collection Info */}
        <View
          style={{
            backgroundColor: isDark ? 'rgba(56, 189, 248, 0.08)' : '#F0F9FF',
            borderRadius: 18,
            borderWidth: 1,
            borderColor: 'rgba(56, 189, 248, 0.25)',
            padding: 16,
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <Ionicons name="storefront-outline" size={22} color="#38BDF8" style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: '#38BDF8', marginBottom: 2 }}>
              Campus Desk Collection
            </Text>
            <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 11, lineHeight: 17, color: isDark ? '#CBD5E1' : '#334155' }}>
              All merchandise orders are collected in person at the central Saturnalia registration & merch counter during fest days. Show your pass to claim.
            </Text>
          </View>
        </View>

        {/* User Coin Balance Callout */}
        <View
          style={{
            backgroundColor: isDark ? 'rgba(234, 179, 8, 0.1)' : '#FEF9C3',
            borderRadius: 18,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(234, 179, 8, 0.3)' : '#FDE047',
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Coins size={18} color={isDark ? "#FACC15" : "#854D0E"} />
            <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 12, color: isDark ? '#FACC15' : '#854D0E' }}>
              Your Wallet Balance:
            </Text>
          </View>
          <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 14, color: isDark ? '#FACC15' : '#854D0E' }}>
            {userProfile?.coins ?? 0} Coins
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Sticky Action Bar */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: isDark ? '#18181B' : '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: cardBorder,
          paddingHorizontal: 20,
          paddingTop: 14,
          paddingBottom: Math.max(insets.bottom + 8, 20),
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: isDark ? 0.3 : 0.08,
          shadowRadius: 10,
          elevation: 10,
        }}
      >
        <View>
          <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 11, color: subTextColor }}>
            Total Price
          </Text>
          <Text style={{ fontFamily: 'Talina', fontSize: 24, color: textColor }}>
            {item.price * quantity} Coins
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleAddToCart}
          activeOpacity={0.85}
          disabled={addingToCart}
          style={{
            backgroundColor: '#38BDF8',
            borderRadius: 16,
            paddingVertical: 14,
            paddingHorizontal: 24,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 140,
            gap: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          {addingToCart ? (
            <ActivityIndicator size="small" color="#000000" />
          ) : (
            <>
              <Ionicons name="bag-add-outline" size={18} color="#000000" />
              <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 14, color: '#000000' }}>
                Add to Cart
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ItemDetailsScreen;
