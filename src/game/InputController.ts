import * as THREE from 'three';
import { InputState, SteeringModeSetting } from './types';

export type ProjectClientToWorldFn = (
  clientX: number,
  clientY: number,
  outWorldPos: THREE.Vector3
) => boolean;

export class InputController {
  public isLeftMouseDown = false;
  public hasTargetPosition = false;
  public readonly targetWorldPosition = new THREE.Vector3();
  public readonly pointerClientPos = { x: 0, y: 0 };

  public readonly state: InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    boost: false,
    ability: false,
    socialize: false,
    isLeftMouseDown: false,
    hasTargetPosition: false,
    targetWorldPosition: this.targetWorldPosition,
  };

  private steeringMode: SteeringModeSetting = 'keyboard';
  private onPauseToggleCallback: (() => void) | null = null;
  private onEditorToggleCallback: (() => void) | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private projectClientToWorld: ProjectClientToWorldFn | null = null;

  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundWindowBlur: () => void;
  private boundPointerDown: (e: PointerEvent) => void;
  private boundPointerMove: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;
  private boundPointerLeave: () => void;

  constructor(onPauseToggle?: () => void, onEditorToggle?: () => void) {
    this.onPauseToggleCallback = onPauseToggle ?? null;
    this.onEditorToggleCallback = onEditorToggle ?? null;
    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundKeyUp = this.handleKeyUp.bind(this);
    this.boundWindowBlur = this.resetInputs.bind(this);
    this.boundPointerDown = this.handlePointerDown.bind(this);
    this.boundPointerMove = this.handlePointerMove.bind(this);
    this.boundPointerUp = this.handlePointerUp.bind(this);
    this.boundPointerLeave = this.releaseLeftMouse.bind(this);

    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    window.addEventListener('blur', this.boundWindowBlur);
    window.addEventListener('pointermove', this.boundPointerMove);
    window.addEventListener('pointerup', this.boundPointerUp);
    window.addEventListener('pointercancel', this.boundPointerUp);
    document.documentElement.addEventListener(
      'pointerleave',
      this.boundPointerLeave
    );
  }

  public setSteeringMode(mode: SteeringModeSetting): void {
    this.steeringMode = mode;
    if (mode === 'keyboard') {
      // Strictly clear any active mouse target when switching to keyboard mode
      this.releaseLeftMouse();
    } else {
      // Strictly clear any held WASD/Arrow keys when switching to mouse mode
      this.state.forward = false;
      this.state.backward = false;
      this.state.left = false;
      this.state.right = false;
    }
  }

  public getSteeringMode(): SteeringModeSetting {
    return this.steeringMode;
  }

  public attachCanvas(
    canvas: HTMLCanvasElement,
    projectClientToWorld: ProjectClientToWorldFn
  ): void {
    if (this.canvasElement) {
      this.canvasElement.removeEventListener(
        'pointerdown',
        this.boundPointerDown
      );
    }
    this.canvasElement = canvas;
    this.projectClientToWorld = projectClientToWorld;
    this.canvasElement.addEventListener('pointerdown', this.boundPointerDown);
  }

  private handlePointerDown(event: PointerEvent): void {
    // Strictly ignore mouse navigation clicks when steeringMode is 'keyboard'
    if (this.steeringMode !== 'mouse') return;

    // Only trigger point-and-click navigation on primary left mouse button (button === 0)
    // directly on the 3D WebGL canvas (ignoring HUD buttons/overlays)
    if (event.button !== 0) return;
    if (this.canvasElement && event.target !== this.canvasElement) return;

    this.pointerClientPos.x = event.clientX;
    this.pointerClientPos.y = event.clientY;

    if (
      this.projectClientToWorld &&
      this.projectClientToWorld(
        event.clientX,
        event.clientY,
        this.targetWorldPosition
      )
    ) {
      this.isLeftMouseDown = true;
      this.hasTargetPosition = true;
      this.state.isLeftMouseDown = true;
      this.state.hasTargetPosition = true;
    }
  }

  private handlePointerMove(event: PointerEvent): void {
    if (this.steeringMode !== 'mouse') return;
    if (!this.isLeftMouseDown) return;

    // If primary button was released outside window, stop mouse propulsion immediately
    if ((event.buttons & 1) === 0) {
      this.releaseLeftMouse();
      return;
    }

    this.pointerClientPos.x = event.clientX;
    this.pointerClientPos.y = event.clientY;

    if (this.projectClientToWorld) {
      const hit = this.projectClientToWorld(
        event.clientX,
        event.clientY,
        this.targetWorldPosition
      );
      if (hit) {
        this.hasTargetPosition = true;
        this.state.hasTargetPosition = true;
      }
    }
  }

  private handlePointerUp(event: PointerEvent): void {
    if (event.button === 0 || (event.buttons & 1) === 0) {
      this.releaseLeftMouse();
    }
  }

  public updateHeldPointerWorldTarget(): void {
    if (
      this.steeringMode !== 'mouse' ||
      !this.isLeftMouseDown ||
      !this.projectClientToWorld
    ) {
      return;
    }
    const hit = this.projectClientToWorld(
      this.pointerClientPos.x,
      this.pointerClientPos.y,
      this.targetWorldPosition
    );
    if (hit) {
      this.hasTargetPosition = true;
      this.state.hasTargetPosition = true;
    }
  }

  public releaseLeftMouse(): void {
    this.isLeftMouseDown = false;
    this.hasTargetPosition = false;
    this.state.isLeftMouseDown = false;
    this.state.hasTargetPosition = false;
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const activeEl = document.activeElement as HTMLElement | null;
    if (
      activeEl &&
      (activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.isContentEditable)
    ) {
      if (event.code === 'Escape') {
        activeEl.blur();
      }
      return;
    }

    if (event.repeat && event.code === 'KeyE') {
      return;
    }

    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        if (this.steeringMode === 'keyboard') {
          this.state.forward = true;
        }
        break;
      case 'KeyS':
      case 'ArrowDown':
        if (this.steeringMode === 'keyboard') {
          this.state.backward = true;
        }
        break;
      case 'KeyA':
      case 'ArrowLeft':
        if (this.steeringMode === 'keyboard') {
          this.state.left = true;
        }
        break;
      case 'KeyD':
      case 'ArrowRight':
        if (this.steeringMode === 'keyboard') {
          this.state.right = true;
        }
        break;
      case 'Space':
        event.preventDefault();
        this.state.boost = true;
        break;
      case 'KeyQ':
        event.preventDefault();
        this.state.ability = true;
        break;
      case 'KeyC':
        event.preventDefault();
        this.state.socialize = true;
        break;
      case 'KeyE':
        event.preventDefault();
        if (this.onEditorToggleCallback) {
          this.onEditorToggleCallback();
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
      case 'KeyC':
        this.state.socialize = false;
        break;
    }
  }

  public setControlState(key: keyof InputState, active: boolean): void {
    if (
      key === 'forward' ||
      key === 'backward' ||
      key === 'left' ||
      key === 'right' ||
      key === 'boost' ||
      key === 'ability' ||
      key === 'socialize'
    ) {
      this.state[key] = active;
    }
  }

  public resetInputs(): void {
    this.state.forward = false;
    this.state.backward = false;
    this.state.left = false;
    this.state.right = false;
    this.state.boost = false;
    this.state.ability = false;
    this.state.socialize = false;
    this.releaseLeftMouse();
  }

  public dispose(): void {
    if (this.canvasElement) {
      this.canvasElement.removeEventListener(
        'pointerdown',
        this.boundPointerDown
      );
      this.canvasElement = null;
    }
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('blur', this.boundWindowBlur);
    window.removeEventListener('pointermove', this.boundPointerMove);
    window.removeEventListener('pointerup', this.boundPointerUp);
    window.removeEventListener('pointercancel', this.boundPointerUp);
    document.documentElement.removeEventListener(
      'pointerleave',
      this.boundPointerLeave
    );
  }
}

