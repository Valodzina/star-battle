import { COLORS } from '../ui/colors';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type ScreenId = 'mainMenu' | 'levelSelect' | 'gameplay';

export type CellPlacement = 'nothing' | 'dot' | 'auto-dot' | 'element';

export interface CellState {
  row: number;
  col: number;
  regionId: number;
  placed: CellPlacement;
}

export interface GameplayState {
  level: LevelData;
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
    label: 'Easy',
    subtitle: '6×6 · K=1',
    color: COLORS.buttonEasy,
  },
  {
    difficulty: 'medium',
    label: 'Medium',
    subtitle: '10×10 · K=1',
    color: COLORS.buttonMedium,
  },
  {
    difficulty: 'hard',
    label: 'Hard',
    subtitle: '10×10 · K=2',
    color: COLORS.buttonHard,
  },
];

export interface GameState {
  screen: ScreenId;
  selectedDifficulty: Difficulty | null;
  gameplay: GameplayState | null;
}
