import { Assets, Texture } from 'pixi.js';
import starImageUrl from '../assets/images/star-2.png';
import starWinImageUrl from '../assets/images/star-win.png';
import undoImageUrl from '../assets/images/undo.png';
import binImageUrl from '../assets/images/bin-1.png';
import backImageUrl from '../assets/images/back.png';
import lockImageUrl from '../assets/images/lock.png';

export const STAR_TEXTURE_ID = 'star';
export const STAR_WIN_TEXTURE_ID = 'star-win';
export const UNDO_TEXTURE_ID = 'undo';
export const BIN_TEXTURE_ID = 'bin-1';
export const BACK_TEXTURE_ID = 'back';
export const LOCK_TEXTURE_ID = 'lock';

export async function loadGameAssets(): Promise<void> {
  await Assets.load([
    { alias: STAR_TEXTURE_ID, src: starImageUrl },
    { alias: STAR_WIN_TEXTURE_ID, src: starWinImageUrl },
    { alias: UNDO_TEXTURE_ID, src: undoImageUrl },
    { alias: BIN_TEXTURE_ID, src: binImageUrl },
    { alias: BACK_TEXTURE_ID, src: backImageUrl },
    { alias: LOCK_TEXTURE_ID, src: lockImageUrl },
  ]);
}

export function getStarTexture(): Texture {
  return Assets.get<Texture>(STAR_TEXTURE_ID);
}

export function getStarWinTexture(): Texture {
  return Assets.get<Texture>(STAR_WIN_TEXTURE_ID);
}

export function getUndoTexture(): Texture {
  return Assets.get<Texture>(UNDO_TEXTURE_ID);
}

export function getBinTexture(): Texture {
  return Assets.get<Texture>(BIN_TEXTURE_ID);
}

export function getBackTexture(): Texture {
  return Assets.get<Texture>(BACK_TEXTURE_ID);
}

export function getLockTexture(): Texture {
  return Assets.get<Texture>(LOCK_TEXTURE_ID);
}
