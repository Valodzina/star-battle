import { Container, Rectangle, Sprite, Text } from 'pixi.js';
import { COLORS } from '../colors';
import { INTER_MEDIUM_FONT_FAMILY } from '../constants';
import { getBackTexture } from '../gameAssets';

const ICON_BUTTON_SIZE = 50;
const BACK_HIT_SIZE = 120;
const SIDE_INSET = 40;
const TIMER_FONT_SIZE = 80;
const STARS_FONT_SIZE = 40;
const HEADER_BAND_HEIGHT = 120;

export interface GameplayHeaderOptions {
  initialTimerText: string;
  initialStars: number;
  logicalWidth: number;
  onBackClicked: () => void;
}

export class GameplayHeader extends Container {
  private readonly backButton: Container;
  private readonly timerText: Text;
  private readonly remainingText: Text;

  constructor(options: GameplayHeaderOptions) {
    super();

    const { initialTimerText, initialStars, logicalWidth, onBackClicked } = options;
    const centerY = HEADER_BAND_HEIGHT / 2;

    const backIcon = new Sprite(getBackTexture());
    backIcon.anchor.set(0.5);
    backIcon.width = ICON_BUTTON_SIZE;
    backIcon.height = ICON_BUTTON_SIZE;
    backIcon.tint = COLORS.activeTint;

    this.backButton = new Container();
    this.backButton.eventMode = 'static';
    this.backButton.cursor = 'pointer';
    this.backButton.hitArea = new Rectangle(
      -BACK_HIT_SIZE / 2,
      -BACK_HIT_SIZE / 2,
      BACK_HIT_SIZE,
      BACK_HIT_SIZE,
    );
    this.backButton.position.set(SIDE_INSET + ICON_BUTTON_SIZE / 2, centerY);
    this.backButton.addChild(backIcon);
    this.backButton.on('pointertap', () => onBackClicked());

    this.timerText = new Text({
      text: initialTimerText,
      style: {
        fill: COLORS.title,
        fontFamily: INTER_MEDIUM_FONT_FAMILY,
        fontSize: TIMER_FONT_SIZE,
        fontWeight: '700',
      },
    });
    this.timerText.anchor.set(0.5);
    this.timerText.position.set(logicalWidth / 2, centerY);

    this.remainingText = new Text({
      text: `Left: ${initialStars}`,
      style: {
        fill: COLORS.title,
        fontFamily: INTER_MEDIUM_FONT_FAMILY,
        fontSize: STARS_FONT_SIZE,
        fontWeight: '600',
      },
    });
    this.remainingText.anchor.set(1, 0.5);
    this.remainingText.position.set(logicalWidth - SIDE_INSET, centerY);

    this.addChild(this.backButton, this.timerText, this.remainingText);
  }

  updateTimer(timeString: string): void {
    this.timerText.text = timeString;
  }

  updateStars(count: number): void {
    this.remainingText.text = `Left: ${count}`;
  }
}
