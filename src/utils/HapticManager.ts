export class HapticManager {
  static stop(): void {
    if (!HapticManager.canVibrate()) {
      return;
    }
    navigator.vibrate(0);
  }

  static playLight(): void {
    HapticManager.stop();
    if (!HapticManager.canVibrate()) {
      return;
    }
    navigator.vibrate(15);
  }

  static playDouble(): void {
    HapticManager.stop();
    if (!HapticManager.canVibrate()) {
      return;
    }
    navigator.vibrate([30, 40, 30]);
  }

  /** Starts a vibrate/pause pattern in the current user-gesture stack. */
  static playPattern(pattern: number[]): void {
    if (pattern.length === 0) {
      return;
    }

    HapticManager.stop();
    if (!HapticManager.canVibrate()) {
      return;
    }
    navigator.vibrate(pattern);
  }

  private static canVibrate(): boolean {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
      return false;
    }

    // Chrome blocks vibrate() and logs an intervention unless this frame
    // currently has a user gesture. GSAP callbacks are not a gesture.
    const activation = navigator.userActivation;
    if (activation && !activation.isActive) {
      return false;
    }

    return true;
  }
}
