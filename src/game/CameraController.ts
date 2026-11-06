import * as THREE from 'three';
import { GAME_CONFIG } from './config';
import { PlayerCell } from './PlayerCell';
import { getLandHeightAt } from './SceneEnvironment';

const _desiredCamPos = new THREE.Vector3();
const _desiredLookTarget = new THREE.Vector3();

export class CameraController {
  public readonly camera: THREE.PerspectiveCamera;
  private readonly currentLookTarget = new THREE.Vector3();
  private currentZoomMultiplier = 1.0;

  // Ángulo azimutal de la cámara en el mundo (no atado al rumbo del jugador)
  private isRightMouseDown: boolean = false;
  private currentAzimuth: number = 0;
  private currentPitch: number = 0.3; // Inclinación suave sobre el hombro
  private smoothedTargetY: number = 0;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private attachedDomElement: HTMLElement | null = null;
  private readonly boundMouseDown: (e: MouseEvent) => void;
  private readonly boundMouseUp: (e: MouseEvent) => void;
  private readonly boundMouseMove: (e: MouseEvent) => void;
  private readonly boundContextMenu: (e: MouseEvent) => void;

  // Editor workshop orbit state (only used when isEditing === true)
  private editorOrbitOffset = 0;
  private editorPitchAngle = 0.96; // Radians above horizontal plane (~55 deg)
  private editorZoomMultiplier = 1.0;
  private gameplayZoomFactor = 1.0;
  private shakeTimer = 0;
  private shakeIntensity = 0;
  private atmosphericAltitudeFactor = 0;
  private readonly cinematicTargetPos = new THREE.Vector3();
  private cinematicTimer = 0;

  public setCinematicTarget(target: THREE.Vector3, duration: number): void {
    this.cinematicTargetPos.copy(target);
    this.cinematicTimer = duration;
  }

  private get zoomLevel(): number {
    return this.currentZoomMultiplier * this.gameplayZoomFactor;
  }


  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(
      GAME_CONFIG.CAMERA.BASE_FOV,
      aspect,
      0.1,
      2600
    );

    this.boundMouseDown = (e: MouseEvent) => {
      if (e.button === 2) {
        // Clic derecho
        this.isRightMouseDown = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        e.preventDefault();
      }
    };

    this.boundMouseUp = (e: MouseEvent) => {
      if (e.button === 2) {
        this.isRightMouseDown = false;
      }
    };

    this.boundMouseMove = (e: MouseEvent) => {
      if (!this.isRightMouseDown) return;

      const deltaX = e.clientX - this.lastMouseX;
      const deltaY = e.clientY - this.lastMouseY;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;

      const sensitivity = 0.005;
      // El clic derecho modifica libremente el ángulo de visión global
      this.currentAzimuth -= deltaX * sensitivity;
      this.currentPitch = THREE.MathUtils.clamp(
        this.currentPitch + deltaY * sensitivity,
        -0.05,
        1.15
      );
    };

    this.boundContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    this.resetImmediate(
      new THREE.Vector3(0, GAME_CONFIG.WORLD.SWIM_PLANE_Y, 0),
      0
    );
  }

  public initMouseListeners(domElement: HTMLElement): void {
    this.disposeMouseListeners();
    this.attachedDomElement = domElement;
    domElement.addEventListener('mousedown', this.boundMouseDown);
    window.addEventListener('mouseup', this.boundMouseUp);
    window.addEventListener('mousemove', this.boundMouseMove);
    domElement.addEventListener('contextmenu', this.boundContextMenu);
  }

  public disposeMouseListeners(): void {
    if (this.attachedDomElement) {
      this.attachedDomElement.removeEventListener(
        'mousedown',
        this.boundMouseDown
      );
      this.attachedDomElement.removeEventListener(
        'contextmenu',
        this.boundContextMenu
      );
      this.attachedDomElement = null;
    }
    window.removeEventListener('mouseup', this.boundMouseUp);
    window.removeEventListener('mousemove', this.boundMouseMove);
    this.isRightMouseDown = false;
  }

  public syncWithPlayerHeading(playerMeshRotationY: number): void {
    // Alinea la cámara directamente detrás de la dirección de la criatura
    this.currentAzimuth = playerMeshRotationY;
    this.smoothedTargetY = 0; // Fuerza recalibración de altura inmediata
  }

  public getCameraForwardXZ(): THREE.Vector2 {
    return new THREE.Vector2(
      -Math.sin(this.currentAzimuth),
      -Math.cos(this.currentAzimuth)
    );
  }

  public setAtmosphericAltitudeFactor(
    factor: number,
    player?: PlayerCell,
    snapImmediate = false
  ): void {
    this.atmosphericAltitudeFactor = THREE.MathUtils.clamp(factor, 0, 1);
    if (snapImmediate && player) {
      const zoom = player.cameraZoomMultiplier;
      const offsetBack =
        GAME_CONFIG.CAMERA.OFFSET_BACK *
        zoom *
        (1 - this.atmosphericAltitudeFactor * 0.45);
      const offsetUp =
        GAME_CONFIG.CAMERA.OFFSET_UP * zoom +
        this.atmosphericAltitudeFactor * 54.0;

      const forwardX = -Math.sin(player.headingAngle);
      const forwardZ = -Math.cos(player.headingAngle);

      this.camera.position.set(
        player.position.x - forwardX * offsetBack,
        player.position.y + offsetUp,
        player.position.z - forwardZ * offsetBack
      );
      this.currentLookTarget.copy(player.position);
      this.camera.lookAt(this.currentLookTarget);
    }
  }

  public triggerScreenShake(intensity = 0.38, duration = 0.32): void {
    this.shakeIntensity = intensity;
    this.shakeTimer = duration;
  }

  public shake(intensity = 0.6, duration = 0.65): void {
    this.triggerScreenShake(intensity, duration);
  }

  public rotateEditorOrbit(deltaRadians: number): void {
    this.editorOrbitOffset += deltaRadians;
  }

  public orbitEditorCamera(deltaYaw: number, deltaPitch: number): void {
    this.editorOrbitOffset += deltaYaw;
    this.editorPitchAngle = THREE.MathUtils.clamp(
      this.editorPitchAngle + deltaPitch,
      0.28,
      1.46
    );
  }

  public zoomEditorCamera(deltaZoom: number): void {
    this.editorZoomMultiplier = THREE.MathUtils.clamp(
      this.editorZoomMultiplier + deltaZoom,
      0.55,
      1.85
    );
  }

  public zoomGameplayCamera(deltaZoom: number): void {
    this.gameplayZoomFactor = THREE.MathUtils.clamp(
      this.gameplayZoomFactor + deltaZoom,
      0.65,
      1.6
    );
  }

  public resetEditorOrbit(): void {
    this.editorOrbitOffset = 0;
    this.editorPitchAngle = 0.96;
    this.editorZoomMultiplier = 1.0;
  }

  public resetImmediate(
    playerPosition: THREE.Vector3,
    headingAngle = 0,
    isCreatureStage = false
  ): void {
    this.currentZoomMultiplier = 1.0;
    this.gameplayZoomFactor = 1.0;
    this.editorOrbitOffset = 0;
    this.editorPitchAngle = 0.96;
    this.editorZoomMultiplier = 1.0;
    this.shakeTimer = 0;
    this.atmosphericAltitudeFactor = 0;

    const forwardX = -Math.sin(headingAngle);
    const forwardZ = -Math.cos(headingAngle);

    if (isCreatureStage) {
      this.syncWithPlayerHeading(headingAngle);
      this.smoothedTargetY = playerPosition.y;
      const distance = 9.5 * this.zoomLevel;
      const camX =
        playerPosition.x +
        Math.sin(this.currentAzimuth) * Math.cos(this.currentPitch) * distance;
      const camZ =
        playerPosition.z +
        Math.cos(this.currentAzimuth) * Math.cos(this.currentPitch) * distance;
      const camY = Math.max(
        getLandHeightAt(camX, camZ) + 0.5,
        this.smoothedTargetY + Math.sin(this.currentPitch) * distance + 1.2
      );
      this.camera.position.set(camX, camY, camZ);
      this.currentLookTarget.set(
        playerPosition.x,
        this.smoothedTargetY + 0.8,
        playerPosition.z
      );
      this.camera.lookAt(this.currentLookTarget);
      return;
    }

    const offsetBack = GAME_CONFIG.CAMERA.OFFSET_BACK;
    const offsetUp = GAME_CONFIG.CAMERA.OFFSET_UP;

    this.camera.position.set(
      playerPosition.x - forwardX * offsetBack,
      playerPosition.y + offsetUp,
      playerPosition.z - forwardZ * offsetBack
    );

    const lookDist = GAME_CONFIG.CAMERA.LOOK_AHEAD_DISTANCE;
    this.currentLookTarget.set(
      playerPosition.x + forwardX * lookDist,
      playerPosition.y,
      playerPosition.z + forwardZ * lookDist
    );
    this.camera.lookAt(this.currentLookTarget);
  }

  public updateMenuCinematic(
    delta: number,
    player: PlayerCell,
    elapsedTime: number
  ): void {
    const scale = player.currentScale;
    const orbitAngle = elapsedTime * 0.24;
    const orbitDist = 11.8 * scale;
    const camHeight = (7.6 + Math.sin(elapsedTime * 0.45) * 1.1) * scale;

    _desiredCamPos.set(
      player.position.x + Math.sin(orbitAngle) * orbitDist,
      player.position.y + camHeight,
      player.position.z + Math.cos(orbitAngle) * orbitDist
    );

    _desiredLookTarget.set(
      player.position.x,
      player.position.y - 0.35 * scale,
      player.position.z
    );

    this.camera.position.x = THREE.MathUtils.damp(
      this.camera.position.x,
      _desiredCamPos.x,
      3.5,
      delta
    );
    this.camera.position.y = THREE.MathUtils.damp(
      this.camera.position.y,
      _desiredCamPos.y,
      3.5,
      delta
    );
    this.camera.position.z = THREE.MathUtils.damp(
      this.camera.position.z,
      _desiredCamPos.z,
      3.5,
      delta
    );

    this.currentLookTarget.x = THREE.MathUtils.damp(
      this.currentLookTarget.x,
      _desiredLookTarget.x,
      4.5,
      delta
    );
    this.currentLookTarget.y = THREE.MathUtils.damp(
      this.currentLookTarget.y,
      _desiredLookTarget.y,
      4.5,
      delta
    );
    this.currentLookTarget.z = THREE.MathUtils.damp(
      this.currentLookTarget.z,
      _desiredLookTarget.z,
      4.5,
      delta
    );

    this.camera.lookAt(this.currentLookTarget);

    const targetMenuFov = 48;
    if (Math.abs(this.camera.fov - targetMenuFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(
        this.camera.fov,
        targetMenuFov,
        4.0,
        delta
      );
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * Spore Brain Evolution Sequence 4-Phase Camera Choreography (5.5s):
   * - Phases 1 & 2 [0.00 - 0.65]: Low-angle frontal dolly-in toward the cell's head (`fov` narrows smoothly from 52° to 36°).
   * - Phase 2 [0.25 - 0.65]: Subtle 25° (~0.436 rad) orbital pan around the cerebral lobe as it unfolds.
   * - Phase 3 [0.65 - 0.85]: High-frequency harmonic biological micro-shake (`0.15` intensity) conveying synaptic overload tension.
   * - Phase 4 [0.85 - 1.00]: Elastic dolly pull-back (`fov` opens to 44°) revealing the full-body pose of the creature.
   */
  public updateBrainCinematic(
    delta: number,
    player: PlayerCell,
    progress: number,
    elapsedTime: number
  ): void {
    const p = THREE.MathUtils.clamp(progress, 0, 1);
    const scale = player.currentScale;

    // Phase 2 subtle 25° (0.4363 rad) orbital pan around the cranial axis
    const orbitPhase2 = THREE.MathUtils.smoothstep(p, 0.25, 0.65);
    const orbitReturnPhase4 = THREE.MathUtils.smoothstep(p, 0.85, 1.0);
    const panAngleRad =
      THREE.MathUtils.degToRad(25) * orbitPhase2 * (1.0 - orbitReturnPhase4 * 0.55);

    const camAzimuth = player.headingAngle + panAngleRad;
    const forwardX = -Math.sin(camAzimuth);
    const forwardZ = -Math.cos(camAzimuth);
    const rightX = Math.cos(camAzimuth);
    const rightZ = -Math.sin(camAzimuth);

    // Elastic backOut helper for Phase 4 dolly pull-back
    const pPhase4 = THREE.MathUtils.clamp((p - 0.85) / 0.15, 0, 1);
    const elasticPullback =
      1 + 2.70158 * Math.pow(pPhase4 - 1, 3) + 1.70158 * Math.pow(pPhase4 - 1, 2);

    // Dolly-in during Phases 1 & 2, hold close in Phase 3, elastic pull-back in Phase 4
    const dollyInT = THREE.MathUtils.smoothstep(p, 0.0, 0.65);
    const baseFrontDist = THREE.MathUtils.lerp(7.8, 3.85, dollyInT);
    const frontDist =
      (p < 0.85
        ? baseFrontDist
        : THREE.MathUtils.lerp(3.85, 6.85, elasticPullback)) * scale;

    const baseSideOffset = THREE.MathUtils.lerp(1.65, 0.55, dollyInT);
    const sideOffset =
      (p < 0.85
        ? baseSideOffset
        : THREE.MathUtils.lerp(0.55, 1.45, pPhase4)) * scale;

    // Low-angle contrapicado during Phases 1-3 looking up at the elevated cerebrum, then rising in Phase 4
    const lowAngleHeight = THREE.MathUtils.lerp(2.85, 1.18, dollyInT);
    const camHeight =
      (p < 0.85
        ? lowAngleHeight
        : THREE.MathUtils.lerp(1.18, 2.75, elasticPullback)) * scale;

    // Phase 3 [0.65 - 0.85]: High-frequency harmonic micro-shake (0.15 intensity)
    let shakeX = 0;
    let shakeY = 0;
    let shakeZ = 0;
    if (p >= 0.65 && p <= 0.85) {
      const p3Norm = (p - 0.65) / 0.2;
      const shakeEnvelope = Math.sin(p3Norm * Math.PI);
      const amp = 0.15 * shakeEnvelope * scale;
      shakeX =
        (Math.sin(elapsedTime * 47.0) * 0.65 +
          Math.cos(elapsedTime * 73.0) * 0.35) *
        amp;
      shakeY =
        (Math.cos(elapsedTime * 53.0) * 0.65 +
          Math.sin(elapsedTime * 89.0) * 0.35) *
        amp;
      shakeZ = Math.sin(elapsedTime * 61.0) * amp * 0.5;
    }

    _desiredCamPos.set(
      player.position.x + forwardX * frontDist + rightX * sideOffset + shakeX,
      player.position.y + camHeight + shakeY,
      player.position.z + forwardZ * frontDist + rightZ * sideOffset + shakeZ
    );

    // Look target tracks the ascending/expanding cerebral lobe, then centers on the full-body creature in Phase 4
    const headForwardX = -Math.sin(player.headingAngle);
    const headForwardZ = -Math.cos(player.headingAngle);
    const lookUpOffset =
      (p < 0.25
        ? THREE.MathUtils.lerp(0.35, 1.38, p / 0.25)
        : p < 0.85
        ? THREE.MathUtils.lerp(1.38, 1.52, (p - 0.25) / 0.6)
        : THREE.MathUtils.lerp(1.52, 0.38, pPhase4)) * scale;

    const cranForwardOffset =
      THREE.MathUtils.lerp(0.46, 0.15, pPhase4) * scale;

    _desiredLookTarget.set(
      player.position.x + headForwardX * cranForwardOffset + shakeX * 0.35,
      player.position.y + lookUpOffset + shakeY * 0.35,
      player.position.z + headForwardZ * cranForwardOffset + shakeZ * 0.35
    );

    this.camera.position.x = THREE.MathUtils.damp(
      this.camera.position.x,
      _desiredCamPos.x,
      6.0,
      delta
    );
    this.camera.position.y = THREE.MathUtils.damp(
      this.camera.position.y,
      _desiredCamPos.y,
      6.0,
      delta
    );
    this.camera.position.z = THREE.MathUtils.damp(
      this.camera.position.z,
      _desiredCamPos.z,
      6.0,
      delta
    );

    this.currentLookTarget.x = THREE.MathUtils.damp(
      this.currentLookTarget.x,
      _desiredLookTarget.x,
      7.5,
      delta
    );
    this.currentLookTarget.y = THREE.MathUtils.damp(
      this.currentLookTarget.y,
      _desiredLookTarget.y,
      7.5,
      delta
    );
    this.currentLookTarget.z = THREE.MathUtils.damp(
      this.currentLookTarget.z,
      _desiredLookTarget.z,
      7.5,
      delta
    );

    this.camera.lookAt(this.currentLookTarget);

    // Dynamic FOV: narrows smoothly from 52° to 36° across Phases 1-2, then opens to 44° in Phase 4
    const targetFov =
      p < 0.65
        ? THREE.MathUtils.lerp(52, 36, dollyInT)
        : p < 0.85
        ? 36
        : THREE.MathUtils.lerp(36, 44, elasticPullback);

    if (Math.abs(this.camera.fov - targetFov) > 0.02) {
      this.camera.fov = THREE.MathUtils.damp(
        this.camera.fov,
        targetFov,
        6.5,
        delta
      );
      this.camera.updateProjectionMatrix();
    }
  }

  public update(
    delta: number,
    player: PlayerCell,
    isEditing = false,
    elapsedTime = 0
  ): void {
    if (isEditing) {
      const scale = player.currentScale;
      const camAzimuth = player.headingAngle + this.editorOrbitOffset;
      const orbitDistance = 11.4 * scale * this.editorZoomMultiplier;
      const horizontalDist = Math.cos(this.editorPitchAngle) * orbitDistance;
      const verticalHeight = Math.sin(this.editorPitchAngle) * orbitDistance;

      _desiredCamPos.set(
        player.position.x + Math.sin(camAzimuth) * horizontalDist,
        player.position.y + verticalHeight,
        player.position.z + Math.cos(camAzimuth) * horizontalDist
      );

      _desiredLookTarget.set(
        player.position.x,
        player.position.y,
        player.position.z
      );

      this.camera.position.x = THREE.MathUtils.damp(
        this.camera.position.x,
        _desiredCamPos.x,
        9.0,
        delta
      );
      this.camera.position.y = THREE.MathUtils.damp(
        this.camera.position.y,
        _desiredCamPos.y,
        9.0,
        delta
      );
      this.camera.position.z = THREE.MathUtils.damp(
        this.camera.position.z,
        _desiredCamPos.z,
        9.0,
        delta
      );

      this.currentLookTarget.x = THREE.MathUtils.damp(
        this.currentLookTarget.x,
        _desiredLookTarget.x,
        9.0,
        delta
      );
      this.currentLookTarget.y = THREE.MathUtils.damp(
        this.currentLookTarget.y,
        _desiredLookTarget.y,
        9.0,
        delta
      );
      this.currentLookTarget.z = THREE.MathUtils.damp(
        this.currentLookTarget.z,
        _desiredLookTarget.z,
        9.0,
        delta
      );

      this.camera.lookAt(this.currentLookTarget);

      const targetEditorFov = 45;
      if (Math.abs(this.camera.fov - targetEditorFov) > 0.05) {
        this.camera.fov = THREE.MathUtils.damp(
          this.camera.fov,
          targetEditorFov,
          6.0,
          delta
        );
        this.camera.updateProjectionMatrix();
      }
      return;
    }

    // 0. Lateral Cinematic Framing during Courtship Union (setCinematicTarget)
    if (this.cinematicTimer > 0) {
      this.cinematicTimer = Math.max(0, this.cinematicTimer - delta);
      const scale = Math.max(1.0, player.currentScale);
      const forwardX = -Math.sin(player.headingAngle);
      const forwardZ = -Math.cos(player.headingAngle);
      const rightX = Math.cos(player.headingAngle);
      const rightZ = -Math.sin(player.headingAngle);

      const midX = (player.position.x + this.cinematicTargetPos.x) * 0.5;
      const midY = player.position.y;
      const midZ = (player.position.z + this.cinematicTargetPos.z) * 0.5;

      _desiredCamPos.set(
        midX + rightX * 6.8 * scale - forwardX * 4.2 * scale,
        midY + 6.2 * scale,
        midZ + rightZ * 6.8 * scale - forwardZ * 4.2 * scale
      );
      _desiredLookTarget.set(
        midX + forwardX * 1.4 * scale,
        midY,
        midZ + forwardZ * 1.4 * scale
      );

      this.camera.position.lerp(_desiredCamPos, Math.min(1.0, delta * 6.5));
      this.currentLookTarget.lerp(_desiredLookTarget, Math.min(1.0, delta * 8.0));
      this.camera.lookAt(this.currentLookTarget);
      return;
    }

    // 1. Smoothly interpolate Spore-style camera zoom-out multiplier across Growth Stages 1..5
    this.currentZoomMultiplier = THREE.MathUtils.damp(
      this.currentZoomMultiplier,
      player.cameraZoomMultiplier,
      3.0,
      delta
    );

    const altFactor = this.atmosphericAltitudeFactor;
    const zoom = this.zoomLevel;
    const forwardX = -Math.sin(player.headingAngle);
    const forwardZ = -Math.cos(player.headingAngle);

    if (player.isInLandCreatureStage()) {

      // CÁMARA TERRESTRE INDEPENDIENTE CON FILTRADO SUAVE EN Y (Cero vibración al andar)
      const distance = 9.5 * this.zoomLevel * (1.0 - altFactor * 0.45);
      const target = player.position;

      // 1. FILTRADO SUAVE DE ALTURA (Elimina la vibración por contacto con el suelo)
      if (this.smoothedTargetY === 0) {
        this.smoothedTargetY = target.y;
      }
      this.smoothedTargetY = THREE.MathUtils.lerp(
        this.smoothedTargetY,
        target.y,
        Math.min(1.0, delta * 6.0)
      );

      // 2. Posición de la cámara en coordenadas esféricas estables (detrás de la espalda de la criatura)
      const camX =
        target.x +
        Math.sin(this.currentAzimuth) * Math.cos(this.currentPitch) * distance;
      const camZ =
        target.z +
        Math.cos(this.currentAzimuth) * Math.cos(this.currentPitch) * distance;
      const rawCamY =
        this.smoothedTargetY +
        Math.sin(this.currentPitch) * distance +
        1.2 +
        altFactor * altFactor * 54.0;
      const camY = Math.max(getLandHeightAt(camX, camZ) + 0.5, rawCamY);

      _desiredCamPos.set(camX, camY, camZ);
      this.camera.position.lerp(_desiredCamPos, Math.min(1.0, delta * 10.0));

      if (this.shakeTimer > 0) {
        this.shakeTimer = Math.max(0, this.shakeTimer - delta);
        const decay = this.shakeTimer / 0.32;
        const amp = this.shakeIntensity * decay;
        this.camera.position.x += Math.sin(elapsedTime * 58) * amp;
        this.camera.position.z += Math.cos(elapsedTime * 52) * amp;
      }

      // 3. Enfoque al torso con altura estabilizada
      _desiredLookTarget.set(target.x, this.smoothedTargetY + 0.8, target.z);
      this.currentLookTarget.copy(_desiredLookTarget);
      this.camera.lookAt(this.currentLookTarget);
    } else {
      // CÁMARA CENITAL / ACUÁTICA (Fase Celular)
      const offsetBack =
        GAME_CONFIG.CAMERA.OFFSET_BACK * zoom * (1.0 - altFactor * 0.45);
      const offsetUp =
        GAME_CONFIG.CAMERA.OFFSET_UP * zoom + altFactor * altFactor * 54.0;

      // Posición fija directamente arriba y detrás según la orientación de la célula
      _desiredCamPos.set(
        player.position.x - forwardX * offsetBack,
        player.position.y + offsetUp,
        player.position.z - forwardZ * offsetBack
      );

      const posDamp =
        altFactor > 0.01 ? 9.5 : GAME_CONFIG.CAMERA.POSITION_DAMPING;

      this.camera.position.x = THREE.MathUtils.damp(
        this.camera.position.x,
        _desiredCamPos.x,
        posDamp,
        delta
      );
      this.camera.position.y = THREE.MathUtils.damp(
        this.camera.position.y,
        _desiredCamPos.y,
        posDamp,
        delta
      );
      this.camera.position.z = THREE.MathUtils.damp(
        this.camera.position.z,
        _desiredCamPos.z,
        posDamp,
        delta
      );

      if (this.shakeTimer > 0) {
        this.shakeTimer = Math.max(0, this.shakeTimer - delta);
        const decay = this.shakeTimer / 0.32;
        const amp = this.shakeIntensity * decay;
        this.camera.position.x += Math.sin(elapsedTime * 58) * amp;
        this.camera.position.z += Math.cos(elapsedTime * 52) * amp;
      }

      // Objetivo de enfoque: centro de la célula con un leve avance frontal
      const lookDist = GAME_CONFIG.CAMERA.LOOK_AHEAD_DISTANCE * zoom;
      _desiredLookTarget.set(
        player.position.x + forwardX * lookDist,
        player.position.y,
        player.position.z + forwardZ * lookDist
      );

      this.currentLookTarget.x = THREE.MathUtils.damp(
        this.currentLookTarget.x,
        _desiredLookTarget.x,
        GAME_CONFIG.CAMERA.TARGET_DAMPING,
        delta
      );
      this.currentLookTarget.y = THREE.MathUtils.damp(
        this.currentLookTarget.y,
        _desiredLookTarget.y,
        GAME_CONFIG.CAMERA.TARGET_DAMPING,
        delta
      );
      this.currentLookTarget.z = THREE.MathUtils.damp(
        this.currentLookTarget.z,
        _desiredLookTarget.z,
        GAME_CONFIG.CAMERA.TARGET_DAMPING,
        delta
      );

      this.camera.lookAt(this.currentLookTarget);
    }

    // Subtle FOV widening when boosting or diving through planetary atmosphere
    const baseTargetFov = player.isBoosting
      ? GAME_CONFIG.CAMERA.BOOST_FOV
      : GAME_CONFIG.CAMERA.BASE_FOV;
    const targetFov = baseTargetFov + altFactor * 14.0;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(
        this.camera.fov,
        targetFov,
        6.0,
        delta
      );
      this.camera.updateProjectionMatrix();
    }
  }

  public handleResize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  }
}
