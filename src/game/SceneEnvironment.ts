import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GAME_CONFIG } from './config';
import { BiomeType, CellularGrowthStage, EvolutionaryStage } from './types';

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

export function getGroundHeightAt(x: number, z: number): number {
  const distSq = x * x + z * z;
  const dist = Math.sqrt(distSq);
  const ripples =
    Math.sin(x * 0.055) * Math.cos(z * 0.055) * 1.35 +
    Math.sin(x * 0.16 + z * 0.14) * 0.45;

  // Natural volcanic/reef basin rim around the 240m arena perimeter
  const rimFactor = THREE.MathUtils.smoothstep(
    dist,
    GAME_CONFIG.WORLD.ARENA_RADIUS - 18,
    GAME_CONFIG.WORLD.ARENA_RADIUS + 34
  );
  const rimHeight = rimFactor * 12.5;

  // Deepened seabed (-7.2 base) so Spore-style abyssal silhouettes & 12m giant kelp fit naturally
  return -7.2 + ripples + rimHeight;
}

interface AbyssalSilhouette {
  group: THREE.Group;
  orbitRadius: number;
  orbitAngle: number;
  orbitSpeed: number;
  centerX: number;
  centerZ: number;
  baseScale: number;
  tailSegments: THREE.Mesh[];
  fins: THREE.Mesh[];
  phaseOffset: number;
}

const THERMAL_VENT_COORDS: readonly [number, number][] = [
  [-42, 0],
  [-52, -26],
  [-68, -10],
  [-54, 26],
  [-40, 42],
  [-98, -48],
  [-118, 14],
  [-145, -28],
  [-132, 68],
];

export class SceneEnvironment {
  public readonly scene: THREE.Scene;
  private currentStage: EvolutionaryStage = 'cell_stage';
  private currentGrowthStage: CellularGrowthStage = 1;
  private envTexture: THREE.Texture | null = null;
  private hemiLight!: THREE.HemisphereLight;
  private dirLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;
  private fogExp2!: THREE.FogExp2;
  private fogDensityMultiplier = 1.0;
  private userFogDistanceMultiplier = 1.0;
  private stageFogFactor = 1.0;
  private currentParticleQuality: 'low' | 'medium' | 'high' = 'high';
  private isEditorSandboxActive = false;
  private bgColor!: THREE.Color;

  private seabedMesh!: THREE.Mesh;
  private seabedMat!: THREE.MeshStandardMaterial;
  private rocksInstanced!: THREE.InstancedMesh;
  private rockCapsInstanced!: THREE.InstancedMesh;
  private kelpStalksInstanced!: THREE.InstancedMesh;
  private kelpBladesInstanced!: THREE.InstancedMesh;
  private chloroplastCoreInstanced!: THREE.InstancedMesh;
  private chloroplastFrondMat!: THREE.MeshStandardMaterial;
  private readonly chloroplastTreePositions: THREE.Vector3[] = [];
  private readonly chloroplastTreeBaseScales: {
    scaleXZ: number;
    scaleY: number;
    rotX: number;
    rotY: number;
    rotZ: number;
    isGiantZone: boolean;
  }[] = [];
  private electricCoralInstanced!: THREE.InstancedMesh;
  private electricCoralMat!: THREE.MeshStandardMaterial;
  private brainCoralInstanced!: THREE.InstancedMesh;
  private giantAnemoneInstanced!: THREE.InstancedMesh;
  private fossilShellsInstanced!: THREE.InstancedMesh;
  private planktonPoints!: THREE.Points;
  private causticRingMesh!: THREE.Mesh;

  // 3D Species Nest at (0, 0) for Terrestrial Creature Stage
  private nestGroup!: THREE.Group;
  private nestAuraMat!: THREE.MeshBasicMaterial;
  private readonly nestEggs: THREE.Mesh[] = [];

  // Hydrothermal Vents & Ascending Bubble Plumes
  private readonly ventPositions: THREE.Vector3[] = [];
  private readonly ventGroups: THREE.Group[] = [];
  private readonly ventAuraMeshes: THREE.Mesh[] = [];
  private readonly ventAuraMats: THREE.MeshBasicMaterial[] = [];
  private ventBubblesPoints!: THREE.Points;
  private readonly ventBubbleCount = 160;
  private readonly ventBubblePositions: Float32Array;
  private readonly ventBubbleBaseXZ: Float32Array;

  // Spore-style Colossal Abyssal Background Silhouettes (Depth Plane Staging)
  private readonly abyssalSilhouettes: AbyssalSilhouette[] = [];

  // 3D Spore Laboratory Petri Dish Sandbox & 3-Point Studio Lighting Rig
  private sandboxGroup!: THREE.Group;
  private sandboxPulseRingMat!: THREE.MeshBasicMaterial;
  private sandboxHexGridMesh!: THREE.Mesh;
  private sandboxKeyLight!: THREE.SpotLight;
  private sandboxFillLight!: THREE.DirectionalLight;
  private sandboxRimLight!: THREE.DirectionalLight;

  private readonly kelpCount = 220;
  private readonly planktonCount = 720;
  private readonly planktonPositions: Float32Array;
  private readonly disposableGeometries: THREE.BufferGeometry[] = [];
  private readonly disposableMaterials: THREE.Material[] = [];

  constructor(renderer: THREE.WebGLRenderer) {
    this.scene = new THREE.Scene();
    this.bgColor = new THREE.Color(GAME_CONFIG.WORLD.WATER_COLOR);
    this.scene.background = this.bgColor;
    this.fogExp2 = new THREE.FogExp2(
      GAME_CONFIG.WORLD.FOG_COLOR,
      GAME_CONFIG.WORLD.FOG_DENSITY
    );
    this.scene.fog = this.fogExp2;

    this.planktonPositions = new Float32Array(this.planktonCount * 3);
    this.ventBubblePositions = new Float32Array(this.ventBubbleCount * 3);
    this.ventBubbleBaseXZ = new Float32Array(this.ventBubbleCount * 2);

    this.initEnvironmentMap(renderer);
    this.initLights();
    this.initSeabed();
    this.initRocks();
    this.initUnderwaterFlora();
    this.initThemedInstancedZones();
    this.initHydrothermalVents();
    this.initAbyssalSilhouettes();
    this.initPlanktonParticles();
    this.initArenaBoundaryMarker();
    this.initSpeciesNest();
    this.initEditorSandbox();
  }

  public getBiomeAt(x: number, z: number): { id: BiomeType; name: string } {
    const radius = Math.sqrt(x * x + z * z);
    if (this.currentStage === 'creature_stage') {
      if (radius < 45) {
        return { id: 'pradera_luminosa', name: 'Nido Costero Primigenio' };
      }
      if (x < 0) {
        return { id: 'fosa_termal', name: 'Costa Termal Volcánica' };
      }
      return { id: 'arrecife_abisal', name: 'Pradera de Helechos Costeros' };
    }

    if (radius < 52) {
      return { id: 'pradera_luminosa', name: 'Pradera de Cloroplastos' };
    }
    if (z < -65) {
      return { id: 'arrecife_abisal', name: 'Campos de Fósiles Abisales' };
    }
    if (z > 65 && x > -30) {
      return { id: 'pradera_luminosa', name: 'Bosque de Árboles de Cloroplastos' };
    }
    if (x < 0) {
      return { id: 'fosa_termal', name: 'Fosa Hidrotermal' };
    }
    return { id: 'arrecife_abisal', name: 'Mesetas de Coral Eléctrico' };
  }

  public getChloroplastTreePositions(maxRadius = 250): THREE.Vector3[] {
    const maxRSq = maxRadius * maxRadius;
    return this.chloroplastTreePositions.filter(
      (pos) => pos.x * pos.x + pos.z * pos.z <= maxRSq
    );
  }

  public isNearThermalVent(x: number, z: number): boolean {
    for (let i = 0; i < this.ventPositions.length; i++) {
      const vp = this.ventPositions[i];
      const dx = x - vp.x;
      const dz = z - vp.z;
      if (dx * dx + dz * dz <= 9.0 * 9.0) {
        return true;
      }
    }
    return false;
  }

  public isNearNest(x: number, z: number): boolean {
    if (this.currentStage !== 'creature_stage') return false;
    return x * x + z * z <= 7.2 * 7.2;
  }

  /**
   * Spore Depth Plane Staging across 5 Cellular Growth Stages (1 -> 2 -> 3 -> 4 -> 5):
   * Adjusts fog clarity, arena perimeter ring, chloroplast tree evolutionary height, and deep silhouette elevation.
   */
  public setGrowthStageDepthLayer(stage: CellularGrowthStage): void {
    this.currentGrowthStage = stage;
    const fogFactors: Record<CellularGrowthStage, number> = {
      1: 1.0,
      2: 0.88,
      3: 0.76,
      4: 0.65,
      5: 0.54,
    };
    this.stageFogFactor = fogFactors[stage] ?? 1.0;

    // Update arena perimeter caustic ring to match active stage radius (90 -> 135 -> 180 -> 220 -> 250)
    const stageRadii: Record<CellularGrowthStage, number> = {
      1: 90,
      2: 135,
      3: 180,
      4: 220,
      5: 250,
    };
    const activeRadius = stageRadii[stage] ?? 90;
    if (this.causticRingMesh) {
      const ringScale = activeRadius / GAME_CONFIG.WORLD.ARENA_RADIUS;
      this.causticRingMesh.scale.set(ringScale, 1, ringScale);
    }

    this.updateChloroplastTreesForStage(stage);
  }

  public setStageEnvironment(stage: EvolutionaryStage): void {
    this.currentStage = stage;
    const isLand = stage === 'creature_stage';

    this.nestGroup.visible = isLand;
    this.causticRingMesh.visible = !isLand;
    for (const s of this.abyssalSilhouettes) {
      s.group.visible = !isLand;
    }

    if (isLand) {
      this.fogExp2.density = 0.0045;
      this.seabedMat.color.setHex(0xfde68a);
      this.hemiLight.groundColor.setHex(0x3f6212);
      this.hemiLight.intensity = 1.45;
      this.rimLight.color.setHex(0xfef08a);
      this.rimLight.intensity = 1.1;
    } else {
      this.fogExp2.density =
        GAME_CONFIG.WORLD.FOG_DENSITY * this.stageFogFactor;
      this.seabedMat.color.setHex(0xffffff);
      this.hemiLight.groundColor.setHex(0x062033);
      this.hemiLight.intensity = 1.15;
      this.rimLight.color.setHex(0x38bdf8);
      this.rimLight.intensity = 0.85;
    }
  }

  public setVisionFogMultiplier(multiplier: number): void {
    this.fogDensityMultiplier = THREE.MathUtils.clamp(multiplier, 0.45, 1.85);
  }

  public setUserFogDistancePercent(percent: number): void {
    const clamped = THREE.MathUtils.clamp(percent, 50, 150);
    // Higher fog distance percent = less dense fog (multiplier = 100 / clamped)
    this.userFogDistanceMultiplier = 100 / clamped;
  }

  public setParticleQuality(quality: 'low' | 'medium' | 'high'): void {
    this.currentParticleQuality = quality;
    if (this.planktonPoints) {
      this.planktonPoints.visible =
        !this.isEditorSandboxActive && quality !== 'low';
      const mat = this.planktonPoints.material as THREE.PointsMaterial;
      mat.opacity = quality === 'high' ? 0.65 : 0.42;
    }
    if (this.ventBubblesPoints) {
      this.ventBubblesPoints.visible =
        !this.isEditorSandboxActive && quality !== 'low';
    }
  }

  /**
   * Switches the 3D scene between the open aquatic/terrestrial ecosystem and
   * an isolated Spore-style Petri Dish Laboratory Sandbox with 3-point studio lighting.
   */
  public setEditorSandboxMode(
    active: boolean,
    playerPosition?: THREE.Vector3
  ): void {
    this.isEditorSandboxActive = active;
    const showWorld = !active;
    const isLand = this.currentStage === 'creature_stage';

    // Toggle world terrain, flora, corals, vents, silhouettes & particles
    this.seabedMesh.visible = showWorld;
    this.rocksInstanced.visible = showWorld;
    this.rockCapsInstanced.visible = showWorld;
    this.kelpStalksInstanced.visible = showWorld;
    this.kelpBladesInstanced.visible = showWorld;
    if (this.chloroplastCoreInstanced) {
      this.chloroplastCoreInstanced.visible = showWorld;
    }
    this.electricCoralInstanced.visible = showWorld;
    this.brainCoralInstanced.visible = showWorld;
    this.giantAnemoneInstanced.visible = showWorld;
    this.fossilShellsInstanced.visible = showWorld;
    this.causticRingMesh.visible = showWorld && !isLand;
    this.nestGroup.visible = showWorld && isLand;

    for (let i = 0; i < this.ventGroups.length; i++) {
      this.ventGroups[i].visible = showWorld;
    }
    for (let i = 0; i < this.ventAuraMeshes.length; i++) {
      this.ventAuraMeshes[i].visible = showWorld;
    }
    for (let i = 0; i < this.abyssalSilhouettes.length; i++) {
      this.abyssalSilhouettes[i].group.visible = showWorld && !isLand;
    }

    this.planktonPoints.visible =
      showWorld && this.currentParticleQuality !== 'low';
    this.ventBubblesPoints.visible =
      showWorld && this.currentParticleQuality !== 'low';

    // Toggle 3D Petri Dish Sandbox & 3-Point Studio Lighting Rig
    this.sandboxGroup.visible = active;
    this.sandboxKeyLight.visible = active;
    this.sandboxFillLight.visible = active;
    this.sandboxRimLight.visible = active;

    if (active) {
      const px = playerPosition ? playerPosition.x : 0;
      const py = playerPosition
        ? playerPosition.y
        : GAME_CONFIG.WORLD.SWIM_PLANE_Y;
      const pz = playerPosition ? playerPosition.z : 0;

      this.sandboxGroup.position.set(px, py - 1.25, pz);
      this.sandboxKeyLight.position.set(px + 2.5, py + 18.0, pz + 3.5);
      this.sandboxKeyLight.target.position.set(px, py, pz);
      this.sandboxKeyLight.target.updateMatrixWorld();

      this.sandboxFillLight.position.set(px - 14.0, py + 9.0, pz + 12.0);
      this.sandboxFillLight.target.position.set(px, py, pz);
      this.sandboxFillLight.target.updateMatrixWorld();

      this.sandboxRimLight.position.set(px + 12.0, py + 7.5, pz - 14.0);
      this.sandboxRimLight.target.position.set(px, py, pz);
      this.sandboxRimLight.target.updateMatrixWorld();

      this.dirLight.intensity = 0.65;
      this.hemiLight.color.setHex(0x67e8f9);
      this.hemiLight.groundColor.setHex(0x041e2e);
      this.hemiLight.intensity = 1.25;
      this.bgColor.setHex(0x02101b);
      this.fogExp2.color.copy(this.bgColor);
      this.fogExp2.density = 0.0022;
    } else {
      this.dirLight.intensity = 2.1;
      this.setStageEnvironment(this.currentStage);
    }
  }

  private initEnvironmentMap(renderer: THREE.WebGLRenderer): void {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const renderTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    this.envTexture = renderTarget.texture;
    this.scene.environment = this.envTexture;
    roomEnv.dispose();
    pmremGenerator.dispose();
  }

  private initLights(): void {
    this.hemiLight = new THREE.HemisphereLight(0x5eead4, 0x062033, 1.15);
    this.hemiLight.position.set(0, 65, 0);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xa5f3fc, 2.1);
    this.dirLight.position.set(35, 70, 30);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    const d = 85;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.camera.near = 5;
    this.dirLight.shadow.camera.far = 160;
    this.dirLight.shadow.bias = -0.0005;
    this.dirLight.shadow.normalBias = 0.02;
    this.scene.add(this.dirLight);

    this.rimLight = new THREE.DirectionalLight(0x38bdf8, 0.85);
    this.rimLight.position.set(-45, 28, -40);
    this.scene.add(this.rimLight);
  }

  private initSeabed(): void {
    const size = 580;
    const segments = 136;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);

    const posAttr = geometry.attributes.position;
    const colors = new Float32Array(posAttr.count * 3);

    const deepColor = new THREE.Color(0x041b2d);
    const ridgeColor = new THREE.Color(0x0c4a6e);
    const causticTint = new THREE.Color(0x0d9488);
    const thermalTint = new THREE.Color(0x7c2d12);
    const reefTint = new THREE.Color(0x312e81);
    const fossilTint = new THREE.Color(0x3f3f46);

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const vy = getGroundHeightAt(vx, vz);
      posAttr.setY(i, vy);

      const heightNorm = THREE.MathUtils.clamp((vy + 8.5) / 10.5, 0, 1);
      _color.copy(deepColor).lerp(ridgeColor, heightNorm);

      const dist = Math.sqrt(vx * vx + vz * vz);
      if (vz < -65) {
        _color.lerp(fossilTint, 0.32);
      } else if (dist >= 48 && vx < 0) {
        _color.lerp(thermalTint, 0.28);
      } else if (dist >= 48 && vx >= 0) {
        _color.lerp(reefTint, 0.3);
      }

      const causticWave =
        Math.sin(vx * 0.25) * Math.cos(vz * 0.25) * 0.5 + 0.5;
      if (causticWave > 0.68 && vy < 1.0) {
        _color.lerp(causticTint, (causticWave - 0.68) * 0.65);
      }

      colors[i * 3] = _color.r;
      colors[i * 3 + 1] = _color.g;
      colors[i * 3 + 2] = _color.b;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    this.seabedMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.06,
    });

    this.seabedMesh = new THREE.Mesh(geometry, this.seabedMat);
    this.seabedMesh.receiveShadow = true;
    this.scene.add(this.seabedMesh);

    this.disposableGeometries.push(geometry);
    this.disposableMaterials.push(this.seabedMat);
  }

  private initRocks(): void {
    const rockCount = 190;
    const baseGeo = new THREE.DodecahedronGeometry(1.5, 1);
    baseGeo.translate(0, 0.78, 0);
    const capGeo = new THREE.IcosahedronGeometry(0.95, 1);
    capGeo.translate(0.35, 1.4, 0.2);

    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a4c,
      roughness: 0.82,
      metalness: 0.12,
    });
    const capMat = new THREE.MeshStandardMaterial({
      color: 0x134e4a,
      roughness: 0.55,
      metalness: 0.18,
    });

    this.rocksInstanced = new THREE.InstancedMesh(baseGeo, baseMat, rockCount);
    this.rockCapsInstanced = new THREE.InstancedMesh(capGeo, capMat, rockCount);
    this.rocksInstanced.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    this.rockCapsInstanced.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    this.rocksInstanced.frustumCulled = true;
    this.rockCapsInstanced.frustumCulled = true;
    this.rocksInstanced.castShadow = true;
    this.rocksInstanced.receiveShadow = true;

    for (let i = 0; i < rockCount; i++) {
      const isRim = i >= 120;
      const angle = (i / rockCount) * Math.PI * 2 + i * 1.618;
      const radius = isRim
        ? GAME_CONFIG.WORLD.ARENA_RADIUS + (i % 9) * 2.8
        : 18 + ((i * 23) % (GAME_CONFIG.WORLD.ARENA_RADIUS - 24));

      const rx = Math.cos(angle) * radius;
      const rz = Math.sin(angle) * radius;
      const ry = getGroundHeightAt(rx, rz) - 0.3;

      const scaleXZ = isRim ? 2.8 + (i % 5) * 0.85 : 1.0 + (i % 5) * 0.55;
      const scaleY = isRim ? 3.2 + (i % 4) * 1.1 : 1.3 + (i % 4) * 0.85;

      _dummy.position.set(rx, ry, rz);
      _dummy.rotation.set(
        ((i % 5) - 2) * 0.08,
        (i * 1.1) % (Math.PI * 2),
        ((i % 3) - 1) * 0.08
      );
      _dummy.scale.set(scaleXZ, scaleY, scaleXZ);
      _dummy.updateMatrix();

      this.rocksInstanced.setMatrixAt(i, _dummy.matrix);
      this.rockCapsInstanced.setMatrixAt(i, _dummy.matrix);

      const shade = 0.72 + (i % 5) * 0.08;
      _color.setRGB(0.12 * shade, 0.26 * shade, 0.34 * shade);
      this.rocksInstanced.setColorAt(i, _color);

      _color.setRGB(0.08 * shade, 0.38 * shade, 0.35 * shade);
      this.rockCapsInstanced.setColorAt(i, _color);
    }

    this.rocksInstanced.instanceMatrix.needsUpdate = true;
    if (this.rocksInstanced.instanceColor) {
      this.rocksInstanced.instanceColor.needsUpdate = true;
    }
    this.rocksInstanced.computeBoundingSphere();

    this.rockCapsInstanced.instanceMatrix.needsUpdate = true;
    if (this.rockCapsInstanced.instanceColor) {
      this.rockCapsInstanced.instanceColor.needsUpdate = true;
    }
    this.rockCapsInstanced.computeBoundingSphere();

    this.scene.add(this.rocksInstanced);
    this.scene.add(this.rockCapsInstanced);

    this.disposableGeometries.push(baseGeo, capGeo);
    this.disposableMaterials.push(baseMat, capMat);
  }

  private initUnderwaterFlora(): void {
    // Procedural Chloroplast Tree System:
    // 1. Translucent Cellulose Trunk with organic curve & upper bifurcation
    const stalkGeo = new THREE.CylinderGeometry(0.14, 0.34, 5.4, 9, 6);
    stalkGeo.translate(0, 2.7, 0);
    const stalkPos = stalkGeo.attributes.position as THREE.BufferAttribute;
    for (let v = 0; v < stalkPos.count; v++) {
      const vy = stalkPos.getY(v);
      const heightRatio = vy / 5.4;
      // Organic sinusoidal S-curve along the cellulose trunk + flared root base
      const curveX = Math.sin(heightRatio * Math.PI * 1.35) * 0.28;
      const curveZ = Math.cos(heightRatio * Math.PI * 0.9) * 0.16 - 0.16;
      const rootFlare = heightRatio < 0.18 ? 1.0 + (0.18 - heightRatio) * 1.9 : 1.0;
      const crownFlare = heightRatio > 0.78 ? 1.0 + (heightRatio - 0.78) * 2.2 : 1.0;
      stalkPos.setX(v, stalkPos.getX(v) * rootFlare * crownFlare + curveX);
      stalkPos.setZ(v, stalkPos.getZ(v) * rootFlare * crownFlare + curveZ);
    }
    stalkGeo.computeVertexNormals();

    // 2. Chloroplast Canopy Fronds (clustered flattened lenticular capsules at the crown)
    const bladeGeo = new THREE.SphereGeometry(0.92, 14, 12);
    bladeGeo.scale(1.45, 0.58, 1.25);
    bladeGeo.translate(0.22, 5.45, 0);

    // 3. Inner Thylakoid Grana Core (glowing photosynthetic discs visible inside the canopy)
    const coreGeo = new THREE.TorusKnotGeometry(0.46, 0.13, 28, 7, 2, 3);
    coreGeo.rotateX(Math.PI / 2);
    coreGeo.scale(1.15, 0.45, 1.15);
    coreGeo.translate(0.22, 5.45, 0);

    const stalkMat = new THREE.MeshPhysicalMaterial({
      color: 0x0d9488,
      emissive: 0x065f46,
      emissiveIntensity: 0.35,
      roughness: 0.26,
      metalness: 0.05,
      transmission: 0.45,
      thickness: 0.9,
      ior: 1.38,
      clearcoat: 0.85,
      transparent: true,
      opacity: 0.9,
    });

    this.chloroplastFrondMat = new THREE.MeshStandardMaterial({
      color: 0x34d399,
      emissive: 0x10b981,
      emissiveIntensity: 0.78,
      roughness: 0.22,
      metalness: 0.08,
      transparent: true,
      opacity: 0.86,
    });

    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xa7f3d0,
      transparent: true,
      opacity: 0.75,
    });

    this.kelpStalksInstanced = new THREE.InstancedMesh(
      stalkGeo,
      stalkMat,
      this.kelpCount
    );
    this.kelpBladesInstanced = new THREE.InstancedMesh(
      bladeGeo,
      this.chloroplastFrondMat,
      this.kelpCount
    );
    this.chloroplastCoreInstanced = new THREE.InstancedMesh(
      coreGeo,
      coreMat,
      this.kelpCount
    );
    this.kelpStalksInstanced.frustumCulled = true;
    this.kelpBladesInstanced.frustumCulled = true;
    this.chloroplastCoreInstanced.frustumCulled = true;

    this.chloroplastTreePositions.length = 0;
    this.chloroplastTreeBaseScales.length = 0;

    for (let i = 0; i < this.kelpCount; i++) {
      let kx: number;
      let kz: number;
      let isGiantKelpZone = false;

      if (i < 36) {
        // Inner Stage 1 Chloroplast Sprouts ring (12m .. 82m) so player finds trees immediately
        const a = (i / 36) * Math.PI * 2 + (i % 3) * 0.18;
        const r = 14 + ((i * 17) % 68);
        kx = Math.cos(a) * r;
        kz = Math.sin(a) * r;
      } else if (i < 115) {
        isGiantKelpZone = true;
        const a = ((i - 36) / 79) * Math.PI * 0.85 + Math.PI * 0.08;
        const r = 52 + ((i * 19) % 175);
        kx = Math.cos(a) * r;
        kz = Math.abs(Math.sin(a) * r) + 32;
      } else {
        const angle = i * 2.39996;
        const radius =
          18 +
          Math.sqrt(i / this.kelpCount) * (GAME_CONFIG.WORLD.ARENA_RADIUS - 12);
        kx = Math.cos(angle) * radius;
        kz = Math.sin(angle) * radius;
      }

      const ky = getGroundHeightAt(kx, kz) - 0.15;
      const baseScaleY = isGiantKelpZone
        ? 1.35 + (i % 6) * 0.18
        : 0.85 + (i % 7) * 0.2;
      const baseScaleXZ = isGiantKelpZone
        ? 1.15 + (i % 4) * 0.2
        : 0.85 + (i % 4) * 0.16;

      const rotX = ((i % 5) - 2) * 0.04;
      const rotY = (i * 0.7) % (Math.PI * 2);
      const rotZ = ((i % 3) - 1) * 0.04;

      this.chloroplastTreePositions.push(new THREE.Vector3(kx, ky, kz));
      this.chloroplastTreeBaseScales.push({
        scaleXZ: baseScaleXZ,
        scaleY: baseScaleY,
        rotX,
        rotY,
        rotZ,
        isGiantZone: isGiantKelpZone,
      });

      const hueShift = (i % 5) * 0.025;
      _color.setHSL(0.44 + hueShift, 0.78, 0.38 + (i % 3) * 0.05);
      this.kelpStalksInstanced.setColorAt(i, _color);

      _color.setHSL(0.46 + hueShift, 0.9, 0.56);
      this.kelpBladesInstanced.setColorAt(i, _color);

      _color.setHSL(0.48 + hueShift, 0.95, 0.72);
      this.chloroplastCoreInstanced.setColorAt(i, _color);
    }

    if (this.kelpStalksInstanced.instanceColor) {
      this.kelpStalksInstanced.instanceColor.needsUpdate = true;
    }
    if (this.kelpBladesInstanced.instanceColor) {
      this.kelpBladesInstanced.instanceColor.needsUpdate = true;
    }
    if (this.chloroplastCoreInstanced.instanceColor) {
      this.chloroplastCoreInstanced.instanceColor.needsUpdate = true;
    }

    this.updateChloroplastTreesForStage(1);

    this.scene.add(this.kelpStalksInstanced);
    this.scene.add(this.kelpBladesInstanced);
    this.scene.add(this.chloroplastCoreInstanced);

    this.disposableGeometries.push(stalkGeo, bladeGeo, coreGeo);
    this.disposableMaterials.push(
      stalkMat,
      this.chloroplastFrondMat,
      coreMat
    );
  }

  /**
   * Scales Chloroplast Trees across the 5 evolutionary cellular stages:
   * - Stage 1: Small chloroplast sprouts (2m-3m)
   * - Stage 2: Branched chloroplast colonies (5m)
   * - Stage 3: Medium chloroplast trees (8m-10m)
   * - Stage 4: Giant underwater chloroplast forests (14m)
   * - Stage 5: Colossal ancestral chloroplast trees (18m-22m)
   */
  private updateChloroplastTreesForStage(stage: CellularGrowthStage): void {
    if (!this.kelpStalksInstanced || !this.kelpBladesInstanced) return;

    const stageHeightMultipliers: Record<CellularGrowthStage, number> = {
      1: 0.52,
      2: 0.85,
      3: 1.25,
      4: 1.72,
      5: 2.25,
    };
    const stageWidthMultipliers: Record<CellularGrowthStage, number> = {
      1: 0.68,
      2: 0.88,
      3: 1.12,
      4: 1.38,
      5: 1.68,
    };

    const hMult = stageHeightMultipliers[stage] ?? 1.0;
    const wMult = stageWidthMultipliers[stage] ?? 1.0;

    for (let i = 0; i < this.chloroplastTreePositions.length; i++) {
      const pos = this.chloroplastTreePositions[i];
      const cfg = this.chloroplastTreeBaseScales[i];

      _dummy.position.copy(pos);
      _dummy.rotation.set(cfg.rotX, cfg.rotY, cfg.rotZ);
      _dummy.scale.set(
        cfg.scaleXZ * wMult,
        cfg.scaleY * hMult,
        cfg.scaleXZ * wMult
      );
      _dummy.updateMatrix();

      this.kelpStalksInstanced.setMatrixAt(i, _dummy.matrix);
      this.kelpBladesInstanced.setMatrixAt(i, _dummy.matrix);
      this.chloroplastCoreInstanced.setMatrixAt(i, _dummy.matrix);
    }

    this.kelpStalksInstanced.instanceMatrix.needsUpdate = true;
    this.kelpBladesInstanced.instanceMatrix.needsUpdate = true;
    this.chloroplastCoreInstanced.instanceMatrix.needsUpdate = true;
    this.kelpStalksInstanced.computeBoundingSphere();
    this.kelpBladesInstanced.computeBoundingSphere();
    this.chloroplastCoreInstanced.computeBoundingSphere();
  }

  /**
   * Initializes static InstancedMeshes with Frustum Culling for:
   * 1) Mesetas de Coral Eléctrico (crystalline cyan-flashing formations)
   * 2) Corales Cerebro & Anémonas Gigantes
   * 3) Campos de Fósiles Abisales (giant fossilized ammonite shells & tectonic ribs)
   */
  private initThemedInstancedZones(): void {
    // 1. Electric Coral Plateaus (East / Southeast sector)
    const coralCount = 90;
    const coralGeo = new THREE.ConeGeometry(0.65, 3.6, 6);
    coralGeo.translate(0, 1.8, 0);
    this.electricCoralMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.95,
      roughness: 0.2,
      metalness: 0.45,
      flatShading: true,
    });

    this.electricCoralInstanced = new THREE.InstancedMesh(
      coralGeo,
      this.electricCoralMat,
      coralCount
    );
    this.electricCoralInstanced.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    this.electricCoralInstanced.frustumCulled = true;

    for (let i = 0; i < coralCount; i++) {
      const angle = (i / coralCount) * Math.PI * 1.1 - Math.PI * 0.45;
      const r = 42 + ((i * 29) % 180);
      const cx = Math.abs(Math.cos(angle) * r) + 24;
      const cz = Math.sin(angle) * r;
      const cy = getGroundHeightAt(cx, cz) - 0.2;

      _dummy.position.set(cx, cy, cz);
      _dummy.rotation.set(
        ((i % 5) - 2) * 0.14,
        (i * 1.3) % (Math.PI * 2),
        ((i % 3) - 1) * 0.14
      );
      const s = 0.8 + (i % 5) * 0.35;
      _dummy.scale.set(s, s * (1.0 + (i % 4) * 0.28), s);
      _dummy.updateMatrix();
      this.electricCoralInstanced.setMatrixAt(i, _dummy.matrix);

      _color.setHSL(0.52 + (i % 4) * 0.03, 0.92, 0.58);
      this.electricCoralInstanced.setColorAt(i, _color);
    }
    this.electricCoralInstanced.instanceMatrix.needsUpdate = true;
    if (this.electricCoralInstanced.instanceColor) {
      this.electricCoralInstanced.instanceColor.needsUpdate = true;
    }
    this.electricCoralInstanced.computeBoundingSphere();
    this.scene.add(this.electricCoralInstanced);

    // 2. Brain Corals & Giant Anemones
    const reefPropCount = 85;
    const brainGeo = new THREE.IcosahedronGeometry(1.15, 2);
    brainGeo.scale(1.2, 0.72, 1.2);
    brainGeo.translate(0, 0.55, 0);
    const brainMat = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0x6b21a8,
      emissiveIntensity: 0.45,
      roughness: 0.65,
      metalness: 0.1,
    });

    const anemoneGeo = new THREE.TorusKnotGeometry(0.75, 0.22, 36, 8, 2, 3);
    anemoneGeo.rotateX(Math.PI / 2);
    anemoneGeo.translate(0, 1.25, 0);
    const anemoneMat = new THREE.MeshStandardMaterial({
      color: 0xf472b6,
      emissive: 0xdb2777,
      emissiveIntensity: 0.65,
      roughness: 0.35,
    });

    this.brainCoralInstanced = new THREE.InstancedMesh(
      brainGeo,
      brainMat,
      reefPropCount
    );
    this.giantAnemoneInstanced = new THREE.InstancedMesh(
      anemoneGeo,
      anemoneMat,
      reefPropCount
    );
    this.brainCoralInstanced.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    this.giantAnemoneInstanced.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    this.brainCoralInstanced.frustumCulled = true;
    this.giantAnemoneInstanced.frustumCulled = true;

    for (let i = 0; i < reefPropCount; i++) {
      const a = i * 2.39996 + 0.5;
      const r = 20 + Math.sqrt(i / reefPropCount) * 195;
      const bx = Math.cos(a) * r;
      const bz = Math.sin(a) * r;
      const by = getGroundHeightAt(bx, bz) - 0.15;

      _dummy.position.set(bx, by, bz);
      _dummy.rotation.set(0, (i * 0.9) % (Math.PI * 2), 0);
      const s = 0.85 + (i % 4) * 0.32;
      _dummy.scale.setScalar(s);
      _dummy.updateMatrix();

      this.brainCoralInstanced.setMatrixAt(i, _dummy.matrix);
      this.giantAnemoneInstanced.setMatrixAt(i, _dummy.matrix);

      _color.setHSL(0.78 + (i % 4) * 0.04, 0.78, 0.55);
      this.brainCoralInstanced.setColorAt(i, _color);
      _color.setHSL(0.9 + (i % 3) * 0.04, 0.85, 0.62);
      this.giantAnemoneInstanced.setColorAt(i, _color);
    }

    this.brainCoralInstanced.instanceMatrix.needsUpdate = true;
    this.giantAnemoneInstanced.instanceMatrix.needsUpdate = true;
    if (this.brainCoralInstanced.instanceColor) {
      this.brainCoralInstanced.instanceColor.needsUpdate = true;
    }
    if (this.giantAnemoneInstanced.instanceColor) {
      this.giantAnemoneInstanced.instanceColor.needsUpdate = true;
    }
    this.brainCoralInstanced.computeBoundingSphere();
    this.giantAnemoneInstanced.computeBoundingSphere();

    this.scene.add(this.brainCoralInstanced);
    this.scene.add(this.giantAnemoneInstanced);

    // 3. Abyssal Fossil Fields (Giant Ammonite Shells & Tectonic Ribs in North Sector)
    const fossilCount = 65;
    const shellGeo = new THREE.TorusGeometry(1.65, 0.58, 10, 22, Math.PI * 1.65);
    shellGeo.translate(0, 0.9, 0);
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0xd6d3d1,
      emissive: 0x44403c,
      emissiveIntensity: 0.25,
      roughness: 0.75,
      metalness: 0.15,
    });

    this.fossilShellsInstanced = new THREE.InstancedMesh(
      shellGeo,
      shellMat,
      fossilCount
    );
    this.fossilShellsInstanced.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    this.fossilShellsInstanced.frustumCulled = true;

    for (let i = 0; i < fossilCount; i++) {
      const a = (i / fossilCount) * Math.PI * 1.2 - Math.PI * 1.1;
      const r = 48 + ((i * 31) % 175);
      const fx = Math.cos(a) * r;
      const fz = -Math.abs(Math.sin(a) * r) - 28;
      const fy = getGroundHeightAt(fx, fz) - 0.2;

      _dummy.position.set(fx, fy, fz);
      _dummy.rotation.set(
        0.25 + (i % 3) * 0.15,
        (i * 1.7) % (Math.PI * 2),
        (i % 4) * 0.2
      );
      const s = 1.0 + (i % 5) * 0.45;
      _dummy.scale.setScalar(s);
      _dummy.updateMatrix();
      this.fossilShellsInstanced.setMatrixAt(i, _dummy.matrix);

      const shade = 0.7 + (i % 4) * 0.08;
      _color.setRGB(0.84 * shade, 0.81 * shade, 0.76 * shade);
      this.fossilShellsInstanced.setColorAt(i, _color);
    }

    this.fossilShellsInstanced.instanceMatrix.needsUpdate = true;
    if (this.fossilShellsInstanced.instanceColor) {
      this.fossilShellsInstanced.instanceColor.needsUpdate = true;
    }
    this.fossilShellsInstanced.computeBoundingSphere();
    this.scene.add(this.fossilShellsInstanced);

    this.disposableGeometries.push(coralGeo, brainGeo, anemoneGeo, shellGeo);
    this.disposableMaterials.push(
      this.electricCoralMat,
      brainMat,
      anemoneMat,
      shellMat
    );
  }

  private initHydrothermalVents(): void {
    const chimneyGeo = new THREE.CylinderGeometry(1.1, 2.6, 5.2, 12, 1, true);
    chimneyGeo.translate(0, 2.6, 0);
    const chimneyMat = new THREE.MeshStandardMaterial({
      color: 0x292524,
      emissive: 0x7c2d12,
      emissiveIntensity: 0.45,
      roughness: 0.85,
      metalness: 0.2,
      side: THREE.DoubleSide,
    });

    const craterRingGeo = new THREE.TorusGeometry(1.12, 0.25, 10, 24);
    craterRingGeo.rotateX(Math.PI / 2);
    const craterRingMat = new THREE.MeshStandardMaterial({
      color: 0xfb923c,
      emissive: 0xea580c,
      emissiveIntensity: 1.4,
      roughness: 0.3,
    });

    const auraRingGeo = new THREE.RingGeometry(2.2, 8.2, 36);
    auraRingGeo.rotateX(-Math.PI / 2);

    for (let i = 0; i < THERMAL_VENT_COORDS.length; i++) {
      const [vx, vz] = THERMAL_VENT_COORDS[i];
      const vy = getGroundHeightAt(vx, vz) - 0.3;
      const ventPos = new THREE.Vector3(vx, vy, vz);
      this.ventPositions.push(ventPos);

      const ventGroup = new THREE.Group();
      ventGroup.position.copy(ventPos);

      const chimneyMesh = new THREE.Mesh(chimneyGeo, chimneyMat);
      ventGroup.add(chimneyMesh);

      const craterMesh = new THREE.Mesh(craterRingGeo, craterRingMat);
      craterMesh.position.y = 5.15;
      ventGroup.add(craterMesh);

      const auraMat = new THREE.MeshBasicMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      this.ventAuraMats.push(auraMat);
      this.disposableMaterials.push(auraMat);

      const auraMesh = new THREE.Mesh(auraRingGeo, auraMat);
      auraMesh.position.set(vx, GAME_CONFIG.WORLD.SWIM_PLANE_Y - 1.1, vz);
      this.ventAuraMeshes.push(auraMesh);
      this.ventGroups.push(ventGroup);
      this.scene.add(auraMesh);
      this.scene.add(ventGroup);
    }

    const bubbleGeo = new THREE.BufferGeometry();
    const bubbleColors = new Float32Array(this.ventBubbleCount * 3);

    for (let i = 0; i < this.ventBubbleCount; i++) {
      const ventIdx = i % this.ventPositions.length;
      const vp = this.ventPositions[ventIdx];
      const angle = Math.random() * Math.PI * 2;
      const spread = Math.random() * 1.6;
      const bx = vp.x + Math.cos(angle) * spread;
      const bz = vp.z + Math.sin(angle) * spread;
      const by = vp.y + 4.8 + Math.random() * 9.5;

      this.ventBubbleBaseXZ[i * 2] = bx;
      this.ventBubbleBaseXZ[i * 2 + 1] = bz;

      this.ventBubblePositions[i * 3] = bx;
      this.ventBubblePositions[i * 3 + 1] = by;
      this.ventBubblePositions[i * 3 + 2] = bz;

      _color.setHSL(0.08 + (i % 3) * 0.14, 0.95, 0.68);
      bubbleColors[i * 3] = _color.r;
      bubbleColors[i * 3 + 1] = _color.g;
      bubbleColors[i * 3 + 2] = _color.b;
    }

    bubbleGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(this.ventBubblePositions, 3)
    );
    bubbleGeo.setAttribute(
      'color',
      new THREE.BufferAttribute(bubbleColors, 3)
    );

    const bubbleMat = new THREE.PointsMaterial({
      size: 0.42,
      vertexColors: true,
      transparent: true,
      opacity: 0.78,
      sizeAttenuation: true,
      depthWrite: false,
    });

    this.ventBubblesPoints = new THREE.Points(bubbleGeo, bubbleMat);
    this.scene.add(this.ventBubblesPoints);

    this.disposableGeometries.push(
      chimneyGeo,
      craterRingGeo,
      auraRingGeo,
      bubbleGeo
    );
    this.disposableMaterials.push(chimneyMat, craterRingMat, bubbleMat);
  }

  private initAbyssalSilhouettes(): void {
    // 6 Colossal dark-translucent background organisms swimming in the deep stratum (Spore depth layer effect)
    const headGeo = new THREE.CapsuleGeometry(2.8, 5.2, 12, 18);
    headGeo.rotateX(Math.PI / 2);
    headGeo.scale(1.25, 0.52, 1.0);

    const finGeo = new THREE.ConeGeometry(2.4, 7.5, 8);
    finGeo.rotateZ(Math.PI / 2);
    finGeo.scale(0.35, 1.0, 1.4);

    const tailSegGeo = new THREE.SphereGeometry(1.75, 10, 10);
    tailSegGeo.scale(0.9, 0.48, 1.85);

    const silhouetteMat = new THREE.MeshBasicMaterial({
      color: 0x0a344f,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });

    const biolumSpotGeo = new THREE.SphereGeometry(0.55, 8, 8);
    const biolumSpotMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    });

    const configs = [
      { cx: -16, cz: -14, radius: 28, speed: 0.15, scale: 1.25, phase: 0.2 },
      { cx: 36, cz: 24, radius: 36, speed: -0.12, scale: 1.45, phase: 1.7 },
      { cx: -38, cz: 34, radius: 32, speed: 0.13, scale: 1.18, phase: 3.1 },
      { cx: 28, cz: -38, radius: 34, speed: -0.13, scale: 1.35, phase: 4.6 },
      { cx: -92, cz: -65, radius: 48, speed: 0.11, scale: 1.65, phase: 2.3 },
      { cx: 88, cz: 72, radius: 52, speed: -0.1, scale: 1.75, phase: 5.2 },
    ];

    for (let i = 0; i < configs.length; i++) {
      const cfg = configs[i];
      const group = new THREE.Group();
      group.scale.setScalar(cfg.scale);

      const bodyMesh = new THREE.Mesh(headGeo, silhouetteMat);
      group.add(bodyMesh);

      for (const side of [-1, 1]) {
        const spot = new THREE.Mesh(biolumSpotGeo, biolumSpotMat);
        spot.position.set(side * 2.1, 0.4, -2.4);
        group.add(spot);
      }

      const fins: THREE.Mesh[] = [];
      for (const side of [-1, 1]) {
        const fin = new THREE.Mesh(finGeo, silhouetteMat);
        fin.position.set(side * 4.5, 0, -0.5);
        if (side === 1) {
          fin.rotation.z = Math.PI;
        }
        group.add(fin);
        fins.push(fin);
      }

      const tailSegments: THREE.Mesh[] = [];
      for (let t = 0; t < 4; t++) {
        const seg = new THREE.Mesh(tailSegGeo, silhouetteMat);
        seg.scale.setScalar(1 - t * 0.2);
        seg.position.set(0, 0, 4.8 + t * 3.1);
        group.add(seg);
        tailSegments.push(seg);
      }

      group.position.set(cfg.cx + cfg.radius, -4.8, cfg.cz);
      this.scene.add(group);

      this.abyssalSilhouettes.push({
        group,
        orbitRadius: cfg.radius,
        orbitAngle: cfg.phase,
        orbitSpeed: cfg.speed,
        centerX: cfg.cx,
        centerZ: cfg.cz,
        baseScale: cfg.scale,
        tailSegments,
        fins,
        phaseOffset: cfg.phase,
      });
    }

    this.disposableGeometries.push(
      headGeo,
      finGeo,
      tailSegGeo,
      biolumSpotGeo
    );
    this.disposableMaterials.push(silhouetteMat, biolumSpotMat);
  }

  private initPlanktonParticles(): void {
    const geometry = new THREE.BufferGeometry();
    const colors = new Float32Array(this.planktonCount * 3);

    for (let i = 0; i < this.planktonCount; i++) {
      const r =
        Math.sqrt(Math.random()) * (GAME_CONFIG.WORLD.ARENA_RADIUS + 12);
      const theta = Math.random() * Math.PI * 2;
      this.planktonPositions[i * 3] = Math.cos(theta) * r;
      this.planktonPositions[i * 3 + 1] = -3.5 + Math.random() * 15.5;
      this.planktonPositions[i * 3 + 2] = Math.sin(theta) * r;

      _color.setHSL(
        0.48 + Math.random() * 0.12,
        0.8,
        0.65 + Math.random() * 0.25
      );
      colors[i * 3] = _color.r;
      colors[i * 3 + 1] = _color.g;
      colors[i * 3 + 2] = _color.b;
    }

    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.planktonPositions, 3)
    );
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.28,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      sizeAttenuation: true,
      depthWrite: false,
    });

    this.planktonPoints = new THREE.Points(geometry, material);
    this.scene.add(this.planktonPoints);

    this.disposableGeometries.push(geometry);
    this.disposableMaterials.push(material);
  }

  private initArenaBoundaryMarker(): void {
    const ringGeo = new THREE.RingGeometry(
      GAME_CONFIG.WORLD.ARENA_RADIUS - 0.8,
      GAME_CONFIG.WORLD.ARENA_RADIUS + 0.8,
      128
    );
    ringGeo.rotateX(-Math.PI / 2);

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.causticRingMesh = new THREE.Mesh(ringGeo, ringMat);
    this.causticRingMesh.position.y = GAME_CONFIG.WORLD.SWIM_PLANE_Y - 1.5;
    this.scene.add(this.causticRingMesh);

    this.disposableGeometries.push(ringGeo);
    this.disposableMaterials.push(ringMat);
  }

  private initSpeciesNest(): void {
    this.nestGroup = new THREE.Group();
    this.nestGroup.position.set(0, GAME_CONFIG.WORLD.SWIM_PLANE_Y - 1.15, 0);
    this.nestGroup.visible = false;

    const moundGeo = new THREE.CylinderGeometry(4.4, 5.6, 0.55, 28);
    const moundMat = new THREE.MeshStandardMaterial({
      color: 0x3f6212,
      emissive: 0x14532d,
      emissiveIntensity: 0.35,
      roughness: 0.8,
    });
    const moundMesh = new THREE.Mesh(moundGeo, moundMat);
    moundMesh.receiveShadow = true;
    this.nestGroup.add(moundMesh);

    const nestRimGeo = new THREE.TorusGeometry(4.5, 0.55, 12, 32);
    nestRimGeo.rotateX(Math.PI / 2);
    const nestRimMat = new THREE.MeshStandardMaterial({
      color: 0xa16207,
      roughness: 0.85,
    });
    const nestRimMesh = new THREE.Mesh(nestRimGeo, nestRimMat);
    nestRimMesh.position.y = 0.25;
    this.nestGroup.add(nestRimMesh);

    const stoneGeo = new THREE.DodecahedronGeometry(0.68, 1);
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x78716c,
      roughness: 0.75,
      metalness: 0.1,
    });
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const stone = new THREE.Mesh(stoneGeo, stoneMat);
      stone.position.set(Math.cos(angle) * 4.8, 0.42, Math.sin(angle) * 4.8);
      stone.scale.set(1.2, 0.85 + (i % 3) * 0.2, 1.1);
      stone.rotation.y = angle;
      this.nestGroup.add(stone);
    }

    const eggGeo = new THREE.SphereGeometry(0.46, 14, 14);
    eggGeo.scale(0.85, 1.28, 0.85);
    const eggMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.85,
      roughness: 0.25,
    });
    const eggOffsets: [number, number][] = [
      [-0.65, -0.4],
      [0.68, -0.35],
      [0.0, 0.65],
    ];
    for (const [ex, ez] of eggOffsets) {
      const egg = new THREE.Mesh(eggGeo, eggMat);
      egg.position.set(ex, 0.55, ez);
      this.nestGroup.add(egg);
      this.nestEggs.push(egg);
    }

    const auraGeo = new THREE.RingGeometry(2.2, 7.2, 48);
    auraGeo.rotateX(-Math.PI / 2);
    this.nestAuraMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const auraMesh = new THREE.Mesh(auraGeo, this.nestAuraMat);
    auraMesh.position.y = 0.12;
    this.nestGroup.add(auraMesh);

    this.scene.add(this.nestGroup);

    this.disposableGeometries.push(
      moundGeo,
      nestRimGeo,
      stoneGeo,
      eggGeo,
      auraGeo
    );
    this.disposableMaterials.push(
      moundMat,
      nestRimMat,
      stoneMat,
      eggMat,
      this.nestAuraMat
    );
  }

  /**
   * Initializes the isolated 3D Spore Laboratory Petri Dish platform, concentric/hexagonal
   * bioluminescent measurement rings, and a 3-point studio lighting rig for `status === 'editing'`.
   */
  private initEditorSandbox(): void {
    this.sandboxGroup = new THREE.Group();
    this.sandboxGroup.visible = false;

    // 1. Dark Polished Laboratory Petri Dish Base Disk
    const dishBaseGeo = new THREE.CylinderGeometry(14.5, 15.2, 0.28, 64);
    dishBaseGeo.translate(0, -0.14, 0);
    const dishBaseMat = new THREE.MeshStandardMaterial({
      color: 0x031826,
      emissive: 0x042f40,
      emissiveIntensity: 0.35,
      roughness: 0.25,
      metalness: 0.35,
    });
    const dishBaseMesh = new THREE.Mesh(dishBaseGeo, dishBaseMat);
    dishBaseMesh.receiveShadow = true;
    this.sandboxGroup.add(dishBaseMesh);

    // 2. Outer Frosted Glass Petri Rim Bevel
    const dishRimGeo = new THREE.TorusGeometry(14.6, 0.26, 16, 72);
    dishRimGeo.rotateX(Math.PI / 2);
    dishRimGeo.translate(0, 0.08, 0);
    const dishRimMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0891b2,
      emissiveIntensity: 0.65,
      roughness: 0.18,
      metalness: 0.45,
      transparent: true,
      opacity: 0.68,
    });
    const dishRimMesh = new THREE.Mesh(dishRimGeo, dishRimMat);
    this.sandboxGroup.add(dishRimMesh);

    // 3. Concentric Bioluminescent Calibration Rings (with polygonOffset to prevent Z-fighting)
    const ringRadii: [number, number, number][] = [
      [2.6, 2.68, 0.42],
      [5.2, 5.28, 0.32],
      [8.4, 8.48, 0.24],
      [11.8, 11.9, 0.18],
    ];
    for (const [innerR, outerR, opacity] of ringRadii) {
      const rGeo = new THREE.RingGeometry(innerR, outerR, 64);
      rGeo.rotateX(-Math.PI / 2);
      const rMat = new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      const rMesh = new THREE.Mesh(rGeo, rMat);
      rMesh.position.y = 0.02;
      this.sandboxGroup.add(rMesh);
      this.disposableGeometries.push(rGeo);
      this.disposableMaterials.push(rMat);
    }

    // 4. Subtle Hexagonal Bioluminescent Reticle in the Center of the Dish
    const hexGeo = new THREE.RingGeometry(3.8, 3.92, 6);
    hexGeo.rotateX(-Math.PI / 2);
    this.sandboxPulseRingMat = new THREE.MeshBasicMaterial({
      color: 0x2dd4bf,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.sandboxHexGridMesh = new THREE.Mesh(hexGeo, this.sandboxPulseRingMat);
    this.sandboxHexGridMesh.position.y = 0.03;
    this.sandboxGroup.add(this.sandboxHexGridMesh);

    this.scene.add(this.sandboxGroup);

    // 5. Three-Point Studio Lighting Rig (Overhead Zenith Key + Cyan Fill + Emerald Rim)
    this.sandboxKeyLight = new THREE.SpotLight(
      0xf0fdfa,
      3.2,
      45,
      Math.PI / 3,
      0.55,
      1.2
    );
    this.sandboxKeyLight.visible = false;
    this.scene.add(this.sandboxKeyLight);
    this.scene.add(this.sandboxKeyLight.target);

    this.sandboxFillLight = new THREE.DirectionalLight(0x38bdf8, 1.35);
    this.sandboxFillLight.visible = false;
    this.scene.add(this.sandboxFillLight);
    this.scene.add(this.sandboxFillLight.target);

    this.sandboxRimLight = new THREE.DirectionalLight(0x34d399, 1.45);
    this.sandboxRimLight.visible = false;
    this.scene.add(this.sandboxRimLight);
    this.scene.add(this.sandboxRimLight.target);

    this.disposableGeometries.push(dishBaseGeo, dishRimGeo, hexGeo);
    this.disposableMaterials.push(
      dishBaseMat,
      dishRimMat,
      this.sandboxPulseRingMat
    );
  }

  public update(
    elapsedTime: number,
    delta: number,
    playerX = 0,
    playerZ = 0
  ): void {
    // When in 3D Editor Sandbox Mode, keep the clean Petri Dish studio ambiance and animate only the subtle reticle
    if (this.isEditorSandboxActive) {
      this.bgColor.r = THREE.MathUtils.damp(this.bgColor.r, 0.008, 6.0, delta);
      this.bgColor.g = THREE.MathUtils.damp(this.bgColor.g, 0.063, 6.0, delta);
      this.bgColor.b = THREE.MathUtils.damp(this.bgColor.b, 0.106, 6.0, delta);
      this.fogExp2.color.copy(this.bgColor);
      this.fogExp2.density = THREE.MathUtils.damp(
        this.fogExp2.density,
        0.0022,
        6.0,
        delta
      );

      this.sandboxPulseRingMat.opacity =
        0.28 + Math.sin(elapsedTime * 2.2) * 0.1;
      this.sandboxHexGridMesh.rotation.y = elapsedTime * 0.08;
      return;
    }

    // 1. Smoothly interpolate Biome Fog & Lighting tint based on stage & player position
    const biome = this.getBiomeAt(playerX, playerZ);
    let targetBgR = 0.016;
    let targetBgG = 0.098;
    let targetBgB = 0.161;

    let targetHemiR = 0.368;
    let targetHemiG = 0.918;
    let targetHemiB = 0.831;

    if (this.currentStage === 'creature_stage') {
      targetBgR = 0.12;
      targetBgG = 0.48;
      targetBgB = 0.68;
      targetHemiR = 0.99;
      targetHemiG = 0.94;
      targetHemiB = 0.54;

      if (biome.id === 'fosa_termal') {
        targetBgR = 0.22;
        targetBgG = 0.42;
        targetBgB = 0.55;
      } else if (biome.id === 'arrecife_abisal') {
        targetBgR = 0.1;
        targetBgG = 0.52;
        targetBgB = 0.58;
      }

      this.nestAuraMat.opacity = 0.22 + Math.sin(elapsedTime * 3.2) * 0.1;
      for (let e = 0; e < this.nestEggs.length; e++) {
        const pulse = 1.0 + Math.sin(elapsedTime * 3.5 + e) * 0.06;
        this.nestEggs[e].scale.set(0.85 * pulse, 1.28 * pulse, 0.85 * pulse);
      }
    } else if (biome.id === 'fosa_termal') {
      targetBgR = 0.055;
      targetBgG = 0.095;
      targetBgB = 0.135;
      targetHemiR = 0.98;
      targetHemiG = 0.65;
      targetHemiB = 0.32;
    } else if (biome.id === 'arrecife_abisal') {
      targetBgR = 0.024;
      targetBgG = 0.055;
      targetBgB = 0.185;
      targetHemiR = 0.51;
      targetHemiG = 0.55;
      targetHemiB = 0.97;
    }

    this.bgColor.r = THREE.MathUtils.damp(this.bgColor.r, targetBgR, 2.2, delta);
    this.bgColor.g = THREE.MathUtils.damp(this.bgColor.g, targetBgG, 2.2, delta);
    this.bgColor.b = THREE.MathUtils.damp(this.bgColor.b, targetBgB, 2.2, delta);
    this.fogExp2.color.copy(this.bgColor);

    const baseFogDensity =
      this.currentStage === 'creature_stage'
        ? 0.0045
        : GAME_CONFIG.WORLD.FOG_DENSITY * this.stageFogFactor;
    this.fogExp2.density = THREE.MathUtils.damp(
      this.fogExp2.density,
      baseFogDensity * this.fogDensityMultiplier * this.userFogDistanceMultiplier,
      3.0,
      delta
    );

    this.hemiLight.color.r = THREE.MathUtils.damp(
      this.hemiLight.color.r,
      targetHemiR,
      2.2,
      delta
    );
    this.hemiLight.color.g = THREE.MathUtils.damp(
      this.hemiLight.color.g,
      targetHemiG,
      2.2,
      delta
    );
    this.hemiLight.color.b = THREE.MathUtils.damp(
      this.hemiLight.color.b,
      targetHemiB,
      2.2,
      delta
    );

    // 2. Pulse Electric Coral Plateaus & Chloroplast Tree Canopy emissive intensity (zero matrix updates, GPU-only!)
    this.electricCoralMat.emissiveIntensity =
      0.85 + Math.sin(elapsedTime * 3.8) * 0.45;
    if (this.chloroplastFrondMat) {
      this.chloroplastFrondMat.emissiveIntensity =
        0.72 + Math.sin(elapsedTime * 2.6) * 0.28;
    }

    // 3. Animate Hydrothermal Vents & Ascending Bubble Plumes
    const ventAttr = this.ventBubblesPoints.geometry.getAttribute(
      'position'
    ) as THREE.BufferAttribute;
    for (let i = 0; i < this.ventBubbleCount; i++) {
      const ventIdx = i % this.ventPositions.length;
      const vp = this.ventPositions[ventIdx];
      let by = ventAttr.getY(i) + delta * (3.2 + (i % 4) * 0.6);
      if (by > GAME_CONFIG.WORLD.SWIM_PLANE_Y + 5.5) {
        by = vp.y + 4.8;
      }
      const baseX = this.ventBubbleBaseXZ[i * 2];
      const baseZ = this.ventBubbleBaseXZ[i * 2 + 1];
      const spiralX = baseX + Math.sin(elapsedTime * 3.0 + i) * 0.35;
      const spiralZ = baseZ + Math.cos(elapsedTime * 3.0 + i) * 0.35;
      ventAttr.setXYZ(i, spiralX, by, spiralZ);
    }
    ventAttr.needsUpdate = true;

    for (let i = 0; i < this.ventAuraMats.length; i++) {
      this.ventAuraMats[i].opacity =
        0.16 + Math.sin(elapsedTime * 2.8 + i) * 0.08;
    }

    // 4. Animate Colossal Abyssal Silhouettes (Spore Depth Plane Staging across 5 stages)
    const depthTargets: Record<CellularGrowthStage, number> = {
      1: -5.2,
      2: -4.2,
      3: -3.2,
      4: -2.2,
      5: -1.4,
    };
    const scaleFactors: Record<CellularGrowthStage, number> = {
      1: 1.0,
      2: 1.15,
      3: 1.28,
      4: 0.95,
      5: 0.72,
    };
    const depthTargetY = depthTargets[this.currentGrowthStage] ?? -5.0;
    const scaleStageFactor = scaleFactors[this.currentGrowthStage] ?? 1.0;

    for (let i = 0; i < this.abyssalSilhouettes.length; i++) {
      const s = this.abyssalSilhouettes[i];
      const prevX = s.group.position.x;
      const prevZ = s.group.position.z;

      s.orbitAngle += s.orbitSpeed * delta;
      const nextX = s.centerX + Math.cos(s.orbitAngle) * s.orbitRadius;
      const nextZ =
        s.centerZ + Math.sin(s.orbitAngle * 0.85) * (s.orbitRadius * 0.85);

      s.group.position.set(
        nextX,
        depthTargetY + Math.sin(elapsedTime * 0.9 + s.phaseOffset) * 0.25,
        nextZ
      );
      s.group.scale.setScalar(s.baseScale * scaleStageFactor);

      const dx = nextX - prevX;
      const dz = nextZ - prevZ;
      if (dx * dx + dz * dz > 0.00001) {
        s.group.rotation.y = Math.atan2(-dx, -dz);
      }

      const swimWave = elapsedTime * 2.2 + s.phaseOffset;
      for (let t = 0; t < s.tailSegments.length; t++) {
        s.tailSegments[t].position.x =
          Math.sin(swimWave - t * 0.8) * (0.45 + t * 0.35);
      }
      if (s.fins.length === 2) {
        const flap = Math.sin(swimWave * 0.7) * 0.18;
        s.fins[0].rotation.y = flap;
        s.fins[1].rotation.y = -flap;
      }
    }

    // 5. Gentle drift of suspended marine snow / plankton
    const posAttr = this.planktonPoints.geometry.getAttribute(
      'position'
    ) as THREE.BufferAttribute;
    for (let i = 0; i < this.planktonCount; i++) {
      let py = posAttr.getY(i) + delta * 0.35;
      const px =
        posAttr.getX(i) + Math.sin(elapsedTime * 0.6 + i) * delta * 0.2;
      if (py > 12.0) py = -3.5;
      posAttr.setXY(i, px, py);
    }
    posAttr.needsUpdate = true;
  }

  public dispose(): void {
    if (this.envTexture) {
      this.envTexture.dispose();
    }
    for (const geo of this.disposableGeometries) {
      geo.dispose();
    }
    for (const mat of this.disposableMaterials) {
      mat.dispose();
    }
  }
}
