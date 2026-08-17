import { Container, Graphics, Rectangle, Sprite, Text } from 'pixi.js';
import type { FederatedPointerEvent } from 'pixi.js';
import gsap from 'gsap';
import type { Difficulty } from '../../types/level';
import { DIFFICULTY_META } from '../../types/level';
import type { LevelManager } from '../../services/LevelManager';
import type { ProgressManager } from '../../services/ProgressManager';
import { HapticManager } from '../../utils/HapticManager';
import { COLORS } from '../colors';
import {  SCREEN_PADDING, TILE_GAP, TITLE_FONT_FAMILY } from '../constants';
import { getBackTexture } from '../gameAssets';
import { LevelTile } from '../components/LevelTile';
import type { IScene } from './IScene';

export interface LevelSelectSceneCallbacks {
  onBackSelected: () => void;
  onLevelSelected: (index: number) => void;
}

const DEFAULT_TILE_WIDTH = 120;
const DEFAULT_TILE_HEIGHT = 120;
/** Minimum width for a 3-column grid; wider screens use more columns at scale 1. */
const MIN_LAYOUT_WIDTH =
  SCREEN_PADDING * 2 + DEFAULT_TILE_WIDTH * 3 + TILE_GAP * 2;
const ICON_BUTTON_SIZE = 30;
const BACK_HIT_SIZE = 96;
const PADDING = TILE_GAP;
const HEADER_OFFSET = 72;
const OVERSCROLL_FRICTION = 0.3;
const DRAG_THRESHOLD = 8;
const MOMENTUM_MULTIPLIER = 150; // px/ms → projected px
const STALE_VELOCITY_MS = 50;
const MOMENTUM_EASE_DURATION = 0.5;
const FOCUS_DURATION = 0.45;
const SCROLL_OFFSET = 10;

export class LevelSelectScene extends Container implements IScene {
  private readonly difficulty: Difficulty;
  private readonly levelManager: LevelManager;
  private readonly progressManager: ProgressManager;
  private readonly callbacks: LevelSelectSceneCallbacks;
  private readonly activeTweens = new Set<gsap.core.Tween>();

  private scrollContainer: Container | null = null;
  private contentScale = 1;
  private contentTop = 0;
  private viewHeight = 0;
  private contentHeight = 0;
  private minY = 0;
  private cols = 1;
  private tileWidth = DEFAULT_TILE_WIDTH;
  private tileHeight = DEFAULT_TILE_HEIGHT;

  private isDragging = false;
  private didDrag = false;
  private dragPointerId: number | null = null;
  private dragStartY = 0;
  private lastDragY = 0;
  private lastDragTime = 0;
  private velocityY = 0;

  constructor(
    difficulty: Difficulty,
    levelManager: LevelManager,
    progressManager: ProgressManager,
    callbacks: LevelSelectSceneCallbacks,
  ) {
    super();
    this.difficulty = difficulty;
    this.levelManager = levelManager;
    this.progressManager = progressManager;
    this.callbacks = callbacks;
    this.visible = false;
  }

  show(): void {
    this.visible = true;
  }

  hide(): void {
    this.killActiveTweens();
    this.clearScrollState();
    this.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.visible = false;
  }

  resize(width: number, height: number): void {
    this.killActiveTweens();
    this.clearScrollState();
    this.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.layout(width, height);
  }

  private layout(screenWidth: number, screenHeight: number): void {
    const meta = DIFFICULTY_META.find((entry) => entry.difficulty === this.difficulty);
    const levelCount = this.levelManager.getLevelCount(this.difficulty);

    // Scale down only below the 3-column minimum; wider screens keep scale 1 and gain columns.
    const scale = Math.min(1, screenWidth / MIN_LAYOUT_WIDTH);
    this.contentScale = scale;
    const layoutWidth = screenWidth / scale;
    const layoutHeight = screenHeight / scale;

    const contentContainer = new Container();
    this.addChild(contentContainer);

    const headerContainer = new Container();
    contentContainer.addChild(headerContainer);

    const availableWidth = layoutWidth - SCREEN_PADDING * 2;
    this.tileWidth = DEFAULT_TILE_WIDTH;
    this.tileHeight = DEFAULT_TILE_HEIGHT;

    this.contentTop = SCREEN_PADDING + HEADER_OFFSET;

    const headerColor =
      this.difficulty === 'easy'
        ? COLORS.levelSelectHeaderEasy
        : this.difficulty === 'medium'
          ? COLORS.levelSelectHeaderMedium
          : COLORS.levelSelectHeaderHard;

    const headerBackground = new Graphics()
      .rect(0, 0, layoutWidth, this.contentTop)
      .fill(headerColor);
    headerContainer.addChild(headerBackground);

    const backIcon = new Sprite(getBackTexture());
    backIcon.width = ICON_BUTTON_SIZE;
    backIcon.height = ICON_BUTTON_SIZE;
    backIcon.anchor.set(0.5);
    backIcon.tint = COLORS.title;

    const backButton = new Container();
    backButton.eventMode = 'static';
    backButton.cursor = 'pointer';
    backButton.hitArea = new Rectangle(
      -BACK_HIT_SIZE / 2,
      -BACK_HIT_SIZE / 2,
      BACK_HIT_SIZE,
      BACK_HIT_SIZE,
    );
    backButton.position.set(SCREEN_PADDING * 2, SCREEN_PADDING * 2);
    backButton.addChild(backIcon);
    backButton.on('pointerdown', () => HapticManager.playLight());
    backButton.on('pointertap', () => this.callbacks.onBackSelected());
    headerContainer.addChild(backButton);

    const header = new Text({
      text: meta?.label ?? this.difficulty,
      style: {
        fill: COLORS.title,
        fontFamily: TITLE_FONT_FAMILY,

        fontSize: 45,
        letterSpacing: 1.6,
        fontWeight: '700',
      },
    });

    header.anchor.set(0.5);
    header.x = layoutWidth / 2;
    header.y = SCREEN_PADDING*2;
    headerContainer.addChild(header);

    const contentWidth = availableWidth;
    this.viewHeight = Math.max(0, layoutHeight - this.contentTop );
    this.cols = Math.max(1, Math.floor((contentWidth + PADDING) / (this.tileWidth + PADDING)));

    const totalRows = Math.ceil(levelCount / this.cols);
    this.contentHeight = totalRows * (this.tileHeight + PADDING) + PADDING;
    this.minY = Math.min(0, this.viewHeight - this.contentHeight);

    const gridWidth = this.cols * this.tileWidth + Math.max(0, this.cols - 1) * PADDING;
    const gridOffsetX = SCREEN_PADDING + (contentWidth - gridWidth) / 2;

    const scrollMask = new Graphics()
      .rect(0, this.contentTop, layoutWidth, this.viewHeight)
      .fill(COLORS.white);
    contentContainer.addChild(scrollMask);

    const scrollContainer = new Container();
    scrollContainer.x = gridOffsetX;
    scrollContainer.y = this.contentTop;
    scrollContainer.eventMode = 'static';
    scrollContainer.cursor = 'grab';
    scrollContainer.mask = scrollMask;
    scrollContainer.hitArea = new Rectangle(
      0,
      0,
      gridWidth,
      Math.max(this.contentHeight, this.viewHeight),
    );
    this.scrollContainer = scrollContainer;
    contentContainer.addChild(scrollContainer);

    for (let index = 0; index < levelCount; index += 1) {
      const level = this.levelManager.getLevel(this.difficulty, index);
      if (!level) {
        continue;
      }

      const state = this.progressManager.isCompleted(level.id)
        ? 'completed'
        : this.progressManager.isUnlocked(level.id)
          ? 'unlocked'
          : 'locked';

      const row = Math.floor(index / this.cols);
      const column = index % this.cols;
      const tile = new LevelTile({
        size: this.tileWidth,
        label: String(index + 1),
        state,
        onClick: () => {
          if (this.didDrag) {
            return;
          }
          this.callbacks.onLevelSelected(index);
        },
      });
      tile.x = column * (this.tileWidth + PADDING);
      tile.y = PADDING + row * (this.tileHeight + PADDING);
      scrollContainer.addChild(tile);
    }

    contentContainer.scale.set(scale);
    contentContainer.x = (screenWidth - layoutWidth * scale) / 2;
    contentContainer.y = 0;

    this.bindScrollEvents(scrollContainer);
    this.focusTargetLevel();
  }

  private bindScrollEvents(scrollContainer: Container): void {
    scrollContainer.on('pointerdown', (event: FederatedPointerEvent) => {
      gsap.killTweensOf(scrollContainer);
      this.killActiveTweens();
      this.isDragging = true;
      this.didDrag = false;
      this.dragPointerId = event.pointerId;
      this.dragStartY = event.global.y;
      this.lastDragY = event.global.y;
      this.lastDragTime = performance.now();
      this.velocityY = 0;
      scrollContainer.cursor = 'grabbing';
    });

    scrollContainer.on('globalpointermove', (event: FederatedPointerEvent) => {
      if (!this.isDragging || event.pointerId !== this.dragPointerId || !this.scrollContainer) {
        return;
      }

      const now = performance.now();
      const dt = now - this.lastDragTime;
      const dy = (event.global.y - this.lastDragY) / this.contentScale;

      if (dt > 0) {
        this.velocityY = dy / dt;
      }

      if (Math.abs(event.global.y - this.dragStartY) > DRAG_THRESHOLD) {
        this.didDrag = true;
      }

      const offset = this.getScrollOffset();
      const proposed = offset + dy;
      const appliedDelta =
        proposed > 0 || proposed < this.minY ? dy * OVERSCROLL_FRICTION : dy;
      const nextOffset = offset + appliedDelta;

      this.scrollContainer.y = this.contentTop + nextOffset;
      this.lastDragY = event.global.y;
      this.lastDragTime = now;
    });

    const endDrag = (event: FederatedPointerEvent): void => {
      if (!this.isDragging || event.pointerId !== this.dragPointerId) {
        return;
      }
      this.finishDrag();
    };

    scrollContainer.on('pointerup', endDrag);
    scrollContainer.on('pointerupoutside', endDrag);
    scrollContainer.on('pointercancel', endDrag);
  }

  private finishDrag(): void {
    if (!this.scrollContainer) {
      return;
    }

    this.isDragging = false;
    this.dragPointerId = null;
    this.scrollContainer.cursor = 'grab';

    if (performance.now() - this.lastDragTime > STALE_VELOCITY_MS) {
      this.velocityY = 0;
    }

    const offset = this.getScrollOffset();

    let targetOffset: number;
    if (offset > 0 || offset < this.minY) {
      targetOffset = offset > 0 ? 0 : this.minY;
    } else {
      targetOffset = offset + this.velocityY * MOMENTUM_MULTIPLIER;
      targetOffset = Math.max(this.minY, Math.min(0, targetOffset));
    }

    const targetY = this.contentTop + targetOffset;
    if (Math.abs(targetY - this.scrollContainer.y) < 0.5) {
      this.scrollContainer.y = targetY;
      return;
    }

    this.trackTween(
      gsap.to(this.scrollContainer, {
        y: targetY,
        duration: MOMENTUM_EASE_DURATION,
        ease: 'power3.out',
      }),
    );
  }

  private focusTargetLevel(): void {
    if (!this.scrollContainer) {
      return;
    }

    const levelCount = this.levelManager.getLevelCount(this.difficulty);
    let targetIndex = -1;

    for (let index = 0; index < levelCount; index += 1) {
      const level = this.levelManager.getLevel(this.difficulty, index);
      if (!level) {
        continue;
      }

      if (
        this.progressManager.isUnlocked(level.id) &&
        !this.progressManager.isCompleted(level.id)
      ) {
        targetIndex = index;
        break;
      }
    }

    let targetOffset = 0;
    if (targetIndex >= 0) {
      const row = Math.floor(targetIndex / this.cols);
      targetOffset = -(PADDING + row * (this.tileHeight + PADDING)) + SCROLL_OFFSET;
    }

    targetOffset = Math.max(this.minY, Math.min(0, targetOffset));
    const targetY = this.contentTop + targetOffset;

    if (Math.abs(targetY - this.scrollContainer.y) < 0.5) {
      this.scrollContainer.y = targetY;
      return;
    }

    this.trackTween(
      gsap.to(this.scrollContainer, {
        y: targetY,
        duration: FOCUS_DURATION,
        ease: 'power3.out',
      }),
    );
  }

  private getScrollOffset(): number {
    if (!this.scrollContainer) {
      return 0;
    }
    return this.scrollContainer.y - this.contentTop;
  }

  private clearScrollState(): void {
    this.scrollContainer = null;
    this.contentScale = 1;
    this.isDragging = false;
    this.didDrag = false;
    this.dragPointerId = null;
    this.lastDragY = 0;
    this.lastDragTime = 0;
    this.velocityY = 0;
    this.contentTop = 0;
    this.viewHeight = 0;
    this.contentHeight = 0;
    this.minY = 0;
    this.cols = 1;
    this.tileWidth = DEFAULT_TILE_WIDTH;
    this.tileHeight = DEFAULT_TILE_HEIGHT;
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
