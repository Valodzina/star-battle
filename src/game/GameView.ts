import { Application, Container, Graphics, Rectangle, Text } from 'pixi.js';
import gsap from 'gsap';
import type { Difficulty, GameState } from '../types/level';
import { DIFFICULTY_META } from '../types/level';
import type { LevelManager } from '../services/LevelManager';
import { COLORS } from '../ui/colors';

const FONT_FAMILY = 'Arial, sans-serif';
const SCREEN_PADDING = 24;
const BUTTON_GAP = 16;
const TILE_GAP = 12;

export interface GameViewCallbacks {
  onDifficultySelected: (difficulty: Difficulty) => void;
  onBackSelected: () => void;
  onLevelSelected: (index: number) => void;
}

function getColumnsPerRow(width: number, height: number): number {
  if (height > width) {
    return 3;
  }

  return Math.min(6, Math.max(4, Math.floor(width / 100)));
}

export class GameView {
  private readonly root = new Container();
  private readonly app: Application;
  private readonly levelManager: LevelManager;
  private readonly activeTweens = new Set<gsap.core.Tween>();
  private callbacks: GameViewCallbacks = {
    onDifficultySelected: () => undefined,
    onBackSelected: () => undefined,
    onLevelSelected: () => undefined,
  };

  constructor(app: Application, levelManager: LevelManager) {
    this.app = app;
    this.levelManager = levelManager;
    this.app.stage.addChild(this.root);
  }

  setCallbacks(callbacks: GameViewCallbacks): void {
    this.callbacks = callbacks;
  }

  render(state: GameState): void {
    this.killActiveTweens();
    this.root.removeChildren().forEach((child) => child.destroy({ children: true }));

    if (state.screen === 'mainMenu') {
      this.renderMainMenu();
      return;
    }

    if (state.selectedDifficulty) {
      this.renderLevelSelect(state.selectedDifficulty);
    }
  }

  private renderMainMenu(): void {
    const { width, height } = this.app.screen;
    const buttonWidth = Math.min(320, width - SCREEN_PADDING * 2);
    const buttonHeight = 72;

    const title = new Text({
      text: 'Star Battle',
      style: {
        fill: COLORS.title,
        fontFamily: FONT_FAMILY,
        fontSize: 42,
        fontWeight: '700',
      },
    });
    title.anchor.set(0.5);
    title.x = width / 2;
    title.y = height * 0.18;
    this.root.addChild(title);

    const menu = new Container();
    const totalHeight =
      DIFFICULTY_META.length * buttonHeight + (DIFFICULTY_META.length - 1) * BUTTON_GAP;
    menu.x = width / 2 - buttonWidth / 2;
    menu.y = height / 2 - totalHeight / 2;

    DIFFICULTY_META.forEach((meta, index) => {
      const button = this.createButton({
        width: buttonWidth,
        height: buttonHeight,
        label: meta.label,
        subtitle: meta.subtitle,
        color: meta.color,
        onClick: () => this.callbacks.onDifficultySelected(meta.difficulty),
      });
      button.y = index * (buttonHeight + BUTTON_GAP);
      menu.addChild(button);
    });

    this.root.addChild(menu);
  }

  private renderLevelSelect(difficulty: Difficulty): void {
    const { width, height } = this.app.screen;
    const meta = DIFFICULTY_META.find((entry) => entry.difficulty === difficulty);
    const levelCount = this.levelManager.getLevelCount(difficulty);

    const backButton = this.createButton({
      width: 96,
      height: 44,
      label: 'Back',
      color: COLORS.buttonBack,
      onClick: () => this.callbacks.onBackSelected(),
    });
    backButton.x = SCREEN_PADDING;
    backButton.y = SCREEN_PADDING;
    this.root.addChild(backButton);

    const header = new Text({
      text: meta?.label ?? difficulty,
      style: {
        fill: COLORS.title,
        fontFamily: FONT_FAMILY,
        fontSize: 32,
        fontWeight: '700',
      },
    });
    header.anchor.set(0.5, 0);
    header.x = width / 2;
    header.y = SCREEN_PADDING;
    this.root.addChild(header);

    const columns = getColumnsPerRow(width, height);
    const contentTop = SCREEN_PADDING + 72;
    const contentWidth = width - SCREEN_PADDING * 2;
    const contentHeight = height - contentTop - SCREEN_PADDING;
    const tileSize = Math.min(
      Math.floor((contentWidth - (columns - 1) * TILE_GAP) / columns),
      Math.floor((contentHeight - TILE_GAP) / 2),
      120,
    );

    const grid = new Container();
    grid.x = SCREEN_PADDING + (contentWidth - (columns * tileSize + (columns - 1) * TILE_GAP)) / 2;
    grid.y = contentTop;

    for (let index = 0; index < levelCount; index += 1) {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const tile = this.createLevelTile({
        size: tileSize,
        label: `Level ${index + 1}`,
        onClick: () => this.callbacks.onLevelSelected(index),
      });
      tile.x = column * (tileSize + TILE_GAP);
      tile.y = row * (tileSize + TILE_GAP);
      grid.addChild(tile);
    }

    this.root.addChild(grid);
  }

  private createButton(options: {
    width: number;
    height: number;
    label: string;
    subtitle?: string;
    color: number;
    onClick: () => void;
  }): Container {
    const { width, height, label, subtitle, color, onClick } = options;
    const container = new Container();
    const background = new Graphics();

    const drawBackground = (fillColor: number): void => {
      if (background.destroyed) {
        return;
      }

      background.clear();
      background.roundRect(0, 0, width, height, 12).fill(fillColor);
    };

    drawBackground(color);

    const labelText = new Text({
      text: label,
      style: {
        fill: COLORS.text,
        fontFamily: FONT_FAMILY,
        fontSize: subtitle ? 22 : 18,
        fontWeight: '700',
      },
    });
    labelText.x = 16;

    if (subtitle) {
      labelText.y = 14;
      const subtitleText = new Text({
        text: subtitle,
        style: {
          fill: COLORS.textMuted,
          fontFamily: FONT_FAMILY,
          fontSize: 16,
        },
      });
      subtitleText.x = 16;
      subtitleText.y = 40;
      container.addChild(background, labelText, subtitleText);
    } else {
      labelText.anchor.set(0, 0.5);
      labelText.y = height / 2;
      container.addChild(background, labelText);
    }

    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.hitArea = new Rectangle(0, 0, width, height);

    const hoverColor = this.lightenColor(color, 0.12);
    const hoverState = { blend: 0 };
    let hoverTween: gsap.core.Tween | undefined;

    const animateHover = (targetBlend: number): void => {
      hoverTween?.kill();
      hoverTween = gsap.to(hoverState, {
        blend: targetBlend,
        duration: 0.15,
        onUpdate: () => {
          if (background.destroyed) {
            hoverTween?.kill();
            return;
          }

          drawBackground(this.blendColor(color, hoverColor, hoverState.blend));
        },
      });
      this.trackTween(hoverTween);
    };

    container.on('pointerover', () => animateHover(1));
    container.on('pointerout', () => animateHover(0));
    container.on('destroy', () => {
      hoverTween?.kill();
    });
    container.on('pointertap', onClick);

    return container;
  }

  private createLevelTile(options: {
    size: number;
    label: string;
    onClick: () => void;
  }): Container {
    const { size, label, onClick } = options;
    const container = new Container();
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

    container.addChild(background, labelText);
    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.hitArea = new Rectangle(0, 0, size, size);

    container.on('pointerover', () => drawBackground(COLORS.tileHover));
    container.on('pointerout', () => drawBackground(COLORS.tile));
    container.on('pointertap', onClick);

    return container;
  }

  private trackTween(tween: gsap.core.Tween): void {
    this.activeTweens.add(tween);
    tween.eventCallback('onComplete', () => {
      this.activeTweens.delete(tween);
    });
    tween.eventCallback('onInterrupt', () => {
      this.activeTweens.delete(tween);
    });
  }

  private killActiveTweens(): void {
    for (const tween of this.activeTweens) {
      tween.kill();
    }
    this.activeTweens.clear();
  }

  private lightenColor(color: number, amount: number): number {
    const r = Math.min(255, ((color >> 16) & 0xff) + Math.round(255 * amount));
    const g = Math.min(255, ((color >> 8) & 0xff) + Math.round(255 * amount));
    const b = Math.min(255, (color & 0xff) + Math.round(255 * amount));
    return (r << 16) | (g << 8) | b;
  }

  private blendColor(from: number, to: number, progress: number): number {
    const clamped = Math.max(0, Math.min(1, progress));
    const fromR = (from >> 16) & 0xff;
    const fromG = (from >> 8) & 0xff;
    const fromB = from & 0xff;
    const toR = (to >> 16) & 0xff;
    const toG = (to >> 8) & 0xff;
    const toB = to & 0xff;

    const r = Math.round(fromR + (toR - fromR) * clamped);
    const g = Math.round(fromG + (toG - fromG) * clamped);
    const b = Math.round(fromB + (toB - fromB) * clamped);

    return (r << 16) | (g << 8) | b;
  }
}
