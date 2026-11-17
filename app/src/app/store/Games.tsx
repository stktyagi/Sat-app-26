import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeStore } from '@/state/themeStore';
import { useUserStore } from '@/state/userStore';
import { claimGameCoins } from '@/api/store';
import { showAlert } from '@/components';
import ZipGame from '@/components/games/ZipGame/ZipGame';
import PatchesGame from '@/components/games/PatchesGame/PatchesGame';
import { SAMPLE_LEVELS } from '@/components/games/ZipGame/SampleLevels';
import { SAMPLE_PATCHES_LEVELS } from '@/components/games/PatchesGame/SamplePatchesLevels';

// Daily Fest Quiz Questions
const QUIZ_QUESTIONS = [
  {
    question: "What is the official annual cultural and technical festival of Thapar Institute?",
    options: ["Saturnalia", "Urja", "Oasis", "Mood Indigo"],
    answerIndex: 0,
  },
  {
    question: "Where are the major evening concert events typically hosted at Saturnalia?",
    options: ["Open Air Theatre (OAT)", "Library", "Hostel PG", "COS Complex"],
    answerIndex: 0,
  },
  {
    question: "What can you redeem Saturnalia Coins for?",
    options: ["Exclusive Fest Merchandise & Perks", "Exam Marks", "Hostel Attendance", "Library Books"],
    answerIndex: 0,
  },
];

export default function GamesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const { userData, refreshUserProfile } = useUserStore();

  const [activeGame, setActiveGame] = useState<'zip' | 'patches' | 'quiz' | null>(null);
  const [claiming, setClaiming] = useState(false);

  // Quiz state
  const [quizStep, setQuizStep] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [quizFinished, setQuizFinished] = useState(false);

  // Determine today's level index based on day of year
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - startOfYear.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  const todayStr = now.toISOString().split('T')[0];

  const zipLevelIdx = dayOfYear % SAMPLE_LEVELS.length;
  const patchesLevelIdx = dayOfYear % SAMPLE_PATCHES_LEVELS.length;

  const userCoins = userData?.coins ?? 0;
  const dailyRewards = userData?.dailyGameRewards || {};

  const isZipClaimed = dailyRewards['zip'] === todayStr;
  const isPatchesClaimed = dailyRewards['patches'] === todayStr;
  const isQuizClaimed = dailyRewards['quiz'] === todayStr;

  const handleGameWon = async (game: 'zip' | 'patches') => {
    try {
      setClaiming(true);
      const res = await claimGameCoins(game);
      await refreshUserProfile();
      setActiveGame(null);

      if (res.alreadyClaimed) {
        showAlert('Great Job!', "You've already claimed today's 20 coins for this game. Come back tomorrow for the next level!");
      } else {
        showAlert('🎉 Level Complete!', `You earned +${res.awarded || 20} Saturnalia Coins! Your new balance: ${res.coins} Coins`);
      }
    } catch (err: any) {
      setActiveGame(null);
      showAlert('Great Job!', 'Game level completed! (Connect to internet to sync your coins if offline).');
    } finally {
      setClaiming(false);
    }
  };

  const handleSelectQuizOption = (optIdx: number) => {
    const updated = [...selectedAnswers];
    updated[quizStep] = optIdx;
    setSelectedAnswers(updated);
  };

  const handleNextQuizQuestion = async () => {
    if (quizStep < QUIZ_QUESTIONS.length - 1) {
      setQuizStep(quizStep + 1);
    } else {
      // Calculate score
      let correct = 0;
      QUIZ_QUESTIONS.forEach((q, i) => {
        if (selectedAnswers[i] === q.answerIndex) {
          correct++;
        }
      });

      setQuizFinished(true);

      if (correct >= 2) {
        try {
          setClaiming(true);
          const res = await claimGameCoins('quiz');
          await refreshUserProfile();
          if (res.alreadyClaimed) {
            showAlert('Quiz Completed!', `You got ${correct}/${QUIZ_QUESTIONS.length} correct! You had already claimed today's quiz coins.`);
          } else {
            showAlert('🎉 Congratulations!', `You scored ${correct}/${QUIZ_QUESTIONS.length} and earned +${res.awarded || 20} Saturnalia Coins! Total: ${res.coins}`);
          }
        } catch (e) {
          showAlert('Quiz Completed!', `You scored ${correct}/${QUIZ_QUESTIONS.length}!`);
        } finally {
          setClaiming(false);
          setActiveGame(null);
          setQuizStep(0);
          setSelectedAnswers([]);
          setQuizFinished(false);
        }
      } else {
        showAlert('Nice Try!', `You got ${correct}/${QUIZ_QUESTIONS.length} correct. Need at least 2/3 to claim coins. Try again!`, [
          {
            text: 'Try Again',
            onPress: () => {
              setQuizStep(0);
              setSelectedAnswers([]);
              setQuizFinished(false);
            },
          },
          {
            text: 'Exit',
            onPress: () => {
              setActiveGame(null);
              setQuizStep(0);
              setSelectedAnswers([]);
              setQuizFinished(false);
            },
          },
        ]);
      }
    }
  };

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
            Daily Games & Trivia
          </Text>
          <Text
            style={{
              fontFamily: 'Poppins_500Medium',
              fontSize: 11,
              color: isDark ? '#9CA3AF' : '#6B7280',
            }}
          >
            Play daily, earn SAT Coins
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
            {userCoins}
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Banner */}
        <View
          style={{
            backgroundColor: isDark ? '#1E1B4B' : '#EEF2FF',
            borderRadius: 18,
            padding: 16,
            borderWidth: 1,
            borderColor: isDark ? '#4338CA' : '#C7D2FE',
            marginBottom: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: '#6366F1',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="game-controller" size={24} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: 'Poppins_700Bold',
                fontSize: 14,
                color: isDark ? '#E0E7FF' : '#312E81',
              }}
            >
              1 Level Playable Per Day
            </Text>
            <Text
              style={{
                fontFamily: 'Poppins_400Regular',
                fontSize: 12,
                color: isDark ? '#C7D2FE' : '#4338CA',
                lineHeight: 17,
              }}
            >
              Solve today's puzzle levels to collect +20 coins per game! All calculation & balances are verified server-side.
            </Text>
          </View>
        </View>

        {/* Game 1: Zip Puzzle */}
        <View
          style={{
            backgroundColor: isDark ? '#1C1C20' : '#FFFFFF',
            borderRadius: 20,
            padding: 18,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
            marginBottom: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.2 : 0.04,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  backgroundColor: '#0284C7',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="git-commit-outline" size={26} color="#FFFFFF" />
              </View>
              <View>
                <Text
                  style={{
                    fontFamily: 'Poppins_700Bold',
                    fontSize: 16,
                    color: isDark ? '#FFFFFF' : '#111827',
                  }}
                >
                  Zip Challenge
                </Text>
                <Text
                  style={{
                    fontFamily: 'Poppins_500Medium',
                    fontSize: 12,
                    color: '#38BDF8',
                  }}
                >
                  Today's Level #{zipLevelIdx + 1}
                </Text>
              </View>
            </View>

            {/* Coins badge */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isDark ? '#262010' : '#FEF3C7',
                borderWidth: 1,
                borderColor: '#F59E0B',
                borderRadius: 12,
                paddingHorizontal: 8,
                paddingVertical: 3,
                gap: 3,
              }}
            >
              <Text style={{ fontSize: 11 }}>🪙</Text>
              <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 12, color: isDark ? '#FBBF24' : '#D97706' }}>
                +20
              </Text>
            </View>
          </View>

          <Text
            style={{
              fontFamily: 'Poppins_400Regular',
              fontSize: 12.5,
              color: isDark ? '#9CA3AF' : '#6B7280',
              lineHeight: 18,
              marginBottom: 14,
            }}
          >
            Trace a single continuous path passing through all cells and connecting the checkpoints in order.
          </Text>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setActiveGame('zip')}
            style={{
              backgroundColor: isZipClaimed ? (isDark ? '#27272A' : '#E5E7EB') : '#0284C7',
              borderRadius: 14,
              paddingVertical: 11,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 6,
            }}
          >
            <Ionicons
              name={isZipClaimed ? 'checkmark-circle' : 'play'}
              size={16}
              color={isZipClaimed ? (isDark ? '#9CA3AF' : '#6B7280') : '#FFFFFF'}
            />
            <Text
              style={{
                fontFamily: 'Poppins_600SemiBold',
                fontSize: 13,
                color: isZipClaimed ? (isDark ? '#9CA3AF' : '#6B7280') : '#FFFFFF',
              }}
            >
              {isZipClaimed ? "Completed Today (Replay)" : "Play Today's Level"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Game 2: Patches Puzzle */}
        <View
          style={{
            backgroundColor: isDark ? '#1C1C20' : '#FFFFFF',
            borderRadius: 20,
            padding: 18,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
            marginBottom: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.2 : 0.04,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  backgroundColor: '#7C3AED',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="grid-outline" size={24} color="#FFFFFF" />
              </View>
              <View>
                <Text
                  style={{
                    fontFamily: 'Poppins_700Bold',
                    fontSize: 16,
                    color: isDark ? '#FFFFFF' : '#111827',
                  }}
                >
                  Patches Puzzle
                </Text>
                <Text
                  style={{
                    fontFamily: 'Poppins_500Medium',
                    fontSize: 12,
                    color: '#A78BFA',
                  }}
                >
                  Today's Level #{patchesLevelIdx + 1}
                </Text>
              </View>
            </View>

            {/* Coins badge */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isDark ? '#262010' : '#FEF3C7',
                borderWidth: 1,
                borderColor: '#F59E0B',
                borderRadius: 12,
                paddingHorizontal: 8,
                paddingVertical: 3,
                gap: 3,
              }}
            >
              <Text style={{ fontSize: 11 }}>🪙</Text>
              <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 12, color: isDark ? '#FBBF24' : '#D97706' }}>
                +20
              </Text>
            </View>
          </View>

          <Text
            style={{
              fontFamily: 'Poppins_400Regular',
              fontSize: 12.5,
              color: isDark ? '#9CA3AF' : '#6B7280',
              lineHeight: 18,
              marginBottom: 14,
            }}
          >
            Draw geometric rectangular patches around each clue area to cover the entire puzzle grid.
          </Text>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setActiveGame('patches')}
            style={{
              backgroundColor: isPatchesClaimed ? (isDark ? '#27272A' : '#E5E7EB') : '#7C3AED',
              borderRadius: 14,
              paddingVertical: 11,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 6,
            }}
          >
            <Ionicons
              name={isPatchesClaimed ? 'checkmark-circle' : 'play'}
              size={16}
              color={isPatchesClaimed ? (isDark ? '#9CA3AF' : '#6B7280') : '#FFFFFF'}
            />
            <Text
              style={{
                fontFamily: 'Poppins_600SemiBold',
                fontSize: 13,
                color: isPatchesClaimed ? (isDark ? '#9CA3AF' : '#6B7280') : '#FFFFFF',
              }}
            >
              {isPatchesClaimed ? "Completed Today (Replay)" : "Play Today's Level"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Game 3: Daily Quiz */}
        <View
          style={{
            backgroundColor: isDark ? '#1C1C20' : '#FFFFFF',
            borderRadius: 20,
            padding: 18,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
            marginBottom: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.2 : 0.04,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  backgroundColor: '#D97706',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="help-circle-outline" size={28} color="#FFFFFF" />
              </View>
              <View>
                <Text
                  style={{
                    fontFamily: 'Poppins_700Bold',
                    fontSize: 16,
                    color: isDark ? '#FFFFFF' : '#111827',
                  }}
                >
                  Saturnalia Daily Quiz
                </Text>
                <Text
                  style={{
                    fontFamily: 'Poppins_500Medium',
                    fontSize: 12,
                    color: '#FBBF24',
                  }}
                >
                  3 Quick Trivia Questions
                </Text>
              </View>
            </View>

            {/* Coins badge */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isDark ? '#262010' : '#FEF3C7',
                borderWidth: 1,
                borderColor: '#F59E0B',
                borderRadius: 12,
                paddingHorizontal: 8,
                paddingVertical: 3,
                gap: 3,
              }}
            >
              <Text style={{ fontSize: 11 }}>🪙</Text>
              <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 12, color: isDark ? '#FBBF24' : '#D97706' }}>
                +20
              </Text>
            </View>
          </View>

          <Text
            style={{
              fontFamily: 'Poppins_400Regular',
              fontSize: 12.5,
              color: isDark ? '#9CA3AF' : '#6B7280',
              lineHeight: 18,
              marginBottom: 14,
            }}
          >
            Answer trivia about the fest and events to claim today's 20 Saturnalia Coins!
          </Text>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              setQuizStep(0);
              setSelectedAnswers([]);
              setQuizFinished(false);
              setActiveGame('quiz');
            }}
            style={{
              backgroundColor: isQuizClaimed ? (isDark ? '#27272A' : '#E5E7EB') : '#D97706',
              borderRadius: 14,
              paddingVertical: 11,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 6,
            }}
          >
            <Ionicons
              name={isQuizClaimed ? 'checkmark-circle' : 'play'}
              size={16}
              color={isQuizClaimed ? (isDark ? '#9CA3AF' : '#6B7280') : '#FFFFFF'}
            />
            <Text
              style={{
                fontFamily: 'Poppins_600SemiBold',
                fontSize: 13,
                color: isQuizClaimed ? (isDark ? '#9CA3AF' : '#6B7280') : '#FFFFFF',
              }}
            >
              {isQuizClaimed ? "Completed Today (Replay)" : "Take Today's Quiz"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Zip Game Modal */}
      <Modal visible={activeGame === 'zip'} animationType="slide">
        <View style={{ flex: 1, backgroundColor: isDark ? '#0F172A' : '#EFF6FF' }}>
          <ZipGame
            initialLevelIndex={zipLevelIdx}
            rewardClaimed={isZipClaimed}
            onComplete={() => handleGameWon('zip')}
            onBack={() => setActiveGame(null)}
          />
        </View>
      </Modal>

      {/* Patches Game Modal */}
      <Modal visible={activeGame === 'patches'} animationType="slide">
        <View style={{ flex: 1, backgroundColor: isDark ? '#0F172A' : '#EFF6FF' }}>
          <PatchesGame
            initialLevelIndex={patchesLevelIdx}
            rewardClaimed={isPatchesClaimed}
            onComplete={() => handleGameWon('patches')}
            onBack={() => setActiveGame(null)}
          />
        </View>
      </Modal>

      {/* Quiz Modal */}
      <Modal visible={activeGame === 'quiz'} animationType="slide">
        <View style={{ flex: 1, backgroundColor: isDark ? '#131316' : '#F3F4F6' }}>
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
            <TouchableOpacity onPress={() => setActiveGame(null)} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color={isDark ? '#FFFFFF' : '#111827'} />
            </TouchableOpacity>
            <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 17, color: isDark ? '#FFFFFF' : '#111827' }}>
              Daily Fest Quiz ({quizStep + 1}/{QUIZ_QUESTIONS.length})
            </Text>
            <View style={{ width: 32 }} />
          </View>

          <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
            <View
              style={{
                backgroundColor: isDark ? '#1C1C20' : '#FFFFFF',
                borderRadius: 22,
                padding: 22,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
              }}
            >
              <Text
                style={{
                  fontFamily: 'Poppins_700Bold',
                  fontSize: 18,
                  color: isDark ? '#FFFFFF' : '#111827',
                  marginBottom: 20,
                  lineHeight: 25,
                }}
              >
                {QUIZ_QUESTIONS[quizStep].question}
              </Text>

              <View style={{ gap: 12, marginBottom: 24 }}>
                {QUIZ_QUESTIONS[quizStep].options.map((opt, idx) => {
                  const isSelected = selectedAnswers[quizStep] === idx;
                  return (
                    <TouchableOpacity
                      key={idx}
                      activeOpacity={0.8}
                      onPress={() => handleSelectQuizOption(idx)}
                      style={{
                        paddingVertical: 14,
                        paddingHorizontal: 16,
                        borderRadius: 14,
                        borderWidth: 1.5,
                        borderColor: isSelected ? '#38BDF8' : (isDark ? 'rgba(255, 255, 255, 0.12)' : '#D1D5DB'),
                        backgroundColor: isSelected ? (isDark ? '#0C4A6E' : '#E0F2FE') : (isDark ? '#27272A' : '#F9FAFB'),
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: isSelected ? 'Poppins_600SemiBold' : 'Poppins_400Regular',
                          fontSize: 14,
                          color: isSelected ? '#38BDF8' : (isDark ? '#FFFFFF' : '#111827'),
                        }}
                      >
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                disabled={selectedAnswers[quizStep] === undefined || claiming}
                activeOpacity={0.85}
                onPress={handleNextQuizQuestion}
                style={{
                  backgroundColor: selectedAnswers[quizStep] === undefined ? '#6B7280' : '#38BDF8',
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {claiming ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 15, color: '#000000' }}>
                    {quizStep < QUIZ_QUESTIONS.length - 1 ? 'Next Question' : 'Submit & Claim Coins'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
