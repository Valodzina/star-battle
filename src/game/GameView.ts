import { Application } from 'pixi.js';
import type { CellPosition } from './GameModel';
import type { CellState, Difficulty, GameState } from '../types/level';
import type { LevelManager } from '../services/LevelManager';
import type { ProgressManager } from '../services/ProgressManager';
import { SceneManager, type TransitionDirection } from '../ui/SceneManager';
import { MainMenuScene } from '../ui/scenes/MainMenuScene';
import { LevelSelectScene } from '../ui/scenes/LevelSelectScene';
import { GameplayScene } from '../ui/scenes/GameplayScene';
import { TutorialScene } from '../ui/scenes/TutorialScene';

export interface GameViewCallbacks {
  onDifficultySelected: (difficulty: Difficulty) => void;
  onTutorialSelected: () => void;
  onTutorialClosed: () => void;
  onBackSelected: () => void;
  onLevelSelected: (index: number) => void;
  onCellTap: (row: number, col: number) => void;
  onDragPaint: (row: number, col: number) => void;
  onDragErase: (row: number, col: number) => void;
  onInteractionEnd: () => void;
  onUndoClick: () => void;
  onAutoFillToggle: () => void;
  onClearBoard: () => void;
  onBackToLevels: () => void;
  onPreviousLevel: () => void;
  onNextLevel: () => void;
}

export class GameView {
  private readonly levelManager: LevelManager;
  private readonly progressManager: ProgressManager;
  private readonly sceneManager: SceneManager;
  private autoFillEnabled = true;
  private callbacks: GameViewCallbacks = {
    onDifficultySelected: () => undefined,
    onTutorialSelected: () => undefined,
    onTutorialClosed: () => undefined,
    onBackSelected: () => undefined,
    onLevelSelected: () => undefined,
    onCellTap: () => undefined,
    onDragPaint: () => undefined,
    onDragErase: () => undefined,
    onInteractionEnd: () => undefined,
    onUndoClick: () => undefined,
    onAutoFillToggle: () => undefined,
    onClearBoard: () => undefined,
    onBackToLevels: () => undefined,
    onPreviousLevel: () => undefined,
    onNextLevel: () => undefined,
  };

  private gameplayScene: GameplayScene | null = null;

  constructor(
    app: Application,
    levelManager: LevelManager,
    progressManager: ProgressManager,
  ) {
    this.levelManager = levelManager;
    this.progressManager = progressManager;
    this.sceneManager = new SceneManager(app);
  }

  setCallbacks(callbacks: GameViewCallbacks): void {
    this.callbacks = callbacks;
  }

  render(state: GameState, direction: TransitionDirection = 'none'): void {
    this.gameplayScene = null;

    if (state.screen === 'mainMenu') {
      const scene = new MainMenuScene(this.levelManager, this.progressManager, {
        onDifficultySelected: (difficulty) => this.callbacks.onDifficultySelected(difficulty),
        onTutorialSelected: () => this.callbacks.onTutorialSelected(),
      });
      this.sceneManager.changeScene(scene, direction);
      return;
    }

    if (state.screen === 'tutorial') {
      const scene = new TutorialScene({
        onGotIt: () => this.callbacks.onTutorialClosed(),
      });
      this.sceneManager.changeScene(scene, direction);
      return;
    }

    if (state.screen === 'levelSelect' && state.selectedDifficulty) {
      const scene = new LevelSelectScene(
        state.selectedDifficulty,
        this.levelManager,
        this.progressManager,
        {
          onBackSelected: () => this.callbacks.onBackSelected(),
          onLevelSelected: (index) => this.callbacks.onLevelSelected(index),
        },
      );
      this.sceneManager.changeScene(scene, direction);
      return;
    }

    if (state.screen === 'gameplay' && state.gameplay) {
      const scene = new GameplayScene(
        state.gameplay,
        {
          onCellTap: (row, col) => this.callbacks.onCellTap(row, col),
          onDragPaint: (row, col) => this.callbacks.onDragPaint(row, col),
          onDragErase: (row, col) => this.callbacks.onDragErase(row, col),
          onInteractionEnd: () => this.callbacks.onInteractionEnd(),
          onUndoClick: () => this.callbacks.onUndoClick(),
          onAutoFillToggle: () => this.callbacks.onAutoFillToggle(),
          onClearBoard: () => this.callbacks.onClearBoard(),
          onBackToLevels: () => this.callbacks.onBackToLevels(),
          onPreviousLevel: () => this.callbacks.onPreviousLevel(),
          onNextLevel: () => this.callbacks.onNextLevel(),
        },
        this.progressManager,
        this.autoFillEnabled,
      );
      this.gameplayScene = scene;
      this.sceneManager.changeScene(scene, direction);
    }
  }

  resize(width: number, height: number): void {
    this.sceneManager.resize(width, height);
  }

  isTransitioning(): boolean {
    return this.sceneManager.isTransitioningActive();
  }

  updateTimerDisplay(seconds: number): void {
    this.gameplayScene?.updateTimerDisplay(seconds);
  }

  setUndoEnabled(enabled: boolean): void {
    this.gameplayScene?.setUndoEnabled(enabled);
  }

  setAutoFillEnabled(enabled: boolean): void {
    this.autoFillEnabled = enabled;
    this.gameplayScene?.setAutoFillEnabled(enabled);
  }

  updateGameplayBoard(
    boardState: CellState[][],
    remainingElements: number,
    isVictory: boolean,
    options?: {
      skipMarkerCells?: CellPosition[];
      skipBoardRedraw?: boolean;
    },
  ): void {
    this.gameplayScene?.updateGameplayBoard(boardState, remainingElements, isVictory, options);
  }

  updateInvalidStars(invalidPositions: Array<{ row: number; col: number }>): void {
    this.gameplayScene?.updateInvalidStars(invalidPositions);
  }

  isBoardInputBlocked(): boolean {
    return (
      this.sceneManager.isTransitioningActive() ||
      (this.gameplayScene?.isBoardInputBlocked() ?? false)
    );
  }

  animateAutoDots(
    newDots: CellPosition[],
    sourceStar: CellPosition,
    onComplete?: () => void,
  ): void {
    this.gameplayScene?.animateAutoDots(newDots, sourceStar, onComplete);
  }

  refreshLevelNavigation(): void {
    this.gameplayScene?.refreshLevelNavigation();
  }

  transitionGameplayLevel(
    state: GameState,
    direction: 'forward' | 'backward',
    screenWidth: number,
  ): void {
    if (state.screen !== 'gameplay' || !state.gameplay) {
      return;
    }
    if (!this.gameplayScene) {
      return;
    }

    this.sceneManager.lockInputs();
    this.gameplayScene.transitionToGameplay(
      state.gameplay,
      direction,
      screenWidth,
      () => this.sceneManager.unlockInputs(),
    );
  }
}
