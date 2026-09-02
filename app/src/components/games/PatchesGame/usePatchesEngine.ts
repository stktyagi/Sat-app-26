import { useState, useCallback, useMemo, useEffect } from 'react';
import { PatchesLevelConfig } from './SamplePatchesLevels';
import { Bounds, Patch, isOverlap, evaluatePatch } from './patchesValidator';

const PASTEL_COLORS = [
  '#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF',
  '#E8B2FF', '#FFB2F9', '#B2FFF6', '#FFE4B2', '#D4FFB2'
];

export const usePatchesEngine = (levelConfig: PatchesLevelConfig) => {
  const [patches, setPatches] = useState<Patch[]>([]);
  const [activeDrag, setActiveDrag] = useState<Bounds | null>(null);
  
  useEffect(() => {
    setPatches([]);
    setActiveDrag(null);
  }, [levelConfig.id]);

  const totalCells = levelConfig.rows * levelConfig.cols;

  const isWin = useMemo(() => {
    let covered = 0;
    for (const p of patches) {
      covered += (p.bounds.maxRow - p.bounds.minRow + 1) * (p.bounds.maxCol - p.bounds.minCol + 1);
    }
    return covered === totalCells;
  }, [patches, totalCells]);

  const handleDragUpdate = useCallback((startRow: number, startCol: number, currentRow: number, currentCol: number) => {
    const minRow = Math.max(0, Math.min(startRow, currentRow));
    const maxRow = Math.min(levelConfig.rows - 1, Math.max(startRow, currentRow));
    const minCol = Math.max(0, Math.min(startCol, currentCol));
    const maxCol = Math.min(levelConfig.cols - 1, Math.max(startCol, currentCol));

    setActiveDrag({ minRow, maxRow, minCol, maxCol });
  }, [levelConfig]);

  const handleDragRelease = useCallback(() => {
    if (!activeDrag) return false;

    // Validate
    if (isOverlap(activeDrag, patches)) {
      setActiveDrag(null);
      return false;
    }

    const result = evaluatePatch(activeDrag, levelConfig.clues);
    if (!result.valid) {
      setActiveDrag(null);
      return false;
    }

    // Add patch
    const newPatch: Patch = {
      id: Math.random().toString(36).substr(2, 9),
      bounds: activeDrag,
      clueCellId: result.clueCellId!,
      color: PASTEL_COLORS[patches.length % PASTEL_COLORS.length]
    };

    setPatches(prev => [...prev, newPatch]);
    setActiveDrag(null);
    return true; // Success
  }, [activeDrag, patches, levelConfig]);

  const removePatch = useCallback((patchId: string) => {
    setPatches(prev => prev.filter(p => p.id !== patchId));
  }, []);
  
  const resetBoard = useCallback(() => {
    setPatches([]);
  }, []);

  return {
    patches,
    activeDrag,
    isWin,
    handleDragUpdate,
    handleDragRelease,
    removePatch,
    resetBoard
  };
};
