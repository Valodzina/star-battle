import type {
  CellPlacement,
  CellState,
  Difficulty,
  GameplayState,
  GameState,
  LevelData,
  ScreenId,
} from '../types/level';

type GameStateListener = (state: GameState) => void;

const PLACEMENT_CYCLE: readonly CellPlacement[] = ['nothing', 'dot', 'element'];

export interface CellChange {
  row: number;
  col: number;
  previousState: CellPlacement;
  newState: CellPlacement;
}

export interface MoveRecord {
  changes: CellChange[];
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

export class GameModel {
  private state: GameState = {
    screen: 'mainMenu',
    selectedDifficulty: null,
    gameplay: null,
  };

  private readonly listeners = new Set<GameStateListener>();
  private moveHistory: MoveRecord[] = [];
  private isAutoFillEnabled = true;

  // --- DEBUG_MODE panel ---
  private solutionHighlight: Array<{ row: number; col: number }> | null = null;
  // --- END DEBUG_MODE panel ---

  getState(): GameState {
    return this.state;
  }

  getElapsedSeconds(): number {
    return this.state.gameplay?.elapsedSeconds ?? 0;
  }

  getGameplay(): GameplayState | null {
    return this.state.gameplay;
  }

  isAutoFillOn(): boolean {
    return this.isAutoFillEnabled;
  }

  toggleAutoFill(): boolean {
    this.isAutoFillEnabled = !this.isAutoFillEnabled;
    this.applyAutoFillRules();
    return this.isAutoFillEnabled;
  }

  // --- DEBUG_MODE panel ---
  setSolutionHighlight(cells: Array<{ row: number; col: number }>): void {
    this.solutionHighlight = cells;
  }

  clearSolutionHighlight(): void {
    this.solutionHighlight = null;
  }

  getSolutionHighlight(): Array<{ row: number; col: number }> | null {
    return this.solutionHighlight;
  }

  isShowingSolution(): boolean {
    return this.solutionHighlight !== null;
  }
  // --- END DEBUG_MODE panel ---

  setScreen(screen: ScreenId): void {
    if (this.state.screen === screen) {
      return;
    }

    this.state = { ...this.state, screen };
    this.notify();
  }

  setDifficulty(difficulty: Difficulty): void {
    if (this.state.selectedDifficulty === difficulty) {
      return;
    }

    this.state = { ...this.state, selectedDifficulty: difficulty };
    this.notify();
  }

  loadLevel(level: LevelData): void {
    // --- DEBUG_MODE panel ---
    this.clearSolutionHighlight();
    // --- END DEBUG_MODE panel ---

    this.moveHistory = [];

    const boardState = level.grid.map((row, rowIndex) =>
      row.map((regionId, colIndex) => ({
        row: rowIndex,
        col: colIndex,
        regionId,
        placed: 'nothing' as const,
      })),
    );

    const gameplay: GameplayState = {
      level,
      boardState,
      elapsedSeconds: 0,
      remainingElements: level.size * level.k,
      isVictory: false,
    };

    this.state = { ...this.state, gameplay };
  }

  clearGameplay(): void {
    if (!this.state.gameplay) {
      return;
    }

    // --- DEBUG_MODE panel ---
    this.clearSolutionHighlight();
    // --- END DEBUG_MODE panel ---

    this.moveHistory = [];
    this.state = { ...this.state, gameplay: null };
  }

  pushMove(record: MoveRecord): void {
    if (record.changes.length === 0) {
      return;
    }

    this.moveHistory.push(record);
  }

  undoLastMove(): MoveRecord | null {
    const gameplay = this.state.gameplay;
    if (!gameplay || this.moveHistory.length === 0) {
      return null;
    }

    const record = this.moveHistory.pop() ?? null;
    if (!record) {
      return null;
    }

    // --- DEBUG_MODE panel ---
    this.clearSolutionHighlight();
    // --- END DEBUG_MODE panel ---

    // Restore in reverse so overlapping cells (if any) end at the earliest previous state.
    for (let i = record.changes.length - 1; i >= 0; i -= 1) {
      const change = record.changes[i];
      if (!change) {
        continue;
      }

      this.setCellPlacement(change.row, change.col, change.previousState);
    }

    this.applyAutoFillRules();
    return record;
  }

  canUndo(): boolean {
    return this.moveHistory.length > 0;
  }

  cycleCell(row: number, col: number): CellChange | null {
    const gameplay = this.state.gameplay;
    if (!gameplay || gameplay.isVictory) {
      return null;
    }

    // --- DEBUG_MODE panel ---
    this.clearSolutionHighlight();
    // --- END DEBUG_MODE panel ---

    const cell = gameplay.boardState[row]?.[col];
    if (!cell) {
      return null;
    }

    // Auto-dots are derived; treat them as empty for cycling and history.
    const previousState: CellPlacement = cell.placed === 'auto-dot' ? 'nothing' : cell.placed;
    const currentIndex = PLACEMENT_CYCLE.indexOf(previousState);
    if (currentIndex < 0) {
      return null;
    }

    const nextPlacement = PLACEMENT_CYCLE[(currentIndex + 1) % PLACEMENT_CYCLE.length] ?? 'nothing';

    if (!this.setCellPlacement(row, col, nextPlacement)) {
      return null;
    }

    this.applyAutoFillRules();
    return { row, col, previousState, newState: nextPlacement };
  }

  paintDot(row: number, col: number): CellChange | null {
    const gameplay = this.state.gameplay;
    if (!gameplay || gameplay.isVictory) {
      return null;
    }

    // --- DEBUG_MODE panel ---
    this.clearSolutionHighlight();
    // --- END DEBUG_MODE panel ---

    const cell = gameplay.boardState[row]?.[col];
    if (!cell || (cell.placed !== 'nothing' && cell.placed !== 'auto-dot')) {
      return null;
    }

    if (!this.setCellPlacement(row, col, 'dot')) {
      return null;
    }

    this.applyAutoFillRules();
    return { row, col, previousState: 'nothing', newState: 'dot' };
  }

  eraseDot(row: number, col: number): CellChange | null {
    const gameplay = this.state.gameplay;
    if (!gameplay || gameplay.isVictory) {
      return null;
    }

    // --- DEBUG_MODE panel ---
    this.clearSolutionHighlight();
    // --- END DEBUG_MODE panel ---

    const cell = gameplay.boardState[row]?.[col];
    if (!cell || cell.placed !== 'dot') {
      return null;
    }

    if (!this.setCellPlacement(row, col, 'nothing')) {
      return null;
    }

    this.applyAutoFillRules();
    return { row, col, previousState: 'dot', newState: 'nothing' };
  }

  finalizeInteraction(): void {
    this.applyAutoFillRules();
  }

  applyAutoFillRules(): void {
    const gameplay = this.state.gameplay;
    if (!gameplay) {
      return;
    }

    const { size, k } = gameplay.level;
    const clearedBoard = gameplay.boardState.map((row) =>
      row.map((cell) =>
        cell.placed === 'auto-dot' ? { ...cell, placed: 'nothing' as const } : cell,
      ),
    );

    if (!this.isAutoFillEnabled) {
      this.state = {
        ...this.state,
        gameplay: {
          ...gameplay,
          boardState: clearedBoard,
        },
      };
      this.updateGameplayFromBoard();
      return;
    }

    const candidates = new Set<string>();
    const addCandidate = (row: number, col: number): void => {
      if (row < 0 || row >= size || col < 0 || col >= size) {
        return;
      }
      if (clearedBoard[row]?.[col]?.placed !== 'nothing') {
        return;
      }
      candidates.add(`${row},${col}`);
    };

    const countElementsInRow = (row: number): number => {
      let count = 0;
      for (let col = 0; col < size; col += 1) {
        if (clearedBoard[row]?.[col]?.placed === 'element') {
          count += 1;
        }
      }
      return count;
    };

    const countElementsInCol = (col: number): number => {
      let count = 0;
      for (let row = 0; row < size; row += 1) {
        if (clearedBoard[row]?.[col]?.placed === 'element') {
          count += 1;
        }
      }
      return count;
    };

    const regionElementCounts = new Map<number, number>();
    for (const row of clearedBoard) {
      for (const cell of row) {
        if (cell.placed === 'element') {
          regionElementCounts.set(
            cell.regionId,
            (regionElementCounts.get(cell.regionId) ?? 0) + 1,
          );
        }
      }
    }

    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        const cell = clearedBoard[row]?.[col];
        if (!cell || cell.placed !== 'element') {
          continue;
        }

        for (const [dr, dc] of MOORE_OFFSETS) {
          addCandidate(row + dr, col + dc);
        }

        if (countElementsInRow(row) === k) {
          for (let c = 0; c < size; c += 1) {
            addCandidate(row, c);
          }
        }

        if (countElementsInCol(col) === k) {
          for (let r = 0; r < size; r += 1) {
            addCandidate(r, col);
          }
        }

        if ((regionElementCounts.get(cell.regionId) ?? 0) === k) {
          for (const boardRow of clearedBoard) {
            for (const regionCell of boardRow) {
              if (regionCell.regionId === cell.regionId) {
                addCandidate(regionCell.row, regionCell.col);
              }
            }
          }
        }
      }
    }

    const boardState = clearedBoard.map((boardRow, rowIndex) =>
      boardRow.map((boardCell, colIndex) =>
        candidates.has(`${rowIndex},${colIndex}`)
          ? { ...boardCell, placed: 'auto-dot' as const }
          : boardCell,
      ),
    );

    this.state = {
      ...this.state,
      gameplay: {
        ...gameplay,
        boardState,
      },
    };
    this.updateGameplayFromBoard();
  }

  tickTimer(): void {
    const gameplay = this.state.gameplay;
    if (!gameplay || gameplay.isVictory) {
      return;
    }

    this.state = {
      ...this.state,
      gameplay: {
        ...gameplay,
        elapsedSeconds: gameplay.elapsedSeconds + 1,
      },
    };
  }

  subscribe(listener: GameStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private setCellPlacement(row: number, col: number, placement: CellPlacement): boolean {
    const gameplay = this.state.gameplay;
    if (!gameplay) {
      return false;
    }

    const cell = gameplay.boardState[row]?.[col];
    if (!cell || cell.placed === placement) {
      return false;
    }

    const boardState = gameplay.boardState.map((boardRow, rowIndex) =>
      boardRow.map((boardCell, colIndex) =>
        rowIndex === row && colIndex === col
          ? { ...boardCell, placed: placement }
          : boardCell,
      ),
    );

    this.state = {
      ...this.state,
      gameplay: {
        ...gameplay,
        boardState,
      },
    };

    return true;
  }

  private updateGameplayFromBoard(): void {
    const gameplay = this.state.gameplay;
    if (!gameplay) {
      return;
    }

    const remainingElements =
      gameplay.level.size * gameplay.level.k - this.countElements(gameplay.boardState);
    const isVictory = this.validateWin(gameplay.boardState, gameplay.level);

    this.state = {
      ...this.state,
      gameplay: {
        ...gameplay,
        remainingElements,
        isVictory,
      },
    };
  }

  private countElements(boardState: CellState[][]): number {
    let count = 0;
    for (const row of boardState) {
      for (const cell of row) {
        if (cell.placed === 'element') {
          count += 1;
        }
      }
    }
    return count;
  }

  private validateWin(boardState: CellState[][], level: LevelData): boolean {
    const { size, k } = level;

    for (let row = 0; row < size; row += 1) {
      let rowCount = 0;
      for (let col = 0; col < size; col += 1) {
        if (boardState[row]?.[col]?.placed === 'element') {
          rowCount += 1;
        }
      }
      if (rowCount !== k) {
        return false;
      }
    }

    for (let col = 0; col < size; col += 1) {
      let colCount = 0;
      for (let row = 0; row < size; row += 1) {
        if (boardState[row]?.[col]?.placed === 'element') {
          colCount += 1;
        }
      }
      if (colCount !== k) {
        return false;
      }
    }

    const regionCounts = new Map<number, number>();
    for (const row of boardState) {
      for (const cell of row) {
        if (cell.placed === 'element') {
          regionCounts.set(cell.regionId, (regionCounts.get(cell.regionId) ?? 0) + 1);
        }
      }
    }

    const regionIds = new Set<number>();
    for (const row of boardState) {
      for (const cell of row) {
        regionIds.add(cell.regionId);
      }
    }

    for (const regionId of regionIds) {
      if ((regionCounts.get(regionId) ?? 0) !== k) {
        return false;
      }
    }

    if (this.hasAdjacentElements(boardState, size)) {
      return false;
    }

    return true;
  }

  private hasAdjacentElements(boardState: CellState[][], size: number): boolean {
    const directions = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ];

    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (boardState[row]?.[col]?.placed !== 'element') {
          continue;
        }

        for (const [dr, dc] of directions) {
          if (dr === undefined || dc === undefined) {
            continue;
          }

          const neighborRow = row + dr;
          const neighborCol = col + dc;
          if (
            neighborRow >= 0 &&
            neighborRow < size &&
            neighborCol >= 0 &&
            neighborCol < size &&
            boardState[neighborRow]?.[neighborCol]?.placed === 'element'
          ) {
            return true;
          }
        }
      }
    }

    return false;
  }
}
