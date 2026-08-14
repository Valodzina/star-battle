import { Container, Graphics, Rectangle, Sprite } from 'pixi.js';
import gsap from 'gsap';
import { COLORS } from '../colors';
import { blendColor } from '../colorUtils';
import { getStarWinTexture } from '../gameAssets';

export const AUTOFILL_TOGGLE_WIDTH = 200;
export const AUTOFILL_TOGGLE_HEIGHT = 90;

const STAR_SIZE_RATIO = 21 / 40;
const DOT_RADIUS_RATIO = 2 / 40;
const DOT_ORBIT_RATIO = 10 / 40;

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
  private readonly thumb: Container;
  private readonly dotsContainer: Container;
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

    const starSize = height * STAR_SIZE_RATIO;
    const dotRadius = height * DOT_RADIUS_RATIO;
    const dotOrbit = height * DOT_ORBIT_RATIO;
    const starHalf = starSize / 2;
    const padding = (height - starSize) / 1.5;
    this.leftX = padding + starHalf;
    this.rightX = width - padding - starHalf;
    const centerY = height / 2;

    this.background = new Graphics();
    this.drawBackground(isActive ? COLORS.activeTint : COLORS.inactiveTint);

    this.dotsContainer = new Container();
    this.dotsContainer.alpha = isActive ? 1 : 0;

    const dotOffsets: Array<[number, number]> = [
      [-dotOrbit, -dotOrbit],
      [-dotOrbit, dotOrbit],
      [dotOrbit, -dotOrbit],
      [dotOrbit, dotOrbit],
    ];
    for (const [dx, dy] of dotOffsets) {
      const dot = new Graphics().circle(dx, dy, dotRadius).fill(COLORS.dotFill);
      this.dotsContainer.addChild(dot);
    }

    const star = new Sprite(getStarWinTexture());
    star.anchor.set(0.5);
    star.width = starSize;
    star.height = starSize;
    star.tint = COLORS.victoryStarTint;

    this.thumb = new Container();
    this.thumb.x = isActive ? this.rightX : this.leftX;
    this.thumb.y = centerY;
    this.thumb.addChild(this.dotsContainer, star);

    this.addChild(this.background, this.thumb);

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
      gsap.to(this.thumb, {
        x: active ? this.rightX : this.leftX,
        duration,
        ease,
      }),
      gsap.to(this.dotsContainer, {
        alpha: active ? 1 : 0,
        duration,
        ease,
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
          this.drawBackground(blendColor(COLORS.inactiveTint, COLORS.activeTint, this.colorState.t));
        },
      }),
    ];
  }

  private snapToState(active: boolean): void {
    this.killTweens();
    this.thumb.x = active ? this.rightX : this.leftX;
    this.dotsContainer.alpha = active ? 1 : 0;
    this.colorState.t = active ? 1 : 0;
    this.drawBackground(active ? COLORS.activeTint : COLORS.inactiveTint);
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
