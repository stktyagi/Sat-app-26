import React, { useState, useEffect } from 'react';
import { View, Text, Dimensions, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { usePatchesEngine } from './usePatchesEngine';
import { SAMPLE_PATCHES_LEVELS, ClueShape } from './SamplePatchesLevels';
import { Ionicons } from '@expo/vector-icons';
import { Coins } from 'lucide-react-native';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');
const GRID_PADDING = 20;
const AVAILABLE_WIDTH = width - GRID_PADDING * 2;

export interface PatchesGameProps {
  initialLevelIndex?: number;
  onComplete?: (timeSeconds: number) => void;
  onBack?: () => void;
  rewardClaimed?: boolean;
}

export default function PatchesGame({ initialLevelIndex, onComplete, onBack, rewardClaimed }: PatchesGameProps = {}) {
  const router = useRouter();
  const getRandomLevel = () => {
    return Math.floor(Math.random() * SAMPLE_PATCHES_LEVELS.length);
  };
  const [levelIndex, setLevelIndex] = useState(() =>
    typeof initialLevelIndex === 'number' ? Math.max(0, Math.min(initialLevelIndex, SAMPLE_PATCHES_LEVELS.length - 1)) : getRandomLevel()
  );
  const currentLevel = SAMPLE_PATCHES_LEVELS[levelIndex];

  const {
    patches,
    activeDrag,
    isWin,
    handleDragUpdate,
    handleDragRelease,
    removePatch,
    resetBoard
  } = usePatchesEngine(currentLevel);

  const [timer, setTimer] = useState(0);
  const [showWinModal, setShowWinModal] = useState(false);

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (!isWin) {
      interval = setInterval(() => setTimer(t => t + 1), 1000);
    } else {
      setShowWinModal(true);
    }
    return () => clearInterval(interval);
  }, [isWin]);

  useEffect(() => {
    setTimer(0);
    setShowWinModal(false);
  }, [levelIndex]);

  const CELL_SIZE = AVAILABLE_WIDTH / currentLevel.cols;

  const [dragStart, setDragStart] = useState<{row: number, col: number} | null>(null);

  const onDragStart = (row: number, col: number) => {
    setDragStart({ row, col });
    handleDragUpdate(row, col, row, col);
  };

  const onDragChange = (row: number, col: number) => {
    if (dragStart) {
      handleDragUpdate(dragStart.row, dragStart.col, row, col);
    }
  };

  const onDragEnd = () => {
    setDragStart(null);
    handleDragRelease();
  };

  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .onBegin((e) => {
      const col = Math.floor(e.x / CELL_SIZE);
      const row = Math.floor(e.y / CELL_SIZE);
      onDragStart(row, col);
    })
    .onChange((e) => {
      const col = Math.floor(e.x / CELL_SIZE);
      const row = Math.floor(e.y / CELL_SIZE);
      onDragChange(row, col);
    })
    .onFinalize(() => {
      onDragEnd();
    });

  const nextLevel = () => {
    let nextIdx = getRandomLevel();
    if (SAMPLE_PATCHES_LEVELS.length > 1) {
      while (nextIdx === levelIndex) {
        nextIdx = getRandomLevel();
      }
    }
    setLevelIndex(nextIdx);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const renderShapeIcon = (shape: ClueShape) => {
    switch (shape) {
      case 'SQUARE': return <Ionicons name="stop" size={14} color="#0C3572" />;
      case 'TALL': return <Ionicons name="tablet-portrait" size={16} color="#0C3572" />;
      case 'WIDE': return <Ionicons name="tablet-landscape" size={16} color="#0C3572" />;
      case 'ANY': return <View style={{ width: 14, height: 14, borderWidth: 1, borderColor: '#0C3572', borderStyle: 'dashed' }} />;
      default: return null;
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <View className="flex-row items-center justify-between mb-4 px-6 mt-12">
        <TouchableOpacity onPress={handleBack} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="#0C3572" />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[#0C3572] text-2xl">Patches</Text>
        <TouchableOpacity onPress={resetBoard}>
          <Ionicons name="refresh" size={24} color="#EEB170" />
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <Text style={styles.statText}>Level {currentLevel.id}</Text>
        <Text style={styles.statText}>Time: {formatTime(timer)}</Text>
      </View>

      <View style={styles.gridWrapper}>
        <GestureDetector gesture={panGesture}>
          <View style={{ width: AVAILABLE_WIDTH, height: CELL_SIZE * currentLevel.rows, backgroundColor: '#FFFFFF66', borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
            
            {/* Background Grid Cells */}
            {Array.from({ length: currentLevel.rows }).map((_, r) => (
              <View key={r} style={styles.row}>
                {Array.from({ length: currentLevel.cols }).map((_, c) => {
                  const clue = currentLevel.clues[`${r},${c}`];

                  return (
                    <View 
                      key={`${r}-${c}`} 
                      style={[styles.cell, { width: CELL_SIZE, height: CELL_SIZE }]}
                    >
                      {clue && (
                        <View style={styles.clueContainer}>
                          <Text style={styles.clueText}>{clue.value}</Text>
                          {renderShapeIcon(clue.shape)}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}

            {/* Placed Patches Overlay */}
            {patches.map(patch => (
              <TouchableOpacity
                key={patch.id}
                activeOpacity={0.7}
                onPress={() => removePatch(patch.id)}
                style={[
                  styles.patchOverlay,
                  {
                    left: patch.bounds.minCol * CELL_SIZE,
                    top: patch.bounds.minRow * CELL_SIZE,
                    width: (patch.bounds.maxCol - patch.bounds.minCol + 1) * CELL_SIZE,
                    height: (patch.bounds.maxRow - patch.bounds.minRow + 1) * CELL_SIZE,
                    backgroundColor: patch.color,
                  }
                ]}
              />
            ))}

            {/* Active Drag Overlay */}
            {activeDrag && (
              <View
                pointerEvents="none"
                style={[
                  styles.activeDragOverlay,
                  {
                    left: activeDrag.minCol * CELL_SIZE,
                    top: activeDrag.minRow * CELL_SIZE,
                    width: (activeDrag.maxCol - activeDrag.minCol + 1) * CELL_SIZE,
                    height: (activeDrag.maxRow - activeDrag.minRow + 1) * CELL_SIZE,
                  }
                ]}
              />
            )}

          </View>
        </GestureDetector>
      </View>

      <Text style={styles.instructionsText}>
        Drag to draw rectangular patches.{"\n"}Each patch must contain exactly one clue and match its area/shape. Tap a patch to delete it.
      </Text>

      {/* Win Modal */}
      <Modal visible={showWinModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="trophy" size={60} color="#EEB170" />
            <Text style={styles.modalTitle}>Level Complete!</Text>
            <Text style={styles.modalText}>Time: {formatTime(timer)}</Text>
            
            {onComplete && !rewardClaimed && (
              <TouchableOpacity
                style={[styles.nextButton, { backgroundColor: '#F59E0B', marginBottom: 10 }]}
                onPress={() => {
                  setShowWinModal(false);
                  onComplete(timer);
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Coins size={18} color="#FFFFFF" />
                  <Text style={styles.nextButtonText}>Claim 20 Coins</Text>
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.nextButton} onPress={nextLevel}>
              <Text style={styles.nextButtonText}>Next Puzzle</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  statText: {
    color: '#2175C0',
    fontFamily: 'Outfit_500Medium',
    fontSize: 16,
  },
  gridWrapper: {
    padding: GRID_PADDING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    borderWidth: 1,
    borderColor: '#A0B3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clueContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  clueText: {
    color: '#0C3572',
    fontFamily: 'Outfit_700Bold',
    fontSize: 20,
    marginBottom: 2,
  },
  patchOverlay: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#FFF',
    borderRadius: 8,
    opacity: 0.9,
    zIndex: 5,
  },
  activeDragOverlay: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#EEB170',
    backgroundColor: 'rgba(255, 186, 0, 0.3)',
    borderRadius: 8,
    zIndex: 20,
  },
  instructionsText: {
    color: '#2175C0',
    textAlign: 'center',
    marginTop: 30,
    paddingHorizontal: 30,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: 'Outfit_500Medium',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    width: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  modalTitle: {
    color: '#0C3572',
    fontSize: 24,
    fontFamily: 'Outfit_700Bold',
    marginTop: 15,
    marginBottom: 10,
  },
  modalText: {
    color: '#2175C0',
    fontSize: 16,
    fontFamily: 'Outfit_500Medium',
    marginBottom: 12,
  },
  nextButton: {
    marginTop: 8,
    backgroundColor: '#EEB170',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 30,
  },
  nextButtonText: {
    color: '#121212',
    fontFamily: 'Outfit_700Bold',
    fontSize: 15,
  },
});
