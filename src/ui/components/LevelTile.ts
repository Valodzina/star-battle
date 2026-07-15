import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import { COLORS } from '../colors';
import { FONT_FAMILY } from '../constants';

export interface LevelTileOptions {
  size: number;
  label: string;
  onClick: () => void;
}

export class LevelTile extends Container {
  constructor(options: LevelTileOptions) {
    super();

    const { size, label, onClick } = options;
    const background = new Graphics();

    const drawBackground = (fillColor: number): void => {
      if (background.destroyed) {
        return;
      }

      background.clear();
      background.roundRect(0, 0, size, size, 10).fill(fillColor);
    };

    drawBackground(COLORS.tile);

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

    this.addChild(background, labelText);
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.hitArea = new Rectangle(0, 0, size, size);

    this.on('pointerover', () => drawBackground(COLORS.tileHover));
    this.on('pointerout', () => drawBackground(COLORS.tile));
    this.on('pointertap', onClick);
  }
}
