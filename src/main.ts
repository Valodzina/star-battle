import './style.css';

import { Application } from 'pixi.js';
import { GameController } from './game/GameController';
import { LevelManager } from './services/LevelManager';
import { COLORS } from './ui/colors';
import { loadGameAssets } from './ui/gameAssets';

// DEBUG MODE: Set to true to bypass menus and load the first Easy level immediately.
// Set to false (or comment out the skip block below) to restore the normal Main Menu flow.
const DEBUG_SKIP_TO_LEVEL = false;

async function bootstrap(): Promise<void> {
  const app = new Application();

  await app.init({
    background: COLORS.background,
    resizeTo: window,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  await loadGameAssets();

  const container = document.getElementById('app');
  if (container) {
    container.appendChild(app.canvas);
  }

  const levelManager = new LevelManager();
  const controller = new GameController(app, levelManager);

  // Wire callbacks, subscribe to state, and render — same init path in both modes.
  controller.start();

  if (DEBUG_SKIP_TO_LEVEL) {
    // Jump straight into easy level 1 (index 0) after Pixi, LevelManager, and Controller are ready.
    controller.skipToLevel('easy', 0);
  }
}

bootstrap().catch((error: unknown) => {
  console.error(error);
});
