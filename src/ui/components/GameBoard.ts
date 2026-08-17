import { Container, FederatedPointerEvent, Graphics, Rectangle, Sprite } from 'pixi.js';
import gsap from 'gsap';
import type { CellState } from '../../types/level';
import { COLORS, getRegionColor } from '../colors';
import { GRID_LINE_WIDTH, REGION_BORDER_WIDTH } from '../constants';
import { getStarTexture } from '../gameAssets';

export interface GameBoardOptions {
  cellSize: number;
  size: number;
  boardState: CellState[][];
  onCellTap: (row: number, col: number) => void;
  onDragPaint: (row: number, col: number) => void;
  onDragErase: (row: number, col: number) => void;
  onInteractionEnd: () => void;
}

export class GameBoard extends Container {
  readonly logicalSize: number;

  private readonly cellSize: number;
  private readonly boardSize: number;
  private readonly onCellTap: (row: number, col: number) => void;
  private readonly onDragPaint: (row: number, col: number) => void;
  private readonly onDragErase: (row: number, col: number) => void;
  private readonly onInteractionEnd: () => void;

  private readonly gridContainer = new Container();
  private readonly markersContainer = new Container();
  private readonly boardMask = new Graphics();
  private readonly invalidStarTweens = new Map<string, gsap.core.Tween>();

  private cellFills: Container[][] = [];
  private cellMarkers: Container[][] = [];
  private boardState: CellState[][] = [];

  private pointerDownCell: { row: number; col: number } | null = null;
  private startCellPlacement: CellState['placed'] | null = null;
  private isDragging = false;
  private dragMode: 'painting' | 'erasing' | null = null;
  private lastEnteredCell: { row: number; col: number } | null = null;

  constructor(options: GameBoardOptions) {
    super();

    const {
      cellSize,
      size,
      boardState,
      onCellTap,
      onDragPaint,
      onDragErase,
      onInteractionEnd,
    } = options;

    this.cellSize = cellSize;
    this.boardSize = size;
    this.logicalSize = size * cellSize;
    this.onCellTap = onCellTap;
    this.onDragPaint = onDragPaint;
    this.onDragErase = onDragErase;
    this.onInteractionEnd = onInteractionEnd;

    this.addChild(this.gridContainer, this.markersContainer, this.boardMask);
    this.mask = this.boardMask;

    this.renderGrid(boardState);
    this.attachBoardPointerHandlers();
  }

  updateBoardState(boardState: CellState[][]): void {
    this.clearInvalidStarAnimations();
    this.boardState = boardState;

    for (let row = 0; row < boardState.length; row += 1) {
      for (let col = 0; col < (boardState[row]?.length ?? 0); col += 1) {
        const cell = boardState[row]?.[col];
        const marker = this.cellMarkers[row]?.[col];
        if (cell && marker) {
          this.drawCellMarker(marker, cell.placed);
        }
      }
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

  clearAnimations(): void {
    this.clearInvalidStarAnimations();
    this.clearPressAnimations();
  }

  private renderGrid(boardState: CellState[][]): void {
    const boardUnderlay = new Graphics();
    const cellsContainer = new Container();
    const gridLines = new Graphics();
    const regionBorders = new Graphics();
    const outerPerimeter = new Graphics();

    this.cellFills = [];
    this.cellMarkers = [];
    this.boardState = boardState;

    const cellRadius = this.cellCornerRadius(this.cellSize);
    const boardWidth = this.logicalSize;
    const boardHeight = this.logicalSize;
    const half = this.cellSize / 2;

    boardUnderlay
      .roundRect(0, 0, boardWidth, boardHeight, cellRadius)
      .fill(COLORS.boardUnderlay);

    for (let row = 0; row < this.boardSize; row += 1) {
      const fillRow: Container[] = [];
      const markerRow: Container[] = [];
      for (let col = 0; col < this.boardSize; col += 1) {
        const cell = boardState[row]?.[col];
        if (!cell) {
          continue;
        }

        const centerX = col * this.cellSize + half;
        const centerY = row * this.cellSize + half;

        const cellFill = new Container();
        const fill = new Graphics()
          .roundRect(-half, -half, this.cellSize, this.cellSize, cellRadius)
          .fill(getRegionColor(cell.regionId));
        cellFill.addChild(fill);
        cellFill.x = centerX;
        cellFill.y = centerY;
        this.attachCellPressHandlers(cellFill, row, col);
        fillRow.push(cellFill);
        cellsContainer.addChild(cellFill);

        const marker = new Container();
        this.drawCellMarker(marker, cell.placed);
        marker.x = centerX;
        marker.y = centerY;
        markerRow.push(marker);
        this.markersContainer.addChild(marker);
      }
      this.cellFills.push(fillRow);
      this.cellMarkers.push(markerRow);
    }

    this.drawGridLines(gridLines);
    this.drawAllRegionBorders(regionBorders, boardState);

    outerPerimeter.roundRect(0, 0, boardWidth, boardHeight, cellRadius).stroke({
      width: REGION_BORDER_WIDTH,
      color: COLORS.regionBorder,
      alignment: 1,
      join: 'round',
      cap: 'round',
    });

    this.boardMask.roundRect(0, 0, boardWidth, boardHeight, cellRadius).fill(COLORS.white);

    this.gridContainer.addChild(
      boardUnderlay,
      cellsContainer,
      gridLines,
      regionBorders,
      outerPerimeter,
    );
  }

  private cellCornerRadius(cellSize: number): number {
    return Math.min(12, Math.max(4, cellSize * 0.15));
  }

  private attachCellPressHandlers(cell: Container, row: number, col: number): void {
    cell.eventMode = 'static';
    cell.cursor = 'pointer';

    cell.on('pointerdown', () => {
      this.animateCellPress(row, col, true);
    });

    const restoreScale = (): void => {
      this.animateCellPress(row, col, false);
    };

    cell.on('pointerup', restoreScale);
    cell.on('pointerupoutside', restoreScale);
    cell.on('pointerout', restoreScale);
  }

  private animateCellPress(row: number, col: number, pressed: boolean): void {
    const tweenVars = pressed
      ? { x: 0.95, y: 0.95, duration: 0.1, ease: 'power2.out', overwrite: 'auto' as const }
      : { x: 1, y: 1, duration: 0.2, ease: 'back.out(2)', overwrite: 'auto' as const };

    const cell = this.cellFills[row]?.[col];
    if (cell && !cell.destroyed) {
      gsap.to(cell.scale, { ...tweenVars });
    }

    const marker = this.cellMarkers[row]?.[col];
    if (marker && !marker.destroyed && !this.invalidStarTweens.has(`${row},${col}`)) {
      gsap.to(marker.scale, { ...tweenVars });
    }
  }

  private clearPressAnimations(): void {
    for (const fillRow of this.cellFills) {
      for (const cell of fillRow) {
        if (!cell || cell.destroyed) {
          continue;
        }
        gsap.killTweensOf(cell.scale);
        cell.scale.set(1);
      }
    }

    for (let row = 0; row < this.cellMarkers.length; row += 1) {
      for (let col = 0; col < (this.cellMarkers[row]?.length ?? 0); col += 1) {
        if (this.invalidStarTweens.has(`${row},${col}`)) {
          continue;
        }

        const marker = this.cellMarkers[row]?.[col];
        if (!marker || marker.destroyed) {
          continue;
        }
        gsap.killTweensOf(marker.scale);
        marker.scale.set(1);
      }
    }
  }

  private attachBoardPointerHandlers(): void {
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.hitArea = new Rectangle(0, 0, this.logicalSize, this.logicalSize);

    this.on('pointerdown', (event: FederatedPointerEvent) => {
      this.resetDragSession();
      const cell = this.getCellFromLocalPoint(event.getLocalPosition(this));
      if (!cell) {
        return;
      }

      this.pointerDownCell = cell;
      this.startCellPlacement = this.boardState[cell.row]?.[cell.col]?.placed ?? null;
    });

    this.on('globalpointermove', (event: FederatedPointerEvent) => {
      if (!this.pointerDownCell) {
        return;
      }

      const cell = this.getCellFromLocalPoint(event.getLocalPosition(this));
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
        const cell = this.getCellFromLocalPoint(event.getLocalPosition(this));
        if (
          cell &&
          cell.row === this.pointerDownCell.row &&
          cell.col === this.pointerDownCell.col
        ) {
          this.onCellTap(cell.row, cell.col);
        }
      } else {
        this.onInteractionEnd();
      }

      this.resetDragSession();
    };

    this.on('pointerup', handlePointerUp);
    this.on('pointerupoutside', handlePointerUp);
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
      this.onDragPaint(row, col);
      return;
    }

    if (this.dragMode === 'erasing') {
      this.onDragErase(row, col);
    }
  }

  private getCellFromLocalPoint(point: { x: number; y: number }): { row: number; col: number } | null {
    const col = Math.floor(point.x / this.cellSize);
    const row = Math.floor(point.y / this.cellSize);

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

  private drawGridLines(graphics: Graphics): void {
    const boardWidth = this.logicalSize;
    const boardHeight = this.logicalSize;
    const strokeOpts = {
      width: GRID_LINE_WIDTH,
      color: COLORS.gridLine,
      alpha: 1,
      cap: 'butt' as const,
      join: 'miter' as const,
    };

    // Continuous full-span lines aligned to cell edges (no per-cell segments).
    for (let i = 0; i <= this.boardSize; i += 1) {
      const pos = i * this.cellSize;
      graphics.moveTo(pos, 0).lineTo(pos, boardHeight).stroke(strokeOpts);
      graphics.moveTo(0, pos).lineTo(boardWidth, pos).stroke(strokeOpts);
    }
  }

  private drawAllRegionBorders(graphics: Graphics, boardState: CellState[][]): void {
    const regionIds = new Set<number>();
    for (const row of boardState) {
      for (const cell of row) {
        if (cell) {
          regionIds.add(cell.regionId);
        }
      }
    }

    for (const regionId of regionIds) {
      this.strokeRegionPerimeter(graphics, boardState, regionId);
    }
  }

  private strokeRegionPerimeter(
    graphics: Graphics,
    boardState: CellState[][],
    regionId: number,
  ): void {
    const size = this.boardSize;
    const cellSize = this.cellSize;

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

  private drawCellMarker(marker: Container, placed: CellState['placed']): void {
    marker.removeChildren().forEach((child) => {
      child.destroy();
    });

    if (placed === 'nothing') {
      return;
    }

    if (placed === 'dot' || placed === 'auto-dot') {
      const radius = this.cellSize * 0.075;
      const dot = new Graphics().circle(0, 0, radius).fill(COLORS.dotFill);
      marker.addChild(dot);
      return;
    }

    const sprite = new Sprite(getStarTexture());
    sprite.width = this.cellSize * 0.8;
    sprite.height = this.cellSize * 0.8;
    sprite.anchor.set(0.5);
    sprite.x = 0;
    sprite.y = 0;
    sprite.tint = COLORS.elementFill;
    marker.addChild(sprite);
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
}
