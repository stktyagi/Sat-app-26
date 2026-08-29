export type LevelConfig = {
  id: number;
  rows: number;
  cols: number;
  // Map of "row,col" -> number
  checkpoints: Record<string, number>;
};

export const SAMPLE_LEVELS: LevelConfig[] = [
  {
    id: 1,
    rows: 4,
    cols: 4,
    checkpoints: {
      "0,0": 1,
      "0,3": 2, // Fixed parity (3,3 was mathematically impossible on 4x4)
    },
  },
  {
    id: 2,
    rows: 5,
    cols: 5,
    checkpoints: {
      "0,0": 1,
      "2,2": 2,
      "4,4": 3,
    },
  },
  {
    id: 3,
    rows: 6,
    cols: 6,
    checkpoints: {
      "0,0": 1,
      "0,5": 2,
      "5,5": 3,
      "5,0": 4,
    },
  },
  {
    id: 4,
    rows: 5,
    cols: 5,
    checkpoints: {
      "0,0": 1,
      "0,4": 2,
      "4,4": 3,
      "4,0": 4,
      "1,0": 5,
      "2,2": 6,
    },
  },
  {
    id: 5,
    rows: 6,
    cols: 6,
    checkpoints: {
      "0,0": 1,
      "0,5": 2,
      "5,5": 3,
      "5,0": 4,
      "1,0": 5,
      "1,4": 6,
      "4,4": 7,
      "4,1": 8,
      "2,1": 9,
      "3,2": 10,
    },
  }
];
