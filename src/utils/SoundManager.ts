import { Howl } from 'howler';
import soundBgrUrl from '../assets/sounds/sound-bgr.mp3';
import soundClickUrl from '../assets/sounds/sound-click.mp3';
import soundConflictUrl from '../assets/sounds/sound-conflict.mp3';
import soundPop1Url from '../assets/sounds/sound-pop-1.mp3';
import soundPop2Url from '../assets/sounds/sound-pop-2.mp3';
import soundPop3Url from '../assets/sounds/sound-pop-3.mp3';
import soundWinUrl from '../assets/sounds/sound-win.mp3';

const VOLUMES = {
  bgr: 0.15,
  click: 0.4,
  conflict: 0.5,
  pop1: 0.7, // dot
  pop2: 0.9, // star
  pop3: 0.7, // clear
  win: 0.3,
};

export class SoundManager {
  private static readonly bgr = new Howl({
    src: [soundBgrUrl],
    volume: VOLUMES.bgr,
    loop: true,
  });

  private static readonly click = new Howl({
    src: [soundClickUrl],
    volume: VOLUMES.click,
  });

  private static readonly conflict = new Howl({
    src: [soundConflictUrl],
    volume: VOLUMES.conflict,
    loop: true,
  });

  private static readonly pop1 = new Howl({
    src: [soundPop1Url],
    volume: VOLUMES.pop1,
  });

  private static readonly pop2 = new Howl({
    src: [soundPop2Url],
    volume: VOLUMES.pop2,
  });

  private static readonly pop3 = new Howl({
    src: [soundPop3Url],
    volume: VOLUMES.pop3,
  });

  private static readonly win = new Howl({
    src: [soundWinUrl],
    volume: VOLUMES.win,
  });

  static playBgr(): void {
    if (SoundManager.bgr.playing()) {
      return;
    }
    SoundManager.bgr.play();
  }

  static playClick(): void {
    SoundManager.playBgr();
    SoundManager.click.play();
  }

  static playPop1(): void {
    SoundManager.pop1.stop();
    SoundManager.pop1.play();
  }

  static playPop2(): void {
    SoundManager.pop2.play();
  }

  static playPop3(): void {
    SoundManager.pop3.play();
  }

  static playWin(): void {
    SoundManager.win.play();
  }

  static setConflictState(hasConflict: boolean): void {
    if (hasConflict) {
      if (!SoundManager.conflict.playing()) {
        SoundManager.conflict.play();
      }
      return;
    }

    SoundManager.conflict.stop();
  }
}
