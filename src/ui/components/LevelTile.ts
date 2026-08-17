import { Container, Graphics, Rectangle, Sprite, Text, type Texture } from 'pixi.js';
import { HapticManager } from '../../utils/HapticManager';
import { COLORS } from '../colors';
import { INTER_SEMIBOLD_FONT_FAMILY } from '../constants';
import { getLockTexture, getStarTexture, getStarWinTexture } from '../gameAssets';

export type LevelTileState = 'locked' | 'unlocked' | 'completed';

export interface LevelTileOptions {
  size: number;
  label: string;
  state: LevelTileState;
  onClick: () => void;
}

export class LevelTile extends Container {
  private stateIcon: Sprite | null = null;

  constructor(options: LevelTileOptions) {
    super();

    const { size, label, state, onClick } = options;
    const background = new Graphics();
    const labelY = size * 0.30;
    const iconSize = size * 0.35;

    const drawBackground = (fillColor: number): void => {
      if (background.destroyed) {
        return;
      }

      background.clear();
      background.roundRect(0, 0, size, size, 10).fill(fillColor);
    };

    const setStateIcon = (texture: Texture, tint: number): void => {
      this.clearStateIcon();

      const icon = new Sprite(texture);
      icon.anchor.set(0.5);
      icon.width = iconSize;
      icon.height = iconSize;
      icon.tint = tint;
      icon.x = size / 2;
      icon.y = size*0.7;

      this.stateIcon = icon;
      this.addChild(icon);
    };

    this.on('destroy', () => this.clearStateIcon());

    if (state === 'locked') {
      drawBackground(COLORS.levelButtonLocked);
      this.addChild(background);

      const labelText = new Text({
        text: label,
        style: {
          fill: COLORS.levelNumberLocked,
          fontFamily: INTER_SEMIBOLD_FONT_FAMILY,
          fontSize: Math.max(20, Math.floor(size * 0.35)),
          fontWeight: '600',
        },
      });
      labelText.anchor.set(0.5);
      labelText.x = size / 2;
      labelText.y = labelY;

      this.addChild(labelText);
      setStateIcon(getLockTexture(), COLORS.lock);
      this.eventMode = 'none';
      this.cursor = 'default';
      return;
    }

    drawBackground(COLORS.levelButton);

    const labelText = new Text({
      text: label,
      style: {
        fill: COLORS.levelNumber,
        fontFamily: INTER_SEMIBOLD_FONT_FAMILY,
        fontSize: Math.max(20, Math.floor(size * 0.35)),
        fontWeight: '600',
      },
    });
    labelText.anchor.set(0.5);
    labelText.x = size / 2;
    labelText.y = labelY;

    this.addChild(background, labelText);

    if (state === 'completed') {
      setStateIcon(getStarWinTexture(), COLORS.starFilled);
    } else {
      setStateIcon(getStarTexture(), COLORS.starOutline);
    }

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.hitArea = new Rectangle(0, 0, size, size);

    this.on('pointerover', () => drawBackground(COLORS.levelButtonHover));
    this.on('pointerout', () => drawBackground(COLORS.levelButton));
    this.on('pointerdown', () => HapticManager.playLight());
    this.on('pointertap', onClick);
  }

  private clearStateIcon(): void {
    if (!this.stateIcon) {
      return;
    }

    if (!this.stateIcon.destroyed) {
      this.removeChild(this.stateIcon);
      this.stateIcon.destroy();
    }
    this.stateIcon = null;
  }
}
