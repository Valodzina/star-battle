import { Container, Text, Sprite, Graphics, Rectangle } from 'pixi.js';
import type { Difficulty } from '../../types/level';
import { DIFFICULTY_META } from '../../types/level';
import type { LevelManager } from '../../services/LevelManager';
import type { ProgressManager } from '../../services/ProgressManager';
import { HapticManager } from '../../utils/HapticManager';
import { SoundManager } from '../../utils/SoundManager';
import { COLORS } from '../colors';
import { TITLE_FONT_FAMILY } from '../constants';
import { MainMenuButton } from '../components/MainMenuButton';
import type { IScene } from './IScene';
import { getStarWinTexture } from '../gameAssets';

const LOGICAL_WIDTH = 1080;
const LOGICAL_HEIGHT = 1380;
const TOP_PAD = 40;
const TOP_BAND = 360;
const BOTTOM_BAND = 200;
const SIDE_INSET = 40;

const BUTTON_WIDTH = 800;
const BUTTON_HEIGHT = 180;
const BUTTON_GAP = 40;

const TITLE_FONT_SIZE = 140;
const TITLE_LINE_HEIGHT = 115;
const TITLE_LETTER_SPACING = 4;

const LOGO_STAR_SIZE = 56;
const LOGO_LINE_LENGTH = 280;
const LOGO_LINE_WIDTH = 4;
const LOGO_END_CIRCLE_RADIUS = 7;
const LOGO_OFFSET = 70;
const LOGO_Y = 70;
const TITLE_Y = 220;

const TUTORIAL_ICON_SIZE = 90;
const TUTORIAL_HIT_SIZE = 120;

export interface MainMenuSceneCallbacks {
  onDifficultySelected: (difficulty: Difficulty) => void;
  onTutorialSelected: () => void;
}

export class MainMenuScene extends Container implements IScene {
  private readonly levelManager: LevelManager;
  private readonly progressManager: ProgressManager;
  private readonly callbacks: MainMenuSceneCallbacks;

  private topContainer!: Container;
  private centerContainer!: Container;
  private bottomContainer!: Container;

  private menuClusterHeight = 0;

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
    this.init();
  }

  show(): void {
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
  }

  resize(screenWidth: number, screenHeight: number): void {
    const scale = Math.min(screenWidth / LOGICAL_WIDTH, screenHeight / LOGICAL_HEIGHT);
    const virtualHeight = screenHeight / scale;
    const offsetX = (screenWidth - LOGICAL_WIDTH * scale) / 2;

    for (const container of [this.topContainer, this.centerContainer, this.bottomContainer]) {
      container.scale.set(scale);
    }

    this.bottomContainer.position.set(offsetX, (virtualHeight - BOTTOM_BAND) * scale);

    const centerBandTop = TOP_PAD + TOP_BAND;
    const centerBandBottom = virtualHeight - BOTTOM_BAND;
    const buttonsCenterY = (centerBandTop + centerBandBottom) / 2 + 100;
    this.centerContainer.position.set(screenWidth / 2, buttonsCenterY * scale);

    const buttonsTop = buttonsCenterY - this.menuClusterHeight / 2;
    const titleCenterY = (TOP_PAD + buttonsTop) / 2;
    this.topContainer.position.set(offsetX, titleCenterY * scale);
  }

  private init(): void {
    this.topContainer = this.buildTitle();
    this.centerContainer = this.buildMenu();
    this.bottomContainer = this.buildTutorialButton();

    this.addChild(this.topContainer, this.centerContainer, this.bottomContainer);
  }

  private buildTitle(): Container {
    const top = new Container();

    const titleLogo = new Container();
    titleLogo.x = LOGICAL_WIDTH / 2;
    titleLogo.y = LOGO_Y;
    titleLogo.tint = COLORS.title;

    const tileLogoSprite = new Sprite(getStarWinTexture());
    tileLogoSprite.anchor.set(0.5);
    tileLogoSprite.width = LOGO_STAR_SIZE;
    tileLogoSprite.height = LOGO_STAR_SIZE;

    const color = COLORS.white;

    const titleLogoLeftLine = new Graphics();
    titleLogoLeftLine.moveTo(-LOGO_OFFSET, 0).lineTo(-LOGO_LINE_LENGTH - LOGO_OFFSET, 0).stroke({
      width: LOGO_LINE_WIDTH,
      color,
      alpha: 1,
    });
    titleLogoLeftLine
      .circle(-LOGO_LINE_LENGTH - LOGO_OFFSET, 0, LOGO_END_CIRCLE_RADIUS)
      .fill({ color });
    titleLogo.addChild(titleLogoLeftLine);

    const titleLogoRightLine = new Graphics();
    titleLogoRightLine.moveTo(LOGO_OFFSET, 0).lineTo(LOGO_LINE_LENGTH + LOGO_OFFSET, 0).stroke({
      width: LOGO_LINE_WIDTH,
      color,
      alpha: 1,
    });
    titleLogoRightLine
      .circle(LOGO_LINE_LENGTH + LOGO_OFFSET, 0, LOGO_END_CIRCLE_RADIUS)
      .fill({ color });
    titleLogo.addChild(titleLogoRightLine);

    titleLogo.addChild(tileLogoSprite);
    top.addChild(titleLogo);

    const title = new Text({
      text: 'STAR\nBATTLE',
      style: {
        align: 'center',
        fill: COLORS.title,
        fontFamily: TITLE_FONT_FAMILY,
        fontSize: TITLE_FONT_SIZE,
        letterSpacing: TITLE_LETTER_SPACING,
        lineHeight: TITLE_LINE_HEIGHT,
        fontWeight: '800',
      },
    });
    title.anchor.set(0.5);
    title.x = LOGICAL_WIDTH / 2;
    title.y = TITLE_Y;
    top.addChild(title);

    const bounds = top.getLocalBounds();

    top.pivot.set(0, bounds.y + bounds.height / 2);

    return top;
  }

  private buildMenu(): Container {
    const menu = new Container();
    const clusterHeight =
      DIFFICULTY_META.length * BUTTON_HEIGHT + (DIFFICULTY_META.length - 1) * BUTTON_GAP;
    this.menuClusterHeight = clusterHeight;

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
      button.x = (LOGICAL_WIDTH - BUTTON_WIDTH) / 2;
      button.y = index * (BUTTON_HEIGHT + BUTTON_GAP);
      menu.addChild(button);
    });

    menu.pivot.set(LOGICAL_WIDTH / 2, clusterHeight / 2);
    return menu;
  }

  private buildTutorialButton(): Container {
    const bottom = new Container();

    const tutorialIcon = Sprite.from('tutorial.png');
    tutorialIcon.anchor.set(0.5);
    tutorialIcon.width = TUTORIAL_ICON_SIZE;
    tutorialIcon.height = TUTORIAL_ICON_SIZE;
    tutorialIcon.tint = COLORS.title;
    tutorialIcon.eventMode = 'none';

    const tutorialButton = new Container();
    tutorialButton.eventMode = 'static';
    tutorialButton.cursor = 'pointer';
    tutorialButton.hitArea = new Rectangle(
      -TUTORIAL_HIT_SIZE / 2,
      -TUTORIAL_HIT_SIZE / 2,
      TUTORIAL_HIT_SIZE,
      TUTORIAL_HIT_SIZE,
    );
    tutorialButton.position.set(
      LOGICAL_WIDTH - SIDE_INSET - TUTORIAL_ICON_SIZE ,
      BOTTOM_BAND / 2,
    );
    tutorialButton.addChild(tutorialIcon);
    tutorialButton.on('pointerdown', () => {
      HapticManager.playLight();
      SoundManager.playClick();
    });
    tutorialButton.on('pointertap', () => this.callbacks.onTutorialSelected());
    bottom.addChild(tutorialButton);

    return bottom;
  }
}
