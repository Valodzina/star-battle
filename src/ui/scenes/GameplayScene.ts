import { Container } from 'pixi.js';
import gsap from 'gsap';
import type { CellPosition } from '../../game/GameModel';
import type { CellState, GameplayState } from '../../types/level';
import type { ProgressManager } from '../../services/ProgressManager';
import { LEVEL_NAV_GAP, LEVEL_NAV_HEIGHT } from '../constants';
import { GameBoard } from '../components/GameBoard';
import { GameplayHeader } from '../components/GameplayHeader';
import { GameplayFooter } from '../components/GameplayFooter';
import { LevelNavigation } from '../components/LevelNavigation';
import { VictoryOverlay } from '../components/VictoryOverlay';
import type { IScene } from './IScene';
import { SoundManager } from '../../utils/SoundManager';

// DEBUG: show the victory overlay immediately without completing a level.
const DEBUG_SHOW_VICTORY = false;

const LOGICAL_WIDTH = 1080;
const LOGICAL_HEIGHT = 1520;
const VICTORY_LOGICAL_WIDTH = 1080;
const VICTORY_LOGICAL_HEIGHT = 1200;
const TOP_PAD = 40;
const TOP_BAND = 120;
const BOTTOM_BAND = 160;
const BASE_CELL_SIZE = 64;

const LEVEL_ID_PATTERN = /^(easy|medium|hard)_(\d+)$/;

function adjacentLevelId(levelId: string, delta: number): string | null {
  const match = LEVEL_ID_PATTERN.exec(levelId);
  if (!match) {
    return null;
  }

  const difficulty = match[1];
  const index = Number(match[2]);
  if (!difficulty || !Number.isFinite(index)) {
    return null;
  }

  const nextIndex = index + delta;
  if (nextIndex < 1) {
    return null;
  }

  return `${difficulty}_${nextIndex}`;
}

export interface GameplaySceneCallbacks {
  onCellTap: (row: number, col: number) => void;
  onDragPaint: (row: number, col: number) => void;
  onDragErase: (row: number, col: number) => void;
  onInteractionEnd: () => void;
  onUndoClick: () => void;
  onAutoFillToggle: () => void;
  onClearBoard: () => void;
  onBackToLevels: () => void;
  onPreviousLevel: () => void;
  onNextLevel: () => void;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export class GameplayScene extends Container implements IScene {
  private gameplay: GameplayState;
  private readonly callbacks: GameplaySceneCallbacks;
  private readonly progressManager: ProgressManager;

  private topContainer!: GameplayHeader;
  private centerContainer!: Container;
  private bottomContainer!: GameplayFooter;
  private victoryContainer!: Container;

  private gameBoard!: GameBoard;
  private levelNavigation!: LevelNavigation;
  private victoryOverlay!: VictoryOverlay;

  private isAutoFillEnabled: boolean;
  private lastElapsedSeconds = 0;
  private hasPreviousLevel = false;
  private hasNextLevel = false;

  constructor(
    gameplay: GameplayState,
    callbacks: GameplaySceneCallbacks,
    progressManager: ProgressManager,
    isAutoFillEnabled = true,
  ) {
    super();
    this.gameplay = gameplay;
    this.callbacks = callbacks;
    this.progressManager = progressManager;
    this.isAutoFillEnabled = isAutoFillEnabled;
    this.visible = false;
    this.init();
  }

  show(): void {
    this.visible = true;
  }

  hide(): void {
    this.victoryOverlay.hide();
    this.gameBoard.clearAnimations();
    SoundManager.setConflictState(false);
    this.visible = false;
  }

  resize(screenWidth: number, screenHeight: number): void {
    const scale = Math.min(screenWidth / LOGICAL_WIDTH, screenHeight / LOGICAL_HEIGHT);
    const victoryScale = Math.min(
      screenWidth / VICTORY_LOGICAL_WIDTH,
      screenHeight / VICTORY_LOGICAL_HEIGHT,
    );
    const virtualHeight = screenHeight / scale;
    const offsetX = (screenWidth - LOGICAL_WIDTH * scale) / 2;

    for (const container of [this.topContainer, this.centerContainer, this.bottomContainer]) {
      container.scale.set(scale);
    }
    this.victoryContainer.scale.set(victoryScale);

    this.topContainer.position.set(offsetX, TOP_PAD * scale);
    this.bottomContainer.position.set(offsetX, (virtualHeight - BOTTOM_BAND) * scale);

    const centerBandTop = TOP_PAD + TOP_BAND;
    const centerBandBottom = virtualHeight - BOTTOM_BAND;
    this.centerContainer.position.set(
      screenWidth / 2,
      ((centerBandTop + centerBandBottom) / 2) * scale,
    );

    this.victoryContainer.position.set(screenWidth / 2, screenHeight / 2);

    if (this.gameplay.isVictory || DEBUG_SHOW_VICTORY) {
      this.showVictoryOverlay();
    }
  }

  updateTimerDisplay(seconds: number): void {
    this.lastElapsedSeconds = seconds;
    this.topContainer.updateTimer(formatTime(seconds));
  }

  setUndoEnabled(enabled: boolean): void {
    this.bottomContainer.setUndoEnabled(enabled);
  }

  setAutoFillEnabled(enabled: boolean): void {
    this.isAutoFillEnabled = enabled;
    this.bottomContainer.setAutoFillEnabled(enabled);
  }

  updateGameplayBoard(
    boardState: CellState[][],
    remainingElements: number,
    isVictory: boolean,
    options?: {
      skipMarkerCells?: CellPosition[];
      skipBoardRedraw?: boolean;
    },
  ): void {
    if (!options?.skipBoardRedraw) {
      this.gameBoard.updateBoardState(boardState, options?.skipMarkerCells);
    }
    this.topContainer.updateStars(remainingElements);

    if (isVictory || DEBUG_SHOW_VICTORY) {
      this.showVictoryOverlay();
    } else {
      this.victoryOverlay.hide();
    }
  }

  updateInvalidStars(invalidPositions: Array<{ row: number; col: number }>): void {
    this.gameBoard.updateInvalidStars(invalidPositions);
  }

  isBoardInputBlocked(): boolean {
    return this.gameBoard.getIsInputBlocked();
  }

  animateAutoDots(
    newDots: CellPosition[],
    sourceStar: CellPosition,
    onComplete?: () => void,
  ): void {
    this.gameBoard.animateAutoDots(newDots, sourceStar, onComplete);
  }

  private init(): void {
    const {
      level,
      boardState,
      elapsedSeconds,
      remainingElements,
      levelIndex,
      levelCount,
    } = this.gameplay;

    this.lastElapsedSeconds = elapsedSeconds;

    this.hasPreviousLevel = levelIndex > 0;
    const nextLevelId = adjacentLevelId(level.id, 1);
    this.hasNextLevel =
      levelIndex < levelCount - 1 &&
      nextLevelId !== null &&
      this.progressManager.isUnlocked(nextLevelId);

    this.topContainer = new GameplayHeader({
      initialTimerText: formatTime(elapsedSeconds),
      initialStars: remainingElements,
      logicalWidth: LOGICAL_WIDTH,
      onBackClicked: () => this.callbacks.onBackToLevels(),
    });

    this.centerContainer = new Container();
    this.bottomContainer = new GameplayFooter({
      isAutoFillEnabled: this.isAutoFillEnabled,
      logicalWidth: LOGICAL_WIDTH,
      onUndoClicked: () => this.callbacks.onUndoClick(),
      onClearClicked: () => this.callbacks.onClearBoard(),
      onAutofillToggled: () => this.callbacks.onAutoFillToggle(),
    });
    this.victoryContainer = new Container();

    this.gameBoard = new GameBoard({
      cellSize: BASE_CELL_SIZE,
      size: level.size,
      boardState,
      onCellTap: (row, col) => this.callbacks.onCellTap(row, col),
      onDragPaint: (row, col) => this.callbacks.onDragPaint(row, col),
      onDragErase: (row, col) => this.callbacks.onDragErase(row, col),
      onInteractionEnd: () => this.callbacks.onInteractionEnd(),
    });

    const boardBaseWidth = this.gameBoard.logicalSize;
    const reserved = TOP_PAD + TOP_BAND + BOTTOM_BAND + LEVEL_NAV_HEIGHT + LEVEL_NAV_GAP;
    const targetBoardWidth = Math.min(LOGICAL_WIDTH * 0.9, LOGICAL_HEIGHT - reserved);

    this.gameBoard.pivot.set(boardBaseWidth / 2, boardBaseWidth / 2);
    this.gameBoard.scale.set(targetBoardWidth / boardBaseWidth);
    this.gameBoard.x = LOGICAL_WIDTH / 2;
    this.gameBoard.y = LEVEL_NAV_HEIGHT + LEVEL_NAV_GAP + targetBoardWidth / 2;

    this.levelNavigation = new LevelNavigation({
      levelNumber: levelIndex + 1,
      logicalBoardWidth: targetBoardWidth,
      hasPreviousLevel: this.hasPreviousLevel,
      hasNextLevel: this.hasNextLevel,
      onPrevClick: () => this.callbacks.onPreviousLevel(),
      onNextClick: () => this.callbacks.onNextLevel(),
    });
    this.levelNavigation.x = (LOGICAL_WIDTH - targetBoardWidth) / 2;
    this.levelNavigation.y = 0;

    const clusterHeight = LEVEL_NAV_HEIGHT + LEVEL_NAV_GAP + targetBoardWidth;
    this.centerContainer.pivot.set(LOGICAL_WIDTH / 2, clusterHeight / 2);
    this.centerContainer.addChild(this.levelNavigation, this.gameBoard);

    this.victoryOverlay = new VictoryOverlay();
    this.victoryContainer.addChild(this.victoryOverlay);

    if (DEBUG_SHOW_VICTORY) {
      this.showVictoryOverlay();
    }

    this.addChild(
      this.topContainer,
      this.centerContainer,
      this.bottomContainer,
      this.victoryContainer,
    );
  }

  refreshLevelNavigation(): void {
    const { levelIndex, levelCount, level } = this.gameplay;
    const nextLevelId = adjacentLevelId(level.id, 1);
    this.hasNextLevel =
      levelIndex < levelCount - 1 &&
      nextLevelId !== null &&
      this.progressManager.isUnlocked(nextLevelId);
    this.levelNavigation.setPrevEnabled(this.hasPreviousLevel);
    this.levelNavigation.setNextEnabled(this.hasNextLevel);

    if (this.victoryOverlay.visible) {
      this.showVictoryOverlay();
    }
  }

  private showVictoryOverlay(): void {
    this.victoryOverlay.show(
      `Time: ${formatTime(this.lastElapsedSeconds)}`,
      this.hasNextLevel,
      () => {
        if (this.hasNextLevel) {
          this.callbacks.onNextLevel();
        } else {
          this.callbacks.onBackToLevels();
        }
      },
    );
  }

  transitionToGameplay(
    newGameplay: GameplayState,
    direction: 'forward' | 'backward',
    screenWidth: number,
    onComplete?: () => void,
  ): void {
    if (direction !== 'forward' && direction !== 'backward') {
      return;
    }

    // Block all interactions on the board/navigation layers while the swap animation runs.
    // (Global input blocking is handled by SceneManager via a separate input blocker.)
    this.victoryOverlay.hide();

    const oldCenter = this.centerContainer;
    const baseX = oldCenter.x;
    const baseY = oldCenter.y;

    // Update header instantly (no movement).
    this.gameplay = newGameplay;
    this.lastElapsedSeconds = newGameplay.elapsedSeconds;
    this.topContainer.updateTimer(formatTime(newGameplay.elapsedSeconds));
    this.topContainer.updateStars(newGameplay.remainingElements);

    const nextCenterBuild = this.buildCenterForGameplay(newGameplay);
    const incomingCenter = nextCenterBuild.center;

    // Match current scale/position so the tween moves only horizontally.
    incomingCenter.scale.copyFrom(oldCenter.scale);
    incomingCenter.position.set(oldCenter.position.x, oldCenter.position.y);

    const insertIndex = this.getChildIndex(oldCenter);
    this.addChildAt(incomingCenter, insertIndex);

    const oldTargetX =
      baseX + (direction === 'forward' ? -screenWidth : screenWidth);
    const newStartX =
      baseX + (direction === 'forward' ? screenWidth : -screenWidth);

    incomingCenter.x = newStartX;
    incomingCenter.y = baseY;

    gsap.killTweensOf(oldCenter);
    gsap.killTweensOf(incomingCenter);

    const duration = 0.4;
    const ease = 'power3.inOut';

    gsap.to(oldCenter, {
      x: oldTargetX,
      duration,
      ease,
    });

    gsap.to(incomingCenter, {
      x: baseX,
      duration,
      ease,
      onComplete: () => {
        // Replace references to the newly built board/navigation.
        this.gameplay = newGameplay;
        this.hasPreviousLevel = nextCenterBuild.hasPreviousLevel;
        this.hasNextLevel = nextCenterBuild.hasNextLevel;
        this.gameBoard = nextCenterBuild.gameBoard;
        this.levelNavigation = nextCenterBuild.levelNavigation;
        this.centerContainer = incomingCenter;

        oldCenter.removeFromParent();
        oldCenter.destroy({ children: true });

        if (newGameplay.isVictory || DEBUG_SHOW_VICTORY) {
          this.showVictoryOverlay();
        } else {
          this.victoryOverlay.hide();
        }

        onComplete?.();
      },
    });
  }

  private buildCenterForGameplay(
    gameplay: GameplayState,
  ): {
    center: Container;
    gameBoard: GameBoard;
    levelNavigation: LevelNavigation;
    hasPreviousLevel: boolean;
    hasNextLevel: boolean;
  } {
    const { level, boardState, levelIndex, levelCount } = gameplay;

    const hasPreviousLevel = levelIndex > 0;
    const nextLevelId = adjacentLevelId(level.id, 1);
    const hasNextLevel =
      levelIndex < levelCount - 1 &&
      nextLevelId !== null &&
      this.progressManager.isUnlocked(nextLevelId);

    const gameBoard = new GameBoard({
      cellSize: BASE_CELL_SIZE,
      size: level.size,
      boardState,
      onCellTap: (row, col) => this.callbacks.onCellTap(row, col),
      onDragPaint: (row, col) => this.callbacks.onDragPaint(row, col),
      onDragErase: (row, col) => this.callbacks.onDragErase(row, col),
      onInteractionEnd: () => this.callbacks.onInteractionEnd(),
    });

    const boardBaseWidth = gameBoard.logicalSize;
    const reserved = TOP_PAD + TOP_BAND + BOTTOM_BAND + LEVEL_NAV_HEIGHT + LEVEL_NAV_GAP;
    const targetBoardWidth = Math.min(LOGICAL_WIDTH * 0.9, LOGICAL_HEIGHT - reserved);

    gameBoard.pivot.set(boardBaseWidth / 2, boardBaseWidth / 2);
    gameBoard.scale.set(targetBoardWidth / boardBaseWidth);
    gameBoard.x = LOGICAL_WIDTH / 2;
    gameBoard.y = LEVEL_NAV_HEIGHT + LEVEL_NAV_GAP + targetBoardWidth / 2;

    const levelNavigation = new LevelNavigation({
      levelNumber: levelIndex + 1,
      logicalBoardWidth: targetBoardWidth,
      hasPreviousLevel,
      hasNextLevel,
      onPrevClick: () => this.callbacks.onPreviousLevel(),
      onNextClick: () => this.callbacks.onNextLevel(),
    });
    levelNavigation.x = (LOGICAL_WIDTH - targetBoardWidth) / 2;
    levelNavigation.y = 0;

    const center = new Container();
    const clusterHeight = LEVEL_NAV_HEIGHT + LEVEL_NAV_GAP + targetBoardWidth;
    center.pivot.set(LOGICAL_WIDTH / 2, clusterHeight / 2);
    center.addChild(levelNavigation, gameBoard);

    return { center, gameBoard, levelNavigation, hasPreviousLevel, hasNextLevel };
  }
}
