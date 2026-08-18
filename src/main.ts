import './style.css';

import { Application, TextureSource, TextureStyle } from 'pixi.js';
import { GameController } from './game/GameController';
import { LevelManager } from './services/LevelManager';
import { COLORS } from './ui/colors';
import { LoadingScreen } from './ui/components/LoadingScreen';
import { loadGameAssets } from './ui/gameAssets';

// DEBUG MODE: Set to true to bypass menus and load the first Easy level immediately.
// Set to false (or comment out the skip block below) to restore the normal Main Menu flow.
const DEBUG_SKIP_TO_LEVEL = false;
const MIN_LOADING_MS = 500;

async function loadAssetsWithMinimumDuration(
  loadingScreen: LoadingScreen,
): Promise<void> {
  const startTime = performance.now();
  let assetProgress = 0;
  let assetsLoaded = false;

  const assetsPromise = loadGameAssets((progress) => {
    assetProgress = progress;
  }).then(() => {
    assetsLoaded = true;
  });

  await new Promise<void>((resolve, reject) => {
    let rejected = false;

    const tick = (): void => {
      if (rejected) {
        return;
      }

      const elapsed = performance.now() - startTime;
      const timeProgress = Math.min(1, elapsed / MIN_LOADING_MS);
      loadingScreen.updateProgress(Math.min(assetProgress, timeProgress));

      if (assetsLoaded && elapsed >= MIN_LOADING_MS) {
        loadingScreen.updateProgress(1);
        resolve();
        return;
      }

      requestAnimationFrame(tick);
    };

    assetsPromise.catch((error: unknown) => {
      rejected = true;
      reject(error);
    });
    requestAnimationFrame(tick);
  });

  await assetsPromise;
}

async function bootstrap(): Promise<void> {
  const app = new Application();

  await app.init({
    background: COLORS.background,
    resizeTo: window,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    antialias: true,
  });

  TextureStyle.defaultOptions.scaleMode = 'linear';
  TextureSource.defaultOptions.autoGenerateMipmaps = true;

  const container = document.getElementById('app');
  if (container) {
    container.appendChild(app.canvas);
  }

  const loadingScreen = new LoadingScreen(app.screen.width, app.screen.height);
  app.stage.addChild(loadingScreen);

  const onLoadingResize = (): void => {
    loadingScreen.resize(app.screen.width, app.screen.height);
  };
  app.renderer.on('resize', onLoadingResize);

  await loadAssetsWithMinimumDuration(loadingScreen);

  app.renderer.off('resize', onLoadingResize);

  const levelManager = new LevelManager();
  const controller = new GameController(app, levelManager);

  // Render the target scene underneath before fading the loading overlay out.
  controller.start();

  if (DEBUG_SKIP_TO_LEVEL) {
    controller.skipToLevel('easy', 0);
  }

  app.stage.addChild(loadingScreen);
  loadingScreen.hide();
}

bootstrap().catch((error: unknown) => {
  console.error(error);
});
