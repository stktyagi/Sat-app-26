import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#131316' : '#F3F4F6' }}>
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

        <View style={{ alignItems: 'center' }}>
          <Text
            style={{
              fontFamily: 'Poppins_700Bold',
              fontSize: 18,
              color: isDark ? '#FFFFFF' : '#111827',
            }}
          >
            Leaderboard
          </Text>
          <Text
            style={{
              fontFamily: 'Poppins_500Medium',
              fontSize: 11,
              color: isDark ? '#9CA3AF' : '#6B7280',
            }}
          >
            Saturnalia Coin Rankings
          </Text>
        </View>

        {/* Coins indicator */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: isDark ? '#262010' : '#FEF3C7',
            borderWidth: 1,
            borderColor: '#F59E0B',
            borderRadius: 16,
            paddingHorizontal: 8,
            paddingVertical: 4,
            gap: 4,
          }}
        >
          <Text style={{ fontSize: 12 }}>🪙</Text>
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
              color: isDark ? '#9CA3AF' : '#6B7280',
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
          {/* Top 3 Podium Section */}
          <View
            style={{
              paddingTop: 24,
              paddingBottom: 28,
              paddingHorizontal: 16,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                justifyContent: 'center',
                width: '100%',
                gap: 12,
              }}
            >
              {/* Rank 2 (Left) */}
              <View style={{ flex: 1, alignItems: 'center' }}>
                {top2 ? (
                  <>
                    <View style={{ position: 'relative', marginBottom: 8 }}>
                      <View
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 32,
                          borderWidth: 3,
                          borderColor: '#94A3B8',
                          backgroundColor: isDark ? '#1F2937' : '#E2E8F0',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        {top2.photoUrl ? (
                          <Image source={{ uri: top2.photoUrl }} style={{ width: '100%', height: '100%' }} />
                        ) : (
                          <Ionicons name="person" size={28} color="#94A3B8" />
                        )}
                      </View>
                      <View
                        style={{
                          position: 'absolute',
                          bottom: -6,
                          alignSelf: 'center',
                          backgroundColor: '#64748B',
                          borderRadius: 10,
                          paddingHorizontal: 6,
                          paddingVertical: 1,
                        }}
                      >
                        <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 10, color: '#FFFFFF' }}>#2</Text>
                      </View>
                    </View>

                    <Text
                      style={{
                        fontFamily: 'Poppins_600SemiBold',
                        fontSize: 13,
                        color: isDark ? '#FFFFFF' : '#111827',
                        textAlign: 'center',
                      }}
                      numberOfLines={1}
                    >
                      {top2.displayName}
                    </Text>
                    <Text
                      style={{
                        fontFamily: 'Poppins_400Regular',
                        fontSize: 10,
                        color: isDark ? '#9CA3AF' : '#6B7280',
                        textAlign: 'center',
                        marginBottom: 4,
                      }}
                      numberOfLines={1}
                    >
                      {top2.collegeName}
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
                        borderRadius: 12,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        gap: 3,
                      }}
                    >
                      <Text style={{ fontSize: 10 }}>🪙</Text>
                      <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 12, color: isDark ? '#E2E8F0' : '#334155' }}>
                        {top2.coins}
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={{ height: 100 }} />
                )}
              </View>

              {/* Rank 1 (Center - Elevated) */}
              <View style={{ flex: 1.15, alignItems: 'center', marginBottom: 12 }}>
                {top1 ? (
                  <>
                    <Text style={{ fontSize: 24, marginBottom: 2 }}>👑</Text>
                    <View style={{ position: 'relative', marginBottom: 8 }}>
                      <View
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: 40,
                          borderWidth: 3.5,
                          borderColor: '#F59E0B',
                          backgroundColor: isDark ? '#262010' : '#FEF3C7',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          shadowColor: '#F59E0B',
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.4,
                          shadowRadius: 8,
                          elevation: 6,
                        }}
                      >
                        {top1.photoUrl ? (
                          <Image source={{ uri: top1.photoUrl }} style={{ width: '100%', height: '100%' }} />
                        ) : (
                          <Ionicons name="person" size={36} color="#F59E0B" />
                        )}
                      </View>
                      <View
                        style={{
                          position: 'absolute',
                          bottom: -7,
                          alignSelf: 'center',
                          backgroundColor: '#F59E0B',
                          borderRadius: 10,
                          paddingHorizontal: 8,
                          paddingVertical: 1,
                        }}
                      >
                        <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 11, color: '#000000' }}>#1</Text>
                      </View>
                    </View>

                    <Text
                      style={{
                        fontFamily: 'Poppins_700Bold',
                        fontSize: 14.5,
                        color: isDark ? '#FFFFFF' : '#111827',
                        textAlign: 'center',
                      }}
                      numberOfLines={1}
                    >
                      {top1.displayName}
                    </Text>
                    <Text
                      style={{
                        fontFamily: 'Poppins_400Regular',
                        fontSize: 11,
                        color: isDark ? '#FBBF24' : '#B45309',
                        textAlign: 'center',
                        marginBottom: 4,
                      }}
                      numberOfLines={1}
                    >
                      {top1.collegeName}
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: isDark ? '#262010' : '#FEF3C7',
                        borderWidth: 1,
                        borderColor: '#F59E0B',
                        borderRadius: 14,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        gap: 4,
                      }}
                    >
                      <Text style={{ fontSize: 11 }}>🪙</Text>
                      <Text style={{ fontFamily: 'Outfit_800ExtraBold', fontSize: 13, color: isDark ? '#FBBF24' : '#B45309' }}>
                        {top1.coins}
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={{ height: 130 }} />
                )}
              </View>

              {/* Rank 3 (Right) */}
              <View style={{ flex: 1, alignItems: 'center' }}>
                {top3 ? (
                  <>
                    <View style={{ position: 'relative', marginBottom: 8 }}>
                      <View
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 32,
                          borderWidth: 3,
                          borderColor: '#D97706',
                          backgroundColor: isDark ? '#261C12' : '#FFEDD5',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        {top3.photoUrl ? (
                          <Image source={{ uri: top3.photoUrl }} style={{ width: '100%', height: '100%' }} />
                        ) : (
                          <Ionicons name="person" size={28} color="#D97706" />
                        )}
                      </View>
                      <View
                        style={{
                          position: 'absolute',
                          bottom: -6,
                          alignSelf: 'center',
                          backgroundColor: '#B45309',
                          borderRadius: 10,
                          paddingHorizontal: 6,
                          paddingVertical: 1,
                        }}
                      >
                        <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 10, color: '#FFFFFF' }}>#3</Text>
                      </View>
                    </View>

                    <Text
                      style={{
                        fontFamily: 'Poppins_600SemiBold',
                        fontSize: 13,
                        color: isDark ? '#FFFFFF' : '#111827',
                        textAlign: 'center',
                      }}
                      numberOfLines={1}
                    >
                      {top3.displayName}
                    </Text>
                    <Text
                      style={{
                        fontFamily: 'Poppins_400Regular',
                        fontSize: 10,
                        color: isDark ? '#9CA3AF' : '#6B7280',
                        textAlign: 'center',
                        marginBottom: 4,
                      }}
                      numberOfLines={1}
                    >
                      {top3.collegeName}
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: isDark ? '#2A1F17' : '#FED7AA',
                        borderRadius: 12,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        gap: 3,
                      }}
                    >
                      <Text style={{ fontSize: 10 }}>🪙</Text>
                      <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 12, color: isDark ? '#FDBA74' : '#9A3412' }}>
                        {top3.coins}
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={{ height: 100 }} />
                )}
              </View>
            </View>
          </View>

          {/* Leaderboard Table Header */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingBottom: 8,
              borderBottomWidth: 1,
              borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
            }}
          >
            <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 12, color: isDark ? '#9CA3AF' : '#6B7280' }}>
              RANK & USER
            </Text>
            <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 12, color: isDark ? '#9CA3AF' : '#6B7280' }}>
              COINS
            </Text>
          </View>

          {/* Ranks 4+ List */}
          <View style={{ paddingHorizontal: 16, paddingTop: 10, gap: 8 }}>
            {remaining.map((user) => (
              <View
                key={user.userId || `user-${user.rank}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isDark ? '#1C1C20' : '#FFFFFF',
                  borderRadius: 16,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                }}
              >
                {/* Rank Number */}
                <View style={{ width: 28, alignItems: 'center' }}>
                  <Text
                    style={{
                      fontFamily: 'Outfit_700Bold',
                      fontSize: 14,
                      color: isDark ? '#9CA3AF' : '#6B7280',
                    }}
                  >
                    #{user.rank}
                  </Text>
                </View>

                {/* Avatar */}
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: isDark ? '#27272A' : '#F3F4F6',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginHorizontal: 10,
                    overflow: 'hidden',
                  }}
                >
                  {user.photoUrl ? (
                    <Image source={{ uri: user.photoUrl }} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <Ionicons name="person" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  )}
                </View>

                {/* Name & College */}
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: 'Poppins_600SemiBold',
                      fontSize: 13.5,
                      color: isDark ? '#FFFFFF' : '#111827',
                    }}
                    numberOfLines={1}
                  >
                    {user.displayName}
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'Poppins_400Regular',
                      fontSize: 11,
                      color: isDark ? '#9CA3AF' : '#6B7280',
                    }}
                    numberOfLines={1}
                  >
                    {user.collegeName}
                  </Text>
                </View>

                {/* Coins Badge */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isDark ? '#262010' : '#FEF3C7',
                    borderRadius: 12,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    gap: 3,
                  }}
                >
                  <Text style={{ fontSize: 11 }}>🪙</Text>
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
            ))}
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
          backgroundColor: isDark ? '#1C1C20' : '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
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
              {userData?.photoUrl || userData?.photoURL ? (
                <Image source={{ uri: userData.photoUrl || userData.photoURL }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Ionicons name="person" size={24} color="#38BDF8" />
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: 'Poppins_700Bold',
                  fontSize: 14,
                  color: isDark ? '#FFFFFF' : '#111827',
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
              backgroundColor: isDark ? '#262010' : '#FEF3C7',
              borderWidth: 1,
              borderColor: '#F59E0B',
              borderRadius: 16,
              paddingHorizontal: 12,
              paddingVertical: 6,
              gap: 5,
            }}
          >
            <Text style={{ fontSize: 14 }}>🪙</Text>
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
