import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Modal,
  ScrollView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '@/state/themeStore';
import { WORDLE_TARGETS, VALID_GUESS_WORDS, DEFAULT_WORD_MESSAGE, WordleWordEntry } from '@/data/wordleWords';
import { Coins, Sparkles, RefreshCw, Trophy, ArrowLeft, Zap, CheckCircle2 } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface WordleGameProps {
  mode: 'daily' | 'practice';
  userId?: string;
  isDailyClaimed?: boolean;
  onClaimDailyReward?: () => Promise<void>;
  onBack?: () => void;
  onGoToPractice?: () => void;
  userCoins?: number;
}

type LetterStatus = 'correct' | 'present' | 'absent' | 'empty';

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACKSPACE'],
];

/**
 * Deterministic hash function to pick a unique word per user per day.
 */
function getDailyWordIndex(userId: string, dateStr: string, totalWords: number): number {
  const seed = `${userId || 'guest'}_${dateStr}_saturnalia_wordle`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % totalWords;
}

/**
 * Pick a random word for offline practice, strictly excluding today's daily word.
 */
function getRandomPracticeWord(dailyWord: string, currentPracticeWord?: string): WordleWordEntry {
  const normDaily = dailyWord.trim().toUpperCase();
  const normCurrent = currentPracticeWord?.trim().toUpperCase();
  const pool = WORDLE_TARGETS.filter((e) => {
    const w = e.word.trim().toUpperCase();
    return w !== normDaily && (!normCurrent || w !== normCurrent);
  });
  if (pool.length === 0) {
    const fallback = WORDLE_TARGETS.filter((e) => e.word.trim().toUpperCase() !== normDaily);
    return fallback[0] || WORDLE_TARGETS[0];
  }
  const randIdx = Math.floor(Math.random() * pool.length);
  return pool[randIdx];
}

export default function WordleGame({
  mode,
  userId = 'anonymous',
  isDailyClaimed = false,
  onClaimDailyReward,
  onBack,
  onGoToPractice,
  userCoins = 0,
}: WordleGameProps) {
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const dailyStorageKey = `@wordle_progress_daily_${userId}_${todayStr}`;
  const practiceStorageKey = `@wordle_progress_practice_${userId}`;

  // Targets set for valid word checking
  const validGuessSet = useMemo(() => {
    const s = new Set<string>();
    WORDLE_TARGETS.forEach((t) => s.add(t.word.toUpperCase()));
    VALID_GUESS_WORDS.forEach((w) => s.add(w.toUpperCase()));
    return s;
  }, []);

  const dailyWord = useMemo(() => {
    const idx = getDailyWordIndex(userId, todayStr, WORDLE_TARGETS.length);
    return WORDLE_TARGETS[idx].word.trim().toUpperCase();
  }, [userId, todayStr]);

  // Current Target Word & Message
  const [targetEntry, setTargetEntry] = useState<WordleWordEntry>(() => {
    if (mode === 'daily') {
      const idx = getDailyWordIndex(userId, todayStr, WORDLE_TARGETS.length);
      return WORDLE_TARGETS[idx];
    }
    return getRandomPracticeWord(dailyWord);
  });

  const [guesses, setGuesses] = useState<string[]>([]);
  const [currentGuess, setCurrentGuess] = useState<string>('');
  const [gameStatus, setGameStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showResultModal, setShowResultModal] = useState<boolean>(false);
  const [claimingCoins, setClaimingCoins] = useState<boolean>(false);
  const [coinsClaimedSuccess, setCoinsClaimedSuccess] = useState<boolean>(isDailyClaimed);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  const isDailyDone = mode === 'daily' && (isDailyClaimed || coinsClaimedSuccess);

  useEffect(() => {
    if (isDailyClaimed) {
      setCoinsClaimedSuccess(true);
    }
  }, [isDailyClaimed]);

  // Shake animation for invalid words
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Persist progress helper
  const persistProgress = (
    newGuesses: string[],
    status: 'playing' | 'won' | 'lost',
    target: WordleWordEntry,
    coinsClaimed?: boolean
  ) => {
    if (mode === 'daily') {
      AsyncStorage.setItem(
        dailyStorageKey,
        JSON.stringify({
          guesses: newGuesses,
          gameStatus: status,
          targetWord: target.word,
          coinsClaimed: coinsClaimed ?? (coinsClaimedSuccess || status === 'won'),
          savedAt: Date.now(),
        })
      ).catch(() => {});
    } else {
      if (status === 'playing' && newGuesses.length > 0) {
        AsyncStorage.setItem(
          practiceStorageKey,
          JSON.stringify({
            targetEntry: target,
            guesses: newGuesses,
            gameStatus: status,
            savedAt: Date.now(),
          })
        ).catch(() => {});
      } else {
        AsyncStorage.removeItem(practiceStorageKey).catch(() => {});
      }
    }
  };

  // Restore progress from local storage on mount / mode switch
  useEffect(() => {
    let cancelled = false;

    const restoreProgress = async () => {
      try {
        if (mode === 'daily') {
          const idx = getDailyWordIndex(userId, todayStr, WORDLE_TARGETS.length);
          const dailyEntry = WORDLE_TARGETS[idx];
          setTargetEntry(dailyEntry);

          if (isDailyClaimed) {
            setGuesses([dailyEntry.word]);
            setCurrentGuess('');
            setGameStatus('won');
            setCoinsClaimedSuccess(true);
            setShowResultModal(false);
            setIsLoaded(true);
            return;
          }

          const raw = await AsyncStorage.getItem(dailyStorageKey);
          if (cancelled) return;

          if (raw) {
            const data = JSON.parse(raw);
            if (data && Array.isArray(data.guesses)) {
              setGuesses(data.guesses);
              setCurrentGuess('');
              setGameStatus(data.gameStatus || 'playing');
              if (data.coinsClaimed || isDailyClaimed) {
                setCoinsClaimedSuccess(true);
              }
              setShowResultModal(false);
              setIsLoaded(true);
              return;
            }
          }

          // Fresh daily game
          setGuesses([]);
          setCurrentGuess('');
          setGameStatus('playing');
          setShowResultModal(false);
          setIsLoaded(true);
        } else {
          // Practice mode
          const raw = await AsyncStorage.getItem(practiceStorageKey);
          if (cancelled) return;

          if (raw) {
            const data = JSON.parse(raw);
            if (
              data &&
              data.targetEntry &&
              data.targetEntry.word.trim().toUpperCase() !== dailyWord &&
              Array.isArray(data.guesses) &&
              data.gameStatus === 'playing'
            ) {
              setTargetEntry(data.targetEntry);
              setGuesses(data.guesses);
              setCurrentGuess('');
              setGameStatus('playing');
              setShowResultModal(false);
              setIsLoaded(true);
              return;
            }
          }

          // Fresh practice word
          const entry = getRandomPracticeWord(dailyWord);
          setTargetEntry(entry);
          setGuesses([]);
          setCurrentGuess('');
          setGameStatus('playing');
          setShowResultModal(false);
          setIsLoaded(true);
        }
      } catch {
        setIsLoaded(true);
      }
    };

    restoreProgress();
    return () => {
      cancelled = true;
    };
  }, [mode, userId, todayStr, isDailyClaimed, dailyWord]);

  const startNewGame = () => {
    let entry: WordleWordEntry;
    if (mode === 'daily') {
      const idx = getDailyWordIndex(userId, todayStr, WORDLE_TARGETS.length);
      entry = WORDLE_TARGETS[idx];
      setCoinsClaimedSuccess(isDailyClaimed);
      if (isDailyClaimed || coinsClaimedSuccess) {
        setTargetEntry(entry);
        setGuesses([entry.word]);
        setCurrentGuess('');
        setGameStatus('won');
        setShowResultModal(false);
        return;
      }
    } else {
      AsyncStorage.removeItem(practiceStorageKey).catch(() => {});
      entry = getRandomPracticeWord(dailyWord, targetEntry.word);
    }
    setTargetEntry(entry);
    setGuesses([]);
    setCurrentGuess('');
    setGameStatus('playing');
    setShowResultModal(false);
  };

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2000);
  };

  // Evaluate guess letters against target word (Wordle scoring)
  const evaluateGuess = (guess: string, target: string): LetterStatus[] => {
    const res: LetterStatus[] = Array(5).fill('absent');
    const targetArr = target.split('');
    const guessArr = guess.split('');

    // Mark exact matches ('correct' - Green)
    guessArr.forEach((char, i) => {
      if (char === targetArr[i]) {
        res[i] = 'correct';
        targetArr[i] = '';
      }
    });

    // Mark present matches ('present' - Yellow)
    guessArr.forEach((char, i) => {
      if (res[i] !== 'correct') {
        const foundIdx = targetArr.indexOf(char);
        if (foundIdx !== -1) {
          res[i] = 'present';
          targetArr[foundIdx] = '';
        }
      }
    });

    return res;
  };

  // Compute keyboard letter colors
  const keyStatuses = useMemo(() => {
    const map: Record<string, LetterStatus> = {};
    guesses.forEach((guess) => {
      const evaluation = evaluateGuess(guess, targetEntry.word);
      guess.split('').forEach((char, i) => {
        const current = map[char];
        const next = evaluation[i];
        if (next === 'correct') {
          map[char] = 'correct';
        } else if (next === 'present' && current !== 'correct') {
          map[char] = 'present';
        } else if (next === 'absent' && !current) {
          map[char] = 'absent';
        }
      });
    });
    return map;
  }, [guesses, targetEntry.word]);

  const handleKeyPress = (key: string) => {
    if (isDailyDone && gameStatus !== 'won') {
      showToast("Today's Daily Challenge already completed!");
      return;
    }
    if (gameStatus !== 'playing') return;

    if (key === 'BACKSPACE') {
      setCurrentGuess((prev) => prev.slice(0, -1));
      return;
    }

    if (key === 'ENTER') {
      if (currentGuess.length < 5) {
        showToast('Not enough letters');
        triggerShake();
        return;
      }

      const upperGuess = currentGuess.toUpperCase();
      if (!validGuessSet.has(upperGuess)) {
        showToast('Not in word list');
        triggerShake();
        return;
      }

      const newGuesses = [...guesses, upperGuess];
      setGuesses(newGuesses);
      setCurrentGuess('');

      if (upperGuess === targetEntry.word) {
        // Player won!
        setGameStatus('won');
        persistProgress(newGuesses, 'won', targetEntry, true);
        setTimeout(() => {
          handleGameEnd(true);
        }, 700);
      } else if (newGuesses.length >= 6) {
        // Player lost
        setGameStatus('lost');
        persistProgress(newGuesses, 'lost', targetEntry, false);
        setTimeout(() => {
          handleGameEnd(false);
        }, 700);
      } else {
        persistProgress(newGuesses, 'playing', targetEntry, false);
      }
      return;
    }

    if (currentGuess.length < 5) {
      setCurrentGuess((prev) => (prev + key).toUpperCase());
    }
  };

  const handleGameEnd = async (won: boolean) => {
    setShowResultModal(true);
    if (won && mode === 'daily' && !coinsClaimedSuccess && onClaimDailyReward) {
      try {
        setClaimingCoins(true);
        await onClaimDailyReward();
        setCoinsClaimedSuccess(true);
        persistProgress(guesses, 'won', targetEntry, true);
      } catch (e) {
        // offline fallback handled by caller
      } finally {
        setClaimingCoins(false);
      }
    }
  };

  // Color constants
  const bg = isDark ? '#0D0E12' : '#F9FAFB';
  const cardBg = isDark ? '#181920' : '#FFFFFF';
  const border = isDark ? '#2D2F39' : '#E5E7EB';
  const textPrimary = isDark ? '#FFFFFF' : '#111827';
  const textSecondary = isDark ? '#9CA3AF' : '#6B7280';

  const correctColor = '#22C55E';
  const presentColor = '#EAB308';
  const absentColor = isDark ? '#374151' : '#9CA3AF';
  const emptyTileBorder = isDark ? '#374151' : '#D1D5DB';

  // Responsive tile size calculation
  const availableGridWidth = SCREEN_WIDTH - 48;
  const tileSize = Math.min(Math.floor(availableGridWidth / 5), 58);

  if (!isLoaded) {
    return (
      <View style={[styles.container, { backgroundColor: bg, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header Bar */}
      <View style={[styles.header, { borderBottomColor: border, paddingTop: Math.max(insets.top, 14) }]}>
        <TouchableOpacity
          onPress={onBack}
          style={[styles.backButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={textPrimary} />
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <Text style={[styles.headerTitle, { color: textPrimary }]}>{mode === 'daily' ? 'DAILY CHALLENGE' : 'THE SAT WORDLE'}</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {mode === 'practice' && (
            <TouchableOpacity
              onPress={startNewGame}
              style={[styles.refreshButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}
              activeOpacity={0.7}
            >
              <RefreshCw size={17} color={textPrimary} />
            </TouchableOpacity>
          )}

          <View style={styles.coinHeaderBadge}>
            <Coins size={14} color="#FBBF24" />
            <Text style={styles.coinHeaderText}>{userCoins}</Text>
          </View>
        </View>
      </View>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Daily Mode Completed View */}
      {isDailyDone && !showResultModal ? (
        <ScrollView contentContainerStyle={styles.dailyCompletedContainer} showsVerticalScrollIndicator={false}>
          <View style={[styles.dailyCompletedCard, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={styles.dailyCompletedIconCircle}>
              <CheckCircle2 size={38} color="#22C55E" />
            </View>

            <Text style={[styles.dailyCompletedHeading, { color: textPrimary }]}>
              Today's Wordle Solved!
            </Text>
            <Text style={[styles.dailyCompletedSubheading, { color: textSecondary }]}>
              You have already solved today's Daily Challenge! Come back tomorrow at midnight for the next word.
            </Text>

            {/* Target Word Reveal */}
            <View style={styles.wordRevealBox}>
              <Text style={styles.wordRevealLabel}>TODAY'S WORD</Text>
              <Text style={styles.wordRevealWord}>{targetEntry.word}</Text>
            </View>

            {/* Spotlight Card */}
            <View style={[styles.spotlightCard, { backgroundColor: isDark ? '#232530' : '#F3F4F6', width: '100%', marginVertical: 14 }]}>
              <View style={styles.spotlightHeader}>
                <Sparkles size={16} color="#F59E0B" />
                <Text style={styles.spotlightTitle}>
                  {targetEntry.related_event || targetEntry.category || 'Saturnalia Spotlight'}
                </Text>
                {targetEntry.day ? (
                  <View style={{ backgroundColor: isDark ? 'rgba(245, 158, 11, 0.18)' : '#FEF3C7', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, marginLeft: 'auto' }}>
                    <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 10, color: '#F59E0B' }}>
                      {targetEntry.day}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.spotlightMessage, { color: textPrimary }]}>
                {targetEntry.message || DEFAULT_WORD_MESSAGE}
              </Text>
            </View>

            {onGoToPractice ? (
              <TouchableOpacity
                onPress={onGoToPractice}
                activeOpacity={0.8}
                style={[styles.modalPrimaryButton, { width: '100%', backgroundColor: '#10B981', marginTop: 8 }]}
              >
                <Zap size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.modalPrimaryButtonText}>Play The Sat Wordle</Text>
              </TouchableOpacity>
            ) : null}

            {onBack ? (
              <TouchableOpacity
                onPress={onBack}
                activeOpacity={0.8}
                style={[styles.modalSecondaryButton, { width: '100%', marginTop: 10, borderColor: border }]}
              >
                <Text style={[styles.modalSecondaryButtonText, { color: textSecondary }]}>Back to Menu</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </ScrollView>
      ) : (
        <>
          {/* Wordle Grid */}
          <View style={styles.boardWrapper}>
            <Animated.View style={[styles.board, { transform: [{ translateX: shakeAnim }] }]}>
              {Array(6)
                .fill(0)
                .map((_, rowIndex) => {
                  const isSubmitted = rowIndex < guesses.length;
                  const isCurrent = rowIndex === guesses.length;
                  const rowWord = isSubmitted
                    ? guesses[rowIndex]
                    : isCurrent
                    ? currentGuess.padEnd(5, ' ')
                    : '     ';

                  const rowEvaluation = isSubmitted
                    ? evaluateGuess(guesses[rowIndex], targetEntry.word)
                    : null;

                  return (
                    <View key={rowIndex} style={styles.row}>
                      {Array(5)
                        .fill(0)
                        .map((__, colIndex) => {
                          const letter = rowWord[colIndex]?.trim() || '';
                          let tileBg = 'transparent';
                          let tileBorder = emptyTileBorder;
                          let tileTextColor = textPrimary;

                          if (isSubmitted && rowEvaluation) {
                            const status = rowEvaluation[colIndex];
                            if (status === 'correct') {
                              tileBg = correctColor;
                              tileBorder = correctColor;
                              tileTextColor = '#FFFFFF';
                            } else if (status === 'present') {
                              tileBg = presentColor;
                              tileBorder = presentColor;
                              tileTextColor = '#FFFFFF';
                            } else {
                              tileBg = absentColor;
                              tileBorder = absentColor;
                              tileTextColor = '#FFFFFF';
                            }
                          } else if (letter) {
                            tileBorder = isDark ? '#60A5FA' : '#3B82F6';
                          }

                          return (
                            <View
                              key={colIndex}
                              style={[
                                styles.tile,
                                {
                                  width: tileSize,
                                  height: tileSize,
                                  backgroundColor: tileBg,
                                  borderColor: tileBorder,
                                },
                              ]}
                            >
                              <Text style={[styles.tileLetter, { color: tileTextColor }]}>
                                {letter}
                              </Text>
                            </View>
                          );
                        })}
                    </View>
                  );
                })}
            </Animated.View>
          </View>

          {/* On-Screen Keyboard */}
          <View style={[styles.keyboardContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {KEYBOARD_ROWS.map((row, rIdx) => (
              <View key={rIdx} style={styles.keyboardRow}>
                {row.map((key) => {
                  const isSpecial = key === 'ENTER' || key === 'BACKSPACE';
                  const status = keyStatuses[key];

                  let keyBg = isDark ? '#2E323D' : '#D1D5DB';
                  let keyTextColor = isDark ? '#FFFFFF' : '#111827';

                  if (status === 'correct') {
                    keyBg = correctColor;
                    keyTextColor = '#FFFFFF';
                  } else if (status === 'present') {
                    keyBg = presentColor;
                    keyTextColor = '#FFFFFF';
                  } else if (status === 'absent') {
                    keyBg = absentColor;
                    keyTextColor = '#FFFFFF';
                  }

                  const keyWidth = Math.floor((SCREEN_WIDTH - 64) / 10);

                  return (
                    <TouchableOpacity
                      key={key}
                      activeOpacity={0.7}
                      onPress={() => handleKeyPress(key)}
                      style={[
                        styles.key,
                        isSpecial ? styles.specialKey : { width: keyWidth },
                        { backgroundColor: keyBg },
                      ]}
                    >
                      {key === 'BACKSPACE' ? (
                        <Ionicons name="backspace-outline" size={20} color={keyTextColor} />
                      ) : (
                        <Text
                          style={[
                            styles.keyText,
                            isSpecial && styles.specialKeyText,
                            { color: keyTextColor },
                          ]}
                        >
                          {key}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </>
      )}

      {/* Result Modal */}
      <Modal visible={showResultModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: cardBg, borderColor: border }]}>
            {/* Modal Header Icon */}
            <View
              style={[
                styles.modalIconCircle,
                {
                  backgroundColor:
                    gameStatus === 'won' ? 'rgba(34, 197, 94, 0.18)' : 'rgba(239, 68, 68, 0.15)',
                },
              ]}
            >
              {gameStatus === 'won' ? (
                <Trophy size={36} color="#22C55E" />
              ) : (
                <Ionicons name="close-circle-outline" size={38} color="#EF4444" />
              )}
            </View>

            {/* Title & Word Result */}
            <Text style={[styles.modalTitle, { color: textPrimary }]}>
              {gameStatus === 'won' ? 'Brilliant Solved!' : 'Game Over'}
            </Text>

            <View style={styles.wordRevealBox}>
              <Text style={styles.wordRevealLabel}>TARGET WORD</Text>
              <Text style={styles.wordRevealWord}>{targetEntry.word}</Text>
            </View>

            {/* Custom Event Spotlight Message */}
            <View style={[styles.spotlightCard, { backgroundColor: isDark ? '#232530' : '#F3F4F6' }]}>
              <View style={styles.spotlightHeader}>
                <Sparkles size={16} color="#F59E0B" />
                <Text style={styles.spotlightTitle}>
                  {targetEntry.related_event || targetEntry.category || 'Saturnalia Spotlight'}
                </Text>
                {targetEntry.day ? (
                  <View style={{ backgroundColor: isDark ? 'rgba(245, 158, 11, 0.18)' : '#FEF3C7', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, marginLeft: 'auto' }}>
                    <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 10, color: '#F59E0B' }}>
                      {targetEntry.day}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.spotlightMessage, { color: textPrimary }]}>
                {targetEntry.message || DEFAULT_WORD_MESSAGE}
              </Text>
            </View>

            {/* Daily Reward Status */}
            {mode === 'daily' && (
              <View
                style={[
                  styles.rewardCard,
                  {
                    backgroundColor: isDark ? 'rgba(251, 191, 36, 0.12)' : '#FEF3C7',
                    borderColor: '#F59E0B',
                  },
                ]}
              >
                <Coins size={22} color="#F59E0B" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.rewardTitle, { color: isDark ? '#FBBF24' : '#B45309' }]}>
                    {gameStatus === 'won'
                      ? claimingCoins
                        ? 'Claiming Daily Reward…'
                        : coinsClaimedSuccess
                        ? 'Daily Reward Claimed!'
                        : 'Daily Reward'
                      : 'No reward awarded for incomplete solve.'}
                  </Text>
                  <Text style={[styles.rewardSubtitle, { color: isDark ? '#D1D5DB' : '#78350F' }]}>
                    {gameStatus === 'won'
                      ? 'Daily challenge solved for today. Come back tomorrow for the next word!'
                      : 'You can practice anytime in Practice Mode!'}
                  </Text>
                </View>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.modalActions}>
              {mode === 'practice' ? (
                <TouchableOpacity
                  onPress={startNewGame}
                  activeOpacity={0.8}
                  style={[styles.modalPrimaryButton, { backgroundColor: '#10B981' }]}
                >
                  <RefreshCw size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.modalPrimaryButtonText}>Play Next Word</Text>
                </TouchableOpacity>
              ) : onGoToPractice ? (
                <TouchableOpacity
                  onPress={() => {
                    setShowResultModal(false);
                    onGoToPractice();
                  }}
                  activeOpacity={0.8}
                  style={styles.modalPrimaryButton}
                >
                  <Zap size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.modalPrimaryButtonText}>Play The Sat Wordle</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                onPress={() => setShowResultModal(false)}
                activeOpacity={0.7}
                style={[styles.modalSecondaryButton, { borderColor: border }]}
              >
                <Text style={[styles.modalSecondaryButtonText, { color: textSecondary }]}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 20,
    letterSpacing: 2,
  },
  coinHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.4)',
  },
  coinHeaderText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: '#FBBF24',
  },
  modeSelectorWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  modeSelector: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
  },
  modeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 9,
    gap: 6,
  },
  modeOptionText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
  toastContainer: {
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.92)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 100,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  toastText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
  },
  boardWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
  board: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  tile: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  tileLetter: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 24,
    textTransform: 'uppercase',
  },
  keyboardContainer: {
    paddingHorizontal: 6,
    gap: 6,
  },
  keyboardRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  key: {
    height: 48,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  specialKey: {
    paddingHorizontal: 10,
    minWidth: 54,
  },
  keyText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
  },
  specialKeyText: {
    fontSize: 11,
  },
  dailyCompletedContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  dailyCompletedCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  dailyCompletedIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(34, 197, 94, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  dailyCompletedHeading: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 6,
  },
  dailyCompletedSubheading: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  modalIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontFamily: 'Talina',
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 12,
  },
  wordRevealBox: {
    alignItems: 'center',
    marginBottom: 14,
  },
  wordRevealLabel: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
    color: '#9CA3AF',
    letterSpacing: 1,
    marginBottom: 2,
  },
  wordRevealWord: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 26,
    color: '#22C55E',
    letterSpacing: 3,
  },
  spotlightCard: {
    width: '100%',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  spotlightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  spotlightTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    color: '#F59E0B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  spotlightMessage: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    lineHeight: 21,
  },
  rewardCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  rewardTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
  },
  rewardSubtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    marginTop: 2,
  },
  modalActions: {
    width: '100%',
    gap: 10,
  },
  modalPrimaryButton: {
    flexDirection: 'row',
    backgroundColor: '#6366F1',
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  modalSecondaryButton: {
    borderRadius: 14,
    height: 46,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryButtonText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
  },
});
