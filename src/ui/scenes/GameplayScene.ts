import { Container, FederatedPointerEvent, Graphics, Rectangle, Text } from 'pixi.js';
import gsap from 'gsap';
import type { CellState, GameplayState } from '../../types/level';
import { COLORS, getRegionColor } from '../colors';
import {
  BUTTON_GAP,
  FONT_FAMILY,
  GAMEPLAY_HEADER_HEIGHT,
  GRID_LINE_WIDTH,
  REGION_BORDER_WIDTH,
  SCREEN_PADDING,
} from '../constants';
import { Button } from '../components/Button';
import type { IScene } from './IScene';

export interface GameplaySceneCallbacks {
  onCellTap: (row: number, col: number) => void;
  onDragPaint: (row: number, col: number) => void;
  onDragErase: (row: number, col: number) => void;
  onInteractionEnd: () => void;
  onBackToLevels: () => void;
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
  // --- DEBUG_MODE panel ---
  private readonly debugMode: boolean;
  // --- END DEBUG_MODE panel ---
  private readonly activeTweens = new Set<gsap.core.Tween>();

  private timerText: Text | null = null;
  private remainingText: Text | null = null;
  private cellMarkerGraphics: Graphics[][] = [];
  private victoryOverlay: Container | null = null;
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

  constructor(
    gameplay: GameplayState,
    callbacks: GameplaySceneCallbacks,
    debugMode = false,
  ) {
    super();
    this.gameplay = gameplay;
    this.callbacks = callbacks;
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
    if (this.timerText && !this.timerText.destroyed) {
      this.timerText.text = formatTime(seconds);
    }
  }

  updateGameplayBoard(
    boardState: CellState[][],
    remainingElements: number,
    isVictory: boolean,
  ): void {
    this.boardState = boardState;

    if (this.remainingText && !this.remainingText.destroyed) {
      this.remainingText.text = `Left: ${remainingElements}`;
    }

    for (let row = 0; row < boardState.length; row += 1) {
      for (let col = 0; col < (boardState[row]?.length ?? 0); col += 1) {
        const cell = boardState[row]?.[col];
        const marker = this.cellMarkerGraphics[row]?.[col];
        if (cell && marker) {
          this.drawCellMarker(marker, cell.placed, this.currentCellSize);
        }
      }
    }

    if (isVictory) {
      this.showVictoryOverlay();
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

    const backButton = new Button({
      width: 140,
      height: 40,
      label: 'Back to Levels',
      color: COLORS.buttonBack,
      onClick: () => this.callbacks.onBackToLevels(),
    });
    backButton.x = SCREEN_PADDING;
    backButton.y = SCREEN_PADDING;
    this.addChild(backButton);

    this.timerText = new Text({
      text: formatTime(elapsedSeconds),
      style: {
        fill: COLORS.title,
        fontFamily: FONT_FAMILY,
        fontSize: 28,
        fontWeight: '700',
      },
    });
    this.timerText.anchor.set(0.5, 0);
    this.timerText.x = width / 2;
    this.timerText.y = SCREEN_PADDING + 4;
    this.addChild(this.timerText);

    this.remainingText = new Text({
      text: `Left: ${remainingElements}`,
      style: {
        fill: COLORS.textMuted,
        fontFamily: FONT_FAMILY,
        fontSize: 20,
        fontWeight: '600',
      },
    });
    this.remainingText.anchor.set(1, 0);
    this.remainingText.x = width - SCREEN_PADDING;
    this.remainingText.y = SCREEN_PADDING + 10;
    this.addChild(this.remainingText);

    const boardAreaTop = SCREEN_PADDING + GAMEPLAY_HEADER_HEIGHT;
    const boardAreaWidth = width - SCREEN_PADDING * 2;
    let boardBottomReserve = 0;
    // --- DEBUG_MODE panel ---
    const debugButtonHeight = 40;
    const debugButtonGap = 12;
    if (this.debugMode) {
      boardBottomReserve = debugButtonHeight + debugButtonGap;
    }
    // --- END DEBUG_MODE panel ---
    const boardAreaHeight = height - boardAreaTop - SCREEN_PADDING - boardBottomReserve;

    this.currentCellSize = Math.floor(
      Math.min(boardAreaWidth / size, boardAreaHeight / size),
    );

    const boardWidth = this.currentCellSize * size;
    const boardHeight = this.currentCellSize * size;
    const boardContainer = new Container();
    boardContainer.x = (width - boardWidth) / 2;
    boardContainer.y = boardAreaTop + (boardAreaHeight - boardHeight) / 2;

    this.buildBoard(boardContainer, boardState, size, this.currentCellSize);
    this.addChild(boardContainer);

    // --- DEBUG_MODE panel ---
    if (this.debugMode) {
      const solutionButtonWidth = 160;
      const newBoardButtonWidth = 140;
      const panelWidth = solutionButtonWidth + BUTTON_GAP + newBoardButtonWidth;
      const panelX = (width - panelWidth) / 2;
      const panelY = boardContainer.y + boardHeight + debugButtonGap;

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

    this.victoryOverlay = this.createVictoryOverlay(width, height);
    this.victoryOverlay.visible = false;
    this.victoryOverlay.alpha = 0;
    this.addChild(this.victoryOverlay);

    if (isVictory) {
      this.showVictoryOverlay();
    }
  }

  private buildBoard(
    container: Container,
    boardState: CellState[][],
    size: number,
    cellSize: number,
  ): void {
    const regionFills = new Graphics();
    const gridLines = new Graphics();
    const regionBorders = new Graphics();
    const markersLayer = new Container();
    this.cellMarkerGraphics = [];
    this.boardState = boardState;
    this.boardSize = size;

    for (let row = 0; row < size; row += 1) {
      const markerRow: Graphics[] = [];
      for (let col = 0; col < size; col += 1) {
        const cell = boardState[row]?.[col];
        if (!cell) {
          continue;
        }

        const x = col * cellSize;
        const y = row * cellSize;

        regionFills.rect(x, y, cellSize, cellSize).fill(getRegionColor(cell.regionId));
        this.drawRegionBorders(regionBorders, boardState, row, col, size, cellSize, x, y);

        const marker = new Graphics();
        this.drawCellMarker(marker, cell.placed, cellSize);
        marker.x = x;
        marker.y = y;
        markerRow.push(marker);
        markersLayer.addChild(marker);
      }
      this.cellMarkerGraphics.push(markerRow);
    }

    this.drawGridLines(gridLines, size, cellSize);

    container.addChild(regionFills, gridLines, regionBorders, markersLayer);
    // --- DEBUG_MODE panel ---
    if (this.debugMode) {
      this.solutionOverlay = new Graphics();
      this.solutionOverlay.visible = false;
      container.addChild(this.solutionOverlay);
    }
    // --- END DEBUG_MODE panel ---
    this.attachBoardPointerHandlers(container, size, cellSize);
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
    if (placement === 'nothing') {
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

    for (let i = 0; i <= size; i += 1) {
      const pos = i * cellSize;
      graphics
        .moveTo(pos, 0)
        .lineTo(pos, boardHeight)
        .stroke({ width: GRID_LINE_WIDTH, color: COLORS.gridLine });
      graphics
        .moveTo(0, pos)
        .lineTo(boardWidth, pos)
        .stroke({ width: GRID_LINE_WIDTH, color: COLORS.gridLine });
    }
  }

  private drawRegionBorders(
    graphics: Graphics,
    boardState: CellState[][],
    row: number,
    col: number,
    size: number,
    cellSize: number,
    x: number,
    y: number,
  ): void {
    const cell = boardState[row]?.[col];
    if (!cell) {
      return;
    }

    const strokeOpts = { width: REGION_BORDER_WIDTH, color: COLORS.regionBorder };

    const topNeighbor = row > 0 ? boardState[row - 1]?.[col] : undefined;
    if (row === 0 || topNeighbor?.regionId !== cell.regionId) {
      graphics.moveTo(x, y).lineTo(x + cellSize, y).stroke(strokeOpts);
    }

    const leftNeighbor = col > 0 ? boardState[row]?.[col - 1] : undefined;
    if (col === 0 || leftNeighbor?.regionId !== cell.regionId) {
      graphics.moveTo(x, y).lineTo(x, y + cellSize).stroke(strokeOpts);
    }

    const rightNeighbor = col < size - 1 ? boardState[row]?.[col + 1] : undefined;
    if (col === size - 1 || rightNeighbor?.regionId !== cell.regionId) {
      graphics
        .moveTo(x + cellSize, y)
        .lineTo(x + cellSize, y + cellSize)
        .stroke(strokeOpts);
    }

    const bottomNeighbor = row < size - 1 ? boardState[row + 1]?.[col] : undefined;
    if (row === size - 1 || bottomNeighbor?.regionId !== cell.regionId) {
      graphics
        .moveTo(x, y + cellSize)
        .lineTo(x + cellSize, y + cellSize)
        .stroke(strokeOpts);
    }
  }

  private drawCellMarker(graphics: Graphics, placed: CellState['placed'], cellSize: number): void {
    graphics.clear();

    if (placed === 'nothing') {
      return;
    }

    const centerX = cellSize / 2;
    const centerY = cellSize / 2;

    if (placed === 'dot') {
      const radius = cellSize * 0.075;
      graphics.circle(centerX, centerY, radius).fill(COLORS.dotFill);
      return;
    }

    const radius = cellSize * 0.175;
    graphics.circle(centerX, centerY, radius).fill(COLORS.elementFill);
  }

  private createVictoryOverlay(width: number, height: number): Container {
    const overlay = new Container();
    overlay.eventMode = 'static';

    const backdrop = new Graphics();
    backdrop.rect(0, GAMEPLAY_HEADER_HEIGHT, width, height - GAMEPLAY_HEADER_HEIGHT).fill({
      color: COLORS.victoryOverlay,
      alpha: 0.85,
    });
    backdrop.alpha = 0;

    const victoryText = new Text({
      text: 'Victory!',
      style: {
        fill: COLORS.victoryText,
        fontFamily: FONT_FAMILY,
        fontSize: 48,
        fontWeight: '700',
      },
    });
    victoryText.anchor.set(0.5);
    victoryText.x = width / 2;
    victoryText.y = height / 2;
    victoryText.alpha = 0;

    overlay.addChild(backdrop, victoryText);

    return overlay;
  }

  private showVictoryOverlay(): void {
    if (!this.victoryOverlay || this.victoryOverlay.visible) {
      return;
    }

    const backdrop = this.victoryOverlay.children[0];
    const victoryText = this.victoryOverlay.children[1];

    this.victoryOverlay.visible = true;
    this.victoryOverlay.alpha = 1;

    if (backdrop) {
      backdrop.alpha = 0;
      const backdropTween = gsap.to(backdrop, {
        alpha: 0.85,
        duration: 0.5,
      });
      this.trackTween(backdropTween);
    }

    if (victoryText) {
      victoryText.alpha = 0;
      const textTween = gsap.to(victoryText, {
        alpha: 1,
        duration: 0.5,
      });
      this.trackTween(textTween);
    }
  }

  private clearRefs(): void {
    this.resetDragSession();
    this.timerText = null;
    this.remainingText = null;
    this.cellMarkerGraphics = [];
    this.victoryOverlay = null;
    // --- DEBUG_MODE panel ---
    this.solutionOverlay = null;
    // --- END DEBUG_MODE panel ---
    this.currentCellSize = 0;
    this.boardState = [];
    this.boardSize = 0;
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
