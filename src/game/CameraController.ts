import * as THREE from 'three';
import { GAME_CONFIG } from './config';
import { PlayerCell } from './PlayerCell';

const _desiredCamPos = new THREE.Vector3();
const _desiredLookTarget = new THREE.Vector3();
const _playerForward = new THREE.Vector3();

export class CameraController {
  public readonly camera: THREE.PerspectiveCamera;
  private readonly currentLookTarget = new THREE.Vector3();
  private currentZoomMultiplier = 1.0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(
      GAME_CONFIG.CAMERA.BASE_FOV,
      aspect,
      0.1,
      240
    );
    this.resetImmediate(new THREE.Vector3(0, GAME_CONFIG.WORLD.SWIM_PLANE_Y, 0), 0);
  }

  public resetImmediate(playerPosition: THREE.Vector3, headingAngle: number): void {
    this.currentZoomMultiplier = 1.0;
    _playerForward.set(-Math.sin(headingAngle), 0, -Math.cos(headingAngle));

    this.camera.position
      .copy(playerPosition)
      .addScaledVector(_playerForward, -GAME_CONFIG.CAMERA.OFFSET_BACK);
    this.camera.position.y = playerPosition.y + GAME_CONFIG.CAMERA.OFFSET_UP;

    this.currentLookTarget
      .copy(playerPosition)
      .addScaledVector(_playerForward, GAME_CONFIG.CAMERA.LOOK_AHEAD_DISTANCE);

    this.camera.lookAt(this.currentLookTarget);
  }

  public update(
    delta: number,
    player: PlayerCell,
    isEditing = false,
    elapsedTime = 0
  ): void {
    if (isEditing) {
      const scale = player.currentScale;
      const orbitSway = Math.sin(elapsedTime * 0.65) * 0.28;
      const camAngle = player.headingAngle - 0.72 + orbitSway;
      const dist = 5.4 * scale;

      // Camera positioned in front-side quarter view of the creature
      _desiredCamPos.set(
        player.position.x - Math.sin(camAngle) * dist,
        player.position.y + 2.85 * scale,
        player.position.z - Math.cos(camAngle) * dist
      );

      // Compute camera right vector so lookTarget shifts right -> creature projects into left half of screen
      const dirToPlayerX = player.position.x - _desiredCamPos.x;
      const dirToPlayerZ = player.position.z - _desiredCamPos.z;
      const lenXZ = Math.max(0.001, Math.hypot(dirToPlayerX, dirToPlayerZ));
      const rightX = -dirToPlayerZ / lenXZ;
      const rightZ = dirToPlayerX / lenXZ;

      const rightShift = 1.65 * scale;
      _desiredLookTarget.set(
        player.position.x + rightX * rightShift,
        player.position.y - 0.1 * scale,
        player.position.z + rightZ * rightShift
      );

      this.camera.position.x = THREE.MathUtils.damp(
        this.camera.position.x,
        _desiredCamPos.x,
        5.5,
        delta
      );
      this.camera.position.y = THREE.MathUtils.damp(
        this.camera.position.y,
        _desiredCamPos.y,
        5.5,
        delta
      );
      this.camera.position.z = THREE.MathUtils.damp(
        this.camera.position.z,
        _desiredCamPos.z,
        5.5,
        delta
      );

      this.currentLookTarget.x = THREE.MathUtils.damp(
        this.currentLookTarget.x,
        _desiredLookTarget.x,
        6.5,
        delta
      );
      this.currentLookTarget.y = THREE.MathUtils.damp(
        this.currentLookTarget.y,
        _desiredLookTarget.y,
        6.5,
        delta
      );
      this.currentLookTarget.z = THREE.MathUtils.damp(
        this.currentLookTarget.z,
        _desiredLookTarget.z,
        6.5,
        delta
      );

      this.camera.lookAt(this.currentLookTarget);

      const targetEditorFov = 44;
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

    _playerForward.set(
      -Math.sin(player.headingAngle),
      0,
      -Math.cos(player.headingAngle)
    );

    // Smoothly interpolate Spore-style camera zoom-out multiplier across Growth Stages 1 -> 2 -> 3
    this.currentZoomMultiplier = THREE.MathUtils.damp(
      this.currentZoomMultiplier,
      player.cameraZoomMultiplier,
      3.0,
      delta
    );

    const effectiveOffsetBack =
      GAME_CONFIG.CAMERA.OFFSET_BACK * this.currentZoomMultiplier;
    const effectiveOffsetUp =
      GAME_CONFIG.CAMERA.OFFSET_UP * this.currentZoomMultiplier;

    // Desired camera position behind & above the cell
    _desiredCamPos
      .copy(player.position)
      .addScaledVector(_playerForward, -effectiveOffsetBack);
    _desiredCamPos.y = player.position.y + effectiveOffsetUp;

    // Smooth exponential damping for camera position (zero vibration)
    this.camera.position.x = THREE.MathUtils.damp(
      this.camera.position.x,
      _desiredCamPos.x,
      GAME_CONFIG.CAMERA.POSITION_DAMPING,
      delta
    );
    this.camera.position.y = THREE.MathUtils.damp(
      this.camera.position.y,
      _desiredCamPos.y,
      GAME_CONFIG.CAMERA.POSITION_DAMPING,
      delta
    );
    this.camera.position.z = THREE.MathUtils.damp(
      this.camera.position.z,
      _desiredCamPos.z,
      GAME_CONFIG.CAMERA.POSITION_DAMPING,
      delta
    );

    // Desired lookAt point slightly ahead of the cell
    _desiredLookTarget
      .copy(player.position)
      .addScaledVector(
        _playerForward,
        GAME_CONFIG.CAMERA.LOOK_AHEAD_DISTANCE * this.currentZoomMultiplier
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

    // Subtle FOV widening when boosting
    const targetFov = player.isBoosting
      ? GAME_CONFIG.CAMERA.BOOST_FOV
      : GAME_CONFIG.CAMERA.BASE_FOV;
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
