import type { Application } from 'pixi.js';
import { GameModel } from './GameModel';
import { GameView } from './GameView';
import type { Difficulty } from '../types/level';
import type { LevelManager } from '../services/LevelManager';

export class GameController {
  private readonly model = new GameModel();
  private readonly view: GameView;
  private readonly app: Application;
  private readonly levelManager: LevelManager;

  constructor(app: Application, levelManager: LevelManager) {
    this.app = app;
    this.levelManager = levelManager;
    this.view = new GameView(app, levelManager);
  }

  start(): void {
    this.wireViewCallbacks();

    this.model.subscribe((state) => {
      this.view.render(state);
    });

    this.view.render(this.model.getState());

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
        if (level) {
          console.log('Selected level:', level);
        }
      },
    });
  }
}
