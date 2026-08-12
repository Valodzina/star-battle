import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import { COLORS } from '../colors';
import { FONT_FAMILY } from '../constants';

export type LevelTileState = 'locked' | 'unlocked' | 'completed';

export interface LevelTileOptions {
  size: number;
  label: string;
  state: LevelTileState;
  onClick: () => void;
}

export class LevelTile extends Container {
  constructor(options: LevelTileOptions) {
    super();

    const { size, label, state, onClick } = options;
    const background = new Graphics();
    const badge = new Graphics();

    const drawBackground = (fillColor: number): void => {
      if (background.destroyed) {
        return;
      }

      background.clear();
      background.roundRect(0, 0, size, size, 10).fill(fillColor);
    };

    const drawBadge = (): void => {
      if (badge.destroyed) {
        return;
      }

      badge.clear();
      if (state !== 'completed') {
        return;
      }

      const radius = size * 0.14;
      badge.circle(size - radius - 6, radius + 6, radius).fill(COLORS.tileCompletedBadge);
    };

    if (state === 'locked') {
      drawBackground(COLORS.tileLocked);
      drawBadge();
      this.addChild(background);

      const labelText = new Text({
        text: label,
        style: {
          fill: COLORS.textMuted,
          fontFamily: FONT_FAMILY,
          fontSize: Math.max(14, Math.floor(size * 0.18)),
          fontWeight: '600',
        },
      });
      labelText.anchor.set(0.5);
      labelText.x = size / 2;
      labelText.y = size / 2;

      this.addChild(labelText, badge);
      this.eventMode = 'none';
      this.cursor = 'default';
      return;
    }

    drawBackground(COLORS.tile);
    drawBadge();

    const labelText = new Text({
      text: label,
      style: {
        fill: COLORS.text,
        fontFamily: FONT_FAMILY,
        fontSize: Math.max(14, Math.floor(size * 0.18)),
        fontWeight: '600',
      },
    });
    labelText.anchor.set(0.5);
    labelText.x = size / 2;
    labelText.y = size / 2;

    this.addChild(background, labelText, badge);
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.hitArea = new Rectangle(0, 0, size, size);

    this.on('pointerover', () => drawBackground(COLORS.tileHover));
    this.on('pointerout', () => drawBackground(COLORS.tile));
    this.on('pointertap', onClick);
  }
}
