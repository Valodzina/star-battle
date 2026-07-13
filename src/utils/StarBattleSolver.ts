export type SolverCellStatus = 'Unknown' | 'Empty' | 'Object';

export type SolverTier = 'basic' | 'intersection' | 'geometry' | 'sector';

export interface SolverCell {
  row: number;
  col: number;
  regionId: number;
  status: SolverCellStatus;
}

export interface SolverResult {
  isSolvable: boolean;
  difficultyScore: number;
  tiersUsed: SolverTier[];
  finalState: SolverCell[][];
}

export interface SolveOptions {
  /** Default true. When false, skips Pointing/Claiming. */
  useIntersectionPatterns?: boolean;
  /** Default true. When false, skips packing and single-step contradiction. */
  useGeometryConstraints?: boolean;
  /** Default true. When false, skips Sector Capture / Inverse Sector Capture. */
  useSectorCapture?: boolean;
}

const TIER_ORDER: readonly SolverTier[] = ['basic', 'intersection', 'geometry', 'sector'];

const TIER_WEIGHTS: Record<SolverTier, number> = {
  basic: 1,
  intersection: 5,
  geometry: 10,
  sector: 20,
};

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

function areMooreAdjacent(a: SolverCell, b: SolverCell): boolean {
  const dRow = Math.abs(a.row - b.row);
  const dCol = Math.abs(a.col - b.col);
  return dRow <= 1 && dCol <= 1 && !(dRow === 0 && dCol === 0);
}

/** Max objects placeable on a straight 1xN / Nx1 run under Moore (no consecutive). */
export function linearRunCapacity(length: number): number {
  if (length <= 0) {
    return 0;
  }
  return Math.ceil(length / 2);
}

/** Exact maximum Moore-independent set size for a small cell list. */
export function mooreIndependentCapacity(cells: SolverCell[]): number {
  const n = cells.length;
  if (n === 0) {
    return 0;
  }
  if (n === 1) {
    return 1;
  }

  const adjacency = Array.from({ length: n }, () => 0);
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (areMooreAdjacent(cells[i]!, cells[j]!)) {
        adjacency[i] = (adjacency[i] ?? 0) | (1 << j);
        adjacency[j] = (adjacency[j] ?? 0) | (1 << i);
      }
    }
  }

  let best = 0;
  const search = (index: number, chosenMask: number, count: number): void => {
    if (count + (n - index) <= best) {
      return;
    }
    if (index === n) {
      best = Math.max(best, count);
      return;
    }

    search(index + 1, chosenMask, count);

    if ((chosenMask & adjacency[index]!) === 0) {
      search(index + 1, chosenMask | (1 << index), count + 1);
    }
  };

  search(0, 0, 0);
  return best;
}

function isStraightRun(cells: SolverCell[]): boolean {
  if (cells.length <= 1) {
    return true;
  }
  const sameRow = cells.every((cell) => cell.row === cells[0]!.row);
  const sameCol = cells.every((cell) => cell.col === cells[0]!.col);
  if (!sameRow && !sameCol) {
    return false;
  }
  if (sameRow) {
    const cols = cells.map((cell) => cell.col).sort((a, b) => a - b);
    for (let i = 1; i < cols.length; i += 1) {
      if (cols[i]! !== cols[i - 1]! + 1) {
        return false;
      }
    }
    return true;
  }
  const rows = cells.map((cell) => cell.row).sort((a, b) => a - b);
  for (let i = 1; i < rows.length; i += 1) {
    if (rows[i]! !== rows[i - 1]! + 1) {
      return false;
    }
  }
  return true;
}

function orthogonalComponents(cells: SolverCell[]): SolverCell[][] {
  if (cells.length === 0) {
    return [];
  }

  const key = (cell: SolverCell) => `${cell.row},${cell.col}`;
  const cellByKey = new Map(cells.map((cell) => [key(cell), cell]));
  const visited = new Set<string>();
  const components: SolverCell[][] = [];

  for (const start of cells) {
    const startKey = key(start);
    if (visited.has(startKey)) {
      continue;
    }
    const component: SolverCell[] = [];
    const queue = [start];
    visited.add(startKey);

    while (queue.length > 0) {
      const current = queue.pop()!;
      component.push(current);
      for (const [dRow, dCol] of ORTHO_OFFSETS) {
        const next = cellByKey.get(`${current.row + dRow},${current.col + dCol}`);
        if (!next) {
          continue;
        }
        const nextKey = key(next);
        if (visited.has(nextKey)) {
          continue;
        }
        visited.add(nextKey);
        queue.push(next);
      }
    }

    components.push(component);
  }

  return components;
}

function componentCapacity(component: SolverCell[]): number {
  if (isStraightRun(component)) {
    return linearRunCapacity(component.length);
  }
  return mooreIndependentCapacity(component);
}

function packingCapacity(unknowns: SolverCell[]): number {
  return orthogonalComponents(unknowns).reduce(
    (sum, component) => sum + componentCapacity(component),
    0,
  );
}

function combinations<T>(items: T[], n: number): T[][] {
  if (n <= 0 || n > items.length) {
    return [];
  }
  const result: T[][] = [];
  const choose = (start: number, chosen: T[]): void => {
    if (chosen.length === n) {
      result.push([...chosen]);
      return;
    }
    for (let i = start; i < items.length; i += 1) {
      chosen.push(items[i]!);
      choose(i + 1, chosen);
      chosen.pop();
    }
  };
  choose(0, []);
  return result;
}

function scoreFromTiers(tiers: ReadonlySet<SolverTier>): number {
  let score = 0;
  for (const tier of tiers) {
    score += TIER_WEIGHTS[tier];
  }
  return score;
}

function orderedTiers(tiers: ReadonlySet<SolverTier>): SolverTier[] {
  return TIER_ORDER.filter((tier) => tiers.has(tier));
}

export function solve(
  size: number,
  k: number,
  regionGrid: number[][],
  options?: SolveOptions,
): SolverResult {
  const useIntersectionPatterns = options?.useIntersectionPatterns ?? true;
  const useGeometryConstraints = options?.useGeometryConstraints ?? true;
  const useSectorCapture = options?.useSectorCapture ?? true;

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

  const regionIds = [...regions.keys()];
  const zones: SolverCell[][] = [...rows, ...cols, ...regions.values()];

  let hasChanged = true;
  let contradiction = false;
  let mutationCount = 0;
  const tiersUsed = new Set<SolverTier>();

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
    mutationCount += 1;
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
    mutationCount += 1;
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

  const unknownsIn = (zone: SolverCell[]): SolverCell[] =>
    zone.filter((cell) => cell.status === 'Unknown');

  const runTier = (tier: SolverTier, fn: () => void): void => {
    const before = mutationCount;
    fn();
    if (mutationCount > before) {
      tiersUsed.add(tier);
    }
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

  /** Region → line: remaining region capacity fully claims a single row/col. */
  const applyPointing = (): void => {
    for (const regionCells of regions.values()) {
      const { objectCount } = zoneStats(regionCells);
      const missing = k - objectCount;
      if (missing <= 0) {
        continue;
      }

      const unknowns = unknownsIn(regionCells);
      if (unknowns.length === 0) {
        continue;
      }

      const sameRow = unknowns.every((cell) => cell.row === unknowns[0]!.row);
      if (sameRow) {
        const row = rows[unknowns[0]!.row]!;
        const lineRemaining = k - zoneStats(row).objectCount;
        if (missing === lineRemaining) {
          const regionId = unknowns[0]!.regionId;
          for (const cell of row) {
            if (cell.status === 'Unknown' && cell.regionId !== regionId) {
              setEmpty(cell);
              if (contradiction) {
                return;
              }
            }
          }
        }
      }

      const sameCol = unknowns.every((cell) => cell.col === unknowns[0]!.col);
      if (sameCol) {
        const col = cols[unknowns[0]!.col]!;
        const lineRemaining = k - zoneStats(col).objectCount;
        if (missing === lineRemaining) {
          const regionId = unknowns[0]!.regionId;
          for (const cell of col) {
            if (cell.status === 'Unknown' && cell.regionId !== regionId) {
              setEmpty(cell);
              if (contradiction) {
                return;
              }
            }
          }
        }
      }
    }
  };

  /** Line → region: remaining line capacity fully claims a single region. */
  const applyClaiming = (): void => {
    const lines = [...rows, ...cols];
    for (const line of lines) {
      const { objectCount } = zoneStats(line);
      const missing = k - objectCount;
      if (missing <= 0) {
        continue;
      }

      const unknowns = unknownsIn(line);
      if (unknowns.length === 0) {
        continue;
      }

      const regionId = unknowns[0]!.regionId;
      if (!unknowns.every((cell) => cell.regionId === regionId)) {
        continue;
      }

      const regionCells = regions.get(regionId);
      if (!regionCells) {
        continue;
      }

      const regionRemaining = k - zoneStats(regionCells).objectCount;
      if (missing !== regionRemaining) {
        continue;
      }

      const onLine = new Set(unknowns);
      for (const cell of regionCells) {
        if (cell.status === 'Unknown' && !onLine.has(cell)) {
          setEmpty(cell);
          if (contradiction) {
            return;
          }
        }
      }
    }
  };

  const applyPackingConstraints = (): void => {
    for (let row = 0; row < size - 1; row += 1) {
      for (let col = 0; col < size - 1; col += 1) {
        const block = [
          board[row]![col]!,
          board[row]![col + 1]!,
          board[row + 1]![col]!,
          board[row + 1]![col + 1]!,
        ];
        if (!block.some((cell) => cell.status === 'Object')) {
          continue;
        }
        for (const cell of block) {
          if (cell.status === 'Unknown') {
            setEmpty(cell);
            if (contradiction) {
              return;
            }
          }
        }
      }
    }

    for (const regionCells of regions.values()) {
      const { objectCount } = zoneStats(regionCells);
      const missing = k - objectCount;
      if (missing <= 0) {
        continue;
      }

      const unknowns = unknownsIn(regionCells);
      if (packingCapacity(unknowns) < missing) {
        contradiction = true;
        tiersUsed.add('geometry');
        return;
      }

      for (const candidate of unknowns) {
        const remaining = unknowns.filter(
          (cell) => cell !== candidate && !areMooreAdjacent(cell, candidate),
        );
        if (packingCapacity(remaining) < missing - 1) {
          setEmpty(candidate);
          if (contradiction) {
            return;
          }
        }
      }
    }
  };

  const applySingleStepContradiction = (): void => {
    const candidates = board.flat().filter((cell) => cell.status === 'Unknown');

    for (const candidate of candidates) {
      if (candidate.status !== 'Unknown') {
        continue;
      }

      const affected: SolverCell[] = [candidate];
      for (const [dRow, dCol] of MOORE_OFFSETS) {
        const neighbor = board[candidate.row + dRow]?.[candidate.col + dCol];
        if (neighbor) {
          affected.push(neighbor);
        }
      }

      const snapshot = affected.map((cell) => cell.status);

      candidate.status = 'Object';
      let trialBroken = false;
      for (const [dRow, dCol] of MOORE_OFFSETS) {
        const neighbor = board[candidate.row + dRow]?.[candidate.col + dCol];
        if (!neighbor) {
          continue;
        }
        if (neighbor.status === 'Object') {
          trialBroken = true;
          break;
        }
        if (neighbor.status === 'Unknown') {
          neighbor.status = 'Empty';
        }
      }

      if (!trialBroken) {
        for (const zone of zones) {
          const { objectCount, unknownCount } = zoneStats(zone);
          if (objectCount + unknownCount < k) {
            trialBroken = true;
            break;
          }
        }
      }

      for (let i = 0; i < affected.length; i += 1) {
        affected[i]!.status = snapshot[i]!;
      }

      if (trialBroken) {
        setEmpty(candidate);
        if (contradiction) {
          return;
        }
      }
    }
  };

  /** N regions confined to N rows/cols consume those lines entirely. */
  const applySectorCapture = (): void => {
    for (const n of [2, 3] as const) {
      for (const combo of combinations(regionIds, n)) {
        const comboSet = new Set(combo);
        const unknowns: SolverCell[] = [];
        let missingSum = 0;
        for (const regionId of combo) {
          const regionCells = regions.get(regionId);
          if (!regionCells) {
            continue;
          }
          missingSum += k - zoneStats(regionCells).objectCount;
          unknowns.push(...unknownsIn(regionCells));
        }
        if (missingSum <= 0 || unknowns.length === 0) {
          continue;
        }

        const touchedRows = new Set(unknowns.map((cell) => cell.row));
        if (touchedRows.size === n) {
          let lineRemainingSum = 0;
          for (const rowIndex of touchedRows) {
            lineRemainingSum += k - zoneStats(rows[rowIndex]!).objectCount;
          }
          if (missingSum === lineRemainingSum) {
            for (const rowIndex of touchedRows) {
              for (const cell of rows[rowIndex]!) {
                if (cell.status === 'Unknown' && !comboSet.has(cell.regionId)) {
                  setEmpty(cell);
                  if (contradiction) {
                    return;
                  }
                }
              }
            }
          }
        }

        const touchedCols = new Set(unknowns.map((cell) => cell.col));
        if (touchedCols.size === n) {
          let lineRemainingSum = 0;
          for (const colIndex of touchedCols) {
            lineRemainingSum += k - zoneStats(cols[colIndex]!).objectCount;
          }
          if (missingSum === lineRemainingSum) {
            for (const colIndex of touchedCols) {
              for (const cell of cols[colIndex]!) {
                if (cell.status === 'Unknown' && !comboSet.has(cell.regionId)) {
                  setEmpty(cell);
                  if (contradiction) {
                    return;
                  }
                }
              }
            }
          }
        }
      }
    }
  };

  /** N lines whose Unknowns lie in N regions consume those regions outside the lines. */
  const applyInverseSectorCapture = (): void => {
    const lineIndices = Array.from({ length: size }, (_, i) => i);

    const applyInverseForLines = (
      n: number,
      lineCombo: number[],
      getLine: (index: number) => SolverCell[],
      cellOnLine: (cell: SolverCell, lineIndex: number) => boolean,
    ): void => {
      const regionSet = new Set<number>();
      let lineRemainingSum = 0;

      for (const lineIndex of lineCombo) {
        const line = getLine(lineIndex);
        const { objectCount, unknownCount } = zoneStats(line);
        if (unknownCount === 0) {
          return;
        }
        lineRemainingSum += k - objectCount;
        for (const cell of line) {
          if (cell.status === 'Unknown') {
            regionSet.add(cell.regionId);
          }
        }
      }

      if (regionSet.size !== n) {
        return;
      }

      let missingSum = 0;
      for (const regionId of regionSet) {
        const regionCells = regions.get(regionId);
        if (!regionCells) {
          return;
        }
        missingSum += k - zoneStats(regionCells).objectCount;
      }
      if (missingSum !== lineRemainingSum) {
        return;
      }

      for (const regionId of regionSet) {
        const regionCells = regions.get(regionId);
        if (!regionCells) {
          continue;
        }
        for (const cell of regionCells) {
          if (cell.status === 'Unknown' && !lineCombo.some((idx) => cellOnLine(cell, idx))) {
            setEmpty(cell);
            if (contradiction) {
              return;
            }
          }
        }
      }
    };

    for (const n of [2, 3] as const) {
      for (const rowCombo of combinations(lineIndices, n)) {
        applyInverseForLines(
          n,
          rowCombo,
          (index) => rows[index]!,
          (cell, lineIndex) => cell.row === lineIndex,
        );
        if (contradiction) {
          return;
        }
      }

      for (const colCombo of combinations(lineIndices, n)) {
        applyInverseForLines(
          n,
          colCombo,
          (index) => cols[index]!,
          (cell, lineIndex) => cell.col === lineIndex,
        );
        if (contradiction) {
          return;
        }
      }
    }
  };

  while (hasChanged && !contradiction) {
    hasChanged = false;

    runTier('basic', () => {
      applyZoneExhaustion();
      if (!contradiction) {
        applyHiddenSingles();
      }
    });
    if (contradiction) {
      break;
    }

    if (useIntersectionPatterns) {
      runTier('intersection', () => {
        applyPointing();
        if (!contradiction) {
          applyClaiming();
        }
      });
      if (contradiction) {
        break;
      }
    }

    if (useGeometryConstraints) {
      runTier('geometry', () => {
        applyPackingConstraints();
      });
      if (contradiction) {
        break;
      }
    }

    if (useGeometryConstraints && !hasChanged) {
      runTier('geometry', () => {
        applySingleStepContradiction();
      });
      if (contradiction) {
        break;
      }
    }

    if (useSectorCapture) {
      runTier('sector', () => {
        applySectorCapture();
        if (!contradiction) {
          applyInverseSectorCapture();
        }
      });
      if (contradiction) {
        break;
      }
    }

    checkZoneContradictions();
  }

  const hasUnknown = board.some((row) => row.some((cell) => cell.status === 'Unknown'));

  return {
    isSolvable: !contradiction && !hasUnknown,
    difficultyScore: scoreFromTiers(tiersUsed),
    tiersUsed: orderedTiers(tiersUsed),
    finalState: board,
  };
}
