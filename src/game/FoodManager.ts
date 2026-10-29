import * as THREE from 'three';
import { GAME_CONFIG } from './config';
import { SpatialHashGrid } from './SpatialHashGrid';
import { DietType, FoodKind } from './types';

interface FoodItem {
  kind: FoodKind;
  group: THREE.Group;
  coreMesh: THREE.Mesh;
  haloMesh: THREE.Mesh;
  basePosition: THREE.Vector3;
  active: boolean;
  respawnTimer: number;
  phaseOffset: number;
  rotationSpeed: THREE.Vector3;
  energyValue: number;
  adnValue: number;
}

export interface DroppedGeneticPart {
  adaptationId: string;
  speciesName: string;
}

interface GeneticNoduleItem {
  group: THREE.Group;
  crystalMesh: THREE.Mesh;
  ringMesh: THREE.Mesh;
  beaconMesh: THREE.Mesh;
  basePosition: THREE.Vector3;
  active: boolean;
  respawnTimer: number;
  phaseOffset: number;
  adaptationId: string;
  speciesName: string;
}

function createChloroplastCanvasTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Rich photosynthetic emerald stroma gradient
    const grad = ctx.createRadialGradient(128, 128, 16, 128, 128, 140);
    grad.addColorStop(0, '#34d399');
    grad.addColorStop(0.55, '#10b981');
    grad.addColorStop(1, '#047857');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    // Microscopic hexagonal plant cell wall reticulum
    ctx.strokeStyle = 'rgba(167, 243, 208, 0.42)';
    ctx.lineWidth = 2.0;
    const hexR = 22;
    const hexH = hexR * Math.sqrt(3);
    for (let row = -1; row < 10; row++) {
      for (let col = -1; col < 10; col++) {
        const cx = col * hexR * 1.5;
        const cy = row * hexH + (col % 2 === 0 ? 0 : hexH * 0.5);
        ctx.beginPath();
        for (let s = 0; s < 6; s++) {
          const a = (s * Math.PI) / 3;
          const vx = cx + Math.cos(a) * hexR;
          const vy = cy + Math.sin(a) * hexR;
          if (s === 0) ctx.moveTo(vx, vy);
          else ctx.lineTo(vx, vy);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }

    // Glowing internal chlorophyll / thylakoid veins
    ctx.strokeStyle = 'rgba(110, 231, 183, 0.65)';
    ctx.lineWidth = 3.2;
    for (let v = 0; v < 8; v++) {
      ctx.beginPath();
      const startY = 20 + v * 30;
      ctx.moveTo(0, startY);
      ctx.bezierCurveTo(
        85,
        startY + Math.sin(v) * 28,
        170,
        startY - Math.cos(v) * 28,
        256,
        startY
      );
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

function createMeatCanvasTextures(): {
  albedoMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = 256;
  albedoCanvas.height = 256;
  const aCtx = albedoCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 256;
  bumpCanvas.height = 256;
  const bCtx = bumpCanvas.getContext('2d');

  if (aCtx && bCtx) {
    // Deep crimson myoglobin base
    const baseGrad = aCtx.createLinearGradient(0, 0, 256, 256);
    baseGrad.addColorStop(0, '#9f1239');
    baseGrad.addColorStop(0.5, '#be123c');
    baseGrad.addColorStop(1, '#881337');
    aCtx.fillStyle = baseGrad;
    aCtx.fillRect(0, 0, 256, 256);

    bCtx.fillStyle = '#707070';
    bCtx.fillRect(0, 0, 256, 256);

    // Striated organic muscle fiber bundles (coral pink #fb7185)
    for (let f = 0; f < 34; f++) {
      const y = (f / 34) * 256;
      const waveAmp = 10 + (f % 4) * 5;
      aCtx.strokeStyle =
        f % 3 === 0 ? 'rgba(251, 113, 133, 0.72)' : 'rgba(225, 29, 72, 0.65)';
      aCtx.lineWidth = 4 + (f % 3) * 2;
      aCtx.beginPath();
      aCtx.moveTo(0, y);
      aCtx.bezierCurveTo(
        80,
        y + Math.sin(f * 0.7) * waveAmp,
        175,
        y - Math.cos(f * 0.7) * waveAmp,
        256,
        y + Math.sin(f) * 6
      );
      aCtx.stroke();

      // Matching bump elevation for muscle fiber ridges
      bCtx.strokeStyle = f % 2 === 0 ? '#c8c8c8' : '#424242';
      bCtx.lineWidth = 5;
      bCtx.beginPath();
      bCtx.moveTo(0, y);
      bCtx.bezierCurveTo(
        80,
        y + Math.sin(f * 0.7) * waveAmp,
        175,
        y - Math.cos(f * 0.7) * waveAmp,
        256,
        y + Math.sin(f) * 6
      );
      bCtx.stroke();
    }

    // Pearlescent connective fascia marbling veins (#ffe4e6)
    aCtx.strokeStyle = 'rgba(255, 228, 230, 0.78)';
    bCtx.strokeStyle = '#ffffff';
    for (let m = 0; m < 9; m++) {
      const startX = (m * 33) % 256;
      aCtx.lineWidth = 1.8 + (m % 2) * 1.2;
      bCtx.lineWidth = 2.5;

      aCtx.beginPath();
      bCtx.beginPath();
      aCtx.moveTo(startX, 0);
      bCtx.moveTo(startX, 0);
      aCtx.quadraticCurveTo(
        128 + Math.sin(m * 1.9) * 75,
        128,
        (startX + 95) % 256,
        256
      );
      bCtx.quadraticCurveTo(
        128 + Math.sin(m * 1.9) * 75,
        128,
        (startX + 95) % 256,
        256
      );
      aCtx.stroke();
      bCtx.stroke();
    }
  }

  const albedoMap = new THREE.CanvasTexture(albedoCanvas);
  albedoMap.colorSpace = THREE.SRGBColorSpace;
  albedoMap.wrapS = THREE.RepeatWrapping;
  albedoMap.wrapT = THREE.RepeatWrapping;
  albedoMap.needsUpdate = true;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.needsUpdate = true;

  return { albedoMap, bumpMap };
}

export class FoodManager {
  private readonly items: FoodItem[] = [];
  private readonly geneticNodules: GeneticNoduleItem[] = [];
  private readonly spatialGrid = new SpatialHashGrid<FoodItem>();
  private readonly nearbyFoodBuffer: FoodItem[] = [];
  private readonly sharedGeometries: THREE.BufferGeometry[] = [];
  private readonly sharedMaterials: THREE.Material[] = [];
  private readonly sharedTextures: THREE.Texture[] = [];
  private chloroplastTreeCoords: THREE.Vector3[] = [];
  private activeArenaRadius = 90;
  private meatDropCursor = 0;
  private dynamicNoduleCursor = 0;
  private readonly chemoreceptorTarget = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    // Generate procedural PBR CanvasTextures once at startup
    const chloroplastTexture = createChloroplastCanvasTexture();
    const { albedoMap: meatAlbedoTexture, bumpMap: meatBumpTexture } =
      createMeatCanvasTextures();
    this.sharedTextures.push(
      chloroplastTexture,
      meatAlbedoTexture,
      meatBumpTexture
    );

    // 1. Edible Chloroplast (`plant`):
    //    - Inner Core (`coreMesh`): Spiral Thylakoid / Grana Stack pulsing with emerald bioluminescence
    //    - Outer Membrane (`haloMesh`): Flattened lenticular capsule with MeshPhysicalMaterial transmission + cellular texture
    const plantCoreGeo = new THREE.TorusKnotGeometry(0.27, 0.085, 32, 8, 2, 3);
    plantCoreGeo.rotateX(Math.PI / 2);
    plantCoreGeo.scale(1.15, 0.48, 0.92);

    const plantHaloGeo = new THREE.SphereGeometry(0.68, 22, 18);
    plantHaloGeo.scale(1.18, 0.58, 0.94);

    const plantCoreMat = new THREE.MeshStandardMaterial({
      color: 0xa7f3d0,
      emissive: 0x10b981,
      emissiveIntensity: 1.75,
      roughness: 0.2,
      metalness: 0.08,
    });
    const plantHaloMat = new THREE.MeshPhysicalMaterial({
      map: chloroplastTexture,
      color: 0x34d399,
      emissive: 0x059669,
      emissiveIntensity: 0.38,
      roughness: 0.15,
      metalness: 0.02,
      transmission: 0.7,
      thickness: 0.85,
      ior: 1.42,
      clearcoat: 1.0,
      clearcoatRoughness: 0.12,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });

    // 2. Cellular Meat Fragment (`meat`):
    //    - Inner Core (`coreMesh`): Dense myoglobin protein nucleus
    //    - Outer Tissue (`haloMesh`): Asymmetric displaced organic tissue geometry + marbled muscle fiber & bump maps
    const meatCoreGeo = new THREE.DodecahedronGeometry(0.32, 1);
    const meatHaloGeo = new THREE.IcosahedronGeometry(0.58, 3);
    const meatPos = meatHaloGeo.attributes.position as THREE.BufferAttribute;
    for (let v = 0; v < meatPos.count; v++) {
      const vx = meatPos.getX(v);
      const vy = meatPos.getY(v);
      const vz = meatPos.getZ(v);
      // Asymmetric organic muscle tissue cut with rounded fibrous lobes
      const lobeFactor =
        1.0 +
        0.24 * Math.sin(vx * 3.8 + vy * 2.5) +
        0.16 * Math.cos(vz * 4.2 - vx * 2.1);
      meatPos.setXYZ(
        v,
        vx * lobeFactor * 1.22,
        vy * lobeFactor * 0.74,
        vz * lobeFactor * 0.96
      );
    }
    meatHaloGeo.computeVertexNormals();

    const meatCoreMat = new THREE.MeshStandardMaterial({
      color: 0xfda4af,
      emissive: 0xe11d48,
      emissiveIntensity: 1.35,
      roughness: 0.25,
      metalness: 0.1,
    });
    const meatHaloMat = new THREE.MeshPhysicalMaterial({
      map: meatAlbedoTexture,
      bumpMap: meatBumpTexture,
      bumpScale: 0.065,
      roughnessMap: meatBumpTexture,
      color: 0xfb7185,
      emissive: 0x9f1239,
      emissiveIntensity: 0.42,
      roughness: 0.28,
      metalness: 0.05,
      clearcoat: 0.9,
      clearcoatRoughness: 0.15,
      transparent: true,
      opacity: 0.94,
    });

    // 3. Golden DNA Spore (`dna_spore`):
    //    - Inner Double-Helix / Mutagenic Knot inside a refractive plasma capsule
    const sporeCoreGeo = new THREE.TorusKnotGeometry(0.32, 0.09, 36, 8, 2, 3);
    const sporeHaloGeo = new THREE.SphereGeometry(0.72, 18, 16);
    const sporeCoreMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xd97706,
      emissiveIntensity: 1.85,
      roughness: 0.15,
      metalness: 0.3,
    });
    const sporeHaloMat = new THREE.MeshPhysicalMaterial({
      color: 0xfde047,
      emissive: 0xb45309,
      emissiveIntensity: 0.4,
      roughness: 0.14,
      metalness: 0.05,
      transmission: 0.65,
      thickness: 0.7,
      ior: 1.4,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
    });

    // 4. Special Dropped Genetic Nodule Geometry & Materials (Only dropped by creatures with uncatalogued parts)
    const noduleCrystalGeo = new THREE.OctahedronGeometry(0.72, 0);
    noduleCrystalGeo.scale(0.85, 1.45, 0.85);
    const noduleRingGeo = new THREE.TorusGeometry(1.05, 0.07, 8, 28);
    noduleRingGeo.rotateX(Math.PI / 2);
    const noduleBeaconGeo = new THREE.CylinderGeometry(
      0.18,
      0.65,
      2.6,
      12,
      1,
      true
    );

    const noduleCrystalMat = new THREE.MeshStandardMaterial({
      color: 0xa7f3d0,
      emissive: 0x10b981,
      emissiveIntensity: 1.85,
      roughness: 0.12,
      metalness: 0.45,
    });
    const noduleRingMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const noduleBeaconMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.sharedGeometries.push(
      plantCoreGeo,
      plantHaloGeo,
      meatCoreGeo,
      meatHaloGeo,
      sporeCoreGeo,
      sporeHaloGeo,
      noduleCrystalGeo,
      noduleRingGeo,
      noduleBeaconGeo
    );
    this.sharedMaterials.push(
      plantCoreMat,
      plantHaloMat,
      meatCoreMat,
      meatHaloMat,
      sporeCoreMat,
      sporeHaloMat,
      noduleCrystalMat,
      noduleRingMat,
      noduleBeaconMat
    );

    const total = GAME_CONFIG.FOOD.TOTAL_COUNT;

    for (let i = 0; i < total; i++) {
      let kind: FoodKind = 'plant';
      if (i >= Math.floor(total * 0.85)) {
        kind = 'dna_spore';
      } else if (i >= Math.floor(total * 0.62)) {
        kind = 'meat';
      }

      const group = new THREE.Group();
      const coreMesh = new THREE.Mesh(
        kind === 'plant'
          ? plantCoreGeo
          : kind === 'meat'
          ? meatCoreGeo
          : sporeCoreGeo,
        kind === 'plant'
          ? plantCoreMat
          : kind === 'meat'
          ? meatCoreMat
          : sporeCoreMat
      );
      const haloMesh = new THREE.Mesh(
        kind === 'plant'
          ? plantHaloGeo
          : kind === 'meat'
          ? meatHaloGeo
          : sporeHaloGeo,
        kind === 'plant'
          ? plantHaloMat
          : kind === 'meat'
          ? meatHaloMat
          : sporeHaloMat
      );

      group.add(coreMesh);
      group.add(haloMesh);
      scene.add(group);

      const energyValue =
        kind === 'meat'
          ? 28
          : kind === 'plant'
          ? GAME_CONFIG.FOOD.ENERGY_RESTORE_SMALL
          : GAME_CONFIG.FOOD.ENERGY_RESTORE_LARGE;
      const adnValue =
        kind === 'dna_spore'
          ? GAME_CONFIG.FOOD.ADN_REWARD_LARGE
          : kind === 'meat'
          ? 7
          : GAME_CONFIG.FOOD.ADN_REWARD_SMALL;

      const item: FoodItem = {
        kind,
        group,
        coreMesh,
        haloMesh,
        basePosition: new THREE.Vector3(),
        active: true,
        respawnTimer: 0,
        phaseOffset: Math.random() * Math.PI * 2,
        rotationSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 1.8,
          (Math.random() - 0.5) * 2.1,
          (Math.random() - 0.5) * 1.6
        ),
        energyValue,
        adnValue,
      };

      this.placeFoodRandomly(item, i < 18);
      this.items.push(item);
    }

    // Pool of 12 Dynamic Dropped Genetic Nodules (strictly inactive until a creature with a locked_hidden part dies)
    for (let n = 0; n < 12; n++) {
      const group = new THREE.Group();
      const crystalMesh = new THREE.Mesh(noduleCrystalGeo, noduleCrystalMat);
      const ringMesh = new THREE.Mesh(noduleRingGeo, noduleRingMat);
      const beaconMesh = new THREE.Mesh(noduleBeaconGeo, noduleBeaconMat);
      beaconMesh.position.y = 0.85;

      group.add(crystalMesh);
      group.add(ringMesh);
      group.add(beaconMesh);
      group.visible = false;
      scene.add(group);

      this.geneticNodules.push({
        group,
        crystalMesh,
        ringMesh,
        beaconMesh,
        basePosition: new THREE.Vector3(0, GAME_CONFIG.WORLD.SWIM_PLANE_Y, 0),
        active: false,
        respawnTimer: 0,
        phaseOffset: n * 1.1,
        adaptationId: '',
        speciesName: '',
      });
    }
  }

  /**
   * Registers the world positions of active Chloroplast Trees and the current stage's active arena radius
   * so edible chloroplasts (`plant`) sprout around tree canopies and roots.
   */
  public setChloroplastTreeLocations(
    positions: readonly THREE.Vector3[],
    activeArenaRadius: number
  ): void {
    this.chloroplastTreeCoords = positions.map((p) => p.clone());
    this.activeArenaRadius = THREE.MathUtils.clamp(
      activeArenaRadius,
      60,
      GAME_CONFIG.WORLD.ARENA_RADIUS
    );
  }

  private placeFoodRandomly(item: FoodItem, nearCenter = false): void {
    // Cluster 72% of edible chloroplasts ('plant') around active Chloroplast Trees
    if (
      !nearCenter &&
      item.kind === 'plant' &&
      this.chloroplastTreeCoords.length > 0 &&
      Math.random() < 0.72
    ) {
      const treePos =
        this.chloroplastTreeCoords[
          Math.floor(Math.random() * this.chloroplastTreeCoords.length)
        ];
      const angle = Math.random() * Math.PI * 2;
      const spread = 2.0 + Math.random() * 6.5;
      const tx = THREE.MathUtils.clamp(
        treePos.x + Math.cos(angle) * spread,
        -(this.activeArenaRadius - 4),
        this.activeArenaRadius - 4
      );
      const tz = THREE.MathUtils.clamp(
        treePos.z + Math.sin(angle) * spread,
        -(this.activeArenaRadius - 4),
        this.activeArenaRadius - 4
      );
      item.basePosition.set(tx, GAME_CONFIG.WORLD.SWIM_PLANE_Y, tz);
      item.group.position.copy(item.basePosition);
      item.active = true;
      item.respawnTimer = 0;
      item.group.visible = true;
      return;
    }

    const minRadius = nearCenter ? 4.5 : 8.5;
    const maxRadius = nearCenter
      ? 26.0
      : Math.max(45.0, this.activeArenaRadius - 5.0);

    const r = minRadius + Math.sqrt(Math.random()) * (maxRadius - minRadius);
    const theta = Math.random() * Math.PI * 2;

    item.basePosition.set(
      Math.cos(theta) * r,
      GAME_CONFIG.WORLD.SWIM_PLANE_Y,
      Math.sin(theta) * r
    );
    item.group.position.copy(item.basePosition);
    item.active = true;
    item.respawnTimer = 0;
    item.group.visible = true;
  }

  public resetAll(): void {
    for (let i = 0; i < this.items.length; i++) {
      this.placeFoodRandomly(this.items[i], i < 18);
    }
    for (let n = 0; n < this.geneticNodules.length; n++) {
      const nod = this.geneticNodules[n];
      nod.active = false;
      nod.respawnTimer = 0;
      nod.adaptationId = '';
      nod.speciesName = '';
      nod.group.visible = false;
    }
  }

  public setEcosystemVisible(visible: boolean): void {
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      item.group.visible = visible && item.active;
    }
    for (let n = 0; n < this.geneticNodules.length; n++) {
      const nod = this.geneticNodules[n];
      nod.group.visible = visible && nod.active;
    }
  }

  /**
   * Spawns a fresh Meat Fragment & a Golden DNA Spore right where an organism was killed.
   * These only restore Energy and ADN — never unlock adaptations.
   */
  public spawnMeatDrop(originPosition: THREE.Vector3): void {
    const meatItems = this.items.filter((it) => it.kind === 'meat');
    if (meatItems.length > 0) {
      const chosenMeat =
        meatItems.find((it) => !it.active) ??
        meatItems[this.meatDropCursor % meatItems.length];
      this.meatDropCursor++;

      const angle = Math.random() * Math.PI * 2;
      chosenMeat.basePosition.set(
        originPosition.x + Math.cos(angle) * 1.1,
        GAME_CONFIG.WORLD.SWIM_PLANE_Y,
        originPosition.z + Math.sin(angle) * 1.1
      );
      chosenMeat.group.position.copy(chosenMeat.basePosition);
      chosenMeat.active = true;
      chosenMeat.respawnTimer = 0;
      chosenMeat.group.visible = true;
    }

    const sporeItems = this.items.filter((it) => it.kind === 'dna_spore');
    if (sporeItems.length > 0) {
      const chosenSpore =
        sporeItems.find((it) => !it.active) ??
        sporeItems[this.meatDropCursor % sporeItems.length];

      const angle = Math.random() * Math.PI * 2;
      chosenSpore.basePosition.set(
        originPosition.x + Math.cos(angle) * 1.4,
        GAME_CONFIG.WORLD.SWIM_PLANE_Y,
        originPosition.z + Math.sin(angle) * 1.4
      );
      chosenSpore.group.position.copy(chosenSpore.basePosition);
      chosenSpore.active = true;
      chosenSpore.respawnTimer = 0;
      chosenSpore.group.visible = true;
    }
  }

  /**
   * Spawns a 3D Crystallized Genetic Nodule at the site of an organism's death
   * ONLY when that organism carried a specific adaptation that is still `locked_hidden`.
   * Remains in the water for 30 seconds so the player can physically touch it to unlock that part.
   */
  public spawnGeneticNodule(
    originPosition: THREE.Vector3,
    adaptationId: string,
    speciesName: string
  ): void {
    if (!adaptationId) return;

    const chosen =
      this.geneticNodules.find((n) => !n.active) ??
      this.geneticNodules[
        this.dynamicNoduleCursor % this.geneticNodules.length
      ];
    this.dynamicNoduleCursor++;

    const angle = Math.random() * Math.PI * 2;
    chosen.basePosition.set(
      originPosition.x + Math.cos(angle) * 0.9,
      GAME_CONFIG.WORLD.SWIM_PLANE_Y,
      originPosition.z + Math.sin(angle) * 0.9
    );
    chosen.group.position.copy(chosen.basePosition);
    chosen.adaptationId = adaptationId;
    chosen.speciesName = speciesName;
    chosen.active = true;
    chosen.respawnTimer = 30.0;
    chosen.group.visible = true;
  }

  private canDigest(
    diet: DietType,
    kind: FoodKind,
    canAlwaysDigestPlants = false
  ): boolean {
    if (kind === 'dna_spore') return true;
    if (diet === 'omnivore') return true;
    if (diet === 'herbivore' && kind === 'plant') return true;
    if (diet === 'carnivore' && kind === 'meat') return true;
    if (canAlwaysDigestPlants && kind === 'plant') return true;
    return false;
  }

  /**
   * Finds the nearest active dropped Genetic Nodule (priority 1) or digestible nutrient (priority 2)
   * for the 3D Chemoreceptor compass vector.
   */
  public findNearestTargetForChemoreceptor(
    playerPosition: THREE.Vector3,
    diet: DietType,
    canAlwaysDigestPlants = false
  ): { position: THREE.Vector3; isGeneticNodule: boolean } | null {
    let bestDistSq = Infinity;
    let foundNodule = false;

    for (let n = 0; n < this.geneticNodules.length; n++) {
      const nod = this.geneticNodules[n];
      if (!nod.active) continue;
      const dx = nod.group.position.x - playerPosition.x;
      const dz = nod.group.position.z - playerPosition.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        this.chemoreceptorTarget.copy(nod.group.position);
        foundNodule = true;
      }
    }

    if (foundNodule && bestDistSq <= 95 * 95) {
      return { position: this.chemoreceptorTarget, isGeneticNodule: true };
    }

    bestDistSq = Infinity;
    let foundFood = false;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if (!it.active) continue;
      if (!this.canDigest(diet, it.kind, canAlwaysDigestPlants)) continue;
      const dx = it.group.position.x - playerPosition.x;
      const dz = it.group.position.z - playerPosition.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        this.chemoreceptorTarget.copy(it.group.position);
        foundFood = true;
      }
    }

    if (foundFood) {
      return { position: this.chemoreceptorTarget, isGeneticNodule: false };
    }
    return null;
  }

  public update(
    delta: number,
    elapsedTime: number,
    playerPosition: THREE.Vector3,
    playerDiet: DietType = 'herbivore',
    canAlwaysDigestPlants = false,
    hasFilterMouthBonus = false,
    hasBaleenFilter = false,
    hasRadula = false,
    hasVoraciousChemotaxis = false
  ): {
    itemsEaten: number;
    plantsEaten: number;
    energyGained: number;
    adnGained: number;
    blockedFoodKind: FoodKind | null;
    collectedGeneticDrops: DroppedGeneticPart[];
  } {
    let itemsEaten = 0;
    let plantsEaten = 0;
    let energyGained = 0;
    let adnGained = 0;
    let blockedFoodKind: FoodKind | null = null;
    const collectedGeneticDrops: DroppedGeneticPart[] = [];

    this.spatialGrid.clear();

    // 1. Update food animations & insert active items into the 32m SpatialHashGrid
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];

      if (!item.active) {
        item.respawnTimer -= delta;
        if (item.respawnTimer <= 0) {
          this.placeFoodRandomly(item, false);
        }
        continue;
      }

      // Only animate rotation/bobbing for items reasonably close to player (< 115m) to save CPU
      const dx = item.basePosition.x - playerPosition.x;
      const dz = item.basePosition.z - playerPosition.z;
      if (dx * dx + dz * dz <= 115 * 115) {
        const bob = Math.sin(elapsedTime * 2.8 + item.phaseOffset) * 0.22;
        item.group.position.y = item.basePosition.y + bob;
        item.coreMesh.rotation.x += item.rotationSpeed.x * delta;
        item.coreMesh.rotation.y += item.rotationSpeed.y * delta;
        if (item.kind === 'meat') {
          item.haloMesh.rotation.y += item.rotationSpeed.y * 0.45 * delta;
        }
        const pulse =
          1.0 + Math.sin(elapsedTime * 4.0 + item.phaseOffset) * 0.1;
        item.haloMesh.scale.setScalar(pulse);
      }

      this.spatialGrid.insert(item, item.group.position.x, item.group.position.z);
    }

    // 2. Query only the player's cell & adjacent cells from the SpatialHashGrid for normal food collection
    // Collecting plant, meat, or dna_spore ONLY grants Energy and ADN — never unlocks parts!
    const nearbyFood = this.spatialGrid.queryCells(
      playerPosition.x,
      playerPosition.z,
      1,
      this.nearbyFoodBuffer
    );

    const collectRadius = GAME_CONFIG.FOOD.COLLISION_RADIUS + 0.85;
    const collectDistSq = collectRadius * collectRadius;
    const baleenCollectDistSq = 4.5 * 4.5;
    const chemotaxisPullRadius = collectRadius + 1.8;
    const chemotaxisPullDistSq = chemotaxisPullRadius * chemotaxisPullRadius;

    for (let i = 0; i < nearbyFood.length; i++) {
      const item = nearbyFood[i];
      if (!item.active) continue;

      let dx = item.group.position.x - playerPosition.x;
      let dz = item.group.position.z - playerPosition.z;
      let distSq = dx * dx + dz * dz;

      const isDigestible = this.canDigest(
        playerDiet,
        item.kind,
        canAlwaysDigestPlants
      );

      // Innate Genetic Trait 'voracious_chemotaxis': Soft magnetic pull (+1.8m radius) toward the player's mouth
      if (
        hasVoraciousChemotaxis &&
        isDigestible &&
        distSq > collectDistSq &&
        distSq <= chemotaxisPullDistSq
      ) {
        const dist = Math.max(0.1, Math.sqrt(distSq));
        const pullStep = Math.min(dist * 0.5, 9.2 * delta);
        item.basePosition.x -= (dx / dist) * pullStep;
        item.basePosition.z -= (dz / dist) * pullStep;
        item.group.position.x = item.basePosition.x;
        item.group.position.z = item.basePosition.z;
        dx = item.group.position.x - playerPosition.x;
        dz = item.group.position.z - playerPosition.z;
        distSq = dx * dx + dz * dz;
      }

      const isPlantInBaleenRange =
        hasBaleenFilter &&
        item.kind === 'plant' &&
        distSq <= baleenCollectDistSq &&
        isDigestible;

      if (distSq <= collectDistSq || isPlantInBaleenRange) {
        if (isDigestible) {
          item.active = false;
          item.group.visible = false;
          item.respawnTimer = GAME_CONFIG.FOOD.RESPAWN_DELAY_SEC;
          itemsEaten++;
          if (item.kind === 'plant') {
            plantsEaten++;
            const basePlantEnergy = hasFilterMouthBonus
              ? Math.round(item.energyValue * 1.2)
              : item.energyValue;
            const radulaExtra = hasRadula
              ? Math.round(item.energyValue * 0.4) + 4
              : 0;
            energyGained += basePlantEnergy + radulaExtra;
          } else {
            energyGained += item.energyValue;
          }
          adnGained += item.adnValue;
        } else {
          // Gently push incompatible food away and notify HUD
          const dist = Math.max(0.1, Math.sqrt(distSq));
          item.basePosition.x += (dx / dist) * 0.9;
          item.basePosition.z += (dz / dist) * 0.9;
          item.group.position.x = item.basePosition.x;
          item.group.position.z = item.basePosition.z;
          blockedFoodKind = item.kind;
        }
      }
    }

    // 3. Update Dropped 3D Genetic Nodules from defeated creatures (30s expiration)
    const noduleCollectDistSq = 2.65 * 2.65;
    for (let n = 0; n < this.geneticNodules.length; n++) {
      const nod = this.geneticNodules[n];
      if (!nod.active) continue;

      nod.respawnTimer -= delta;
      if (nod.respawnTimer <= 0) {
        nod.active = false;
        nod.adaptationId = '';
        nod.speciesName = '';
        nod.group.visible = false;
        continue;
      }

      const bob = Math.sin(elapsedTime * 3.2 + nod.phaseOffset) * 0.28;
      nod.group.position.y = nod.basePosition.y + bob;
      nod.crystalMesh.rotation.y += delta * 2.4;
      nod.crystalMesh.rotation.x =
        Math.sin(elapsedTime * 2.0 + nod.phaseOffset) * 0.25;
      nod.ringMesh.rotation.z += delta * 1.8;
      const ringScale =
        1.0 + Math.sin(elapsedTime * 5.0 + nod.phaseOffset) * 0.16;
      nod.ringMesh.scale.setScalar(ringScale);

      const dx = nod.group.position.x - playerPosition.x;
      const dz = nod.group.position.z - playerPosition.z;
      if (dx * dx + dz * dz <= noduleCollectDistSq) {
        const droppedAdaptationId = nod.adaptationId;
        const droppedSpeciesName = nod.speciesName;
        nod.active = false;
        nod.adaptationId = '';
        nod.speciesName = '';
        nod.group.visible = false;

        if (droppedAdaptationId) {
          collectedGeneticDrops.push({
            adaptationId: droppedAdaptationId,
            speciesName: droppedSpeciesName || 'Especie Abisal',
          });
        }
        adnGained += 15;
        energyGained += 15;
      }
    }

    return {
      itemsEaten,
      plantsEaten,
      energyGained,
      adnGained,
      blockedFoodKind,
      collectedGeneticDrops,
    };
  }

  public getActiveCount(): number {
    let count = 0;
    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i].active) count++;
    }
    return count;
  }

  public dispose(): void {
    for (const tex of this.sharedTextures) {
      tex.dispose();
    }
    for (const geo of this.sharedGeometries) {
      geo.dispose();
    }
    for (const mat of this.sharedMaterials) {
      mat.dispose();
    }
  }
}
