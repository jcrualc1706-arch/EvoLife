import * as THREE from 'three';
import { audioManager } from './AudioManager';
import { CameraController } from './CameraController';
import { GAME_CONFIG } from './config';
import { PlayerCell } from './PlayerCell';
import { KinCellEntity } from './PredatorManager';
import { SceneEnvironment } from './SceneEnvironment';

export class MatingSequence {
  private readonly scene: THREE.Scene;
  private readonly cameraController: CameraController;
  private readonly sceneEnvironment: SceneEnvironment;

  public eggMesh: THREE.Group | null = null;
  public readonly eggPosition = new THREE.Vector3();
  public isCinematicPlaying = false;
  public playerControlsLocked = false;
  public isHatching = false;

  public get isDancing(): boolean {
    return this.isCinematicPlaying;
  }

  private encounterPlayer: PlayerCell | null = null;
  private encounterMate: KinCellEntity | null = null;
  private encounterForward = new THREE.Vector3();
  private encounterElapsed = 0;
  private readonly encounterDuration = 1.2;
  private onReadyForEditorCallback: (() => void) | null = null;

  private hatchElapsed = 0;
  private readonly hatchDuration = 1.2;
  private heartbeatSoundPlayed = false;
  private onBurstEggCallback: (() => void) | null = null;
  private onHatchFinishedCallback: (() => void) | null = null;

  private eggShellGeo: THREE.SphereGeometry | null = null;
  private eggShellMat: THREE.MeshPhysicalMaterial | null = null;
  private eggCoreGeo: THREE.SphereGeometry | null = null;
  private eggCoreMat: THREE.MeshStandardMaterial | null = null;

  constructor(
    scene: THREE.Scene,
    cameraController: CameraController,
    sceneEnvironment: SceneEnvironment
  ) {
    this.scene = scene;
    this.cameraController = cameraController;
    this.sceneEnvironment = sceneEnvironment;
  }

  /**
   * Cinemática de Unión Fluida (1.2s):
   * - Bloquea controles del jugador.
   * - Enfoca la cámara en un plano cinemático lateral suave.
   * - Alinea ambas células en paralelo y las hace nadar juntas hacia adelante con destello bioluminiscente (sin huevo previo).
   * - Al cumplirse 1.2s, abre directamente el Taller Evolutivo (CreatureEditorModal) y prepara el huevo para la eclosión al salir.
   */
  public playMatingEncounter(
    player: PlayerCell,
    mate: KinCellEntity,
    onReadyForEditor: () => void
  ): void {
    if (this.isCinematicPlaying) return;
    this.clearEggMesh();

    this.isCinematicPlaying = true;
    this.isHatching = false;
    this.playerControlsLocked = true;
    this.encounterElapsed = 0;
    this.encounterPlayer = player;
    this.encounterMate = mate;
    this.onReadyForEditorCallback = onReadyForEditor;

    player.controlsLocked = true;
    player.currentSpeed = 0;
    mate.isMateReceptive = false;

    // 1. Orientar a ambas células mirando en paralelo hacia la misma dirección de avance
    const sharedHeading = player.headingAngle;
    player.mesh.rotation.y = sharedHeading;
    mate.targetHeading = sharedHeading;
    mate.mesh.rotation.y = sharedHeading;

    // Vector de avance frontal (en PlayerCell, headingAngle = 0 apunta hacia -Z)
    this.encounterForward
      .set(-Math.sin(sharedHeading), 0, -Math.cos(sharedHeading))
      .normalize();

    // Colocar a la pareja suavemente en paralelo junto al jugador para que naden codo con codo sin solaparse
    const rightX = -this.encounterForward.z;
    const rightZ = this.encounterForward.x;
    const lateralDistance = 1.45;
    mate.position.set(
      player.position.x + rightX * lateralDistance,
      GAME_CONFIG.WORLD.SWIM_PLANE_Y,
      player.position.z + rightZ * lateralDistance
    );
    mate.mesh.position.copy(mate.position);

    // 2. Enfocar cámara suavemente en plano medio entre el jugador y su pareja
    const midpoint = player.position.clone().lerp(mate.position, 0.5);
    midpoint.y = GAME_CONFIG.WORLD.SWIM_PLANE_Y;
    this.cameraController.setCinematicTarget(midpoint, this.encounterDuration);

    // 3. Emitir destello bioluminiscente de partículas de apareamiento y acorde armónico
    this.sceneEnvironment.spawnMatingHeartsOrGlow(midpoint, '#38bdf8');
    audioManager.playSound('mating_success_jingle');
  }

  public startMatingDance(
    player: PlayerCell,
    mate: KinCellEntity,
    onEggLaid: () => void
  ): void {
    this.playMatingEncounter(player, mate, onEggLaid);
  }

  private preparePostEditorEggAt(center: THREE.Vector3): void {
    this.clearEggMesh();
    this.eggPosition.copy(center);
    this.eggPosition.y = GAME_CONFIG.WORLD.SWIM_PLANE_Y;

    this.eggMesh = new THREE.Group();
    this.eggShellGeo = new THREE.SphereGeometry(1.2, 24, 20);
    this.eggShellGeo.scale(1.0, 1.35, 1.0);

    this.eggShellMat = new THREE.MeshPhysicalMaterial({
      color: 0x67e8f9,
      emissive: 0x0891b2,
      emissiveIntensity: 0.45,
      transmission: 0.85,
      opacity: 0.9,
      transparent: true,
      roughness: 0.1,
      ior: 1.4,
      thickness: 1.5,
    });

    const shell = new THREE.Mesh(this.eggShellGeo, this.eggShellMat);
    this.eggMesh.add(shell);

    this.eggCoreGeo = new THREE.SphereGeometry(0.52, 16, 14);
    this.eggCoreGeo.scale(1.0, 1.2, 1.0);
    this.eggCoreMat = new THREE.MeshStandardMaterial({
      color: 0xa5f3fc,
      emissive: 0x22d3ee,
      emissiveIntensity: 1.4,
      roughness: 0.25,
    });
    const core = new THREE.Mesh(this.eggCoreGeo, this.eggCoreMat);
    this.eggMesh.add(core);

    const innerLight = new THREE.PointLight(0x22d3ee, 2.2, 12);
    this.eggMesh.add(innerLight);

    this.eggMesh.position.copy(this.eggPosition);
    this.eggMesh.visible = false; // Oculto durante el taller; aparece al salir para la eclosión
    this.scene.add(this.eggMesh);
  }

  /**
   * Al confirmar los cambios en el Taller Evolutivo (closeEditor),
   * reproduce el latido acelerado del huevo y la eclosión explosiva de la nueva generación.
   */
  public playHatchingSequence(
    onBurstEgg: () => void,
    onFinished: () => void
  ): void {
    if (!this.eggMesh) {
      onFinished();
      return;
    }

    this.isCinematicPlaying = false;
    this.isHatching = true;
    this.hatchElapsed = 0;
    this.heartbeatSoundPlayed = false;
    this.onBurstEggCallback = onBurstEgg;
    this.onHatchFinishedCallback = onFinished;

    this.eggMesh.visible = true;
    this.eggMesh.scale.setScalar(1.0);
    audioManager.playSFX('egg_heartbeat');
  }

  public update(delta: number, _elapsedTime: number): void {
    const safeDelta = Math.min(Math.max(delta, 0.001), 0.05);

    if (this.isCinematicPlaying) {
      this.encounterElapsed += safeDelta;
      const swimSpeed = 5.0;

      // Ambas células nadan suavemente hacia adelante en paralelo hacia el horizonte
      if (this.encounterPlayer) {
        this.encounterPlayer.position.addScaledVector(
          this.encounterForward,
          swimSpeed * safeDelta
        );
        this.encounterPlayer.position.y = GAME_CONFIG.WORLD.SWIM_PLANE_Y;
        this.encounterPlayer.group.position.copy(this.encounterPlayer.position);
      }

      if (this.encounterMate) {
        this.encounterMate.position.addScaledVector(
          this.encounterForward,
          swimSpeed * safeDelta
        );
        this.encounterMate.position.y = GAME_CONFIG.WORLD.SWIM_PLANE_Y;
        this.encounterMate.mesh.position.copy(this.encounterMate.position);
      }

      if (this.encounterElapsed >= this.encounterDuration) {
        this.isCinematicPlaying = false;
        this.playerControlsLocked = false;

        // Preparar el huevo pos-taller en el punto final de unión
        const finalMidpoint = new THREE.Vector3();
        if (this.encounterPlayer && this.encounterMate) {
          finalMidpoint
            .copy(this.encounterPlayer.position)
            .lerp(this.encounterMate.position, 0.5);
        } else if (this.encounterPlayer) {
          finalMidpoint.copy(this.encounterPlayer.position);
        }
        this.preparePostEditorEggAt(finalMidpoint);

        const cb = this.onReadyForEditorCallback;
        this.onReadyForEditorCallback = null;
        this.encounterPlayer = null;
        this.encounterMate = null;
        if (cb) cb();
      }
      return;
    }

    if (this.isHatching && this.eggMesh) {
      this.hatchElapsed += safeDelta;
      const t = Math.min(1.0, this.hatchElapsed / this.hatchDuration);

      if (!this.heartbeatSoundPlayed && t >= 0.48) {
        this.heartbeatSoundPlayed = true;
        audioManager.playSFX('egg_heartbeat');
      }

      // Latido acelerado (pum-pum) antes de romper el cascarón
      const pulseFreq = THREE.MathUtils.lerp(8.0, 22.0, t);
      const pulseAmp = THREE.MathUtils.lerp(0.08, 0.24, t);
      const baseScale =
        1.0 + t * 0.28 + Math.sin(this.hatchElapsed * pulseFreq) * pulseAmp;
      this.eggMesh.scale.set(
        baseScale,
        baseScale * (1.0 + Math.cos(this.hatchElapsed * pulseFreq) * 0.06),
        baseScale
      );
      this.eggMesh.rotation.z = Math.sin(this.hatchElapsed * 28.0) * 0.08 * t;

      if (this.eggShellMat) {
        this.eggShellMat.emissiveIntensity = 0.45 + t * 1.8;
      }

      if (t >= 1.0) {
        this.isHatching = false;
        audioManager.playSFX('egg_hatch_burst');

        const burstCb = this.onBurstEggCallback;
        const finishCb = this.onHatchFinishedCallback;
        this.onBurstEggCallback = null;
        this.onHatchFinishedCallback = null;

        if (burstCb) burstCb();
        this.clearEggMesh();
        if (finishCb) finishCb();
      }
    }
  }

  public clearEggMesh(): void {
    if (this.eggMesh) {
      this.scene.remove(this.eggMesh);
      this.eggMesh = null;
    }
    if (this.eggShellGeo) {
      this.eggShellGeo.dispose();
      this.eggShellGeo = null;
    }
    if (this.eggShellMat) {
      this.eggShellMat.dispose();
      this.eggShellMat = null;
    }
    if (this.eggCoreGeo) {
      this.eggCoreGeo.dispose();
      this.eggCoreGeo = null;
    }
    if (this.eggCoreMat) {
      this.eggCoreMat.dispose();
      this.eggCoreMat = null;
    }
  }
}

