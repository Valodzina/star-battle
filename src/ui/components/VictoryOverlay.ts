import { Container, Graphics, Text, Sprite, Ticker } from 'pixi.js';
import gsap from 'gsap';
import { COLORS } from '../colors';
import { INTER_MEDIUM_FONT_FAMILY,TITLE_FONT_FAMILY } from '../constants';
import { VictoryButton, VICTORY_BUTTON_HEIGHT, VICTORY_BUTTON_WIDTH } from './VictoryButton';
import { getStarWinTexture } from '../gameAssets';
import { SoundManager } from '../../utils/SoundManager';

const VICTORY_CARD_WIDTH = 750;
const VICTORY_CARD_HEIGHT = 790;
const VICTORY_CARD_RADIUS = 32;
const VICTORY_STAR_SIZE = 200;

const PASTEL_COLORS = [0xFFB3BA, 0xFFDFBA, 0xFFFFBA, 0xBAFFC9, 0xBAE1FF, 0xE8BAFF];
const CONFETTI_COUNT = 80;
const CONFETTI_CIRCLE_RADIUS_MIN = 18;
const CONFETTI_CIRCLE_RADIUS_RANGE = 8;
const CONFETTI_SQUARE_SIZE = 25;
const CONFETTI_SPEED_MIN = 5;
const CONFETTI_SPEED_RANGE = 15;
const CONFETTI_UPWARD_BIAS = 8;
const CONFETTI_SPIN_RANGE = 0.2;
const CONFETTI_GRAVITY = 0.25;
const CONFETTI_FADE_RATE = 0.007;
const CONFETTI_STAGGER = 0.001; // seconds between each particle start

interface Particle {
  gfx: Graphics;
  vx: number;
  vy: number;
  av: number; // angular velocity (rotation speed)
  delay: number;
}

export class VictoryOverlay extends Container {
  private readonly timeText: Text;
  private readonly nextButton: VictoryButton;
  private actionHandler: (() => void) | null = null;
  private particlesContainer: Container;
  private activeParticles: Particle[] = [];

  constructor() {
    super();

    this.pivot.set(VICTORY_CARD_WIDTH / 2, VICTORY_CARD_HEIGHT / 2);
    this.eventMode = 'static';
    this.scale.set(0);
    this.visible = false;

    this.particlesContainer = new Container();
    this.particlesContainer.position.set(VICTORY_CARD_WIDTH / 2, VICTORY_CARD_HEIGHT / 2);
    this.particlesContainer.eventMode = 'none';

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

    this.addChild(
      this.particlesContainer,
      shadow,
      background,
      titleText,
      this.timeText,
      starSprite,
      this.nextButton,
      greatJobText,
    );
  }

  show(timeString: string, hasNextLevel: boolean, onAction: () => void): void {
    this.timeText.text = timeString;
    this.nextButton.setLabel(hasNextLevel ? 'Next Level' : 'Level Select');
    this.actionHandler = onAction;

    if (this.visible && this.scale.x > 0) {
      return;
    }

    SoundManager.playWin();
    SoundManager.setConflictState(false);

    this.visible = true;
    gsap.killTweensOf(this.scale);
    this.scale.set(0);
    gsap.to(this.scale, {
      x: 1,
      y: 1,
      duration: 0.5,
      ease: 'back.out(1.5)',
    });

    Ticker.shared.remove(this.updateParticles);
    this.fireConfetti();
    Ticker.shared.add(this.updateParticles);
  }

  hide(): void {
    this.stopConfetti();
    gsap.killTweensOf(this.scale);
    this.scale.set(0);
    this.visible = false;
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.stopConfetti();
    super.destroy(options);
  }

  private fireConfetti(): void {
    for (let i = 0; i < CONFETTI_COUNT; i++) {
      const gfx = new Graphics();
      const color = PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)]!;

      if (Math.random() < 0.5) {
        const radius = Math.random() * CONFETTI_CIRCLE_RADIUS_RANGE + CONFETTI_CIRCLE_RADIUS_MIN;
        gfx.circle(0, 0, radius).fill({ color });
      } else {
        const half = CONFETTI_SQUARE_SIZE / 2;
        gfx.rect(-half, -half, CONFETTI_SQUARE_SIZE, CONFETTI_SQUARE_SIZE).fill({ color });
      }

      gfx.position.set(0, 0);
      gfx.visible = i === 0;

      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * CONFETTI_SPEED_RANGE + CONFETTI_SPEED_MIN;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - CONFETTI_UPWARD_BIAS;

      this.particlesContainer.addChild(gfx);
      this.activeParticles.push({
        gfx,
        vx,
        vy,
        av: Math.random() * CONFETTI_SPIN_RANGE - CONFETTI_SPIN_RANGE / 2,
        delay: i * CONFETTI_STAGGER,
      });
    }
  }

  private updateParticles = (ticker: Ticker) => {
    const dt = ticker.deltaMS / 1000;
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i]!;
      if (p.delay > 0) {
        p.delay -= dt;
        if (p.delay > 0) {
          continue;
        }
        p.gfx.visible = true;
      }
      p.vy += CONFETTI_GRAVITY;
      p.gfx.x += p.vx;
      p.gfx.y += p.vy;
      p.gfx.rotation += p.av;
      p.gfx.alpha -= CONFETTI_FADE_RATE;

      if (p.gfx.alpha <= 0) {
        p.gfx.destroy();
        this.activeParticles.splice(i, 1);
      }
    }

    if (this.activeParticles.length === 0) {
      Ticker.shared.remove(this.updateParticles);
    }
  };

  private stopConfetti(): void {
    Ticker.shared.remove(this.updateParticles);
    for (const p of this.activeParticles) {
      p.gfx.destroy();
    }
    this.activeParticles = [];
  }
}
