import { Container, Graphics, Rectangle, Sprite, Text } from 'pixi.js';
import { COLORS } from '../colors';
import { INTER_MEDIUM_FONT_FAMILY, INTER_SEMIBOLD_FONT_FAMILY } from '../constants';
import { getStarWinTexture } from '../gameAssets';

const PROGRESS_STAR_SIZE = 17;
const ICON_STAR_SIZE = 37;
const BAR_WIDTH = 90;
const BAR_HEIGHT = 8;

const CORNER_RADIUS = 12;

export interface MainMenuButtonOptions {
  width: number;
  height: number;
  label: string;
  subtitle: string;
  difficultyColor: number;
  completed: number;
  total: number;
  onClick: () => void;
}

export class MainMenuButton extends Container {
  constructor(options: MainMenuButtonOptions) {
    super();

    const { width, height, label, subtitle, difficultyColor, completed, total, onClick } = options;

    const background = new Graphics();
    const drawBackground = (fillColor: number): void => {
      if (background.destroyed) {
        return;
      }

      background.clear();
      background.roundRect(0, 0, width, height, CORNER_RADIUS).fill(fillColor);
    };

    drawBackground(COLORS.menuButton);
    this.addChild(background);

    const circleRadius = height * 0.32;
    const circleCenterX = 11 + circleRadius;
    const circleCenterY = height / 2;

    const iconCircle = new Graphics();
    iconCircle.circle(circleCenterX, circleCenterY, circleRadius).fill(COLORS.menuButtonDark);
    this.addChild(iconCircle);

    const iconStar = new Sprite(getStarWinTexture());
    iconStar.anchor.set(0.5);
    iconStar.width = ICON_STAR_SIZE;
    iconStar.height = ICON_STAR_SIZE;
    iconStar.tint = difficultyColor;
    iconStar.x = circleCenterX;
    iconStar.y = circleCenterY;
    this.addChild(iconStar);

    const dividerWidth = 1.5;
    const dividerInset = 15;
    const dividerX = circleCenterX + circleRadius + 10;
    const divider = new Graphics();
    divider
      .roundRect(dividerX, dividerInset, dividerWidth, height - dividerInset * 2, dividerWidth / 2)
      .fill(COLORS.menuButtonDark);
    this.addChild(divider);

    const textX = dividerX + dividerWidth + 12;
    const labelText = new Text({
      text: label,
      style: {
        fill: COLORS.menuButtonText,
        fontFamily: INTER_SEMIBOLD_FONT_FAMILY,
        fontSize: 20,
        fontWeight: '600',
      },
    });
    labelText.x = textX;
    labelText.y = 14;
    this.addChild(labelText);

    const subtitleText = new Text({
      text: subtitle,
      style: {
        fill: COLORS.menuButtonSubText,
        fontFamily: INTER_MEDIUM_FONT_FAMILY,
        fontSize: 16,
        fontWeight: '500',
      },
    });
    subtitleText.x = textX;
    subtitleText.y = 40;
    this.addChild(subtitleText);

    const progressY = height * 0.38;
    // Order: ★ x / n — fixed columns from the right edge
    const totalX = width - 40;
    const slashX = totalX - 7;
    const completedX = slashX - 7;
    const starX = completedX - 40;

    const progressStyle = {
      fill: COLORS.menuButtonText,
      fontFamily: INTER_SEMIBOLD_FONT_FAMILY,
      fontSize: 18,
      fontWeight: '600' as const,
    };

    const progressStar = new Sprite(getStarWinTexture());
    progressStar.anchor.set(0.5);
    progressStar.width = PROGRESS_STAR_SIZE;
    progressStar.height = PROGRESS_STAR_SIZE;
    progressStar.tint = COLORS.menuButtonText;
    progressStar.x = starX;
    progressStar.y = progressY ;
    this.addChild(progressStar);

    const completedText = new Text({
      text: String(completed),
      style: progressStyle,
    });
    completedText.anchor.set(1, 0.5);
    completedText.x = completedX;
    completedText.y = progressY;
    this.addChild(completedText);

    const slashText = new Text({
      text: '/',
      style: progressStyle,
    });
    slashText.anchor.set(0.5, 0.5);
    slashText.x = slashX;
    slashText.y = progressY;
    this.addChild(slashText);

    const totalText = new Text({
      text: String(total),
      style: progressStyle,
    });
    totalText.anchor.set(0, 0.5);
    totalText.x = totalX;
    totalText.y = progressY;
    this.addChild(totalText);

    const ratio = total > 0 ? Math.max(0, Math.min(1, completed / total)) : 0;
    const fillWidth = ratio * BAR_WIDTH;
    const barRadius = BAR_HEIGHT / 2;
    const barX = width - 16 - BAR_WIDTH;
    const barY = progressY + 22;

    const barTrack = new Graphics();
    barTrack.roundRect(barX, barY, BAR_WIDTH, BAR_HEIGHT, barRadius).fill(COLORS.menuButtonBarTrackColor);
    this.addChild(barTrack);

    if (fillWidth > 0) {
      const barFill = new Graphics();
      barFill.roundRect(barX, barY, fillWidth, BAR_HEIGHT, barRadius).fill(difficultyColor);
      this.addChild(barFill);
    }

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.hitArea = new Rectangle(0, 0, width, height);

    this.on('pointerover', () => drawBackground(COLORS.menuButtonHover));
    this.on('pointerout', () => drawBackground(COLORS.menuButton));
    this.on('pointertap', onClick);
  }
}
