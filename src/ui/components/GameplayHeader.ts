import { Container, Text, Sprite } from 'pixi.js';
import { COLORS } from '../colors';
import { FONT_FAMILY, LEVEL_NAV_GAP, LEVEL_NAV_HEIGHT } from '../constants';
import { getBackTexture } from '../gameAssets';
import { LevelNavigation } from './LevelNavigation';

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
  private readonly levelNavigation: LevelNavigation;

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

    this.levelNavigation = new LevelNavigation({
      levelNumber,
      logicalBoardWidth,
      hasPreviousLevel,
      hasNextLevel,
      onPrevClick: () => onPrevLevel(),
      onNextClick: () => onNextLevel(),
    });

    this.addChild(
      this.backButton,
      this.timerText,
      this.remainingText,
      this.levelNavigation,
    );
  }

  updateTimer(timeString: string): void {
    this.timerText.text = timeString;
  }

  updateStars(count: number): void {
    this.remainingText.text = `Left: ${count}`;
  }

  updateLevelNumber(level: number): void {
    this.levelNavigation.updateLevel(level);
  }

  setLevelNavEnabled(hasPrevious: boolean, hasNext: boolean): void {
    this.levelNavigation.setPrevEnabled(hasPrevious);
    this.levelNavigation.setNextEnabled(hasNext);
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
    this.levelNavigation.scale.set(boardScale);
    this.levelNavigation.position.set(
      boardLeftX,
      boardTopY - LEVEL_NAV_GAP - LEVEL_NAV_HEIGHT * boardScale,
    );
  }
}
