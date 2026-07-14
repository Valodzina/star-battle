import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Difficulty, LevelData } from '../src/types/level';
import { generateLevel } from '../src/utils/StarBattleGenerator';

const DIFFICULTY_PRESETS: Record<Difficulty, { size: number; k: number }> = {
  easy: { size: 6, k: 1 },
  medium: { size: 10, k: 1 },
  hard: { size: 10, k: 2 },
};

interface CliArgs {
  difficulty: Difficulty;
  count: number;
  size: number;
  k: number;
}

function isDifficulty(value: string): value is Difficulty {
  return value === 'easy' || value === 'medium' || value === 'hard';
}

function parseArgs(argv: string[]): CliArgs {
  const raw: Record<string, string> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (!arg.startsWith('--')) {
      continue;
    }

    const body = arg.slice(2);
    const eqIndex = body.indexOf('=');
    if (eqIndex >= 0) {
      raw[body.slice(0, eqIndex)] = body.slice(eqIndex + 1);
      continue;
    }

    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      raw[body] = next;
      i += 1;
    } else {
      raw[body] = 'true';
    }
  }

  const difficultyRaw = raw.difficulty ?? 'medium';
  if (!isDifficulty(difficultyRaw)) {
    throw new Error(`Invalid difficulty "${difficultyRaw}". Expected easy, medium, or hard.`);
  }

  const preset = DIFFICULTY_PRESETS[difficultyRaw];
  const count = raw.count !== undefined ? Number(raw.count) : 1;
  const size = raw.size !== undefined ? Number(raw.size) : preset.size;
  const k = raw.k !== undefined ? Number(raw.k) : preset.k;

  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`Invalid count "${raw.count}". Expected a positive integer.`);
  }
  if (!Number.isInteger(size) || size < 1) {
    throw new Error(`Invalid size "${raw.size}". Expected a positive integer.`);
  }
  if (!Number.isInteger(k) || k < 1 || k > size) {
    throw new Error(`Invalid k "${raw.k}". Expected an integer in [1, size].`);
  }

  return { difficulty: difficultyRaw, count, size, k };
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
    Array.isArray(candidate.grid)
  );
}

async function loadExistingLevels(
  levelsDir: string,
  difficulty: Difficulty,
): Promise<{ existingGrids: number[][][]; nextIndex: number }> {
  const existingGrids: number[][][] = [];
  let maxIndex = 0;
  const indexPattern = new RegExp(`^${difficulty}_(\\d+)\\.json$`);

  let entries: string[];
  try {
    entries = await fs.readdir(levelsDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { existingGrids, nextIndex: 1 };
    }
    throw error;
  }

  for (const entry of entries) {
    if (!entry.endsWith('.json')) {
      continue;
    }

    const match = indexPattern.exec(entry);
    if (match) {
      const index = Number(match[1]);
      if (Number.isInteger(index) && index > maxIndex) {
        maxIndex = index;
      }
    }

    const filePath = path.join(levelsDir, entry);
    const raw = await fs.readFile(filePath, 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn(`[CLI] Skipping invalid JSON: ${entry}`);
      continue;
    }

    if (!isLevelData(parsed)) {
      console.warn(`[CLI] Skipping malformed level: ${entry}`);
      continue;
    }

    existingGrids.push(parsed.grid);
  }

  return { existingGrids, nextIndex: maxIndex + 1 };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, '..');
  const levelsDir = path.join(repoRoot, 'src', 'assets', 'levels', args.difficulty);

  await fs.mkdir(levelsDir, { recursive: true });

  const { existingGrids, nextIndex: startIndex } = await loadExistingLevels(
    levelsDir,
    args.difficulty,
  );
  let nextIndex = startIndex;

  console.log(
    `[CLI] Generating ${args.count} ${args.difficulty} level(s) (${args.size}x${args.size}, K=${args.k}) into ${levelsDir}`,
  );

  for (let i = 0; i < args.count; i += 1) {
    const level = generateLevel(args.size, args.k, args.difficulty, { existingGrids });
    existingGrids.push(level.grid);

    const id = `${args.difficulty}_${nextIndex}`;
    level.id = id;
    const filename = `${id}.json`;
    const filePath = path.join(levelsDir, filename);

    await fs.writeFile(filePath, `${JSON.stringify(level, null, 2)}\n`, 'utf8');
    console.log(`[CLI] Saved ${filename} successfully!`);
    nextIndex += 1;
  }
}

main().catch((error: unknown) => {
  console.error('[CLI] Failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
