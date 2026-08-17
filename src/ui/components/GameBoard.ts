import { Container, FederatedPointerEvent, Graphics, Rectangle, Sprite } from 'pixi.js';
import gsap from 'gsap';
import type { CellState } from '../../types/level';
import { COLORS, REGION_BACKGROUNDS, getRegionColor } from '../colors';
import { REGION_BORDER_WIDTH } from '../constants';
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
  private visuallyPressedCell: { row: number; col: number } | null = null;

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

    this.markersContainer.eventMode = 'none';
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
    const regionBorders = new Graphics();
    const outerPerimeter = new Graphics();

    this.cellFills = [];
    this.cellMarkers = [];
    this.boardState = boardState;

    const cellRadius = this.cellCornerRadius(this.cellSize);
    const regionRadius = this.regionCornerRadius(this.cellSize);
    const boardWidth = this.logicalSize;
    const boardHeight = this.logicalSize;
    const half = this.cellSize / 2;

    boardUnderlay.roundRect(0, 0, boardWidth, boardHeight, cellRadius).fill(COLORS.boardUnderlay);

    for (let row = 0; row < this.boardSize; row += 1) {
      for (let col = 0; col < this.boardSize; col += 1) {
        const cell = boardState[row]?.[col];
        if (!cell) {
          continue;
        }

        const regionColor =
          REGION_BACKGROUNDS[cell.regionId % REGION_BACKGROUNDS.length] ?? COLORS.boardUnderlay;
        const x = col * this.cellSize;
        const y = row * this.cellSize;
        this.fillCellUnderlay(boardUnderlay, x, y, this.cellSize, regionRadius, {
          nw:
            this.isDifferentRegionOnBoard(boardState, row, col - 1, cell.regionId) &&
            this.isDifferentRegionOnBoard(boardState, row - 1, col, cell.regionId),
          ne:
            this.isDifferentRegionOnBoard(boardState, row, col + 1, cell.regionId) &&
            this.isDifferentRegionOnBoard(boardState, row - 1, col, cell.regionId),
          se:
            this.isDifferentRegionOnBoard(boardState, row, col + 1, cell.regionId) &&
            this.isDifferentRegionOnBoard(boardState, row + 1, col, cell.regionId),
          sw:
            this.isDifferentRegionOnBoard(boardState, row, col - 1, cell.regionId) &&
            this.isDifferentRegionOnBoard(boardState, row + 1, col, cell.regionId),
        }, regionColor);
      }
    }

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
        const fillInset = 0.2 * REGION_BORDER_WIDTH;
        const fillSize = this.cellSize - fillInset * 2;
        const fillHalf = fillSize / 2;

        const cellFill = new Container();
        const fill = new Graphics()
          .roundRect(-fillHalf, -fillHalf, fillSize, fillSize, this.cellCornerRadius(fillSize))
          .fill(getRegionColor(cell.regionId));
        cellFill.addChild(fill);
        cellFill.hitArea = new Rectangle(-half, -half, this.cellSize, this.cellSize);
        cellFill.eventMode = 'static';
        cellFill.cursor = 'pointer';
        cellFill.x = centerX;
        cellFill.y = centerY;
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

    this.drawAllRegionBorders(regionBorders, boardState, regionRadius);

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
      regionBorders,
      outerPerimeter,
    );
  }

  private cellCornerRadius(cellSize: number): number {
    return Math.min(12, Math.max(4, cellSize * 0.05));
  }

  private regionCornerRadius(cellSize: number): number {
    return Math.min(cellSize * 0.15, Math.max(4, cellSize * 0.05));
  }

  private isDifferentRegionOnBoard(
    boardState: CellState[][],
    row: number,
    col: number,
    regionId: number,
  ): boolean {
    const neighbor = boardState[row]?.[col];
    return neighbor != null && neighbor.regionId !== regionId;
  }

  private fillCellUnderlay(
    graphics: Graphics,
    x: number,
    y: number,
    size: number,
    radius: number,
    corners: { nw: boolean; ne: boolean; se: boolean; sw: boolean },
    color: number,
  ): void {
    const { nw, ne, se, sw } = corners;
    const right = x + size;
    const bottom = y + size;

    if (nw) {
      graphics.moveTo(x + radius, y);
    } else {
      graphics.moveTo(x, y);
    }

    if (ne) {
      graphics.lineTo(right - radius, y);
      graphics.arcTo(right, y, right, bottom, radius);
    } else {
      graphics.lineTo(right, y);
    }

    if (se) {
      graphics.lineTo(right, bottom - radius);
      graphics.arcTo(right, bottom, x, bottom, radius);
    } else {
      graphics.lineTo(right, bottom);
    }

    if (sw) {
      graphics.lineTo(x + radius, bottom);
      graphics.arcTo(x, bottom, x, y, radius);
    } else {
      graphics.lineTo(x, bottom);
    }

    if (nw) {
      graphics.lineTo(x, y + radius);
      graphics.arcTo(x, y, right, y, radius);
    } else {
      graphics.lineTo(x, y);
    }

    graphics.closePath().fill(color);
  }

  private isSameCell(
    a: { row: number; col: number } | null,
    b: { row: number; col: number } | null,
  ): boolean {
    return a != null && b != null && a.row === b.row && a.col === b.col;
  }

  private setVisuallyPressedCell(cell: { row: number; col: number } | null): void {
    if (this.isSameCell(this.visuallyPressedCell, cell)) {
      return;
    }

    if (this.visuallyPressedCell) {
      this.animateCellPress(this.visuallyPressedCell.row, this.visuallyPressedCell.col, false);
    }

    this.visuallyPressedCell = cell;

    if (cell) {
      this.animateCellPress(cell.row, cell.col, true);
    }
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
    this.visuallyPressedCell = null;

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
        this.setVisuallyPressedCell(null);
        return;
      }

      this.pointerDownCell = cell;
      this.startCellPlacement = this.boardState[cell.row]?.[cell.col]?.placed ?? null;
      this.setVisuallyPressedCell(cell);
    });

    this.on('globalpointermove', (event: FederatedPointerEvent) => {
      if (!this.pointerDownCell) {
        return;
      }

      const cell = this.getCellFromLocalPoint(event.getLocalPosition(this));
      this.setVisuallyPressedCell(cell);
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

      this.setVisuallyPressedCell(null);
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

  private drawAllRegionBorders(
    graphics: Graphics,
    boardState: CellState[][],
    cornerRadius: number,
  ): void {
    const size = this.boardSize;
    const cellSize = this.cellSize;
    const strokeOpts = {
      width: REGION_BORDER_WIDTH,
      color: COLORS.regionBorder,
      join: 'round' as const,
      cap: 'round' as const,
    };

    type Dir = 'n' | 'e' | 's' | 'w';
    const dirs: Dir[] = ['n', 'e', 's', 'w'];
    const opposite: Record<Dir, Dir> = { n: 's', e: 'w', s: 'n', w: 'e' };
    const delta: Record<Dir, { r: number; c: number }> = {
      n: { r: -1, c: 0 },
      e: { r: 0, c: 1 },
      s: { r: 1, c: 0 },
      w: { r: 0, c: -1 },
    };
    const pairs: Array<[Dir, Dir]> = [
      ['n', 'e'],
      ['e', 's'],
      ['s', 'w'],
      ['w', 'n'],
    ];

    const regionAt = (row: number, col: number): number | null => {
      if (row < 0 || row >= size || col < 0 || col >= size) {
        return null;
      }
      return boardState[row]?.[col]?.regionId ?? null;
    };

    const hasEdge = (vr: number, vc: number, dir: Dir): boolean => {
      if (dir === 'n') {
        const west = regionAt(vr - 1, vc - 1);
        const east = regionAt(vr - 1, vc);
        return west != null && east != null && west !== east;
      }
      if (dir === 'e') {
        const north = regionAt(vr - 1, vc);
        const south = regionAt(vr, vc);
        return north != null && south != null && north !== south;
      }
      if (dir === 's') {
        const west = regionAt(vr, vc - 1);
        const east = regionAt(vr, vc);
        return west != null && east != null && west !== east;
      }
      const north = regionAt(vr - 1, vc - 1);
      const south = regionAt(vr, vc - 1);
      return north != null && south != null && north !== south;
    };

    const offsetPoint = (
      vr: number,
      vc: number,
      dir: Dir,
      distance: number,
    ): { x: number; y: number } => ({
      x: vc * cellSize + delta[dir].c * distance,
      y: vr * cellSize + delta[dir].r * distance,
    });

    const turnOffset = (vr: number, vc: number, dir: Dir): number => {
      const isTurn = pairs.some(
        ([first, second]) =>
          (first === dir || second === dir) && hasEdge(vr, vc, first) && hasEdge(vr, vc, second),
      );
      return isTurn ? cornerRadius : 0;
    };

    const strokeSegment = (
      from: { x: number; y: number },
      to: { x: number; y: number },
    ): void => {
      if (from.x === to.x && from.y === to.y) {
        return;
      }
      graphics.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke(strokeOpts);
    };

    for (let vr = 0; vr <= size; vr += 1) {
      for (let vc = 0; vc <= size; vc += 1) {
        const present = dirs.filter((dir) => hasEdge(vr, vc, dir));

        for (const [first, second] of pairs) {
          if (!hasEdge(vr, vc, first) || !hasEdge(vr, vc, second)) {
            continue;
          }
          const start = offsetPoint(vr, vc, first, cornerRadius);
          const end = offsetPoint(vr, vc, second, cornerRadius);
          graphics
            .moveTo(start.x, start.y)
            .arcTo(vc * cellSize, vr * cellSize, end.x, end.y, cornerRadius)
            .stroke(strokeOpts);
        }

        if (present.length === 3) {
          for (const dir of ['n', 'e'] as Dir[]) {
            const other = opposite[dir];
            if (hasEdge(vr, vc, dir) && hasEdge(vr, vc, other)) {
              strokeSegment(
                offsetPoint(vr, vc, dir, cornerRadius),
                offsetPoint(vr, vc, other, cornerRadius),
              );
            }
          }
        }

        if (hasEdge(vr, vc, 'e')) {
          strokeSegment(
            offsetPoint(vr, vc, 'e', turnOffset(vr, vc, 'e')),
            offsetPoint(vr, vc + 1, 'w', turnOffset(vr, vc + 1, 'w')),
          );
        }
        if (hasEdge(vr, vc, 's')) {
          strokeSegment(
            offsetPoint(vr, vc, 's', turnOffset(vr, vc, 's')),
            offsetPoint(vr + 1, vc, 'n', turnOffset(vr + 1, vc, 'n')),
          );
        }
      }
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
