import { Assets, Texture } from 'pixi.js';
import starImageUrl from '../assets/images/star-2.png';

export const STAR_TEXTURE_ID = 'star';

export async function loadGameAssets(): Promise<void> {
  await Assets.load({ alias: STAR_TEXTURE_ID, src: starImageUrl });
}

export function getStarTexture(): Texture {
  return Assets.get<Texture>(STAR_TEXTURE_ID);
}
