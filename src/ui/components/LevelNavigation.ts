import { Container, FederatedPointerEvent, Graphics, Rectangle, Text } from 'pixi.js';
import { COLORS } from '../colors';
import {
  FONT_FAMILY,
  LEVEL_NAV_HEIGHT,
  LEVEL_NAV_SWIPE_THRESHOLD,
} from '../constants';

const ACTIVE_TINT = 0x44505c;
const INACTIVE_TINT = 0x9ba4b5;
const ARROW_INSET_X = 28;

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
  private readonly prevButton: Text;
  private readonly nextButton: Text;
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
      .fill({ color: 0xffffff, alpha: 0.3 });
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
        fill: COLORS.elementFill,
        fontFamily: FONT_FAMILY,
        fontSize: 32,
        fontWeight: '700',
      },
    });
    this.levelText.anchor.set(0.5);
    this.levelText.x = logicalBoardWidth / 2;
    this.levelText.y = LEVEL_NAV_HEIGHT / 2;
    this.levelText.eventMode = 'none';

    const arrowStyle = {
      fill: COLORS.elementFill,
      fontFamily: FONT_FAMILY,
      fontSize: 28,
      fontWeight: '700' as const,
    };

    this.prevButton = new Text({ text: '<', style: arrowStyle });
    this.prevButton.anchor.set(0.5);
    this.prevButton.x = ARROW_INSET_X;
    this.prevButton.y = LEVEL_NAV_HEIGHT / 2;
    this.prevButton.on('pointertap', (event: FederatedPointerEvent) => {
      event.stopPropagation();
      this.onPrevClick();
    });

    this.nextButton = new Text({ text: '>', style: arrowStyle });
    this.nextButton.anchor.set(0.5);
    this.nextButton.x = logicalBoardWidth - ARROW_INSET_X;
    this.nextButton.y = LEVEL_NAV_HEIGHT / 2;
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

  private applyEnabledState(button: Text, isEnabled: boolean): void {
    button.tint = isEnabled ? ACTIVE_TINT : INACTIVE_TINT;
    button.alpha = isEnabled ? 1 : 0.5;
    button.eventMode = isEnabled ? 'static' : 'none';
    button.cursor = isEnabled ? 'pointer' : 'default';
  }
}
