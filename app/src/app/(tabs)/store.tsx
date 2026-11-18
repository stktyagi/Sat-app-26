import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { useThemeStore } from '@/state/themeStore';
import { useAdminDrawerStore } from '@/state/adminDrawerStore';
import { useUserStore } from '@/state/userStore';
import { useCartStore } from '@/state/cartStore';
import { fetchStoreItems, StoreProduct } from '@/api/store';
import { showAlert } from '@/components';
import { Coins } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CENTER_CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.58, 230);
const CENTER_CARD_HEIGHT = 290;
const SIDE_CARD_HEIGHT = 236;
const SIDE_OVERFLOW = 42;
const SIDE_GAP = 14;
const SIDE_CARD_WIDTH = Math.max((SCREEN_WIDTH - CENTER_CARD_WIDTH - (SIDE_GAP * 2)) / 2 + SIDE_OVERFLOW, 85);



/**
 * Geometric Jaali / Lattice pattern overlay matching the reference mockup
 */
const JaaliOverlay: React.FC<{
  color?: string;
  cardWidth?: number;
  cardHeight?: number;
}> = ({
  color = 'rgba(0, 0, 0, 0.22)',
  cardWidth = 220,
  cardHeight = 280,
}) => {
  const tileW = 34;
  const tileH = 46;
  const cols = Math.ceil(cardWidth / tileW) + 2;
  const rows = Math.ceil(cardHeight / tileH) + 2;

  const paths: React.ReactNode[] = [];
  for (let r = -1; r < rows; r++) {
    for (let c = -1; c < cols; c++) {
      const offsetX = c * tileW + (r % 2 === 0 ? 0 : tileW / 2);
      const offsetY = r * tileH;
      paths.push(
        <Path
          key={`${r}-${c}`}
          d={`M ${offsetX + 17},${offsetY} C ${offsetX + 17},${offsetY + 11.5} ${offsetX + 34},${offsetY + 11.5} ${offsetX + 34},${offsetY + 23} C ${offsetX + 34},${offsetY + 34.5} ${offsetX + 17},${offsetY + 34.5} ${offsetX + 17},${offsetY + 46} C ${offsetX + 17},${offsetY + 34.5} ${offsetX},${offsetY + 34.5} ${offsetX},${offsetY + 23} C ${offsetX},${offsetY + 11.5} ${offsetX + 17},${offsetY + 11.5} ${offsetX + 17},${offsetY} Z`}
          fill="none"
          stroke={color}
          strokeWidth="1.2"
        />
      );
    }
  }

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
      }}
      pointerEvents="none"
    >
      <Svg width="100%" height="100%">
        {paths}
      </Svg>
    </View>
  );
};

/**
 * Placeholder when product image is missing
 */
const ProductMissingImagePlaceholder: React.FC = () => {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: 76,
          height: 76,
          borderRadius: 38,
          backgroundColor: 'rgba(0, 0, 0, 0.28)',
          borderWidth: 1.5,
          borderColor: 'rgba(255, 255, 255, 0.25)',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
        }}
      >
        <Ionicons name="help" size={44} color="#F3F4F6" />
      </View>
      <Text
        style={{
          fontFamily: 'Poppins_500Medium',
          fontSize: 12,
          color: 'rgba(255, 255, 255, 0.9)',
          letterSpacing: 0.2,
        }}
      >
        No image
      </Text>
    </View>
  );
};

const StoreScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const { openDrawer } = useAdminDrawerStore();
  const { userData, refreshUserProfile } = useUserStore();
  const { items: cartItems, addToCart, getTotalCount } = useCartStore();

  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [addingProductId, setAddingProductId] = useState<string | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  // Load products from backend
  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchStoreItems();
      setProducts(data || []);
    } catch (err) {
      console.warn('Failed to load products:', err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
    refreshUserProfile().catch(() => {});
  }, [loadProducts, refreshUserProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadProducts(), refreshUserProfile()]);
    setRefreshing(false);
  }, [loadProducts, refreshUserProfile]);

  const toggleBookmark = (id: string) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAddToCart = async (product: StoreProduct) => {
    if (addingProductId) return;
    setAddingProductId(product.id);
    try {
      addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        description: product.description,
        image: product.image,
      });
      await new Promise((resolve) => setTimeout(resolve, 400));
    } finally {
      setAddingProductId(null);
    }
  };

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase().trim();
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  const cartCount = getTotalCount();
  const userCoins = userData?.coins ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#131316' : '#F3F4F6' }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Top Header Bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: Math.max(insets.top + 8, 16),
          paddingBottom: 10,
          gap: 10,
        }}
      >
        {/* Hamburger Menu */}
        <TouchableOpacity
          onPress={openDrawer}
          activeOpacity={0.75}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: isDark ? '#1C1C20' : '#FFFFFF',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.1)',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.25 : 0.06,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <Ionicons name="menu" size={22} color={isDark ? '#FFFFFF' : '#000000'} />
        </TouchableOpacity>

        {/* Search Item Pill */}
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: isDark ? '#1C1C20' : '#FFFFFF',
            borderWidth: isDark ? 0 : 1,
            borderColor: '#D1D5DB',
            borderRadius: 9999,
            paddingHorizontal: 14,
            height: 44,
            gap: 8,
          }}
        >
          <Ionicons name="search" size={17} color={isDark ? '#8E8E93' : '#6B7280'} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search Item"
            placeholderTextColor={isDark ? '#8E8E93' : '#9CA3AF'}
            style={{
              flex: 1,
              color: isDark ? '#FFFFFF' : '#000000',
              fontFamily: 'Poppins_500Medium',
              fontSize: 13.5,
              padding: 0,
            }}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={isDark ? '#8E8E93' : '#6B7280'} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Coins Badge Chip */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push('/store/Leaderboard' as any)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: isDark ? '#262010' : '#FEF3C7',
            borderWidth: 1,
            borderColor: '#F59E0B',
            borderRadius: 20,
            paddingHorizontal: 10,
            paddingVertical: 6,
            gap: 4,
          }}
        >
          <Coins size={14} color={isDark ? "#FBBF24" : "#D97706"} />
          <Text
            style={{
              fontFamily: 'Outfit_700Bold',
              fontSize: 13,
              color: isDark ? '#FBBF24' : '#D97706',
            }}
          >
            {userCoins}
          </Text>
        </TouchableOpacity>

        {/* Profile Avatar Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push('/profile')}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            borderWidth: 2,
            borderColor: '#38BDF8',
            backgroundColor: isDark ? '#1C1C20' : '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {userData?.photoUrl || userData?.photoURL ? (
            <Image
              source={{ uri: userData.photoUrl || userData.photoURL }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : (
            <Ionicons name="person" size={24} color={isDark ? '#9CA3AF' : '#0C3572'} />
          )}
        </TouchableOpacity>
      </View>

      {/* Navigation Buttons Row: Cart, Leaderboard, Daily Games */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 6,
          gap: 7,
        }}
      >
        {/* Cart Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push('/store/Cart' as any)}
          style={{
            flex: 0.85,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E5E7EB',
            borderRadius: 14,
            paddingVertical: 10,
            paddingHorizontal: 8,
            gap: 5,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: isDark ? 0.2 : 0.05,
            shadowRadius: 3,
            elevation: 1,
          }}
        >
          <Ionicons name="cart" size={16} color="#38BDF8" />
          <Text
            style={{
              fontFamily: 'Poppins_600SemiBold',
              fontSize: 12,
              color: isDark ? '#FFFFFF' : '#1F2937',
            }}
          >
            Cart
          </Text>
          {cartCount > 0 && (
            <View
              style={{
                backgroundColor: '#EF4444',
                borderRadius: 10,
                paddingHorizontal: 5,
                paddingVertical: 1,
              }}
            >
              <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 10, color: '#FFFFFF' }}>
                {cartCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Leaderboard Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push('/store/Leaderboard' as any)}
          style={{
            flex: 1.25,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E5E7EB',
            borderRadius: 14,
            paddingVertical: 10,
            paddingHorizontal: 6,
            gap: 5,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: isDark ? 0.2 : 0.05,
            shadowRadius: 3,
            elevation: 1,
          }}
        >
          <Ionicons name="trophy" size={15} color="#F59E0B" />
          <Text
            style={{
              fontFamily: 'Poppins_600SemiBold',
              fontSize: 11.5,
              color: isDark ? '#FFFFFF' : '#1F2937',
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            Leaderboard
          </Text>
        </TouchableOpacity>

        {/* Daily Games Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push('/store/Games' as any)}
          style={{
            flex: 1.1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isDark ? '#1E1B4B' : '#EEF2FF',
            borderWidth: 1,
            borderColor: isDark ? '#6366F1' : '#C7D2FE',
            borderRadius: 14,
            paddingVertical: 10,
            paddingHorizontal: 6,
            gap: 5,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: isDark ? 0.2 : 0.05,
            shadowRadius: 3,
            elevation: 1,
          }}
        >
          <Ionicons name="game-controller" size={16} color="#818CF8" />
          <Text
            style={{
              fontFamily: 'Poppins_600SemiBold',
              fontSize: 11.5,
              color: isDark ? '#C7D2FE' : '#4338CA',
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            Daily Games
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom + 130, 170),
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#38BDF8"
          />
        }
      >
        {/* Hero Section: The SAT Store Banner with store1 & store2 graphics */}
        <View
          style={{
            position: 'relative',
            paddingVertical: 16,
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 120,
            marginBottom: 8,
          }}
        >
          {/* Left: Dome & Peacock illustration (store1.png) */}
          <Image
            source={require('@/assets/store1.png')}
            style={{
              position: 'absolute',
              left: 4,
              bottom: 4,
              width: 74,
              height: 102,
            }}
            resizeMode="contain"
          />

          {/* Right: Bougainvillea floral vine (store2.png) */}
          <Image
            source={require('@/assets/store2.png')}
            style={{
              position: 'absolute',
              right: 2,
              top: -6,
              width: 56,
              height: 116,
            }}
            resizeMode="contain"
          />

          {/* Center Titles */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Text
              style={{
                fontFamily: 'Talina',
                fontSize: 34,
                color: '#C084FC',
                letterSpacing: 0.5,
              }}
            >
              The SAT{' '}
            </Text>
            <Text
              style={{
                fontFamily: 'Talina',
                fontSize: 34,
                color: '#38BDF8',
                letterSpacing: 0.5,
              }}
            >
              Store
            </Text>
          </View>
          <Text
            style={{
              fontFamily: 'Poppins_700Bold',
              fontSize: 15,
              color: isDark ? '#FFFFFF' : '#111827',
              marginTop: 4,
              textAlign: 'center',
              letterSpacing: 0.2,
            }}
          >
            For Memories That Stay
          </Text>
        </View>

        {/* Products List */}
        {loading && products.length === 0 ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
            <ActivityIndicator size="large" color="#38BDF8" />
            <Text
              style={{
                fontFamily: 'Poppins_500Medium',
                color: isDark ? '#9CA3AF' : '#6B7280',
                fontSize: 14,
                marginTop: 12,
              }}
            >
              Loading store items...
            </Text>
          </View>
        ) : filteredProducts.length === 0 ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
            <Ionicons
              name={searchQuery.trim() ? "search-outline" : "bag-outline"}
              size={48}
              color="#71717A"
            />
            <Text
              style={{
                fontFamily: 'Poppins_500Medium',
                color: '#9CA3AF',
                fontSize: 15,
                marginTop: 12,
                textAlign: 'center',
              }}
            >
              {searchQuery.trim()
                ? `No products found matching "${searchQuery}"`
                : "No store items available yet"}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 36 }}>
            {filteredProducts.map((product) => {
              const isBookmarked = bookmarkedIds.has(product.id);

              return (
                <View key={product.id} style={{ alignItems: 'center' }}>
                  {/* 3-Rectangle Row (Left: Olive, Center: Terracotta/Coral, Right: Sky Blue) */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: SCREEN_WIDTH,
                    }}
                  >
                    {/* Left Olive / Gold Card (shorter & overflows out of screen) */}
                    <View
                      style={{
                        width: SIDE_CARD_WIDTH,
                        height: SIDE_CARD_HEIGHT,
                        borderRadius: 20,
                        backgroundColor: '#7A6D24',
                        overflow: 'hidden',
                        marginLeft: -SIDE_OVERFLOW,
                        marginRight: SIDE_GAP,
                      }}
                    >
                      <JaaliOverlay
                        color="rgba(0, 0, 0, 0.22)"
                        cardWidth={SIDE_CARD_WIDTH}
                        cardHeight={SIDE_CARD_HEIGHT}
                      />
                    </View>

                    {/* Center Main Card (Coral / Pink with price badge & bookmark) */}
                    <TouchableOpacity
                      activeOpacity={0.92}
                      onPress={() => {
                        router.push({
                          pathname: '/store/ItemDetails' as any,
                          params: { itemId: product.id },
                        });
                      }}
                      style={{
                        width: CENTER_CARD_WIDTH,
                        height: CENTER_CARD_HEIGHT,
                        borderRadius: 22,
                        backgroundColor: '#C75450',
                        overflow: 'hidden',
                        position: 'relative',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.45,
                        shadowRadius: 10,
                        elevation: 6,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <JaaliOverlay
                        color="rgba(0, 0, 0, 0.2)"
                        cardWidth={CENTER_CARD_WIDTH}
                        cardHeight={CENTER_CARD_HEIGHT}
                      />

                      {/* Price Badge Pill in Top-Left */}
                      <View
                        style={{
                          position: 'absolute',
                          top: 12,
                          left: 12,
                          backgroundColor: 'rgba(0, 0, 0, 0.55)',
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 10,
                          zIndex: 5,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: 'Poppins_600SemiBold',
                            fontSize: 13,
                            color: '#F3F4F6',
                          }}
                        >
                          {product.priceText || `Rs. ${product.price}`}
                        </Text>
                      </View>

                      {/* Bookmark Icon in Top-Right */}
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => toggleBookmark(product.id)}
                        style={{
                          position: 'absolute',
                          top: 12,
                          right: 12,
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: 'rgba(0, 0, 0, 0.55)',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 5,
                        }}
                      >
                        <Ionicons
                          name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                          size={17}
                          color={isBookmarked ? '#38BDF8' : '#D1D5DB'}
                        />
                      </TouchableOpacity>

                      {/* Product Center Illustration or Image */}
                      {product.image ? (
                        <Image
                          source={{ uri: product.image }}
                          style={{ width: '80%', height: '70%' }}
                          resizeMode="contain"
                        />
                      ) : (
                        <ProductMissingImagePlaceholder />
                      )}
                    </TouchableOpacity>

                    {/* Right Sky Blue Card (shorter & overflows out of screen) */}
                    <View
                      style={{
                        width: SIDE_CARD_WIDTH,
                        height: SIDE_CARD_HEIGHT,
                        borderRadius: 20,
                        backgroundColor: '#2C82C9',
                        overflow: 'hidden',
                        marginLeft: SIDE_GAP,
                        marginRight: -SIDE_OVERFLOW,
                      }}
                    >
                      <JaaliOverlay
                        color="rgba(0, 0, 0, 0.22)"
                        cardWidth={SIDE_CARD_WIDTH}
                        cardHeight={SIDE_CARD_HEIGHT}
                      />
                    </View>
                  </View>

                  {/* Product Title */}
                  <Text
                    style={{
                      fontFamily: 'Poppins_700Bold',
                      fontSize: 19,
                      color: isDark ? '#FFFFFF' : '#111827',
                      textAlign: 'center',
                      marginTop: 14,
                      marginBottom: 4,
                    }}
                  >
                    {product.name}
                  </Text>

                  {/* Product Description */}
                  <Text
                    style={{
                      fontFamily: 'Poppins_400Regular',
                      fontSize: 13,
                      color: isDark ? '#9CA3AF' : '#4B5563',
                      textAlign: 'center',
                      lineHeight: 18,
                      maxWidth: 300,
                      paddingHorizontal: 16,
                      marginBottom: 12,
                    }}
                  >
                    {product.description}
                  </Text>

                  {/* Action Button: Add to Cart */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={addingProductId === product.id}
                    onPress={() => handleAddToCart(product)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#38BDF8',
                      paddingHorizontal: 20,
                      paddingVertical: 9,
                      borderRadius: 20,
                      minWidth: 120,
                      minHeight: 36,
                      gap: 6,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 3 },
                      shadowOpacity: 0.3,
                      shadowRadius: 5,
                      elevation: 3,
                    }}
                  >
                    {addingProductId === product.id ? (
                      <ActivityIndicator size="small" color="#000000" />
                    ) : (
                      <>
                        <Ionicons name="cart-outline" size={17} color="#000000" />
                        <Text
                          style={{
                            fontFamily: 'Poppins_600SemiBold',
                            fontSize: 13,
                            color: '#000000',
                          }}
                        >
                          Add to Cart
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default StoreScreen;
