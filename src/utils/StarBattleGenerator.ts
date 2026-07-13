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

function createEmptyGrid(size: number): boolean[][] {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => false));
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
