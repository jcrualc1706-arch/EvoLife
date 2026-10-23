import * as THREE from 'three';
import { GAME_CONFIG } from './config';
import {
  PoisonCloudHazard,
  PredatorBehaviorState,
  PredatorTelemetry,
  SpeciesType,
} from './types';

interface SpeciesProfile {
  species: SpeciesType;
  name: string;
  count: number;
  wanderSpeed: number;
  activeSpeed: number; // Chase speed for predators, flee speed for herbivores
  detectionRadius: number;
  loseInterestRadius: number;
  attackRange: number;
  attackDamage: number;
  attackCooldownSec: number;
  scaleMultiplier: number;
}

const SPECIES_PROFILES: Record<SpeciesType, SpeciesProfile> = {
  hunter: {
    species: 'hunter',
    name: 'Mandíbula Rápida',
    count: 5,
    wanderSpeed: GAME_CONFIG.PREDATOR.WANDER_SPEED, // 5.8
    activeSpeed: GAME_CONFIG.PREDATOR.CHASE_SPEED, // 11.4
    detectionRadius: GAME_CONFIG.PREDATOR.DETECTION_RADIUS, // 25.0
    loseInterestRadius: GAME_CONFIG.PREDATOR.LOSE_INTEREST_RADIUS, // 33.5
    attackRange: GAME_CONFIG.PREDATOR.ATTACK_RANGE, // 3.1
    attackDamage: GAME_CONFIG.PREDATOR.ATTACK_DAMAGE, // 18
    attackCooldownSec: GAME_CONFIG.PREDATOR.ATTACK_COOLDOWN_SEC, // 1.5
    scaleMultiplier: 1.0,
  },
  leviathan: {
    species: 'leviathan',
    name: 'Megacélula Acorazada',
    count: 2,
    wanderSpeed: 4.2,
    activeSpeed: 8.5,
    detectionRadius: 19.5,
    loseInterestRadius: 27.5,
    attackRange: 3.6,
    attackDamage: 28,
    attackCooldownSec: 1.8,
    scaleMultiplier: 1.45,
  },
  herbivore: {
    species: 'herbivore',
    name: 'Célula Filtradora',
    count: 6,
    wanderSpeed: 5.2,
    activeSpeed: 9.8, // Flee speed
    detectionRadius: 14.0, // Flee trigger radius (< 14m)
    loseInterestRadius: 20.5,
    attackRange: 0,
    attackDamage: 0,
    attackCooldownSec: 0,
    scaleMultiplier: 0.85,
  },
};

interface OrganismEntity {
  id: number;
  species: SpeciesType;
  speciesName: string;
  profile: SpeciesProfile;
  group: THREE.Group;
  position: THREE.Vector3;
  headingAngle: number;
  currentSpeed: number;
  state: PredatorBehaviorState;
  active: boolean;
  respawnTimer: number;
  stunTimer: number;
  poisonTimer: number;
  wanderTarget: THREE.Vector3;
  wanderRetargetTimer: number;
  attackCooldown: number;
  lungeTimer: number;
  swimPhase: number;
  mandibleLeft: THREE.Mesh | null;
  mandibleRight: THREE.Mesh | null;
  tailSegments: THREE.Mesh[];
  stateRingMat: THREE.MeshBasicMaterial;
  coreMat: THREE.MeshStandardMaterial;
}

const _toTarget = new THREE.Vector3();
const _forward = new THREE.Vector3();

export class PredatorManager {
  private readonly organisms: OrganismEntity[] = [];
  private readonly telemetryCache: PredatorTelemetry[] = [];
  private readonly sharedGeometries: THREE.BufferGeometry[] = [];
  private readonly disposableMaterials: THREE.Material[] = [];

  // Shared Geometries
  private predatorBodyGeo!: THREE.BufferGeometry;
  private predatorCoreGeo!: THREE.BufferGeometry;
  private mandibleGeo!: THREE.BufferGeometry;
  private spineGeo!: THREE.BufferGeometry;
  private eyeGeo!: THREE.BufferGeometry;
  private tailGeo!: THREE.BufferGeometry;
  private ringGeo!: THREE.BufferGeometry;
  private leviathanPlateGeo!: THREE.BufferGeometry;
  private herbivoreBodyGeo!: THREE.BufferGeometry;
  private herbivoreCiliaGeo!: THREE.BufferGeometry;

  // Shared Static Materials
  private hunterBodyMat!: THREE.MeshPhysicalMaterial;
  private hunterMandibleMat!: THREE.MeshStandardMaterial;
  private leviathanBodyMat!: THREE.MeshPhysicalMaterial;
  private leviathanMandibleMat!: THREE.MeshStandardMaterial;
  private herbivoreBodyMat!: THREE.MeshPhysicalMaterial;
  private herbivoreCiliaMat!: THREE.MeshStandardMaterial;
  private predatorEyeMat!: THREE.MeshStandardMaterial;
  private herbivoreEyeMat!: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.initSharedAssets();
    this.spawnEcosystem(scene);
  }

  private initSharedAssets(): void {
    // 0: Predator Body carapace
    this.predatorBodyGeo = new THREE.ConeGeometry(1.15, 2.75, 16);
    this.predatorBodyGeo.rotateX(-Math.PI / 2);
    this.predatorBodyGeo.scale(1.05, 0.72, 1.0);

    // 1: Inner core
    this.predatorCoreGeo = new THREE.OctahedronGeometry(0.62, 1);

    // 2: Sharp mandible pincer
    this.mandibleGeo = new THREE.ConeGeometry(0.22, 0.95, 8);
    this.mandibleGeo.rotateX(-Math.PI / 2);

    // 3: Dorsal spine
    this.spineGeo = new THREE.ConeGeometry(0.16, 0.65, 6);

    // 4: Eye sphere
    this.eyeGeo = new THREE.SphereGeometry(0.2, 12, 12);

    // 5: Tail segment
    this.tailGeo = new THREE.SphereGeometry(0.26, 10, 10);
    this.tailGeo.scale(0.8, 0.8, 1.5);

    // 6: Tactical state indicator ring
    this.ringGeo = new THREE.RingGeometry(1.3, 1.68, 32);
    this.ringGeo.rotateX(-Math.PI / 2);

    // 7: Leviathan heavy dorsal armor plate
    this.leviathanPlateGeo = new THREE.DodecahedronGeometry(0.55, 0);
    this.leviathanPlateGeo.scale(1.4, 0.45, 1.1);

    // 8: Herbivore ovoid filter body
    this.herbivoreBodyGeo = new THREE.CapsuleGeometry(0.95, 0.65, 14, 20);
    this.herbivoreBodyGeo.rotateX(Math.PI / 2);

    // 9: Herbivore lateral filter cilia
    this.herbivoreCiliaGeo = new THREE.CylinderGeometry(0.05, 0.12, 0.65, 6);
    this.herbivoreCiliaGeo.rotateZ(Math.PI / 2);

    this.sharedGeometries.push(
      this.predatorBodyGeo,
      this.predatorCoreGeo,
      this.mandibleGeo,
      this.spineGeo,
      this.eyeGeo,
      this.tailGeo,
      this.ringGeo,
      this.leviathanPlateGeo,
      this.herbivoreBodyGeo,
      this.herbivoreCiliaGeo
    );

    // Shared Materials
    this.hunterBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x9f1239,
      emissive: 0x4c0519,
      emissiveIntensity: 0.35,
      roughness: 0.28,
      metalness: 0.15,
      clearcoat: 0.85,
      transparent: true,
      opacity: 0.92,
    });

    this.hunterMandibleMat = new THREE.MeshStandardMaterial({
      color: 0xfda4af,
      emissive: 0xe11d48,
      emissiveIntensity: 0.3,
      roughness: 0.25,
      metalness: 0.5,
    });

    this.leviathanBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x581c87,
      emissive: 0x3b0764,
      emissiveIntensity: 0.45,
      roughness: 0.22,
      metalness: 0.3,
      clearcoat: 0.9,
      transparent: true,
      opacity: 0.95,
    });

    this.leviathanMandibleMat = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0x9333ea,
      emissiveIntensity: 0.45,
      roughness: 0.2,
      metalness: 0.65,
    });

    this.herbivoreBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x2dd4bf,
      emissive: 0x0d9488,
      emissiveIntensity: 0.3,
      roughness: 0.15,
      metalness: 0.05,
      transmission: 0.6,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.86,
    });

    this.herbivoreCiliaMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xeab308,
      emissiveIntensity: 0.4,
      roughness: 0.4,
    });

    this.predatorEyeMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.2,
      roughness: 0.1,
    });

    this.herbivoreEyeMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.5,
      roughness: 0.15,
    });

    this.disposableMaterials.push(
      this.hunterBodyMat,
      this.hunterMandibleMat,
      this.leviathanBodyMat,
      this.leviathanMandibleMat,
      this.herbivoreBodyMat,
      this.herbivoreCiliaMat,
      this.predatorEyeMat,
      this.herbivoreEyeMat
    );
  }

  private spawnEcosystem(scene: THREE.Scene): void {
    const spawnOrder: SpeciesType[] = [
      ...Array(SPECIES_PROFILES.hunter.count).fill('hunter'),
      ...Array(SPECIES_PROFILES.leviathan.count).fill('leviathan'),
      ...Array(SPECIES_PROFILES.herbivore.count).fill('herbivore'),
    ];

    for (let i = 0; i < spawnOrder.length; i++) {
      const speciesType = spawnOrder[i];
      const profile = SPECIES_PROFILES[speciesType];
      const group = new THREE.Group();
      group.scale.setScalar(profile.scaleMultiplier);

      let mandibleLeft: THREE.Mesh | null = null;
      let mandibleRight: THREE.Mesh | null = null;
      const tailSegments: THREE.Mesh[] = [];

      const coreMat = new THREE.MeshStandardMaterial({
        color:
          speciesType === 'hunter'
            ? 0xfb7185
            : speciesType === 'leviathan'
            ? 0xd8b4fe
            : 0xfacc15,
        emissive:
          speciesType === 'hunter'
            ? 0xf43f5e
            : speciesType === 'leviathan'
            ? 0xa855f7
            : 0xeab308,
        emissiveIntensity: 0.85,
        roughness: 0.35,
      });
      this.disposableMaterials.push(coreMat);

      if (speciesType === 'hunter' || speciesType === 'leviathan') {
        const isLeviathan = speciesType === 'leviathan';
        const bodyMat = isLeviathan
          ? this.leviathanBodyMat
          : this.hunterBodyMat;
        const accentMat = isLeviathan
          ? this.leviathanMandibleMat
          : this.hunterMandibleMat;

        // 1. Primary Carapace
        const bodyMesh = new THREE.Mesh(this.predatorBodyGeo, bodyMat);
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
        group.add(bodyMesh);

        // 2. Pulsing Core
        const coreMesh = new THREE.Mesh(this.predatorCoreGeo, coreMat);
        coreMesh.position.set(0, 0.05, 0.2);
        group.add(coreMesh);

        // 3. Left & Right Spiked Mandibles (at front -Z)
        mandibleLeft = new THREE.Mesh(this.mandibleGeo, accentMat);
        mandibleLeft.position.set(isLeviathan ? -0.56 : -0.48, -0.05, -1.35);
        mandibleLeft.rotation.y = -0.25;
        if (isLeviathan) mandibleLeft.scale.set(1.35, 1.2, 1.25);
        group.add(mandibleLeft);

        mandibleRight = new THREE.Mesh(this.mandibleGeo, accentMat);
        mandibleRight.position.set(isLeviathan ? 0.56 : 0.48, -0.05, -1.35);
        mandibleRight.rotation.y = 0.25;
        if (isLeviathan) mandibleRight.scale.set(1.35, 1.2, 1.25);
        group.add(mandibleRight);

        // 4. Dorsal Spines or Heavy Armor Plates
        if (isLeviathan) {
          for (let s = 0; s < 3; s++) {
            const plate = new THREE.Mesh(this.leviathanPlateGeo, accentMat);
            plate.position.set(0, 0.58 - s * 0.05, -0.35 + s * 0.62);
            group.add(plate);
          }
        } else {
          for (let s = 0; s < 3; s++) {
            const spine = new THREE.Mesh(this.spineGeo, accentMat);
            spine.position.set(0, 0.65 - s * 0.08, -0.3 + s * 0.55);
            spine.rotation.x = -0.35;
            group.add(spine);
          }
        }

        // 5. Predator Eyes
        for (const side of [-1, 1]) {
          const eye = new THREE.Mesh(this.eyeGeo, this.predatorEyeMat);
          eye.position.set(side * 0.52, 0.28, -0.82);
          group.add(eye);
        }

        // 6. Segmented Propulsion Tail (3 segments)
        for (let t = 0; t < 3; t++) {
          const tailSeg = new THREE.Mesh(this.tailGeo, bodyMat);
          const sFactor = 1 - t * 0.22;
          tailSeg.scale.setScalar(sFactor);
          tailSeg.position.set(0, 0, 1.45 + t * 0.45);
          group.add(tailSeg);
          tailSegments.push(tailSeg);
        }
      } else {
        // HERBIVORE ("Célula Filtradora"): Rounded turquoise-gold filter organism
        const bodyMesh = new THREE.Mesh(
          this.herbivoreBodyGeo,
          this.herbivoreBodyMat
        );
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
        group.add(bodyMesh);

        const coreMesh = new THREE.Mesh(this.predatorCoreGeo, coreMat);
        coreMesh.scale.setScalar(0.85);
        coreMesh.position.set(0, 0, 0);
        group.add(coreMesh);

        // Peaceful wide-set sensory eyes
        for (const side of [-1, 1]) {
          const eye = new THREE.Mesh(this.eyeGeo, this.herbivoreEyeMat);
          eye.scale.setScalar(0.85);
          eye.position.set(side * 0.52, 0.26, -0.95);
          group.add(eye);
        }

        // Lateral filter cilia (3 per side)
        for (let c = 0; c < 3; c++) {
          const zOffset = -0.45 + c * 0.45;
          for (const side of [-1, 1]) {
            const cilium = new THREE.Mesh(
              this.herbivoreCiliaGeo,
              this.herbivoreCiliaMat
            );
            cilium.position.set(side * 0.98, 0, zOffset);
            group.add(cilium);
          }
        }

        // 2 soft trailing tail beads
        for (let t = 0; t < 2; t++) {
          const tailSeg = new THREE.Mesh(
            this.tailGeo,
            this.herbivoreCiliaMat
          );
          tailSeg.scale.setScalar(0.75 - t * 0.2);
          tailSeg.position.set(0, 0, 1.3 + t * 0.4);
          group.add(tailSeg);
          tailSegments.push(tailSeg);
        }
      }

      // 7. Tactical State Indicator Ring underneath
      const stateRingMat = new THREE.MeshBasicMaterial({
        color: speciesType === 'herbivore' ? 0x2dd4bf : 0xf59e0b,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      this.disposableMaterials.push(stateRingMat);
      const ringMesh = new THREE.Mesh(this.ringGeo, stateRingMat);
      ringMesh.position.y = -0.95;
      group.add(ringMesh);

      scene.add(group);

      const entity: OrganismEntity = {
        id: i + 1,
        species: speciesType,
        speciesName: profile.name,
        profile,
        group,
        position: group.position,
        headingAngle: Math.random() * Math.PI * 2,
        currentSpeed: profile.wanderSpeed,
        state: 'DEAMBULAR',
        active: true,
        respawnTimer: 0,
        stunTimer: 0,
        poisonTimer: 0,
        wanderTarget: new THREE.Vector3(),
        wanderRetargetTimer: 0,
        attackCooldown: 0,
        lungeTimer: 0,
        swimPhase: i * 1.15,
        mandibleLeft,
        mandibleRight,
        tailSegments,
        stateRingMat,
        coreMat,
      };

      this.organisms.push(entity);
      this.telemetryCache.push({
        id: entity.id,
        species: entity.species,
        speciesName: entity.speciesName,
        state: 'DEAMBULAR',
        distanceToPlayer: 999,
      });
    }

    this.resetAll();
  }

  private pickWanderTarget(entity: OrganismEntity): void {
    const minR = entity.species === 'herbivore' ? 9 : 14;
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

  private spawnOrganismAtSafeRadius(entity: OrganismEntity, index: number): void {
    const total = this.organisms.length;
    const angle = (index / total) * Math.PI * 2 + Math.random() * 0.5;
    const minDist =
      entity.species === 'herbivore'
        ? 15.0
        : entity.species === 'leviathan'
        ? 34.0
        : GAME_CONFIG.PREDATOR.MIN_SPAWN_DIST_FROM_PLAYER;
    const radius = minDist + (index % 4) * 12 + Math.random() * 9;

    entity.position.set(
      Math.cos(angle) * radius,
      GAME_CONFIG.WORLD.SWIM_PLANE_Y,
      Math.sin(angle) * radius
    );
    entity.headingAngle = angle + Math.PI / 2;
    entity.currentSpeed = entity.profile.wanderSpeed;
    entity.state = 'DEAMBULAR';
    entity.active = true;
    entity.respawnTimer = 0;
    entity.stunTimer = 0;
    entity.poisonTimer = 0;
    entity.group.visible = true;
    entity.attackCooldown = 0;
    entity.lungeTimer = 0;
    this.pickWanderTarget(entity);
    entity.group.rotation.set(0, entity.headingAngle, 0);
  }

  public resetAll(): void {
    for (let i = 0; i < this.organisms.length; i++) {
      this.spawnOrganismAtSafeRadius(this.organisms[i], i);
    }
  }

  public update(
    delta: number,
    elapsedTime: number,
    playerPosition: THREE.Vector3,
    canCounterAttack = false,
    canPredateHerbivores = false,
    hasProboscis = false,
    onCellKilled?: (position: THREE.Vector3) => void,
    activePoisonClouds: readonly PoisonCloudHazard[] = [],
    electricPulseTriggered = false,
    electricPulseRadius = 9.5,
    canDevourWeakenedHunters = false
  ): {
    totalDamageDealt: number;
    attackerPosition: THREE.Vector3 | null;
    attackerSpeciesName: string | null;
    repelledHunters: number;
    repelledLeviathans: number;
    leviathanBonusAdn: number;
    proboscisDrainedAdn: number;
    herbivoresHunted: number;
    herbivoreAdnGained: number;
    herbivoreEnergyGained: number;
    huntersDevoured: number;
    hunterAdnGained: number;
    hunterEnergyGained: number;
    predatorKilledHerbivoreCount: number;
    blockedHerbivoreHunt: boolean;
    poisonedCount: number;
    stunnedPredatorsCount: number;
    electrocutedHerbivoresCount: number;
    electrocutedAdnGained: number;
    telemetry: PredatorTelemetry[];
    nearestSpeciesName: string;
    nearestState: PredatorBehaviorState;
    nearestDistance: number;
  } {
    let totalDamageDealt = 0;
    let attackerPosition: THREE.Vector3 | null = null;
    let attackerSpeciesName: string | null = null;
    let repelledHunters = 0;
    let repelledLeviathans = 0;
    let leviathanBonusAdn = 0;
    let proboscisDrainedAdn = 0;
    let herbivoresHunted = 0;
    let herbivoreAdnGained = 0;
    let herbivoreEnergyGained = 0;
    let huntersDevoured = 0;
    let hunterAdnGained = 0;
    let hunterEnergyGained = 0;
    let predatorKilledHerbivoreCount = 0;
    let blockedHerbivoreHunt = false;
    let poisonedCount = 0;
    let stunnedPredatorsCount = 0;
    let electrocutedHerbivoresCount = 0;
    let electrocutedAdnGained = 0;

    let nearestDistance = Infinity;
    let nearestState: PredatorBehaviorState = 'DEAMBULAR';
    let nearestSpeciesName = 'Mandíbula Rápida';

    for (let i = 0; i < this.organisms.length; i++) {
      const p = this.organisms[i];

      // Handle organism respawn timer when killed by player, carnivore, or electricity
      if (!p.active) {
        p.respawnTimer -= delta;
        if (p.respawnTimer <= 0) {
          this.spawnOrganismAtSafeRadius(p, i);
        } else {
          this.telemetryCache[i].distanceToPlayer = 999;
          continue;
        }
      }

      if (p.attackCooldown > 0) {
        p.attackCooldown = Math.max(0, p.attackCooldown - delta);
      }
      if (p.lungeTimer > 0) {
        p.lungeTimer = Math.max(0, p.lungeTimer - delta);
      }
      if (p.poisonTimer > 0) {
        p.poisonTimer = Math.max(0, p.poisonTimer - delta);
      }

      const dxToPlayer = playerPosition.x - p.position.x;
      const dzToPlayer = playerPosition.z - p.position.z;
      const distToPlayer = Math.sqrt(
        dxToPlayer * dxToPlayer + dzToPlayer * dzToPlayer
      );

      // --- 0A. BIOELECTRIC DISCHARGE SHOCKWAVE HIT (Radius 9.5m) ---
      if (electricPulseTriggered && distToPlayer <= electricPulseRadius) {
        if (p.species === 'herbivore') {
          if (onCellKilled) {
            onCellKilled(p.position);
          }
          p.active = false;
          p.group.visible = false;
          p.respawnTimer = 7.0;
          electrocutedHerbivoresCount++;
          electrocutedAdnGained += 12;
          continue;
        } else {
          // Stun Hunter or Leviathan for 3.2 seconds
          p.stunTimer = 3.2;
          p.state = 'ATURDIDO';
          p.currentSpeed = 0;
          p.attackCooldown = Math.max(p.attackCooldown, 3.2);
          p.lungeTimer = 0;
          stunnedPredatorsCount++;
        }
      }

      // --- 0B. TOXIC POISON CLOUD HAZARD CONTACT ---
      for (let c = 0; c < activePoisonClouds.length; c++) {
        const cloud = activePoisonClouds[c];
        if (!cloud.active) continue;
        const dxCloud = p.position.x - cloud.position.x;
        const dzCloud = p.position.z - cloud.position.z;
        const distCloud = Math.sqrt(dxCloud * dxCloud + dzCloud * dzCloud);
        const contactRadius = cloud.radius + 1.15;

        if (distCloud <= contactRadius) {
          if (p.poisonTimer <= 0.25) {
            poisonedCount++;
          }
          p.poisonTimer = 3.0;

          // Gradual toxic repulsion away from cloud center
          const invDist = distCloud > 0.01 ? 1 / distCloud : 1;
          const repelStep = 4.6 * delta;
          p.position.x += dxCloud * invDist * repelStep;
          p.position.z += dzCloud * invDist * repelStep;

          if (p.species !== 'herbivore' && p.stunTimer <= 0) {
            p.attackCooldown = Math.max(p.attackCooldown, 0.85);
          }
        }
      }

      // --- 0B-2. STAGE 3 MACROCELL DEVOURING WEAKENED HUNTER ---
      if (
        canDevourWeakenedHunters &&
        p.species === 'hunter' &&
        (p.stunTimer > 0 || p.poisonTimer > 0) &&
        distToPlayer <= 3.8
      ) {
        if (onCellKilled) {
          onCellKilled(p.position);
        }
        p.active = false;
        p.group.visible = false;
        p.respawnTimer = 8.5;
        p.stunTimer = 0;
        p.poisonTimer = 0;
        huntersDevoured++;
        hunterAdnGained += 25;
        hunterEnergyGained += 40;
        continue;
      }

      // --- 0C. STUNNED STATE ('ATURDIDO'): Immobile, vibrating, cyan ring, unable to attack ---
      if (p.stunTimer > 0) {
        p.stunTimer = Math.max(0, p.stunTimer - delta);
        p.state = 'ATURDIDO';
        p.currentSpeed = 0;

        p.stateRingMat.color.setHex(0x38bdf8); // Electric cyan stun ring
        p.stateRingMat.opacity = 0.9;
        p.coreMat.emissiveIntensity =
          1.8 + Math.sin(elapsedTime * 34.0 + p.id) * 0.6;

        p.position.y =
          GAME_CONFIG.WORLD.SWIM_PLANE_Y +
          Math.sin(elapsedTime * 28.0 + p.id) * 0.08;
        p.group.rotation.set(
          Math.sin(elapsedTime * 42.0 + p.id) * 0.08,
          p.headingAngle + Math.cos(elapsedTime * 38.0 + p.id) * 0.11,
          Math.sin(elapsedTime * 36.0 + p.id) * 0.08
        );

        if (p.stunTimer <= 0) {
          p.state = 'DEAMBULAR';
          this.pickWanderTarget(p);
        }

        this.telemetryCache[i].state = p.state;
        this.telemetryCache[i].distanceToPlayer = distToPlayer;
        if (distToPlayer < nearestDistance) {
          nearestDistance = distToPlayer;
          nearestState = p.state;
          nearestSpeciesName = p.speciesName;
        }
        continue;
      } else if (p.state === 'ATURDIDO') {
        p.state = 'DEAMBULAR';
        this.pickWanderTarget(p);
      }

      // 45% speed reduction when poisoned (poisonTimer > 0)
      const poisonSpeedFactor = p.poisonTimer > 0 ? 0.55 : 1.0;

      // --- 1. HERBIVORE LOGIC ("Célula Filtradora") ---
      if (p.species === 'herbivore') {
        // Check player contact (dist <= 2.3m)
        if (distToPlayer <= 2.3) {
          if (canPredateHerbivores || canCounterAttack) {
            if (onCellKilled) {
              onCellKilled(p.position);
            }
            p.active = false;
            p.group.visible = false;
            p.respawnTimer = 7.0;
            herbivoresHunted++;
            herbivoreAdnGained += 18;
            herbivoreEnergyGained += 30;
            continue;
          } else {
            // Player lacks carnivore/proboscis mouth or spines: gently push herbivore away
            const invDist = distToPlayer > 0.01 ? 1 / distToPlayer : 1;
            p.position.x -= dxToPlayer * invDist * 1.4;
            p.position.z -= dzToPlayer * invDist * 1.4;
            blockedHerbivoreHunt = true;
          }
        }

        // Evaluate closest threat: either Player OR any nearby Carnivore ('hunter' / 'leviathan')
        let closestThreatDx = dxToPlayer;
        let closestThreatDz = dzToPlayer;
        let closestThreatDist = distToPlayer;

        for (let j = 0; j < this.organisms.length; j++) {
          const other = this.organisms[j];
          if (!other.active || other.species === 'herbivore') continue;
          const dxPred = other.position.x - p.position.x;
          const dzPred = other.position.z - p.position.z;
          const distPred = Math.sqrt(dxPred * dxPred + dzPred * dzPred);
          if (distPred < closestThreatDist) {
            closestThreatDist = distPred;
            closestThreatDx = dxPred;
            closestThreatDz = dzPred;
          }
        }

        // State machine: DEAMBULAR <-> HUIR (< 14m from player or predator)
        if (p.state === 'DEAMBULAR') {
          if (closestThreatDist < p.profile.detectionRadius) {
            p.state = 'HUIR';
          }
        } else if (p.state === 'HUIR') {
          if (closestThreatDist > p.profile.loseInterestRadius) {
            p.state = 'DEAMBULAR';
            this.pickWanderTarget(p);
          }
        }

        let targetSpeed = p.profile.wanderSpeed * poisonSpeedFactor;
        if (p.state === 'HUIR') {
          // Flee in opposite direction from closest threat
          _toTarget.set(-closestThreatDx, 0, -closestThreatDz);
          targetSpeed = p.profile.activeSpeed * poisonSpeedFactor;
          p.stateRingMat.color.setHex(p.poisonTimer > 0 ? 0x84cc16 : 0x38bdf8);
          p.stateRingMat.opacity = 0.65;
          p.coreMat.emissiveIntensity = 1.3;
        } else {
          p.wanderRetargetTimer -= delta;
          _toTarget.subVectors(p.wanderTarget, p.position);
          _toTarget.y = 0;

          if (_toTarget.lengthSq() < 16.0 || p.wanderRetargetTimer <= 0) {
            this.pickWanderTarget(p);
            _toTarget.subVectors(p.wanderTarget, p.position);
            _toTarget.y = 0;
          }

          p.stateRingMat.color.setHex(p.poisonTimer > 0 ? 0x84cc16 : 0x2dd4bf);
          p.stateRingMat.opacity = p.poisonTimer > 0 ? 0.55 : 0.24;
          p.coreMat.emissiveIntensity = 0.75;
        }

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

        const rSq = p.position.x * p.position.x + p.position.z * p.position.z;
        const maxR = GAME_CONFIG.WORLD.ARENA_RADIUS - 3.0;
        if (rSq > maxR * maxR) {
          const r = Math.sqrt(rSq);
          p.position.x = (p.position.x / r) * maxR;
          p.position.z = (p.position.z / r) * maxR;
          this.pickWanderTarget(p);
        }

        p.position.y =
          GAME_CONFIG.WORLD.SWIM_PLANE_Y +
          Math.sin(elapsedTime * 3.0 + p.id) * 0.14;
        p.group.rotation.set(0, p.headingAngle, 0);

        p.swimPhase +=
          delta * (p.state === 'HUIR' ? 15.0 : 8.0) * poisonSpeedFactor;
        for (let t = 0; t < p.tailSegments.length; t++) {
          const seg = p.tailSegments[t];
          seg.position.x = Math.sin(p.swimPhase - t * 0.9) * 0.14;
        }

        this.telemetryCache[i].state = p.state;
        this.telemetryCache[i].distanceToPlayer = distToPlayer;
        if (distToPlayer < nearestDistance) {
          nearestDistance = distToPlayer;
          nearestState = p.state;
          nearestSpeciesName = p.speciesName;
        }
        continue;
      }

      // --- 2. CARNIVORE PREDATOR LOGIC ('hunter' & 'leviathan') ---
      const ramRadius = p.species === 'leviathan' ? 3.85 : 3.4;

      // Counter-attack check: if player has rostral_spines and is boosting within ramRadius
      if (canCounterAttack && distToPlayer < ramRadius && p.attackCooldown <= 1.6) {
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

        if (p.species === 'leviathan') {
          repelledLeviathans++;
          leviathanBonusAdn += 8;
          if (onCellKilled) {
            onCellKilled(p.position);
          }
        } else {
          repelledHunters++;
        }
        continue;
      }

      // Find nearest active Herbivore prey for trophic ecosystem hunting
      let nearestHerbivore: OrganismEntity | null = null;
      let distToHerbivore = Infinity;
      for (let j = 0; j < this.organisms.length; j++) {
        const candidate = this.organisms[j];
        if (!candidate.active || candidate.species !== 'herbivore') continue;
        const hDx = candidate.position.x - p.position.x;
        const hDz = candidate.position.z - p.position.z;
        const hDist = Math.sqrt(hDx * hDx + hDz * hDz);
        if (hDist < distToHerbivore) {
          distToHerbivore = hDist;
          nearestHerbivore = candidate;
        }
      }

      // Choose closer prey: Player vs nearest Herbivore
      const huntingHerbivore =
        nearestHerbivore !== null &&
        distToHerbivore < distToPlayer &&
        distToHerbivore <= p.profile.detectionRadius;

      const activePreyDist = huntingHerbivore ? distToHerbivore : distToPlayer;
      const activePreyPos =
        huntingHerbivore && nearestHerbivore
          ? nearestHerbivore.position
          : playerPosition;

      // --- FINITE STATE MACHINE TRANSITIONS ---
      switch (p.state) {
        case 'DEAMBULAR':
          if (
            p.attackCooldown <= 1.5 &&
            activePreyDist <= p.profile.detectionRadius
          ) {
            p.state = 'PERSEGUIR';
          }
          break;

        case 'PERSEGUIR':
          if (activePreyDist <= p.profile.attackRange) {
            p.state = 'ATACAR';
          } else if (activePreyDist > p.profile.loseInterestRadius) {
            p.state = 'DEAMBULAR';
            this.pickWanderTarget(p);
          }
          break;

        case 'ATACAR':
          if (activePreyDist > p.profile.attackRange * 1.35) {
            p.state =
              activePreyDist <= p.profile.loseInterestRadius
                ? 'PERSEGUIR'
                : 'DEAMBULAR';
          }
          break;
      }

      // --- STATE ACTIONS & STEERING ---
      let targetSpeed: number = p.profile.wanderSpeed * poisonSpeedFactor;

      if (p.state === 'DEAMBULAR') {
        p.wanderRetargetTimer -= delta;
        _toTarget.subVectors(p.wanderTarget, p.position);
        _toTarget.y = 0;

        if (_toTarget.lengthSq() < 16.0 || p.wanderRetargetTimer <= 0) {
          this.pickWanderTarget(p);
          _toTarget.subVectors(p.wanderTarget, p.position);
          _toTarget.y = 0;
        }

        targetSpeed = p.profile.wanderSpeed * poisonSpeedFactor;
        p.stateRingMat.color.setHex(
          p.poisonTimer > 0
            ? 0x84cc16
            : p.species === 'leviathan'
            ? 0xa855f7
            : 0xf59e0b
        );
        p.stateRingMat.opacity = p.poisonTimer > 0 ? 0.6 : 0.24;
        p.coreMat.emissiveIntensity = 0.65;
      } else if (p.state === 'PERSEGUIR') {
        _toTarget.subVectors(activePreyPos, p.position);
        _toTarget.y = 0;
        targetSpeed = p.profile.activeSpeed * poisonSpeedFactor;

        p.stateRingMat.color.setHex(p.poisonTimer > 0 ? 0x84cc16 : 0xf97316);
        p.stateRingMat.opacity = 0.58;
        p.coreMat.emissiveIntensity = 1.25;
      } else {
        // ATACAR (against either Herbivore or Player)
        _toTarget.subVectors(activePreyPos, p.position);
        _toTarget.y = 0;
        targetSpeed =
          (p.lungeTimer > 0
            ? p.profile.activeSpeed * 1.35
            : p.profile.wanderSpeed * 0.65) * poisonSpeedFactor;

        p.stateRingMat.color.setHex(0xef4444);
        p.stateRingMat.opacity = 0.85;
        p.coreMat.emissiveIntensity = 1.8;

        if (
          p.attackCooldown <= 0 &&
          activePreyDist <= p.profile.attackRange
        ) {
          if (huntingHerbivore && nearestHerbivore) {
            // Carnivore kills the Herbivore cell and drops meat + DNA spore in the water!
            if (onCellKilled) {
              onCellKilled(nearestHerbivore.position);
            }
            nearestHerbivore.active = false;
            nearestHerbivore.group.visible = false;
            nearestHerbivore.respawnTimer = 7.0;
            predatorKilledHerbivoreCount++;
            p.attackCooldown = 2.0;
            p.lungeTimer = 0.3;
            p.state = 'DEAMBULAR';
            this.pickWanderTarget(p);
          } else {
            // Attacking Player
            totalDamageDealt += p.profile.attackDamage;
            attackerPosition = p.position;
            attackerSpeciesName = p.speciesName;
            p.attackCooldown = p.profile.attackCooldownSec;
            p.lungeTimer = 0.28;
            if (hasProboscis) {
              proboscisDrainedAdn += 5;
            }
          }
        }
      }

      // Smoothly rotate headingAngle toward _toTarget
      if (_toTarget.lengthSq() > 0.001) {
        const desiredHeading = Math.atan2(-_toTarget.x, -_toTarget.z);
        let angleDiff = desiredHeading - p.headingAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const turnRate =
          (p.species === 'leviathan'
            ? GAME_CONFIG.PREDATOR.TURN_DAMPING * 0.72
            : GAME_CONFIG.PREDATOR.TURN_DAMPING) * poisonSpeedFactor;
        p.headingAngle += angleDiff * Math.min(1, turnRate * delta);
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
      const swimMultiplier =
        (p.state === 'DEAMBULAR' ? 7.0 : 14.5) * poisonSpeedFactor;
      p.swimPhase += delta * swimMultiplier;

      for (let t = 0; t < p.tailSegments.length; t++) {
        const seg = p.tailSegments[t];
        const wave = Math.sin(p.swimPhase - t * 0.9);
        seg.position.x = wave * (0.14 + t * 0.1);
      }

      if (p.mandibleLeft && p.mandibleRight) {
        const jawSnap =
          p.lungeTimer > 0
            ? 0.45
            : Math.sin(p.swimPhase * 0.8) *
              (p.state === 'DEAMBULAR' ? 0.08 : 0.22);
        p.mandibleLeft.rotation.y = -0.22 + jawSnap;
        p.mandibleRight.rotation.y = 0.22 - jawSnap;
      }

      // Update telemetry cache
      this.telemetryCache[i].state = p.state;
      this.telemetryCache[i].distanceToPlayer = distToPlayer;

      if (distToPlayer < nearestDistance) {
        nearestDistance = distToPlayer;
        nearestState = p.state;
        nearestSpeciesName = p.speciesName;
      }
    }

    return {
      totalDamageDealt,
      attackerPosition,
      attackerSpeciesName,
      repelledHunters,
      repelledLeviathans,
      leviathanBonusAdn,
      proboscisDrainedAdn,
      herbivoresHunted,
      herbivoreAdnGained,
      herbivoreEnergyGained,
      huntersDevoured,
      hunterAdnGained,
      hunterEnergyGained,
      predatorKilledHerbivoreCount,
      blockedHerbivoreHunt,
      poisonedCount,
      stunnedPredatorsCount,
      electrocutedHerbivoresCount,
      electrocutedAdnGained,
      telemetry: this.telemetryCache,
      nearestSpeciesName,
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
