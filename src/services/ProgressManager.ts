import type { Difficulty } from '../types/level';
import type { LevelManager } from './LevelManager';

const STORAGE_KEY = 'star_battle_progress';
const LEVEL_ID_PATTERN = /^(easy|medium|hard)_(\d+)$/;

export interface ProgressSaveState {
  completedLevels: string[];
  unlockedLevels: string[];
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function parseSaveState(raw: string | null): ProgressSaveState {
  if (!raw) {
    return { completedLevels: [], unlockedLevels: [] };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return { completedLevels: [], unlockedLevels: [] };
    }

    const candidate = parsed as Record<string, unknown>;
    return {
      completedLevels: isStringArray(candidate.completedLevels)
        ? [...candidate.completedLevels]
        : [],
      unlockedLevels: isStringArray(candidate.unlockedLevels)
        ? [...candidate.unlockedLevels]
        : [],
    };
  } catch {
    return { completedLevels: [], unlockedLevels: [] };
  }
}

function getNextLevelId(levelId: string): string | null {
  const match = LEVEL_ID_PATTERN.exec(levelId);
  if (!match) {
    return null;
  }

  const difficulty = match[1];
  const index = Number(match[2]);
  if (!difficulty || !Number.isFinite(index)) {
    return null;
  }

  return `${difficulty}_${index + 1}`;
}

export class ProgressManager {
  private readonly levelManager: LevelManager;
  private state: ProgressSaveState;

  constructor(levelManager: LevelManager) {
    this.levelManager = levelManager;
    this.state = parseSaveState(
      typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null,
    );
    this.ensureStarterLevelsUnlocked();
  }

  isUnlocked(levelId: string): boolean {
    return this.state.unlockedLevels.includes(levelId);
  }

  isCompleted(levelId: string): boolean {
    return this.state.completedLevels.includes(levelId);
  }

  getCompletedCount(difficulty: Difficulty): number {
    return this.levelManager
      .getAllLevels(difficulty)
      .filter((level) => this.state.completedLevels.includes(level.id)).length;
  }

  markCompleted(levelId: string): void {
    if (!this.state.completedLevels.includes(levelId)) {
      this.state.completedLevels.push(levelId);
      this.save();
    }

    const nextLevelId = getNextLevelId(levelId);
    if (!nextLevelId) {
      return;
    }

    if (!this.levelManager.getLevelById(nextLevelId)) {
      return;
    }

    if (!this.state.unlockedLevels.includes(nextLevelId)) {
      this.state.unlockedLevels.push(nextLevelId);
      this.save();
    }
  }

  private ensureStarterLevelsUnlocked(): void {
    let mutated = false;

    for (const difficulty of this.levelManager.getDifficulties()) {
      const starterId = `${difficulty}_1`;
      if (!this.levelManager.getLevelById(starterId)) {
        continue;
      }

      if (!this.state.unlockedLevels.includes(starterId)) {
        this.state.unlockedLevels.push(starterId);
        mutated = true;
      }
    }

    if (mutated) {
      this.save();
    }
  }

  private save(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    const payload: ProgressSaveState = {
      completedLevels: [...this.state.completedLevels],
      unlockedLevels: [...this.state.unlockedLevels],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }
}
