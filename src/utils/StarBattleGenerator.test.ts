import { describe, expect, it } from 'vitest';
import { generateGroundTruth, growRegions } from './StarBattleGenerator';

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

function countObjects(grid: boolean[][]): number {
  return grid.flat().filter(Boolean).length;
}

function assertExactlyKPerRowAndCol(grid: boolean[][], k: number): void {
  const size = grid.length;

  for (let row = 0; row < size; row += 1) {
    const count = grid[row]!.filter(Boolean).length;
    expect(count, `row ${row}`).toBe(k);
  }

  for (let col = 0; col < size; col += 1) {
    const count = grid.filter((row) => row[col]).length;
    expect(count, `col ${col}`).toBe(k);
  }
}

function assertNoMooreAdjacentObjects(grid: boolean[][]): void {
  const size = grid.length;
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (!grid[row]![col]) {
        continue;
      }
      for (const [dRow, dCol] of MOORE_OFFSETS) {
        const nRow = row + dRow;
        const nCol = col + dCol;
        if (nRow < 0 || nRow >= size || nCol < 0 || nCol >= size) {
          continue;
        }
        if (grid[nRow]![nCol]) {
          expect.fail(
            `Objects at (${row},${col}) and (${nRow},${nCol}) are Moore-adjacent`,
          );
        }
      }
    }
  }
}

function assertValidGroundTruth(grid: boolean[][], size: number, k: number): void {
  expect(grid).toHaveLength(size);
  for (const row of grid) {
    expect(row).toHaveLength(size);
  }
  expect(countObjects(grid)).toBe(size * k);
  assertExactlyKPerRowAndCol(grid, k);
  assertNoMooreAdjacentObjects(grid);
}

function assertRegionsContiguous(regionGrid: number[][]): void {
  const size = regionGrid.length;
  const regions = new Map<number, Array<{ row: number; col: number }>>();

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const regionId = regionGrid[row]![col]!;
      expect(regionId).toBeGreaterThanOrEqual(0);
      const cells = regions.get(regionId) ?? [];
      cells.push({ row, col });
      regions.set(regionId, cells);
    }
  }

  expect(regions.size).toBe(size);

  for (const [regionId, cells] of regions) {
    const key = (row: number, col: number) => `${row},${col}`;
    const cellSet = new Set(cells.map((c) => key(c.row, c.col)));
    const start = cells[0]!;
    const visited = new Set<string>();
    const queue = [start];
    visited.add(key(start.row, start.col));

    while (queue.length > 0) {
      const current = queue.pop()!;
      for (const [dRow, dCol] of ORTHO_OFFSETS) {
        const nextRow = current.row + dRow;
        const nextCol = current.col + dCol;
        const nextKey = key(nextRow, nextCol);
        if (!cellSet.has(nextKey) || visited.has(nextKey)) {
          continue;
        }
        visited.add(nextKey);
        queue.push({ row: nextRow, col: nextCol });
      }
    }

    expect(visited.size, `region ${regionId} contiguity`).toBe(cells.length);
  }
}

function assertExactlyKObjectsPerRegion(
  regionGrid: number[][],
  groundTruth: boolean[][],
  k: number,
): void {
  const size = regionGrid.length;
  const counts = new Map<number, number>();

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (!groundTruth[row]![col]) {
        continue;
      }
      const regionId = regionGrid[row]![col]!;
      counts.set(regionId, (counts.get(regionId) ?? 0) + 1);
    }
  }

  expect(counts.size).toBe(size);
  for (const [regionId, count] of counts) {
    expect(count, `region ${regionId} object count`).toBe(k);
  }
}

function assertValidRegionGrid(
  regionGrid: number[][],
  groundTruth: boolean[][],
  size: number,
  k: number,
): void {
  expect(regionGrid).toHaveLength(size);
  for (const row of regionGrid) {
    expect(row).toHaveLength(size);
  }
  assertRegionsContiguous(regionGrid);
  assertExactlyKObjectsPerRegion(regionGrid, groundTruth, k);
}

describe('StarBattleGenerator', () => {
  it.each([
    { size: 6, k: 1 },
    { size: 10, k: 1 },
    { size: 10, k: 2 },
  ])('generates a valid ground truth for $size x $size with k=$k', ({ size, k }) => {
    const grid = generateGroundTruth(size, k);
    assertValidGroundTruth(grid, size, k);
  });

  it('produces varied results across multiple runs (randomness smoke check)', () => {
    const grids = Array.from({ length: 8 }, () => generateGroundTruth(10, 1));
    for (const grid of grids) {
      assertValidGroundTruth(grid, 10, 1);
    }
    const unique = new Set(grids.map((g) => JSON.stringify(g)));
    expect(unique.size).toBeGreaterThan(1);
  });

  it('throws on invalid size or k', () => {
    expect(() => generateGroundTruth(0, 1)).toThrow();
    expect(() => generateGroundTruth(6, 0)).toThrow();
    expect(() => generateGroundTruth(6, 7)).toThrow();
  });

  describe('growRegions', () => {
    it.each([
      { size: 6, k: 1 },
      { size: 10, k: 1 },
      { size: 10, k: 2 },
    ])(
      'grows contiguous regions for $size x $size with k=$k',
      ({ size, k }) => {
        const groundTruth = generateGroundTruth(size, k);
        const regionGrid = growRegions(size, k, groundTruth);
        assertValidRegionGrid(regionGrid, groundTruth, size, k);
      },
    );

    it('produces varied region layouts across runs', () => {
      const groundTruth = generateGroundTruth(10, 1);
      const layouts = Array.from({ length: 8 }, () => growRegions(10, 1, groundTruth));
      for (const regionGrid of layouts) {
        assertValidRegionGrid(regionGrid, groundTruth, 10, 1);
      }
      const unique = new Set(layouts.map((g) => JSON.stringify(g)));
      expect(unique.size).toBeGreaterThan(1);
    });
  });
});
