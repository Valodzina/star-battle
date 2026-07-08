import { Application, Container, Graphics, Rectangle, Text } from 'pixi.js';
import gsap from 'gsap';
import type { CellState, Difficulty, GameplayState, GameState } from '../types/level';
import { DIFFICULTY_META } from '../types/level';
import type { LevelManager } from '../services/LevelManager';
import { COLORS, getRegionColor } from '../ui/colors';

const FONT_FAMILY = 'Arial, sans-serif';
const SCREEN_PADDING = 24;
const BUTTON_GAP = 16;
const TILE_GAP = 12;
const GAMEPLAY_HEADER_HEIGHT = 56;
const GRID_LINE_WIDTH = 1;
const REGION_BORDER_WIDTH = 4;

export interface GameViewCallbacks {
  onDifficultySelected: (difficulty: Difficulty) => void;
  onBackSelected: () => void;
  onLevelSelected: (index: number) => void;
  onCellClicked: (row: number, col: number) => void;
  onBackToLevels: () => void;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function getColumnsPerRow(width: number, height: number): number {
  if (height > width) {
    return 3;
  }

  return Math.min(6, Math.max(4, Math.floor(width / 100)));
}

export class GameView {
  private readonly root = new Container();
  private readonly app: Application;
  private readonly levelManager: LevelManager;
  private readonly activeTweens = new Set<gsap.core.Tween>();
  private callbacks: GameViewCallbacks = {
    onDifficultySelected: () => undefined,
    onBackSelected: () => undefined,
    onLevelSelected: () => undefined,
    onCellClicked: () => undefined,
    onBackToLevels: () => undefined,
  };

  private timerText: Text | null = null;
  private remainingText: Text | null = null;
  private cellMarkerGraphics: Graphics[][] = [];
  private victoryOverlay: Container | null = null;
  private currentCellSize = 0;

  constructor(app: Application, levelManager: LevelManager) {
    this.app = app;
    this.levelManager = levelManager;
    this.app.stage.addChild(this.root);
  }

  setCallbacks(callbacks: GameViewCallbacks): void {
    this.callbacks = callbacks;
  }

  render(state: GameState): void {
    this.killActiveTweens();
    this.clearGameplayRefs();
    this.root.removeChildren().forEach((child) => child.destroy({ children: true }));

    if (state.screen === 'mainMenu') {
      this.renderMainMenu();
      return;
    }

    if (state.screen === 'levelSelect' && state.selectedDifficulty) {
      this.renderLevelSelect(state.selectedDifficulty);
      return;
    }

    if (state.screen === 'gameplay' && state.gameplay) {
      this.renderGameplay(state.gameplay);
    }
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

  private renderMainMenu(): void {
    const { width, height } = this.app.screen;
    const buttonWidth = Math.min(320, width - SCREEN_PADDING * 2);
    const buttonHeight = 72;

    const title = new Text({
      text: 'Star Battle',
      style: {
        fill: COLORS.title,
        fontFamily: FONT_FAMILY,
        fontSize: 42,
        fontWeight: '700',
      },
    });
    title.anchor.set(0.5);
    title.x = width / 2;
    title.y = height * 0.18;
    this.root.addChild(title);

    const menu = new Container();
    const totalHeight =
      DIFFICULTY_META.length * buttonHeight + (DIFFICULTY_META.length - 1) * BUTTON_GAP;
    menu.x = width / 2 - buttonWidth / 2;
    menu.y = height / 2 - totalHeight / 2;

    DIFFICULTY_META.forEach((meta, index) => {
      const button = this.createButton({
        width: buttonWidth,
        height: buttonHeight,
        label: meta.label,
        subtitle: meta.subtitle,
        color: meta.color,
        onClick: () => this.callbacks.onDifficultySelected(meta.difficulty),
      });
      button.y = index * (buttonHeight + BUTTON_GAP);
      menu.addChild(button);
    });

    this.root.addChild(menu);
  }

  private renderLevelSelect(difficulty: Difficulty): void {
    const { width, height } = this.app.screen;
    const meta = DIFFICULTY_META.find((entry) => entry.difficulty === difficulty);
    const levelCount = this.levelManager.getLevelCount(difficulty);

    const backButton = this.createButton({
      width: 96,
      height: 44,
      label: 'Back',
      color: COLORS.buttonBack,
      onClick: () => this.callbacks.onBackSelected(),
    });
    backButton.x = SCREEN_PADDING;
    backButton.y = SCREEN_PADDING;
    this.root.addChild(backButton);

    const header = new Text({
      text: meta?.label ?? difficulty,
      style: {
        fill: COLORS.title,
        fontFamily: FONT_FAMILY,
        fontSize: 32,
        fontWeight: '700',
      },
    });
    header.anchor.set(0.5, 0);
    header.x = width / 2;
    header.y = SCREEN_PADDING;
    this.root.addChild(header);

    const columns = getColumnsPerRow(width, height);
    const contentTop = SCREEN_PADDING + 72;
    const contentWidth = width - SCREEN_PADDING * 2;
    const contentHeight = height - contentTop - SCREEN_PADDING;
    const tileSize = Math.min(
      Math.floor((contentWidth - (columns - 1) * TILE_GAP) / columns),
      Math.floor((contentHeight - TILE_GAP) / 2),
      120,
    );

    const grid = new Container();
    grid.x = SCREEN_PADDING + (contentWidth - (columns * tileSize + (columns - 1) * TILE_GAP)) / 2;
    grid.y = contentTop;

    for (let index = 0; index < levelCount; index += 1) {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const tile = this.createLevelTile({
        size: tileSize,
        label: `Level ${index + 1}`,
        onClick: () => this.callbacks.onLevelSelected(index),
      });
      tile.x = column * (tileSize + TILE_GAP);
      tile.y = row * (tileSize + TILE_GAP);
      grid.addChild(tile);
    }

    this.root.addChild(grid);
  }

  private renderGameplay(gameplay: GameplayState): void {
    const { width, height } = this.app.screen;
    const { level, boardState, elapsedSeconds, remainingElements, isVictory } = gameplay;
    const size = level.size;

    const backButton = this.createButton({
      width: 140,
      height: 40,
      label: 'Back to Levels',
      color: COLORS.buttonBack,
      onClick: () => this.callbacks.onBackToLevels(),
    });
    backButton.x = SCREEN_PADDING;
    backButton.y = SCREEN_PADDING;
    this.root.addChild(backButton);

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
    this.root.addChild(this.timerText);

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
    this.root.addChild(this.remainingText);

    const boardAreaTop = SCREEN_PADDING + GAMEPLAY_HEADER_HEIGHT;
    const boardAreaWidth = width - SCREEN_PADDING * 2;
    const boardAreaHeight = height - boardAreaTop - SCREEN_PADDING;
    this.currentCellSize = Math.floor(
      Math.min(boardAreaWidth / size, boardAreaHeight / size),
    );

    const boardWidth = this.currentCellSize * size;
    const boardHeight = this.currentCellSize * size;
    const boardContainer = new Container();
    boardContainer.x = (width - boardWidth) / 2;
    boardContainer.y = boardAreaTop + (boardAreaHeight - boardHeight) / 2;

    this.buildBoard(boardContainer, boardState, size, this.currentCellSize);
    this.root.addChild(boardContainer);

    this.victoryOverlay = this.createVictoryOverlay(width, height);
    this.victoryOverlay.visible = false;
    this.victoryOverlay.alpha = 0;
    this.root.addChild(this.victoryOverlay);

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
    const hitLayer = new Container();
    this.cellMarkerGraphics = [];

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

        const hitTarget = new Container();
        hitTarget.x = x;
        hitTarget.y = y;
        hitTarget.eventMode = 'static';
        hitTarget.cursor = 'pointer';
        hitTarget.hitArea = new Rectangle(0, 0, cellSize, cellSize);
        hitTarget.on('pointertap', () => this.callbacks.onCellClicked(row, col));
        hitLayer.addChild(hitTarget);
      }
      this.cellMarkerGraphics.push(markerRow);
    }

    this.drawGridLines(gridLines, size, cellSize);

    container.addChild(regionFills, gridLines, regionBorders, markersLayer, hitLayer);
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

  private clearGameplayRefs(): void {
    this.timerText = null;
    this.remainingText = null;
    this.cellMarkerGraphics = [];
    this.victoryOverlay = null;
    this.currentCellSize = 0;
  }

  private createButton(options: {
    width: number;
    height: number;
    label: string;
    subtitle?: string;
    color: number;
    onClick: () => void;
  }): Container {
    const { width, height, label, subtitle, color, onClick } = options;
    const container = new Container();
    const background = new Graphics();

    const drawBackground = (fillColor: number): void => {
      if (background.destroyed) {
        return;
      }

      background.clear();
      background.roundRect(0, 0, width, height, 12).fill(fillColor);
    };

    drawBackground(color);

    const labelText = new Text({
      text: label,
      style: {
        fill: COLORS.text,
        fontFamily: FONT_FAMILY,
        fontSize: subtitle ? 22 : 18,
        fontWeight: '700',
      },
    });
    labelText.x = 16;

    if (subtitle) {
      labelText.y = 14;
      const subtitleText = new Text({
        text: subtitle,
        style: {
          fill: COLORS.textMuted,
          fontFamily: FONT_FAMILY,
          fontSize: 16,
        },
      });
      subtitleText.x = 16;
      subtitleText.y = 40;
      container.addChild(background, labelText, subtitleText);
    } else {
      labelText.anchor.set(0, 0.5);
      labelText.y = height / 2;
      container.addChild(background, labelText);
    }

    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.hitArea = new Rectangle(0, 0, width, height);

    const hoverColor = this.lightenColor(color, 0.12);
    const hoverState = { blend: 0 };
    let hoverTween: gsap.core.Tween | undefined;

    const animateHover = (targetBlend: number): void => {
      hoverTween?.kill();
      hoverTween = gsap.to(hoverState, {
        blend: targetBlend,
        duration: 0.15,
        onUpdate: () => {
          if (background.destroyed) {
            hoverTween?.kill();
            return;
          }

          drawBackground(this.blendColor(color, hoverColor, hoverState.blend));
        },
      });
      this.trackTween(hoverTween);
    };

    container.on('pointerover', () => animateHover(1));
    container.on('pointerout', () => animateHover(0));
    container.on('destroy', () => {
      hoverTween?.kill();
    });
    container.on('pointertap', onClick);

    return container;
  }

  private createLevelTile(options: {
    size: number;
    label: string;
    onClick: () => void;
  }): Container {
    const { size, label, onClick } = options;
    const container = new Container();
    const background = new Graphics();

    const drawBackground = (fillColor: number): void => {
      if (background.destroyed) {
        return;
      }

      background.clear();
      background.roundRect(0, 0, size, size, 10).fill(fillColor);
    };

    drawBackground(COLORS.tile);

    const labelText = new Text({
      text: label,
      style: {
        fill: COLORS.text,
        fontFamily: FONT_FAMILY,
        fontSize: Math.max(14, Math.floor(size * 0.18)),
        fontWeight: '600',
      },
    });
    labelText.anchor.set(0.5);
    labelText.x = size / 2;
    labelText.y = size / 2;

    container.addChild(background, labelText);
    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.hitArea = new Rectangle(0, 0, size, size);

    container.on('pointerover', () => drawBackground(COLORS.tileHover));
    container.on('pointerout', () => drawBackground(COLORS.tile));
    container.on('pointertap', onClick);

    return container;
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

  private lightenColor(color: number, amount: number): number {
    const r = Math.min(255, ((color >> 16) & 0xff) + Math.round(255 * amount));
    const g = Math.min(255, ((color >> 8) & 0xff) + Math.round(255 * amount));
    const b = Math.min(255, (color & 0xff) + Math.round(255 * amount));
    return (r << 16) | (g << 8) | b;
  }

  private blendColor(from: number, to: number, progress: number): number {
    const clamped = Math.max(0, Math.min(1, progress));
    const fromR = (from >> 16) & 0xff;
    const fromG = (from >> 8) & 0xff;
    const fromB = from & 0xff;
    const toR = (to >> 16) & 0xff;
    const toG = (to >> 8) & 0xff;
    const toB = to & 0xff;

    const r = Math.round(fromR + (toR - fromR) * clamped);
    const g = Math.round(fromG + (toG - fromG) * clamped);
    const b = Math.round(fromB + (toB - fromB) * clamped);

    return (r << 16) | (g << 8) | b;
  }
}
