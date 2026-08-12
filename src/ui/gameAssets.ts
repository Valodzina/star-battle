import { Assets, Texture } from 'pixi.js';
import starImageUrl from '../assets/images/star-2.png';
import starWinImageUrl from '../assets/images/star-win.png';

export const STAR_TEXTURE_ID = 'star';
export const STAR_WIN_TEXTURE_ID = 'star-win';

export async function loadGameAssets(): Promise<void> {
  await Assets.load([
    { alias: STAR_TEXTURE_ID, src: starImageUrl },
    { alias: STAR_WIN_TEXTURE_ID, src: starWinImageUrl },
  ]);
}

export function getStarTexture(): Texture {
  return Assets.get<Texture>(STAR_TEXTURE_ID);
}

export function getStarWinTexture(): Texture {
  return Assets.get<Texture>(STAR_WIN_TEXTURE_ID);
}
