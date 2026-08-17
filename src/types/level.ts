import { COLORS } from '../ui/colors';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type ScreenId = 'mainMenu' | 'levelSelect' | 'gameplay';

export type CellPlacement = 'nothing' | 'dot' | 'element';

export interface CellState {
  row: number;
  col: number;
  regionId: number;
  placed: CellPlacement;
}

export interface GameplayState {
  level: LevelData;
  levelIndex: number;
  levelCount: number;
  boardState: CellState[][];
  elapsedSeconds: number;
  remainingElements: number;
  isVictory: boolean;
}

export interface LevelData {
  id: string;
  size: number;
  k: number;
  difficulty: Difficulty;
  grid: number[][];
}

export interface DifficultyMeta {
  difficulty: Difficulty;
  label: string;
  subtitle: string;
  color: number;
}

export const DIFFICULTY_ORDER: readonly Difficulty[] = ['easy', 'medium', 'hard'];

export const DIFFICULTY_META: readonly DifficultyMeta[] = [
  {
    difficulty: 'easy',
    label: 'EASY',
    subtitle: '6×6',
    color: COLORS.menuButtonColorEasy,
  },
  {
    difficulty: 'medium',
    label: 'MEDIUM',
    subtitle: '10×10',
    color: COLORS.menuButtonColorMedium,
  },
  {
    difficulty: 'hard',
    label: 'HARD',
    subtitle: '10×10 · 2 stars',
    color: COLORS.menuButtonColorHard,
  },
];

export interface GameState {
  screen: ScreenId;
  selectedDifficulty: Difficulty | null;
  gameplay: GameplayState | null;
}
