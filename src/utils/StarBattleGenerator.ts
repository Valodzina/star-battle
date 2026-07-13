import type { Difficulty, LevelData } from '../types/level';
import { DIFFICULTY_ORDER } from '../types/level';
import { LevelManager } from '../services/LevelManager';
import { solve } from './StarBattleSolver';

const MOORE_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

const ORTHO_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

const UNASSIGNED = -1;
const MAX_GROW_ATTEMPTS = 500;
const DEFAULT_MAX_BOARD_ATTEMPTS = 200;
const DEFAULT_MAX_MUTATIONS_PER_BOARD = 200;

type Cell = { row: number; col: number };

function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

function createEmptyGrid(size: number): boolean[][] {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => false));
}

function createUnassignedRegionGrid(size: number): number[][] {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => UNASSIGNED));
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
}

function canPlace(
  grid: boolean[][],
  colCounts: number[],
  size: number,
  k: number,
  row: number,
  col: number,
): boolean {
  if (grid[row]![col]) {
    return false;
  }
  if (colCounts[col]! >= k) {
    return false;
  }
  for (const [dRow, dCol] of MOORE_OFFSETS) {
    const nRow = row + dRow;
    const nCol = col + dCol;
    if (nRow < 0 || nRow >= size || nCol < 0 || nCol >= size) {
      continue;
    }
    if (grid[nRow]![nCol]) {
      return false;
    }
  }
  return true;
}

/**
 * Generates a valid Star Battle object placement (ground truth) via randomized backtracking.
 * Exactly `k` objects per row and column; no two objects are Moore-adjacent.
 * Regions are not considered (later generator step).
 */
export function generateGroundTruth(size: number, k: number): boolean[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error(`size must be an integer >= 1, got ${size}`);
  }
  if (!Number.isInteger(k) || k < 1 || k > size) {
    throw new Error(`k must be an integer in [1, size], got ${k}`);
  }

  const grid = createEmptyGrid(size);
  const colCounts = Array.from({ length: size }, () => 0);

  function placeInRow(row: number, starsInRow: number): boolean {
    if (starsInRow === k) {
      return fillRow(row + 1);
    }

    const candidates: number[] = [];
    for (let col = 0; col < size; col += 1) {
      if (canPlace(grid, colCounts, size, k, row, col)) {
        candidates.push(col);
      }
    }
    shuffleInPlace(candidates);

    for (const col of candidates) {
      grid[row]![col] = true;
      colCounts[col]! += 1;

      if (placeInRow(row, starsInRow + 1)) {
        return true;
      }

      grid[row]![col] = false;
      colCounts[col]! -= 1;
    }

    return false;
  }

  function fillRow(row: number): boolean {
    if (row === size) {
      return true;
    }
    return placeInRow(row, 0);
  }

  if (!fillRow(0)) {
    throw new Error(`Failed to generate ground truth for size=${size}, k=${k}`);
  }

  return grid;
}

function collectObjectCells(groundTruth: boolean[][]): Cell[] {
  const cells: Cell[] = [];
  for (let row = 0; row < groundTruth.length; row += 1) {
    for (let col = 0; col < groundTruth[row]!.length; col += 1) {
      if (groundTruth[row]![col]) {
        cells.push({ row, col });
      }
    }
  }
  return cells;
}

function validateGroundTruth(size: number, k: number, groundTruth: boolean[][]): void {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error(`size must be an integer >= 1, got ${size}`);
  }
  if (!Number.isInteger(k) || k < 1 || k > size) {
    throw new Error(`k must be an integer in [1, size], got ${k}`);
  }
  if (groundTruth.length !== size) {
    throw new Error(`groundTruth size mismatch: expected ${size}, got ${groundTruth.length}`);
  }
  for (const row of groundTruth) {
    if (row.length !== size) {
      throw new Error(`groundTruth must be ${size}x${size}`);
    }
  }
  const objects = collectObjectCells(groundTruth);
  if (objects.length !== size * k) {
    throw new Error(
      `groundTruth must contain exactly ${size * k} objects, found ${objects.length}`,
    );
  }
}

/** Assign one seed region ID per object. For k=1, IDs are 0..N-1. For k>1, temporary proto-IDs. */
function assignPerObjectSeedIds(objects: Cell[], size: number, k: number): Map<string, number> {
  const shuffled = [...objects];
  shuffleInPlace(shuffled);
  const seedIds = new Map<string, number>();

  if (k === 1) {
    for (let regionId = 0; regionId < size; regionId += 1) {
      const cell = shuffled[regionId]!;
      seedIds.set(cellKey(cell.row, cell.col), regionId);
    }
    return seedIds;
  }

  for (let i = 0; i < shuffled.length; i += 1) {
    const cell = shuffled[i]!;
    seedIds.set(cellKey(cell.row, cell.col), i);
  }
  return seedIds;
}

function getOrthoNeighbors(row: number, col: number, size: number): Cell[] {
  const neighbors: Cell[] = [];
  for (const [dRow, dCol] of ORTHO_OFFSETS) {
    const nRow = row + dRow;
    const nCol = col + dCol;
    if (nRow < 0 || nRow >= size || nCol < 0 || nCol >= size) {
      continue;
    }
    neighbors.push({ row: nRow, col: nCol });
  }
  return neighbors;
}

function areAllRegionsContiguous(regionGrid: number[][]): boolean {
  const size = regionGrid.length;
  const regions = new Map<number, Cell[]>();

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const regionId = regionGrid[row]![col]!;
      if (regionId === UNASSIGNED) {
        return false;
      }
      const cells = regions.get(regionId) ?? [];
      cells.push({ row, col });
      regions.set(regionId, cells);
    }
  }

  if (regions.size !== size) {
    return false;
  }

  for (const cells of regions.values()) {
    const cellSet = new Set(cells.map((c) => cellKey(c.row, c.col)));
    const start = cells[0]!;
    const visited = new Set<string>();
    const queue: Cell[] = [start];
    visited.add(cellKey(start.row, start.col));

    while (queue.length > 0) {
      const current = queue.pop()!;
      for (const neighbor of getOrthoNeighbors(current.row, current.col, size)) {
        const key = cellKey(neighbor.row, neighbor.col);
        if (!cellSet.has(key) || visited.has(key)) {
          continue;
        }
        visited.add(key);
        queue.push(neighbor);
      }
    }

    if (visited.size !== cells.length) {
      return false;
    }
  }

  return true;
}

function floodFillFromSeeds(
  size: number,
  seedCells: Cell[],
  seedIds: Map<string, number>,
  frozenRegionIds: ReadonlySet<number> = new Set(),
): number[][] {
  const regionGrid = createUnassignedRegionGrid(size);

  for (const [key, regionId] of seedIds) {
    const [rowStr, colStr] = key.split(',');
    regionGrid[Number(rowStr)]![Number(colStr)] = regionId;
  }

  const rebuildFrontier = (): Set<string> => {
    const next = new Set<string>();
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (regionGrid[row]![col] !== UNASSIGNED) {
          continue;
        }
        for (const neighbor of getOrthoNeighbors(row, col, size)) {
          const neighborId = regionGrid[neighbor.row]![neighbor.col]!;
          if (neighborId !== UNASSIGNED && !frozenRegionIds.has(neighborId)) {
            next.add(cellKey(row, col));
            break;
          }
        }
      }
    }
    return next;
  };

  let frontierKeys = rebuildFrontier();
  let remaining = size * size - seedCells.length;

  while (remaining > 0) {
    if (frontierKeys.size === 0) {
      frontierKeys = rebuildFrontier();
      if (frontierKeys.size === 0) {
        throw new Error('Region growth stalled: frontier empty with unassigned cells remaining');
      }
    }

    const frontierList = [...frontierKeys];
    const pick = frontierList[Math.floor(Math.random() * frontierList.length)]!;
    const [rowStr, colStr] = pick.split(',');
    const row = Number(rowStr);
    const col = Number(colStr);

    const adjacentRegionIds: number[] = [];
    for (const neighbor of getOrthoNeighbors(row, col, size)) {
      const regionId = regionGrid[neighbor.row]![neighbor.col]!;
      if (regionId !== UNASSIGNED && !frozenRegionIds.has(regionId)) {
        adjacentRegionIds.push(regionId);
      }
    }

    if (adjacentRegionIds.length === 0) {
      frontierKeys.delete(pick);
      continue;
    }

    const chosenId = adjacentRegionIds[Math.floor(Math.random() * adjacentRegionIds.length)]!;
    regionGrid[row]![col] = chosenId;
    frontierKeys.delete(pick);
    remaining -= 1;

    for (const neighbor of getOrthoNeighbors(row, col, size)) {
      if (regionGrid[neighbor.row]![neighbor.col] === UNASSIGNED) {
        frontierKeys.add(cellKey(neighbor.row, neighbor.col));
      }
    }
  }

  return regionGrid;
}

function countObjectsByRegion(
  regionGrid: number[][],
  groundTruth: boolean[][],
): Map<number, number> {
  const counts = new Map<number, number>();
  const size = regionGrid.length;
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (!groundTruth[row]![col]) {
        continue;
      }
      const regionId = regionGrid[row]![col]!;
      counts.set(regionId, (counts.get(regionId) ?? 0) + 1);
    }
  }
  return counts;
}

function buildRegionAdjacency(regionGrid: number[][]): Map<number, Set<number>> {
  const size = regionGrid.length;
  const adjacency = new Map<number, Set<number>>();

  const ensure = (id: number) => {
    if (!adjacency.has(id)) {
      adjacency.set(id, new Set());
    }
  };

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const id = regionGrid[row]![col]!;
      ensure(id);
      for (const neighbor of getOrthoNeighbors(row, col, size)) {
        const other = regionGrid[neighbor.row]![neighbor.col]!;
        if (other !== id) {
          ensure(other);
          adjacency.get(id)!.add(other);
          adjacency.get(other)!.add(id);
        }
      }
    }
  }

  return adjacency;
}

function remapRegionIds(regionGrid: number[][]): number[][] {
  const size = regionGrid.length;
  const remap = new Map<number, number>();
  let nextId = 0;
  const result = createUnassignedRegionGrid(size);

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const oldId = regionGrid[row]![col]!;
      let newId = remap.get(oldId);
      if (newId === undefined) {
        newId = nextId;
        nextId += 1;
        remap.set(oldId, newId);
      }
      result[row]![col] = newId;
    }
  }

  return result;
}

/**
 * Randomly merges adjacent proto-regions until there are exactly `size` regions,
 * each containing exactly `k` ground-truth objects. Preserves orthogonality/contiguity.
 */
function mergeRegionsToTarget(
  regionGrid: number[][],
  groundTruth: boolean[][],
  size: number,
  k: number,
): number[][] | null {
  const objectCounts = countObjectsByRegion(regionGrid, groundTruth);
  let adjacency = buildRegionAdjacency(regionGrid);
  let regionCount = objectCounts.size;

  while (regionCount > size) {
    const candidates: Array<[number, number]> = [];
    const ids = [...objectCounts.keys()];

    for (let i = 0; i < ids.length; i += 1) {
      const a = ids[i]!;
      const neighbors = adjacency.get(a);
      if (!neighbors) {
        continue;
      }
      for (const b of neighbors) {
        if (a >= b) {
          continue;
        }
        const total = (objectCounts.get(a) ?? 0) + (objectCounts.get(b) ?? 0);
        if (total <= k) {
          candidates.push([a, b]);
        }
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    shuffleInPlace(candidates);
    const [keepId, dropId] = candidates[0]!;

    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (regionGrid[row]![col] === dropId) {
          regionGrid[row]![col] = keepId;
        }
      }
    }

    objectCounts.set(
      keepId,
      (objectCounts.get(keepId) ?? 0) + (objectCounts.get(dropId) ?? 0),
    );
    objectCounts.delete(dropId);
    regionCount -= 1;
    adjacency = buildRegionAdjacency(regionGrid);
  }

  for (const count of objectCounts.values()) {
    if (count !== k) {
      return null;
    }
  }

  return remapRegionIds(regionGrid);
}

function tryGrowRegions(
  size: number,
  k: number,
  groundTruth: boolean[][],
  options?: { freezeSingletonCount?: number },
): number[][] | null {
  const objects = collectObjectCells(groundTruth);
  const freezeCount = Math.min(
    options?.freezeSingletonCount ?? 0,
    k === 1 ? objects.length - 1 : 0,
  );

  if (freezeCount > 0 && k === 1) {
    const shuffled = [...objects];
    shuffleInPlace(shuffled);
    const seedIds = new Map<string, number>();
    for (let regionId = 0; regionId < size; regionId += 1) {
      const cell = shuffled[regionId]!;
      seedIds.set(cellKey(cell.row, cell.col), regionId);
    }
    const frozenRegionIds = new Set<number>();
    for (let regionId = 0; regionId < freezeCount; regionId += 1) {
      frozenRegionIds.add(regionId);
    }
    const regionGrid = floodFillFromSeeds(size, objects, seedIds, frozenRegionIds);
    return remapRegionIds(regionGrid);
  }

  const seedIds = assignPerObjectSeedIds(objects, size, k);
  const regionGrid = floodFillFromSeeds(size, objects, seedIds);

  if (k === 1) {
    return remapRegionIds(regionGrid);
  }

  return mergeRegionsToTarget(regionGrid, groundTruth, size, k);
}

/**
 * Grows N orthogonally contiguous regions around ground-truth object seeds.
 * For k=1 each object is its own region seed. For k>1, grows one proto-region per
 * object via randomized flood fill, then randomly merges adjacent proto-regions into
 * N regions of exactly k objects each (guaranteeing contiguity).
 *
 * `freezeSingletonCount` (k=1 only) keeps that many regions as single cells —
 * Hidden Single force-starters that make deductively solvable puzzles much more likely.
 */
export function growRegions(
  size: number,
  k: number,
  groundTruth: boolean[][],
  options?: { freezeSingletonCount?: number },
): number[][] {
  validateGroundTruth(size, k, groundTruth);

  for (let attempt = 0; attempt < MAX_GROW_ATTEMPTS; attempt += 1) {
    const regionGrid = tryGrowRegions(size, k, groundTruth, options);
    if (regionGrid && areAllRegionsContiguous(regionGrid)) {
      return regionGrid;
    }
  }

  throw new Error(
    `Failed to grow contiguous regions for size=${size}, k=${k} after ${MAX_GROW_ATTEMPTS} attempts`,
  );
}

function cloneRegionGrid(regionGrid: number[][]): number[][] {
  return regionGrid.map((row) => [...row]);
}

function gridFingerprint(regionGrid: number[][]): string {
  return JSON.stringify(regionGrid);
}

function shortHash(fingerprint: string): string {
  let hash = 2166136261;
  for (let i = 0; i < fingerprint.length; i += 1) {
    hash ^= fingerprint.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function matchesTargetDifficulty(
  size: number,
  k: number,
  regionGrid: number[][],
  targetDifficulty: Difficulty,
): boolean {
  const full = solve(size, k, regionGrid);
  if (!full.isSolvable) {
    return false;
  }

  const basicOnly = solve(size, k, regionGrid, {
    useIntersectionPatterns: false,
    useGeometryConstraints: false,
    useSectorCapture: false,
  });

  if (targetDifficulty === 'easy') {
    return basicOnly.isSolvable;
  }

  const upToIntersection = solve(size, k, regionGrid, {
    useGeometryConstraints: false,
    useSectorCapture: false,
  });

  if (targetDifficulty === 'medium') {
    return !basicOnly.isSolvable && upToIntersection.isSolvable;
  }

  // hard: full solve works, but basic+intersection alone is not enough
  return !upToIntersection.isSolvable;
}

function collectExistingFingerprints(existingGrids?: number[][][]): Set<string> {
  const fingerprints = new Set<string>();
  const manager = new LevelManager();

  for (const difficulty of DIFFICULTY_ORDER) {
    for (const level of manager.getAllLevels(difficulty)) {
      fingerprints.add(gridFingerprint(level.grid));
    }
  }

  for (const grid of existingGrids ?? []) {
    fingerprints.add(gridFingerprint(grid));
  }

  return fingerprints;
}

function collectBorderMutationCandidates(
  regionGrid: number[][],
  groundTruth: boolean[][],
): Array<{ row: number; col: number; neighborRegionIds: number[] }> {
  const size = regionGrid.length;
  const candidates: Array<{ row: number; col: number; neighborRegionIds: number[] }> = [];

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (groundTruth[row]![col]) {
        continue;
      }

      const currentId = regionGrid[row]![col]!;
      const neighborRegionIds = new Set<number>();
      for (const neighbor of getOrthoNeighbors(row, col, size)) {
        const neighborId = regionGrid[neighbor.row]![neighbor.col]!;
        if (neighborId !== currentId) {
          neighborRegionIds.add(neighborId);
        }
      }

      if (neighborRegionIds.size > 0) {
        candidates.push({ row, col, neighborRegionIds: [...neighborRegionIds] });
      }
    }
  }

  return candidates;
}

/**
 * Attempts one safe border mutation: move a non-object border cell into a neighboring region
 * without breaking contiguity of any region.
 */
function tryMutateBorder(
  regionGrid: number[][],
  groundTruth: boolean[][],
): number[][] | null {
  const candidates = collectBorderMutationCandidates(regionGrid, groundTruth);
  shuffleInPlace(candidates);

  for (const candidate of candidates) {
    const neighborIds = [...candidate.neighborRegionIds];
    shuffleInPlace(neighborIds);

    for (const targetId of neighborIds) {
      const mutated = cloneRegionGrid(regionGrid);
      mutated[candidate.row]![candidate.col] = targetId;
      if (areAllRegionsContiguous(mutated)) {
        return mutated;
      }
    }
  }

  return null;
}

function isFullySolvable(size: number, k: number, regionGrid: number[][]): boolean {
  return solve(size, k, regionGrid).isSolvable;
}

/**
 * Tries several random border mutations. When `requireSolvable` is true, only returns
 * a mutation that remains uniquely deductively solvable.
 */
function trySolvabilityAwareMutation(
  regionGrid: number[][],
  groundTruth: boolean[][],
  size: number,
  k: number,
  requireSolvable: boolean,
  maxTries = 40,
): number[][] | null {
  for (let attempt = 0; attempt < maxTries; attempt += 1) {
    const mutated = tryMutateBorder(regionGrid, groundTruth);
    if (!mutated) {
      return null;
    }
    if (!requireSolvable || isFullySolvable(size, k, mutated)) {
      return mutated;
    }
  }
  return null;
}

/** How many singleton force-starters to freeze for an initial solvable-biased board. */
function initialFreezeSingletonCount(
  size: number,
  k: number,
  targetDifficulty: Difficulty,
): number {
  if (k !== 1) {
    return 0;
  }
  if (targetDifficulty === 'easy') {
    return size <= 6 ? 1 : Math.max(1, Math.floor(size * 0.5));
  }
  // medium/hard: start highly constrained, then climb difficulty via mutations
  return Math.max(1, Math.floor(size * 0.8));
}

function toLevelData(
  size: number,
  k: number,
  targetDifficulty: Difficulty,
  regionGrid: number[][],
): LevelData {
  const fingerprint = gridFingerprint(regionGrid);
  return {
    id: `generated_${targetDifficulty}_${shortHash(fingerprint)}`,
    size,
    k,
    difficulty: targetDifficulty,
    grid: regionGrid,
  };
}

export interface GenerateLevelOptions {
  existingGrids?: number[][][];
  maxBoardAttempts?: number;
  maxMutationsPerBoard?: number;
}

/**
 * Full level pipeline: ground truth → region growth → solver validation with
 * difficulty-tier matching. On stall, applies safe border mutations; after enough
 * failed mutations, discards the board and regenerates.
 */
export function generateLevel(
  size: number,
  k: number,
  targetDifficulty: Difficulty,
  options?: GenerateLevelOptions,
): LevelData {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error(`size must be an integer >= 1, got ${size}`);
  }
  if (!Number.isInteger(k) || k < 1 || k > size) {
    throw new Error(`k must be an integer in [1, size], got ${k}`);
  }

  const maxBoardAttempts = options?.maxBoardAttempts ?? DEFAULT_MAX_BOARD_ATTEMPTS;
  const maxMutationsPerBoard =
    options?.maxMutationsPerBoard ?? DEFAULT_MAX_MUTATIONS_PER_BOARD;
  const seenFingerprints = collectExistingFingerprints(options?.existingGrids);
  const freezeSingletonCount = initialFreezeSingletonCount(size, k, targetDifficulty);

  for (let boardAttempt = 0; boardAttempt < maxBoardAttempts; boardAttempt += 1) {
    const groundTruth = generateGroundTruth(size, k);
    let regionGrid = growRegions(size, k, groundTruth, { freezeSingletonCount });

    // Prefer starting from a solvable board when we have force-starters available.
    if (freezeSingletonCount > 0 && !isFullySolvable(size, k, regionGrid)) {
      let recovered: number[][] | null = null;
      for (let retry = 0; retry < 15; retry += 1) {
        const candidate = growRegions(size, k, groundTruth, { freezeSingletonCount });
        if (isFullySolvable(size, k, candidate)) {
          recovered = candidate;
          break;
        }
      }
      if (!recovered) {
        continue;
      }
      regionGrid = recovered;
    }

    for (let mutation = 0; mutation <= maxMutationsPerBoard; mutation += 1) {
      const fingerprint = gridFingerprint(regionGrid);

      if (!seenFingerprints.has(fingerprint)) {
        if (matchesTargetDifficulty(size, k, regionGrid, targetDifficulty)) {
          return toLevelData(size, k, targetDifficulty, regionGrid);
        }
      }

      if (mutation === maxMutationsPerBoard) {
        break;
      }

      const currentlySolvable = isFullySolvable(size, k, regionGrid);
      const mutated = trySolvabilityAwareMutation(
        regionGrid,
        groundTruth,
        size,
        k,
        currentlySolvable,
      );
      if (!mutated) {
        break;
      }
      regionGrid = mutated;
    }
  }

  throw new Error(
    `Failed to generate a ${targetDifficulty} level for size=${size}, k=${k} after ${maxBoardAttempts} board attempts`,
  );
}




