import { useState, useCallback, useMemo, useEffect } from 'react';
import { LevelConfig } from './SampleLevels';

export type Cell = {
  id: string; // "row,col"
  row: number;
  col: number;
  numberValue: number | null;
};

export const useZipEngine = (levelConfig: LevelConfig) => {
  const [activePath, setActivePath] = useState<string[]>([]);

  useEffect(() => {
    setActivePath([]);
  }, [levelConfig.id]);

  // Derived Grid
  const grid = useMemo(() => {
    const newGrid: Cell[][] = [];
    for (let r = 0; r < levelConfig.rows; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < levelConfig.cols; c++) {
        const id = `${r},${c}`;
        row.push({
          id,
          row: r,
          col: c,
          numberValue: levelConfig.checkpoints[id] || null,
        });
      }
      newGrid.push(row);
    }
    return newGrid;
  }, [levelConfig]);

  // Derived Checkpoint Status
  const currentCheckpoint = useMemo(() => {
    let max = 0;
    for (const cellId of activePath) {
      const val = levelConfig.checkpoints[cellId];
      if (val && val > max) max = val;
    }
    return max;
  }, [activePath, levelConfig.checkpoints]);

  // Total checkpoints required
  const maxCheckpoint = useMemo(() => {
    return Math.max(...Object.values(levelConfig.checkpoints));
  }, [levelConfig]);

  // Derived Win State
  const isWin = useMemo(() => {
    const totalCells = levelConfig.rows * levelConfig.cols;
    if (activePath.length !== totalCells) return false;
    
    const lastCellId = activePath[activePath.length - 1];
    const lastCellValue = levelConfig.checkpoints[lastCellId];
    
    return lastCellValue === maxCheckpoint;
  }, [activePath, levelConfig, maxCheckpoint]);

  const resetPath = useCallback(() => {
    setActivePath([]);
  }, []);

  const handleCellEnter = useCallback((row: number, col: number) => {
    if (row < 0 || row >= levelConfig.rows || col < 0 || col >= levelConfig.cols) return;

    const cellId = `${row},${col}`;
    
    setActivePath(prev => {
      const totalCells = levelConfig.rows * levelConfig.cols;
      
      let maxCp = 0;
      for (const id of prev) {
        const val = levelConfig.checkpoints[id];
        if (val && val > maxCp) maxCp = val;
      }

      if (prev.length === totalCells) {
        const lastId = prev[prev.length - 1];
        if (levelConfig.checkpoints[lastId] === maxCheckpoint) {
          return prev;
        }
      }

      if (prev.length === 0) {
        // Must start at 1
        if (levelConfig.checkpoints[cellId] === 1) {
          return [cellId];
        }
        return prev;
      }

      const lastCellId = prev[prev.length - 1];
      if (lastCellId === cellId) return prev; // Already on it

      const [lastRow, lastCol] = lastCellId.split(',').map(Number);

      // Check adjacency
      const isAdjacent = Math.abs(lastRow - row) + Math.abs(lastCol - col) === 1;
      if (!isAdjacent) return prev;

      // Check backtracking
      if (prev.length > 1 && prev[prev.length - 2] === cellId) {
        // User moved back, remove the last cell
        return prev.slice(0, -1);
      }

      // Check intersection (cannot visit a cell already in path)
      if (prev.includes(cellId)) return prev;

      // Check checkpoint ordering
      const cellValue = levelConfig.checkpoints[cellId];
      if (cellValue) {
        // Needs to be exactly currentCheckpoint + 1
        if (cellValue !== maxCp + 1) {
          return prev; // Block move
        }
      }

      return [...prev, cellId];
    });
  }, [levelConfig, maxCheckpoint]);

  return {
    grid,
    activePath,
    currentCheckpoint,
    maxCheckpoint,
    isWin,
    handleCellEnter,
    resetPath,
  };
};
