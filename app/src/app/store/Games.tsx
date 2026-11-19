import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '@/state/themeStore';
import { useUserStore } from '@/state/userStore';
import { claimGameCoins } from '@/api/store';
import { showAlert } from '@/components';
import WordleGame from '@/components/games/WordleGame/WordleGame';
import {
  ArrowLeft,
  Coins,
  Sparkles,
  Trophy,
  Zap,
  ChevronRight,
  Lightbulb,
  CheckCircle2,
} from 'lucide-react-native';

export default function GamesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const { userData, refreshUserProfile } = useUserStore();

  const [screen, setScreen] = useState<'menu' | 'daily' | 'sat_wordle'>('menu');
  const [localClaimed, setLocalClaimed] = useState<boolean>(false);

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const storageKey = `@wordle_daily_claimed_${userData?.userId || 'guest'}_${todayStr}`;

  useEffect(() => {
    AsyncStorage.getItem(storageKey).then((val) => {
      if (val === 'true') {
        setLocalClaimed(true);
      }
    }).catch(() => {});
  }, [storageKey]);

  const userCoins = userData?.coins ?? 0;
  const dailyRewards = userData?.dailyGameRewards || {};
  const isWordleClaimed = localClaimed || dailyRewards['wordle'] === todayStr;

  const handleClaimWordleReward = async () => {
    setLocalClaimed(true);
    await AsyncStorage.setItem(storageKey, 'true').catch(() => {});
    try {
      const res = await claimGameCoins('wordle');
      await refreshUserProfile();
      if (res.alreadyClaimed) {
        showAlert('Nice Work!', "You've already claimed today's daily reward. Come back tomorrow for the next puzzle!");
      } else {
        const rewardMsg = res.awarded && res.awarded > 0
          ? `You earned +${res.awarded} Saturnalia Coins! Total balance: ${res.coins} Coins`
          : (res.message || `You solved today's Wordle puzzle! Total balance: ${res.coins} Coins`);
        showAlert('🎉 Wordle Solved!', rewardMsg);
      }
    } catch (err: any) {
      // Offline fallback
    }
  };

  const bg = isDark ? '#0D0E12' : '#F9FAFB';
  const cardBg = isDark ? '#181920' : '#FFFFFF';
  const border = isDark ? '#272935' : '#E5E7EB';
  const textPrimary = isDark ? '#FFFFFF' : '#111827';
  const textSecondary = isDark ? '#9CA3AF' : '#6B7280';

  if (screen === 'daily') {
    return (
      <View style={{ flex: 1, backgroundColor: bg }}>
        <WordleGame
          key="daily"
          mode="daily"
          userId={userData?.userId || 'guest'}
          isDailyClaimed={isWordleClaimed}
          onClaimDailyReward={handleClaimWordleReward}
          onBack={() => setScreen('menu')}
          onGoToPractice={() => setScreen('sat_wordle')}
          userCoins={userCoins}
        />
      </View>
    );
  }

  if (screen === 'sat_wordle') {
    return (
      <View style={{ flex: 1, backgroundColor: bg }}>
        <WordleGame
          key="sat_wordle"
          mode="practice"
          userId={userData?.userId || 'guest'}
          onBack={() => setScreen('menu')}
          userCoins={userCoins}
        />
      </View>
    );
  }

  // Screen === 'menu'
  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header Bar */}
      <View style={[styles.header, { borderBottomColor: border, paddingTop: Math.max(insets.top, 14) }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={textPrimary} />
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <Text style={[styles.headerTitle, { color: textPrimary }]}>SATURNALIA WORDLE</Text>
        </View>

        <View style={styles.coinHeaderBadge}>
          <Coins size={14} color="#FBBF24" />
          <Text style={styles.coinHeaderText}>{userCoins}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero Card */}
        <View style={[styles.heroCard, { backgroundColor: cardBg, borderColor: border }]}>
          
          <Text style={[styles.heroTitle, { color: textPrimary }]}>Guess the Word</Text>
          <Text style={[styles.heroSubtitle, { color: textSecondary }]}>
            Crack the 5-letter hidden word in 6 attempts! Choose how you want to play:
          </Text>
        </View>

        {/* Section Heading */}
        <Text style={[styles.sectionHeading, { color: textSecondary }]}>SELECT GAME MODE</Text>

        {/* Button 1: Daily Challenge */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setScreen('daily')}
          style={[
            styles.modeCard,
            {
              backgroundColor: cardBg,
              borderColor: isDark ? (isWordleClaimed ? '#065F46' : '#4338CA') : (isWordleClaimed ? '#A7F3D0' : '#C7D2FE'),
            },
          ]}
        >
          <View
            style={[
              styles.modeIconCircle,
              {
                backgroundColor: isWordleClaimed
                  ? (isDark ? 'rgba(34, 197, 94, 0.15)' : '#DCFCE7')
                  : (isDark ? 'rgba(99, 102, 241, 0.18)' : '#EEF2FF'),
              },
            ]}
          >
            {isWordleClaimed ? (
              <CheckCircle2 size={26} color="#22C55E" />
            ) : (
              <Trophy size={26} color="#6366F1" />
            )}
          </View>

          <View style={styles.modeTextContainer}>
            <View style={styles.modeHeaderRow}>
              <Text style={[styles.modeTitle, { color: textPrimary }]}>Daily Challenge</Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: isWordleClaimed
                      ? (isDark ? 'rgba(34, 197, 94, 0.15)' : '#DCFCE7')
                      : (isDark ? 'rgba(99, 102, 241, 0.18)' : '#EEF2FF'),
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    { color: isWordleClaimed ? '#22C55E' : '#6366F1' },
                  ]}
                >
                  {isWordleClaimed ? 'Completed ✓' : 'Daily Puzzle'}
                </Text>
              </View>
            </View>
            <Text style={[styles.modeDescription, { color: textSecondary }]}>
              {isWordleClaimed
                ? "You've solved today's puzzle! Resets tomorrow at midnight."
                : "One puzzle per user per day. Solve it to earn daily fest coins!"}
            </Text>
          </View>

          <ChevronRight size={20} color={textSecondary} />
        </TouchableOpacity>

        {/* Button 2: The Sat Wordle */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setScreen('sat_wordle')}
          style={[
            styles.modeCard,
            {
              backgroundColor: cardBg,
              borderColor: isDark ? '#065F46' : '#A7F3D0',
              marginTop: 14,
            },
          ]}
        >
          <View
            style={[
              styles.modeIconCircle,
              { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.18)' : '#D1FAE5' },
            ]}
          >
            <Zap size={26} color="#10B981" />
          </View>

          <View style={styles.modeTextContainer}>
            <View style={styles.modeHeaderRow}>
              <Text style={[styles.modeTitle, { color: textPrimary }]}>The Sat Wordle</Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.18)' : '#D1FAE5' },
                ]}
              >
                <Text style={[styles.statusBadgeText, { color: '#10B981' }]}>
                  Offline Mode
                </Text>
              </View>
            </View>
            <Text style={[styles.modeDescription, { color: textSecondary }]}>
              Unlimited offline play anytime. Reveals special clues & fest event spotlights!
            </Text>
          </View>

          <ChevronRight size={20} color={textSecondary} />
        </TouchableOpacity>

        {/* Info Card Below Buttons */}
        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: isDark ? 'rgba(245, 158, 11, 0.08)' : '#FFFBEB',
              borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : '#FDE68A',
            },
          ]}
        >
          <View style={styles.infoHeader}>
            <Lightbulb size={20} color="#F59E0B" />
            <Text style={[styles.infoTitle, { color: isDark ? '#FBBF24' : '#B45309' }]}>
              Fest Secret 💡
            </Text>
          </View>
          <Text style={[styles.infoBody, { color: isDark ? '#E5E7EB' : '#78350F' }]}>
            There are words related to Saturnalia, campus spots, and fest events scattered throughout the game too — so good luck finding them!
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 16,
    letterSpacing: 1.5,
  },
  coinHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  coinHeaderText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 13,
    color: '#F59E0B',
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 40,
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
    marginBottom: 10,
  },
  heroBadgeText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 11,
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 22,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 19,
  },
  sectionHeading: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  modeIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  modeTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  modeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modeTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 10,
  },
  modeDescription: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 17,
  },
  infoCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginTop: 26,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  infoTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
  },
  infoBody: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12.5,
    lineHeight: 18,
  },
});
