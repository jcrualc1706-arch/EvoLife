import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GAME_CONFIG } from './config';

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

  return -2.6 + ripples + rimHeight;
}

export class SceneEnvironment {
  public readonly scene: THREE.Scene;
  private envTexture: THREE.Texture | null = null;
  private seabedMesh!: THREE.Mesh;
  private rocksInstanced!: THREE.InstancedMesh;
  private rockCapsInstanced!: THREE.InstancedMesh;
  private kelpStalksInstanced!: THREE.InstancedMesh;
  private kelpBladesInstanced!: THREE.InstancedMesh;
  private planktonPoints!: THREE.Points;
  private causticRingMesh!: THREE.Mesh;

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
    this.scene.background = new THREE.Color(GAME_CONFIG.WORLD.WATER_COLOR);
    this.scene.fog = new THREE.FogExp2(
      GAME_CONFIG.WORLD.FOG_COLOR,
      GAME_CONFIG.WORLD.FOG_DENSITY
    );

    this.kelpPhases = new Float32Array(this.kelpCount);
    this.planktonPositions = new Float32Array(this.planktonCount * 3);

    this.initEnvironmentMap(renderer);
    this.initLights();
    this.initSeabed();
    this.initRocks();
    this.initUnderwaterFlora();
    this.initPlanktonParticles();
    this.initArenaBoundaryMarker();
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
    const hemiLight = new THREE.HemisphereLight(0x5eead4, 0x062033, 1.15);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

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
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.85);
    rimLight.position.set(-35, 22, -30);
    this.scene.add(rimLight);
  }

  private initSeabed(): void {
    const size = 280;
    const segments = 110;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);

    const posAttr = geometry.attributes.position;
    const colors = new Float32Array(posAttr.count * 3);

    const deepColor = new THREE.Color(0x052236);
    const ridgeColor = new THREE.Color(0x0c4a6e);
    const causticTint = new THREE.Color(0x0d9488);

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const vy = getGroundHeightAt(vx, vz);
      posAttr.setY(i, vy);

      const heightNorm = THREE.MathUtils.clamp((vy + 3.8) / 8.0, 0, 1);
      _color.copy(deepColor).lerp(ridgeColor, heightNorm);

      // Subtle caustic pattern on higher sandbars
      const causticWave =
        Math.sin(vx * 0.35) * Math.cos(vz * 0.35) * 0.5 + 0.5;
      if (causticWave > 0.68 && vy < 2.0) {
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
      const angle = (i / rockCount) * Math.PI * 2 + (i * 1.618);
      const radius = isRim
        ? GAME_CONFIG.WORLD.ARENA_RADIUS + (i % 7) * 2.2
        : 14 + ((i * 17) % (GAME_CONFIG.WORLD.ARENA_RADIUS - 18));

      const rx = Math.cos(angle) * radius;
      const rz = Math.sin(angle) * radius;
      const ry = getGroundHeightAt(rx, rz) - 0.25;

      const scaleXZ = isRim
        ? 2.2 + (i % 5) * 0.65
        : 0.9 + (i % 4) * 0.45;
      const scaleY = isRim
        ? 1.8 + (i % 4) * 0.7
        : 0.75 + (i % 3) * 0.4;

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

      const shade = 0.75 + ((i % 5) * 0.08);
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
    const stalkGeo = new THREE.CylinderGeometry(0.08, 0.18, 3.4, 7, 4);
    stalkGeo.translate(0, 1.7, 0); // Bottom-center pivot

    const bladeGeo = new THREE.OctahedronGeometry(0.36, 1);
    bladeGeo.scale(0.7, 1.8, 0.35);
    bladeGeo.translate(0, 3.4, 0);

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
      const radius = 8 + Math.sqrt(i / this.kelpCount) * (GAME_CONFIG.WORLD.ARENA_RADIUS - 6);
      const kx = Math.cos(angle) * radius;
      const kz = Math.sin(angle) * radius;
      const ky = getGroundHeightAt(kx, kz) - 0.1;

      const scaleY = 0.65 + (i % 7) * 0.22;
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

  private initPlanktonParticles(): void {
    const geometry = new THREE.BufferGeometry();
    const colors = new Float32Array(this.planktonCount * 3);

    for (let i = 0; i < this.planktonCount; i++) {
      const r = Math.sqrt(Math.random()) * (GAME_CONFIG.WORLD.ARENA_RADIUS + 10);
      const theta = Math.random() * Math.PI * 2;
      this.planktonPositions[i * 3] = Math.cos(theta) * r;
      this.planktonPositions[i * 3 + 1] = 0.2 + Math.random() * 11.0;
      this.planktonPositions[i * 3 + 2] = Math.sin(theta) * r;

      _color.setHSL(0.48 + Math.random() * 0.12, 0.8, 0.65 + Math.random() * 0.25);
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

  public update(elapsedTime: number, delta: number): void {
    // Gentle underwater kelp sway (update a subset or lightweight sway)
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

    // Gentle drift of suspended marine snow / plankton
    const posAttr = this.planktonPoints.geometry.getAttribute(
      'position'
    ) as THREE.BufferAttribute;
    for (let i = 0; i < this.planktonCount; i++) {
      let py = posAttr.getY(i) + delta * 0.35;
      const px = posAttr.getX(i) + Math.sin(elapsedTime * 0.6 + i) * delta * 0.2;
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
