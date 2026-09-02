import { Clue, ClueShape } from './SamplePatchesLevels';

export interface Bounds {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}

export interface Patch {
  id: string;
  color: string;
  bounds: Bounds;
  clueCellId: string;
}

export function isOverlap(newBounds: Bounds, existingPatches: Patch[]): boolean {
  for (const patch of existingPatches) {
    const { bounds } = patch;
    if (
      newBounds.minRow <= bounds.maxRow &&
      newBounds.maxRow >= bounds.minRow &&
      newBounds.minCol <= bounds.maxCol &&
      newBounds.maxCol >= bounds.minCol
    ) {
      return true;
    }
  }
  return false;
}

export function evaluatePatch(
  bounds: Bounds,
  clues: Record<string, Clue>
): { valid: boolean; clueCellId?: string; reason?: string } {
  let foundClues = 0;
  let clueCellId = '';
  let foundClue: Clue | null = null;

  for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
    for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
      const id = `${r},${c}`;
      if (clues[id]) {
        foundClues++;
        clueCellId = id;
        foundClue = clues[id];
      }
    }
  }

  if (foundClues === 0) return { valid: false, reason: 'No clue in selection' };
  if (foundClues > 1) return { valid: false, reason: 'Multiple clues in selection' };

  if (!foundClue) return { valid: false };

  const height = bounds.maxRow - bounds.minRow + 1;
  const width = bounds.maxCol - bounds.minCol + 1;
  const area = height * width;

  if (foundClue.value !== '?' && area !== foundClue.value) {
    return { valid: false, reason: `Area is ${area}, needs to be ${foundClue.value}` };
  }

  const { shape } = foundClue;
  if (shape !== 'ANY') {
    if (shape === 'SQUARE' && width !== height) {
      return { valid: false, reason: 'Must be a square' };
    }
    if (shape === 'TALL' && height <= width) {
      return { valid: false, reason: 'Must be a tall rectangle' };
    }
    if (shape === 'WIDE' && width <= height) {
      return { valid: false, reason: 'Must be a wide rectangle' };
    }
  }

  return { valid: true, clueCellId };
}
