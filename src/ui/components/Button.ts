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

  constructor(options: ButtonOptions) {
    super();

    const { width, height, label, subtitle, color, onClick } = options;
    const background = new Graphics();

    const drawBackground = (fillColor: number): void => {
      if (background.destroyed) {
        return;
      }

      background.clear();
      background.roundRect(0, 0, width, height, 12).fill(fillColor);
    };

    drawBackground(color);

    const labelText = new Text({
      text: label,
      style: {
        fill: COLORS.text,
        fontFamily: FONT_FAMILY,
        fontSize: subtitle ? 22 : 18,
        fontWeight: '700',
      },
    });
    labelText.x = 16;

    if (subtitle) {
      labelText.y = 14;
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
      this.addChild(background, labelText, subtitleText);
    } else {
      labelText.anchor.set(0, 0.5);
      labelText.y = height / 2;
      this.addChild(background, labelText);
    }

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.hitArea = new Rectangle(0, 0, width, height);

    const hoverColor = lightenColor(color, 0.12);
    const hoverState = { blend: 0 };

    const animateHover = (targetBlend: number): void => {
      this.hoverTween?.kill();
      this.hoverTween = gsap.to(hoverState, {
        blend: targetBlend,
        duration: 0.15,
        onUpdate: () => {
          if (background.destroyed) {
            this.hoverTween?.kill();
            return;
          }

          drawBackground(blendColor(color, hoverColor, hoverState.blend));
        },
      });
    };

    this.on('pointerover', () => animateHover(1));
    this.on('pointerout', () => animateHover(0));
    this.on('destroy', () => {
      this.hoverTween?.kill();
    });
    this.on('pointertap', onClick);
  }

  setEnabled(enabled: boolean): void {
    this.eventMode = enabled ? 'static' : 'none';
    this.cursor = enabled ? 'pointer' : 'default';
    this.alpha = enabled ? 1 : 0.4;
  }
}
