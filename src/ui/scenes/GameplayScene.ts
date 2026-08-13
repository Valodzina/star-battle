import { Container, Graphics, Text, Sprite } from 'pixi.js';
import gsap from 'gsap';
import type { CellState, GameplayState } from '../../types/level';
import type { ProgressManager } from '../../services/ProgressManager';
import { COLORS } from '../colors';
import {
  FONT_FAMILY,
  GAMEPLAY_FOOTER_HEIGHT,
  GAMEPLAY_HEADER_HEIGHT,
  LEVEL_NAV_GAP,
  LEVEL_NAV_HEIGHT,
  SCREEN_PADDING,
} from '../constants';
import { Button } from '../components/Button';
import { GameBoard } from '../components/GameBoard';
import { GameplayHeader } from '../components/GameplayHeader';
import {
  GAMEPLAY_FOOTER_CONTENT_WIDTH,
  GameplayFooter,
} from '../components/GameplayFooter';
import type { IScene } from './IScene';
import { getStarWinTexture } from '../gameAssets';

const VICTORY_CARD_WIDTH = 280;
const VICTORY_CARD_HEIGHT = 320;
const VICTORY_CARD_RADIUS = 16;
const VICTORY_STAR_SIZE = 96;
const VICTORY_BUTTON_WIDTH = 200;
const VICTORY_BUTTON_HEIGHT = 44;
const BASE_CELL_SIZE = 64;
const HEADER_BUTTON_HEIGHT = 40;
const FOOTER_BUTTON_HEIGHT = 40;

const LEVEL_ID_PATTERN = /^(easy|medium|hard)_(\d+)$/;

function adjacentLevelId(levelId: string, delta: number): string | null {
  const match = LEVEL_ID_PATTERN.exec(levelId);
  if (!match) {
    return null;
  }

  const difficulty = match[1];
  const index = Number(match[2]);
  if (!difficulty || !Number.isFinite(index)) {
    return null;
  }

  const nextIndex = index + delta;
  if (nextIndex < 1) {
    return null;
  }

  return `${difficulty}_${nextIndex}`;
}

export interface GameplaySceneCallbacks {
  onCellTap: (row: number, col: number) => void;
  onDragPaint: (row: number, col: number) => void;
  onDragErase: (row: number, col: number) => void;
  onInteractionEnd: () => void;
  onUndoClick: () => void;
  onAutoFillToggle: () => void;
  onClearBoard: () => void;
  onBackToLevels: () => void;
  onPreviousLevel: () => void;
  onNextLevel: () => void;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export class GameplayScene extends Container implements IScene {
  private readonly gameplay: GameplayState;
  private readonly callbacks: GameplaySceneCallbacks;
  private readonly progressManager: ProgressManager;
  private readonly activeTweens = new Set<gsap.core.Tween>();

  private currentWidth = 0;
  private currentHeight = 0;
  private isPortrait = false;

  private gameBoard!: GameBoard;
  private header!: GameplayHeader;
  private footer!: GameplayFooter;
  private victoryOverlay!: Container;
  private victoryCardContainer!: Container;
  private victoryTimeText!: Text;
  private victoryNextButton!: Button;

  private isAutoFillEnabled: boolean;
  private lastElapsedSeconds = 0;
  private logicalBoardWidth = 0;
  private hasPreviousLevel = false;
  private hasNextLevel = false;

  constructor(
    gameplay: GameplayState,
    callbacks: GameplaySceneCallbacks,
    progressManager: ProgressManager,
    isAutoFillEnabled = true,
  ) {
    super();
    this.gameplay = gameplay;
    this.callbacks = callbacks;
    this.progressManager = progressManager;
    this.isAutoFillEnabled = isAutoFillEnabled;
    this.visible = false;
    this.init();
  }

  show(): void {
    this.visible = true;
  }

  hide(): void {
    this.killActiveTweens();
    this.gameBoard.clearAnimations();
    this.visible = false;
  }

  resize(screenWidth: number, screenHeight: number): void {
    this.currentWidth = screenWidth;
    this.currentHeight = screenHeight;
    this.isPortrait = this.currentHeight > this.currentWidth;

    const { level, isVictory } = this.gameplay;
    const size = level.size;

    const boardAreaTop = SCREEN_PADDING + GAMEPLAY_HEADER_HEIGHT;
    const boardAreaWidth = this.currentWidth - SCREEN_PADDING * 2;
    const boardBottomReserve = GAMEPLAY_FOOTER_HEIGHT;
    const boardAreaHeight =
      this.currentHeight -
      boardAreaTop -
      SCREEN_PADDING -
      boardBottomReserve -
      LEVEL_NAV_HEIGHT -
      LEVEL_NAV_GAP;

    const displayCellSize = Math.floor(
      Math.min(boardAreaWidth / size, boardAreaHeight / size),
    );
    const displayBoardSize = displayCellSize * size;
    const boardScale =
      this.logicalBoardWidth > 0 ? displayBoardSize / this.logicalBoardWidth : 1;

    const boardX = (this.currentWidth - displayBoardSize) / 2;
    const boardY =
      boardAreaTop +
      LEVEL_NAV_HEIGHT +
      LEVEL_NAV_GAP +
      (boardAreaHeight - displayBoardSize) / 2;

    this.gameBoard.scale.set(boardScale);
    this.gameBoard.position.set(boardX, boardY);

    const boardLeftX = this.gameBoard.x;
    const boardRightX =
      this.gameBoard.x + this.gameBoard.logicalSize * this.gameBoard.scale.x;
    const boardBottom =
      this.gameBoard.y + this.gameBoard.logicalSize * this.gameBoard.scale.y;
    const levelNavTop = this.gameBoard.y - LEVEL_NAV_HEIGHT - LEVEL_NAV_GAP;

    const availableTopHeight = Math.max(0, levelNavTop - SCREEN_PADDING);
    const footerBandTop = boardBottom;
    const footerBandBottom = this.currentHeight - SCREEN_PADDING;
    const availableBottomHeight = Math.max(0, footerBandBottom - footerBandTop);

    const widthScale = Math.min(1, displayBoardSize / GAMEPLAY_FOOTER_CONTENT_WIDTH);
    const heightScale = Math.min(
      1,
      availableTopHeight / HEADER_BUTTON_HEIGHT,
      availableBottomHeight / FOOTER_BUTTON_HEIGHT,
    );
    const uiScale = Math.min(widthScale, heightScale);

    const scaledHeaderHeight = HEADER_BUTTON_HEIGHT * uiScale;
    const headerY =
      SCREEN_PADDING + Math.max(0, (availableTopHeight - scaledHeaderHeight) / 2);

    const scaledFooterHeight = FOOTER_BUTTON_HEIGHT * uiScale;
    const bottomSafePadding = SCREEN_PADDING;
    let footerY: number;
    if (this.isPortrait) {
      footerY = this.currentHeight - bottomSafePadding - scaledFooterHeight;
      footerY = Math.max(footerY, boardBottom);
    } else {
      footerY =
        footerBandTop + Math.max(0, (availableBottomHeight - scaledFooterHeight) / 2);
    }
    const footerCenterY = footerY + scaledFooterHeight / 2;

    this.header.layout(boardLeftX, boardRightX, uiScale, headerY);
    this.header.layoutLevelNav(boardLeftX, this.gameBoard.y, boardScale);
    this.footer.layout(boardLeftX, boardRightX, uiScale, footerCenterY);

    this.victoryCardContainer.position.set(this.currentWidth / 2, this.currentHeight / 2);

    if (isVictory) {
      this.showVictoryOverlay();
    }
  }

  updateTimerDisplay(seconds: number): void {
    this.lastElapsedSeconds = seconds;
    this.header.updateTimer(formatTime(seconds));
  }

  setUndoEnabled(enabled: boolean): void {
    this.footer.setUndoEnabled(enabled);
  }

  setAutoFillEnabled(enabled: boolean): void {
    this.isAutoFillEnabled = enabled;
    this.footer.setAutoFillEnabled(enabled);
  }

  updateGameplayBoard(
    boardState: CellState[][],
    remainingElements: number,
    isVictory: boolean,
  ): void {
    this.gameBoard.updateBoardState(boardState);
    this.header.updateStars(remainingElements);

    if (isVictory) {
      this.showVictoryOverlay();
    } else {
      this.hideVictoryOverlay();
    }
  }

  updateInvalidStars(invalidPositions: Array<{ row: number; col: number }>): void {
    this.gameBoard.updateInvalidStars(invalidPositions);
  }

  private init(): void {
    const { level, boardState, elapsedSeconds, remainingElements, levelIndex, levelCount } =
      this.gameplay;

    this.lastElapsedSeconds = elapsedSeconds;

    this.hasPreviousLevel = levelIndex > 0;
    const nextLevelId = adjacentLevelId(level.id, 1);
    this.hasNextLevel =
      levelIndex < levelCount - 1 &&
      nextLevelId !== null &&
      this.progressManager.isUnlocked(nextLevelId);

    this.gameBoard = new GameBoard({
      cellSize: BASE_CELL_SIZE,
      size: level.size,
      boardState,
      onCellTap: (row, col) => this.callbacks.onCellTap(row, col),
      onDragPaint: (row, col) => this.callbacks.onDragPaint(row, col),
      onDragErase: (row, col) => this.callbacks.onDragErase(row, col),
      onInteractionEnd: () => this.callbacks.onInteractionEnd(),
    });
    this.logicalBoardWidth = this.gameBoard.logicalSize;

    this.header = new GameplayHeader({
      initialTimerText: formatTime(elapsedSeconds),
      initialStars: remainingElements,
      levelNumber: levelIndex + 1,
      hasPreviousLevel: this.hasPreviousLevel,
      hasNextLevel: this.hasNextLevel,
      logicalBoardWidth: this.logicalBoardWidth,
      onBackClicked: () => this.callbacks.onBackToLevels(),
      onPrevLevel: () => this.callbacks.onPreviousLevel(),
      onNextLevel: () => this.callbacks.onNextLevel(),
    });

    this.footer = new GameplayFooter({
      isAutoFillEnabled: this.isAutoFillEnabled,
      onUndoClicked: () => this.callbacks.onUndoClick(),
      onClearClicked: () => this.callbacks.onClearBoard(),
      onAutofillToggled: () => this.callbacks.onAutoFillToggle(),
    });

    this.victoryOverlay = this.createVictoryOverlay();
    this.victoryOverlay.visible = false;

    this.addChild(this.header, this.gameBoard, this.footer, this.victoryOverlay);
  }

  refreshLevelNavigation(): void {
    const { levelIndex, levelCount, level } = this.gameplay;
    const nextLevelId = adjacentLevelId(level.id, 1);
    this.hasNextLevel =
      levelIndex < levelCount - 1 &&
      nextLevelId !== null &&
      this.progressManager.isUnlocked(nextLevelId);
    this.header.setLevelNavEnabled(this.hasPreviousLevel, this.hasNextLevel);
    this.applyVictoryNextButtonState();
  }

  private createVictoryOverlay(): Container {
    const overlay = new Container();
    overlay.eventMode = 'passive';

    const cardContainer = new Container();
    cardContainer.pivot.set(VICTORY_CARD_WIDTH / 2, VICTORY_CARD_HEIGHT / 2);
    cardContainer.scale.set(0);
    cardContainer.eventMode = 'static';

    const shadow = new Graphics();
    shadow
      .roundRect(4, 6, VICTORY_CARD_WIDTH, VICTORY_CARD_HEIGHT, VICTORY_CARD_RADIUS)
      .fill({ color: COLORS.victoryCardShadow, alpha: 0.22 });

    const background = new Graphics();
    background
      .roundRect(0, 0, VICTORY_CARD_WIDTH, VICTORY_CARD_HEIGHT, VICTORY_CARD_RADIUS)
      .fill(COLORS.victoryCard);

    const titleText = new Text({
      text: 'SOLVED',
      style: {
        fill: COLORS.elementFill,
        fontFamily: FONT_FAMILY,
        fontSize: 36,
        fontWeight: '700',
      },
    });
    titleText.anchor.set(0.5, 0);
    titleText.x = VICTORY_CARD_WIDTH / 2;
    titleText.y = 28;

    const timeText = new Text({
      text: `Time: ${formatTime(this.lastElapsedSeconds)}`,
      style: {
        fill: COLORS.elementFill,
        fontFamily: FONT_FAMILY,
        fontSize: 20,
        fontWeight: '600',
      },
    });
    timeText.anchor.set(0.5, 0);
    timeText.x = VICTORY_CARD_WIDTH / 2;
    timeText.y = 78;
    this.victoryTimeText = timeText;

    const starSprite = new Sprite(getStarWinTexture());
    starSprite.anchor.set(0.5);
    starSprite.width = VICTORY_STAR_SIZE;
    starSprite.height = VICTORY_STAR_SIZE;
    starSprite.x = VICTORY_CARD_WIDTH / 2;
    starSprite.y = 170;
    starSprite.tint = COLORS.victoryStarTint;

    const nextButton = new Button({
      width: VICTORY_BUTTON_WIDTH,
      height: VICTORY_BUTTON_HEIGHT,
      label: this.hasNextLevel ? 'Next Level' : 'Level Select',
      color: COLORS.menuButtonColorEasy,
      onClick: () => {
        if (this.hasNextLevel) {
          this.callbacks.onNextLevel();
        } else {
          this.callbacks.onBackToLevels();
        }
      },
    });
    nextButton.x = (VICTORY_CARD_WIDTH - VICTORY_BUTTON_WIDTH) / 2;
    nextButton.y = VICTORY_CARD_HEIGHT - VICTORY_BUTTON_HEIGHT - 28;
    this.victoryNextButton = nextButton;

    cardContainer.addChild(shadow, background, titleText, timeText, starSprite, nextButton);
    this.victoryCardContainer = cardContainer;
    overlay.addChild(cardContainer);

    return overlay;
  }

  private applyVictoryNextButtonState(): void {
    this.victoryNextButton.setLabel(this.hasNextLevel ? 'Next Level' : 'Level Select');
  }

  private showVictoryOverlay(): void {
    if (this.victoryOverlay.visible) {
      return;
    }

    this.victoryTimeText.text = `Time: ${formatTime(this.lastElapsedSeconds)}`;
    this.applyVictoryNextButtonState();

    this.victoryOverlay.visible = true;
    this.victoryCardContainer.scale.set(0);

    const scaleTween = gsap.to(this.victoryCardContainer.scale, {
      x: 1,
      y: 1,
      duration: 0.5,
      ease: 'back.out(1.5)',
    });
    this.trackTween(scaleTween);
  }

  private hideVictoryOverlay(): void {
    if (!this.victoryOverlay.visible) {
      return;
    }

    this.victoryOverlay.visible = false;
    this.victoryCardContainer.scale.set(0);
  }

  private trackTween(tween: gsap.core.Tween): void {
    this.activeTweens.add(tween);
    tween.eventCallback('onComplete', () => {
      this.activeTweens.delete(tween);
    });
    tween.eventCallback('onInterrupt', () => {
      this.activeTweens.delete(tween);
    });
  }

  private killActiveTweens(): void {
    for (const tween of this.activeTweens) {
      tween.kill();
    }
    this.activeTweens.clear();
  }
}
