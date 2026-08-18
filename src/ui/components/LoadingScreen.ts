import { Container, Graphics, Rectangle } from 'pixi.js';
import gsap from 'gsap';
import { COLORS } from '../colors';
import { SCREEN_PADDING } from '../constants';

const MAX_BAR_WIDTH = 320;
const MIN_BAR_WIDTH = 120;
const MAX_BAR_HEIGHT = 10;
const MIN_BAR_HEIGHT = 6;

export class LoadingScreen extends Container {
  private readonly background: Graphics;
  private readonly trackBar: Graphics;
  private readonly fillBar: Graphics;
  private currentProgress = 0;

  constructor(screenWidth: number, screenHeight: number) {
    super();

    this.background = new Graphics();
    this.trackBar = new Graphics();
    this.fillBar = new Graphics();

    this.addChild(this.background, this.trackBar, this.fillBar);
    this.eventMode = 'static';
    this.layout(screenWidth, screenHeight);
  }

  resize(screenWidth: number, screenHeight: number): void {
    this.layout(screenWidth, screenHeight);
  }

  updateProgress(progress: number): void {
    this.currentProgress = progress;
    this.fillBar.scale.x = Math.max(0.01, progress);
  }

  hide(onComplete?: () => void): void {
    gsap.to(this, {
      alpha: 0,
      duration: 0.5,
      ease: 'power2.out',
      onComplete: () => {
        this.destroy({ children: true });
        onComplete?.();
      },
    });
  }

  private layout(screenWidth: number, screenHeight: number): void {
    this.hitArea = new Rectangle(0, 0, screenWidth, screenHeight);
    this.background.clear();
    this.background.rect(0, 0, screenWidth, screenHeight).fill(COLORS.background);

    const availableWidth = Math.max(1, screenWidth - SCREEN_PADDING * 2);
    const barWidth = Math.max(
      MIN_BAR_WIDTH,
      Math.min(MAX_BAR_WIDTH, availableWidth),
    );
    const barHeight = Math.max(
      MIN_BAR_HEIGHT,
      Math.min(MAX_BAR_HEIGHT, Math.round(barWidth * (MAX_BAR_HEIGHT / MAX_BAR_WIDTH))),
    );
    const barRadius = barHeight / 2;
    const barX = (screenWidth - barWidth) / 2;
    const barY = (screenHeight - barHeight) / 2;

    this.trackBar.clear();
    this.trackBar
      .roundRect(0, 0, barWidth, barHeight, barRadius)
      .fill(COLORS.menuButtonBarTrackColor);
    this.trackBar.position.set(barX, barY);

    this.fillBar.clear();
    this.fillBar.roundRect(0, 0, barWidth, barHeight, barRadius).fill(COLORS.white);
    this.fillBar.position.set(barX, barY);
    this.fillBar.scale.x = Math.max(0.01, this.currentProgress);
  }
}
