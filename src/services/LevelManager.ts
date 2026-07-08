import type { Difficulty, LevelData } from '../types/level';
import { DIFFICULTY_ORDER } from '../types/level';

const LEVEL_PATH_PATTERN = /\/(easy|medium|hard)\/([^/]+)\.json$/;

const levelModules = import.meta.glob<LevelData>('../assets/levels/*/*.json', {
  eager: true,
  import: 'default',
});

function isDifficulty(value: string): value is Difficulty {
  return value === 'easy' || value === 'medium' || value === 'hard';
}

function isLevelData(value: unknown): value is LevelData {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.size === 'number' &&
    typeof candidate.k === 'number' &&
    typeof candidate.difficulty === 'string' &&
    isDifficulty(candidate.difficulty) &&
    Array.isArray(candidate.grid)
  );
}

interface ParsedLevelEntry {
  difficulty: Difficulty;
  filename: string;
  level: LevelData;
}

function parseLevelModules(): ParsedLevelEntry[] {
  const entries: ParsedLevelEntry[] = [];

  for (const [path, level] of Object.entries(levelModules)) {
    const match = LEVEL_PATH_PATTERN.exec(path);
    if (!match) {
      console.warn(`[LevelManager] Skipping unrecognized path: ${path}`);
      continue;
    }

    const difficultySegment = match[1];
    const filename = match[2];
    if (!difficultySegment || !filename) {
      continue;
    }

    if (!isDifficulty(difficultySegment)) {
      console.warn(`[LevelManager] Skipping unknown difficulty in path: ${path}`);
      continue;
    }

    if (!isLevelData(level)) {
      console.warn(`[LevelManager] Skipping malformed level data: ${path}`);
      continue;
    }

    if (level.difficulty !== difficultySegment) {
      console.warn(
        `[LevelManager] Difficulty mismatch in ${path}: expected ${difficultySegment}, got ${level.difficulty}`,
      );
      continue;
    }

    entries.push({
      difficulty: difficultySegment,
      filename,
      level,
    });
  }

  return entries.sort((a, b) => {
    if (a.difficulty !== b.difficulty) {
      return DIFFICULTY_ORDER.indexOf(a.difficulty) - DIFFICULTY_ORDER.indexOf(b.difficulty);
    }

    return a.filename.localeCompare(b.filename, undefined, { numeric: true });
  });
}

export class LevelManager {
  private readonly levelsByDifficulty = new Map<Difficulty, LevelData[]>();

  constructor() {
    for (const difficulty of DIFFICULTY_ORDER) {
      this.levelsByDifficulty.set(difficulty, []);
    }

    for (const entry of parseLevelModules()) {
      const levels = this.levelsByDifficulty.get(entry.difficulty);
      levels?.push(entry.level);
    }
  }

  getLevelCount(difficulty: Difficulty): number {
    return this.levelsByDifficulty.get(difficulty)?.length ?? 0;
  }

  getLevel(difficulty: Difficulty, index: number): LevelData | undefined {
    return this.levelsByDifficulty.get(difficulty)?.[index];
  }

  getAllLevels(difficulty: Difficulty): readonly LevelData[] {
    return this.levelsByDifficulty.get(difficulty) ?? [];
  }

  getDifficulties(): Difficulty[] {
    return DIFFICULTY_ORDER.filter((difficulty) => this.getLevelCount(difficulty) > 0);
  }
}
