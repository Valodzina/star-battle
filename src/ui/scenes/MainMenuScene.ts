import { Container, Text, Sprite, Graphics } from 'pixi.js';
import type { Difficulty } from '../../types/level';
import { DIFFICULTY_META } from '../../types/level';
import type { LevelManager } from '../../services/LevelManager';
import type { ProgressManager } from '../../services/ProgressManager';
import { COLORS } from '../colors';
import { BUTTON_GAP, SCREEN_PADDING, TITLE_FONT_FAMILY } from '../constants';
import { MainMenuButton } from '../components/MainMenuButton';
import type { IScene } from './IScene';
import { getStarWinTexture } from '../gameAssets';

const BUTTON_WIDTH = 320;
const BUTTON_HEIGHT = 72;

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

  resize(screenWidth: number, screenHeight: number): void {
    this.removeChildren().forEach((child) => child.destroy({ children: true }));

    const mainContainer = new Container();
    this.addChild(mainContainer);

    const title = new Text({
      text: 'STAR\nBATTLE',
      style: {
        align: 'center',
        fill: COLORS.title,
        fontFamily: TITLE_FONT_FAMILY,
        fontSize: 55,
        letterSpacing: 1.6,
        lineHeight: 45,
        fontWeight: '800',
      },
    });
    title.anchor.set(0.5);
    title.x = 0;
    title.y = -220;
    mainContainer.addChild(title);

    const titleLogo = new Container();
    titleLogo.x = 0;
    titleLogo.y = -280;
    titleLogo.tint = COLORS.title;

    const tileLogoSprite = new Sprite(getStarWinTexture());
    tileLogoSprite.x = 0;
    tileLogoSprite.y = 0;
    tileLogoSprite.width = 20;
    tileLogoSprite.height = 20;
    tileLogoSprite.anchor.set(0.5);

    const lineLength = 100;
    const endCircleRadius = 2.5;
    const color = COLORS.white;
    const lineWidth = 1.5;
    const offset = 26;

    const titleLogoLeftLine = new Graphics();
    titleLogoLeftLine.moveTo(-offset, 0).lineTo(-lineLength - offset, 0).stroke({
      width: lineWidth,
      color: color,
      alpha: 1,
    });
    titleLogoLeftLine.circle(-lineLength - offset, 0, endCircleRadius).fill({ color: color });
    titleLogo.addChild(titleLogoLeftLine);

    const titleLogoRightLine = new Graphics();
    titleLogoRightLine.moveTo(offset, 0).lineTo(lineLength + offset, 0).stroke({
      width: lineWidth,
      color: color,
      alpha: 1,
    });
    titleLogoRightLine.circle(lineLength + offset, 0, endCircleRadius).fill({ color: color });
    titleLogo.addChild(titleLogoRightLine);

    titleLogo.addChild(tileLogoSprite);
    mainContainer.addChild(titleLogo);

    const menu = new Container();
    const totalHeight =
      DIFFICULTY_META.length * BUTTON_HEIGHT + (DIFFICULTY_META.length - 1) * BUTTON_GAP;
    menu.x = -BUTTON_WIDTH / 2;
    menu.y = -totalHeight / 2 + 50;

    DIFFICULTY_META.forEach((meta, index) => {
      const button = new MainMenuButton({
        width: BUTTON_WIDTH,
        height: BUTTON_HEIGHT,
        label: meta.label,
        subtitle: meta.subtitle,
        difficultyColor: meta.color,
        completed: this.progressManager.getCompletedCount(meta.difficulty),
        total: this.levelManager.getLevelCount(meta.difficulty),
        onClick: () => this.callbacks.onDifficultySelected(meta.difficulty),
      });
      button.y = index * (BUTTON_HEIGHT + BUTTON_GAP);
      menu.addChild(button);
    });

    mainContainer.addChild(menu);

    // Fit-to-screen: scale down only if needed, and center the visual bounds
    // (not local origin) so asymmetric title/logo stack isn't clipped in landscape.
    const bounds = mainContainer.getLocalBounds();
    const availableWidth = Math.max(1, screenWidth - SCREEN_PADDING * 2);
    const availableHeight = Math.max(1, screenHeight - SCREEN_PADDING * 2);
    const scale = Math.min(
      1,
      availableWidth / Math.max(1, bounds.width),
      availableHeight / Math.max(1, bounds.height),
    );
    mainContainer.scale.set(scale);
    mainContainer.x = screenWidth / 2 - (bounds.x + bounds.width / 2) * scale;
    mainContainer.y = screenHeight / 2 - (bounds.y + bounds.height / 2) * scale;
  }
}
