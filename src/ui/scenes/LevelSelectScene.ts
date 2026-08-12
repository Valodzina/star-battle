import { Container, Text } from 'pixi.js';
import type { Difficulty } from '../../types/level';
import { DIFFICULTY_META } from '../../types/level';
import type { LevelManager } from '../../services/LevelManager';
import type { ProgressManager } from '../../services/ProgressManager';
import { COLORS } from '../colors';
import { FONT_FAMILY, SCREEN_PADDING, TILE_GAP } from '../constants';
import { Button } from '../components/Button';
import { LevelTile } from '../components/LevelTile';
import type { IScene } from './IScene';

export interface LevelSelectSceneCallbacks {
  onBackSelected: () => void;
  onLevelSelected: (index: number) => void;
}

function getColumnsPerRow(width: number, height: number): number {
  if (height > width) {
    return 3;
  }

  return Math.min(6, Math.max(4, Math.floor(width / 100)));
}

export class LevelSelectScene extends Container implements IScene {
  private readonly difficulty: Difficulty;
  private readonly levelManager: LevelManager;
  private readonly progressManager: ProgressManager;
  private readonly callbacks: LevelSelectSceneCallbacks;

  constructor(
    difficulty: Difficulty,
    levelManager: LevelManager,
    progressManager: ProgressManager,
    callbacks: LevelSelectSceneCallbacks,
  ) {
    super();
    this.difficulty = difficulty;
    this.levelManager = levelManager;
    this.progressManager = progressManager;
    this.callbacks = callbacks;
    this.visible = false;
  }

  show(): void {
    this.visible = true;
  }

  hide(): void {
    this.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.visible = false;
  }

  resize(width: number, height: number): void {
    this.removeChildren().forEach((child) => child.destroy({ children: true }));

    const meta = DIFFICULTY_META.find((entry) => entry.difficulty === this.difficulty);
    const levelCount = this.levelManager.getLevelCount(this.difficulty);

    const backButton = new Button({
      width: 96,
      height: 44,
      label: 'Back',
      color: COLORS.buttonBack,
      onClick: () => this.callbacks.onBackSelected(),
    });
    backButton.x = SCREEN_PADDING;
    backButton.y = SCREEN_PADDING;
    this.addChild(backButton);

    const header = new Text({
      text: meta?.label ?? this.difficulty,
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
    this.addChild(header);

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
      const level = this.levelManager.getLevel(this.difficulty, index);
      if (!level) {
        continue;
      }

      const state = this.progressManager.isCompleted(level.id)
        ? 'completed'
        : this.progressManager.isUnlocked(level.id)
          ? 'unlocked'
          : 'locked';

      const row = Math.floor(index / columns);
      const column = index % columns;
      const tile = new LevelTile({
        size: tileSize,
        label: `Level ${index + 1}`,
        state,
        onClick: () => this.callbacks.onLevelSelected(index),
      });
      tile.x = column * (tileSize + TILE_GAP);
      tile.y = row * (tileSize + TILE_GAP);
      grid.addChild(tile);
    }

    this.addChild(grid);
  }
}
