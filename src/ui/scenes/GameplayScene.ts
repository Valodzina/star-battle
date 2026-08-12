import { Container, FederatedPointerEvent, Graphics, Rectangle, Text, Sprite } from 'pixi.js';
import gsap from 'gsap';
import type { CellState, GameplayState } from '../../types/level';
import type { ProgressManager } from '../../services/ProgressManager';
import { COLORS, getRegionColor } from '../colors';
import {
  BUTTON_GAP,
  FONT_FAMILY,
  GAMEPLAY_FOOTER_HEIGHT,
  GAMEPLAY_HEADER_HEIGHT,
  GRID_LINE_WIDTH,
  LEVEL_NAV_GAP,
  LEVEL_NAV_HEIGHT,
  LEVEL_NAV_SWIPE_THRESHOLD,
  REGION_BORDER_WIDTH,
  SCREEN_PADDING,
} from '../constants';
import { Button } from '../components/Button';
import {
  AutofillToggle,
  AUTOFILL_TOGGLE_HEIGHT,
  AUTOFILL_TOGGLE_WIDTH,
} from '../components/AutofillToggle';
import type { IScene } from './IScene';
import {
  getBackTexture,
  getBinTexture,
  getStarTexture,
  getStarWinTexture,
  getUndoTexture,
} from '../gameAssets';

const VICTORY_CARD_WIDTH = 280;
const VICTORY_CARD_HEIGHT = 320;
const VICTORY_CARD_RADIUS = 16;
const VICTORY_STAR_SIZE = 96;
const VICTORY_BUTTON_WIDTH = 200;
const VICTORY_BUTTON_HEIGHT = 44;
const ICON_BUTTON_SIZE = 40;
const ACTIVE_TINT = 0x44505c;
const INACTIVE_TINT = 0x9ba4b5;

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
  // --- DEBUG_MODE panel ---
  onShowSolution: () => void;
  onNewBoard: () => void;
  // --- END DEBUG_MODE panel ---
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
  // --- DEBUG_MODE panel ---
  private readonly debugMode: boolean;
  // --- END DEBUG_MODE panel ---
  private readonly activeTweens = new Set<gsap.core.Tween>();
  private readonly invalidStarTweens = new Map<string, gsap.core.Tween>();

  private timerText: Text | null = null;
  private remainingText: Text | null = null;
  private undoButton: Sprite | null = null;
  private autoFillButton: AutofillToggle | null = null;
  private isAutoFillEnabled: boolean;
  private cellMarkers: Container[][] = [];
  private victoryOverlay: Container | null = null;
  private victoryCardContainer: Container | null = null;
  private victoryTimeText: Text | null = null;
  private victoryNextButton: Button | null = null;
  private lastElapsedSeconds = 0;
  // --- DEBUG_MODE panel ---
  private solutionOverlay: Graphics | null = null;
  // --- END DEBUG_MODE panel ---
  private currentCellSize = 0;
  private boardState: CellState[][] = [];
  private boardSize = 0;
  private pointerDownCell: { row: number; col: number } | null = null;
  private startCellPlacement: CellState['placed'] | null = null;
  private isDragging = false;
  private dragMode: 'painting' | 'erasing' | null = null;
  private lastEnteredCell: { row: number; col: number } | null = null;
  private hasPreviousLevel = false;
  private hasNextLevel = false;
  private rightArrow: Text | null = null;
  private nextLevelTapHandler: ((event: FederatedPointerEvent) => void) | null = null;

  constructor(
    gameplay: GameplayState,
    callbacks: GameplaySceneCallbacks,
    progressManager: ProgressManager,
    isAutoFillEnabled = true,
    debugMode = false,
  ) {
    super();
    this.gameplay = gameplay;
    this.callbacks = callbacks;
    this.progressManager = progressManager;
    this.isAutoFillEnabled = isAutoFillEnabled;
    this.debugMode = debugMode;
    this.visible = false;
  }

  show(): void {
    this.visible = true;
  }

  hide(): void {
    this.killActiveTweens();
    this.clearRefs();
    this.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.visible = false;
  }

  resize(width: number, height: number): void {
    this.killActiveTweens();
    this.clearRefs();
    this.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.build(width, height);
  }

  updateTimerDisplay(seconds: number): void {
    this.lastElapsedSeconds = seconds;
    if (this.timerText && !this.timerText.destroyed) {
      this.timerText.text = formatTime(seconds);
    }
  }

  setUndoEnabled(enabled: boolean): void {
    if (this.undoButton && !this.undoButton.destroyed) {
      this.setButtonEnabled(this.undoButton, enabled);
    }
  }

  setAutoFillEnabled(enabled: boolean): void {
    this.isAutoFillEnabled = enabled;
    this.applyAutoFillButtonAppearance();
  }

  updateGameplayBoard(
    boardState: CellState[][],
    remainingElements: number,
    isVictory: boolean,
  ): void {
    this.clearInvalidStarAnimations();
    this.boardState = boardState;

    if (this.remainingText && !this.remainingText.destroyed) {
      this.remainingText.text = `Left: ${remainingElements}`;
    }

    for (let row = 0; row < boardState.length; row += 1) {
      for (let col = 0; col < (boardState[row]?.length ?? 0); col += 1) {
        const cell = boardState[row]?.[col];
        const marker = this.cellMarkers[row]?.[col];
        if (cell && marker) {
          this.drawCellMarker(marker, cell.placed, this.currentCellSize);
        }
      }
    }

    if (isVictory) {
      this.showVictoryOverlay();
    } else {
      this.hideVictoryOverlay();
    }
  }

  updateInvalidStars(invalidPositions: Array<{ row: number; col: number }>): void {
    const invalidKeys = new Set(invalidPositions.map(({ row, col }) => `${row},${col}`));

    for (const [key, tween] of this.invalidStarTweens) {
      if (invalidKeys.has(key)) {
        continue;
      }

      tween.kill();
      this.invalidStarTweens.delete(key);
      this.resetInvalidStarVisual(key);
    }

    for (const { row, col } of invalidPositions) {
      const key = `${row},${col}`;
      if (this.invalidStarTweens.has(key)) {
        continue;
      }

      const marker = this.cellMarkers[row]?.[col];
      if (!marker || marker.destroyed) {
        continue;
      }

      const sprite = marker.children.find((child) => child instanceof Sprite);
      if (!(sprite instanceof Sprite) || sprite.destroyed) {
        continue;
      }

      // Markers are top-left anchored; pivot to cell center so scale pulses in place.
      const half = this.currentCellSize / 2;
      marker.pivot.set(half, half);
      marker.position.set(col * this.currentCellSize + half, row * this.currentCellSize + half);
      marker.scale.set(1);


      const tween = gsap.to(marker.scale, {
        x: 1.05,
        y: 1.05,
        duration: 0.22,
        delay: 0.35,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
      this.invalidStarTweens.set(key, tween);
    }
  }

  // --- DEBUG_MODE panel ---
  showSolutionOverlay(cells: Array<{ row: number; col: number }>): void {
    if (!this.debugMode || !this.solutionOverlay || this.solutionOverlay.destroyed) {
      return;
    }

    const cellSize = this.currentCellSize;
    const radius = cellSize * 0.175;
    this.solutionOverlay.clear();

    for (const { row, col } of cells) {
      const centerX = col * cellSize + cellSize / 2;
      const centerY = row * cellSize + cellSize / 2;
      this.solutionOverlay
        .circle(centerX, centerY, radius)
        .fill({ color: COLORS.answerColor, alpha: 0.55 });
    }

    this.solutionOverlay.visible = true;
  }

  clearSolutionOverlay(): void {
    if (!this.solutionOverlay || this.solutionOverlay.destroyed) {
      return;
    }

    this.solutionOverlay.clear();
    this.solutionOverlay.visible = false;
  }
  // --- END DEBUG_MODE panel ---

  private build(width: number, height: number): void {
    const { level, boardState, elapsedSeconds, remainingElements, isVictory } = this.gameplay;
    const size = level.size;

    const headerButtonHeight = 40;
    const footerButtonHeight = 40;
    // --- DEBUG_MODE panel ---
    const debugButtonHeight = 40;
    const debugButtonGap = 12;
    const debugReserve = this.debugMode ? debugButtonHeight + debugButtonGap : 0;
    // --- END DEBUG_MODE panel ---

    const boardAreaTop = SCREEN_PADDING + GAMEPLAY_HEADER_HEIGHT;
    const boardAreaWidth = width - SCREEN_PADDING * 2;
    const boardBottomReserve = GAMEPLAY_FOOTER_HEIGHT + debugReserve;
    const boardAreaHeight =
      height -
      boardAreaTop -
      SCREEN_PADDING -
      boardBottomReserve -
      LEVEL_NAV_HEIGHT -
      LEVEL_NAV_GAP;

    this.currentCellSize = Math.floor(
      Math.min(boardAreaWidth / size, boardAreaHeight / size),
    );

    const boardWidth = this.currentCellSize * size;
    const boardHeight = this.currentCellSize * size;
    const boardContainer = new Container();
    boardContainer.x = (width - boardWidth) / 2;
    boardContainer.y =
      boardAreaTop +
      LEVEL_NAV_HEIGHT +
      LEVEL_NAV_GAP +
      (boardAreaHeight - boardHeight) / 2;

    const boardLeftX = boardContainer.x;
    const boardRightX = boardContainer.x + boardWidth;
    const boardCenterX = boardLeftX + boardWidth / 2;
    const levelNavTop = boardContainer.y - LEVEL_NAV_HEIGHT - LEVEL_NAV_GAP;
    const boardBottom = boardContainer.y + boardHeight;

    this.buildLevelNavigation(boardLeftX, levelNavTop, boardWidth);
    this.buildBoard(boardContainer, boardState, size, this.currentCellSize);
    this.addChild(boardContainer);

    // --- Shared chrome scale (narrow portrait / short landscape) ---
    const isPortrait = height > width;
    const autoFillButtonWidth = AUTOFILL_TOGGLE_WIDTH;
    const footerContentWidth =
      ICON_BUTTON_SIZE + BUTTON_GAP + ICON_BUTTON_SIZE + BUTTON_GAP + autoFillButtonWidth;

    const availableTopHeight = Math.max(0, levelNavTop - SCREEN_PADDING);
    const footerBandTop = boardBottom;
    const footerBandBottom = height - SCREEN_PADDING - debugReserve;
    const availableBottomHeight = Math.max(0, footerBandBottom - footerBandTop);

    const widthScale = Math.min(1, boardWidth / footerContentWidth);
    const heightScale = Math.min(
      1,
      availableTopHeight / headerButtonHeight,
      availableBottomHeight / footerButtonHeight,
    );
    const uiScale = Math.min(widthScale, heightScale);
    const iconDisplaySize = ICON_BUTTON_SIZE * uiScale;
    const iconHalfDisplay = iconDisplaySize / 2;

    // --- Header: Back / Timer / Remaining, anchored to board edges ---
    const scaledHeaderHeight = headerButtonHeight * uiScale;
    const headerY =
      SCREEN_PADDING + Math.max(0, (availableTopHeight - scaledHeaderHeight) / 2);

    const backButton = new Sprite(getBackTexture());
    backButton.anchor.set(0.5);
    backButton.width = iconDisplaySize;
    backButton.height = iconDisplaySize;
    backButton.x = boardLeftX + iconHalfDisplay;
    backButton.y = headerY + scaledHeaderHeight / 2;
    backButton.on('pointertap', () => this.callbacks.onBackToLevels());
    this.setButtonEnabled(backButton, true);
    this.addChild(backButton);

    this.timerText = new Text({
      text: formatTime(elapsedSeconds),
      style: {
        fill: COLORS.elementFill,
        fontFamily: FONT_FAMILY,
        fontSize: 28,
        fontWeight: '700',
      },
    });
    this.timerText.anchor.set(0.5, 0);
    this.timerText.scale.set(uiScale);
    this.timerText.x = boardCenterX;
    this.timerText.y = headerY;
    this.addChild(this.timerText);

    this.remainingText = new Text({
      text: `Left: ${remainingElements}`,
      style: {
        fill: COLORS.elementFill,
        fontFamily: FONT_FAMILY,
        fontSize: 20,
        fontWeight: '600',
      },
    });
    this.remainingText.anchor.set(1, 0);
    this.remainingText.scale.set(uiScale);
    this.remainingText.x = boardRightX;
    this.remainingText.y = headerY;
    this.addChild(this.remainingText);

    // --- Footer: Undo / Clear / Autofill, anchored to board edges ---
    const scaledFooterHeight = footerButtonHeight * uiScale;
    const bottomSafePadding = SCREEN_PADDING + debugReserve;
    let footerY: number;
    if (isPortrait) {
      footerY = height - bottomSafePadding - scaledFooterHeight;
      footerY = Math.max(footerY, boardBottom);
    } else {
      footerY =
        footerBandTop + Math.max(0, (availableBottomHeight - scaledFooterHeight) / 2);
    }
    const footerCenterY = footerY + scaledFooterHeight / 2;

    this.undoButton = new Sprite(getUndoTexture());
    this.undoButton.anchor.set(0.5);
    this.undoButton.width = iconDisplaySize;
    this.undoButton.height = iconDisplaySize;
    this.undoButton.x = boardLeftX + iconHalfDisplay;
    this.undoButton.y = footerCenterY;
    this.undoButton.on('pointertap', () => this.callbacks.onUndoClick());
    this.setButtonEnabled(this.undoButton, false);
    this.addChild(this.undoButton);

    this.autoFillButton = new AutofillToggle({
      isActive: this.isAutoFillEnabled,
      onToggle: () => this.callbacks.onAutoFillToggle(),
    });
    this.autoFillButton.scale.set(uiScale);
    this.autoFillButton.x = boardRightX - autoFillButtonWidth * uiScale;
    this.autoFillButton.y = footerCenterY - (AUTOFILL_TOGGLE_HEIGHT * uiScale) / 2;
    this.addChild(this.autoFillButton);

    const clearButton = new Sprite(getBinTexture());
    clearButton.anchor.set(0.5);
    clearButton.width = iconDisplaySize;
    clearButton.height = iconDisplaySize;
    clearButton.x = this.autoFillButton.x - BUTTON_GAP * uiScale - iconHalfDisplay;
    clearButton.y = footerCenterY;
    clearButton.on('pointertap', () => this.callbacks.onClearBoard());
    this.setButtonEnabled(clearButton, true);
    this.addChild(clearButton);

    // --- DEBUG_MODE panel ---
    if (this.debugMode) {
      const solutionButtonWidth = 160;
      const newBoardButtonWidth = 140;
      const panelWidth = solutionButtonWidth + BUTTON_GAP + newBoardButtonWidth;
      const panelX = boardLeftX + Math.max(0, (boardWidth - panelWidth) / 2);
      const panelY = height - SCREEN_PADDING - debugButtonHeight;

      const solutionButton = new Button({
        width: solutionButtonWidth,
        height: debugButtonHeight,
        label: 'Show Solution',
        color: COLORS.buttonEasy,
        onClick: () => this.callbacks.onShowSolution(),
      });
      solutionButton.x = panelX;
      solutionButton.y = panelY;
      this.addChild(solutionButton);

      const newBoardButton = new Button({
        width: newBoardButtonWidth,
        height: debugButtonHeight,
        label: 'New Board',
        color: COLORS.buttonMedium,
        onClick: () => this.callbacks.onNewBoard(),
      });
      newBoardButton.x = panelX + solutionButtonWidth + BUTTON_GAP;
      newBoardButton.y = panelY;
      this.addChild(newBoardButton);
    }
    // --- END DEBUG_MODE panel ---

    this.lastElapsedSeconds = elapsedSeconds;
    this.victoryOverlay = this.createVictoryOverlay(width, height);
    this.victoryOverlay.visible = false;
    this.addChild(this.victoryOverlay);

    if (isVictory) {
      this.showVictoryOverlay();
    }
  }

  private buildLevelNavigation(x: number, y: number, width: number): void {
    const { levelIndex, levelCount, level } = this.gameplay;
    this.hasPreviousLevel = levelIndex > 0;
    const nextLevelId = adjacentLevelId(level.id, 1);
    this.hasNextLevel =
      levelIndex < levelCount - 1 &&
      nextLevelId !== null &&
      this.progressManager.isUnlocked(nextLevelId);

    const navigationContainer = new Container();
    navigationContainer.x = x;
    navigationContainer.y = y;

    const swipeZone = new Graphics();
    swipeZone.rect(0, 0, width, LEVEL_NAV_HEIGHT).fill({ color: 0xffffff, alpha: 0.3 });
    swipeZone.eventMode = 'static';
    swipeZone.cursor = 'pointer';
    swipeZone.hitArea = new Rectangle(0, 0, width, LEVEL_NAV_HEIGHT);
    navigationContainer.addChild(swipeZone);

    let swipeStartX: number | null = null;

    swipeZone.on('pointerdown', (event: FederatedPointerEvent) => {
      swipeStartX = event.global.x;
    });

    const handleSwipeEnd = (event: FederatedPointerEvent) => {
      if (swipeStartX === null) {
        return;
      }

      const deltaX = event.global.x - swipeStartX;
      swipeStartX = null;

      if (deltaX > LEVEL_NAV_SWIPE_THRESHOLD && this.hasPreviousLevel) {
        this.callbacks.onPreviousLevel();
      } else if (deltaX < -LEVEL_NAV_SWIPE_THRESHOLD && this.hasNextLevel) {
        this.callbacks.onNextLevel();
      }
    };

    swipeZone.on('pointerup', handleSwipeEnd);
    swipeZone.on('pointerupoutside', handleSwipeEnd);

    const levelText = new Text({
      text: String(levelIndex + 1),
      style: {
        fill: COLORS.elementFill,
        fontFamily: FONT_FAMILY,
        fontSize: 32,
        fontWeight: '700',
      },
    });
    levelText.anchor.set(0.5);
    levelText.x = width / 2;
    levelText.y = LEVEL_NAV_HEIGHT / 2;
    levelText.eventMode = 'none';
    navigationContainer.addChild(levelText);

    const arrowStyle = {
      fill: COLORS.elementFill,
      fontFamily: FONT_FAMILY,
      fontSize: 28,
      fontWeight: '700' as const,
    };

    const leftArrow = new Text({ text: '<', style: arrowStyle });
    leftArrow.anchor.set(0.5);
    leftArrow.x = 28;
    leftArrow.y = LEVEL_NAV_HEIGHT / 2;
    if (this.hasPreviousLevel) {
      leftArrow.alpha = 1;
      leftArrow.eventMode = 'static';
      leftArrow.cursor = 'pointer';
      leftArrow.on('pointertap', (event: FederatedPointerEvent) => {
        event.stopPropagation();
        this.callbacks.onPreviousLevel();
      });
    } else {
      leftArrow.alpha = 0.5;
      leftArrow.eventMode = 'none';
    }
    navigationContainer.addChild(leftArrow);

    const rightArrow = new Text({ text: '>', style: arrowStyle });
    rightArrow.anchor.set(0.5);
    rightArrow.x = width - 28;
    rightArrow.y = LEVEL_NAV_HEIGHT / 2;
    this.rightArrow = rightArrow;
    this.nextLevelTapHandler = (event: FederatedPointerEvent) => {
      event.stopPropagation();
      this.callbacks.onNextLevel();
    };
    this.applyNextLevelButtonState();
    navigationContainer.addChild(rightArrow);

    this.addChild(navigationContainer);
  }

  refreshLevelNavigation(): void {
    const { levelIndex, levelCount, level } = this.gameplay;
    const nextLevelId = adjacentLevelId(level.id, 1);
    this.hasNextLevel =
      levelIndex < levelCount - 1 &&
      nextLevelId !== null &&
      this.progressManager.isUnlocked(nextLevelId);
    this.applyNextLevelButtonState();
  }

  private applyNextLevelButtonState(): void {
    this.applyVictoryNextButtonState();

    if (!this.rightArrow || this.rightArrow.destroyed) {
      return;
    }

    if (this.nextLevelTapHandler) {
      this.rightArrow.off('pointertap', this.nextLevelTapHandler);
    }

    if (this.hasNextLevel) {
      this.rightArrow.alpha = 1;
      this.rightArrow.eventMode = 'static';
      this.rightArrow.cursor = 'pointer';
      if (this.nextLevelTapHandler) {
        this.rightArrow.on('pointertap', this.nextLevelTapHandler);
      }
    } else {
      this.rightArrow.alpha = 0.5;
      this.rightArrow.eventMode = 'none';
      this.rightArrow.cursor = 'default';
    }
  }

  private buildBoard(
    container: Container,
    boardState: CellState[][],
    size: number,
    cellSize: number,
  ): void {
    const boardUnderlay = new Graphics();
    const regionFills = new Graphics();
    const gridLines = new Graphics();
    const regionBorders = new Graphics();
    const outerPerimeter = new Graphics();
    const markersLayer = new Container();
    const boardMask = new Graphics();
    this.cellMarkers = [];
    this.boardState = boardState;
    this.boardSize = size;

    const cellRadius = this.cellCornerRadius(cellSize);
    const boardWidth = size * cellSize;
    const boardHeight = size * cellSize;

    boardUnderlay
      .roundRect(0, 0, boardWidth, boardHeight, cellRadius)
      .fill(COLORS.boardUnderlay);

    for (let row = 0; row < size; row += 1) {
      const markerRow: Container[] = [];
      for (let col = 0; col < size; col += 1) {
        const cell = boardState[row]?.[col];
        if (!cell) {
          continue;
        }

        const x = col * cellSize;
        const y = row * cellSize;

        // Full cell bounds so grid lines sit flush on edges with no gutters.
        regionFills
          .roundRect(x, y, cellSize, cellSize, cellRadius)
          .fill(getRegionColor(cell.regionId));

        const marker = new Container();
        this.drawCellMarker(marker, cell.placed, cellSize);
        marker.x = x;
        marker.y = y;
        markerRow.push(marker);
        markersLayer.addChild(marker);
      }
      this.cellMarkers.push(markerRow);
    }

    this.drawGridLines(gridLines, size, cellSize);
    this.drawAllRegionBorders(regionBorders, boardState, size, cellSize);

    outerPerimeter.roundRect(0, 0, boardWidth, boardHeight, cellRadius).stroke({
      width: REGION_BORDER_WIDTH,
      color: COLORS.regionBorder,
      alignment: 1,
      join: 'round',
      cap: 'round',
    });

    boardMask.roundRect(0, 0, boardWidth, boardHeight, cellRadius).fill(0xffffff);

    // underlay → fills → grid → internal region borders → master perimeter → markers
    container.addChild(
      boardUnderlay,
      regionFills,
      gridLines,
      regionBorders,
      outerPerimeter,
      markersLayer,
    );
    // --- DEBUG_MODE panel ---
    if (this.debugMode) {
      this.solutionOverlay = new Graphics();
      this.solutionOverlay.visible = false;
      container.addChild(this.solutionOverlay);
    }
    // --- END DEBUG_MODE panel ---
    container.addChild(boardMask);
    container.mask = boardMask;
    this.attachBoardPointerHandlers(container, size, cellSize);
  }

  private cellCornerRadius(cellSize: number): number {
    return Math.min(12, Math.max(4, cellSize * 0.15));
  }

  private attachBoardPointerHandlers(container: Container, size: number, cellSize: number): void {
    const boardWidth = size * cellSize;
    const boardHeight = size * cellSize;

    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.hitArea = new Rectangle(0, 0, boardWidth, boardHeight);

    container.on('pointerdown', (event: FederatedPointerEvent) => {
      this.resetDragSession();
      const cell = this.getCellFromLocalPoint(event.getLocalPosition(container));
      if (!cell) {
        return;
      }

      this.pointerDownCell = cell;
      this.startCellPlacement = this.boardState[cell.row]?.[cell.col]?.placed ?? null;
    });

    container.on('globalpointermove', (event: FederatedPointerEvent) => {
      if (!this.pointerDownCell) {
        return;
      }

      const cell = this.getCellFromLocalPoint(event.getLocalPosition(container));
      if (!cell) {
        return;
      }

      if (
        this.lastEnteredCell &&
        this.lastEnteredCell.row === cell.row &&
        this.lastEnteredCell.col === cell.col
      ) {
        return;
      }

      const crossedStartCell =
        cell.row !== this.pointerDownCell.row || cell.col !== this.pointerDownCell.col;

      if (crossedStartCell || this.isDragging) {
        if (!this.isDragging) {
          this.isDragging = true;
          this.dragMode = this.resolveDragMode(this.startCellPlacement);
          this.applyDragToCell(this.pointerDownCell.row, this.pointerDownCell.col);
        }

        this.applyDragToCell(cell.row, cell.col);
      }

      this.lastEnteredCell = cell;
    });

    const handlePointerUp = (event: FederatedPointerEvent): void => {
      if (!this.pointerDownCell) {
        return;
      }

      if (!this.isDragging) {
        const cell = this.getCellFromLocalPoint(event.getLocalPosition(container));
        if (
          cell &&
          cell.row === this.pointerDownCell.row &&
          cell.col === this.pointerDownCell.col
        ) {
          this.callbacks.onCellTap(cell.row, cell.col);
        }
      } else {
        this.callbacks.onInteractionEnd();
      }

      this.resetDragSession();
    };

    container.on('pointerup', handlePointerUp);
    container.on('pointerupoutside', handlePointerUp);
  }

  private resolveDragMode(placement: CellState['placed'] | null): 'painting' | 'erasing' | null {
    if (placement === 'nothing' || placement === 'auto-dot') {
      return 'painting';
    }

    if (placement === 'dot') {
      return 'erasing';
    }

    return null;
  }

  private applyDragToCell(row: number, col: number): void {
    if (this.dragMode === 'painting') {
      this.callbacks.onDragPaint(row, col);
      return;
    }

    if (this.dragMode === 'erasing') {
      this.callbacks.onDragErase(row, col);
    }
  }

  private getCellFromLocalPoint(point: { x: number; y: number }): { row: number; col: number } | null {
    const col = Math.floor(point.x / this.currentCellSize);
    const row = Math.floor(point.y / this.currentCellSize);

    if (row < 0 || row >= this.boardSize || col < 0 || col >= this.boardSize) {
      return null;
    }

    return { row, col };
  }

  private resetDragSession(): void {
    this.pointerDownCell = null;
    this.startCellPlacement = null;
    this.isDragging = false;
    this.dragMode = null;
    this.lastEnteredCell = null;
  }

  private drawGridLines(graphics: Graphics, size: number, cellSize: number): void {
    const boardWidth = size * cellSize;
    const boardHeight = size * cellSize;
    const strokeOpts = {
      width: GRID_LINE_WIDTH,
      color: COLORS.gridLine,
      alpha: 1,
      cap: 'butt' as const,
      join: 'miter' as const,
    };

    // Continuous full-span lines aligned to cell edges (no per-cell segments).
    for (let i = 0; i <= size; i += 1) {
      const pos = i * cellSize;
      graphics.moveTo(pos, 0).lineTo(pos, boardHeight).stroke(strokeOpts);
      graphics.moveTo(0, pos).lineTo(boardWidth, pos).stroke(strokeOpts);
    }
  }

  private drawAllRegionBorders(
    graphics: Graphics,
    boardState: CellState[][],
    size: number,
    cellSize: number,
  ): void {
    const regionIds = new Set<number>();
    for (const row of boardState) {
      for (const cell of row) {
        if (cell) {
          regionIds.add(cell.regionId);
        }
      }
    }

    for (const regionId of regionIds) {
      this.strokeRegionPerimeter(graphics, boardState, size, cellSize, regionId);
    }
  }

  private strokeRegionPerimeter(
    graphics: Graphics,
    boardState: CellState[][],
    size: number,
    cellSize: number,
    regionId: number,
  ): void {
    const isInRegion = (row: number, col: number): boolean =>
      row >= 0 &&
      row < size &&
      col >= 0 &&
      col < size &&
      boardState[row]?.[col]?.regionId === regionId;

    // On-board neighbor with a different region (skips board perimeter edges).
    const isInternalBoundary = (row: number, col: number): boolean =>
      row >= 0 &&
      row < size &&
      col >= 0 &&
      col < size &&
      boardState[row]?.[col]?.regionId !== regionId;

    type GridPoint = { r: number; c: number };
    const pointKey = (p: GridPoint): string => `${p.r},${p.c}`;
    const edgeKey = (from: GridPoint, to: GridPoint): string =>
      `${pointKey(from)}->${pointKey(to)}`;

    const outgoing = new Map<string, GridPoint[]>();
    const unusedEdges = new Set<string>();

    const addEdge = (from: GridPoint, to: GridPoint): void => {
      const key = edgeKey(from, to);
      unusedEdges.add(key);
      const fromKey = pointKey(from);
      const targets = outgoing.get(fromKey) ?? [];
      targets.push(to);
      outgoing.set(fromKey, targets);
    };

    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (!isInRegion(row, col)) {
          continue;
        }

        // Internal region–region edges only; outer frame is the master perimeter.
        if (isInternalBoundary(row - 1, col)) {
          addEdge({ r: row, c: col }, { r: row, c: col + 1 });
        }
        if (isInternalBoundary(row, col + 1)) {
          addEdge({ r: row, c: col + 1 }, { r: row + 1, c: col + 1 });
        }
        if (isInternalBoundary(row + 1, col)) {
          addEdge({ r: row + 1, c: col + 1 }, { r: row + 1, c: col });
        }
        if (isInternalBoundary(row, col - 1)) {
          addEdge({ r: row + 1, c: col }, { r: row, c: col });
        }
      }
    }

    const strokeOpts = {
      width: REGION_BORDER_WIDTH,
      color: COLORS.regionBorder,
      join: 'round' as const,
      cap: 'round' as const,
    };

    while (unusedEdges.size > 0) {
      const startEdgeKey = unusedEdges.values().next().value;
      if (!startEdgeKey) {
        break;
      }

      const arrowIndex = startEdgeKey.indexOf('->');
      const fromStr = startEdgeKey.slice(0, arrowIndex);
      const toStr = startEdgeKey.slice(arrowIndex + 2);
      const [startR, startC] = fromStr.split(',').map(Number) as [number, number];
      const [firstToR, firstToC] = toStr.split(',').map(Number) as [number, number];

      let current: GridPoint = { r: startR, c: startC };
      let next: GridPoint = { r: firstToR, c: firstToC };
      const pathStart = current;

      graphics.moveTo(current.c * cellSize, current.r * cellSize);

      do {
        unusedEdges.delete(edgeKey(current, next));
        graphics.lineTo(next.c * cellSize, next.r * cellSize);
        current = next;

        if (current.r === pathStart.r && current.c === pathStart.c) {
          break;
        }

        const candidates = outgoing.get(pointKey(current)) ?? [];
        const unusedNext = candidates.find((target) => unusedEdges.has(edgeKey(current, target)));
        if (!unusedNext) {
          break;
        }
        next = unusedNext;
      } while (true);

      if (current.r === pathStart.r && current.c === pathStart.c) {
        graphics.closePath();
      }
      graphics.stroke(strokeOpts);
    }
  }

  private drawCellMarker(marker: Container, placed: CellState['placed'], cellSize: number): void {
    marker.removeChildren().forEach((child) => {
      child.destroy();
    });

    if (placed === 'nothing') {
      return;
    }

    const centerX = cellSize / 2;
    const centerY = cellSize / 2;

    if (placed === 'dot' || placed === 'auto-dot') {
      const radius = cellSize * 0.075;
      const dot = new Graphics().circle(centerX, centerY, radius).fill(COLORS.dotFill);
      marker.addChild(dot);
      return;
    }

    const sprite = new Sprite(getStarTexture());
    sprite.width = cellSize * 0.8;
    sprite.height = cellSize * 0.8;
    sprite.anchor.set(0.5);
    sprite.x = centerX;
    sprite.y = centerY;
    sprite.tint = COLORS.elementFill;
    marker.addChild(sprite);
  }

  private createVictoryOverlay(width: number, height: number): Container {
    const overlay = new Container();
    overlay.eventMode = 'passive';

    const cardContainer = new Container();
    cardContainer.x = width / 2;
    cardContainer.y = height / 2;
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
      color: COLORS.buttonEasy,
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
    if (!this.victoryNextButton || this.victoryNextButton.destroyed) {
      return;
    }

    this.victoryNextButton.setLabel(this.hasNextLevel ? 'Next Level' : 'Level Select');
  }

  private showVictoryOverlay(): void {
    if (!this.victoryOverlay || !this.victoryCardContainer || this.victoryOverlay.visible) {
      return;
    }

    if (this.victoryTimeText && !this.victoryTimeText.destroyed) {
      this.victoryTimeText.text = `Time: ${formatTime(this.lastElapsedSeconds)}`;
    }
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
    if (!this.victoryOverlay || !this.victoryOverlay.visible) {
      return;
    }

    this.victoryOverlay.visible = false;
    if (this.victoryCardContainer && !this.victoryCardContainer.destroyed) {
      this.victoryCardContainer.scale.set(0);
    }
  }

  private applyAutoFillButtonAppearance(): void {
    if (!this.autoFillButton || this.autoFillButton.destroyed) {
      return;
    }

    this.autoFillButton.setActive(this.isAutoFillEnabled);
  }

  private setButtonEnabled(buttonSprite: Sprite, isEnabled: boolean): void {
    buttonSprite.tint = isEnabled ? ACTIVE_TINT : INACTIVE_TINT;
    buttonSprite.eventMode = isEnabled ? 'static' : 'none';
    buttonSprite.cursor = isEnabled ? 'pointer' : 'default';
  }

  private clearRefs(): void {
    this.resetDragSession();
    this.timerText = null;
    this.remainingText = null;
    this.undoButton = null;
    this.autoFillButton = null;
    this.cellMarkers = [];
    this.victoryOverlay = null;
    this.victoryCardContainer = null;
    this.victoryTimeText = null;
    this.victoryNextButton = null;
    // --- DEBUG_MODE panel ---
    this.solutionOverlay = null;
    // --- END DEBUG_MODE panel ---
    this.currentCellSize = 0;
    this.boardState = [];
    this.boardSize = 0;
    this.hasPreviousLevel = false;
    this.hasNextLevel = false;
    this.rightArrow = null;
    this.nextLevelTapHandler = null;
  }

  private resetInvalidStarVisual(key: string): void {
    const [rowStr, colStr] = key.split(',');
    const row = Number(rowStr);
    const col = Number(colStr);
    const marker = this.cellMarkers[row]?.[col];
    if (!marker || marker.destroyed) {
      return;
    }

    marker.scale.set(1);
    marker.pivot.set(0, 0);
    marker.position.set(col * this.currentCellSize, row * this.currentCellSize);

    const sprite = marker.children.find((child) => child instanceof Sprite);
    if (sprite instanceof Sprite && !sprite.destroyed) {
      sprite.tint = COLORS.elementFill;
    }
  }

  private clearInvalidStarAnimations(): void {
    for (const [key, tween] of this.invalidStarTweens) {
      tween.kill();
      this.resetInvalidStarVisual(key);
    }
    this.invalidStarTweens.clear();
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
    this.clearInvalidStarAnimations();
    for (const tween of this.activeTweens) {
      tween.kill();
    }
    this.activeTweens.clear();
  }
}
