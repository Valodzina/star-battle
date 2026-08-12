import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import gsap from 'gsap';
import { COLORS } from '../colors';
import { FONT_FAMILY } from '../constants';
import { blendColor, lightenColor } from '../colorUtils';

export interface ButtonOptions {
  width: number;
  height: number;
  label: string;
  subtitle?: string;
  color: number;
  onClick: () => void;
}

export class Button extends Container {
  private hoverTween: gsap.core.Tween | undefined;
  private readonly background: Graphics;
  private readonly labelText: Text;
  private readonly buttonWidth: number;
  private readonly buttonHeight: number;
  private readonly hoverState = { blend: 0 };
  private baseColor: number;
  private hoverColor: number;

  constructor(options: ButtonOptions) {
    super();

    const { width, height, label, subtitle, color, onClick } = options;
    this.buttonWidth = width;
    this.buttonHeight = height;
    this.baseColor = color;
    this.hoverColor = lightenColor(color, 0.12);

    this.background = new Graphics();
    this.drawBackground(color);

    this.labelText = new Text({
      text: label,
      style: {
        fill: COLORS.text,
        fontFamily: FONT_FAMILY,
        fontSize: subtitle ? 22 : 18,
        fontWeight: '700',
      },
    });
    if (subtitle) {
      this.labelText.x = 16;
      this.labelText.y = 14;
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
      this.addChild(this.background, this.labelText, subtitleText);
    } else {
      this.labelText.anchor.set(0.5);
      this.labelText.x = width / 2;
      this.labelText.y = height / 2;
      this.addChild(this.background, this.labelText);
    }

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.hitArea = new Rectangle(0, 0, width, height);

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

  setColor(color: number): void {
    this.baseColor = color;
    this.hoverColor = lightenColor(color, 0.12);
    this.drawBackground(blendColor(this.baseColor, this.hoverColor, this.hoverState.blend));
  }

  setEnabled(enabled: boolean): void {
    this.eventMode = enabled ? 'static' : 'none';
    this.cursor = enabled ? 'pointer' : 'default';
    this.alpha = enabled ? 1 : 0.4;
  }

  private drawBackground(fillColor: number): void {
    if (this.background.destroyed) {
      return;
    }

    this.background.clear();
    this.background.roundRect(0, 0, this.buttonWidth, this.buttonHeight, 12).fill(fillColor);
  }

  private animateHover(targetBlend: number): void {
    this.hoverTween?.kill();
    this.hoverTween = gsap.to(this.hoverState, {
      blend: targetBlend,
      duration: 0.15,
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
