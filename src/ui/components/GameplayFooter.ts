import { Container, Sprite } from 'pixi.js';
import { HapticManager } from '../../utils/HapticManager';
import { SoundManager } from '../../utils/SoundManager';
import { COLORS } from '../colors';
import {
  AutofillToggle,
  AUTOFILL_TOGGLE_HEIGHT,
  AUTOFILL_TOGGLE_WIDTH,
} from './AutofillToggle';
import { getBinTexture, getUndoTexture } from '../gameAssets';

const ICON_BUTTON_SIZE = 90;
const SIDE_INSET = 40;
const FOOTER_GAP = 32;
const BOTTOM_BAND_HEIGHT = 160;

export interface GameplayFooterOptions {
  isAutoFillEnabled: boolean;
  logicalWidth: number;
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

    const {
      isAutoFillEnabled,
      logicalWidth,
      onUndoClicked,
      onClearClicked,
      onAutofillToggled,
    } = options;
    const centerY = BOTTOM_BAND_HEIGHT / 2;

    this.undoButton = new Sprite(getUndoTexture());
    this.undoButton.anchor.set(0.5);
    this.undoButton.width = ICON_BUTTON_SIZE;
    this.undoButton.height = ICON_BUTTON_SIZE;
    this.undoButton.position.set(SIDE_INSET + ICON_BUTTON_SIZE / 2, centerY);
    this.undoButton.on('pointerdown', () => {
      HapticManager.playLight();
      SoundManager.playClick();
    });
    this.undoButton.on('pointertap', () => onUndoClicked());
    this.setButtonEnabled(this.undoButton, false);

    this.autoFillButton = new AutofillToggle({
      isActive: isAutoFillEnabled,
      onToggle: () => onAutofillToggled(),
    });
    this.autoFillButton.position.set(
      logicalWidth - SIDE_INSET - AUTOFILL_TOGGLE_WIDTH,
      centerY - AUTOFILL_TOGGLE_HEIGHT / 2,
    );

    this.clearButton = new Sprite(getBinTexture());
    this.clearButton.anchor.set(0.5);
    this.clearButton.width = ICON_BUTTON_SIZE * 0.9;
    this.clearButton.height = ICON_BUTTON_SIZE * 0.91;
    this.clearButton.position.set(
      this.autoFillButton.x - FOOTER_GAP - ICON_BUTTON_SIZE / 2,
      centerY,
    );
    this.clearButton.on('pointerdown', () => {
      HapticManager.playLight();
      SoundManager.playClick();
    });
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

  private setButtonEnabled(buttonSprite: Sprite, isEnabled: boolean): void {
    buttonSprite.tint = isEnabled ? COLORS.activeTint : COLORS.inactiveTint;
    buttonSprite.eventMode = isEnabled ? 'static' : 'none';
    buttonSprite.cursor = isEnabled ? 'pointer' : 'default';
  }
}
