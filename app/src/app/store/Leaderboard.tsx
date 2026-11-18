import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeStore } from '@/state/themeStore';
import { useUserStore } from '@/state/userStore';
import { fetchLeaderboard, LeaderboardUser } from '@/api/store';
import { Coins } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Deterministic trend indicator (▲, ▼, —) matching the leaderboard vibe
const getTrend = (rank: number, id?: string) => {
  const hash = (id || `${rank}`).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const mod = (hash + rank) % 3;
  if (mod === 0) return { dir: 'up', color: '#10B981', symbol: '▲' };
  if (mod === 1) return { dir: 'down', color: '#EF4444', symbol: '▼' };
  return { dir: 'same', color: '#9CA3AF', symbol: '—' };
};

export default function LeaderboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const { userData, refreshUserProfile } = useUserStore();

  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [userRank, setUserRank] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await fetchLeaderboard();
      setLeaderboard(res.leaderboard);
      if (res.userRank) {
        setUserRank(res.userRank);
      }
    } catch (e) {
      console.warn('Failed to load leaderboard:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    refreshUserProfile().catch(() => {});
  }, [loadData, refreshUserProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadData(), refreshUserProfile()]);
    setRefreshing(false);
  }, [loadData, refreshUserProfile]);

  const top1 = leaderboard[0];
  const top2 = leaderboard[1];
  const top3 = leaderboard[2];
  const remaining = leaderboard.slice(3);

  const currentUserCoins = userData?.coins ?? 0;

  // Colors based on theme
  const bgColor = isDark ? '#131316' : '#F4F5F7';
  const cardBg = isDark ? '#1C1C20' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
  const textPrimary = isDark ? '#FFFFFF' : '#111827';
  const textSecondary = isDark ? '#9CA3AF' : '#6B7280';
  const headerBg = isDark ? '#131316' : '#FFFFFF';
  const dividerColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: Math.max(insets.top + 8, 16),
          paddingHorizontal: 16,
          paddingBottom: 14,
          backgroundColor: headerBg,
          borderBottomWidth: 1,
          borderBottomColor: cardBorder,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.75}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: isDark ? '#1C1C20' : '#F3F4F6',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: cardBorder,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={textPrimary} />
        </TouchableOpacity>

        <View style={{ alignItems: 'center' }}>
          <Text
            style={{
              fontFamily: 'Poppins_700Bold',
              fontSize: 18,
              color: textPrimary,
              letterSpacing: 0.3,
            }}
          >
            Leaderboard
          </Text>
          <Text
            style={{
              fontFamily: 'Poppins_500Medium',
              fontSize: 11,
              color: textSecondary,
            }}
          >
            Fest Coin Rankings
          </Text>
        </View>

        {/* Current user coins pill */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7',
            borderWidth: 1,
            borderColor: '#F59E0B',
            borderRadius: 16,
            paddingHorizontal: 9,
            paddingVertical: 4,
            gap: 4,
          }}
        >
          <Coins size={13} color={isDark ? '#FBBF24' : '#D97706'} />
          <Text
            style={{
              fontFamily: 'Outfit_700Bold',
              fontSize: 12,
              color: isDark ? '#FBBF24' : '#D97706',
            }}
          >
            {currentUserCoins}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#38BDF8" />
          <Text
            style={{
              fontFamily: 'Poppins_500Medium',
              fontSize: 13,
              color: textSecondary,
              marginTop: 12,
            }}
          >
            Loading rankings...
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 130 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#38BDF8"
            />
          }
        >
          {/* Top 3 Podium Bars Section */}
          <View
            style={{
              paddingTop: 20,
              paddingBottom: 24,
              paddingHorizontal: 14,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                justifyContent: 'center',
                width: '100%',
                gap: 8,
              }}
            >
              {/* ──────────────── RANK 2 (Left Podium Bar) ──────────────── */}
              <View style={{ flex: 1, alignItems: 'center' }}>
                {top2 ? (
                  <>
                    {/* Rank Badge Speech Bubble */}
                    <View
                      style={{
                        backgroundColor: '#64748B',
                        borderRadius: 10,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        marginBottom: 6,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 10, color: '#FFFFFF' }}>2nd</Text>
                    </View>

                    {/* Avatar Card */}
                    <View
                      style={{
                        width: 62,
                        height: 62,
                        borderRadius: 18,
                        borderWidth: 2.5,
                        borderColor: '#94A3B8',
                        backgroundColor: isDark ? '#1F2937' : '#E2E8F0',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        marginBottom: 6,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.25,
                        shadowRadius: 5,
                        elevation: 4,
                      }}
                    >
                      <Ionicons name="person" size={28} color="#94A3B8" />
                    </View>

                    {/* User Name */}
                    <Text
                      style={{
                        fontFamily: 'Poppins_600SemiBold',
                        fontSize: 12,
                        color: textPrimary,
                        textAlign: 'center',
                        marginBottom: 2,
                      }}
                      numberOfLines={1}
                    >
                      {top2.displayName}
                    </Text>

                    {/* Coins Tag */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 3,
                        marginBottom: 8,
                      }}
                    >
                      <Coins size={11} color={isDark ? '#CBD5E1' : '#475569'} />
                      <Text
                        style={{
                          fontFamily: 'Outfit_700Bold',
                          fontSize: 11,
                          color: isDark ? '#CBD5E1' : '#475569',
                        }}
                      >
                        {top2.coins}
                      </Text>
                    </View>

                    {/* The Podium Bar #2 */}
                    <View
                      style={{
                        width: '100%',
                        height: 105,
                        backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
                        borderTopLeftRadius: 16,
                        borderTopRightRadius: 16,
                        borderWidth: 1.5,
                        borderBottomWidth: 0,
                        borderColor: '#94A3B8',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingTop: 10,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: 'Outfit_800ExtraBold',
                          fontSize: 28,
                          color: isDark ? '#E2E8F0' : '#475569',
                        }}
                      >
                        2
                      </Text>
                      <Ionicons name="ribbon-outline" size={18} color="#94A3B8" style={{ marginTop: 2 }} />
                      <Text
                        style={{
                          fontFamily: 'Poppins_700Bold',
                          fontSize: 9,
                          letterSpacing: 0.8,
                          color: isDark ? '#94A3B8' : '#64748B',
                          marginTop: 4,
                        }}
                      >
                        SILVER
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={{ height: 180 }} />
                )}
              </View>

              {/* ──────────────── RANK 1 (Center Tall Podium Bar) ──────────────── */}
              <View style={{ flex: 1.18, alignItems: 'center' }}>
                {top1 ? (
                  <>
                    {/* Crown + Rank 1 Badge */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                      <Text style={{ fontSize: 18 }}>👑</Text>
                      <View
                        style={{
                          backgroundColor: '#F59E0B',
                          borderRadius: 10,
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                        }}
                      >
                        <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 10.5, color: '#000000' }}>1st</Text>
                      </View>
                    </View>

                    {/* Avatar Card with Golden Glow */}
                    <View
                      style={{
                        width: 74,
                        height: 74,
                        borderRadius: 22,
                        borderWidth: 3,
                        borderColor: '#F59E0B',
                        backgroundColor: isDark ? '#262010' : '#FEF3C7',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        marginBottom: 6,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.45,
                        shadowRadius: 8,
                        elevation: 7,
                      }}
                    >
                      <Ionicons name="person" size={34} color="#F59E0B" />
                    </View>

                    {/* User Name */}
                    <Text
                      style={{
                        fontFamily: 'Poppins_700Bold',
                        fontSize: 13.5,
                        color: textPrimary,
                        textAlign: 'center',
                        marginBottom: 2,
                      }}
                      numberOfLines={1}
                    >
                      {top1.displayName}
                    </Text>

                    {/* Coins Tag */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 3,
                        marginBottom: 8,
                      }}
                    >
                      <Coins size={12} color={isDark ? '#FBBF24' : '#D97706'} />
                      <Text
                        style={{
                          fontFamily: 'Outfit_800ExtraBold',
                          fontSize: 12.5,
                          color: isDark ? '#FBBF24' : '#D97706',
                        }}
                      >
                        {top1.coins}
                      </Text>
                    </View>

                    {/* The Tall Center Podium Bar #1 */}
                    <View
                      style={{
                        width: '100%',
                        height: 145,
                        backgroundColor: isDark ? '#262010' : '#FEF3C7',
                        borderTopLeftRadius: 18,
                        borderTopRightRadius: 18,
                        borderWidth: 2,
                        borderBottomWidth: 0,
                        borderColor: '#F59E0B',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingTop: 12,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: 'Outfit_800ExtraBold',
                          fontSize: 34,
                          color: isDark ? '#FBBF24' : '#B45309',
                        }}
                      >
                        1
                      </Text>
                      <Ionicons name="trophy" size={22} color="#F59E0B" style={{ marginTop: 2 }} />
                      <Text
                        style={{
                          fontFamily: 'Poppins_700Bold',
                          fontSize: 10,
                          letterSpacing: 1,
                          color: isDark ? '#FBBF24' : '#B45309',
                          marginTop: 4,
                        }}
                      >
                        GOLD
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={{ height: 220 }} />
                )}
              </View>

              {/* ──────────────── RANK 3 (Right Podium Bar) ──────────────── */}
              <View style={{ flex: 1, alignItems: 'center' }}>
                {top3 ? (
                  <>
                    {/* Rank Badge Speech Bubble */}
                    <View
                      style={{
                        backgroundColor: '#B45309',
                        borderRadius: 10,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        marginBottom: 6,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 10, color: '#FFFFFF' }}>3rd</Text>
                    </View>

                    {/* Avatar Card */}
                    <View
                      style={{
                        width: 62,
                        height: 62,
                        borderRadius: 18,
                        borderWidth: 2.5,
                        borderColor: '#D97706',
                        backgroundColor: isDark ? '#261C12' : '#FFEDD5',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        marginBottom: 6,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.25,
                        shadowRadius: 5,
                        elevation: 4,
                      }}
                    >
                      <Ionicons name="person" size={28} color="#D97706" />
                    </View>

                    {/* User Name */}
                    <Text
                      style={{
                        fontFamily: 'Poppins_600SemiBold',
                        fontSize: 12,
                        color: textPrimary,
                        textAlign: 'center',
                        marginBottom: 2,
                      }}
                      numberOfLines={1}
                    >
                      {top3.displayName}
                    </Text>

                    {/* Coins Tag */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 3,
                        marginBottom: 8,
                      }}
                    >
                      <Coins size={11} color={isDark ? '#FDBA74' : '#9A3412'} />
                      <Text
                        style={{
                          fontFamily: 'Outfit_700Bold',
                          fontSize: 11,
                          color: isDark ? '#FDBA74' : '#9A3412',
                        }}
                      >
                        {top3.coins}
                      </Text>
                    </View>

                    {/* The Podium Bar #3 */}
                    <View
                      style={{
                        width: '100%',
                        height: 80,
                        backgroundColor: isDark ? '#2A1F17' : '#FFEDD5',
                        borderTopLeftRadius: 16,
                        borderTopRightRadius: 16,
                        borderWidth: 1.5,
                        borderBottomWidth: 0,
                        borderColor: '#D97706',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingTop: 8,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: 'Outfit_800ExtraBold',
                          fontSize: 24,
                          color: isDark ? '#FDBA74' : '#9A3412',
                        }}
                      >
                        3
                      </Text>
                      <Ionicons name="ribbon-outline" size={16} color="#D97706" style={{ marginTop: 2 }} />
                      <Text
                        style={{
                          fontFamily: 'Poppins_700Bold',
                          fontSize: 8.5,
                          letterSpacing: 0.8,
                          color: isDark ? '#FDBA74' : '#9A3412',
                          marginTop: 3,
                        }}
                      >
                        BRONZE
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={{ height: 160 }} />
                )}
              </View>
            </View>
          </View>

          {/* ──────────────── Ranks 4+ List Section ──────────────── */}
          <View
            style={{
              backgroundColor: cardBg,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderWidth: 1,
              borderColor: cardBorder,
              paddingTop: 16,
              paddingHorizontal: 16,
              marginHorizontal: 12,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: isDark ? 0.2 : 0.04,
              shadowRadius: 8,
              elevation: 3,
            }}
          >
            {/* Table Column Labels */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingHorizontal: 12,
                paddingBottom: 10,
                borderBottomWidth: 1,
                borderBottomColor: dividerColor,
              }}
            >
              <Text
                style={{
                  fontFamily: 'Poppins_600SemiBold',
                  fontSize: 11,
                  letterSpacing: 0.6,
                  color: textSecondary,
                }}
              >
                RANK & PARTICIPANT
              </Text>
              <Text
                style={{
                  fontFamily: 'Poppins_600SemiBold',
                  fontSize: 11,
                  letterSpacing: 0.6,
                  color: textSecondary,
                }}
              >
                COINS
              </Text>
            </View>

            {/* Rows */}
            {remaining.length === 0 ? (
              <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                <Text style={{ fontFamily: 'Poppins_500Medium', color: textSecondary, fontSize: 13 }}>
                  No additional participants on the leaderboard yet.
                </Text>
              </View>
            ) : (
              remaining.map((user, idx) => {
                const isCurrentUser = user.userId === userData?.userId;
                const trend = getTrend(user.rank, user.userId);
                const isLast = idx === remaining.length - 1;

                return (
                  <View
                    key={user.userId || `user-${user.rank}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      paddingHorizontal: 8,
                      borderBottomWidth: isLast ? 0 : 1,
                      borderBottomColor: dividerColor,
                      backgroundColor: isCurrentUser
                        ? (isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(56, 189, 248, 0.08)')
                        : 'transparent',
                      borderRadius: isCurrentUser ? 12 : 0,
                    }}
                  >
                    {/* Rank Number + Trend Indicator */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', width: 44 }}>
                      <Text
                        style={{
                          fontFamily: 'Outfit_700Bold',
                          fontSize: 14,
                          color: isCurrentUser ? '#38BDF8' : textPrimary,
                          width: 24,
                          textAlign: 'left',
                        }}
                      >
                        {user.rank}
                      </Text>
                      <Text
                        style={{
                          fontSize: 9,
                          color: trend.color,
                          fontFamily: 'Poppins_700Bold',
                          marginLeft: 2,
                        }}
                      >
                        {trend.symbol}
                      </Text>
                    </View>

                    {/* Avatar (rounded square with character border) */}
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        backgroundColor: isDark ? '#27272A' : '#F3F4F6',
                        borderWidth: 1.5,
                        borderColor: isCurrentUser ? '#38BDF8' : cardBorder,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 10,
                        overflow: 'hidden',
                      }}
                    >
                      <Ionicons name="person" size={20} color={isCurrentUser ? '#38BDF8' : textSecondary} />
                    </View>

                    {/* User Details */}
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text
                          style={{
                            fontFamily: isCurrentUser ? 'Poppins_700Bold' : 'Poppins_600SemiBold',
                            fontSize: 13.5,
                            color: textPrimary,
                          }}
                          numberOfLines={1}
                        >
                          {user.displayName}
                        </Text>
                        {isCurrentUser && (
                          <View
                            style={{
                              backgroundColor: '#38BDF8',
                              paddingHorizontal: 5,
                              paddingVertical: 1,
                              borderRadius: 6,
                            }}
                          >
                            <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 9, color: '#FFFFFF' }}>YOU</Text>
                          </View>
                        )}
                      </View>
                      {user.collegeName ? (
                        <Text
                          style={{
                            fontFamily: 'Poppins_400Regular',
                            fontSize: 11,
                            color: textSecondary,
                            marginTop: 1,
                          }}
                          numberOfLines={1}
                        >
                          {user.collegeName}
                        </Text>
                      ) : null}
                    </View>

                    {/* Coins Badge */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#FEF3C7',
                        borderWidth: 1,
                        borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.4)',
                        borderRadius: 12,
                        paddingHorizontal: 9,
                        paddingVertical: 4,
                        gap: 4,
                      }}
                    >
                      <Coins size={12} color={isDark ? '#FBBF24' : '#D97706'} />
                      <Text
                        style={{
                          fontFamily: 'Outfit_700Bold',
                          fontSize: 13,
                          color: isDark ? '#FBBF24' : '#D97706',
                        }}
                      >
                        {user.coins}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      {/* Sticky Bottom Bar: Current User Standing */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: cardBg,
          borderTopWidth: 1,
          borderTopColor: cardBorder,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 14),
          paddingHorizontal: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: isDark ? 0.35 : 0.08,
          shadowRadius: 10,
          elevation: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                borderWidth: 2,
                borderColor: '#38BDF8',
                backgroundColor: isDark ? '#27272A' : '#E5E7EB',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              <Ionicons name="person" size={24} color="#38BDF8" />
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: 'Poppins_700Bold',
                  fontSize: 14,
                  color: textPrimary,
                }}
                numberOfLines={1}
              >
                {userData?.displayName || 'You'}
              </Text>
              <Text
                style={{
                  fontFamily: 'Poppins_500Medium',
                  fontSize: 11.5,
                  color: '#38BDF8',
                }}
              >
                {userRank > 0 ? `Current Rank: #${userRank}` : 'Rank: Active Participant'}
              </Text>
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7',
              borderWidth: 1,
              borderColor: '#F59E0B',
              borderRadius: 16,
              paddingHorizontal: 12,
              paddingVertical: 6,
              gap: 5,
            }}
          >
            <Coins size={14} color={isDark ? '#FBBF24' : '#D97706'} />
            <Text
              style={{
                fontFamily: 'Outfit_800ExtraBold',
                fontSize: 15,
                color: isDark ? '#FBBF24' : '#D97706',
              }}
            >
              {currentUserCoins}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
