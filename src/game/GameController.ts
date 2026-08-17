import type { Application } from 'pixi.js';
import { GameModel, type CellChange, type CellPosition } from './GameModel';
import { GameView } from './GameView';
import type { Difficulty, ScreenId } from '../types/level';
import type { LevelManager } from '../services/LevelManager';
import { ProgressManager } from '../services/ProgressManager';
import { HapticManager } from '../utils/HapticManager';

export class GameController {
  private readonly model = new GameModel();
  private readonly view: GameView;
  private readonly app: Application;
  private readonly levelManager: LevelManager;
  private readonly progressManager: ProgressManager;
  private timerIntervalId: ReturnType<typeof setInterval> | null = null;
  private lastScreen: ScreenId | null = null;
  private pendingDragChanges: CellChange[] = [];
  private wasVictory = false;

  constructor(app: Application, levelManager: LevelManager) {
    this.app = app;
    this.levelManager = levelManager;
    this.progressManager = new ProgressManager(levelManager);
    this.view = new GameView(app, levelManager, this.progressManager);
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
    this.wasVictory = false;
    this.model.setDifficulty(difficulty);
    this.model.loadLevel(level, index, this.levelManager.getLevelCount(difficulty));
    this.model.setScreen('gameplay');
  }

  loadNextLevel(): void {
    if (!this.model.hasNextLevel()) {
      return;
    }

    const gameplay = this.model.getGameplay();
    if (!gameplay) {
      return;
    }

    const difficulty =
      this.model.getState().selectedDifficulty ?? gameplay.level.difficulty;
    const nextIndex = gameplay.levelIndex + 1;
    const level = this.levelManager.getLevel(difficulty, nextIndex);
    if (!level || !this.progressManager.isUnlocked(level.id)) {
      return;
    }

    this.stopTimer();
    this.pendingDragChanges = [];
    this.wasVictory = false;

    this.model.loadLevel(
      level,
      nextIndex,
      this.levelManager.getLevelCount(difficulty),
    );
    this.view.render(this.model.getState());
    this.view.setUndoEnabled(this.model.canUndo());
    this.view.setAutoFillEnabled(this.model.isAutoFillOn());
    this.startTimer();
  }

  loadPreviousLevel(): void {
    if (!this.model.hasPreviousLevel()) {
      return;
    }

    const gameplay = this.model.getGameplay();
    if (!gameplay) {
      return;
    }

    const difficulty =
      this.model.getState().selectedDifficulty ?? gameplay.level.difficulty;
    const previousIndex = gameplay.levelIndex - 1;
    const level = this.levelManager.getLevel(difficulty, previousIndex);
    if (!level) {
      return;
    }

    this.stopTimer();
    this.pendingDragChanges = [];
    this.wasVictory = false;

    this.model.loadLevel(
      level,
      previousIndex,
      this.levelManager.getLevelCount(difficulty),
    );
    this.view.render(this.model.getState());
    this.view.setUndoEnabled(this.model.canUndo());
    this.view.setAutoFillEnabled(this.model.isAutoFillOn());
    this.startTimer();
  }

  start(): void {
    this.wireViewCallbacks();

    this.model.subscribe((state) => {
      if (state.screen !== this.lastScreen) {
        this.view.render(state);
        this.lastScreen = state.screen;

        if (state.screen === 'gameplay') {
          this.wasVictory = state.gameplay?.isVictory ?? false;
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
        if (!level || !this.progressManager.isUnlocked(level.id)) {
          return;
        }

        this.pendingDragChanges = [];
        this.wasVictory = false;
        this.model.loadLevel(level, index, this.levelManager.getLevelCount(difficulty));
        this.model.setScreen('gameplay');
        this.view.setUndoEnabled(this.model.canUndo());
        this.view.setAutoFillEnabled(this.model.isAutoFillOn());
      },
      onCellTap: (row: number, col: number) => {
        const result = this.model.cycleCell(row, col);
        if (result) {
          this.model.pushMove({ changes: result.changes });
          const tappedState = result.changes[0]?.newState;
          if (tappedState === 'element') {
            HapticManager.playDouble();
          } else if (tappedState === 'dot' || tappedState === 'nothing') {
            HapticManager.playLight();
          }
        }

        if (result?.newAutoDots.length && result.sourceStar) {
          this.syncGameplayBoard({
            pendingAutoDots: result.newAutoDots,
            suppressVictory: true,
          });
          this.view.setUndoEnabled(false);
          this.view.animateAutoDots(result.newAutoDots, result.sourceStar, () => {
            this.syncGameplayBoard({ skipBoardRedraw: true });
            this.view.setUndoEnabled(this.model.canUndo());
          });
          return;
        }

        this.syncGameplayBoard();
        this.view.setUndoEnabled(this.model.canUndo());
      },
      onDragPaint: (row: number, col: number) => {
        const change = this.model.paintDot(row, col);
        if (change) {
          this.pendingDragChanges.push(change);
          HapticManager.playLight();
          this.syncGameplayBoard();
        }
      },
      onDragErase: (row: number, col: number) => {
        const change = this.model.eraseDot(row, col);
        if (change) {
          this.pendingDragChanges.push(change);
          HapticManager.playLight();
          this.syncGameplayBoard();
        }
      },
      onInteractionEnd: () => {
        if (this.pendingDragChanges.length > 0) {
          this.model.pushMove({ changes: this.pendingDragChanges });
          this.pendingDragChanges = [];
        }
        this.syncGameplayBoard();
        this.view.setUndoEnabled(this.model.canUndo());
      },
      onUndoClick: () => {
        if (this.view.isBoardInputBlocked()) {
          return;
        }

        const record = this.model.undoLastMove();
        if (!record) {
          return;
        }

        this.syncGameplayBoard();
        this.view.setUndoEnabled(this.model.canUndo());

        const gameplay = this.model.getGameplay();
        if (gameplay && !gameplay.isVictory) {
          this.wasVictory = false;
          this.startTimer();
        }
      },
      onAutoFillToggle: () => {
        if (this.view.isBoardInputBlocked()) {
          return;
        }

        const enabled = this.model.toggleAutoFill();
        this.view.setAutoFillEnabled(enabled);
        this.syncGameplayBoard();
      },
      onClearBoard: () => {
        if (this.view.isBoardInputBlocked()) {
          return;
        }

        this.pendingDragChanges = [];
        this.wasVictory = false;
        this.model.clearBoard();
        this.syncGameplayBoard();
        this.view.setUndoEnabled(this.model.canUndo());
      },
      onBackToLevels: () => {
        this.stopTimer();
        this.pendingDragChanges = [];
        this.wasVictory = false;
        this.model.clearGameplay();
        this.model.setScreen('levelSelect');
      },
      onPreviousLevel: () => {
        this.loadPreviousLevel();
      },
      onNextLevel: () => {
        this.loadNextLevel();
      },
    });
  }

  private syncGameplayBoard(options?: {
    pendingAutoDots?: CellPosition[];
    suppressVictory?: boolean;
    skipBoardRedraw?: boolean;
  }): void {
    const gameplay = this.model.getGameplay();
    if (!gameplay) {
      return;
    }

    if (gameplay.isVictory) {
      this.stopTimer();
      if (!this.wasVictory) {
        this.progressManager.markCompleted(gameplay.level.id);
        this.view.refreshLevelNavigation();
      }
    }

    this.view.updateGameplayBoard(
      gameplay.boardState,
      gameplay.remainingElements,
      options?.suppressVictory ? false : gameplay.isVictory,
      {
        skipMarkerCells: options?.pendingAutoDots,
        skipBoardRedraw: options?.skipBoardRedraw,
      },
    );
    this.view.updateInvalidStars(this.model.getInvalidStarPositions());

    if (gameplay.isVictory) {
      this.wasVictory = true;
    } else {
      this.wasVictory = false;
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
