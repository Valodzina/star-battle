import { describe, expect, it } from 'vitest';
import { solve, type SolverCell } from './StarBattleSolver';

/**
 * Topologically valid 6×6 (K=1) region grid.
 * All region IDs are orthogonally contiguous; region 0 is a singleton
 * so Hidden Single starts a full basic-rules cascade.
 */
const BASIC_RULES_6X6_GRID: number[][] = [
  [0, 1, 1, 2, 2, 5],
  [3, 3, 1, 2, 2, 5],
  [3, 3, 4, 4, 2, 5],
  [3, 3, 4, 4, 5, 5],
  [5, 5, 4, 4, 5, 5],
  [5, 5, 5, 5, 5, 5],
];

/**
 * Topologically valid 10×10 (K=1) region grid that stalls under basic rules
 * alone and requires Pointing/Claiming intersection patterns to finish.
 */
const INTERSECTION_10X10_GRID: number[][] = [
  [1, 1, 1, 1, 2, 2, 2, 2, 2, 2],
  [1, 1, 1, 1, 2, 3, 3, 3, 3, 3],
  [8, 1, 1, 1, 1, 1, 1, 3, 4, 3],
  [8, 1, 1, 1, 1, 1, 1, 1, 4, 3],
  [8, 8, 1, 1, 1, 1, 1, 1, 4, 4],
  [8, 8, 8, 8, 8, 1, 1, 9, 9, 5],
  [0, 8, 8, 8, 9, 1, 9, 9, 9, 5],
  [0, 0, 0, 9, 9, 9, 9, 9, 6, 5],
  [0, 0, 0, 9, 9, 7, 7, 7, 6, 6],
  [0, 0, 0, 9, 9, 7, 7, 6, 6, 6],
];

/**
 * Contiguous 4×4 (K=2) where every region is a 2×2 block.
 * Packing capacity per region is 1, so K=2 is impossible — detected only
 * when geometry constraints are enabled.
 */
const PACKING_UNSOLVABLE_4X4_GRID: number[][] = [
  [0, 0, 1, 1],
  [0, 0, 1, 1],
  [2, 2, 3, 3],
  [2, 2, 3, 3],
];

/**
 * Contiguous 10×10 (K=2) that stalls under basic + intersection rules and
 * requires geometry / packing / single-step contradiction to finish.
 */
const GEOMETRY_10X10_GRID: number[][] = [
  [1, 1, 1, 1, 4, 4, 4, 5, 5, 5],
  [1, 1, 1, 4, 4, 4, 5, 5, 5, 5],
  [2, 2, 1, 7, 4, 4, 5, 5, 5, 5],
  [2, 2, 7, 7, 4, 4, 4, 4, 5, 6],
  [2, 2, 2, 7, 4, 4, 4, 4, 6, 6],
  [2, 2, 2, 8, 4, 4, 9, 9, 9, 6],
  [2, 2, 8, 8, 8, 4, 9, 9, 9, 9],
  [3, 8, 8, 8, 8, 4, 4, 9, 0, 0],
  [3, 8, 8, 8, 8, 8, 9, 9, 0, 0],
  [3, 3, 3, 8, 8, 8, 8, 9, 0, 0],
];

/**
 * Contiguous 6×6 (K=1) where regions 0 and 1 are confined to the top two rows.
 * Sector Capture is required; basic/intersection/geometry alone stall.
 */
const SECTOR_CAPTURE_6X6_GRID: number[][] = [
  [0, 0, 0, 1, 1, 2],
  [0, 1, 1, 1, 2, 2],
  [3, 3, 3, 4, 2, 5],
  [3, 4, 4, 4, 5, 5],
  [3, 4, 5, 5, 5, 5],
  [3, 3, 5, 5, 5, 5],
];

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

function countStatus(board: SolverCell[][], status: SolverCell['status']): number {
  return board.flat().filter((cell) => cell.status === status).length;
}

function objectCells(board: SolverCell[][]): SolverCell[] {
  return board.flat().filter((cell) => cell.status === 'Object');
}

function assertExactlyKPerZone(board: SolverCell[][], k: number): void {
  const size = board.length;

  for (let row = 0; row < size; row += 1) {
    const count = board[row]!.filter((cell) => cell.status === 'Object').length;
    expect(count, `row ${row}`).toBe(k);
  }

  for (let col = 0; col < size; col += 1) {
    const count = board.filter((row) => row[col]!.status === 'Object').length;
    expect(count, `col ${col}`).toBe(k);
  }

  const regionCounts = new Map<number, number>();
  for (const cell of board.flat()) {
    if (cell.status === 'Object') {
      regionCounts.set(cell.regionId, (regionCounts.get(cell.regionId) ?? 0) + 1);
    }
  }
  for (const [regionId, count] of regionCounts) {
    expect(count, `region ${regionId}`).toBe(k);
  }
}

function assertNoMooreAdjacentObjects(board: SolverCell[][]): void {
  for (const cell of objectCells(board)) {
    for (const [dRow, dCol] of MOORE_OFFSETS) {
      const neighbor = board[cell.row + dRow]?.[cell.col + dCol];
      if (neighbor?.status === 'Object') {
        expect.fail(
          `Objects at (${cell.row},${cell.col}) and (${neighbor.row},${neighbor.col}) are Moore-adjacent`,
        );
      }
    }
  }
}

function assertRegionsContiguous(grid: number[][]): void {
  const size = grid.length;
  const regions = new Map<number, Array<{ row: number; col: number }>>();
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const regionId = grid[row]![col]!;
      const cells = regions.get(regionId) ?? [];
      cells.push({ row, col });
      regions.set(regionId, cells);
    }
  }

  const ortho: ReadonlyArray<readonly [number, number]> = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  for (const [regionId, cells] of regions) {
    const key = (row: number, col: number) => `${row},${col}`;
    const cellSet = new Set(cells.map((c) => key(c.row, c.col)));
    const start = cells[0]!;
    const visited = new Set<string>();
    const queue = [start];
    visited.add(key(start.row, start.col));

    while (queue.length > 0) {
      const current = queue.pop()!;
      for (const [dRow, dCol] of ortho) {
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

describe('StarBattleSolver', () => {
  it('solves a topologically valid 6x6 K=1 grid using only basic deductive rules', () => {
    assertRegionsContiguous(BASIC_RULES_6X6_GRID);

    const result = solve(6, 1, BASIC_RULES_6X6_GRID, {
      useIntersectionPatterns: false,
      useGeometryConstraints: false,
      useSectorCapture: false,
    });

    expect(result.isSolvable).toBe(true);
    expect(result.tiersUsed).toEqual(['basic']);
    expect(result.difficultyScore).toBe(1);
    expect(countStatus(result.finalState, 'Unknown')).toBe(0);
    expect(countStatus(result.finalState, 'Object')).toBe(6);
    assertExactlyKPerZone(result.finalState, 1);
    assertNoMooreAdjacentObjects(result.finalState);
  });

  it('stalls on a 10x10 K=1 grid when intersection patterns are disabled', () => {
    assertRegionsContiguous(INTERSECTION_10X10_GRID);

    const result = solve(10, 1, INTERSECTION_10X10_GRID, {
      useIntersectionPatterns: false,
      useSectorCapture: false,
    });

    expect(result.isSolvable).toBe(false);
    expect(countStatus(result.finalState, 'Unknown')).toBeGreaterThan(0);
  });

  it('solves the same 10x10 K=1 grid when intersection patterns are enabled', () => {
    assertRegionsContiguous(INTERSECTION_10X10_GRID);

    const result = solve(10, 1, INTERSECTION_10X10_GRID, {
      useGeometryConstraints: false,
      useSectorCapture: false,
    });

    expect(result.isSolvable).toBe(true);
    expect(result.tiersUsed).toContain('intersection');
    expect(result.difficultyScore).toBeGreaterThanOrEqual(5);
    expect(countStatus(result.finalState, 'Unknown')).toBe(0);
    expect(countStatus(result.finalState, 'Object')).toBe(10);
    assertExactlyKPerZone(result.finalState, 1);
    assertNoMooreAdjacentObjects(result.finalState);
  });

  it('stalls on a 4x4 K=2 packing-impossible grid without geometry constraints', () => {
    assertRegionsContiguous(PACKING_UNSOLVABLE_4X4_GRID);

    const result = solve(4, 2, PACKING_UNSOLVABLE_4X4_GRID, {
      useGeometryConstraints: false,
      useSectorCapture: false,
    });

    expect(result.isSolvable).toBe(false);
    expect(countStatus(result.finalState, 'Unknown')).toBeGreaterThan(0);
  });

  it('marks the 4x4 K=2 packing-impossible grid unsolvable with geometry constraints', () => {
    assertRegionsContiguous(PACKING_UNSOLVABLE_4X4_GRID);

    const result = solve(4, 2, PACKING_UNSOLVABLE_4X4_GRID);

    expect(result.isSolvable).toBe(false);
    expect(result.tiersUsed).toContain('geometry');
  });

  it('stalls on a 10x10 K=2 grid when geometry constraints are disabled', () => {
    assertRegionsContiguous(GEOMETRY_10X10_GRID);

    const result = solve(10, 2, GEOMETRY_10X10_GRID, {
      useIntersectionPatterns: true,
      useGeometryConstraints: false,
      useSectorCapture: false,
    });

    expect(result.isSolvable).toBe(false);
    expect(countStatus(result.finalState, 'Unknown')).toBeGreaterThan(0);
  });

  it('solves the same 10x10 K=2 grid when geometry constraints are enabled', () => {
    assertRegionsContiguous(GEOMETRY_10X10_GRID);

    const result = solve(10, 2, GEOMETRY_10X10_GRID, {
      useSectorCapture: false,
    });

    expect(result.isSolvable).toBe(true);
    expect(result.tiersUsed).toContain('geometry');
    expect(result.difficultyScore).toBeGreaterThanOrEqual(10);
    expect(countStatus(result.finalState, 'Unknown')).toBe(0);
    expect(countStatus(result.finalState, 'Object')).toBe(20);
    assertExactlyKPerZone(result.finalState, 2);
    assertNoMooreAdjacentObjects(result.finalState);
  });

  it('stalls on a 6x6 K=1 grid when sector capture is disabled', () => {
    assertRegionsContiguous(SECTOR_CAPTURE_6X6_GRID);

    const result = solve(6, 1, SECTOR_CAPTURE_6X6_GRID, {
      useSectorCapture: false,
    });

    expect(result.isSolvable).toBe(false);
    expect(countStatus(result.finalState, 'Unknown')).toBeGreaterThan(0);
  });

  it('solves the same 6x6 K=1 grid using sector capture and scores >= 20', () => {
    assertRegionsContiguous(SECTOR_CAPTURE_6X6_GRID);

    const result = solve(6, 1, SECTOR_CAPTURE_6X6_GRID, {
      useIntersectionPatterns: false,
      useGeometryConstraints: false,
    });

    expect(result.isSolvable).toBe(true);
    expect(result.tiersUsed).toContain('sector');
    expect(result.difficultyScore).toBeGreaterThanOrEqual(20);
    expect(countStatus(result.finalState, 'Unknown')).toBe(0);
    expect(countStatus(result.finalState, 'Object')).toBe(6);
    assertExactlyKPerZone(result.finalState, 1);
    assertNoMooreAdjacentObjects(result.finalState);
  });
});
