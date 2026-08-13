import { Container, Sprite } from 'pixi.js';
import { BUTTON_GAP } from '../constants';
import {
  AutofillToggle,
  AUTOFILL_TOGGLE_HEIGHT,
  AUTOFILL_TOGGLE_WIDTH,
} from './AutofillToggle';
import { getBinTexture, getUndoTexture } from '../gameAssets';

const ICON_BUTTON_SIZE = 40;
const ACTIVE_TINT = 0x44505c;
const INACTIVE_TINT = 0x9ba4b5;

export const GAMEPLAY_FOOTER_CONTENT_WIDTH =
  ICON_BUTTON_SIZE + BUTTON_GAP + ICON_BUTTON_SIZE + BUTTON_GAP + AUTOFILL_TOGGLE_WIDTH;

export interface GameplayFooterOptions {
  isAutoFillEnabled: boolean;
  onUndoClicked: () => void;
  onClearClicked: () => void;
  onAutofillToggled: () => void;
}

export class GameplayFooter extends Container {
  private readonly undoButton: Sprite;
  private readonly clearButton: Sprite;
  private readonly autoFillButton: AutofillToggle;

  constructor(options: GameplayFooterOptions) {
    super();

    const { isAutoFillEnabled, onUndoClicked, onClearClicked, onAutofillToggled } = options;

    this.undoButton = new Sprite(getUndoTexture());
    this.undoButton.anchor.set(0.5);
    this.undoButton.width = ICON_BUTTON_SIZE;
    this.undoButton.height = ICON_BUTTON_SIZE;
    this.undoButton.on('pointertap', () => onUndoClicked());
    this.setButtonEnabled(this.undoButton, false);

    this.autoFillButton = new AutofillToggle({
      isActive: isAutoFillEnabled,
      onToggle: () => onAutofillToggled(),
    });

    this.clearButton = new Sprite(getBinTexture());
    this.clearButton.anchor.set(0.5);
    this.clearButton.width = ICON_BUTTON_SIZE * 0.9;
    this.clearButton.height = ICON_BUTTON_SIZE * 0.91;
    this.clearButton.on('pointertap', () => onClearClicked());
    this.setButtonEnabled(this.clearButton, true);

    this.addChild(this.undoButton, this.clearButton, this.autoFillButton);
  }

  setUndoEnabled(isEnabled: boolean): void {
    this.setButtonEnabled(this.undoButton, isEnabled);
  }

  setAutoFillEnabled(enabled: boolean): void {
    this.autoFillButton.setActive(enabled);
  }

  layout(
    boardLeftX: number,
    boardRightX: number,
    uiScale: number,
    footerCenterY: number,
  ): void {
    const iconDisplaySize = ICON_BUTTON_SIZE * uiScale;
    const iconHalfDisplay = iconDisplaySize / 2;

    this.undoButton.width = iconDisplaySize;
    this.undoButton.height = iconDisplaySize;
    this.undoButton.position.set(boardLeftX + iconHalfDisplay, footerCenterY);

    this.autoFillButton.scale.set(uiScale);
    this.autoFillButton.position.set(
      boardRightX - AUTOFILL_TOGGLE_WIDTH * uiScale,
      footerCenterY - (AUTOFILL_TOGGLE_HEIGHT * uiScale) / 2,
    );

    this.clearButton.width = iconDisplaySize * 0.9;
    this.clearButton.height = iconDisplaySize * 0.91;
    this.clearButton.position.set(
      this.autoFillButton.x - BUTTON_GAP * 1.3 * uiScale - iconHalfDisplay,
      footerCenterY,
    );
  }

  private setButtonEnabled(buttonSprite: Sprite, isEnabled: boolean): void {
    buttonSprite.tint = isEnabled ? ACTIVE_TINT : INACTIVE_TINT;
    buttonSprite.eventMode = isEnabled ? 'static' : 'none';
    buttonSprite.cursor = isEnabled ? 'pointer' : 'default';
  }
}
