import { describe, expect, it } from 'vitest';
import { generateGroundTruth } from './StarBattleGenerator';

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
});
