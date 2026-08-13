import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import gsap from 'gsap';
import { COLORS } from '../colors';
import { INTER_MEDIUM_FONT_FAMILY } from '../constants';
import { blendColor, lightenColor } from '../colorUtils';

export interface ButtonOptions {
  width: number;
  height: number;
  label: string;
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
  private readonly baseColor: number;
  private readonly hoverColor: number;

  constructor(options: ButtonOptions) {
    super();

    const { width, height, label, color, onClick } = options;
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
        fontFamily: INTER_MEDIUM_FONT_FAMILY,
        fontSize: 18,
        fontWeight: '700',
      },
    });
    this.labelText.anchor.set(0.5);
    this.labelText.x = width / 2;
    this.labelText.y = height / 2;
    this.addChild(this.background, this.labelText);

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
