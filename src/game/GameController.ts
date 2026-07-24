import type { Application } from 'pixi.js';
import { GameModel, type CellChange } from './GameModel';
import { GameView } from './GameView';
import type { Difficulty, ScreenId } from '../types/level';
import type { LevelManager } from '../services/LevelManager';
// --- DEBUG_MODE panel ---
import { solve } from '../utils/StarBattleSolver';
import { generateLevel } from '../utils/StarBattleGenerator';

const DEBUG_MODE = true;
// --- END DEBUG_MODE panel ---

export class GameController {
  private readonly model = new GameModel();
  private readonly view: GameView;
  private readonly app: Application;
  private readonly levelManager: LevelManager;
  private timerIntervalId: ReturnType<typeof setInterval> | null = null;
  private lastScreen: ScreenId | null = null;
  private pendingDragChanges: CellChange[] = [];

  constructor(app: Application, levelManager: LevelManager) {
    this.app = app;
    this.levelManager = levelManager;
    this.view = new GameView(app, levelManager, DEBUG_MODE);
  }

  /** Bypass menus and load a level directly (used by DEBUG_SKIP_TO_LEVEL in main.ts). */
  skipToLevel(difficulty: Difficulty, index: number): void {
    const level = this.levelManager.getLevel(difficulty, index);
    if (!level) {
      console.warn(
        `[GameController] skipToLevel: no level at ${difficulty}[${index}]`,
      );
      return;
    }

    this.pendingDragChanges = [];
    this.model.setDifficulty(difficulty);
    this.model.loadLevel(level);
    this.model.setScreen('gameplay');
  }

  start(): void {
    this.wireViewCallbacks();

    this.model.subscribe((state) => {
      if (state.screen !== this.lastScreen) {
        this.view.render(state);
        this.lastScreen = state.screen;

        if (state.screen === 'gameplay') {
          this.view.setUndoEnabled(this.model.canUndo());
          this.view.setAutoFillEnabled(this.model.isAutoFillOn());
          this.startTimer();
        } else {
          this.stopTimer();
        }
      }
    });

    this.view.render(this.model.getState());
    this.lastScreen = this.model.getState().screen;

    this.app.renderer.on('resize', () => {
      this.view.render(this.model.getState());
      if (this.model.getState().screen === 'gameplay') {
        this.view.setUndoEnabled(this.model.canUndo());
        this.view.setAutoFillEnabled(this.model.isAutoFillOn());
      }
    });
  }

  // --- DEBUG_MODE panel ---
  showSolution(): void {
    if (!DEBUG_MODE) {
      return;
    }

    if (this.model.isShowingSolution()) {
      this.model.clearSolutionHighlight();
      this.view.clearSolutionOverlay();
      return;
    }

    const gameplay = this.model.getGameplay();
    if (!gameplay) {
      return;
    }

    const { size, k, grid } = gameplay.level;
    const result = solve(size, k, grid);

    if (!result.isSolvable) {
      console.warn('[GameController] showSolution: level is not solvable');
      return;
    }

    const cells: Array<{ row: number; col: number }> = [];
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (result.finalState[row]?.[col]?.status === 'Object') {
          cells.push({ row, col });
        }
      }
    }

    this.model.setSolutionHighlight(cells);
    this.view.showSolutionOverlay(cells);
  }

  regenerateBoard(): void {
    if (!DEBUG_MODE) {
      return;
    }

    const gameplay = this.model.getGameplay();
    if (!gameplay) {
      return;
    }

    this.stopTimer();
    this.pendingDragChanges = [];
    this.model.clearSolutionHighlight();
    this.view.clearSolutionOverlay();

    const { size, k, difficulty } = gameplay.level;

    let level;
    try {
      level = generateLevel(size, k, difficulty);
    } catch (error: unknown) {
      console.warn('[GameController] regenerateBoard: generation failed', error);
      this.startTimer();
      return;
    }

    this.pendingDragChanges = [];
    this.model.setDifficulty(difficulty);
    this.model.loadLevel(level);
    this.view.render(this.model.getState());
    this.view.setUndoEnabled(this.model.canUndo());
    this.view.setAutoFillEnabled(this.model.isAutoFillOn());
    this.startTimer();
  }
  // --- END DEBUG_MODE panel ---

  private wireViewCallbacks(): void {
    this.view.setCallbacks({
      onDifficultySelected: (difficulty: Difficulty) => {
        this.model.setDifficulty(difficulty);
        this.model.setScreen('levelSelect');
      },
      onBackSelected: () => {
        this.model.setScreen('mainMenu');
      },
      onLevelSelected: (index: number) => {
        const difficulty = this.model.getState().selectedDifficulty;
        if (!difficulty) {
          return;
        }

        const level = this.levelManager.getLevel(difficulty, index);
        if (!level) {
          return;
        }

        this.pendingDragChanges = [];
        this.model.loadLevel(level);
        this.model.setScreen('gameplay');
        this.view.setUndoEnabled(this.model.canUndo());
        this.view.setAutoFillEnabled(this.model.isAutoFillOn());
      },
      onCellTap: (row: number, col: number) => {
        const changes = this.model.cycleCell(row, col);
        if (changes) {
          this.model.pushMove({ changes });
        }
        // --- DEBUG_MODE panel ---
        if (!this.model.isShowingSolution()) {
          this.view.clearSolutionOverlay();
        }
        // --- END DEBUG_MODE panel ---
        this.syncGameplayBoard();
        this.view.setUndoEnabled(this.model.canUndo());
      },
      onDragPaint: (row: number, col: number) => {
        const change = this.model.paintDot(row, col);
        if (change) {
          this.pendingDragChanges.push(change);
          this.syncGameplayBoard();
        }
        // --- DEBUG_MODE panel ---
        if (!this.model.isShowingSolution()) {
          this.view.clearSolutionOverlay();
        }
        // --- END DEBUG_MODE panel ---
      },
      onDragErase: (row: number, col: number) => {
        const change = this.model.eraseDot(row, col);
        if (change) {
          this.pendingDragChanges.push(change);
          this.syncGameplayBoard();
        }
        // --- DEBUG_MODE panel ---
        if (!this.model.isShowingSolution()) {
          this.view.clearSolutionOverlay();
        }
        // --- END DEBUG_MODE panel ---
      },
      onInteractionEnd: () => {
        if (this.pendingDragChanges.length > 0) {
          this.model.pushMove({ changes: this.pendingDragChanges });
          this.pendingDragChanges = [];
        }
        this.model.finalizeInteraction();
        this.syncGameplayBoard();
        this.view.setUndoEnabled(this.model.canUndo());
      },
      onUndoClick: () => {
        const record = this.model.undoLastMove();
        if (!record) {
          return;
        }

        // --- DEBUG_MODE panel ---
        if (!this.model.isShowingSolution()) {
          this.view.clearSolutionOverlay();
        }
        // --- END DEBUG_MODE panel ---
        this.syncGameplayBoard();
        this.view.setUndoEnabled(this.model.canUndo());

        const gameplay = this.model.getGameplay();
        if (gameplay && !gameplay.isVictory) {
          this.startTimer();
        }
      },
      onAutoFillToggle: () => {
        const enabled = this.model.toggleAutoFill();
        this.view.setAutoFillEnabled(enabled);
      },
      onBackToLevels: () => {
        this.stopTimer();
        this.pendingDragChanges = [];
        this.model.clearGameplay();
        this.model.setScreen('levelSelect');
      },
      // --- DEBUG_MODE panel ---
      onShowSolution: () => {
        this.showSolution();
      },
      onNewBoard: () => {
        this.regenerateBoard();
      },
      // --- END DEBUG_MODE panel ---
    });
  }

  private syncGameplayBoard(): void {
    const gameplay = this.model.getGameplay();
    if (!gameplay) {
      return;
    }

    this.view.updateGameplayBoard(
      gameplay.boardState,
      gameplay.remainingElements,
      gameplay.isVictory,
    );

    if (gameplay.isVictory) {
      this.stopTimer();
    }
  }

  private startTimer(): void {
    this.stopTimer();

    this.timerIntervalId = setInterval(() => {
      this.model.tickTimer();
      this.view.updateTimerDisplay(this.model.getElapsedSeconds());
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerIntervalId !== null) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
  }
}
