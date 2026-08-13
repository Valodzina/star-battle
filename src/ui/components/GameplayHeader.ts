import { Container, FederatedPointerEvent, Graphics, Rectangle, Text, Sprite } from 'pixi.js';
import { COLORS } from '../colors';
import {
  FONT_FAMILY,
  LEVEL_NAV_GAP,
  LEVEL_NAV_HEIGHT,
  LEVEL_NAV_SWIPE_THRESHOLD,
} from '../constants';
import { getBackTexture } from '../gameAssets';

const ICON_BUTTON_SIZE = 40;
const HEADER_BUTTON_HEIGHT = 40;
const ACTIVE_TINT = 0x44505c;

export interface GameplayHeaderOptions {
  initialTimerText: string;
  initialStars: number;
  levelNumber: number;
  hasPreviousLevel: boolean;
  hasNextLevel: boolean;
  logicalBoardWidth: number;
  onBackClicked: () => void;
  onPrevLevel: () => void;
  onNextLevel: () => void;
}

export class GameplayHeader extends Container {
  private readonly backButton: Sprite;
  private readonly timerText: Text;
  private readonly remainingText: Text;
  private readonly levelNavContainer = new Container();
  private readonly swipeZone: Graphics;
  private readonly levelText: Text;
  private readonly leftArrow: Text;
  private readonly rightArrow: Text;
  private readonly onPrevLevel: () => void;
  private readonly onNextLevel: () => void;
  private readonly nextLevelTapHandler: (event: FederatedPointerEvent) => void;

  private hasPreviousLevel: boolean;
  private hasNextLevel: boolean;

  constructor(options: GameplayHeaderOptions) {
    super();

    const {
      initialTimerText,
      initialStars,
      levelNumber,
      hasPreviousLevel,
      hasNextLevel,
      logicalBoardWidth,
      onBackClicked,
      onPrevLevel,
      onNextLevel,
    } = options;

    this.onPrevLevel = onPrevLevel;
    this.onNextLevel = onNextLevel;
    this.hasPreviousLevel = hasPreviousLevel;
    this.hasNextLevel = hasNextLevel;

    this.backButton = new Sprite(getBackTexture());
    this.backButton.anchor.set(0.5);
    this.backButton.width = ICON_BUTTON_SIZE;
    this.backButton.height = ICON_BUTTON_SIZE;
    this.backButton.tint = ACTIVE_TINT;
    this.backButton.eventMode = 'static';
    this.backButton.cursor = 'pointer';
    this.backButton.on('pointertap', () => onBackClicked());

    this.timerText = new Text({
      text: initialTimerText,
      style: {
        fill: COLORS.elementFill,
        fontFamily: FONT_FAMILY,
        fontSize: 28,
        fontWeight: '700',
      },
    });
    this.timerText.anchor.set(0.5, 0);

    this.remainingText = new Text({
      text: `Left: ${initialStars}`,
      style: {
        fill: COLORS.elementFill,
        fontFamily: FONT_FAMILY,
        fontSize: 20,
        fontWeight: '600',
      },
    });
    this.remainingText.anchor.set(1, 0);

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
        this.onPrevLevel();
      } else if (deltaX < -LEVEL_NAV_SWIPE_THRESHOLD && this.hasNextLevel) {
        this.onNextLevel();
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

    this.leftArrow = new Text({ text: '<', style: arrowStyle });
    this.leftArrow.anchor.set(0.5);
    this.leftArrow.x = 28;
    this.leftArrow.y = LEVEL_NAV_HEIGHT / 2;
    this.leftArrow.on('pointertap', (event: FederatedPointerEvent) => {
      event.stopPropagation();
      this.onPrevLevel();
    });

    this.rightArrow = new Text({ text: '>', style: arrowStyle });
    this.rightArrow.anchor.set(0.5);
    this.rightArrow.x = logicalBoardWidth - 28;
    this.rightArrow.y = LEVEL_NAV_HEIGHT / 2;
    this.nextLevelTapHandler = (event: FederatedPointerEvent) => {
      event.stopPropagation();
      this.onNextLevel();
    };

    this.levelNavContainer.addChild(
      this.swipeZone,
      this.levelText,
      this.leftArrow,
      this.rightArrow,
    );

    this.addChild(
      this.backButton,
      this.timerText,
      this.remainingText,
      this.levelNavContainer,
    );

    this.setLevelNavEnabled(hasPreviousLevel, hasNextLevel);
  }

  updateTimer(timeString: string): void {
    this.timerText.text = timeString;
  }

  updateStars(count: number): void {
    this.remainingText.text = `Left: ${count}`;
  }

  updateLevelNumber(level: number): void {
    this.levelText.text = String(level);
  }

  setLevelNavEnabled(hasPrevious: boolean, hasNext: boolean): void {
    this.hasPreviousLevel = hasPrevious;
    this.hasNextLevel = hasNext;

    if (hasPrevious) {
      this.leftArrow.alpha = 1;
      this.leftArrow.eventMode = 'static';
      this.leftArrow.cursor = 'pointer';
    } else {
      this.leftArrow.alpha = 0.5;
      this.leftArrow.eventMode = 'none';
      this.leftArrow.cursor = 'default';
    }

    this.rightArrow.off('pointertap', this.nextLevelTapHandler);

    if (hasNext) {
      this.rightArrow.alpha = 1;
      this.rightArrow.eventMode = 'static';
      this.rightArrow.cursor = 'pointer';
      this.rightArrow.on('pointertap', this.nextLevelTapHandler);
    } else {
      this.rightArrow.alpha = 0.5;
      this.rightArrow.eventMode = 'none';
      this.rightArrow.cursor = 'default';
    }
  }

  layout(boardLeftX: number, boardRightX: number, uiScale: number, headerY: number): void {
    const iconDisplaySize = ICON_BUTTON_SIZE * uiScale;
    const iconHalfDisplay = iconDisplaySize / 2;
    const scaledHeaderHeight = HEADER_BUTTON_HEIGHT * uiScale;
    const boardCenterX = boardLeftX + (boardRightX - boardLeftX) / 2;

    this.backButton.width = iconDisplaySize;
    this.backButton.height = iconDisplaySize;
    this.backButton.position.set(
      boardLeftX + iconHalfDisplay,
      headerY + scaledHeaderHeight / 2,
    );

    this.timerText.scale.set(uiScale);
    this.timerText.position.set(boardCenterX, headerY);

    this.remainingText.scale.set(uiScale);
    this.remainingText.position.set(boardRightX, headerY);
  }

  layoutLevelNav(boardLeftX: number, boardTopY: number, boardScale: number): void {
    this.levelNavContainer.scale.set(boardScale);
    this.levelNavContainer.position.set(
      boardLeftX,
      boardTopY - LEVEL_NAV_GAP - LEVEL_NAV_HEIGHT * boardScale,
    );
  }
}
