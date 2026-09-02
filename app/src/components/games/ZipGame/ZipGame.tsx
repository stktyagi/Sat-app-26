import React, { useState, useEffect } from 'react';
import { View, Text, Dimensions, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { useZipEngine } from './useZipEngine';
import { SAMPLE_LEVELS } from './SampleLevels';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');
const GRID_PADDING = 20;
const AVAILABLE_WIDTH = width - GRID_PADDING * 2;

export default function ZipGame() {
  const router = useRouter();
  const getRandomLevel = () => Math.floor(Math.random() * SAMPLE_LEVELS.length);
  const [levelIndex, setLevelIndex] = useState(getRandomLevel);
  const currentLevel = SAMPLE_LEVELS[levelIndex];

  const {
    grid,
    activePath,
    isWin,
    handleCellEnter,
    resetPath
  } = useZipEngine(currentLevel);

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
    // Reset states on level change
    setTimer(0);
    setShowWinModal(false);
  }, [levelIndex]);

  const CELL_SIZE = AVAILABLE_WIDTH / currentLevel.cols;

  // Polyline points calculation
  const getPathPoints = () => {
    return activePath.map(cellId => {
      const [r, c] = cellId.split(',').map(Number);
      const x = (c * CELL_SIZE) + (CELL_SIZE / 2);
      const y = (r * CELL_SIZE) + (CELL_SIZE / 2);
      return `${x},${y}`;
    }).join(' ');
  };

  // Gesture handler for drag
  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .onBegin((e) => {
      const col = Math.floor(e.x / CELL_SIZE);
      const row = Math.floor(e.y / CELL_SIZE);
      handleCellEnter(row, col);
    })
    .onChange((e) => {
      const col = Math.floor(e.x / CELL_SIZE);
      const row = Math.floor(e.y / CELL_SIZE);
      handleCellEnter(row, col);
    });

  const nextLevel = () => {
    let nextIdx = getRandomLevel();
    // Ensure it picks a different level if possible
    if (SAMPLE_LEVELS.length > 1) {
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

  return (
    <GestureHandlerRootView style={styles.container}>
      <View className="flex-row items-center justify-between mb-4 px-6 mt-12">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="#0C3572" />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[#0C3572] text-2xl">Zip Puzzle</Text>
        <TouchableOpacity onPress={resetPath}>
          <Ionicons name="refresh" size={24} color="#EEB170" />
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <Text style={styles.statText}>Level {currentLevel.id}</Text>
        <Text style={styles.statText}>Time: {formatTime(timer)}</Text>
      </View>

      <View style={styles.gridWrapper}>
        <GestureDetector gesture={panGesture}>
          <View key={currentLevel.id} style={{ width: AVAILABLE_WIDTH, height: CELL_SIZE * currentLevel.rows, backgroundColor: '#FFFFFF66', borderRadius: 12, overflow: 'hidden' }}>
            
            {/* Base Grid Cells */}
            {grid.map((row, rIdx) => (
              <View key={rIdx} style={styles.row}>
                {row.map((cell, cIdx) => {
                  const isVisited = activePath.includes(cell.id);
                  const isStart = cell.numberValue === 1;
                  
                  return (
                    <View 
                      key={cell.id} 
                      style={[
                        styles.cell, 
                        { width: CELL_SIZE, height: CELL_SIZE },
                        isVisited && styles.cellVisited
                      ]}
                    >
                      {cell.numberValue !== null && (
                        <View style={[styles.checkpointBadge, isVisited && styles.checkpointVisited]}>
                          <Text style={[styles.checkpointText, isVisited && styles.checkpointTextVisited]}>
                            {cell.numberValue}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}

            {/* Path SVG Overlay */}
            <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
              <Polyline
                points={getPathPoints()}
                fill="none"
                stroke="#EEB170"
                strokeWidth={CELL_SIZE * 0.25}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Add a circle at the very end of the path */}
              {activePath.length > 0 && (() => {
                const lastCell = activePath[activePath.length - 1];
                const [r, c] = lastCell.split(',').map(Number);
                return (
                  <Circle
                    cx={(c * CELL_SIZE) + (CELL_SIZE / 2)}
                    cy={(r * CELL_SIZE) + (CELL_SIZE / 2)}
                    r={CELL_SIZE * 0.15}
                    fill="#EEB170"
                  />
                );
              })()}
            </Svg>

          </View>
        </GestureDetector>
      </View>

      {/* Win Modal */}
      <Modal visible={showWinModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="trophy" size={60} color="#EEB170" />
            <Text style={styles.modalTitle}>Level Complete!</Text>
            <Text style={styles.modalText}>Time: {formatTime(timer)}</Text>
            
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
  cellVisited: {
    backgroundColor: '#332700',
  },
  checkpointBadge: {
    width: '60%',
    height: '60%',
    borderRadius: 100,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkpointVisited: {
    backgroundColor: '#EEB170',
  },
  checkpointText: {
    color: 'white',
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
  },
  checkpointTextVisited: {
    color: '#121212',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF66',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    width: '80%',
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
    marginBottom: 5,
  },
  nextButton: {
    marginTop: 20,
    backgroundColor: '#EEB170',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 30,
  },
  nextButtonText: {
    color: '#121212',
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
  },
});
