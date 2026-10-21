import * as THREE from 'three';
import { GAME_CONFIG } from './config';
import { PredatorBehaviorState, PredatorTelemetry } from './types';

interface PredatorEntity {
  id: number;
  group: THREE.Group;
  position: THREE.Vector3;
  headingAngle: number;
  currentSpeed: number;
  state: PredatorBehaviorState;
  wanderTarget: THREE.Vector3;
  wanderRetargetTimer: number;
  attackCooldown: number;
  lungeTimer: number;
  swimPhase: number;
  mandibleLeft: THREE.Mesh;
  mandibleRight: THREE.Mesh;
  tailSegments: THREE.Mesh[];
  stateRingMat: THREE.MeshBasicMaterial;
  coreMat: THREE.MeshStandardMaterial;
}

const _toTarget = new THREE.Vector3();
const _forward = new THREE.Vector3();

export class PredatorManager {
  private readonly predators: PredatorEntity[] = [];
  private readonly telemetryCache: PredatorTelemetry[] = [];
  private readonly sharedGeometries: THREE.BufferGeometry[] = [];
  private readonly disposableMaterials: THREE.Material[] = [];

  constructor(scene: THREE.Scene) {
    this.initSharedAssets();
    this.spawnPredators(scene);
  }

  private initSharedAssets(): void {
    // 0: Body carapace
    const bodyGeo = new THREE.ConeGeometry(1.15, 2.75, 16);
    bodyGeo.rotateX(-Math.PI / 2);
    bodyGeo.scale(1.05, 0.72, 1.0);

    // 1: Inner predatory core
    const coreGeo = new THREE.OctahedronGeometry(0.62, 1);

    // 2: Sharp mandible pincer
    const mandibleGeo = new THREE.ConeGeometry(0.22, 0.95, 8);
    mandibleGeo.rotateX(-Math.PI / 2);

    // 3: Dorsal spine
    const spineGeo = new THREE.ConeGeometry(0.16, 0.65, 6);

    // 4: Hunter eye
    const eyeGeo = new THREE.SphereGeometry(0.2, 12, 12);

    // 5: Tail segment
    const tailGeo = new THREE.SphereGeometry(0.26, 10, 10);
    tailGeo.scale(0.8, 0.8, 1.5);

    // 6: Tactical state indicator ring under predator
    const ringGeo = new THREE.RingGeometry(1.3, 1.68, 32);
    ringGeo.rotateX(-Math.PI / 2);

    this.sharedGeometries.push(
      bodyGeo,
      coreGeo,
      mandibleGeo,
      spineGeo,
      eyeGeo,
      tailGeo,
      ringGeo
    );
  }

  private spawnPredators(scene: THREE.Scene): void {
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x9f1239,
      emissive: 0x4c0519,
      emissiveIntensity: 0.35,
      roughness: 0.28,
      metalness: 0.15,
      clearcoat: 0.85,
      transparent: true,
      opacity: 0.92,
    });

    const mandibleMat = new THREE.MeshStandardMaterial({
      color: 0xfda4af,
      emissive: 0xe11d48,
      emissiveIntensity: 0.3,
      roughness: 0.25,
      metalness: 0.5,
    });

    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.2,
      roughness: 0.1,
    });

    this.disposableMaterials.push(bodyMat, mandibleMat, eyeMat);

    for (let i = 0; i < GAME_CONFIG.PREDATOR.COUNT; i++) {
      const group = new THREE.Group();

      // 1. Primary Carapace
      const bodyMesh = new THREE.Mesh(this.sharedGeometries[0], bodyMat);
      bodyMesh.castShadow = true;
      bodyMesh.receiveShadow = true;
      group.add(bodyMesh);

      // 2. Pulsing Core
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0xfb7185,
        emissive: 0xf43f5e,
        emissiveIntensity: 0.8,
        roughness: 0.35,
      });
      this.disposableMaterials.push(coreMat);
      const coreMesh = new THREE.Mesh(this.sharedGeometries[1], coreMat);
      coreMesh.position.set(0, 0.05, 0.2);
      group.add(coreMesh);

      // 3. Left & Right Spiked Mandibles (at front -Z)
      const mandibleLeft = new THREE.Mesh(
        this.sharedGeometries[2],
        mandibleMat
      );
      mandibleLeft.position.set(-0.48, -0.05, -1.35);
      mandibleLeft.rotation.y = -0.25;
      group.add(mandibleLeft);

      const mandibleRight = new THREE.Mesh(
        this.sharedGeometries[2],
        mandibleMat
      );
      mandibleRight.position.set(0.48, -0.05, -1.35);
      mandibleRight.rotation.y = 0.25;
      group.add(mandibleRight);

      // 4. Dorsal Spines (3 spikes along ridge)
      for (let s = 0; s < 3; s++) {
        const spine = new THREE.Mesh(this.sharedGeometries[3], mandibleMat);
        spine.position.set(0, 0.65 - s * 0.08, -0.3 + s * 0.55);
        spine.rotation.x = -0.35;
        group.add(spine);
      }

      // 5. Predator Eyes
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(this.sharedGeometries[4], eyeMat);
        eye.position.set(side * 0.52, 0.28, -0.82);
        group.add(eye);
      }

      // 6. Segmented Propulsion Tail (3 segments)
      const tailSegments: THREE.Mesh[] = [];
      for (let t = 0; t < 3; t++) {
        const tailSeg = new THREE.Mesh(this.sharedGeometries[5], bodyMat);
        const sFactor = 1 - t * 0.22;
        tailSeg.scale.setScalar(sFactor);
        tailSeg.position.set(0, 0, 1.45 + t * 0.45);
        group.add(tailSeg);
        tailSegments.push(tailSeg);
      }

      // 7. State Indicator Ring underneath (DEAMBULAR = Amber/Slate, PERSEGUIR = Orange, ATACAR = Red)
      const stateRingMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      this.disposableMaterials.push(stateRingMat);
      const ringMesh = new THREE.Mesh(this.sharedGeometries[6], stateRingMat);
      ringMesh.position.y = -0.95;
      group.add(ringMesh);

      scene.add(group);

      const entity: PredatorEntity = {
        id: i + 1,
        group,
        position: group.position,
        headingAngle: Math.random() * Math.PI * 2,
        currentSpeed: GAME_CONFIG.PREDATOR.WANDER_SPEED,
        state: 'DEAMBULAR',
        wanderTarget: new THREE.Vector3(),
        wanderRetargetTimer: 0,
        attackCooldown: 0,
        lungeTimer: 0,
        swimPhase: i * 1.3,
        mandibleLeft,
        mandibleRight,
        tailSegments,
        stateRingMat,
        coreMat,
      };

      this.predators.push(entity);
      this.telemetryCache.push({
        id: entity.id,
        state: 'DEAMBULAR',
        distanceToPlayer: 999,
      });
    }

    this.resetAll();
  }

  private pickWanderTarget(entity: PredatorEntity): void {
    const minR = 12;
    const maxR = GAME_CONFIG.WORLD.ARENA_RADIUS - 10;
    const r = minR + Math.random() * (maxR - minR);
    const angle = Math.random() * Math.PI * 2;
    entity.wanderTarget.set(
      Math.cos(angle) * r,
      GAME_CONFIG.WORLD.SWIM_PLANE_Y,
      Math.sin(angle) * r
    );
    entity.wanderRetargetTimer = 4.0 + Math.random() * 4.5;
  }

  public resetAll(): void {
    const count = this.predators.length;
    for (let i = 0; i < count; i++) {
      const entity = this.predators[i];
      const angle = (i / count) * Math.PI * 2 + 0.4;
      const radius =
        GAME_CONFIG.PREDATOR.MIN_SPAWN_DIST_FROM_PLAYER +
        (i % 3) * 16 +
        Math.random() * 8;

      entity.position.set(
        Math.cos(angle) * radius,
        GAME_CONFIG.WORLD.SWIM_PLANE_Y,
        Math.sin(angle) * radius
      );
      entity.headingAngle = angle + Math.PI / 2;
      entity.currentSpeed = GAME_CONFIG.PREDATOR.WANDER_SPEED;
      entity.state = 'DEAMBULAR';
      entity.attackCooldown = 0;
      entity.lungeTimer = 0;
      this.pickWanderTarget(entity);
      entity.group.rotation.set(0, entity.headingAngle, 0);
    }
  }

  public update(
    delta: number,
    elapsedTime: number,
    playerPosition: THREE.Vector3,
    canCounterAttack = false
  ): {
    totalDamageDealt: number;
    attackerPosition: THREE.Vector3 | null;
    repelledPredators: number;
    telemetry: PredatorTelemetry[];
    nearestState: PredatorBehaviorState;
    nearestDistance: number;
  } {
    let totalDamageDealt = 0;
    let attackerPosition: THREE.Vector3 | null = null;
    let repelledPredators = 0;
    let nearestDistance = Infinity;
    let nearestState: PredatorBehaviorState = 'DEAMBULAR';

    for (let i = 0; i < this.predators.length; i++) {
      const p = this.predators[i];

      if (p.attackCooldown > 0) {
        p.attackCooldown = Math.max(0, p.attackCooldown - delta);
      }
      if (p.lungeTimer > 0) {
        p.lungeTimer = Math.max(0, p.lungeTimer - delta);
      }

      const dxToPlayer = playerPosition.x - p.position.x;
      const dzToPlayer = playerPosition.z - p.position.z;
      const distToPlayer = Math.sqrt(
        dxToPlayer * dxToPlayer + dzToPlayer * dzToPlayer
      );

      // Counter-attack check: if player has rostral_spines and is boosting within < 3.4m
      if (canCounterAttack && distToPlayer < 3.4 && p.attackCooldown <= 1.6) {
        const pushDirX = distToPlayer > 0.01 ? -dxToPlayer / distToPlayer : 1;
        const pushDirZ = distToPlayer > 0.01 ? -dzToPlayer / distToPlayer : 0;

        p.position.x += pushDirX * 7.5;
        p.position.z += pushDirZ * 7.5;
        p.headingAngle = Math.atan2(-pushDirX, -pushDirZ);
        p.state = 'DEAMBULAR';
        p.attackCooldown = 2.6;
        p.lungeTimer = 0;
        p.wanderTarget.set(
          p.position.x + pushDirX * 28,
          GAME_CONFIG.WORLD.SWIM_PLANE_Y,
          p.position.z + pushDirZ * 28
        );
        p.wanderRetargetTimer = 4.5;
        repelledPredators++;
        continue;
      }

      // --- FINITE STATE MACHINE TRANSITIONS ---
      switch (p.state) {
        case 'DEAMBULAR':
          // Wait until retreat cooldown finishes before re-engaging
          if (
            p.attackCooldown <= 1.5 &&
            distToPlayer <= GAME_CONFIG.PREDATOR.DETECTION_RADIUS
          ) {
            p.state = 'PERSEGUIR';
          }
          break;

        case 'PERSEGUIR':
          if (distToPlayer <= GAME_CONFIG.PREDATOR.ATTACK_RANGE) {
            p.state = 'ATACAR';
          } else if (distToPlayer > GAME_CONFIG.PREDATOR.LOSE_INTEREST_RADIUS) {
            p.state = 'DEAMBULAR';
            this.pickWanderTarget(p);
          }
          break;

        case 'ATACAR':
          if (distToPlayer > GAME_CONFIG.PREDATOR.ATTACK_RANGE * 1.35) {
            p.state =
              distToPlayer <= GAME_CONFIG.PREDATOR.LOSE_INTEREST_RADIUS
                ? 'PERSEGUIR'
                : 'DEAMBULAR';
          }
          break;
      }

      // --- STATE ACTIONS & STEERING ---
      let targetSpeed: number = GAME_CONFIG.PREDATOR.WANDER_SPEED;

      if (p.state === 'DEAMBULAR') {
        p.wanderRetargetTimer -= delta;
        _toTarget.subVectors(p.wanderTarget, p.position);
        _toTarget.y = 0;

        if (_toTarget.lengthSq() < 16.0 || p.wanderRetargetTimer <= 0) {
          this.pickWanderTarget(p);
          _toTarget.subVectors(p.wanderTarget, p.position);
          _toTarget.y = 0;
        }

        targetSpeed = GAME_CONFIG.PREDATOR.WANDER_SPEED;
        p.stateRingMat.color.setHex(0xf59e0b);
        p.stateRingMat.opacity = 0.2;
        p.coreMat.emissiveIntensity = 0.6;
      } else if (p.state === 'PERSEGUIR') {
        _toTarget.subVectors(playerPosition, p.position);
        _toTarget.y = 0;
        targetSpeed = GAME_CONFIG.PREDATOR.CHASE_SPEED;

        p.stateRingMat.color.setHex(0xf97316);
        p.stateRingMat.opacity = 0.52;
        p.coreMat.emissiveIntensity = 1.25;
      } else {
        // ATACAR
        _toTarget.subVectors(playerPosition, p.position);
        _toTarget.y = 0;
        targetSpeed =
          p.lungeTimer > 0
            ? GAME_CONFIG.PREDATOR.CHASE_SPEED * 1.35
            : GAME_CONFIG.PREDATOR.WANDER_SPEED * 0.65;

        p.stateRingMat.color.setHex(0xef4444);
        p.stateRingMat.opacity = 0.82;
        p.coreMat.emissiveIntensity = 1.8;

        if (
          p.attackCooldown <= 0 &&
          distToPlayer <= GAME_CONFIG.PREDATOR.ATTACK_RANGE
        ) {
          totalDamageDealt += GAME_CONFIG.PREDATOR.ATTACK_DAMAGE;
          attackerPosition = p.position;
          p.attackCooldown = GAME_CONFIG.PREDATOR.ATTACK_COOLDOWN_SEC;
          p.lungeTimer = 0.28;
        }
      }

      // Smoothly rotate headingAngle toward _toTarget
      if (_toTarget.lengthSq() > 0.001) {
        const desiredHeading = Math.atan2(-_toTarget.x, -_toTarget.z);
        let angleDiff = desiredHeading - p.headingAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        p.headingAngle +=
          angleDiff * Math.min(1, GAME_CONFIG.PREDATOR.TURN_DAMPING * delta);
      }

      p.currentSpeed = THREE.MathUtils.damp(
        p.currentSpeed,
        targetSpeed,
        5.0,
        delta
      );

      _forward.set(-Math.sin(p.headingAngle), 0, -Math.cos(p.headingAngle));
      p.position.addScaledVector(_forward, p.currentSpeed * delta);

      // Keep within arena bounds
      const rSq = p.position.x * p.position.x + p.position.z * p.position.z;
      const maxR = GAME_CONFIG.WORLD.ARENA_RADIUS - 2.0;
      if (rSq > maxR * maxR) {
        const r = Math.sqrt(rSq);
        p.position.x = (p.position.x / r) * maxR;
        p.position.z = (p.position.z / r) * maxR;
        this.pickWanderTarget(p);
      }

      p.position.y =
        GAME_CONFIG.WORLD.SWIM_PLANE_Y +
        Math.sin(elapsedTime * 2.6 + p.id) * 0.14;
      p.group.rotation.set(0, p.headingAngle, 0);

      // Animate tail & mandibles
      const swimMultiplier = p.state === 'DEAMBULAR' ? 7.0 : 14.5;
      p.swimPhase += delta * swimMultiplier;

      for (let t = 0; t < p.tailSegments.length; t++) {
        const seg = p.tailSegments[t];
        const wave = Math.sin(p.swimPhase - t * 0.9);
        seg.position.x = wave * (0.14 + t * 0.1);
      }

      const jawSnap =
        p.lungeTimer > 0
          ? 0.45
          : Math.sin(p.swimPhase * 0.8) * (p.state === 'DEAMBULAR' ? 0.08 : 0.22);
      p.mandibleLeft.rotation.y = -0.22 + jawSnap;
      p.mandibleRight.rotation.y = 0.22 - jawSnap;

      // Update telemetry cache
      this.telemetryCache[i].state = p.state;
      this.telemetryCache[i].distanceToPlayer = distToPlayer;

      if (distToPlayer < nearestDistance) {
        nearestDistance = distToPlayer;
        nearestState = p.state;
      }
    }

    return {
      totalDamageDealt,
      attackerPosition,
      repelledPredators,
      telemetry: this.telemetryCache,
      nearestState,
      nearestDistance,
    };
  }

  public dispose(): void {
    for (const geo of this.sharedGeometries) {
      geo.dispose();
    }
    for (const mat of this.disposableMaterials) {
      mat.dispose();
    }
  }
}
