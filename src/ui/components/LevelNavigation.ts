import { Container, FederatedPointerEvent, Graphics, Rectangle, Sprite, Text } from 'pixi.js';
import { HapticManager } from '../../utils/HapticManager';
import { COLORS } from '../colors';
import {
  INTER_MEDIUM_FONT_FAMILY,
  LEVEL_NAV_HEIGHT,
  LEVEL_NAV_SWIPE_THRESHOLD,
} from '../constants';
import { getBack1Texture } from '../gameAssets';

const ARROW_INSET_X = 160;
const ARROW_ICON_SIZE = 46;
const LEVEL_FONT_SIZE = 80;

export interface LevelNavigationOptions {
  levelNumber: number;
  logicalBoardWidth: number;
  hasPreviousLevel: boolean;
  hasNextLevel: boolean;
  onPrevClick: () => void;
  onNextClick: () => void;
}

export class LevelNavigation extends Container {
  private readonly swipeZone: Graphics;
  private readonly prevButton: Sprite;
  private readonly nextButton: Sprite;
  private readonly levelText: Text;
  private readonly onPrevClick: () => void;
  private readonly onNextClick: () => void;

  private hasPreviousLevel: boolean;
  private hasNextLevel: boolean;

  constructor(options: LevelNavigationOptions) {
    super();

    const {
      levelNumber,
      logicalBoardWidth,
      hasPreviousLevel,
      hasNextLevel,
      onPrevClick,
      onNextClick,
    } = options;

    this.onPrevClick = onPrevClick;
    this.onNextClick = onNextClick;
    this.hasPreviousLevel = hasPreviousLevel;
    this.hasNextLevel = hasNextLevel;

    this.swipeZone = new Graphics();
    this.swipeZone
      .rect(0, 0, logicalBoardWidth, LEVEL_NAV_HEIGHT)
      .fill({ color: COLORS.white, alpha: 0.001 });
    this.swipeZone.eventMode = 'static';
    this.swipeZone.cursor = 'pointer';
    this.swipeZone.hitArea = new Rectangle(0, 0, logicalBoardWidth, LEVEL_NAV_HEIGHT);

    let swipeStartX: number | null = null;

    this.swipeZone.on('pointerdown', (event: FederatedPointerEvent) => {
      swipeStartX = event.global.x;
    });

    const handleSwipeEnd = (event: FederatedPointerEvent) => {
      if (swipeStartX === null) {
        return;
      }

      const deltaX = event.global.x - swipeStartX;
      swipeStartX = null;

      if (deltaX > LEVEL_NAV_SWIPE_THRESHOLD && this.hasPreviousLevel) {
        this.onPrevClick();
      } else if (deltaX < -LEVEL_NAV_SWIPE_THRESHOLD && this.hasNextLevel) {
        this.onNextClick();
      }
    };

    this.swipeZone.on('pointerup', handleSwipeEnd);
    this.swipeZone.on('pointerupoutside', handleSwipeEnd);

    this.levelText = new Text({
      text: String(levelNumber),
      style: {
        fill: COLORS.levelNavActiveTint,
        fontFamily: INTER_MEDIUM_FONT_FAMILY,
        fontSize: LEVEL_FONT_SIZE,
        fontWeight: '700',
      },
    });
    this.levelText.anchor.set(0.5);
    this.levelText.x = logicalBoardWidth / 2;
    this.levelText.y = LEVEL_NAV_HEIGHT / 2;
    this.levelText.eventMode = 'none';

    this.prevButton = new Sprite(getBack1Texture());
    this.prevButton.anchor.set(0.5);
    this.prevButton.width = ARROW_ICON_SIZE;
    this.prevButton.height = ARROW_ICON_SIZE;
    this.prevButton.x = logicalBoardWidth / 2 - ARROW_INSET_X;
    this.prevButton.y = LEVEL_NAV_HEIGHT / 2;
    this.prevButton.on('pointerdown', () => HapticManager.playLight());
    this.prevButton.on('pointertap', (event: FederatedPointerEvent) => {
      event.stopPropagation();
      this.onPrevClick();
    });

    this.nextButton = new Sprite(getBack1Texture());
    this.nextButton.anchor.set(0.5);
    this.nextButton.width = ARROW_ICON_SIZE;
    this.nextButton.height = ARROW_ICON_SIZE;
    this.nextButton.scale.x *= -1;
    this.nextButton.x = logicalBoardWidth / 2 + ARROW_INSET_X;
    this.nextButton.y = LEVEL_NAV_HEIGHT / 2;
    this.nextButton.on('pointerdown', () => HapticManager.playLight());
    this.nextButton.on('pointertap', (event: FederatedPointerEvent) => {
      event.stopPropagation();
      this.onNextClick();
    });

    this.addChild(this.swipeZone, this.levelText, this.prevButton, this.nextButton);

    this.setPrevEnabled(hasPreviousLevel);
    this.setNextEnabled(hasNextLevel);
  }

  updateLevel(levelNum: number): void {
    this.levelText.text = String(levelNum);
  }

  setPrevEnabled(isEnabled: boolean): void {
    this.hasPreviousLevel = isEnabled;
    this.applyEnabledState(this.prevButton, isEnabled);
  }

  setNextEnabled(isEnabled: boolean): void {
    this.hasNextLevel = isEnabled;
    this.applyEnabledState(this.nextButton, isEnabled);
  }

  private applyEnabledState(button: Sprite, isEnabled: boolean): void {
    button.tint = isEnabled ? COLORS.levelNavActiveTint : COLORS.levelNavInactiveTint;
    button.alpha = isEnabled ? 1 : 0.5;
    button.eventMode = isEnabled ? 'static' : 'none';
    button.cursor = isEnabled ? 'pointer' : 'default';
  }
}
