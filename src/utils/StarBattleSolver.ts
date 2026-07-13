export type SolverCellStatus = 'Unknown' | 'Empty' | 'Object';

export interface SolverCell {
  row: number;
  col: number;
  regionId: number;
  status: SolverCellStatus;
}

export interface SolverResult {
  isSolvable: boolean;
  difficultyScore: number;
  finalState: SolverCell[][];
}

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

export function solve(size: number, k: number, regionGrid: number[][]): SolverResult {
  const board: SolverCell[][] = regionGrid.map((row, rowIndex) =>
    row.map((regionId, colIndex) => ({
      row: rowIndex,
      col: colIndex,
      regionId,
      status: 'Unknown' as const,
    })),
  );

  const rows: SolverCell[][] = board;
  const cols: SolverCell[][] = Array.from({ length: size }, (_, col) =>
    board.map((row) => row[col]!),
  );
  const regions = new Map<number, SolverCell[]>();
  for (const row of board) {
    for (const cell of row) {
      const cells = regions.get(cell.regionId);
      if (cells) {
        cells.push(cell);
      } else {
        regions.set(cell.regionId, [cell]);
      }
    }
  }

  const zones: SolverCell[][] = [...rows, ...cols, ...regions.values()];

  let hasChanged = true;
  let contradiction = false;
  let difficultyScore = 0;

  const setEmpty = (cell: SolverCell): void => {
    if (cell.status === 'Object') {
      contradiction = true;
      return;
    }
    if (cell.status !== 'Unknown') {
      return;
    }
    cell.status = 'Empty';
    hasChanged = true;
    difficultyScore += 1;
  };

  const applyMooreHalo = (center: SolverCell): void => {
    for (const [dRow, dCol] of MOORE_OFFSETS) {
      const neighbor = board[center.row + dRow]?.[center.col + dCol];
      if (!neighbor) {
        continue;
      }
      if (neighbor.status === 'Object') {
        contradiction = true;
        return;
      }
      setEmpty(neighbor);
    }
  };

  const setObject = (cell: SolverCell): void => {
    if (cell.status === 'Empty') {
      contradiction = true;
      return;
    }
    if (cell.status !== 'Unknown') {
      return;
    }
    cell.status = 'Object';
    hasChanged = true;
    difficultyScore += 1;
    applyMooreHalo(cell);
  };

  const zoneStats = (zone: SolverCell[]): { objectCount: number; unknownCount: number } => {
    let objectCount = 0;
    let unknownCount = 0;
    for (const cell of zone) {
      if (cell.status === 'Object') {
        objectCount += 1;
      } else if (cell.status === 'Unknown') {
        unknownCount += 1;
      }
    }
    return { objectCount, unknownCount };
  };

  const checkZoneContradictions = (): void => {
    for (const zone of zones) {
      const { objectCount, unknownCount } = zoneStats(zone);
      if (objectCount > k || objectCount + unknownCount < k) {
        contradiction = true;
        return;
      }
    }
  };

  const applyZoneExhaustion = (): void => {
    for (const zone of zones) {
      const { objectCount } = zoneStats(zone);
      if (objectCount !== k) {
        continue;
      }
      for (const cell of zone) {
        if (cell.status === 'Unknown') {
          setEmpty(cell);
          if (contradiction) {
            return;
          }
        }
      }
    }
  };

  const applyHiddenSingles = (): void => {
    for (const zone of zones) {
      const { objectCount, unknownCount } = zoneStats(zone);
      const missing = k - objectCount;
      if (missing <= 0 || unknownCount !== missing) {
        continue;
      }
      for (const cell of zone) {
        if (cell.status === 'Unknown') {
          setObject(cell);
          if (contradiction) {
            return;
          }
        }
      }
    }
  };

  while (hasChanged && !contradiction) {
    hasChanged = false;
    applyZoneExhaustion();
    if (contradiction) {
      break;
    }
    applyHiddenSingles();
    if (contradiction) {
      break;
    }
    checkZoneContradictions();
  }

  const hasUnknown = board.some((row) => row.some((cell) => cell.status === 'Unknown'));

  return {
    isSolvable: !contradiction && !hasUnknown,
    difficultyScore,
    finalState: board,
  };
}
