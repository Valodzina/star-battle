import { Container, Graphics, Text, Sprite } from 'pixi.js';
import gsap from 'gsap';
import { COLORS } from '../colors';
import { FONT_FAMILY } from '../constants';
import { Button } from './Button';
import { getStarWinTexture } from '../gameAssets';

const VICTORY_CARD_WIDTH = 280;
const VICTORY_CARD_HEIGHT = 320;
const VICTORY_CARD_RADIUS = 16;
const VICTORY_STAR_SIZE = 96;
const VICTORY_BUTTON_WIDTH = 200;
const VICTORY_BUTTON_HEIGHT = 44;

export class VictoryOverlay extends Container {
  private readonly timeText: Text;
  private readonly nextButton: Button;
  private actionHandler: (() => void) | null = null;

  constructor() {
    super();

    this.pivot.set(VICTORY_CARD_WIDTH / 2, VICTORY_CARD_HEIGHT / 2);
    this.eventMode = 'static';
    this.scale.set(0);
    this.visible = false;

    const shadow = new Graphics();
    shadow
      .roundRect(4, 6, VICTORY_CARD_WIDTH, VICTORY_CARD_HEIGHT, VICTORY_CARD_RADIUS)
      .fill({ color: COLORS.victoryCardShadow, alpha: 0.22 });

    const background = new Graphics();
    background
      .roundRect(0, 0, VICTORY_CARD_WIDTH, VICTORY_CARD_HEIGHT, VICTORY_CARD_RADIUS)
      .fill(COLORS.victoryCard);

    const titleText = new Text({
      text: 'SOLVED',
      style: {
        fill: COLORS.elementFill,
        fontFamily: FONT_FAMILY,
        fontSize: 36,
        fontWeight: '700',
      },
    });
    titleText.anchor.set(0.5, 0);
    titleText.x = VICTORY_CARD_WIDTH / 2;
    titleText.y = 28;

    this.timeText = new Text({
      text: '',
      style: {
        fill: COLORS.elementFill,
        fontFamily: FONT_FAMILY,
        fontSize: 20,
        fontWeight: '600',
      },
    });
    this.timeText.anchor.set(0.5, 0);
    this.timeText.x = VICTORY_CARD_WIDTH / 2;
    this.timeText.y = 78;

    const starSprite = new Sprite(getStarWinTexture());
    starSprite.anchor.set(0.5);
    starSprite.width = VICTORY_STAR_SIZE;
    starSprite.height = VICTORY_STAR_SIZE;
    starSprite.x = VICTORY_CARD_WIDTH / 2;
    starSprite.y = 170;
    starSprite.tint = COLORS.victoryStarTint;

    this.nextButton = new Button({
      width: VICTORY_BUTTON_WIDTH,
      height: VICTORY_BUTTON_HEIGHT,
      label: 'Next Level',
      color: COLORS.menuButtonColorEasy,
      onClick: () => this.actionHandler?.(),
    });
    this.nextButton.x = (VICTORY_CARD_WIDTH - VICTORY_BUTTON_WIDTH) / 2;
    this.nextButton.y = VICTORY_CARD_HEIGHT - VICTORY_BUTTON_HEIGHT - 28;

    this.addChild(shadow, background, titleText, this.timeText, starSprite, this.nextButton);
  }

  show(timeString: string, hasNextLevel: boolean, onAction: () => void): void {
    this.timeText.text = timeString;
    this.nextButton.setLabel(hasNextLevel ? 'Next Level' : 'Level Select');
    this.actionHandler = onAction;

    if (this.visible) {
      return;
    }

    this.visible = true;
    this.scale.set(0);
    gsap.to(this.scale, {
      x: 1,
      y: 1,
      duration: 0.5,
      ease: 'back.out(1.5)',
    });
  }

  hide(): void {
    gsap.killTweensOf(this.scale);
    this.scale.set(0);
    this.visible = false;
  }
}
