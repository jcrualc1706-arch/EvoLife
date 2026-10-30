import * as THREE from 'three';
import { audioManager } from './AudioManager';
import { GAME_CONFIG } from './config';
import { getGroundHeightAt } from './SceneEnvironment';
import {
  CellColorTheme,
  GenesisConfig,
  IntroCinematicState,
} from './types';

interface SecondaryMeteorItem {
  mesh: THREE.Mesh;
  trailMesh: THREE.Mesh;
  startOffset: THREE.Vector3;
  endOffset: THREE.Vector3;
  arcHeight: number;
  speedMultiplier: number;
  rotSpeed: THREE.Vector3;
}

const THEME_CORE_HEX: Record<CellColorTheme, number> = {
  cyan: 0x22d3ee,
  emerald: 0x10b981,
  crimson: 0xf43f5e,
  violet: 0xa855f7,
};

export class IntroCinematicController {
  public static readonly TOTAL_DURATION = 13.0;
  public static readonly SPACE_END_TIME = 8.5;

  private readonly solarSystemScene: THREE.Scene;
  private readonly environmentScene: THREE.Scene;

  private isActive = false;
  private elapsed = 0;
  private planetName = 'Aethel Prime';
  private speciesName = 'Organismo Primigenio';
  private atmosphereColorHex = '#22d3ee';
  private coreColorHex = 0x10b981;
  private playedSpaceWhistle = false;
  private playedReentryRoar = false;
  private playedOceanSplash = false;
  private playedMeteorCrack = false;

  private targetPlanetPos = new THREE.Vector3(38, 0, 0);
  private targetPlanetRadius = 3.4;
  private spaceStartPos = new THREE.Vector3(0, 12, 65);
  private spaceAtmosphereEntryPos = new THREE.Vector3(34, 1.5, 4);
  private spaceFlightDir = new THREE.Vector3(0, 0, -1);
  private spaceFlightUp = new THREE.Vector3(0, 1, 0);
  private spaceFlightRight = new THREE.Vector3(1, 0, 0);

  // Temporary Space & Re-entry Assets (Disposed on completion/skip)
  private spaceRigGroup: THREE.Group | null = null;
  private heroSpaceGroup: THREE.Group | null = null;
  private heroRockMesh: THREE.Mesh | null = null;
  private heroRockMat: THREE.MeshStandardMaterial | null = null;
  private plasmaOuterCone: THREE.Mesh | null = null;
  private plasmaInnerCone: THREE.Mesh | null = null;
  private plasmaOuterMat: THREE.MeshBasicMaterial | null = null;
  private plasmaInnerMat: THREE.MeshBasicMaterial | null = null;
  private bowShockMesh: THREE.Mesh | null = null;
  private bowShockMat: THREE.MeshBasicMaterial | null = null;
  private secondaryMeteors: SecondaryMeteorItem[] = [];
  private reentryParticlesPoints: THREE.Points | null = null;
  private reentryParticlePositions: Float32Array | null = null;
  private reentryParticleVelocities: Float32Array | null = null;
  private reentryParticleAges: Float32Array | null = null;
  private cloudDeckGroup: THREE.Group | null = null;
  private cloudLayerMats: THREE.MeshBasicMaterial[] = [];

  // Temporary Underwater Splash Assets (Disposed on completion/skip)
  private splashTempGroup: THREE.Group | null = null;
  private splashColumnMesh: THREE.Mesh | null = null;
  private splashColumnMat: THREE.MeshBasicMaterial | null = null;
  private splashSurfaceRing: THREE.Mesh | null = null;
  private splashSurfaceRingMat: THREE.MeshBasicMaterial | null = null;
  private splashBubblesPoints: THREE.Points | null = null;
  private splashBubblePositions: Float32Array | null = null;
  private splashBubbleVelocities: Float32Array | null = null;
  private genesisShockwaveMesh: THREE.Mesh | null = null;
  private genesisShockwaveMat: THREE.MeshBasicMaterial | null = null;
  private genesisFlashSphere: THREE.Mesh | null = null;
  private genesisFlashMat: THREE.MeshBasicMaterial | null = null;

  private tempGeometries: THREE.BufferGeometry[] = [];
  private tempMaterials: THREE.Material[] = [];
  private tempTextures: THREE.Texture[] = [];

  // Permanent Seabed Origin Monument at (0, 0) for the entire Cell Stage
  private readonly originMonumentGroup: THREE.Group;
  private readonly meteorAssemblyGroup: THREE.Group;
  private meteorFragmentLeft!: THREE.Mesh;
  private meteorFragmentRight!: THREE.Mesh;
  private monumentRockMat!: THREE.MeshStandardMaterial;
  private monumentCoreMat!: THREE.MeshStandardMaterial;
  private monumentCoreLight!: THREE.PointLight;
  private monumentAuraMat!: THREE.MeshBasicMaterial;
  private monumentSmokePoints!: THREE.Points;
  private readonly monumentSmokeCount = 48;
  private readonly monumentSmokePositions: Float32Array;
  private readonly permanentGeometries: THREE.BufferGeometry[] = [];
  private readonly permanentMaterials: THREE.Material[] = [];
  private readonly permanentTextures: THREE.Texture[] = [];

  constructor(
    solarSystemScene: THREE.Scene,
    environmentScene: THREE.Scene
  ) {
    this.solarSystemScene = solarSystemScene;
    this.environmentScene = environmentScene;

    this.originMonumentGroup = new THREE.Group();
    this.meteorAssemblyGroup = new THREE.Group();
    this.monumentSmokePositions = new Float32Array(this.monumentSmokeCount * 3);

    this.buildPermanentOriginMonument();
  }

  /**
   * Builds the permanent fractured Origin Meteorite Monument at (0, 0) on the seabed:
   * - Includes `MeteorFragmentLeft` and `MeteorFragmentRight`, basalt impact crater,
   *   glowing panspermia core bed, and residual thermal smoke/bubbles.
   */
  private buildPermanentOriginMonument(): void {
    const seabedY = getGroundHeightAt(0, 0);
    // Elevate the impact crater pedestal so the meteorite sits at Y = -1.85m, clearly visible right below SWIM_PLANE_Y (0)
    const monumentBaseY = GAME_CONFIG.WORLD.SWIM_PLANE_Y - 1.85;
    this.originMonumentGroup.position.set(0, monumentBaseY, 0);

    // 1. Impact Crater Pedestal Mound connecting down to the seabed
    const pedestalHeight = Math.max(2.0, monumentBaseY - seabedY + 0.8);
    const craterMoundGeo = new THREE.CylinderGeometry(
      2.6,
      4.8,
      pedestalHeight,
      24,
      2
    );
    craterMoundGeo.translate(0, -pedestalHeight * 0.5 + 0.15, 0);
    const craterMoundMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: 0x0f172a,
      emissiveIntensity: 0.35,
      roughness: 0.9,
      metalness: 0.12,
    });
    const craterMoundMesh = new THREE.Mesh(craterMoundGeo, craterMoundMat);
    craterMoundMesh.receiveShadow = true;
    this.originMonumentGroup.add(craterMoundMesh);

    // Jagged Crater Rim Ring
    const rimGeo = new THREE.TorusGeometry(2.55, 0.42, 10, 28);
    rimGeo.rotateX(Math.PI / 2);
    const rimPos = rimGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < rimPos.count; i++) {
      const vx = rimPos.getX(i);
      const vy = rimPos.getY(i);
      const vz = rimPos.getZ(i);
      const n =
        Math.sin(vx * 2.7 + vz * 1.9) * 0.12 +
        Math.cos(vx * 1.8 - vz * 3.1) * 0.08;
      rimPos.setXYZ(i, vx + n, vy + n * 0.8, vz + n);
    }
    rimGeo.computeVertexNormals();
    const rimMesh = new THREE.Mesh(rimGeo, craterMoundMat);
    rimMesh.position.y = 0.08;
    this.originMonumentGroup.add(rimMesh);

    // 2. Bioluminescent Panspermia Crater Aura Ring
    const auraGeo = new THREE.RingGeometry(1.2, 4.2, 40);
    auraGeo.rotateX(-Math.PI / 2);
    this.monumentAuraMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.26,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const auraMesh = new THREE.Mesh(auraGeo, this.monumentAuraMat);
    auraMesh.position.y = 0.06;
    this.originMonumentGroup.add(auraMesh);

    // 3. Meteorite Basalt & Glowing Fissure Texture
    const { rockTex, emissiveTex } = this.createMeteorRockTextures(0x10b981);
    this.permanentTextures.push(rockTex, emissiveTex);

    this.monumentRockMat = new THREE.MeshStandardMaterial({
      map: rockTex,
      emissiveMap: emissiveTex,
      color: 0x334155,
      emissive: 0x10b981,
      emissiveIntensity: 1.15,
      roughness: 0.82,
      metalness: 0.18,
    });

    this.monumentCoreMat = new THREE.MeshStandardMaterial({
      color: 0x6ee7b7,
      emissive: 0x10b981,
      emissiveIntensity: 1.8,
      roughness: 0.25,
      metalness: 0.1,
    });

    // 4. Left & Right Fractured Meteorite Hemispheres (MeteorFragmentLeft & MeteorFragmentRight)
    const leftGeo = this.createDeformedMeteorHalfGeometry(-1);
    const rightGeo = this.createDeformedMeteorHalfGeometry(1);

    this.meteorFragmentLeft = new THREE.Mesh(leftGeo, this.monumentRockMat);
    this.meteorFragmentLeft.name = 'MeteorFragmentLeft';
    this.meteorFragmentLeft.castShadow = true;
    this.meteorFragmentLeft.receiveShadow = true;

    this.meteorFragmentRight = new THREE.Mesh(rightGeo, this.monumentRockMat);
    this.meteorFragmentRight.name = 'MeteorFragmentRight';
    this.meteorFragmentRight.castShadow = true;
    this.meteorFragmentRight.receiveShadow = true;

    // Inner glowing organic core geode cavity attached inside each half
    const innerCavityGeo = new THREE.IcosahedronGeometry(0.68, 1);
    innerCavityGeo.scale(0.55, 0.85, 0.85);
    const leftCavity = new THREE.Mesh(innerCavityGeo, this.monumentCoreMat);
    leftCavity.position.set(0.18, 0.05, 0);
    this.meteorFragmentLeft.add(leftCavity);

    const rightCavity = new THREE.Mesh(innerCavityGeo, this.monumentCoreMat);
    rightCavity.position.set(-0.18, 0.05, 0);
    this.meteorFragmentRight.add(rightCavity);

    this.meteorAssemblyGroup.add(this.meteorFragmentLeft);
    this.meteorAssemblyGroup.add(this.meteorFragmentRight);
    this.originMonumentGroup.add(this.meteorAssemblyGroup);

    // 5. PointLight illuminating the origin crater
    this.monumentCoreLight = new THREE.PointLight(0x10b981, 2.2, 16, 1.4);
    this.monumentCoreLight.position.set(0, 1.2, 0);
    this.originMonumentGroup.add(this.monumentCoreLight);

    // 6. Residual Thermal Smoke & Bubbles rising from the cracked meteorite at (0, 0)
    const smokeGeo = new THREE.BufferGeometry();
    const smokeColors = new Float32Array(this.monumentSmokeCount * 3);
    const tempColor = new THREE.Color();

    for (let i = 0; i < this.monumentSmokeCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 0.25 + Math.random() * 1.35;
      this.monumentSmokePositions[i * 3] = Math.cos(angle) * r;
      this.monumentSmokePositions[i * 3 + 1] = 0.3 + Math.random() * 4.2;
      this.monumentSmokePositions[i * 3 + 2] = Math.sin(angle) * r;

      if (i % 3 === 0) {
        tempColor.setHex(0x6ee7b7);
      } else if (i % 3 === 1) {
        tempColor.setHex(0xfbbf24);
      } else {
        tempColor.setHex(0x94a3b8);
      }
      smokeColors[i * 3] = tempColor.r;
      smokeColors[i * 3 + 1] = tempColor.g;
      smokeColors[i * 3 + 2] = tempColor.b;
    }

    smokeGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(this.monumentSmokePositions, 3)
    );
    smokeGeo.setAttribute(
      'color',
      new THREE.BufferAttribute(smokeColors, 3)
    );

    const smokeMat = new THREE.PointsMaterial({
      size: 0.34,
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.monumentSmokePoints = new THREE.Points(smokeGeo, smokeMat);
    this.originMonumentGroup.add(this.monumentSmokePoints);

    // Default state: fractured & open on the seabed
    this.setMonumentFractureProgress(1.0);
    this.environmentScene.add(this.originMonumentGroup);

    this.permanentGeometries.push(
      craterMoundGeo,
      rimGeo,
      auraGeo,
      leftGeo,
      rightGeo,
      innerCavityGeo,
      smokeGeo
    );
    this.permanentMaterials.push(
      craterMoundMat,
      this.monumentAuraMat,
      this.monumentRockMat,
      this.monumentCoreMat,
      smokeMat
    );
  }

  /**
   * Creates a jagged, organically deformed meteorite hemisphere (`side = -1` for Left, `+1` for Right).
   */
  private createDeformedMeteorHalfGeometry(
    side: -1 | 1
  ): THREE.BufferGeometry {
    const geo = new THREE.DodecahedronGeometry(1.35, 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;

    for (let i = 0; i < pos.count; i++) {
      let vx = pos.getX(i);
      let vy = pos.getY(i);
      let vz = pos.getZ(i);

      // Organic basalt crags & craters
      const noise =
        1.0 +
        0.18 * Math.sin(vx * 2.4 + vy * 1.9) +
        0.14 * Math.cos(vz * 2.8 - vx * 1.7) +
        0.09 * Math.sin(vy * 4.1 + vz * 3.3);
      vx *= noise;
      vy *= noise * 0.88;
      vz *= noise;

      // Slice along the X = 0 fracture plane with jagged teeth
      const fracturePlaneJag =
        Math.sin(vy * 3.5 + vz * 2.8) * 0.14 +
        Math.cos(vy * 2.1 - vz * 4.2) * 0.08;

      if (side === -1 && vx > fracturePlaneJag) {
        vx = fracturePlaneJag;
      } else if (side === 1 && vx < fracturePlaneJag) {
        vx = fracturePlaneJag;
      }

      pos.setXYZ(i, vx, vy, vz);
    }

    geo.computeVertexNormals();
    return geo;
  }

  /**
   * Sets how far apart `MeteorFragmentLeft` and `MeteorFragmentRight` are split:
   * - `0.0`: Closed intact meteorite sphere
   * - `1.0`: Split wide open on the seabed (`-1.45m` and `+1.45m` with outward tilt)
   */
  public setMonumentFractureProgress(splitT: number): void {
    const t = THREE.MathUtils.clamp(splitT, 0, 1);
    // Smooth cubic ease-out for physical shell opening
    const ease = 1 - Math.pow(1 - t, 3);

    this.meteorFragmentLeft.position.set(
      -ease * 1.48,
      0.75 - ease * 0.18,
      -ease * 0.12
    );
    this.meteorFragmentLeft.rotation.set(
      ease * 0.15,
      -ease * 0.22,
      ease * 0.58
    );

    this.meteorFragmentRight.position.set(
      ease * 1.48,
      0.75 - ease * 0.18,
      ease * 0.12
    );
    this.meteorFragmentRight.rotation.set(
      -ease * 0.15,
      ease * 0.22,
      -ease * 0.58
    );
  }

  public setMonumentCoreTheme(colorTheme: CellColorTheme): void {
    const hex = THEME_CORE_HEX[colorTheme] ?? 0x10b981;
    this.coreColorHex = hex;
    this.monumentRockMat.emissive.setHex(hex);
    this.monumentCoreMat.color.setHex(hex);
    this.monumentCoreMat.emissive.setHex(hex);
    this.monumentAuraMat.color.setHex(hex);
    this.monumentCoreLight.color.setHex(hex);
  }

  public setPermanentMonumentVisible(visible: boolean): void {
    this.originMonumentGroup.visible = visible;
  }

  /**
   * Animates the permanent broken meteorite monument at (0, 0) during normal Cell Stage gameplay.
   */
  public updatePermanentMonument(
    delta: number,
    elapsedTime: number,
    visible: boolean
  ): void {
    this.originMonumentGroup.visible = visible;
    if (!visible) return;

    if (!this.isActive) {
      // Subtle bioluminescent ember pulse on the seabed
      const pulse = 0.85 + Math.sin(elapsedTime * 2.4) * 0.25;
      this.monumentRockMat.emissiveIntensity = 0.75 * pulse;
      this.monumentCoreMat.emissiveIntensity = 1.25 * pulse;
      this.monumentAuraMat.opacity = 0.18 + Math.sin(elapsedTime * 2.0) * 0.06;
      this.monumentCoreLight.intensity = 1.6 * pulse;
    }

    // Animate rising residual hydrothermal smoke & micro-bubbles from the cracked halves
    const posAttr = this.monumentSmokePoints.geometry.getAttribute(
      'position'
    ) as THREE.BufferAttribute;

    for (let i = 0; i < this.monumentSmokeCount; i++) {
      let py = posAttr.getY(i) + delta * (1.15 + (i % 4) * 0.35);
      if (py > 4.6) {
        py = 0.25;
      }
      const sideSign = i % 2 === 0 ? -1 : 1;
      const baseAnchorX = sideSign * (0.65 + (i % 5) * 0.22);
      const baseAnchorZ = ((i % 7) - 3) * 0.22;
      const swirlX =
        baseAnchorX + Math.sin(elapsedTime * 2.1 + i * 0.7) * 0.24;
      const swirlZ =
        baseAnchorZ + Math.cos(elapsedTime * 1.9 + i * 0.7) * 0.24;
      posAttr.setXYZ(i, swirlX, py, swirlZ);
    }
    posAttr.needsUpdate = true;
  }

  // ============================================================================
  // CINEMATIC LIFECYCLE: START, UPDATE (0s -> 13s), SKIP, AND CLEANUP
  // ============================================================================

  public start(
    planetTransform: {
      position: THREE.Vector3;
      radius: number;
      planetName: string;
      atmosphereColorHex: string;
    },
    genesisConfig?: GenesisConfig
  ): void {
    this.disposeTemporaryCinematicAssets();

    this.isActive = true;
    this.elapsed = 0;
    this.playedSpaceWhistle = false;
    this.playedReentryRoar = false;
    this.playedOceanSplash = false;
    this.playedMeteorCrack = false;
    this.planetName = planetTransform.planetName;
    this.atmosphereColorHex = planetTransform.atmosphereColorHex;
    this.speciesName =
      genesisConfig?.speciesName?.trim() || 'Organismo Primigenio';

    const chosenTheme: CellColorTheme =
      genesisConfig?.colorTheme ??
      (genesisConfig?.initialDiet === 'carnivore'
        ? 'crimson'
        : genesisConfig?.initialDiet === 'omnivore'
        ? 'cyan'
        : 'emerald');
    this.setMonumentCoreTheme(chosenTheme);

    this.targetPlanetPos.copy(planetTransform.position);
    this.targetPlanetRadius = planetTransform.radius;

    // Compute a dramatic approach vector from deep space toward the sunlit hemisphere of the planet
    const sunToPlanetDir = this.targetPlanetPos.clone().normalize();
    const orbitTangent = new THREE.Vector3(
      -sunToPlanetDir.z,
      0.22,
      sunToPlanetDir.x
    ).normalize();

    // Entry point at the upper cloud deck of the planet facing the star and tangent
    const entryDirFromPlanetCenter = orbitTangent
      .clone()
      .multiplyScalar(0.78)
      .addScaledVector(sunToPlanetDir, -0.52)
      .add(new THREE.Vector3(0, 0.25, 0))
      .normalize();

    this.spaceAtmosphereEntryPos
      .copy(this.targetPlanetPos)
      .addScaledVector(
        entryDirFromPlanetCenter,
        this.targetPlanetRadius * 1.06
      );

    // Start point 54 units out in deep space so both the planet and central mother star frame the shot
    this.spaceStartPos
      .copy(this.spaceAtmosphereEntryPos)
      .addScaledVector(entryDirFromPlanetCenter, 52.0)
      .add(new THREE.Vector3(0, 8.5, 0));

    this.spaceFlightDir
      .subVectors(this.spaceAtmosphereEntryPos, this.spaceStartPos)
      .normalize();
    this.spaceFlightRight
      .crossVectors(this.spaceFlightDir, new THREE.Vector3(0, 1, 0))
      .normalize();
    this.spaceFlightUp
      .crossVectors(this.spaceFlightRight, this.spaceFlightDir)
      .normalize();

    this.buildTemporarySpaceSwarmRig();
    this.buildTemporaryUnderwaterSplashRig();

    // Prepare the monument at (0, 0) as an intact closed meteorite descending to the seabed
    this.originMonumentGroup.visible = true;
    this.setMonumentFractureProgress(0.0);
  }

  private trackTempGeo<T extends THREE.BufferGeometry>(geo: T): T {
    this.tempGeometries.push(geo);
    return geo;
  }

  private trackTempMat<T extends THREE.Material>(mat: T): T {
    this.tempMaterials.push(mat);
    return mat;
  }

  private trackTempTex<T extends THREE.Texture>(tex: T): T {
    this.tempTextures.push(tex);
    return tex;
  }

  private buildTemporarySpaceSwarmRig(): void {
    this.spaceRigGroup = new THREE.Group();

    // 1. Hero Meteorite Group
    this.heroSpaceGroup = new THREE.Group();
    this.heroSpaceGroup.position.copy(this.spaceStartPos);

    const heroGeo = this.trackTempGeo(new THREE.DodecahedronGeometry(0.92, 2));
    const hPos = heroGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < hPos.count; i++) {
      const vx = hPos.getX(i);
      const vy = hPos.getY(i);
      const vz = hPos.getZ(i);
      const n =
        1.0 +
        0.2 * Math.sin(vx * 2.8 + vy * 2.1) +
        0.15 * Math.cos(vz * 3.1 - vx * 1.9);
      hPos.setXYZ(i, vx * n, vy * n * 0.9, vz * n * 1.15);
    }
    heroGeo.computeVertexNormals();

    const { rockTex, emissiveTex } = this.createMeteorRockTextures(
      this.coreColorHex
    );
    this.trackTempTex(rockTex);
    this.trackTempTex(emissiveTex);

    this.heroRockMat = this.trackTempMat(
      new THREE.MeshStandardMaterial({
        map: rockTex,
        emissiveMap: emissiveTex,
        color: 0x334155,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.35,
        roughness: 0.78,
        metalness: 0.22,
      })
    );

    this.heroRockMesh = new THREE.Mesh(heroGeo, this.heroRockMat);
    this.heroSpaceGroup.add(this.heroRockMesh);

    // Inner Vital Core Glow peeking through fissures
    const innerCoreGeo = this.trackTempGeo(
      new THREE.IcosahedronGeometry(0.62, 1)
    );
    const innerCoreMat = this.trackTempMat(
      new THREE.MeshBasicMaterial({
        color: this.coreColorHex,
        transparent: true,
        opacity: 0.9,
      })
    );
    const innerCoreMesh = new THREE.Mesh(innerCoreGeo, innerCoreMat);
    this.heroRockMesh.add(innerCoreMesh);

    const heroPointLight = new THREE.PointLight(0xf59e0b, 3.2, 24, 1.2);
    this.heroSpaceGroup.add(heroPointLight);

    // 2. Atmospheric Re-Entry Plasma Cones (Attached to front of Hero Meteorite along +Z in lookAt space)
    const plasmaGradientTex = this.trackTempTex(
      this.createPlasmaConeTexture()
    );

    // Cone pointing forward (+Z tip) and flaring backward (-Z wake) around the meteorite
    const outerConeGeo = this.trackTempGeo(
      new THREE.ConeGeometry(2.15, 7.2, 28, 1, true)
    );
    outerConeGeo.rotateX(Math.PI / 2);
    outerConeGeo.translate(0, 0, -2.1);

    this.plasmaOuterMat = this.trackTempMat(
      new THREE.MeshBasicMaterial({
        map: plasmaGradientTex,
        color: 0xf97316,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.plasmaOuterCone = new THREE.Mesh(outerConeGeo, this.plasmaOuterMat);
    this.heroSpaceGroup.add(this.plasmaOuterCone);

    const innerConeGeo = this.trackTempGeo(
      new THREE.ConeGeometry(1.32, 4.6, 24, 1, true)
    );
    innerConeGeo.rotateX(Math.PI / 2);
    innerConeGeo.translate(0, 0, -1.1);

    this.plasmaInnerMat = this.trackTempMat(
      new THREE.MeshBasicMaterial({
        map: plasmaGradientTex,
        color: 0xfef08a,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.plasmaInnerCone = new THREE.Mesh(innerConeGeo, this.plasmaInnerMat);
    this.heroSpaceGroup.add(this.plasmaInnerCone);

    // Incandescent Bow Shockwave Cap at the nose (+Z)
    const bowShockGeo = this.trackTempGeo(
      new THREE.SphereGeometry(1.18, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.48)
    );
    bowShockGeo.rotateX(Math.PI / 2);
    bowShockGeo.translate(0, 0, 0.22);
    this.bowShockMat = this.trackTempMat(
      new THREE.MeshBasicMaterial({
        color: 0xfef9c3,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.bowShockMesh = new THREE.Mesh(bowShockGeo, this.bowShockMat);
    this.heroSpaceGroup.add(this.bowShockMesh);

    this.spaceRigGroup.add(this.heroSpaceGroup);

    // 3. Secondary Meteorite Swarm (7 flanking meteorites on parabolic trajectories)
    const secRockGeo = this.trackTempGeo(
      new THREE.DodecahedronGeometry(0.42, 1)
    );
    const secRockMat = this.trackTempMat(
      new THREE.MeshStandardMaterial({
        map: rockTex,
        color: 0x475569,
        emissive: 0xea580c,
        emissiveIntensity: 0.85,
        roughness: 0.85,
      })
    );
    const secTrailGeo = this.trackTempGeo(
      new THREE.ConeGeometry(0.48, 3.8, 12, 1, true)
    );
    secTrailGeo.rotateX(Math.PI / 2);
    secTrailGeo.translate(0, 0, -1.9);
    const secTrailMat = this.trackTempMat(
      new THREE.MeshBasicMaterial({
        map: plasmaGradientTex,
        color: 0xfb923c,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );

    const swarmOffsets: Array<[number, number, number, number]> = [
      [-4.2, 2.1, -3.5, 0.92],
      [4.8, 1.4, -5.2, 1.08],
      [-6.5, -1.8, -7.0, 0.85],
      [3.2, 3.6, -2.4, 1.15],
      [7.1, -2.2, -6.5, 0.96],
      [-2.8, -3.1, -4.8, 1.04],
      [5.6, 2.8, -8.5, 0.88],
    ];

    this.secondaryMeteors = [];
    for (let i = 0; i < swarmOffsets.length; i++) {
      const [ox, oy, oz, scale] = swarmOffsets[i];
      const mesh = new THREE.Mesh(secRockGeo, secRockMat);
      mesh.scale.setScalar(scale);

      const trailMesh = new THREE.Mesh(secTrailGeo, secTrailMat);
      mesh.add(trailMesh);

      const startOffset = new THREE.Vector3()
        .addScaledVector(this.spaceFlightRight, ox)
        .addScaledVector(this.spaceFlightUp, oy)
        .addScaledVector(this.spaceFlightDir, oz);

      const endOffset = new THREE.Vector3()
        .addScaledVector(this.spaceFlightRight, ox * 0.55)
        .addScaledVector(this.spaceFlightUp, oy * 0.55);

      this.spaceRigGroup.add(mesh);
      this.secondaryMeteors.push({
        mesh,
        trailMesh,
        startOffset,
        endOffset,
        arcHeight: 1.8 + (i % 3) * 1.1,
        speedMultiplier: 0.92 + (i % 4) * 0.05,
        rotSpeed: new THREE.Vector3(
          1.4 + i * 0.3,
          2.1 - i * 0.2,
          1.1 + i * 0.25
        ),
      });
    }

    // 4. Atmospheric Re-Entry Sparks & Smoke Trail Particles (140 particles)
    const particleCount = 140;
    this.reentryParticlePositions = new Float32Array(particleCount * 3);
    this.reentryParticleVelocities = new Float32Array(particleCount * 3);
    this.reentryParticleAges = new Float32Array(particleCount);
    const particleColors = new Float32Array(particleCount * 3);
    const pColor = new THREE.Color();

    for (let i = 0; i < particleCount; i++) {
      this.reentryParticlePositions[i * 3] = this.spaceStartPos.x;
      this.reentryParticlePositions[i * 3 + 1] = this.spaceStartPos.y;
      this.reentryParticlePositions[i * 3 + 2] = this.spaceStartPos.z;
      this.reentryParticleAges[i] = Math.random();

      if (i % 3 === 0) {
        pColor.setHex(0xfef08a); // Nuclear yellow spark
      } else if (i % 3 === 1) {
        pColor.setHex(0xf97316); // Fire orange
      } else {
        pColor.setHex(0xef4444); // Crimson ember wake
      }
      particleColors[i * 3] = pColor.r;
      particleColors[i * 3 + 1] = pColor.g;
      particleColors[i * 3 + 2] = pColor.b;
    }

    const reentryGeo = this.trackTempGeo(new THREE.BufferGeometry());
    reentryGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(this.reentryParticlePositions, 3)
    );
    reentryGeo.setAttribute(
      'color',
      new THREE.BufferAttribute(particleColors, 3)
    );

    const reentryMat = this.trackTempMat(
      new THREE.PointsMaterial({
        size: 0.65,
        vertexColors: true,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.reentryParticlesPoints = new THREE.Points(reentryGeo, reentryMat);
    this.spaceRigGroup.add(this.reentryParticlesPoints);

    // 5. Atmospheric Cloud Layers enveloping the camera during Phase 2 (5.0s -> 8.5s)
    this.cloudDeckGroup = new THREE.Group();
    this.cloudDeckGroup.position.copy(this.spaceAtmosphereEntryPos);
    this.cloudDeckGroup.lookAt(this.spaceStartPos);

    const cloudTex = this.trackTempTex(this.createAtmosphericCloudVeilTexture());
    this.cloudLayerMats = [];

    for (let c = 0; c < 5; c++) {
      const cGeo = this.trackTempGeo(new THREE.PlaneGeometry(22, 22));
      const cMat = this.trackTempMat(
        new THREE.MeshBasicMaterial({
          map: cloudTex,
          color: c < 2 ? 0xfed7aa : 0xe0f2fe,
          transparent: true,
          opacity: 0.0,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      const cMesh = new THREE.Mesh(cGeo, cMat);
      cMesh.position.set(
        ((c % 3) - 1) * 1.2,
        ((c % 2) - 0.5) * 1.2,
        c * 2.4
      );
      cMesh.rotation.z = c * 1.1;
      this.cloudDeckGroup.add(cMesh);
      this.cloudLayerMats.push(cMat);
    }

    this.spaceRigGroup.add(this.cloudDeckGroup);
    this.solarSystemScene.add(this.spaceRigGroup);
  }

  private buildTemporaryUnderwaterSplashRig(): void {
    this.splashTempGroup = new THREE.Group();

    // 1. Water Surface Impact Caustic Ring & Cavitation Vapor Column
    const surfRingGeo = this.trackTempGeo(
      new THREE.RingGeometry(1.2, 9.5, 48)
    );
    surfRingGeo.rotateX(-Math.PI / 2);
    this.splashSurfaceRingMat = this.trackTempMat(
      new THREE.MeshBasicMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.splashSurfaceRing = new THREE.Mesh(
      surfRingGeo,
      this.splashSurfaceRingMat
    );
    this.splashSurfaceRing.position.set(0, 12.5, 0);
    this.splashTempGroup.add(this.splashSurfaceRing);

    const colGeo = this.trackTempGeo(
      new THREE.CylinderGeometry(3.8, 1.35, 18.0, 24, 1, true)
    );
    colGeo.translate(0, 9.0, 0);
    this.splashColumnMat = this.trackTempMat(
      new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.splashColumnMesh = new THREE.Mesh(colGeo, this.splashColumnMat);
    this.splashColumnMesh.position.set(0, -1.8, 0);
    this.splashTempGroup.add(this.splashColumnMesh);

    // 2. Underwater Impact Bubbles & Steam Plume (160 particles)
    const bubbleCount = 160;
    this.splashBubblePositions = new Float32Array(bubbleCount * 3);
    this.splashBubbleVelocities = new Float32Array(bubbleCount * 3);
    const bubbleColors = new Float32Array(bubbleCount * 3);
    const bColor = new THREE.Color();

    for (let i = 0; i < bubbleCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.3 + Math.random() * 2.8;
      this.splashBubblePositions[i * 3] = Math.cos(a) * r;
      this.splashBubblePositions[i * 3 + 1] = -1.2 + Math.random() * 14.0;
      this.splashBubblePositions[i * 3 + 2] = Math.sin(a) * r;

      this.splashBubbleVelocities[i * 3] = Math.cos(a) * (0.8 + Math.random() * 1.8);
      this.splashBubbleVelocities[i * 3 + 1] = 3.5 + Math.random() * 6.5;
      this.splashBubbleVelocities[i * 3 + 2] = Math.sin(a) * (0.8 + Math.random() * 1.8);

      if (i % 4 === 0) {
        bColor.setHex(this.coreColorHex);
      } else if (i % 3 === 0) {
        bColor.setHex(0xfef08a);
      } else {
        bColor.setHex(0xe0f2fe);
      }
      bubbleColors[i * 3] = bColor.r;
      bubbleColors[i * 3 + 1] = bColor.g;
      bubbleColors[i * 3 + 2] = bColor.b;
    }

    const bubbleGeo = this.trackTempGeo(new THREE.BufferGeometry());
    bubbleGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(this.splashBubblePositions, 3)
    );
    bubbleGeo.setAttribute(
      'color',
      new THREE.BufferAttribute(bubbleColors, 3)
    );
    const bubbleMat = this.trackTempMat(
      new THREE.PointsMaterial({
        size: 0.45,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.splashBubblesPoints = new THREE.Points(bubbleGeo, bubbleMat);
    this.splashTempGroup.add(this.splashBubblesPoints);

    // 3. Phase 4 Bioluminescent Fracture Flash & Shockwave Ring at (0, 0)
    const shockGeo = this.trackTempGeo(new THREE.RingGeometry(0.6, 1.4, 48));
    shockGeo.rotateX(-Math.PI / 2);
    this.genesisShockwaveMat = this.trackTempMat(
      new THREE.MeshBasicMaterial({
        color: this.coreColorHex,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.genesisShockwaveMesh = new THREE.Mesh(
      shockGeo,
      this.genesisShockwaveMat
    );
    this.genesisShockwaveMesh.position.set(0, -1.1, 0);
    this.splashTempGroup.add(this.genesisShockwaveMesh);

    const flashSphereGeo = this.trackTempGeo(
      new THREE.SphereGeometry(1.25, 24, 24)
    );
    this.genesisFlashMat = this.trackTempMat(
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.genesisFlashSphere = new THREE.Mesh(
      flashSphereGeo,
      this.genesisFlashMat
    );
    this.genesisFlashSphere.position.set(0, -1.0, 0);
    this.splashTempGroup.add(this.genesisFlashSphere);

    this.splashTempGroup.visible = false;
    this.environmentScene.add(this.splashTempGroup);
  }

  /**
   * Advances the 13-second Panspermia Intro Cinematic timeline and returns
   * which scene & camera to render plus whether the cinematic has completed.
   */
  public update(
    delta: number,
    elapsedActiveTime: number,
    solarCamera: THREE.PerspectiveCamera,
    gameplayCamera: THREE.PerspectiveCamera,
    playerGroup: THREE.Group,
    screenShakeEnabled: boolean
  ): {
    useEnvironmentScene: boolean;
    completed: boolean;
    snapshotState: IntroCinematicState;
  } {
    this.elapsed = Math.min(
      IntroCinematicController.TOTAL_DURATION,
      this.elapsed + delta
    );
    const t = this.elapsed;

    // Determine Phase (0..4)
    const phase: 0 | 1 | 2 | 3 | 4 =
      t < 1.5
        ? 0
        : t < 5.0
        ? 1
        : t < 8.5
        ? 2
        : t < 10.5
        ? 3
        : 4;

    const useEnvironmentScene = t >= IntroCinematicController.SPACE_END_TIME;

    // 1. Compute UI Overlay Opacities & Narrative Captions
    let fadeOpacity = 0.0;
    if (t < 1.5) {
      // Phase 0: Dissolve black screen (1 -> 0)
      fadeOpacity = Math.pow(1.0 - t / 1.5, 1.35);
    }

    let cloudOverlayOpacity = 0.0;
    if (t >= 6.8 && t <= 9.1) {
      // Atmospheric cloud & fiery veil peaking around t = 8.4s right as we transition into the ocean
      const cloudBell = Math.sin(((t - 6.8) / 2.3) * Math.PI);
      cloudOverlayOpacity = Math.pow(Math.max(0, cloudBell), 1.2) * 0.85;
    }

    let splashOverlayOpacity = 0.0;
    if (t >= 8.3 && t <= 9.6) {
      // Ocean impact water & white foam splash flash peaking at t = 8.55s
      const splashBell = Math.sin(((t - 8.3) / 1.3) * Math.PI);
      splashOverlayOpacity = Math.pow(Math.max(0, splashBell), 1.3) * 0.92;
    }

    const phaseMeta = this.getPhaseNarrative(phase);

    // ==========================================================================
    // PHASES 0, 1, 2 (0.0s -> 8.5s): DEEP SPACE SWARM & IGNEOUS RE-ENTRY
    // ==========================================================================
    if (!useEnvironmentScene && this.heroSpaceGroup) {
      if (this.splashTempGroup) this.splashTempGroup.visible = false;
      playerGroup.visible = false;

      // Normalized flight progress from deep space (0.0) to upper atmosphere cloud deck (1.0)
      const rawSpaceProgress = THREE.MathUtils.clamp(t / 8.5, 0, 1);
      // Accelerating gravitational pull curve toward the planet
      const flightT =
        0.65 * rawSpaceProgress + 0.35 * rawSpaceProgress * rawSpaceProgress;

      const currentHeroPos = new THREE.Vector3().lerpVectors(
        this.spaceStartPos,
        this.spaceAtmosphereEntryPos,
        flightT
      );
      this.heroSpaceGroup.position.copy(currentHeroPos);
      this.heroSpaceGroup.lookAt(this.spaceAtmosphereEntryPos);

      // Tumble the rocky meteorite core organically
      if (this.heroRockMesh) {
        this.heroRockMesh.rotation.x += delta * 1.45;
        this.heroRockMesh.rotation.y += delta * 2.1;
        this.heroRockMesh.rotation.z += delta * 0.85;
      }

      // Re-Entry Plasma Cone Ignition (Ramps up from t = 4.6s to 8.5s)
      const heatRatio = THREE.MathUtils.smoothstep(t, 4.6, 7.6);
      if (t >= 0.45 && !this.playedSpaceWhistle) {
        this.playedSpaceWhistle = true;
        audioManager.playSpaceBolideWhistle();
      }
      if (t >= 4.75 && !this.playedReentryRoar) {
        this.playedReentryRoar = true;
        audioManager.playMeteorAtmosphericEntry(heatRatio);
      }
      if (
        this.plasmaOuterMat &&
        this.plasmaInnerMat &&
        this.bowShockMat &&
        this.plasmaOuterCone &&
        this.plasmaInnerCone
      ) {
        const flicker = 0.88 + Math.sin(t * 28.0) * 0.12;
        this.plasmaOuterMat.opacity = heatRatio * 0.78 * flicker;
        this.plasmaInnerMat.opacity = heatRatio * 0.92 * flicker;
        this.bowShockMat.opacity = heatRatio * 0.85 * flicker;

        this.plasmaOuterCone.rotation.z += delta * 8.5;
        this.plasmaInnerCone.rotation.z -= delta * 12.0;
        const coneScale = 0.75 + heatRatio * 0.45;
        this.plasmaOuterCone.scale.set(
          coneScale,
          coneScale,
          0.6 + heatRatio * 0.75
        );
      }

      if (this.heroRockMat) {
        this.heroRockMat.emissiveIntensity =
          1.1 + heatRatio * 2.4 + Math.sin(t * 14.0) * 0.25;
      }

      // Update 7 Secondary Meteorites on parabolic arcs toward the planet globe
      for (let i = 0; i < this.secondaryMeteors.length; i++) {
        const sec = this.secondaryMeteors[i];
        const secT = THREE.MathUtils.clamp(
          flightT * sec.speedMultiplier,
          0,
          1.05
        );
        const basePos = new THREE.Vector3().lerpVectors(
          this.spaceStartPos.clone().add(sec.startOffset),
          this.spaceAtmosphereEntryPos.clone().add(sec.endOffset),
          secT
        );
        const parabola = Math.sin(Math.min(1, secT) * Math.PI) * sec.arcHeight;
        basePos.addScaledVector(this.spaceFlightUp, parabola);

        sec.mesh.position.copy(basePos);
        sec.mesh.lookAt(
          this.spaceAtmosphereEntryPos.clone().add(sec.endOffset)
        );
        sec.mesh.rotation.z += delta * sec.rotSpeed.z;
      }

      // Update Re-entry Spark & Smoke Trail Particles
      if (
        this.reentryParticlesPoints &&
        this.reentryParticlePositions &&
        this.reentryParticleVelocities &&
        this.reentryParticleAges
      ) {
        const posAttr = this.reentryParticlesPoints.geometry.getAttribute(
          'position'
        ) as THREE.BufferAttribute;
        const count = this.reentryParticleAges.length;
        const wakeSpeed = 14.0 + heatRatio * 24.0;

        for (let i = 0; i < count; i++) {
          this.reentryParticleAges[i] += delta * (1.4 + heatRatio * 1.8);
          if (this.reentryParticleAges[i] >= 1.0) {
            this.reentryParticleAges[i] = 0;
            const spread = 0.45 + heatRatio * 0.65;
            const rx = (Math.random() - 0.5) * spread;
            const ry = (Math.random() - 0.5) * spread;
            const rz = (Math.random() - 0.5) * spread;
            this.reentryParticlePositions[i * 3] = currentHeroPos.x + rx;
            this.reentryParticlePositions[i * 3 + 1] = currentHeroPos.y + ry;
            this.reentryParticlePositions[i * 3 + 2] = currentHeroPos.z + rz;

            // Emit backwards opposite to flight direction with turbulent spread
            this.reentryParticleVelocities[i * 3] =
              -this.spaceFlightDir.x * wakeSpeed + (Math.random() - 0.5) * 6.0;
            this.reentryParticleVelocities[i * 3 + 1] =
              -this.spaceFlightDir.y * wakeSpeed + (Math.random() - 0.5) * 6.0;
            this.reentryParticleVelocities[i * 3 + 2] =
              -this.spaceFlightDir.z * wakeSpeed + (Math.random() - 0.5) * 6.0;
          } else {
            this.reentryParticlePositions[i * 3] +=
              this.reentryParticleVelocities[i * 3] * delta;
            this.reentryParticlePositions[i * 3 + 1] +=
              this.reentryParticleVelocities[i * 3 + 1] * delta;
            this.reentryParticlePositions[i * 3 + 2] +=
              this.reentryParticleVelocities[i * 3 + 2] * delta;
          }
          posAttr.setXYZ(
            i,
            this.reentryParticlePositions[i * 3],
            this.reentryParticlePositions[i * 3 + 1],
            this.reentryParticlePositions[i * 3 + 2]
          );
        }
        posAttr.needsUpdate = true;
      }

      // Fade in 3D Cloud Deck planes as meteorite approaches upper atmosphere (5.5s -> 8.5s)
      const cloud3dAlpha = THREE.MathUtils.smoothstep(t, 5.4, 8.2);
      for (let c = 0; c < this.cloudLayerMats.length; c++) {
        this.cloudLayerMats[c].opacity = cloud3dAlpha * 0.52;
      }

      // Camera Choreography for Phases 0, 1, 2
      if (t < 5.0) {
        // Phase 0 & 1: Dynamic pursuit chase-cam behind and slightly above the meteorite swarm,
        // framing both the glowing hero meteorite in the foreground and the planet + mother star ahead
        const chaseProgress = THREE.MathUtils.clamp(t / 5.0, 0, 1);
        const sideSwing = Math.sin(chaseProgress * Math.PI) * 2.2;
        const camPos = currentHeroPos
          .clone()
          .addScaledVector(this.spaceFlightDir, -5.2 + chaseProgress * 1.1)
          .addScaledVector(this.spaceFlightRight, 1.4 + sideSwing)
          .addScaledVector(this.spaceFlightUp, 1.65 - chaseProgress * 0.45);

        const lookTarget = currentHeroPos
          .clone()
          .addScaledVector(this.spaceFlightDir, 8.5);

        solarCamera.position.copy(camPos);
        solarCamera.lookAt(lookTarget);
      } else {
        // Phase 2 (5.0s -> 8.5s): Dramatic lateral/frontal re-entry angle with plasma cone & atmospheric shake
        const reentryP = (t - 5.0) / 3.5;
        const camPos = currentHeroPos
          .clone()
          .addScaledVector(
            this.spaceFlightDir,
            THREE.MathUtils.lerp(3.4, -2.4, reentryP)
          )
          .addScaledVector(
            this.spaceFlightRight,
            THREE.MathUtils.lerp(2.8, 1.35, reentryP)
          )
          .addScaledVector(
            this.spaceFlightUp,
            THREE.MathUtils.lerp(0.85, 1.1, reentryP)
          );

        if (screenShakeEnabled) {
          const shakeAmp = (0.06 + reentryP * 0.16) * Math.sin(t * 42.0);
          const shakeAmpY = (0.06 + reentryP * 0.14) * Math.cos(t * 37.0);
          camPos.addScaledVector(this.spaceFlightRight, shakeAmp);
          camPos.addScaledVector(this.spaceFlightUp, shakeAmpY);
        }

        const lookTarget = currentHeroPos
          .clone()
          .addScaledVector(this.spaceFlightDir, 1.2);
        solarCamera.position.copy(camPos);
        solarCamera.lookAt(lookTarget);
      }
    } else {
      // ========================================================================
      // PHASES 3 & 4 (8.5s -> 13.0s): OCEAN SPLASH, SEABED FRACTURE & CELL GENESIS
      // ========================================================================
      if (this.spaceRigGroup) {
        this.spaceRigGroup.visible = false;
      }
      if (this.splashTempGroup) {
        this.splashTempGroup.visible = true;
      }

      this.updatePermanentMonument(delta, elapsedActiveTime, true);

      // Animate underwater splash bubble column
      if (
        this.splashBubblesPoints &&
        this.splashBubblePositions &&
        this.splashBubbleVelocities
      ) {
        const bAttr = this.splashBubblesPoints.geometry.getAttribute(
          'position'
        ) as THREE.BufferAttribute;
        const bCount = this.splashBubbleVelocities.length / 3;
        for (let i = 0; i < bCount; i++) {
          this.splashBubblePositions[i * 3] +=
            this.splashBubbleVelocities[i * 3] * delta * 0.35;
          this.splashBubblePositions[i * 3 + 1] +=
            this.splashBubbleVelocities[i * 3 + 1] * delta;
          this.splashBubblePositions[i * 3 + 2] +=
            this.splashBubbleVelocities[i * 3 + 2] * delta * 0.35;

          if (this.splashBubblePositions[i * 3 + 1] > 16.0) {
            const a = Math.random() * Math.PI * 2;
            const r = 0.25 + Math.random() * 1.6;
            this.splashBubblePositions[i * 3] = Math.cos(a) * r;
            this.splashBubblePositions[i * 3 + 1] = -1.6;
            this.splashBubblePositions[i * 3 + 2] = Math.sin(a) * r;
          }
          bAttr.setXYZ(
            i,
            this.splashBubblePositions[i * 3],
            this.splashBubblePositions[i * 3 + 1],
            this.splashBubblePositions[i * 3 + 2]
          );
        }
        bAttr.needsUpdate = true;
      }

      if (t < 10.5) {
        // Phase 3 (8.5s -> 10.5s): Ocean Splash & Underwater Plunge to the Seabed at (0, 0)
        if (!this.playedOceanSplash) {
          this.playedOceanSplash = true;
          audioManager.playOceanImpact();
        }
        const splashP = THREE.MathUtils.clamp((t - 8.5) / 2.0, 0, 1);
        const descendEase = 1 - Math.pow(1 - splashP, 2.6);

        playerGroup.visible = false;
        this.setMonumentFractureProgress(0.0);

        // Meteorite plunges from ocean surface (Y = +15.0) down onto the seabed crater (Y = 0 local to monument)
        this.meteorAssemblyGroup.position.set(
          0,
          (1.0 - descendEase) * 15.0,
          0
        );
        this.meteorAssemblyGroup.rotation.set(
          (1.0 - descendEase) * 2.4,
          (1.0 - descendEase) * 3.2,
          0
        );

        // Cavitation water column & surface caustic ring fade
        if (
          this.splashColumnMat &&
          this.splashSurfaceRingMat &&
          this.splashSurfaceRing
        ) {
          this.splashColumnMat.opacity = (1.0 - splashP * 0.75) * 0.48;
          this.splashSurfaceRingMat.opacity = (1.0 - splashP) * 0.75;
          const ringScale = 0.6 + splashP * 2.4;
          this.splashSurfaceRing.scale.setScalar(ringScale);
        }

        // Camera plunges beneath the waves following the sinking meteorite toward the seabed
        const camY = THREE.MathUtils.lerp(18.5, 6.2, descendEase);
        const camZ = THREE.MathUtils.lerp(14.5, 8.8, descendEase);
        const camX = THREE.MathUtils.lerp(-4.5, -1.6, descendEase);
        gameplayCamera.position.set(camX, camY, camZ);

        if (screenShakeEnabled && splashP > 0.75) {
          // Seabed impact tremor when the meteorite hits the ocean floor
          const impactTremor = Math.sin(t * 50.0) * 0.18 * (1.0 - splashP);
          gameplayCamera.position.x += impactTremor;
          gameplayCamera.position.y += impactTremor * 0.7;
        }

        gameplayCamera.lookAt(
          0,
          this.originMonumentGroup.position.y +
            this.meteorAssemblyGroup.position.y +
            0.6,
          0
        );
      } else {
        // Phase 4 (10.5s -> 13.0s): Seabed Tremor, Physical Fracture into Two Halves & Cell Genesis!
        const phase4P = THREE.MathUtils.clamp((t - 10.5) / 2.5, 0, 1);

        if (this.splashColumnMat && this.splashSurfaceRingMat) {
          this.splashColumnMat.opacity = Math.max(
            0,
            0.12 * (1.0 - phase4P * 2.0)
          );
          this.splashSurfaceRingMat.opacity = 0;
        }

        if (t < 11.25) {
          // Sub-phase 4A (10.5s -> 11.25s): Smoking meteorite on seabed trembles & fissures glow nuclear bright
          const trembleP = (t - 10.5) / 0.75;
          playerGroup.visible = false;
          this.setMonumentFractureProgress(trembleP * 0.12);

          const vibe = Math.sin(t * 68.0) * 0.09 * trembleP;
          this.meteorAssemblyGroup.position.set(
            vibe,
            0,
            Math.cos(t * 62.0) * 0.07 * trembleP
          );
          this.monumentRockMat.emissiveIntensity = 1.4 + trembleP * 3.2;
          this.monumentCoreMat.emissiveIntensity = 2.0 + trembleP * 4.0;
          this.monumentCoreLight.intensity = 2.5 + trembleP * 5.0;
        } else {
          // Sub-phase 4B (11.25s -> 13.0s): Physical Fracture into Left & Right Halves + Bioluminescent Flash + Cell Emergence
          if (!this.playedMeteorCrack) {
            this.playedMeteorCrack = true;
            audioManager.playMeteorCrackOpen();
          }
          const hatchP = THREE.MathUtils.clamp((t - 11.25) / 1.75, 0, 1);
          const splitProgress = 0.12 + 0.88 * Math.min(1, hatchP * 1.45);
          this.meteorAssemblyGroup.position.set(0, 0, 0);
          this.setMonumentFractureProgress(splitProgress);

          // Bioluminescent Shockwave & Core Flash
          if (
            this.genesisShockwaveMesh &&
            this.genesisShockwaveMat &&
            this.genesisFlashSphere &&
            this.genesisFlashMat
          ) {
            const flashAlpha = Math.max(0, 1.0 - hatchP * 1.65);
            this.genesisFlashMat.opacity = flashAlpha * 0.88;
            this.genesisFlashSphere.scale.setScalar(1.0 + hatchP * 4.5);

            this.genesisShockwaveMat.opacity = Math.max(
              0,
              (1.0 - hatchP) * 0.82
            );
            this.genesisShockwaveMesh.scale.setScalar(1.0 + hatchP * 9.5);
          }

          // Nascent Player Cell emerges from inside the fractured meteorite up to SWIM_PLANE_Y (0)
          playerGroup.visible = true;
          const cellRiseEase = 1 - Math.pow(1 - hatchP, 3);
          const startY = this.originMonumentGroup.position.y + 0.65;
          const targetY = GAME_CONFIG.WORLD.SWIM_PLANE_Y;
          playerGroup.position.set(
            0,
            THREE.MathUtils.lerp(startY, targetY, cellRiseEase),
            0
          );

          const birthScale = THREE.MathUtils.lerp(0.24, 1.0, cellRiseEase);
          playerGroup.scale.setScalar(birthScale);

          // Settle monument glow to warm ambient level
          this.monumentRockMat.emissiveIntensity = THREE.MathUtils.lerp(
            4.2,
            0.95,
            hatchP
          );
          this.monumentCoreMat.emissiveIntensity = THREE.MathUtils.lerp(
            5.5,
            1.35,
            hatchP
          );
          this.monumentCoreLight.intensity = THREE.MathUtils.lerp(
            7.0,
            1.8,
            hatchP
          );
        }

        // Smoothly interpolate camera from close-up seabed framing into standard CameraController gameplay view
        // Standard CameraController default at (0, 0, 0) with heading 0:
        // position = (0, CAMERA.OFFSET_UP = 13.5, CAMERA.OFFSET_BACK = 17.5), lookAt = (0, 0, -3.5 * 0.38)
        const camSettleT = THREE.MathUtils.smoothstep(t, 11.1, 13.0);
        const closeCamPos = new THREE.Vector3(-1.4, 5.4, 7.8);
        const gameplayCamPos = new THREE.Vector3(
          0,
          GAME_CONFIG.CAMERA.OFFSET_UP,
          GAME_CONFIG.CAMERA.OFFSET_BACK
        );
        gameplayCamera.position.lerpVectors(
          closeCamPos,
          gameplayCamPos,
          camSettleT
        );

        const closeLookAt = new THREE.Vector3(
          0,
          this.originMonumentGroup.position.y + 0.75,
          0
        );
        const gameplayLookAt = new THREE.Vector3(
          0,
          GAME_CONFIG.WORLD.SWIM_PLANE_Y,
          -GAME_CONFIG.CAMERA.LOOK_AHEAD_DISTANCE * 0.38
        );
        const currentLookAt = new THREE.Vector3().lerpVectors(
          closeLookAt,
          gameplayLookAt,
          camSettleT
        );
        gameplayCamera.lookAt(currentLookAt);
      }
    }

    const completed = t >= IntroCinematicController.TOTAL_DURATION;
    if (completed) {
      this.finishAndCleanUp(playerGroup);
    }

    return {
      useEnvironmentScene,
      completed,
      snapshotState: {
        active: this.isActive,
        phase,
        elapsed: this.elapsed,
        duration: IntroCinematicController.TOTAL_DURATION,
        fadeOpacity,
        cloudOverlayOpacity,
        splashOverlayOpacity,
        atmosphereColorHex: this.atmosphereColorHex,
        planetName: this.planetName,
        speciesName: this.speciesName,
        phaseTitle: phaseMeta.title,
        phaseSubtitle: phaseMeta.subtitle,
      },
    };
  }

  /**
   * Cleanly finishes or skips the intro cinematic:
   * - Disposes all temporary space/re-entry/splash meshes and textures
   * - Anchors the fractured origin meteorite (`MeteorFragmentLeft` & `MeteorFragmentRight`) at (0, 0)
   * - Restores the player cell to (0, SWIM_PLANE_Y, 0) at scale 1.0
   */
  public finishAndCleanUp(playerGroup: THREE.Group): void {
    this.isActive = false;
    audioManager.stopCinematicSounds();
    this.disposeTemporaryCinematicAssets();

    // Ensure the permanent fractured meteorite monument at (0, 0) is open and smoking on the seabed
    this.originMonumentGroup.visible = true;
    this.meteorAssemblyGroup.position.set(0, 0, 0);
    this.meteorAssemblyGroup.rotation.set(0, 0, 0);
    this.setMonumentFractureProgress(1.0);

    // Ensure player cell is visible at origin swim plane
    playerGroup.visible = true;
    playerGroup.position.set(0, GAME_CONFIG.WORLD.SWIM_PLANE_Y, 0);
    playerGroup.scale.setScalar(1.0);
  }

  public isCinematicActive(): boolean {
    return this.isActive;
  }

  private getPhaseNarrative(phase: 0 | 1 | 2 | 3 | 4): {
    title: string;
    subtitle: string;
  } {
    switch (phase) {
      case 0:
        return {
          title: `Sistema Planetario · ${this.planetName}`,
          subtitle:
            'Fragmentos portadores de compuestos prebióticos se aproximan desde el espacio profundo...',
        };
      case 1:
        return {
          title: 'Lluvia de Panspermia Litopanspérmica',
          subtitle: `Un enjambre de meteoritos ricos en aminoácidos converge hacia los océanos de ${this.planetName}.`,
        };
      case 2:
        return {
          title: 'Reentrada Atmosférica Ígnea',
          subtitle:
            'El escudo basáltico soporta el plasma incandescente mientras atraviesa el manto nuboso.',
        };
      case 3:
        return {
          title: 'Impacto en el Océano Primigenio',
          subtitle:
            'El choque térmico levanta columnas de vapor y sumerge el núcleo hacia el lecho abisal.',
        };
      case 4:
        return {
          title: `Génesis de ${this.speciesName}`,
          subtitle:
            'La corteza meteorítica se fractura en el fondo marino, liberando a la primera célula de tu estirpe.',
        };
    }
  }

  // ============================================================================
  // PROCEDURAL TEXTURES FOR METEORITE & RE-ENTRY PLASMA
  // ============================================================================

  private createMeteorRockTextures(coreHex: number): {
    rockTex: THREE.CanvasTexture;
    emissiveTex: THREE.CanvasTexture;
  } {
    const w = 256;
    const h = 256;

    const rockCanvas = document.createElement('canvas');
    rockCanvas.width = w;
    rockCanvas.height = h;
    const rCtx = rockCanvas.getContext('2d')!;

    rCtx.fillStyle = '#1e293b';
    rCtx.fillRect(0, 0, w, h);

    // Rough basaltic craters & mineral speckles
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = 4 + Math.random() * 22;
      rCtx.fillStyle =
        i % 2 === 0 ? 'rgba(15, 23, 42, 0.55)' : 'rgba(71, 85, 105, 0.38)';
      rCtx.beginPath();
      rCtx.arc(x, y, r, 0, Math.PI * 2);
      rCtx.fill();
    }

    const emiCanvas = document.createElement('canvas');
    emiCanvas.width = w;
    emiCanvas.height = h;
    const eCtx = emiCanvas.getContext('2d')!;

    eCtx.fillStyle = '#000000';
    eCtx.fillRect(0, 0, w, h);

    const coreColorCss = '#' + coreHex.toString(16).padStart(6, '0');

    // Glowing magma & bioluminescent fracture veins across the meteorite crust
    for (let v = 0; v < 18; v++) {
      eCtx.strokeStyle = v % 2 === 0 ? coreColorCss : '#f59e0b';
      eCtx.lineWidth = 2.5 + (v % 3) * 1.5;
      eCtx.beginPath();
      let cx = Math.random() * w;
      let cy = Math.random() * h;
      eCtx.moveTo(cx, cy);
      for (let s = 0; s < 5; s++) {
        cx += (Math.random() - 0.5) * 65;
        cy += (Math.random() - 0.5) * 65;
        eCtx.lineTo(cx, cy);
      }
      eCtx.stroke();
    }

    const rockTex = new THREE.CanvasTexture(rockCanvas);
    rockTex.colorSpace = THREE.SRGBColorSpace;
    const emissiveTex = new THREE.CanvasTexture(emiCanvas);
    emissiveTex.colorSpace = THREE.SRGBColorSpace;

    return { rockTex, emissiveTex };
  }

  private createPlasmaConeTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Gradient from nuclear yellow-white at tip to fire orange-red to transparent dark smoke at tail
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, 'rgba(254, 249, 195, 0.98)');
    grad.addColorStop(0.22, 'rgba(251, 191, 36, 0.9)');
    grad.addColorStop(0.52, 'rgba(234, 88, 12, 0.72)');
    grad.addColorStop(0.78, 'rgba(185, 28, 28, 0.35)');
    grad.addColorStop(1.0, 'rgba(15, 23, 42, 0.0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 256);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private createAtmosphericCloudVeilTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, 256, 256);
    for (let i = 0; i < 24; i++) {
      const x = 48 + Math.random() * 160;
      const y = 48 + Math.random() * 160;
      const r = 32 + Math.random() * 58;
      const g = ctx.createRadialGradient(x, y, 4, x, y, r);
      g.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
      g.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  public disposeTemporaryCinematicAssets(): void {
    if (this.spaceRigGroup) {
      this.solarSystemScene.remove(this.spaceRigGroup);
      this.spaceRigGroup = null;
    }
    if (this.splashTempGroup) {
      this.environmentScene.remove(this.splashTempGroup);
      this.splashTempGroup = null;
    }

    for (const geo of this.tempGeometries) {
      geo.dispose();
    }
    for (const mat of this.tempMaterials) {
      mat.dispose();
    }
    for (const tex of this.tempTextures) {
      tex.dispose();
    }

    this.tempGeometries = [];
    this.tempMaterials = [];
    this.tempTextures = [];
    this.secondaryMeteors = [];
    this.cloudLayerMats = [];
    this.heroSpaceGroup = null;
    this.heroRockMesh = null;
    this.heroRockMat = null;
    this.plasmaOuterCone = null;
    this.plasmaInnerCone = null;
    this.plasmaOuterMat = null;
    this.plasmaInnerMat = null;
    this.bowShockMesh = null;
    this.bowShockMat = null;
    this.reentryParticlesPoints = null;
    this.reentryParticlePositions = null;
    this.reentryParticleVelocities = null;
    this.reentryParticleAges = null;
    this.cloudDeckGroup = null;
    this.splashColumnMesh = null;
    this.splashColumnMat = null;
    this.splashSurfaceRing = null;
    this.splashSurfaceRingMat = null;
    this.splashBubblesPoints = null;
    this.splashBubblePositions = null;
    this.splashBubbleVelocities = null;
    this.genesisShockwaveMesh = null;
    this.genesisShockwaveMat = null;
    this.genesisFlashSphere = null;
    this.genesisFlashMat = null;
  }

  public dispose(): void {
    this.disposeTemporaryCinematicAssets();
    this.environmentScene.remove(this.originMonumentGroup);
    for (const geo of this.permanentGeometries) {
      geo.dispose();
    }
    for (const mat of this.permanentMaterials) {
      mat.dispose();
    }
    for (const tex of this.permanentTextures) {
      tex.dispose();
    }
  }
}
