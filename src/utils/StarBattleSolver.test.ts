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

    const result = solve(6, 1, BASIC_RULES_6X6_GRID);

    expect(result.isSolvable).toBe(true);
    expect(result.difficultyScore).toBeGreaterThan(0);
    expect(countStatus(result.finalState, 'Unknown')).toBe(0);
    expect(countStatus(result.finalState, 'Object')).toBe(6);
    assertExactlyKPerZone(result.finalState, 1);
    assertNoMooreAdjacentObjects(result.finalState);
  });
});
