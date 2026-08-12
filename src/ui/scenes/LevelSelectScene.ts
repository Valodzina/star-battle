import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import type { FederatedPointerEvent } from 'pixi.js';
import gsap from 'gsap';
import type { Difficulty } from '../../types/level';
import { DIFFICULTY_META } from '../../types/level';
import type { LevelManager } from '../../services/LevelManager';
import type { ProgressManager } from '../../services/ProgressManager';
import { COLORS } from '../colors';
import { FONT_FAMILY, SCREEN_PADDING, TILE_GAP } from '../constants';
import { Button } from '../components/Button';
import { LevelTile } from '../components/LevelTile';
import type { IScene } from './IScene';

export interface LevelSelectSceneCallbacks {
  onBackSelected: () => void;
  onLevelSelected: (index: number) => void;
}

const TILE_WIDTH = 120;
const TILE_HEIGHT = 120;
const PADDING = TILE_GAP;
const HEADER_OFFSET = 72;
const OVERSCROLL_FRICTION = 0.3;
const DRAG_THRESHOLD = 8;
const MOMENTUM_DURATION = 0.55;
const FOCUS_DURATION = 0.45;
const VELOCITY_SAMPLE_WINDOW_MS = 100;

interface VelocitySample {
  time: number;
  y: number;
}

export class LevelSelectScene extends Container implements IScene {
  private readonly difficulty: Difficulty;
  private readonly levelManager: LevelManager;
  private readonly progressManager: ProgressManager;
  private readonly callbacks: LevelSelectSceneCallbacks;
  private readonly activeTweens = new Set<gsap.core.Tween>();

  private scrollContainer: Container | null = null;
  private contentTop = 0;
  private viewHeight = 0;
  private contentHeight = 0;
  private minY = 0;
  private cols = 1;

  private isDragging = false;
  private didDrag = false;
  private dragPointerId: number | null = null;
  private lastPointerY = 0;
  private dragStartY = 0;
  private velocitySamples: VelocitySample[] = [];

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

  private layout(width: number, height: number): void {
    const meta = DIFFICULTY_META.find((entry) => entry.difficulty === this.difficulty);
    const levelCount = this.levelManager.getLevelCount(this.difficulty);

    const backButton = new Button({
      width: 96,
      height: 44,
      label: 'Back',
      color: COLORS.buttonBack,
      onClick: () => this.callbacks.onBackSelected(),
    });
    backButton.x = SCREEN_PADDING;
    backButton.y = SCREEN_PADDING;
    this.addChild(backButton);

    const header = new Text({
      text: meta?.label ?? this.difficulty,
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
    this.addChild(header);

    this.contentTop = SCREEN_PADDING + HEADER_OFFSET;
    const contentWidth = width - SCREEN_PADDING * 2;
    this.viewHeight = Math.max(0, height - this.contentTop - SCREEN_PADDING);
    this.cols = Math.max(1, Math.floor((contentWidth + PADDING) / (TILE_WIDTH + PADDING)));

    const totalRows = Math.ceil(levelCount / this.cols);
    this.contentHeight = totalRows * (TILE_HEIGHT + PADDING) + PADDING;
    this.minY = Math.min(0, this.viewHeight - this.contentHeight);

    const gridWidth = this.cols * TILE_WIDTH + Math.max(0, this.cols - 1) * PADDING;
    const gridOffsetX = SCREEN_PADDING + (contentWidth - gridWidth) / 2;

    const scrollMask = new Graphics()
      .rect(0, this.contentTop, width, this.viewHeight)
      .fill(0xffffff);
    this.addChild(scrollMask);

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
    this.addChild(scrollContainer);

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
        size: TILE_WIDTH,
        label: `Level ${index + 1}`,
        state,
        onClick: () => {
          if (this.didDrag) {
            return;
          }
          this.callbacks.onLevelSelected(index);
        },
      });
      tile.x = column * (TILE_WIDTH + PADDING);
      tile.y = PADDING + row * (TILE_HEIGHT + PADDING);
      scrollContainer.addChild(tile);
    }

    this.bindScrollEvents(scrollContainer);
    this.focusTargetLevel();
  }

  private bindScrollEvents(scrollContainer: Container): void {
    scrollContainer.on('pointerdown', (event: FederatedPointerEvent) => {
      this.killActiveTweens();
      this.isDragging = true;
      this.didDrag = false;
      this.dragPointerId = event.pointerId;
      this.lastPointerY = event.global.y;
      this.dragStartY = event.global.y;
      this.velocitySamples = [{ time: performance.now(), y: this.getScrollOffset() }];
      scrollContainer.cursor = 'grabbing';
    });

    scrollContainer.on('globalpointermove', (event: FederatedPointerEvent) => {
      if (!this.isDragging || event.pointerId !== this.dragPointerId || !this.scrollContainer) {
        return;
      }

      const delta = event.global.y - this.lastPointerY;
      this.lastPointerY = event.global.y;

      if (Math.abs(event.global.y - this.dragStartY) > DRAG_THRESHOLD) {
        this.didDrag = true;
      }

      const offset = this.getScrollOffset();
      const proposed = offset + delta;
      const appliedDelta =
        proposed > 0 || proposed < this.minY ? delta * OVERSCROLL_FRICTION : delta;
      const nextOffset = offset + appliedDelta;

      this.scrollContainer.y = this.contentTop + nextOffset;
      this.recordVelocitySample(nextOffset);
      this.velocitySamples = this.velocitySamples.filter(
        (sample) => performance.now() - sample.time <= VELOCITY_SAMPLE_WINDOW_MS,
      );
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

    const offset = this.getScrollOffset();
    const velocity = this.computeVelocity();

    let targetOffset: number;
    if (offset > 0 || offset < this.minY) {
      targetOffset = offset > 0 ? 0 : this.minY;
    } else {
      targetOffset = Math.max(this.minY, Math.min(0, offset + velocity * MOMENTUM_DURATION));
    }

    const targetY = this.contentTop + targetOffset;
    if (Math.abs(targetY - this.scrollContainer.y) < 0.5) {
      this.scrollContainer.y = targetY;
      return;
    }

    const distance = Math.abs(targetY - this.scrollContainer.y);
    const duration = Math.min(MOMENTUM_DURATION, Math.max(0.25, distance / 1200));

    this.trackTween(
      gsap.to(this.scrollContainer, {
        y: targetY,
        duration,
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
      targetOffset = -(PADDING + row * (TILE_HEIGHT + PADDING));
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

  private recordVelocitySample(offset: number): void {
    this.velocitySamples.push({ time: performance.now(), y: offset });
  }

  private computeVelocity(): number {
    if (this.velocitySamples.length < 2) {
      return 0;
    }

    const first = this.velocitySamples[0];
    const last = this.velocitySamples[this.velocitySamples.length - 1];
    if (!first || !last) {
      return 0;
    }

    const dt = last.time - first.time;
    if (dt <= 0) {
      return 0;
    }

    // px/ms → px/s (offset space)
    return ((last.y - first.y) / dt) * 1000;
  }

  private clearScrollState(): void {
    this.scrollContainer = null;
    this.isDragging = false;
    this.didDrag = false;
    this.dragPointerId = null;
    this.velocitySamples = [];
    this.contentTop = 0;
    this.viewHeight = 0;
    this.contentHeight = 0;
    this.minY = 0;
    this.cols = 1;
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
