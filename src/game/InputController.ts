import { InputState } from './types';

export class InputController {
  public readonly state: InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    boost: false,
    ability: false,
  };

  private onPauseToggleCallback: (() => void) | null = null;
  private onEditorToggleCallback: (() => void) | null = null;
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundWindowBlur: () => void;

  constructor(onPauseToggle?: () => void, onEditorToggle?: () => void) {
    this.onPauseToggleCallback = onPauseToggle ?? null;
    this.onEditorToggleCallback = onEditorToggle ?? null;
    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundKeyUp = this.handleKeyUp.bind(this);
    this.boundWindowBlur = this.resetInputs.bind(this);

    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    window.addEventListener('blur', this.boundWindowBlur);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (
      event.repeat &&
      (event.code === 'Escape' || event.code === 'KeyE')
    ) {
      return;
    }

    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.state.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.state.backward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.state.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.state.right = true;
        break;
      case 'Space':
        event.preventDefault();
        this.state.boost = true;
        break;
      case 'KeyQ':
        event.preventDefault();
        this.state.ability = true;
        break;
      case 'KeyE':
        event.preventDefault();
        if (this.onEditorToggleCallback) {
          this.onEditorToggleCallback();
        }
        break;
      case 'Escape':
        event.preventDefault();
        if (this.onPauseToggleCallback) {
          this.onPauseToggleCallback();
        }
        break;
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.state.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.state.backward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.state.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.state.right = false;
        break;
      case 'Space':
        this.state.boost = false;
        break;
      case 'KeyQ':
        this.state.ability = false;
        break;
    }
  }

  public setControlState(key: keyof InputState, active: boolean): void {
    this.state[key] = active;
  }

  public resetInputs(): void {
    this.state.forward = false;
    this.state.backward = false;
    this.state.left = false;
    this.state.right = false;
    this.state.boost = false;
    this.state.ability = false;
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('blur', this.boundWindowBlur);
  }
}
