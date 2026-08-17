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

  private static canVibrate(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }
}
