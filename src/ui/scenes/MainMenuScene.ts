import { Container, Text , Sprite, Graphics} from 'pixi.js';
import type { Difficulty } from '../../types/level';
import { DIFFICULTY_META } from '../../types/level';
import type { LevelManager } from '../../services/LevelManager';
import type { ProgressManager } from '../../services/ProgressManager';
import { COLORS } from '../colors';
import { BUTTON_GAP, SCREEN_PADDING, TITLE_FONT_FAMILY } from '../constants';
import { MainMenuButton } from '../components/MainMenuButton';
import type { IScene } from './IScene';
import { getStarWinTexture } from '../gameAssets';

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
    title.x = width / 2;
    title.y = height * 0.18;
    this.addChild(title);

    //a8aeb6


    const titleLogo = new Container();
    titleLogo.x = width / 2;
    titleLogo.y = height * 0.18 - 60;
    titleLogo.tint = COLORS.title;

    const tileLogoSprite = new Sprite(getStarWinTexture());
    tileLogoSprite.x = 0;
    tileLogoSprite.y = 0;
    tileLogoSprite.width = 20;
    tileLogoSprite.height = 20;
    tileLogoSprite.anchor.set(0.5);
    // tileLogoSprite.tint = COLORS.title;
    titleLogo.addChild(tileLogoSprite);



    const lineLength = 100;
    const endCircleRadius = 2.5;
    const color = 0xFFFFFF;
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
    titleLogoRightLine.moveTo( offset, 0).lineTo(lineLength + offset, 0).stroke({
      width: lineWidth,
      color: color,
      alpha: 1,
    });
    titleLogoRightLine.circle(lineLength + offset, 0, endCircleRadius).fill({ color: color });
    titleLogo.addChild(titleLogoRightLine);

    titleLogo.addChild(tileLogoSprite);
    this.addChild(titleLogo);

    const menu = new Container();
    const totalHeight =
      DIFFICULTY_META.length * buttonHeight + (DIFFICULTY_META.length - 1) * BUTTON_GAP;
    menu.x = width / 2 - buttonWidth / 2;
    menu.y = height / 2 - totalHeight / 2 + 50;

    DIFFICULTY_META.forEach((meta, index) => {
      const button = new MainMenuButton({
        width: buttonWidth,
        height: buttonHeight,
        label: meta.label,
        subtitle: meta.subtitle,
        difficultyColor: meta.color,
        completed: this.progressManager.getCompletedCount(meta.difficulty),
        total: this.levelManager.getLevelCount(meta.difficulty),
        onClick: () => this.callbacks.onDifficultySelected(meta.difficulty),
      });
      button.y = index * (buttonHeight + BUTTON_GAP);
      menu.addChild(button);
    });

    this.addChild(menu);
  }
}
