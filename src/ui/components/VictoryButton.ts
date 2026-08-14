import { Container, Graphics, Rectangle, Sprite, Text } from 'pixi.js';
import gsap from 'gsap';
import { COLORS } from '../colors';
import { INTER_MEDIUM_FONT_FAMILY } from '../constants';
import { blendColor, lightenColor } from '../colorUtils';
import { getBackTexture } from '../gameAssets';

export const VICTORY_BUTTON_WIDTH = 450;
export const VICTORY_BUTTON_HEIGHT = 105;

const VICTORY_BUTTON_FONT_SIZE = 50;
const VICTORY_BUTTON_FONT_WEIGHT = '700';
const VICTORY_BUTTON_TEXT_COLOR = COLORS.text;
const VICTORY_BUTTON_COLOR = COLORS.victoryButtonColor;
const VICTORY_BUTTON_HOVER_LIGHTEN = 0.12;
const VICTORY_BUTTON_HOVER_DURATION = 0.15;
const VICTORY_BUTTON_RADIUS_RATIO = 18 / 44;
const VICTORY_BUTTON_ARROW_SIZE = Math.round(VICTORY_BUTTON_FONT_SIZE * 0.9);
const VICTORY_BUTTON_ARROW_OFFSET_X = 70;
const VICTORY_BUTTON_ARROW_SCALE_X = -1;
const VICTORY_BUTTON_ARROW_SCALE_Y = 1;

export interface VictoryButtonOptions {
  label: string;
  onClick: () => void;
}

export class VictoryButton extends Container {
  private hoverTween: gsap.core.Tween | undefined;
  private readonly background: Graphics;
  private readonly labelText: Text;
  private readonly hoverState = { blend: 0 };
  private readonly baseColor = VICTORY_BUTTON_COLOR;
  private readonly hoverColor = lightenColor(VICTORY_BUTTON_COLOR, VICTORY_BUTTON_HOVER_LIGHTEN);

  constructor(options: VictoryButtonOptions) {
    super();

    const { label, onClick } = options;

    this.background = new Graphics();
    this.drawBackground(this.baseColor);

    this.labelText = new Text({
      text: label,
      style: {
        fill: VICTORY_BUTTON_TEXT_COLOR,
        fontFamily: INTER_MEDIUM_FONT_FAMILY,
        fontSize: VICTORY_BUTTON_FONT_SIZE,
        fontWeight: VICTORY_BUTTON_FONT_WEIGHT,
      },
    });
    this.labelText.anchor.set(0.5);
    this.labelText.x = VICTORY_BUTTON_WIDTH / 2 -VICTORY_BUTTON_ARROW_OFFSET_X/2;
    this.labelText.y = VICTORY_BUTTON_HEIGHT / 2;

    const arrow = new Sprite(getBackTexture());
    arrow.anchor.set(0.5);
    arrow.width = VICTORY_BUTTON_ARROW_SIZE;
    arrow.height = VICTORY_BUTTON_ARROW_SIZE;
    arrow.scale.set(
      arrow.scale.x * VICTORY_BUTTON_ARROW_SCALE_X,
      arrow.scale.y * VICTORY_BUTTON_ARROW_SCALE_Y,
    );
    arrow.tint = VICTORY_BUTTON_TEXT_COLOR;
    arrow.eventMode = 'none';
    arrow.x = VICTORY_BUTTON_WIDTH - VICTORY_BUTTON_ARROW_OFFSET_X;
    arrow.y = VICTORY_BUTTON_HEIGHT / 2;

    this.addChild(this.background, this.labelText, arrow);

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.hitArea = new Rectangle(0, 0, VICTORY_BUTTON_WIDTH, VICTORY_BUTTON_HEIGHT);

    this.on('pointerover', () => this.animateHover(1));
    this.on('pointerout', () => this.animateHover(0));
    this.on('destroy', () => {
      this.hoverTween?.kill();
    });
    this.on('pointertap', onClick);
  }

  setLabel(label: string): void {
    if (this.labelText.destroyed) {
      return;
    }

    this.labelText.text = label;
  }

  private drawBackground(fillColor: number): void {
    if (this.background.destroyed) {
      return;
    }

    this.background.clear();
    const radius = Math.round(VICTORY_BUTTON_HEIGHT * VICTORY_BUTTON_RADIUS_RATIO);
    this.background
      .roundRect(0, 0, VICTORY_BUTTON_WIDTH, VICTORY_BUTTON_HEIGHT, radius)
      .fill(fillColor);
  }

  private animateHover(targetBlend: number): void {
    this.hoverTween?.kill();
    this.hoverTween = gsap.to(this.hoverState, {
      blend: targetBlend,
      duration: VICTORY_BUTTON_HOVER_DURATION,
      onUpdate: () => {
        if (this.background.destroyed) {
          this.hoverTween?.kill();
          return;
        }

        this.drawBackground(blendColor(this.baseColor, this.hoverColor, this.hoverState.blend));
      },
    });
  }
}
