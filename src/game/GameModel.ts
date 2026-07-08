import type { Difficulty, GameState, ScreenId } from '../types/level';

type GameStateListener = (state: GameState) => void;

export class GameModel {
  private state: GameState = {
    screen: 'mainMenu',
    selectedDifficulty: null,
  };

  private readonly listeners = new Set<GameStateListener>();

  getState(): GameState {
    return this.state;
  }

  setScreen(screen: ScreenId): void {
    if (this.state.screen === screen) {
      return;
    }

    this.state = { ...this.state, screen };
    this.notify();
  }

  setDifficulty(difficulty: Difficulty): void {
    if (this.state.selectedDifficulty === difficulty) {
      return;
    }

    this.state = { ...this.state, selectedDifficulty: difficulty };
    this.notify();
  }

  subscribe(listener: GameStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
