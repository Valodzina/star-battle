import { Container, Graphics, Rectangle, Sprite, Text } from 'pixi.js';
import { HapticManager } from '../../utils/HapticManager';
import { SoundManager } from '../../utils/SoundManager';
import { COLORS } from '../colors';
import { INTER_MEDIUM_FONT_FAMILY, INTER_SEMIBOLD_FONT_FAMILY } from '../constants';
import { getStarWinTexture } from '../gameAssets';

const PROGRESS_STAR_SIZE = 40;
const ICON_STAR_SIZE = 90;
const BAR_WIDTH = 220;
const BAR_HEIGHT = 18;

const CORNER_RADIUS = 28;
const ICON_INSET = 28;
const DIVIDER_WIDTH = 4;
const DIVIDER_INSET = 38;
const DIVIDER_GAP = 25;
const TEXT_GAP = 30;
const LABEL_FONT_SIZE = 48;
const LABEL_Y = 35;
const SUBTITLE_FONT_SIZE = 36;
const SUBTITLE_Y = 100;
const PROGRESS_FONT_SIZE = 40;
const PROGRESS_RIGHT_INSET = 100;
const PROGRESS_COLUMN_GAP = 18;
const PROGRESS_STAR_GAP = 100;
const BAR_RIGHT_INSET = 40;
const BAR_Y_OFFSET = 55;

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
    const circleCenterX = ICON_INSET + circleRadius;
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

    const dividerX = circleCenterX + circleRadius + DIVIDER_GAP;
    const divider = new Graphics();
    divider
      .roundRect(
        dividerX,
        DIVIDER_INSET,
        DIVIDER_WIDTH,
        height - DIVIDER_INSET * 2,
        DIVIDER_WIDTH / 2,
      )
      .fill(COLORS.menuButtonDark);
    this.addChild(divider);

    const textX = dividerX + DIVIDER_WIDTH + TEXT_GAP;
    const labelText = new Text({
      text: label,
      style: {
        fill: COLORS.menuButtonText,
        fontFamily: INTER_SEMIBOLD_FONT_FAMILY,
        fontSize: LABEL_FONT_SIZE,
        fontWeight: '600',
      },
    });
    labelText.x = textX;
    labelText.y = LABEL_Y;
    this.addChild(labelText);

    const subtitleText = new Text({
      text: subtitle,
      style: {
        fill: COLORS.menuButtonSubText,
        fontFamily: INTER_MEDIUM_FONT_FAMILY,
        fontSize: SUBTITLE_FONT_SIZE,
        fontWeight: '500',
      },
    });
    subtitleText.x = textX;
    subtitleText.y = SUBTITLE_Y;
    this.addChild(subtitleText);

    const progressY = height * 0.38;
    // Order: ★ x / n — fixed columns from the right edge
    const totalX = width - PROGRESS_RIGHT_INSET;
    const slashX = totalX - PROGRESS_COLUMN_GAP;
    const completedX = slashX - PROGRESS_COLUMN_GAP;
    const starX = completedX - PROGRESS_STAR_GAP;

    const progressStyle = {
      fill: COLORS.menuButtonText,
      fontFamily: INTER_SEMIBOLD_FONT_FAMILY,
      fontSize: PROGRESS_FONT_SIZE,
      fontWeight: '600' as const,
    };

    const progressStar = new Sprite(getStarWinTexture());
    progressStar.anchor.set(0.5);
    progressStar.width = PROGRESS_STAR_SIZE;
    progressStar.height = PROGRESS_STAR_SIZE;
    progressStar.tint = COLORS.menuButtonText;
    progressStar.x = starX;
    progressStar.y = progressY;
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
    const barX = width - BAR_RIGHT_INSET - BAR_WIDTH;
    const barY = progressY + BAR_Y_OFFSET;

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
    this.on('pointerdown', () => {
      SoundManager.playBgr();
      HapticManager.playLight();
      SoundManager.playClick();
    });
    this.on('pointertap', onClick);
  }
}
