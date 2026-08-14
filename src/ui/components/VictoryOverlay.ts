import { Container, Graphics, Text, Sprite } from 'pixi.js';
import gsap from 'gsap';
import { COLORS } from '../colors';
import { INTER_MEDIUM_FONT_FAMILY,TITLE_FONT_FAMILY } from '../constants';
import { VictoryButton, VICTORY_BUTTON_HEIGHT, VICTORY_BUTTON_WIDTH } from './VictoryButton';
import { getStarWinTexture } from '../gameAssets';

const VICTORY_CARD_WIDTH = 750;
const VICTORY_CARD_HEIGHT = 790;
const VICTORY_CARD_RADIUS = 32;
const VICTORY_STAR_SIZE = 200;

export class VictoryOverlay extends Container {
  private readonly timeText: Text;
  private readonly nextButton: VictoryButton;
  private actionHandler: (() => void) | null = null;

  constructor() {
    super();

    this.pivot.set(VICTORY_CARD_WIDTH / 2, VICTORY_CARD_HEIGHT / 2);
    this.eventMode = 'static';
    this.scale.set(0);
    this.visible = false;

    const shadow = new Graphics();
    shadow
      .roundRect(8, 12, VICTORY_CARD_WIDTH, VICTORY_CARD_HEIGHT, VICTORY_CARD_RADIUS)
      .fill({ color: COLORS.victoryCardShadow, alpha: 0.22 });

    const background = new Graphics();
    background
      .roundRect(0, 0, VICTORY_CARD_WIDTH, VICTORY_CARD_HEIGHT, VICTORY_CARD_RADIUS)
      .fill(COLORS.victoryCard);

    const titleText = new Text({
      text: 'SOLVED!',
      style: {
        fill: COLORS.title,
        fontFamily: TITLE_FONT_FAMILY,
        fontSize: 100,
        fontWeight: '700',
      },
    });
    titleText.anchor.set(0.5, 0);
    titleText.x = VICTORY_CARD_WIDTH / 2;
    titleText.y = 52;

    this.timeText = new Text({
      text: '',
      style: {
        fill: COLORS.elementFill,
        fontFamily: INTER_MEDIUM_FONT_FAMILY,
        fontSize: 45,
        fontWeight: '600',
      },
    });
    this.timeText.anchor.set(0.5, 0);
    this.timeText.x = VICTORY_CARD_WIDTH / 2;
    this.timeText.y = 180;



    const greatJobText = new Text({
      text: 'Great Job!',
      style: {
        fill: COLORS.elementFill,
        fontFamily: INTER_MEDIUM_FONT_FAMILY,
        fontSize: 42,
        fontWeight: '600',
      },
    });
    greatJobText.anchor.set(0.5, 0);
    greatJobText.x = VICTORY_CARD_WIDTH / 2;
    greatJobText.y = 550;


    const starSprite = new Sprite(getStarWinTexture());
    starSprite.anchor.set(0.5);
    starSprite.width = VICTORY_STAR_SIZE;
    starSprite.height = VICTORY_STAR_SIZE;
    starSprite.x = VICTORY_CARD_WIDTH / 2;
    starSprite.y = 390;
    starSprite.tint = COLORS.victoryStarTint;

    this.nextButton = new VictoryButton({
      label: 'Next Level',
      onClick: () => this.actionHandler?.(),
    });
    this.nextButton.x = (VICTORY_CARD_WIDTH - VICTORY_BUTTON_WIDTH) / 2;
    this.nextButton.y = VICTORY_CARD_HEIGHT - VICTORY_BUTTON_HEIGHT - 56;

    this.addChild(shadow, background, titleText, this.timeText, starSprite, this.nextButton, greatJobText);
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
