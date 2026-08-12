import { Container, Graphics, Rectangle, Sprite } from 'pixi.js';
import gsap from 'gsap';
import { COLORS } from '../colors';
import { blendColor } from '../colorUtils';
import { getStarWinTexture } from '../gameAssets';

export const AUTOFILL_TOGGLE_WIDTH = 72;
export const AUTOFILL_TOGGLE_HEIGHT = 36;

const STAR_SIZE = 24;
const DOT_RADIUS = 2.5;
const DOT_ORBIT = 16;
const ON_FILL = 0x44505c;
const OFF_FILL = 0x9ba4b5;
const ANIM_DURATION = 0.3;
const ANIM_EASE = 'power2.inOut';

export interface AutofillToggleOptions {
  isActive?: boolean;
  onToggle: () => void;
  width?: number;
  height?: number;
}

export class AutofillToggle extends Container {
  readonly toggleWidth: number;
  readonly toggleHeight: number;

  private isActive: boolean;
  private readonly onToggle: () => void;
  private readonly background: Graphics;
  private readonly dotsContainer: Container;
  private readonly star: Sprite;
  private readonly leftX: number;
  private readonly rightX: number;
  private readonly colorState = { t: 0 };
  private activeTweens: gsap.core.Tween[] = [];

  constructor(options: AutofillToggleOptions) {
    super();

    const {
      isActive = false,
      onToggle,
      width = AUTOFILL_TOGGLE_WIDTH,
      height = AUTOFILL_TOGGLE_HEIGHT,
    } = options;

    this.isActive = isActive;
    this.onToggle = onToggle;
    this.toggleWidth = width;
    this.toggleHeight = height;
    this.colorState.t = isActive ? 1 : 0;

    const starHalf = STAR_SIZE / 2;
    const padding = (height - STAR_SIZE) / 2;
    this.leftX = padding + starHalf;
    this.rightX = width - padding - starHalf;
    const centerY = height / 2;

    this.background = new Graphics();
    this.drawBackground(isActive ? ON_FILL : OFF_FILL);

    this.dotsContainer = new Container();
    this.dotsContainer.x = this.rightX;
    this.dotsContainer.y = centerY;
    this.dotsContainer.alpha = isActive ? 1 : 0;

    const dotOffsets: Array<[number, number]> = [
      [0, -DOT_ORBIT],
      [0, DOT_ORBIT],
      [-DOT_ORBIT, 0],
      [DOT_ORBIT, 0],
    ];
    for (const [dx, dy] of dotOffsets) {
      const dot = new Graphics().circle(dx, dy, DOT_RADIUS).fill(COLORS.dotFill);
      this.dotsContainer.addChild(dot);
    }

    this.star = new Sprite(getStarWinTexture());
    this.star.anchor.set(0.5);
    this.star.width = STAR_SIZE;
    this.star.height = STAR_SIZE;
    this.star.tint = COLORS.victoryStarTint;
    this.star.x = isActive ? this.rightX : this.leftX;
    this.star.y = centerY;

    this.addChild(this.background, this.dotsContainer, this.star);

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.hitArea = new Rectangle(0, 0, width, height);

    this.on('pointertap', () => this.handleToggle());
    this.on('destroy', () => this.killTweens());
  }

  setActive(active: boolean, animate = true): void {
    if (this.isActive === active) {
      return;
    }

    this.isActive = active;
    if (animate) {
      this.animateToState(active);
    } else {
      this.snapToState(active);
    }
  }

  private handleToggle(): void {
    this.isActive = !this.isActive;
    this.animateToState(this.isActive);
    this.onToggle();
  }

  private animateToState(active: boolean): void {
    this.killTweens();

    const duration = ANIM_DURATION;
    const ease = ANIM_EASE;

    this.activeTweens = [
      gsap.to(this.star, {
        x: active ? this.rightX : this.leftX,
        duration,
        ease,
      }),
      gsap.to(this.dotsContainer, {
        alpha: active ? 1 : 0,
        duration,
      }),
      gsap.to(this.colorState, {
        t: active ? 1 : 0,
        duration,
        ease,
        onUpdate: () => {
          if (this.background.destroyed) {
            this.killTweens();
            return;
          }
          this.drawBackground(blendColor(OFF_FILL, ON_FILL, this.colorState.t));
        },
      }),
    ];
  }

  private snapToState(active: boolean): void {
    this.killTweens();
    this.star.x = active ? this.rightX : this.leftX;
    this.dotsContainer.alpha = active ? 1 : 0;
    this.colorState.t = active ? 1 : 0;
    this.drawBackground(active ? ON_FILL : OFF_FILL);
  }

  private drawBackground(fillColor: number): void {
    if (this.background.destroyed) {
      return;
    }

    this.background.clear();
    this.background
      .roundRect(0, 0, this.toggleWidth, this.toggleHeight, this.toggleHeight / 2)
      .fill(fillColor);
  }

  private killTweens(): void {
    for (const tween of this.activeTweens) {
      tween.kill();
    }
    this.activeTweens = [];
  }
}
