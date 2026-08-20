import { Assets, Texture } from 'pixi.js';
import interMediumUrl from '../assets/fonts/Inter28pt-Medium.woff2';
import interSemiBoldUrl from '../assets/fonts/Inter28pt-SemiBold.woff2';
import montserratExtraBoldUrl from '../assets/fonts/Montserrat-ExtraBold.woff2';
import starImageUrl from '../assets/images/star-2.png';
import starWinImageUrl from '../assets/images/star-win.png';
import undoImageUrl from '../assets/images/undo.png';
import binImageUrl from '../assets/images/bin-1.png';
import backImageUrl from '../assets/images/back.png';
import back1ImageUrl from '../assets/images/back-1.png';
import lockImageUrl from '../assets/images/lock.png';
import tutorialImageUrl from '../assets/images/tutorial.png';
import handImageUrl from '../assets/images/hand.png';
import {
  INTER_MEDIUM_FONT_FAMILY,
  INTER_SEMIBOLD_FONT_FAMILY,
  TITLE_FONT_FAMILY,
} from './constants';

export const STAR_TEXTURE_ID = 'star';
export const STAR_WIN_TEXTURE_ID = 'star-win';
export const UNDO_TEXTURE_ID = 'undo';
export const BIN_TEXTURE_ID = 'bin-1';
export const BACK_TEXTURE_ID = 'back';
export const BACK_1_TEXTURE_ID = 'back-1';
export const LOCK_TEXTURE_ID = 'lock';
export const TUTORIAL_TEXTURE_ID = 'tutorial.png';
export const HAND_TEXTURE_ID = 'hand.png';
export const MONTSERRAT_EXTRABOLD_FONT_ID = 'montserrat-extrabold';
export const INTER_SEMIBOLD_FONT_ID = 'inter-semibold';
export const INTER_MEDIUM_FONT_ID = 'inter-medium';

export async function loadGameAssets(
  onProgress?: (progress: number) => void,
): Promise<void> {
  await Assets.load(
    [
      { alias: STAR_TEXTURE_ID, src: starImageUrl },
      { alias: STAR_WIN_TEXTURE_ID, src: starWinImageUrl },
      { alias: UNDO_TEXTURE_ID, src: undoImageUrl },
      { alias: BIN_TEXTURE_ID, src: binImageUrl },
      { alias: BACK_TEXTURE_ID, src: backImageUrl },
      { alias: BACK_1_TEXTURE_ID, src: back1ImageUrl },
      { alias: LOCK_TEXTURE_ID, src: lockImageUrl },
      { alias: TUTORIAL_TEXTURE_ID, src: tutorialImageUrl },
      { alias: HAND_TEXTURE_ID, src: handImageUrl },
      {
        alias: MONTSERRAT_EXTRABOLD_FONT_ID,
        src: montserratExtraBoldUrl,
        data: { family: TITLE_FONT_FAMILY },
      },
      {
        alias: INTER_SEMIBOLD_FONT_ID,
        src: interSemiBoldUrl,
        data: { family: INTER_SEMIBOLD_FONT_FAMILY },
      },
      {
        alias: INTER_MEDIUM_FONT_ID,
        src: interMediumUrl,
        data: { family: INTER_MEDIUM_FONT_FAMILY },
      },
    ],
    onProgress,
  );
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

export function getBack1Texture(): Texture {
  return Assets.get<Texture>(BACK_1_TEXTURE_ID);
}

export function getLockTexture(): Texture {
  return Assets.get<Texture>(LOCK_TEXTURE_ID);
}

export function getTutorialTexture(): Texture {
  return Assets.get<Texture>(TUTORIAL_TEXTURE_ID);
}

export function getHandTexture(): Texture {
  return Assets.get<Texture>(HAND_TEXTURE_ID);
}
