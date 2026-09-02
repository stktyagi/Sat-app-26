export type ClueShape = 'SQUARE' | 'TALL' | 'WIDE' | 'ANY';

export interface Clue {
  value: number | '?';
  shape: ClueShape;
}

export interface PatchesLevelConfig {
  id: number;
  rows: number;
  cols: number;
  // Map of "row,col" -> Clue
  clues: Record<string, Clue>;
}

export const SAMPLE_PATCHES_LEVELS: PatchesLevelConfig[] = [
  {
    id: 1,
    rows: 4,
    cols: 4,
    clues: {
      "0,0": { value: 4, shape: 'SQUARE' },
      "0,2": { value: 2, shape: 'TALL' },
      "0,3": { value: 4, shape: 'TALL' },
      "3,0": { value: 4, shape: 'SQUARE' }, // Fixed from WIDE to SQUARE
      "2,2": { value: 2, shape: 'TALL' },
    },
  },
  {
    id: 2,
    rows: 5,
    cols: 5,
    clues: {
      "0,0": { value: 3, shape: 'TALL' },
      "0,1": { value: 6, shape: 'WIDE' },
      "0,4": { value: 5, shape: 'TALL' },
      "2,1": { value: 4, shape: 'SQUARE' },
      "2,3": { value: 2, shape: 'TALL' },
      "4,0": { value: 2, shape: 'TALL' },
      "4,2": { value: 3, shape: 'WIDE' },
    },
  },
  {
    id: 3,
    rows: 6,
    cols: 6,
    clues: {
      "1,0": { value: 6, shape: 'TALL' },
      "0,4": { value: 4, shape: 'WIDE' },
      "2,3": { value: 6, shape: 'WIDE' },
      "3,5": { value: 3, shape: 'TALL' },
      "4,0": { value: 3, shape: 'TALL' },
      "3,1": { value: 4, shape: 'WIDE' },
      "5,1": { value: 4, shape: 'SQUARE' },
      "4,4": { value: 6, shape: 'WIDE' },
    },
  },
  {
    id: 4,
    rows: 5,
    cols: 5,
    clues: {
      "0,2": { value: 5, shape: 'WIDE' },
      "1,1": { value: 4, shape: 'WIDE' },
      "3,4": { value: 4, shape: 'TALL' },
      "3,0": { value: 3, shape: 'TALL' },
      "2,2": { value: 4, shape: 'SQUARE' },
      "4,3": { value: 3, shape: 'TALL' },
      "4,1": { value: 2, shape: 'WIDE' },
    },
  },
  {
    id: 5,
    rows: 4,
    cols: 4,
    clues: {
      "0,1": { value: '?', shape: 'ANY' },
      "3,0": { value: 4, shape: 'SQUARE' },
      "2,3": { value: '?', shape: 'ANY' },
    },
  }
];
