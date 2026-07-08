import './style.css';

import { Application } from 'pixi.js';
import { GameController } from './game/GameController';
import { LevelManager } from './services/LevelManager';
import { COLORS } from './ui/colors';

async function bootstrap(): Promise<void> {
  const app = new Application();

  await app.init({
    background: COLORS.background,
    resizeTo: window,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  const container = document.getElementById('app');
  if (container) {
    container.appendChild(app.canvas);
  }

  const levelManager = new LevelManager();
  new GameController(app, levelManager).start();
}

bootstrap().catch((error: unknown) => {
  console.error(error);
});
