import { Container, Text } from 'pixi.js';
import type { Difficulty } from '../../types/level';
import { DIFFICULTY_META } from '../../types/level';
import type { LevelManager } from '../../services/LevelManager';
import type { ProgressManager } from '../../services/ProgressManager';
import { COLORS } from '../colors';
import { BUTTON_GAP, FONT_FAMILY, SCREEN_PADDING } from '../constants';
import { Button } from '../components/Button';
import type { IScene } from './IScene';

export interface MainMenuSceneCallbacks {
  onDifficultySelected: (difficulty: Difficulty) => void;
}

export class MainMenuScene extends Container implements IScene {
  private readonly levelManager: LevelManager;
  private readonly progressManager: ProgressManager;
  private readonly callbacks: MainMenuSceneCallbacks;

  constructor(
    levelManager: LevelManager,
    progressManager: ProgressManager,
    callbacks: MainMenuSceneCallbacks,
  ) {
    super();
    this.levelManager = levelManager;
    this.progressManager = progressManager;
    this.callbacks = callbacks;
    this.visible = false;
  }

  show(): void {
    this.visible = true;
  }

  hide(): void {
    this.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.visible = false;
  }

  resize(width: number, height: number): void {
    this.removeChildren().forEach((child) => child.destroy({ children: true }));

    const buttonWidth = Math.min(320, width - SCREEN_PADDING * 2);
    const buttonHeight = 72;

    const title = new Text({
      text: 'Star Battle',
      style: {
        fill: COLORS.title,
        fontFamily: FONT_FAMILY,
        fontSize: 42,
        fontWeight: '700',
      },
    });
    title.anchor.set(0.5);
    title.x = width / 2;
    title.y = height * 0.18;
    this.addChild(title);

    const menu = new Container();
    const totalHeight =
      DIFFICULTY_META.length * buttonHeight + (DIFFICULTY_META.length - 1) * BUTTON_GAP;
    menu.x = width / 2 - buttonWidth / 2;
    menu.y = height / 2 - totalHeight / 2;

    DIFFICULTY_META.forEach((meta, index) => {
      const button = new Button({
        width: buttonWidth,
        height: buttonHeight,
        label: meta.label,
        subtitle: meta.subtitle,
        color: meta.color,
        progress: {
          completed: this.progressManager.getCompletedCount(meta.difficulty),
          total: this.levelManager.getLevelCount(meta.difficulty),
        },
        onClick: () => this.callbacks.onDifficultySelected(meta.difficulty),
      });
      button.y = index * (buttonHeight + BUTTON_GAP);
      menu.addChild(button);
    });

    this.addChild(menu);
  }
}
