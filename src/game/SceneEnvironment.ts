import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GAME_CONFIG } from './config';
import { BiomeType } from './types';

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

export function getGroundHeightAt(x: number, z: number): number {
  const distSq = x * x + z * z;
  const dist = Math.sqrt(distSq);
  const ripples =
    Math.sin(x * 0.08) * Math.cos(z * 0.08) * 1.1 +
    Math.sin(x * 0.22 + z * 0.17) * 0.35;

  // Natural volcanic/reef basin rim around arena perimeter
  const rimFactor = THREE.MathUtils.smoothstep(
    dist,
    GAME_CONFIG.WORLD.ARENA_RADIUS - 12,
    GAME_CONFIG.WORLD.ARENA_RADIUS + 26
  );
  const rimHeight = rimFactor * 9.5;

  // Deepened seabed (-6.2 base) so Spore-style abyssal silhouettes can glide at Y = -4.5
  return -6.2 + ripples + rimHeight;
}

interface AbyssalSilhouette {
  group: THREE.Group;
  orbitRadius: number;
  orbitAngle: number;
  orbitSpeed: number;
  centerX: number;
  centerZ: number;
  tailSegments: THREE.Mesh[];
  fins: THREE.Mesh[];
  phaseOffset: number;
}

const THERMAL_VENT_COORDS: readonly [number, number][] = [
  [-40, 0],
  [-48, -22],
  [-62, -8],
  [-50, 22],
  [-38, 36],
];

export class SceneEnvironment {
  public readonly scene: THREE.Scene;
  private envTexture: THREE.Texture | null = null;
  private hemiLight!: THREE.HemisphereLight;
  private rimLight!: THREE.DirectionalLight;
  private fogExp2!: THREE.FogExp2;
  private bgColor!: THREE.Color;

  private seabedMesh!: THREE.Mesh;
  private rocksInstanced!: THREE.InstancedMesh;
  private rockCapsInstanced!: THREE.InstancedMesh;
  private kelpStalksInstanced!: THREE.InstancedMesh;
  private kelpBladesInstanced!: THREE.InstancedMesh;
  private planktonPoints!: THREE.Points;
  private causticRingMesh!: THREE.Mesh;

  // Hydrothermal Vents & Ascending Bubble Plumes
  private readonly ventPositions: THREE.Vector3[] = [];
  private readonly ventAuraMats: THREE.MeshBasicMaterial[] = [];
  private ventBubblesPoints!: THREE.Points;
  private readonly ventBubbleCount = 100;
  private readonly ventBubblePositions: Float32Array;
  private readonly ventBubbleBaseXZ: Float32Array;

  // Spore-style Colossal Abyssal Background Silhouettes (Y = -4.5)
  private readonly abyssalSilhouettes: AbyssalSilhouette[] = [];

  private readonly kelpCount = 130;
  private readonly kelpBaseMatrices: THREE.Matrix4[] = [];
  private readonly kelpBladeBaseMatrices: THREE.Matrix4[] = [];
  private readonly kelpPhases: Float32Array;

  private readonly planktonCount = 420;
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

    this.kelpPhases = new Float32Array(this.kelpCount);
    this.planktonPositions = new Float32Array(this.planktonCount * 3);
    this.ventBubblePositions = new Float32Array(this.ventBubbleCount * 3);
    this.ventBubbleBaseXZ = new Float32Array(this.ventBubbleCount * 2);

    this.initEnvironmentMap(renderer);
    this.initLights();
    this.initSeabed();
    this.initRocks();
    this.initUnderwaterFlora();
    this.initHydrothermalVents();
    this.initAbyssalSilhouettes();
    this.initPlanktonParticles();
    this.initArenaBoundaryMarker();
  }

  public getBiomeAt(x: number, z: number): { id: BiomeType; name: string } {
    const radius = Math.sqrt(x * x + z * z);
    if (radius < 34) {
      return { id: 'pradera_luminosa', name: 'Pradera Bioluminiscente' };
    }
    if (x < 0) {
      return { id: 'fosa_termal', name: 'Fosa Hidrotermal' };
    }
    return { id: 'arrecife_abisal', name: 'Arrecife Abisal' };
  }

  public isNearThermalVent(x: number, z: number): boolean {
    for (let i = 0; i < this.ventPositions.length; i++) {
      const vp = this.ventPositions[i];
      const dx = x - vp.x;
      const dz = z - vp.z;
      if (dx * dx + dz * dz <= 8.5 * 8.5) {
        return true;
      }
    }
    return false;
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
    // Cool abyssal sky / seabed hemisphere fill
    this.hemiLight = new THREE.HemisphereLight(0x5eead4, 0x062033, 1.15);
    this.hemiLight.position.set(0, 50, 0);
    this.scene.add(this.hemiLight);

    // Filtered sunbeams from ocean surface (Key Light)
    const dirLight = new THREE.DirectionalLight(0xa5f3fc, 2.1);
    dirLight.position.set(28, 55, 24);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    const d = 65;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.camera.near = 5;
    dirLight.shadow.camera.far = 130;
    dirLight.shadow.bias = -0.0005;
    dirLight.shadow.normalBias = 0.02;
    this.scene.add(dirLight);

    // Subtle warm bioluminescent rim light from opposite angle
    this.rimLight = new THREE.DirectionalLight(0x38bdf8, 0.85);
    this.rimLight.position.set(-35, 22, -30);
    this.scene.add(this.rimLight);
  }

  private initSeabed(): void {
    const size = 280;
    const segments = 110;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);

    const posAttr = geometry.attributes.position;
    const colors = new Float32Array(posAttr.count * 3);

    const deepColor = new THREE.Color(0x041b2d);
    const ridgeColor = new THREE.Color(0x0c4a6e);
    const causticTint = new THREE.Color(0x0d9488);
    const thermalTint = new THREE.Color(0x7c2d12);
    const reefTint = new THREE.Color(0x312e81);

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const vy = getGroundHeightAt(vx, vz);
      posAttr.setY(i, vy);

      const heightNorm = THREE.MathUtils.clamp((vy + 7.2) / 9.0, 0, 1);
      _color.copy(deepColor).lerp(ridgeColor, heightNorm);

      const dist = Math.sqrt(vx * vx + vz * vz);
      if (dist >= 34 && vx < 0) {
        _color.lerp(thermalTint, 0.25);
      } else if (dist >= 34 && vx >= 0) {
        _color.lerp(reefTint, 0.28);
      }

      // Subtle caustic pattern on higher sandbars
      const causticWave =
        Math.sin(vx * 0.35) * Math.cos(vz * 0.35) * 0.5 + 0.5;
      if (causticWave > 0.68 && vy < 1.0) {
        _color.lerp(causticTint, (causticWave - 0.68) * 0.65);
      }

      colors[i * 3] = _color.r;
      colors[i * 3 + 1] = _color.g;
      colors[i * 3 + 2] = _color.b;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.06,
    });

    this.seabedMesh = new THREE.Mesh(geometry, material);
    this.seabedMesh.receiveShadow = true;
    this.scene.add(this.seabedMesh);

    this.disposableGeometries.push(geometry);
    this.disposableMaterials.push(material);
  }

  private initRocks(): void {
    const rockCount = 75;
    const baseGeo = new THREE.DodecahedronGeometry(1.4, 1);
    baseGeo.translate(0, 0.75, 0); // Pivot at bottom-center
    const capGeo = new THREE.IcosahedronGeometry(0.9, 1);
    capGeo.translate(0.35, 1.35, 0.2);

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
    this.rocksInstanced.castShadow = true;
    this.rocksInstanced.receiveShadow = true;
    this.rockCapsInstanced.castShadow = true;
    this.rockCapsInstanced.receiveShadow = true;

    for (let i = 0; i < rockCount; i++) {
      // Distribute some rocks inside the arena (away from origin) and more along the reef rim
      const isRim = i >= 42;
      const angle = (i / rockCount) * Math.PI * 2 + i * 1.618;
      const radius = isRim
        ? GAME_CONFIG.WORLD.ARENA_RADIUS + (i % 7) * 2.2
        : 14 + ((i * 17) % (GAME_CONFIG.WORLD.ARENA_RADIUS - 18));

      const rx = Math.cos(angle) * radius;
      const rz = Math.sin(angle) * radius;
      const ry = getGroundHeightAt(rx, rz) - 0.25;

      const scaleXZ = isRim ? 2.2 + (i % 5) * 0.65 : 0.9 + (i % 4) * 0.45;
      const scaleY = isRim ? 2.4 + (i % 4) * 0.8 : 1.15 + (i % 3) * 0.5;

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

      const shade = 0.75 + (i % 5) * 0.08;
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
    // Kelp stalk + bioluminescent frond bulbs (2-part composite instanced vegetation)
    const stalkGeo = new THREE.CylinderGeometry(0.08, 0.18, 4.6, 7, 4);
    stalkGeo.translate(0, 2.3, 0); // Bottom-center pivot

    const bladeGeo = new THREE.OctahedronGeometry(0.38, 1);
    bladeGeo.scale(0.7, 1.8, 0.35);
    bladeGeo.translate(0, 4.6, 0);

    const stalkMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      roughness: 0.6,
      metalness: 0.05,
    });

    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x34d399,
      emissive: 0x059669,
      emissiveIntensity: 0.45,
      roughness: 0.35,
      metalness: 0.1,
    });

    this.kelpStalksInstanced = new THREE.InstancedMesh(
      stalkGeo,
      stalkMat,
      this.kelpCount
    );
    this.kelpBladesInstanced = new THREE.InstancedMesh(
      bladeGeo,
      bladeMat,
      this.kelpCount
    );
    this.kelpStalksInstanced.frustumCulled = false;
    this.kelpBladesInstanced.frustumCulled = false;

    for (let i = 0; i < this.kelpCount; i++) {
      const angle = i * 2.39996; // Golden angle distribution
      const radius =
        8 + Math.sqrt(i / this.kelpCount) * (GAME_CONFIG.WORLD.ARENA_RADIUS - 6);
      const kx = Math.cos(angle) * radius;
      const kz = Math.sin(angle) * radius;
      const ky = getGroundHeightAt(kx, kz) - 0.1;

      const scaleY = 0.75 + (i % 7) * 0.24;
      const scaleXZ = 0.8 + (i % 4) * 0.15;

      _dummy.position.set(kx, ky, kz);
      _dummy.rotation.set(0, (i * 0.7) % (Math.PI * 2), 0);
      _dummy.scale.set(scaleXZ, scaleY, scaleXZ);
      _dummy.updateMatrix();

      const baseMat4 = _dummy.matrix.clone();
      this.kelpBaseMatrices.push(baseMat4);
      this.kelpBladeBaseMatrices.push(baseMat4.clone());
      this.kelpPhases[i] = i * 0.45;

      this.kelpStalksInstanced.setMatrixAt(i, baseMat4);
      this.kelpBladesInstanced.setMatrixAt(i, baseMat4);

      const hueShift = (i % 5) * 0.025;
      _color.setHSL(0.43 + hueShift, 0.72, 0.36 + (i % 3) * 0.05);
      this.kelpStalksInstanced.setColorAt(i, _color);

      _color.setHSL(0.46 + hueShift, 0.85, 0.52);
      this.kelpBladesInstanced.setColorAt(i, _color);
    }

    this.kelpStalksInstanced.instanceMatrix.needsUpdate = true;
    this.kelpBladesInstanced.instanceMatrix.needsUpdate = true;
    if (this.kelpStalksInstanced.instanceColor) {
      this.kelpStalksInstanced.instanceColor.needsUpdate = true;
    }
    if (this.kelpBladesInstanced.instanceColor) {
      this.kelpBladesInstanced.instanceColor.needsUpdate = true;
    }

    this.scene.add(this.kelpStalksInstanced);
    this.scene.add(this.kelpBladesInstanced);

    this.disposableGeometries.push(stalkGeo, bladeGeo);
    this.disposableMaterials.push(stalkMat, bladeMat);
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

      // Swim-plane thermal regeneration ring indicator
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
      auraMesh.position.set(
        vx,
        GAME_CONFIG.WORLD.SWIM_PLANE_Y - 1.1,
        vz
      );
      this.scene.add(auraMesh);
      this.scene.add(ventGroup);
    }

    // Ascending Hydrothermal Bubble Columns (20 particles per vent = 100 total)
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

      // Warm golden-cyan thermal bubble colors
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
    // 4 Colossal dark-translucent background organisms swimming at Y = -4.5 (Spore depth layer effect)
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
      { cx: -10, cz: -8, radius: 20, speed: 0.15, scale: 1.2, phase: 0.2 },
      { cx: 24, cz: 16, radius: 26, speed: -0.12, scale: 1.38, phase: 1.7 },
      { cx: -24, cz: 22, radius: 22, speed: 0.13, scale: 1.1, phase: 3.1 },
      { cx: 18, cz: -24, radius: 25, speed: -0.13, scale: 1.28, phase: 4.6 },
    ];

    for (let i = 0; i < configs.length; i++) {
      const cfg = configs[i];
      const group = new THREE.Group();
      group.scale.setScalar(cfg.scale);

      const bodyMesh = new THREE.Mesh(headGeo, silhouetteMat);
      group.add(bodyMesh);

      // Subtle abyssal bioluminescent lateral spots
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

      group.position.set(cfg.cx + cfg.radius, -4.5, cfg.cz);
      this.scene.add(group);

      this.abyssalSilhouettes.push({
        group,
        orbitRadius: cfg.radius,
        orbitAngle: cfg.phase,
        orbitSpeed: cfg.speed,
        centerX: cfg.cx,
        centerZ: cfg.cz,
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
        Math.sqrt(Math.random()) * (GAME_CONFIG.WORLD.ARENA_RADIUS + 10);
      const theta = Math.random() * Math.PI * 2;
      this.planktonPositions[i * 3] = Math.cos(theta) * r;
      this.planktonPositions[i * 3 + 1] = 0.2 + Math.random() * 11.0;
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
      size: 0.26,
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
    // Subtle bioluminescent thermal ring on the seabed marking the safe cellular zone
    const ringGeo = new THREE.RingGeometry(
      GAME_CONFIG.WORLD.ARENA_RADIUS - 0.6,
      GAME_CONFIG.WORLD.ARENA_RADIUS + 0.6,
      96
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

  public update(
    elapsedTime: number,
    delta: number,
    playerX = 0,
    playerZ = 0
  ): void {
    // 1. Smoothly interpolate Biome Fog & Lighting tint based on player position
    const biome = this.getBiomeAt(playerX, playerZ);
    let targetBgR = 0.016;
    let targetBgG = 0.098;
    let targetBgB = 0.161; // Default 'pradera_luminosa' (0x041929)

    let targetHemiR = 0.368;
    let targetHemiG = 0.918;
    let targetHemiB = 0.831; // 0x5eead4

    if (biome.id === 'fosa_termal') {
      // Warm deep hydrothermal tint
      targetBgR = 0.055;
      targetBgG = 0.095;
      targetBgB = 0.135;
      targetHemiR = 0.98;
      targetHemiG = 0.65;
      targetHemiB = 0.32;
    } else if (biome.id === 'arrecife_abisal') {
      // Deep indigo abyssal reef tint
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

    // 2. Gentle underwater kelp sway
    const position = _dummy.position;
    const quaternion = _dummy.quaternion;
    const scale = _dummy.scale;
    const euler = _dummy.rotation;

    for (let i = 0; i < this.kelpCount; i++) {
      const baseMatrix = this.kelpBaseMatrices[i];
      baseMatrix.decompose(position, quaternion, scale);
      euler.setFromQuaternion(quaternion);

      const sway = Math.sin(elapsedTime * 1.6 + this.kelpPhases[i]) * 0.12;
      euler.x = sway;
      euler.z = Math.cos(elapsedTime * 1.3 + this.kelpPhases[i]) * 0.09;
      _dummy.updateMatrix();

      this.kelpStalksInstanced.setMatrixAt(i, _dummy.matrix);
      this.kelpBladesInstanced.setMatrixAt(i, _dummy.matrix);
    }
    this.kelpStalksInstanced.instanceMatrix.needsUpdate = true;
    this.kelpBladesInstanced.instanceMatrix.needsUpdate = true;

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

    // 4. Animate 4 Colossal Abyssal Silhouettes at Y = -4.5
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
        -4.5 + Math.sin(elapsedTime * 0.9 + s.phaseOffset) * 0.25,
        nextZ
      );

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
      if (py > 12.0) py = 0.2;
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
