import { Container, Graphics, Rectangle, Sprite, Text } from 'pixi.js';
import gsap from 'gsap';
import { COLORS } from '../colors';
import { FONT_FAMILY } from '../constants';
import { blendColor, lightenColor } from '../colorUtils';
import { getStarWinTexture } from '../gameAssets';

const PROGRESS_STAR_SIZE = 20;

export interface ButtonProgress {
  completed: number;
  total: number;
}

export interface ButtonOptions {
  width: number;
  height: number;
  label: string;
  subtitle?: string;
  color: number;
  onClick: () => void;
  progress?: ButtonProgress;
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

    const { width, height, label, subtitle, color, onClick, progress } = options;
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

    if (progress) {
      this.addChild(this.createProgressContainer(progress));
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

  private createProgressContainer(progress: ButtonProgress): Container {
    const progressContainer = new Container();
    const centerY = this.buttonHeight / 2;
    // Order: ★ x / n — fixed columns from the right edge
    const totalX = this.buttonWidth - 40;
    const slashX = totalX - 7;
    const completedX = slashX - 7;
    const starX = completedX - 40;

    const progressStyle = {
      fill: COLORS.text,
      fontFamily: FONT_FAMILY,
      fontSize: 18,
      fontWeight: '600' as const,
    };

    const star = new Sprite(getStarWinTexture());
    star.anchor.set(0.5);
    star.width = PROGRESS_STAR_SIZE;
    star.height = PROGRESS_STAR_SIZE;
    star.tint = COLORS.victoryStarTint;
    star.x = starX;
    star.y = centerY;

    const completedText = new Text({
      text: String(progress.completed),
      style: progressStyle,
    });
    completedText.anchor.set(1, 0.5);
    completedText.x = completedX;
    completedText.y = centerY;

    const slashText = new Text({
      text: '/',
      style: progressStyle,
    });
    slashText.anchor.set(0.5, 0.5);
    slashText.x = slashX;
    slashText.y = centerY;

    const totalText = new Text({
      text: String(progress.total),
      style: progressStyle,
    });
    totalText.anchor.set(0, 0.5);
    totalText.x = totalX;
    totalText.y = centerY;

    progressContainer.addChild(star, completedText, slashText, totalText);
    return progressContainer;
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
