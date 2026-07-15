export interface IScene {
  show(): void;
  hide(): void;
  resize(width: number, height: number): void;
}
