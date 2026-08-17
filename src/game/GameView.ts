import { Application, Container } from 'pixi.js';
import type { CellPosition } from './GameModel';
import type { CellState, Difficulty, GameState } from '../types/level';
import type { LevelManager } from '../services/LevelManager';
import type { ProgressManager } from '../services/ProgressManager';
import type { IScene } from '../ui/scenes/IScene';
import { MainMenuScene } from '../ui/scenes/MainMenuScene';
import { LevelSelectScene } from '../ui/scenes/LevelSelectScene';
import { GameplayScene } from '../ui/scenes/GameplayScene';

export interface GameViewCallbacks {
  onDifficultySelected: (difficulty: Difficulty) => void;
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
  private readonly root = new Container();
  private readonly app: Application;
  private readonly levelManager: LevelManager;
  private readonly progressManager: ProgressManager;
  private autoFillEnabled = true;
  private callbacks: GameViewCallbacks = {
    onDifficultySelected: () => undefined,
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

  private currentScene: IScene | null = null;
  private gameplayScene: GameplayScene | null = null;

  constructor(
    app: Application,
    levelManager: LevelManager,
    progressManager: ProgressManager,
  ) {
    this.app = app;
    this.levelManager = levelManager;
    this.progressManager = progressManager;
    this.app.stage.addChild(this.root);
  }

  setCallbacks(callbacks: GameViewCallbacks): void {
    this.callbacks = callbacks;
  }

  render(state: GameState): void {
    this.unmountCurrentScene();

    const { width, height } = this.app.screen;

    if (state.screen === 'mainMenu') {
      const scene = new MainMenuScene(this.levelManager, this.progressManager, {
        onDifficultySelected: (difficulty) => this.callbacks.onDifficultySelected(difficulty),
      });
      this.mountScene(scene, width, height);
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
      this.mountScene(scene, width, height);
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
      this.mountScene(scene, width, height);
    }
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
    return this.gameplayScene?.isBoardInputBlocked() ?? false;
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

  private mountScene(scene: IScene & Container, width: number, height: number): void {
    this.currentScene = scene;
    this.root.addChild(scene);
    scene.resize(width, height);
    scene.show();
  }

  private unmountCurrentScene(): void {
    if (!this.currentScene) {
      return;
    }

    this.currentScene.hide();
    if (this.currentScene instanceof Container && this.currentScene.parent === this.root) {
      this.root.removeChild(this.currentScene);
    }
    if (this.currentScene instanceof Container && !this.currentScene.destroyed) {
      this.currentScene.destroy({ children: true });
    }

    this.currentScene = null;
    this.gameplayScene = null;
  }
}
