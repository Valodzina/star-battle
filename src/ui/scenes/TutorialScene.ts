import { Container, Graphics, Rectangle, Sprite, Text } from 'pixi.js';
import gsap from 'gsap';
import { HapticManager } from '../../utils/HapticManager';
import { SoundManager } from '../../utils/SoundManager';
import type { CellState } from '../../types/level';
import { COLORS, getRegionColor, getRegionStarOutline } from '../colors';
import { INTER_MEDIUM_FONT_FAMILY, TITLE_FONT_FAMILY } from '../constants';
import { blendColor, lightenColor } from '../colorUtils';
import { GameBoard } from '../components/GameBoard';
import { getStarTexture } from '../gameAssets';
import type { IScene } from './IScene';

const LOGICAL_WIDTH = 1080;
const LOGICAL_HEIGHT = 1920;

const GRID: readonly number[][] = [
  [1, 1, 1, 1, 1, 2],
  [1, 1, 1, 1, 1, 3],
  [4, 5, 1, 3, 3, 3],
  [4, 5, 5, 5, 3, 3],
  [4, 4, 5, 5, 5, 3],
  [4, 4, 5, 5, 0, 3],
];
const BOARD_CELLS = 6;
const CELL_SIZE = 128;
const BOARD_PX = BOARD_CELLS * CELL_SIZE;
const LIGHTEN_LIGHT = 0.08;
const LIGHTEN_ACTIVE = 0.12;

// Clockwise around the star, starting at north (12 o'clock).
const MOORE_WALK: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, -1],
];

interface CellPos {
  row: number;
  col: number;
}

type StepLight =
  | { type: 'region'; id: number }
  | { type: 'col'; index: number };

interface TutorialStep {
  star: CellPos;
  light?: StepLight;
}

const STEPS: readonly TutorialStep[] = [
  { star: { row: 0, col: 5 } },
  { star: { row: 5, col: 4 } },
  { star: { row: 2, col: 3 }, light: { type: 'region', id: 3 } },
  { star: { row: 4, col: 2 }, light: { type: 'col', index: 2 } },
  { star: { row: 3, col: 0 }, light: { type: 'region', id: 4 } },
  { star: { row: 1, col: 1 }, light: { type: 'region', id: 1 } },
];

function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

function regionIdAt(row: number, col: number): number | undefined {
  return GRID[row]?.[col];
}

function cellsOfRegion(regionId: number): CellPos[] {
  const cells: CellPos[] = [];
  for (let row = 0; row < BOARD_CELLS; row += 1) {
    for (let col = 0; col < BOARD_CELLS; col += 1) {
      if (regionIdAt(row, col) === regionId) {
        cells.push({ row, col });
      }
    }
  }
  return cells;
}

function laterStarKeys(fromIndex: number): Set<string> {
  const keys = new Set<string>();
  for (let index = fromIndex + 1; index < STEPS.length; index += 1) {
    const star = STEPS[index]?.star;
    if (!star) {
      continue;
    }
    keys.add(cellKey(star.row, star.col));
  }
  return keys;
}

function inBoard(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_CELLS && col >= 0 && col < BOARD_CELLS;
}

function mooreNeighborsClockwise(star: CellPos): CellPos[] {
  const ring = MOORE_WALK.map(([dr, dc]) => ({
    row: star.row + dr,
    col: star.col + dc,
  }));
  const inside = ring.map((cell) => inBoard(cell.row, cell.col));
  let start = 0;
  if (inside.some((value) => !value)) {
    const gapStart = inside.findIndex(
      (value, index) => value && !inside[(index + MOORE_WALK.length - 1) % MOORE_WALK.length],
    );
    if (gapStart >= 0) {
      start = gapStart;
    }
  }

  const neighbors: CellPos[] = [];
  for (let step = 0; step < ring.length; step += 1) {
    const cell = ring[(start + step) % ring.length];
    if (cell && inBoard(cell.row, cell.col)) {
      neighbors.push(cell);
    }
  }
  return neighbors;
}

function autoFillWalkTargets(
  star: CellPos,
  occupied: Set<string>,
  skipStars: Set<string>,
): CellPos[] {
  const seen = new Set<string>();
  const result: CellPos[] = [];
  const tryAdd = (row: number, col: number): void => {
    if (!inBoard(row, col)) {
      return;
    }
    const key = cellKey(row, col);
    if (
      (row === star.row && col === star.col) ||
      occupied.has(key) ||
      skipStars.has(key) ||
      seen.has(key)
    ) {
      return;
    }
    seen.add(key);
    result.push({ row, col });
  };

  for (const cell of mooreNeighborsClockwise(star)) {
    tryAdd(cell.row, cell.col);
  }
  for (let col = star.col - 1; col >= 0; col -= 1) {
    tryAdd(star.row, col);
  }
  for (let col = star.col + 1; col < BOARD_CELLS; col += 1) {
    tryAdd(star.row, col);
  }
  for (let row = star.row - 1; row >= 0; row -= 1) {
    tryAdd(row, star.col);
  }
  for (let row = star.row + 1; row < BOARD_CELLS; row += 1) {
    tryAdd(row, star.col);
  }

  return result;
}

const HAND_HEIGHT = 128;
const GOT_IT_WIDTH = 560;
const GOT_IT_HEIGHT = 124;
const TEXT_WRAP_WIDTH = 880;

const CARD_INSET = 36;
const CARD_WIDTH = LOGICAL_WIDTH - CARD_INSET * 2;
const CARD_HEIGHT = LOGICAL_HEIGHT - CARD_INSET * 2;
const CARD_RADIUS = 44;
const CARD_PAD = 48;
const CARD_BORDER_WIDTH = 4;
const CARD_FILL = lightenColor(COLORS.background, 0.16);

const COPY_STAR_SIZE = 26;
const COPY_STAR_GAP = 16;
const COPY_BODY_SIZE = 40;
const COPY_BODY_LINE_HEIGHT = 36;
const COPY_HEADING_SIZE = 40;
const COPY_ITEM_GAP = 14;
const COPY_SECTION_GAP = 28;

type TutorialCopyBlock =
  | { type: 'heading'; text: string }
  | { type: 'item'; text: string };

const TUTORIAL_COPY: readonly TutorialCopyBlock[] = [
  { type: 'heading', text: 'Rules' },
  { type: 'item', text: "Stars can't touch each other, not even diagonally" },
  {
    type: 'item',
    text: 'Each row, column and paddock needs exactly one star; two stars for Hard levels',
  },
  { type: 'heading', text: 'Tips' },
  {
    type: 'item',
    text: "Make sure to place dots to rule out squares that can't be stars — it'll help you solve it.",
  },
  {
    type: 'item',
    text: 'You can tap and slide your finger to place heaps of dots at once, even while sliding over stars',
  },
  { type: 'item', text: 'Every puzzle has exactly one correct solution' },
  {
    type: 'item',
    text: 'Every puzzle can be solved with logic, you should never have to guess',
  },
];

export interface TutorialSceneCallbacks {
  onGotIt: () => void;
}

export class TutorialScene extends Container implements IScene {
  private readonly callbacks: TutorialSceneCallbacks;

  private cardContainer!: Container;
  private card!: Container;
  private gameBoard!: GameBoard;

  private hand!: Sprite;
  private handRestScale = 1;

  private stars = new Map<string, Container>();
  private dots: Container[][] = [];

  private timeline: gsap.core.Timeline | null = null;
  private timelineStarted = false;
  private gotItHoverTween: gsap.core.Tween | undefined;

  constructor(callbacks: TutorialSceneCallbacks) {
    super();
    this.callbacks = callbacks;
    this.visible = false;
    this.init();
  }

  show(): void {
    this.visible = true;
  }

  onTransitionComplete(): void {
    if (this.timeline && !this.timelineStarted) {
      this.timelineStarted = true;
      this.timeline.play();
    }
  }

  hide(): void {
    this.killTimeline();
    this.visible = false;
  }

  resize(screenWidth: number, screenHeight: number): void {
    const scale = Math.min(screenWidth / LOGICAL_WIDTH, screenHeight / LOGICAL_HEIGHT);
    const offsetX = (screenWidth - LOGICAL_WIDTH * scale) / 2;
    const offsetY = (screenHeight - LOGICAL_HEIGHT * scale) / 2;

    this.cardContainer.scale.set(scale);
    this.cardContainer.position.set(offsetX, offsetY);
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.killTimeline();
    super.destroy(options);
  }

  private init(): void {
    this.cardContainer = new Container();
    this.addChild(this.cardContainer);

    this.buildCard();
    this.buildMockBoard();
    this.buildBottomContent();
    this.buildTimeline();
  }

  private buildCard(): void {
    this.card = new Container();
    this.card.position.set(CARD_INSET, CARD_INSET);

    const background = new Graphics()
      .roundRect(0, 0, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS)
      .fill(CARD_FILL)
      .stroke({
        width: CARD_BORDER_WIDTH,
        color: COLORS.regionBorder,
        alignment: 0.5,
        join: 'round',
      });
    background.eventMode = 'none';
    this.card.addChild(background);

    this.cardContainer.addChild(this.card);
  }

  private buildMockBoard(): void {
    const board = new Container();
    board.pivot.set(BOARD_PX / 2, BOARD_PX / 2);

    const boardState: CellState[][] = [];
    for (let row = 0; row < BOARD_CELLS; row += 1) {
      const stateRow: CellState[] = [];
      for (let col = 0; col < BOARD_CELLS; col += 1) {
        stateRow.push({
          row,
          col,
          regionId: regionIdAt(row, col) ?? 0,
          placed: 'nothing',
        });
      }
      boardState.push(stateRow);
    }

    this.gameBoard = new GameBoard({
      cellSize: CELL_SIZE,
      size: BOARD_CELLS,
      boardState,
      onCellTap: () => undefined,
      onDragPaint: () => undefined,
      onDragErase: () => undefined,
      onInteractionEnd: () => undefined,
    });
    this.gameBoard.eventMode = 'none';
    this.gameBoard.interactiveChildren = false;
    this.gameBoard.cursor = 'default';

    const markers = new Container();
    markers.eventMode = 'none';
    this.stars.clear();
    this.dots = [];

    for (const step of STEPS) {
      const star = this.createStar(step.star.row, step.star.col);
      this.stars.set(cellKey(step.star.row, step.star.col), star);
      markers.addChild(star);
    }

    for (let row = 0; row < BOARD_CELLS; row += 1) {
      const dotRow: Container[] = [];
      for (let col = 0; col < BOARD_CELLS; col += 1) {
        const dot = this.createDot(row, col);
        dotRow.push(dot);
        markers.addChild(dot);
      }
      this.dots.push(dotRow);
    }

    const firstStar = STEPS[0]?.star ?? { row: 0, col: 0 };
    this.hand = Sprite.from('hand.png');
    this.hand.anchor.set(0.1, 0.1);
    this.hand.height = HAND_HEIGHT;
    this.hand.scale.x = this.hand.scale.y;
    this.handRestScale = this.hand.scale.x;
    this.hand.alpha = 0;
    this.hand.eventMode = 'none';
    const firstPos = this.cellCenter(firstStar.row, firstStar.col);
    this.hand.position.set(firstPos.x, firstPos.y);

    board.addChild(this.gameBoard, markers, this.hand);
    board.position.set(CARD_WIDTH / 2, CARD_PAD + BOARD_PX / 2);
    this.card.addChild(board);
  }

  private buildBottomContent(): void {
    const tutorialCopy = this.buildTutorialCopy();
    tutorialCopy.x = (CARD_WIDTH - TEXT_WRAP_WIDTH) / 2;
    tutorialCopy.y = CARD_PAD + BOARD_PX + 28;
    this.card.addChild(tutorialCopy);

    const gotItButton = this.createGotItButton();
    gotItButton.x = (CARD_WIDTH - GOT_IT_WIDTH) / 2;
    gotItButton.y = CARD_HEIGHT - CARD_PAD - GOT_IT_HEIGHT;
    this.card.addChild(gotItButton);
  }

  private buildTutorialCopy(): Container {
    const copy = new Container();
    const textColor = COLORS.title;
    const itemWrapWidth = TEXT_WRAP_WIDTH - COPY_STAR_SIZE - COPY_STAR_GAP;
    let y = 25;

    for (const block of TUTORIAL_COPY) {
      if (block.type === 'heading') {
        if (y > 0) {
          y += COPY_SECTION_GAP - COPY_ITEM_GAP;
        }
        const heading = new Text({
          text: block.text,
          style: {
            fill: textColor,
            fontFamily: TITLE_FONT_FAMILY,
            fontSize: COPY_HEADING_SIZE,
            fontWeight: '800',
          },
        });
        heading.y = y;
        copy.addChild(heading);
        y += heading.height + COPY_ITEM_GAP;
        continue;
      }

      const row = new Container();
      const star = new Sprite(getStarTexture());
      star.anchor.set(0.5);
      star.width = COPY_STAR_SIZE;
      star.height = COPY_STAR_SIZE;
      star.tint = textColor;
      star.x = COPY_STAR_SIZE / 2;
      star.y = COPY_BODY_SIZE * 0.55;

      const label = new Text({
        text: block.text,
        style: {
          fill: textColor,
          fontFamily: INTER_MEDIUM_FONT_FAMILY,
          fontSize: COPY_BODY_SIZE,
          fontWeight: '500',
          lineHeight: COPY_BODY_LINE_HEIGHT,
          wordWrap: true,
          wordWrapWidth: itemWrapWidth,
          breakWords: false,
        },
      });
      label.x = COPY_STAR_SIZE + COPY_STAR_GAP;

      row.addChild(star, label);
      row.y = y;
      copy.addChild(row);
      y += Math.max(COPY_STAR_SIZE, label.height) + COPY_ITEM_GAP;
    }

    return copy;
  }

  private createGotItButton(): Container {
    const button = new Container();
    const background = new Graphics();
    const radius = Math.round(GOT_IT_HEIGHT * (10 / 44));
    const baseColor = COLORS.victoryButtonColor;
    const hoverColor = lightenColor(baseColor, 0.12);
    const hoverState = { blend: 0 };

    const drawBackground = (fillColor: number): void => {
      if (background.destroyed) {
        return;
      }
      background.clear();
      background.roundRect(0, 0, GOT_IT_WIDTH, GOT_IT_HEIGHT, radius).fill(fillColor);
    };
    drawBackground(baseColor);

    const label = new Text({
      text: 'GOT IT !',
      style: {
        fill: COLORS.text,
        fontFamily: INTER_MEDIUM_FONT_FAMILY,
        fontSize: 60,
        fontWeight: '700',
      },
    });
    label.anchor.set(0.5);
    label.position.set(GOT_IT_WIDTH / 2, GOT_IT_HEIGHT / 2);

    button.addChild(background, label);
    button.eventMode = 'static';
    button.cursor = 'pointer';
    button.hitArea = new Rectangle(0, 0, GOT_IT_WIDTH, GOT_IT_HEIGHT);

    const animateHover = (targetBlend: number): void => {
      this.gotItHoverTween?.kill();
      this.gotItHoverTween = gsap.to(hoverState, {
        blend: targetBlend,
        duration: 0.15,
        onUpdate: () => {
          if (background.destroyed) {
            this.gotItHoverTween?.kill();
            return;
          }
          drawBackground(blendColor(baseColor, hoverColor, hoverState.blend));
        },
      });
    };

    button.on('pointerover', () => animateHover(1));
    button.on('pointerout', () => animateHover(0));
    button.on('pointerdown', () => {
      HapticManager.playLight();
      SoundManager.playClick();
    });
    button.on('pointertap', () => this.callbacks.onGotIt());
    return button;
  }

  private buildTimeline(): void {
    const rest = this.handRestScale;
    const firstStar = STEPS[0]?.star ?? { row: 0, col: 0 };
    const firstPos = this.cellCenter(firstStar.row, firstStar.col);
    const occupied = new Set<string>();

    const allStars = [...this.stars.values()];
    const allDots = this.dots.flat();

    const timeline = gsap.timeline({
      repeat: -1,
      repeatDelay: 1.2,
      paused: true,
    });

    timeline.call(() => this.gameBoard.resetCellColors());
    timeline.set(this.hand, { x: firstPos.x, y: firstPos.y, alpha: 0 });
    timeline.set(this.hand.scale, { x: rest, y: rest });
    timeline.set(
      allStars.map((star) => star.scale),
      { x: 0, y: 0 },
    );
    timeline.set(allStars, { alpha: 1 });
    timeline.set(
      allDots.map((dot) => dot.scale),
      { x: 0, y: 0 },
    );
    timeline.set(allDots, { alpha: 1 });

    STEPS.forEach((step, index) => {
      const pos = this.cellCenter(step.star.row, step.star.col);
      const star = this.stars.get(cellKey(step.star.row, step.star.col));
      const tapDot = this.dots[step.star.row]?.[step.star.col];
      if (!star || !tapDot) {
        return;
      }

      timeline.call(() => this.gameBoard.resetCellColors());
      this.appendHighlightIn(timeline, step);

      if (index === 0) {
        timeline.to(this.hand, { alpha: 1, duration: 0.35, ease: 'sine.out' });
      } else {
        timeline.to(this.hand, {
          x: pos.x,
          y: pos.y,
          duration: 0.5,
          ease: 'power2.out',
        });
      }

      this.appendDoubleTap(timeline, star, tapDot, step);
      occupied.add(cellKey(step.star.row, step.star.col));

      const walkTargets = autoFillWalkTargets(step.star, occupied, laterStarKeys(index));
      this.appendWalkDots(timeline, walkTargets);
      for (const cell of walkTargets) {
        occupied.add(cellKey(cell.row, cell.col));
      }
    });

    timeline.to(this.hand, { alpha: 0, duration: 0.3, ease: 'sine.in' });
    timeline.to({}, { duration: 0.4 });
    timeline.to([...allStars, ...allDots], {
      alpha: 0,
      duration: 0.4,
      ease: 'power2.in',
    });
    timeline.call(() => this.gameBoard.resetCellColors());

    this.timeline = timeline;
  }

  private collectHighlightCells(
    step: TutorialStep,
  ): Array<{ row: number; col: number; amount: number }> {
    const cells = new Map<string, { row: number; col: number; amount: number }>();
    const add = (row: number, col: number, amount: number): void => {
      cells.set(cellKey(row, col), { row, col, amount });
    };

    if (step.light?.type === 'region') {
      for (const cell of cellsOfRegion(step.light.id)) {
        add(cell.row, cell.col, LIGHTEN_LIGHT);
      }
    } else if (step.light?.type === 'col') {
      const col = step.light.index;
      for (let row = 0; row < BOARD_CELLS; row += 1) {
        add(row, col, LIGHTEN_LIGHT);
      }
    }

    add(step.star.row, step.star.col, LIGHTEN_ACTIVE);
    return [...cells.values()];
  }

  private paintHighlightCells(
    cells: Array<{ row: number; col: number; amount: number }>,
    t: number,
  ): void {
    for (const cell of cells) {
      const base = getRegionColor(regionIdAt(cell.row, cell.col) ?? 0);
      this.gameBoard.setCellColor(cell.row, cell.col, lightenColor(base, cell.amount * t));
    }
  }

  private appendHighlightIn(timeline: gsap.core.Timeline, step: TutorialStep): void {
    const cells = this.collectHighlightCells(step);
    const state = { t: 0 };
    timeline.to(state, {
      t: 1,
      duration: 0.35,
      ease: 'sine.out',
      onUpdate: () => this.paintHighlightCells(cells, state.t),
    });
  }

  private appendHighlightOut(timeline: gsap.core.Timeline, step: TutorialStep): void {
    const cells = this.collectHighlightCells(step);
    const state = { t: 1 };
    timeline.to(
      state,
      {
        t: 0,
        duration: 0.2,
        ease: 'power2.out',
        onUpdate: () => this.paintHighlightCells(cells, state.t),
      },
      '<',
    );
  }

  private appendDoubleTap(
    timeline: gsap.core.Timeline,
    star: Container,
    tapDot: Container,
    step: TutorialStep,
  ): void {
    const rest = this.handRestScale;
    timeline.to(this.hand.scale, {
      x: rest * 0.9,
      y: rest * 0.9,
      duration: 0.1,
      ease: 'power2.out',
    });
    timeline.call(() => SoundManager.playPop1());
    timeline.to(
      tapDot.scale,
      {
        x: 1,
        y: 1,
        duration: 0.16,
        ease: 'back.out(2)',
      },
      '<',
    );
    timeline.to(this.hand.scale, {
      x: rest,
      y: rest,
      duration: 0.12,
      ease: 'power2.out',
    });

    timeline.to(this.hand.scale, {
      x: rest * 0.9,
      y: rest * 0.9,
      duration: 0.1,
      ease: 'power2.out',
    });
    timeline.call(() => SoundManager.playPop2());
    timeline.to(
      tapDot.scale,
      {
        x: 0,
        y: 0,
        duration: 0.1,
        ease: 'power2.in',
      },
      '<',
    );
    timeline.to(
      star.scale,
      {
        x: 1,
        y: 1,
        duration: 0.2,
        ease: 'back.out(2)',
      },
      '<',
    );
    this.appendHighlightOut(timeline, step);
    timeline.to(this.hand.scale, {
      x: rest,
      y: rest,
      duration: 0.12,
      ease: 'power2.out',
    });
  }

  private appendWalkDots(timeline: gsap.core.Timeline, targets: CellPos[]): void {
    const rest = this.handRestScale;
    for (const cell of targets) {
      const dot = this.dots[cell.row]?.[cell.col];
      if (!dot) {
        continue;
      }
      const pos = this.cellCenter(cell.row, cell.col);
      timeline.to(this.hand, {
        x: pos.x,
        y: pos.y,
        duration: 0.18,
        ease: 'power2.out',
      });
      timeline.to(this.hand.scale, {
        x: rest * 0.9,
        y: rest * 0.9,
        duration: 0.08,
        ease: 'power2.out',
      });
      timeline.call(() => SoundManager.playPop1());
      timeline.to(
        dot.scale,
        {
          x: 1,
          y: 1,
          duration: 0.12,
          ease: 'back.out(2)',
        },
        '<',
      );
      timeline.to(this.hand.scale, {
        x: rest,
        y: rest,
        duration: 0.08,
        ease: 'power2.out',
      });
    }
  }

  private createStar(row: number, col: number): Container {
    const regionId = regionIdAt(row, col) ?? 0;
    const starSize = CELL_SIZE * 0.8;
    const star = new Container();
    const outline = new Sprite(getStarTexture());
    outline.anchor.set(0.5);
    outline.width = starSize;
    outline.height = starSize;
    outline.tint = getRegionStarOutline(regionId);
    const inner = new Sprite(getStarTexture());
    inner.anchor.set(0.5);
    inner.width = starSize * 0.82;
    inner.height = starSize * 0.82;
    inner.tint = COLORS.elementFill;
    star.addChild(outline, inner);
    star.scale.set(0);
    const pos = this.cellCenter(row, col);
    star.position.set(pos.x, pos.y);
    star.eventMode = 'none';
    return star;
  }

  private createDot(row: number, col: number): Container {
    const display = new Container();
    const radius = CELL_SIZE * 0.075;
    const dot = new Graphics().circle(0, 0, radius).fill(COLORS.dotFill);
    display.addChild(dot);
    display.scale.set(0);
    const pos = this.cellCenter(row, col);
    display.position.set(pos.x, pos.y);
    display.eventMode = 'none';
    return display;
  }

  private cellCenter(row: number, col: number): { x: number; y: number } {
    return {
      x: (col + 0.5) * CELL_SIZE,
      y: (row + 0.5) * CELL_SIZE,
    };
  }

  private killTimeline(): void {
    this.gotItHoverTween?.kill();
    this.gotItHoverTween = undefined;
    this.timeline?.kill();
    this.timeline = null;
    this.timelineStarted = false;

    if (this.hand && !this.hand.destroyed) {
      gsap.killTweensOf(this.hand);
      gsap.killTweensOf(this.hand.scale);
    }
    for (const star of this.stars.values()) {
      if (!star.destroyed) {
        gsap.killTweensOf(star);
        gsap.killTweensOf(star.scale);
      }
    }
    for (const dot of this.dots.flat()) {
      if (!dot.destroyed) {
        gsap.killTweensOf(dot);
        gsap.killTweensOf(dot.scale);
      }
    }
  }
}
