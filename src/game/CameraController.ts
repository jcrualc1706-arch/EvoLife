import * as THREE from 'three';
import { GAME_CONFIG } from './config';
import { PlayerCell } from './PlayerCell';

const _desiredCamPos = new THREE.Vector3();
const _desiredLookTarget = new THREE.Vector3();

export class CameraController {
  public readonly camera: THREE.PerspectiveCamera;
  private readonly currentLookTarget = new THREE.Vector3();
  private currentZoomMultiplier = 1.0;

  // Editor workshop orbit state (only used when isEditing === true)
  private editorOrbitOffset = 0;
  private editorPitchAngle = 0.96; // Radians above horizontal plane (~55 deg)
  private shakeTimer = 0;
  private shakeIntensity = 0;
  private atmosphericAltitudeFactor = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(
      GAME_CONFIG.CAMERA.BASE_FOV,
      aspect,
      0.1,
      420
    );
    this.resetImmediate(
      new THREE.Vector3(0, GAME_CONFIG.WORLD.SWIM_PLANE_Y, 0),
      0
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

  public resetEditorOrbit(): void {
    this.editorOrbitOffset = 0;
    this.editorPitchAngle = 0.96;
  }

  public resetImmediate(
    playerPosition: THREE.Vector3,
    headingAngle = 0
  ): void {
    this.currentZoomMultiplier = 1.0;
    this.editorOrbitOffset = 0;
    this.editorPitchAngle = 0.96;
    this.shakeTimer = 0;
    this.atmosphericAltitudeFactor = 0;

    const forwardX = -Math.sin(headingAngle);
    const forwardZ = -Math.cos(headingAngle);

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

  public update(
    delta: number,
    player: PlayerCell,
    isEditing = false,
    elapsedTime = 0
  ): void {
    if (isEditing) {
      const scale = player.currentScale;
      const camAzimuth = player.headingAngle + this.editorOrbitOffset;
      const orbitDistance = 11.4 * scale;
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

    // 1. Smoothly interpolate Spore-style camera zoom-out multiplier across Growth Stages 1..5
    this.currentZoomMultiplier = THREE.MathUtils.damp(
      this.currentZoomMultiplier,
      player.cameraZoomMultiplier,
      3.0,
      delta
    );

    const altFactor = this.atmosphericAltitudeFactor;
    const zoom = this.currentZoomMultiplier;
    const offsetBack =
      GAME_CONFIG.CAMERA.OFFSET_BACK *
      zoom *
      (1.0 - altFactor * 0.45);
    const offsetUp =
      GAME_CONFIG.CAMERA.OFFSET_UP * zoom +
      altFactor * altFactor * 54.0;

    // Dirección hacia la que mira la célula
    const forwardX = -Math.sin(player.headingAngle);
    const forwardZ = -Math.cos(player.headingAngle);

    // Posición fija directamente arriba y detrás según la orientación de la célula
    _desiredCamPos.set(
      player.position.x - forwardX * offsetBack,
      player.position.y + offsetUp,
      player.position.z - forwardZ * offsetBack
    );

    const posDamp =
      altFactor > 0.01
        ? 9.5
        : GAME_CONFIG.CAMERA.POSITION_DAMPING;

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
