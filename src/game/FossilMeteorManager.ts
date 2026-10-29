import * as THREE from 'three';
import { GAME_CONFIG } from './config';
import { SpatialHashGrid } from './SpatialHashGrid';

interface FossilMeteorItem {
  id: number;
  group: THREE.Group;
  basaltShell: THREE.Mesh;
  crystalCore: THREE.Mesh;
  coreMat: THREE.MeshStandardMaterial;
  dustRing: THREE.Mesh;
  stardustPoints: THREE.Points;
  basePosition: THREE.Vector3;
  active: boolean;
  respawnTimer: number;
  phaseOffset: number;
  isGoldenCore: boolean;
}

interface MeteorImplosionBurst {
  group: THREE.Group;
  shards: THREE.Mesh[];
  shardVelocities: THREE.Vector3[];
  shockwaveRing: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  active: boolean;
  life: number;
  maxLife: number;
}

const _tempVec = new THREE.Vector3();

export class FossilMeteorManager {
  private readonly meteors: FossilMeteorItem[] = [];
  private readonly bursts: MeteorImplosionBurst[] = [];
  private burstCursor = 0;
  private readonly spatialGrid = new SpatialHashGrid<FossilMeteorItem>();
  private readonly queryBuffer: FossilMeteorItem[] = [];
  private readonly disposableGeometries: THREE.BufferGeometry[] = [];
  private readonly disposableMaterials: THREE.Material[] = [];

  private readonly meteorCount = 18;

  constructor(scene: THREE.Scene) {
    // 1. Cracked Basalt / Charcoal Meteoric Crust Geometry (irregular Dodecahedron)
    const basaltGeo = new THREE.DodecahedronGeometry(1.45, 1);
    const posAttr = basaltGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const vz = posAttr.getZ(i);
      const n =
        1.0 +
        Math.sin(vx * 3.1 + vy * 2.3) * 0.14 +
        Math.cos(vz * 2.9 - vx * 1.7) * 0.1;
      posAttr.setXYZ(i, vx * n, vy * (n * 0.88), vz * n);
    }
    basaltGeo.computeVertexNormals();

    const basaltMat = new THREE.MeshStandardMaterial({
      color: 0x1c1917,
      emissive: 0x0c0a09,
      roughness: 0.88,
      metalness: 0.25,
      flatShading: true,
    });

    // 2. Glowing Crystalline Inner Core protruding through tectonic cracks
    const coreGeo = new THREE.OctahedronGeometry(1.18, 1);
    coreGeo.scale(1.12, 1.28, 1.12);

    // 3. Orbital Stardust Ring & Suspended Stardust Particles
    const dustRingGeo = new THREE.TorusGeometry(2.15, 0.08, 8, 36);
    dustRingGeo.rotateX(Math.PI / 2);
    const dustRingMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const stardustGeo = new THREE.BufferGeometry();
    const dustCount = 24;
    const dustPositions = new Float32Array(dustCount * 3);
    const dustColors = new Float32Array(dustCount * 3);
    const cGold = new THREE.Color(0xfacc15);
    const cEmerald = new THREE.Color(0x10b981);

    for (let d = 0; d < dustCount; d++) {
      const a = (d / dustCount) * Math.PI * 2;
      const r = 1.65 + (d % 4) * 0.35;
      dustPositions[d * 3] = Math.cos(a) * r;
      dustPositions[d * 3 + 1] = ((d % 5) - 2) * 0.28;
      dustPositions[d * 3 + 2] = Math.sin(a) * r;

      const c = d % 2 === 0 ? cGold : cEmerald;
      dustColors[d * 3] = c.r;
      dustColors[d * 3 + 1] = c.g;
      dustColors[d * 3 + 2] = c.b;
    }
    stardustGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(dustPositions, 3)
    );
    stardustGeo.setAttribute('color', new THREE.BufferAttribute(dustColors, 3));

    const stardustMat = new THREE.PointsMaterial({
      size: 0.34,
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      sizeAttenuation: true,
      depthWrite: false,
    });

    this.disposableGeometries.push(
      basaltGeo,
      coreGeo,
      dustRingGeo,
      stardustGeo
    );
    this.disposableMaterials.push(basaltMat, dustRingMat, stardustMat);

    // Create 18 Fossil Meteorites distributed across the 240m arena
    for (let i = 0; i < this.meteorCount; i++) {
      const isGoldenCore = i % 2 === 0;
      const coreMat = new THREE.MeshStandardMaterial({
        color: isGoldenCore ? 0xfef08a : 0x6ee7b7,
        emissive: isGoldenCore ? 0xfacc15 : 0x10b981,
        emissiveIntensity: 1.9,
        roughness: 0.15,
        metalness: 0.45,
      });
      this.disposableMaterials.push(coreMat);

      const group = new THREE.Group();

      const basaltShell = new THREE.Mesh(basaltGeo, basaltMat);
      basaltShell.castShadow = true;
      basaltShell.receiveShadow = true;
      group.add(basaltShell);

      const crystalCore = new THREE.Mesh(coreGeo, coreMat);
      crystalCore.rotation.set(0.4, 0.7, 0.2);
      group.add(crystalCore);

      const dustRing = new THREE.Mesh(dustRingGeo, dustRingMat);
      group.add(dustRing);

      const stardustPoints = new THREE.Points(stardustGeo, stardustMat);
      group.add(stardustPoints);

      scene.add(group);

      const item: FossilMeteorItem = {
        id: i + 1,
        group,
        basaltShell,
        crystalCore,
        coreMat,
        dustRing,
        stardustPoints,
        basePosition: new THREE.Vector3(),
        active: true,
        respawnTimer: 0,
        phaseOffset: i * 0.85,
        isGoldenCore,
      };

      this.placeMeteorAtZone(item, i, false);
      this.meteors.push(item);
    }

    // Pre-allocate 4 3D Implosion / Fragmentation Burst Effects
    const shardGeo = new THREE.OctahedronGeometry(0.35, 0);
    const shockRingGeo = new THREE.RingGeometry(0.8, 1.35, 28);
    shockRingGeo.rotateX(-Math.PI / 2);
    const shardMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0x10b981,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });
    this.disposableGeometries.push(shardGeo, shockRingGeo);
    this.disposableMaterials.push(shardMat);

    for (let b = 0; b < 4; b++) {
      const bGroup = new THREE.Group();
      bGroup.visible = false;
      const shards: THREE.Mesh[] = [];
      const shardVelocities: THREE.Vector3[] = [];

      for (let s = 0; s < 10; s++) {
        const sMesh = new THREE.Mesh(shardGeo, shardMat);
        bGroup.add(sMesh);
        shards.push(sMesh);
        shardVelocities.push(new THREE.Vector3());
      }

      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      this.disposableMaterials.push(ringMat);
      const shockwaveRing = new THREE.Mesh(shockRingGeo, ringMat);
      bGroup.add(shockwaveRing);

      scene.add(bGroup);
      this.bursts.push({
        group: bGroup,
        shards,
        shardVelocities,
        shockwaveRing,
        ringMat,
        active: false,
        life: 0,
        maxLife: 0.95,
      });
    }
  }

  private placeMeteorAtZone(
    item: FossilMeteorItem,
    index: number,
    remoteRespawn: boolean
  ): void {
    // Distribute across inner discovery ring (26..65m), mid zone (65..140m), and deep abyssal fields (140..222m)
    const maxArenaR = GAME_CONFIG.WORLD.ARENA_RADIUS - 16;
    let r: number;
    if (remoteRespawn) {
      r = 65 + Math.random() * (maxArenaR - 65);
    } else if (index < 4) {
      // 4 accessible meteorites within 26..58m so the player can discover fossils early
      r = 26 + index * 8 + Math.random() * 6;
    } else if (index < 11) {
      r = 64 + (index - 4) * 12 + Math.random() * 10;
    } else {
      r = 148 + (index - 11) * 10 + Math.random() * 8;
    }
    r = Math.min(maxArenaR, r);

    const angle =
      (index / this.meteorCount) * Math.PI * 2 +
      (remoteRespawn ? Math.random() * Math.PI * 2 : index * 0.618);

    item.basePosition.set(
      Math.cos(angle) * r,
      GAME_CONFIG.WORLD.SWIM_PLANE_Y,
      Math.sin(angle) * r
    );
    item.group.position.copy(item.basePosition);
    item.active = true;
    item.respawnTimer = 0;
    item.group.visible = true;
  }

  private triggerImplosionBurst(origin: THREE.Vector3): void {
    const burst = this.bursts[this.burstCursor % this.bursts.length];
    this.burstCursor++;

    burst.group.position.copy(origin);
    burst.group.visible = true;
    burst.active = true;
    burst.life = burst.maxLife;
    burst.shockwaveRing.scale.setScalar(1.0);
    burst.ringMat.opacity = 0.95;

    for (let s = 0; s < burst.shards.length; s++) {
      const shard = burst.shards[s];
      shard.position.set(0, 0, 0);
      shard.scale.setScalar(1.0);
      const theta = (s / burst.shards.length) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 6.5 + Math.random() * 5.5;
      burst.shardVelocities[s].set(
        Math.cos(theta) * speed,
        (Math.random() - 0.3) * 4.5,
        Math.sin(theta) * speed
      );
    }
  }

  public resetAll(): void {
    for (let i = 0; i < this.meteors.length; i++) {
      this.placeMeteorAtZone(this.meteors[i], i, false);
    }
    for (const b of this.bursts) {
      b.active = false;
      b.group.visible = false;
    }
  }

  public setEcosystemVisible(visible: boolean): void {
    for (let i = 0; i < this.meteors.length; i++) {
      const m = this.meteors[i];
      m.group.visible = visible && m.active;
    }
    if (!visible) {
      for (const b of this.bursts) {
        b.active = false;
        b.group.visible = false;
      }
    }
  }

  public findNearestActiveMeteor(
    playerPosition: THREE.Vector3,
    maxDist = 85
  ): THREE.Vector3 | null {
    let bestDistSq = maxDist * maxDist;
    let bestPos: THREE.Vector3 | null = null;
    for (let i = 0; i < this.meteors.length; i++) {
      const m = this.meteors[i];
      if (!m.active) continue;
      const dx = m.group.position.x - playerPosition.x;
      const dz = m.group.position.z - playerPosition.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestPos = m.group.position;
      }
    }
    return bestPos;
  }

  public update(
    delta: number,
    elapsedTime: number,
    playerPosition: THREE.Vector3
  ): {
    crackedMeteorCount: number;
  } {
    let crackedMeteorCount = 0;
    this.spatialGrid.clear();

    // 1. Update active meteorites & populate spatial hash grid
    for (let i = 0; i < this.meteors.length; i++) {
      const m = this.meteors[i];
      if (!m.active) {
        m.respawnTimer -= delta;
        if (m.respawnTimer <= 0) {
          this.placeMeteorAtZone(m, i, true);
        }
        continue;
      }

      // Animate floating meteoric rock, pulsing inner core & stardust ring
      const bob = Math.sin(elapsedTime * 2.1 + m.phaseOffset) * 0.26;
      m.group.position.y = m.basePosition.y + bob;
      m.basaltShell.rotation.y += delta * 0.45;
      m.basaltShell.rotation.x += delta * 0.25;

      const corePulse = 1.0 + Math.sin(elapsedTime * 4.8 + m.phaseOffset) * 0.16;
      m.crystalCore.scale.setScalar(corePulse);
      m.coreMat.emissiveIntensity =
        1.55 + Math.sin(elapsedTime * 5.2 + m.phaseOffset) * 0.55;

      m.dustRing.rotation.z -= delta * 1.4;
      m.stardustPoints.rotation.y += delta * 1.1;

      this.spatialGrid.insert(m, m.group.position.x, m.group.position.z);
    }

    // 2. Check collision only in player's cell and adjacent cells (dist < 3.2m)
    const nearbyMeteors = this.spatialGrid.queryCells(
      playerPosition.x,
      playerPosition.z,
      1,
      this.queryBuffer
    );
    const hitRadiusSq = 3.2 * 3.2;

    for (let i = 0; i < nearbyMeteors.length; i++) {
      const m = nearbyMeteors[i];
      if (!m.active) continue;
      const dx = m.group.position.x - playerPosition.x;
      const dz = m.group.position.z - playerPosition.z;
      if (dx * dx + dz * dz <= hitRadiusSq) {
        this.triggerImplosionBurst(m.group.position);
        m.active = false;
        m.group.visible = false;
        // Respawn in another remote zone after 45s
        m.respawnTimer = 45.0;
        crackedMeteorCount++;
      }
    }

    // 3. Animate active 3D Implosion Bursts
    for (let b = 0; b < this.bursts.length; b++) {
      const burst = this.bursts[b];
      if (!burst.active) continue;
      burst.life -= delta;
      if (burst.life <= 0) {
        burst.active = false;
        burst.group.visible = false;
        continue;
      }

      const progress = 1 - burst.life / burst.maxLife;
      burst.shockwaveRing.scale.setScalar(1.0 + progress * 4.8);
      burst.ringMat.opacity = Math.max(0, (1 - progress) * 0.9);

      for (let s = 0; s < burst.shards.length; s++) {
        const shard = burst.shards[s];
        _tempVec.copy(burst.shardVelocities[s]).multiplyScalar(delta);
        shard.position.add(_tempVec);
        shard.rotation.x += delta * 7.0;
        shard.rotation.y += delta * 6.0;
        shard.scale.setScalar(Math.max(0.05, 1.0 - progress));
      }
    }

    return { crackedMeteorCount };
  }

  public dispose(): void {
    for (const geo of this.disposableGeometries) {
      geo.dispose();
    }
    for (const mat of this.disposableMaterials) {
      mat.dispose();
    }
  }
}
