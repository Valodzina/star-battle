import type { Application } from 'pixi.js';
import { GameModel } from './GameModel';
import { GameView } from './GameView';
import type { Difficulty, ScreenId } from '../types/level';
import type { LevelManager } from '../services/LevelManager';

export class GameController {
  private readonly model = new GameModel();
  private readonly view: GameView;
  private readonly app: Application;
  private readonly levelManager: LevelManager;
  private timerIntervalId: ReturnType<typeof setInterval> | null = null;
  private lastScreen: ScreenId | null = null;

  constructor(app: Application, levelManager: LevelManager) {
    this.app = app;
    this.levelManager = levelManager;
    this.view = new GameView(app, levelManager);
  }

  start(): void {
    this.wireViewCallbacks();

    this.model.subscribe((state) => {
      if (state.screen !== this.lastScreen) {
        this.view.render(state);
        this.lastScreen = state.screen;

        if (state.screen === 'gameplay') {
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
        if (!level) {
          return;
        }

        this.model.loadLevel(level);
        this.model.setScreen('gameplay');
      },
      onCellClicked: (row: number, col: number) => {
        this.model.cycleCell(row, col);
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
      },
      onBackToLevels: () => {
        this.stopTimer();
        this.model.clearGameplay();
        this.model.setScreen('levelSelect');
      },
    });
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
