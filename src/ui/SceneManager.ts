import { Application, Container, Graphics } from 'pixi.js';
import gsap from 'gsap';
import type { IScene } from './scenes/IScene';

export type TransitionDirection = 'forward' | 'backward' | 'none';

const TRANSITION_DURATION = 0.4;
const TRANSITION_EASE = 'power3.inOut';

export class SceneManager {
  private readonly app: Application;
  private currentScene: (IScene & Container) | null = null;
  private readonly inputBlocker: Graphics;
  private isTransitioning = false;

  constructor(app: Application) {
    this.app = app;

    this.inputBlocker = new Graphics()
      .rect(0, 0, app.screen.width, app.screen.height)
      .fill({ color: 0x000000, alpha: 0 });
    this.inputBlocker.eventMode = 'static';
    this.inputBlocker.cursor = 'default';
    this.inputBlocker.visible = false;
    this.app.stage.addChild(this.inputBlocker);

    app.renderer.on('resize', () => {
      this.resizeBlocker(this.app.screen.width, this.app.screen.height);
    });
  }

  changeScene(newScene: IScene & Container, direction: TransitionDirection = 'none'): void {
    if (this.isTransitioning) {
      return;
    }

    const { width, height } = this.app.screen;
    const oldScene = this.currentScene;

    this.app.stage.addChild(this.inputBlocker);
    this.inputBlocker.visible = true;

    newScene.resize(width, height);
    newScene.show();

    if (direction === 'none' || !oldScene) {
      if (oldScene) {
        gsap.killTweensOf(oldScene);
        oldScene.hide();
        if (oldScene.parent) {
          oldScene.parent.removeChild(oldScene);
        }
        if (!oldScene.destroyed) {
          oldScene.destroy({ children: true });
        }
      }

      newScene.x = 0;
      this.app.stage.addChild(newScene);
      this.currentScene = newScene;
      this.inputBlocker.visible = false;
      // Let scenes start any "on appearance" animations only after the swap is fully done.
      (newScene as unknown as { onTransitionComplete?: () => void }).onTransitionComplete?.();
      return;
    }

    this.isTransitioning = true;
    newScene.x = direction === 'forward' ? width : -width;

    const insertIndex = Math.max(0, this.app.stage.children.length - 2);
    this.app.stage.addChildAt(newScene, insertIndex);

    gsap.killTweensOf(oldScene);
    gsap.killTweensOf(newScene);

    gsap.to(oldScene, {
      x: direction === 'forward' ? -width : width,
      duration: TRANSITION_DURATION,
      ease: TRANSITION_EASE,
    });

    gsap.to(newScene, {
      x: 0,
      duration: TRANSITION_DURATION,
      ease: TRANSITION_EASE,
      onComplete: () => {
        oldScene.hide();
        if (oldScene.parent) {
          oldScene.parent.removeChild(oldScene);
        }
        if (!oldScene.destroyed) {
          oldScene.destroy({ children: true });
        }

        this.currentScene = newScene;
        this.isTransitioning = false;
        this.inputBlocker.visible = false;
        (newScene as unknown as { onTransitionComplete?: () => void }).onTransitionComplete?.();
      },
    });
  }

  lockInputs(): void {
    if (this.isTransitioning) {
      return;
    }
    this.isTransitioning = true;
    this.app.stage.addChild(this.inputBlocker); // Brings blocker to the very top.
    this.inputBlocker.visible = true;
  }

  unlockInputs(): void {
    this.isTransitioning = false;
    this.inputBlocker.visible = false;
  }

  resize(width: number, height: number): void {
    this.resizeBlocker(width, height);

    if (this.currentScene && !this.currentScene.destroyed) {
      this.currentScene.resize(width, height);
      if (!this.isTransitioning) {
        (this.currentScene as unknown as { onTransitionComplete?: () => void })
          .onTransitionComplete?.();
      }
    }
  }

  getCurrentScene(): (IScene & Container) | null {
    return this.currentScene;
  }

  isTransitioningActive(): boolean {
    return this.isTransitioning;
  }

  private resizeBlocker(width: number, height: number): void {
    this.inputBlocker.clear();
    this.inputBlocker.rect(0, 0, width, height).fill({ color: 0x000000, alpha: 0 });
  }
}
