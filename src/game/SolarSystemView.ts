import * as THREE from 'three';
import { audioManager } from './AudioManager';
import { PLANET_CATALOG, PlanetCatalogDefinition } from './SaveSystem';
import { PlanetSlotMetadata, PlanetTheme } from './types';

interface PlanetVisualRig {
  slotId: number;
  definition: PlanetCatalogDefinition;
  orbitAngle: number;
  angularSpeed: number;
  pivotGroup: THREE.Group;
  tiltGroup: THREE.Group;
  surfaceMesh: THREE.Mesh;
  cloudMesh: THREE.Mesh;
  atmosphereMesh: THREE.Mesh;
  selectionHaloMesh: THREE.Mesh;
  virginScannerRing: THREE.Mesh;
  ringMesh: THREE.Mesh | null;
  hitMesh: THREE.Mesh;
  orbitRingMesh: THREE.Mesh;
  orbitRingMaterial: THREE.MeshBasicMaterial;
  virginMaterial: THREE.MeshStandardMaterial;
  colonizedMaterial: THREE.MeshStandardMaterial;
  cloudMaterial: THREE.MeshStandardMaterial;
  atmosphereMaterial: THREE.MeshBasicMaterial;
  selectionHaloMaterial: THREE.MeshBasicMaterial;
  hasSave: boolean;
}

export class SolarSystemView {
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;

  private sunCoreMesh!: THREE.Mesh;
  private sunCoronaInner!: THREE.Mesh;
  private sunCoronaOuter!: THREE.Mesh;
  private sunFlareDisc!: THREE.Mesh;
  private starfieldPoints!: THREE.Points;
  private nebulaGroup!: THREE.Group;

  private planetRigs: PlanetVisualRig[] = [];
  private hitMeshes: THREE.Object3D[] = [];

  private raycaster = new THREE.Raycaster();
  private pointerNdc = new THREE.Vector2(-999, -999);

  private selectedSlotId: number | null = null;
  private hoveredSlotId: number | null = null;

  // Orbital Camera State (General View)
  private orbitAzimuth = 0.55;
  private orbitPolar = 1.02; // radians from +Y pole
  private orbitDistance = 128;
  private targetAzimuth = 0.55;
  private targetPolar = 1.02;
  private targetDistance = 128;

  // Smooth Camera Interpolation Vectors
  private currentCameraPos = new THREE.Vector3(0, 68, 112);
  private currentLookAt = new THREE.Vector3(0, 0, 0);
  private desiredCameraPos = new THREE.Vector3(0, 68, 112);
  private desiredLookAt = new THREE.Vector3(0, 0, 0);

  // Pointer Drag Tracking
  private isDraggingOrbit = false;
  private pointerDownPos = { x: 0, y: 0 };
  private lastDragPos = { x: 0, y: 0 };
  private dragMovedDistance = 0;

  // Resource tracking for clean disposal
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];

  private onSelectionChange: (
    selectedSlotId: number | null,
    hoveredSlotId: number | null
  ) => void;

  constructor(
    width: number,
    height: number,
    initialSlots: PlanetSlotMetadata[],
    onSelectionChange: (
      selectedSlotId: number | null,
      hoveredSlotId: number | null
    ) => void
  ) {
    this.onSelectionChange = onSelectionChange;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020611);
    this.scene.fog = new THREE.FogExp2(0x020611, 0.0014);

    this.camera = new THREE.PerspectiveCamera(
      48,
      Math.max(1, width) / Math.max(1, height),
      0.5,
      900
    );
    this.camera.position.copy(this.currentCameraPos);
    this.camera.lookAt(this.currentLookAt);

    this.buildLighting();
    this.buildDeepSpaceSkybox();
    this.buildCentralMotherStar();
    this.buildPlanetsAndOrbits(initialSlots);
  }

  private trackGeometry<T extends THREE.BufferGeometry>(geo: T): T {
    this.geometries.push(geo);
    return geo;
  }

  private trackMaterial<T extends THREE.Material>(mat: T): T {
    this.materials.push(mat);
    return mat;
  }

  private trackTexture<T extends THREE.Texture>(tex: T): T {
    this.textures.push(tex);
    return tex;
  }

  private buildLighting(): void {
    // Central solar point light illuminating the day side of all orbiting planets
    const sunLight = new THREE.PointLight(0xffedd5, 4.6, 420, 0.32);
    sunLight.position.set(0, 0, 0);
    this.scene.add(sunLight);

    // Warm secondary solar fill light for close orbits
    const innerSolarGlow = new THREE.PointLight(0xf59e0b, 2.2, 140, 0.6);
    innerSolarGlow.position.set(0, 2, 0);
    this.scene.add(innerSolarGlow);

    // Deep cosmic ambient & hemisphere light so night sides retain subtle bioluminescent legibility
    const ambient = new THREE.AmbientLight(0x16243b, 1.15);
    this.scene.add(ambient);

    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.55);
    hemiLight.position.set(0, 120, 0);
    this.scene.add(hemiLight);
  }

  private buildDeepSpaceSkybox(): void {
    // 1. Starfield (2,600 procedural stars with HSL color diversity)
    const starCount = 2600;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const tempColor = new THREE.Color();

    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const radius = 230 + Math.random() * 260;

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi) * 0.82;
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

      // HSL variation: blue giants, cyan pulsars, warm amber stars, pure white
      const paletteRoll = Math.random();
      if (paletteRoll < 0.35) {
        tempColor.setHSL(0.55 + Math.random() * 0.08, 0.85, 0.78 + Math.random() * 0.2);
      } else if (paletteRoll < 0.6) {
        tempColor.setHSL(0.1 + Math.random() * 0.06, 0.9, 0.8 + Math.random() * 0.18);
      } else if (paletteRoll < 0.78) {
        tempColor.setHSL(0.76 + Math.random() * 0.08, 0.75, 0.78 + Math.random() * 0.2);
      } else {
        tempColor.setRGB(0.95, 0.97, 1.0);
      }

      colors[i * 3] = tempColor.r;
      colors[i * 3 + 1] = tempColor.g;
      colors[i * 3 + 2] = tempColor.b;
    }

    const starGeo = this.trackGeometry(new THREE.BufferGeometry());
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starMat = this.trackMaterial(
      new THREE.PointsMaterial({
        size: 1.55,
        vertexColors: true,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );

    this.starfieldPoints = new THREE.Points(starGeo, starMat);
    this.scene.add(this.starfieldPoints);

    // 2. Cosmic Nebula Layers (Procedural translucent clouds in deep purple, cyan, and indigo)
    this.nebulaGroup = new THREE.Group();
    const nebulaConfigs = [
      { colorA: '#0891b2', colorB: '#1e1b4b', radius: 340, rotY: 0.4, rotZ: 0.18, opacity: 0.24 },
      { colorA: '#4f46e5', colorB: '#0f172a', radius: 365, rotY: 2.1, rotZ: -0.22, opacity: 0.2 },
      { colorA: '#0d9488', colorB: '#311042', radius: 390, rotY: 4.0, rotZ: 0.12, opacity: 0.18 },
    ];

    for (const cfg of nebulaConfigs) {
      const tex = this.createNebulaTexture(cfg.colorA, cfg.colorB);
      const geo = this.trackGeometry(new THREE.SphereGeometry(cfg.radius, 32, 24));
      const mat = this.trackMaterial(
        new THREE.MeshBasicMaterial({
          map: tex,
          side: THREE.BackSide,
          transparent: true,
          opacity: cfg.opacity,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.set(0.1, cfg.rotY, cfg.rotZ);
      this.nebulaGroup.add(mesh);
    }

    this.scene.add(this.nebulaGroup);
  }

  private buildCentralMotherStar(): void {
    const sunGroup = new THREE.Group();

    const sunSurfaceTex = this.createSolarSurfaceTexture();
    const sunCoreGeo = this.trackGeometry(new THREE.SphereGeometry(7.2, 48, 48));
    const sunCoreMat = this.trackMaterial(
      new THREE.MeshBasicMaterial({
        map: sunSurfaceTex,
        color: 0xffffff,
      })
    );
    this.sunCoreMesh = new THREE.Mesh(sunCoreGeo, sunCoreMat);
    sunGroup.add(this.sunCoreMesh);

    // Inner Corona Shell
    const coronaInnerGeo = this.trackGeometry(
      new THREE.SphereGeometry(9.1, 36, 36)
    );
    const coronaInnerMat = this.trackMaterial(
      new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.34,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.sunCoronaInner = new THREE.Mesh(coronaInnerGeo, coronaInnerMat);
    sunGroup.add(this.sunCoronaInner);

    // Outer Corona Shell
    const coronaOuterGeo = this.trackGeometry(
      new THREE.SphereGeometry(12.6, 36, 36)
    );
    const coronaOuterMat = this.trackMaterial(
      new THREE.MeshBasicMaterial({
        color: 0xea580c,
        transparent: true,
        opacity: 0.18,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.sunCoronaOuter = new THREE.Mesh(coronaOuterGeo, coronaOuterMat);
    sunGroup.add(this.sunCoronaOuter);

    // Equatorial Solar Flare Halo Disc
    const flareTex = this.createRadialGlowTexture('#fef08a', '#f97316', '#000000');
    const flareGeo = this.trackGeometry(new THREE.PlaneGeometry(34, 34));
    const flareMat = this.trackMaterial(
      new THREE.MeshBasicMaterial({
        map: flareTex,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.sunFlareDisc = new THREE.Mesh(flareGeo, flareMat);
    this.sunFlareDisc.rotation.x = Math.PI / 2;
    sunGroup.add(this.sunFlareDisc);

    this.scene.add(sunGroup);
  }

  private buildPlanetsAndOrbits(initialSlots: PlanetSlotMetadata[]): void {
    // Fixed golden-angle initial phase offsets so all 6 planets are well-spaced and immediately visible
    const initialAngles = [0.45, 2.15, 3.85, 5.3, 1.25, 2.95];

    for (let i = 0; i < PLANET_CATALOG.length; i++) {
      const def = PLANET_CATALOG[i];
      const slotMeta = initialSlots.find((s) => s.slotId === def.slotId);
      const hasSave = Boolean(slotMeta?.hasSave);

      // Keplerian angular speed: w proportional to 1 / sqrt(R)
      const angularSpeed = 0.62 / Math.sqrt(def.orbitRadius);
      const orbitAngle = initialAngles[i % initialAngles.length];

      // 1. Equatorial Orbit Line (RingGeometry in XZ plane)
      const orbitRingGeo = this.trackGeometry(
        new THREE.RingGeometry(
          def.orbitRadius - 0.14,
          def.orbitRadius + 0.14,
          128
        )
      );
      orbitRingGeo.rotateX(-Math.PI / 2);

      const orbitRingMaterial = this.trackMaterial(
        new THREE.MeshBasicMaterial({
          color: hasSave ? 0x22d3ee : 0x64748b,
          transparent: true,
          opacity: hasSave ? 0.32 : 0.18,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      const orbitRingMesh = new THREE.Mesh(orbitRingGeo, orbitRingMaterial);
      this.scene.add(orbitRingMesh);

      // 2. Planet Pivot & Axial Tilt Groups
      const pivotGroup = new THREE.Group();
      pivotGroup.position.set(
        Math.cos(orbitAngle) * def.orbitRadius,
        0,
        Math.sin(orbitAngle) * def.orbitRadius
      );
      this.scene.add(pivotGroup);

      const tiltGroup = new THREE.Group();
      tiltGroup.rotation.z = def.axialTilt;
      pivotGroup.add(tiltGroup);

      // 3. Virgin & Colonized Materials
      const virginTextures = this.createVirginPlanetTextures(def.slotId);
      const virginMaterial = this.trackMaterial(
        new THREE.MeshStandardMaterial({
          map: virginTextures.diffuse,
          bumpMap: virginTextures.bump,
          bumpScale: 0.12,
          roughness: 0.9,
          metalness: 0.12,
          emissive: new THREE.Color(0x0f172a),
          emissiveIntensity: 0.12,
        })
      );

      const colonizedTextures = this.createColonizedPlanetTextures(
        def.planetTheme,
        def.slotId
      );
      const colonizedMaterial = this.trackMaterial(
        new THREE.MeshStandardMaterial({
          map: colonizedTextures.diffuse,
          bumpMap: colonizedTextures.bump,
          bumpScale: 0.09,
          roughnessMap: colonizedTextures.roughness,
          roughness: 0.52,
          metalness: 0.18,
          emissiveMap: colonizedTextures.emissive,
          emissive: new THREE.Color(0xffffff),
          emissiveIntensity: 0.95,
        })
      );

      const surfaceGeo = this.trackGeometry(
        new THREE.SphereGeometry(def.planetRadius, 48, 36)
      );
      const surfaceMesh = new THREE.Mesh(
        surfaceGeo,
        hasSave ? colonizedMaterial : virginMaterial
      );
      tiltGroup.add(surfaceMesh);

      // 4. Dynamic Cloud Layer (visible on Colonized Planets)
      const cloudTex = this.createCloudLayerTexture(def.planetTheme, def.slotId);
      const cloudGeo = this.trackGeometry(
        new THREE.SphereGeometry(def.planetRadius * 1.035, 40, 32)
      );
      const cloudMaterial = this.trackMaterial(
        new THREE.MeshStandardMaterial({
          map: cloudTex,
          alphaMap: cloudTex,
          transparent: true,
          opacity: hasSave ? 0.62 : 0.0,
          roughness: 0.9,
          metalness: 0.0,
          depthWrite: false,
        })
      );
      const cloudMesh = new THREE.Mesh(cloudGeo, cloudMaterial);
      cloudMesh.visible = hasSave;
      tiltGroup.add(cloudMesh);

      // 5. Atmosphere Halo Shell
      const atmoColor = this.getThemeAtmosphereColor(def.planetTheme, hasSave);
      const atmoGeo = this.trackGeometry(
        new THREE.SphereGeometry(def.planetRadius * 1.13, 36, 28)
      );
      const atmosphereMaterial = this.trackMaterial(
        new THREE.MeshBasicMaterial({
          color: atmoColor,
          transparent: true,
          opacity: hasSave ? 0.28 : 0.09,
          side: THREE.BackSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      const atmosphereMesh = new THREE.Mesh(atmoGeo, atmosphereMaterial);
      pivotGroup.add(atmosphereMesh);

      // 6. Selection / Hover Bioluminescent Pulse Shell
      const selGeo = this.trackGeometry(
        new THREE.SphereGeometry(def.planetRadius * 1.24, 32, 24)
      );
      const selectionHaloMaterial = this.trackMaterial(
        new THREE.MeshBasicMaterial({
          color: hasSave ? 0x22d3ee : 0xfbbf24,
          transparent: true,
          opacity: 0.0,
          side: THREE.BackSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      const selectionHaloMesh = new THREE.Mesh(selGeo, selectionHaloMaterial);
      pivotGroup.add(selectionHaloMesh);

      // 7. Virgin Planet Holographic Scanner Ring (Indicates colonizable world)
      const scannerGeo = this.trackGeometry(
        new THREE.RingGeometry(
          def.planetRadius * 1.32,
          def.planetRadius * 1.38,
          64
        )
      );
      scannerGeo.rotateX(-Math.PI / 2);
      const scannerMat = this.trackMaterial(
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      const virginScannerRing = new THREE.Mesh(scannerGeo, scannerMat);
      virginScannerRing.visible = !hasSave;
      pivotGroup.add(virginScannerRing);

      // 8. Planetary Rings (for Kalyx IV and Xylar VI, or subtle dust ring)
      let ringMesh: THREE.Mesh | null = null;
      if (def.hasRings) {
        const ringTex = this.createPlanetaryRingTexture(def.planetTheme);
        const innerR = def.planetRadius * 1.42;
        const outerR = def.planetRadius * 2.38;
        const ringGeo = this.trackGeometry(
          new THREE.RingGeometry(innerR, outerR, 96, 1)
        );
        // Map UVs radially so concentric ring bands render properly
        const pos = ringGeo.attributes.position;
        const uvs = ringGeo.attributes.uv;
        const v3 = new THREE.Vector3();
        for (let k = 0; k < pos.count; k++) {
          v3.fromBufferAttribute(pos, k);
          const dist = v3.length();
          const u = (dist - innerR) / (outerR - innerR);
          uvs.setXY(k, THREE.MathUtils.clamp(u, 0, 1), 0.5);
        }
        ringGeo.rotateX(-Math.PI / 2);

        const ringMat = this.trackMaterial(
          new THREE.MeshStandardMaterial({
            map: ringTex,
            alphaMap: ringTex,
            transparent: true,
            opacity: hasSave ? 0.85 : 0.38,
            side: THREE.DoubleSide,
            roughness: 0.6,
            metalness: 0.2,
            depthWrite: false,
          })
        );
        ringMesh = new THREE.Mesh(ringGeo, ringMat);
        tiltGroup.add(ringMesh);
      }

      // 9. Invisible Raycast Hit Sphere (generous radius for effortless picking)
      const hitGeo = this.trackGeometry(
        new THREE.SphereGeometry(def.planetRadius * 2.15, 16, 16)
      );
      const hitMat = this.trackMaterial(
        new THREE.MeshBasicMaterial({
          visible: false,
        })
      );
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.userData.slotId = def.slotId;
      pivotGroup.add(hitMesh);
      this.hitMeshes.push(hitMesh);

      this.planetRigs.push({
        slotId: def.slotId,
        definition: def,
        orbitAngle,
        angularSpeed,
        pivotGroup,
        tiltGroup,
        surfaceMesh,
        cloudMesh,
        atmosphereMesh,
        selectionHaloMesh,
        virginScannerRing,
        ringMesh,
        hitMesh,
        orbitRingMesh,
        orbitRingMaterial,
        virginMaterial,
        colonizedMaterial,
        cloudMaterial,
        atmosphereMaterial,
        selectionHaloMaterial,
        hasSave,
      });
    }
  }

  public syncSlots(slots: PlanetSlotMetadata[]): void {
    for (const rig of this.planetRigs) {
      const meta = slots.find((s) => s.slotId === rig.slotId);
      const nextHasSave = Boolean(meta?.hasSave);
      if (rig.hasSave !== nextHasSave) {
        rig.hasSave = nextHasSave;
        rig.surfaceMesh.material = nextHasSave
          ? rig.colonizedMaterial
          : rig.virginMaterial;
        rig.cloudMesh.visible = nextHasSave;
        rig.cloudMaterial.opacity = nextHasSave ? 0.62 : 0.0;
        rig.virginScannerRing.visible = !nextHasSave;
        rig.atmosphereMaterial.color.setHex(
          this.getThemeAtmosphereColor(rig.definition.planetTheme, nextHasSave)
        );
        rig.atmosphereMaterial.opacity = nextHasSave ? 0.28 : 0.09;
        rig.selectionHaloMaterial.color.setHex(
          nextHasSave ? 0x22d3ee : 0xfbbf24
        );
        if (rig.ringMesh) {
          const rMat = rig.ringMesh.material as THREE.MeshStandardMaterial;
          rMat.opacity = nextHasSave ? 0.85 : 0.38;
        }
      }
    }
  }

  private diveProgress = 0;

  public setPlanetDiveProgress(
    slotId: number,
    progress: number,
    snapImmediate = false
  ): void {
    this.selectedSlotId = slotId;
    this.diveProgress = THREE.MathUtils.clamp(progress, 0, 1);

    if (snapImmediate) {
      const rig = this.planetRigs.find((r) => r.slotId === slotId);
      if (rig) {
        const planetPos = rig.pivotGroup.position;
        const pRadius = rig.definition.planetRadius;
        const radialDir = planetPos.clone().normalize();
        const surfacePos = planetPos
          .clone()
          .addScaledVector(radialDir, pRadius * 1.12);
        this.currentCameraPos.copy(surfacePos);
        this.desiredCameraPos.copy(surfacePos);
        this.currentLookAt.copy(planetPos);
        this.desiredLookAt.copy(planetPos);
        this.camera.position.copy(this.currentCameraPos);
        this.camera.lookAt(this.currentLookAt);
      }
    }
  }

  public getPlanetAtmosphereInfo(slotId: number): {
    planetName: string;
    atmosphereColorHex: string;
  } {
    const rig = this.planetRigs.find((r) => r.slotId === slotId);
    if (!rig) {
      return { planetName: 'Aethel Prime', atmosphereColorHex: '#06b6d4' };
    }
    const hexNum = this.getThemeAtmosphereColor(rig.definition.planetTheme, true);
    const hexStr = '#' + hexNum.toString(16).padStart(6, '0');
    return {
      planetName: rig.definition.planetName,
      atmosphereColorHex: hexStr,
    };
  }

  public getPlanetWorldTransform(slotId: number): {
    position: THREE.Vector3;
    radius: number;
    planetName: string;
    atmosphereColorHex: string;
  } {
    const rig =
      this.planetRigs.find((r) => r.slotId === slotId) ?? this.planetRigs[0];
    if (!rig) {
      return {
        position: new THREE.Vector3(36, 0, 0),
        radius: 3.4,
        planetName: 'Aethel Prime',
        atmosphereColorHex: '#06b6d4',
      };
    }
    const r = rig.definition.orbitRadius;
    rig.pivotGroup.position.set(
      Math.cos(rig.orbitAngle) * r,
      0,
      Math.sin(rig.orbitAngle) * r
    );
    const info = this.getPlanetAtmosphereInfo(rig.slotId);
    return {
      position: rig.pivotGroup.position.clone(),
      radius: rig.definition.planetRadius,
      planetName: info.planetName,
      atmosphereColorHex: info.atmosphereColorHex,
    };
  }

  public updateForIntroCinematic(
    delta: number,
    elapsedTime: number,
    targetSlotId: number
  ): void {
    this.sunCoreMesh.rotation.y += delta * 0.14;
    const coronaPulse = 1.0 + Math.sin(elapsedTime * 2.3) * 0.045;
    this.sunCoronaInner.scale.setScalar(coronaPulse);
    this.sunCoronaOuter.scale.setScalar(
      1.0 + Math.cos(elapsedTime * 1.7) * 0.06
    );
    this.sunFlareDisc.rotation.z -= delta * 0.08;

    this.starfieldPoints.rotation.y += delta * 0.004;
    this.nebulaGroup.rotation.y -= delta * 0.003;

    for (const rig of this.planetRigs) {
      const isTarget = rig.slotId === targetSlotId;
      rig.orbitRingMesh.visible = false;
      rig.selectionHaloMesh.visible = false;
      rig.virginScannerRing.visible = false;

      if (!isTarget) {
        rig.orbitAngle += rig.angularSpeed * delta * 0.35;
        const r = rig.definition.orbitRadius;
        rig.pivotGroup.position.set(
          Math.cos(rig.orbitAngle) * r,
          0,
          Math.sin(rig.orbitAngle) * r
        );
      } else {
        // Ensure target planet shows its ocean & clouds during panspermia arrival
        rig.surfaceMesh.material = rig.colonizedMaterial;
        rig.cloudMesh.visible = true;
        rig.cloudMaterial.opacity = 0.72;
        rig.atmosphereMaterial.opacity = 0.34;
      }

      rig.surfaceMesh.rotation.y += delta * (isTarget ? 0.22 : 0.18);
      rig.cloudMesh.rotation.y += delta * (isTarget ? 0.36 : 0.25);
    }
  }

  public restoreAfterIntroCinematic(slots: PlanetSlotMetadata[]): void {
    for (const rig of this.planetRigs) {
      rig.orbitRingMesh.visible = true;
      rig.selectionHaloMesh.visible = true;
      rig.virginScannerRing.visible = !rig.hasSave;
    }
    this.syncSlots(slots);
  }

  public selectSlot(slotId: number | null): void {
    const validSlot =
      slotId !== null && slotId >= 1 && slotId <= 6 ? slotId : null;
    if (this.selectedSlotId === validSlot) return;
    this.selectedSlotId = validSlot;
    this.diveProgress = 0;
    this.onSelectionChange(this.selectedSlotId, this.hoveredSlotId);
  }

  public getSelectedSlotId(): number | null {
    return this.selectedSlotId;
  }

  public getHoveredSlotId(): number | null {
    return this.hoveredSlotId;
  }

  public handlePointerDown(
    e: PointerEvent,
    canvas: HTMLCanvasElement
  ): void {
    if (this.diveProgress > 0.01) return;
    if (e.button === 0 || e.button === 2) {
      this.isDraggingOrbit = true;
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
      this.lastDragPos = { x: e.clientX, y: e.clientY };
      this.dragMovedDistance = 0;
      canvas.style.cursor = 'grabbing';
    }
  }

  public handlePointerMove(
    e: PointerEvent,
    canvas: HTMLCanvasElement
  ): void {
    if (this.diveProgress > 0.01) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    if (this.isDraggingOrbit) {
      const dx = e.clientX - this.lastDragPos.x;
      const dy = e.clientY - this.lastDragPos.y;
      this.lastDragPos = { x: e.clientX, y: e.clientY };
      this.dragMovedDistance += Math.hypot(dx, dy);

      // Orbit the solar system perspective
      this.targetAzimuth -= dx * 0.0055;
      this.targetPolar = THREE.MathUtils.clamp(
        this.targetPolar - dy * 0.0045,
        0.38,
        1.38
      );
      canvas.style.cursor = 'grabbing';
      return;
    }

    // Perform Hover Raycast against the 6 planets
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hits = this.raycaster.intersectObjects(this.hitMeshes, false);
    const nextHovered =
      hits.length > 0 && typeof hits[0].object.userData.slotId === 'number'
        ? (hits[0].object.userData.slotId as number)
        : null;

    if (nextHovered !== this.hoveredSlotId) {
      this.hoveredSlotId = nextHovered;
      this.onSelectionChange(this.selectedSlotId, this.hoveredSlotId);
    }

    canvas.style.cursor = this.hoveredSlotId !== null ? 'pointer' : 'grab';
  }

  public handlePointerUp(
    e: PointerEvent,
    canvas: HTMLCanvasElement
  ): void {
    if (this.diveProgress > 0.01) return;
    const wasDragging = this.isDraggingOrbit;
    this.isDraggingOrbit = false;

    if (wasDragging && this.dragMovedDistance < 7 && e.button === 0) {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        this.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      }

      this.raycaster.setFromCamera(this.pointerNdc, this.camera);
      const hits = this.raycaster.intersectObjects(this.hitMeshes, false);

      if (
        hits.length > 0 &&
        typeof hits[0].object.userData.slotId === 'number'
      ) {
        const clickedSlot = hits[0].object.userData.slotId as number;
        audioManager.playButtonClick();
        this.selectSlot(clickedSlot);
      } else if (this.selectedSlotId !== null) {
        // Clicking empty space returns to the general solar system view
        audioManager.playButtonClick();
        this.selectSlot(null);
      }
    }

    canvas.style.cursor = this.hoveredSlotId !== null ? 'pointer' : 'grab';
  }

  public handleWheel(e: WheelEvent): void {
    e.preventDefault();
    if (this.diveProgress > 0.01) return;
    if (this.selectedSlotId !== null) {
      // If scrolling out markedly while focused on a planet, return to general solar system view
      if (e.deltaY > 35) {
        this.selectSlot(null);
      }
      return;
    }

    const zoomStep = e.deltaY * 0.085;
    this.targetDistance = THREE.MathUtils.clamp(
      this.targetDistance + zoomStep,
      46,
      195
    );
  }

  public update(delta: number, elapsedTime: number): void {
    // 1. Animate Central Mother Star & Corona Pulsation
    this.sunCoreMesh.rotation.y += delta * 0.14;
    const coronaPulse = 1.0 + Math.sin(elapsedTime * 2.3) * 0.045;
    this.sunCoronaInner.scale.setScalar(coronaPulse);
    this.sunCoronaOuter.scale.setScalar(
      1.0 + Math.cos(elapsedTime * 1.7) * 0.06
    );
    this.sunFlareDisc.rotation.z -= delta * 0.08;

    // Subtle rotation of starfield and nebula
    this.starfieldPoints.rotation.y += delta * 0.006;
    this.nebulaGroup.rotation.y -= delta * 0.004;

    // 2. Update Orbital Kinematics & Planet Self-Rotation
    for (const rig of this.planetRigs) {
      const isSelected = this.selectedSlotId === rig.slotId;
      const isHovered = this.hoveredSlotId === rig.slotId;

      // Freeze orbital motion during atmospheric dive so camera plunges dead-center into the planet
      const orbitTimeScale =
        isSelected && this.diveProgress > 0.01
          ? 0.0
          : isSelected
          ? 0.12
          : isHovered
          ? 0.35
          : 1.0;
      rig.orbitAngle += rig.angularSpeed * delta * orbitTimeScale;

      const r = rig.definition.orbitRadius;
      rig.pivotGroup.position.set(
        Math.cos(rig.orbitAngle) * r,
        0,
        Math.sin(rig.orbitAngle) * r
      );

      // Planet axial rotation & independent cloud vortex rotation
      rig.surfaceMesh.rotation.y += delta * (isSelected ? 0.38 : 0.26);
      rig.cloudMesh.rotation.y += delta * (isSelected ? 0.52 : 0.36);
      rig.cloudMesh.rotation.x = Math.sin(elapsedTime * 0.4 + rig.slotId) * 0.04;

      if (!rig.hasSave) {
        rig.virginScannerRing.rotation.z += delta * 0.65;
        const scanPulse = 1.0 + Math.sin(elapsedTime * 3.0 + rig.slotId) * 0.05;
        rig.virginScannerRing.scale.setScalar(scanPulse);
      }

      // Orbit Ring & Atmosphere Highlight Interpolation
      const baseOrbitOpacity = rig.hasSave ? 0.32 : 0.16;
      const targetOrbitOpacity = isSelected
        ? 0.82
        : isHovered
        ? 0.65
        : baseOrbitOpacity;
      rig.orbitRingMaterial.opacity = THREE.MathUtils.damp(
        rig.orbitRingMaterial.opacity,
        targetOrbitOpacity,
        7.5,
        delta
      );

      const targetHaloOpacity = isSelected
        ? 0.42 + Math.sin(elapsedTime * 3.8) * 0.08
        : isHovered
        ? 0.32
        : 0.0;
      rig.selectionHaloMaterial.opacity = THREE.MathUtils.damp(
        rig.selectionHaloMaterial.opacity,
        targetHaloOpacity,
        8.5,
        delta
      );
    }

    // 3. Camera Choreography (General Orbit vs. Focused Planet 3/4 Framing vs. Atmospheric Dive)
    const focusedRig =
      this.selectedSlotId !== null
        ? this.planetRigs.find((r) => r.slotId === this.selectedSlotId) ?? null
        : null;

    if (focusedRig) {
      const planetPos = focusedRig.pivotGroup.position;
      const pRadius = focusedRig.definition.planetRadius;

      // Radial outward vector from the Sun to the Planet
      const radialDir = planetPos.clone().normalize();
      // Tangent vector along the orbit so the planet sits on the left-center while the Holographic Card floats on the right
      const tangentDir = new THREE.Vector3(-radialDir.z, 0, radialDir.x);

      const viewDist = pRadius * 4.4;
      const orbitCamPos = planetPos
        .clone()
        .addScaledVector(radialDir, viewDist * 0.82)
        .addScaledVector(tangentDir, viewDist * 0.55)
        .add(new THREE.Vector3(0, pRadius * 1.45, 0));

      const orbitLookAt = planetPos
        .clone()
        .addScaledVector(tangentDir, pRadius * 0.95)
        .add(new THREE.Vector3(0, pRadius * 0.08, 0));

      if (this.diveProgress > 0.001) {
        // Smoothly plunge from orbital framing right into the planet's upper cloud layer
        const diveT = this.diveProgress * this.diveProgress;
        const atmosphereSurfacePos = planetPos
          .clone()
          .addScaledVector(radialDir, pRadius * 1.08)
          .add(new THREE.Vector3(0, pRadius * 0.12, 0));
        this.desiredCameraPos.lerpVectors(orbitCamPos, atmosphereSurfacePos, diveT);
        this.desiredLookAt.lerpVectors(orbitLookAt, planetPos, Math.min(1, diveT * 1.35));
      } else {
        this.desiredCameraPos.copy(orbitCamPos);
        this.desiredLookAt.copy(orbitLookAt);
      }
    } else {
      // Gentle cosmic auto-rotation when not dragging
      if (!this.isDraggingOrbit) {
        this.targetAzimuth += delta * 0.032;
      }

      this.orbitAzimuth = THREE.MathUtils.damp(
        this.orbitAzimuth,
        this.targetAzimuth,
        5.5,
        delta
      );
      this.orbitPolar = THREE.MathUtils.damp(
        this.orbitPolar,
        this.targetPolar,
        5.5,
        delta
      );
      this.orbitDistance = THREE.MathUtils.damp(
        this.orbitDistance,
        this.targetDistance,
        5.5,
        delta
      );

      const sinPolar = Math.sin(this.orbitPolar);
      this.desiredCameraPos.set(
        this.orbitDistance * sinPolar * Math.sin(this.orbitAzimuth),
        this.orbitDistance * Math.cos(this.orbitPolar),
        this.orbitDistance * sinPolar * Math.cos(this.orbitAzimuth)
      );
      this.desiredLookAt.set(0, 0, 0);
    }

    // Damp camera position and lookAt target smoothly
    const dampLambda =
      this.diveProgress > 0.01 ? 14.0 : focusedRig ? 5.2 : 4.8;
    this.currentCameraPos.x = THREE.MathUtils.damp(
      this.currentCameraPos.x,
      this.desiredCameraPos.x,
      dampLambda,
      delta
    );
    this.currentCameraPos.y = THREE.MathUtils.damp(
      this.currentCameraPos.y,
      this.desiredCameraPos.y,
      dampLambda,
      delta
    );
    this.currentCameraPos.z = THREE.MathUtils.damp(
      this.currentCameraPos.z,
      this.desiredCameraPos.z,
      dampLambda,
      delta
    );

    this.currentLookAt.x = THREE.MathUtils.damp(
      this.currentLookAt.x,
      this.desiredLookAt.x,
      dampLambda + 1.2,
      delta
    );
    this.currentLookAt.y = THREE.MathUtils.damp(
      this.currentLookAt.y,
      this.desiredLookAt.y,
      dampLambda + 1.2,
      delta
    );
    this.currentLookAt.z = THREE.MathUtils.damp(
      this.currentLookAt.z,
      this.desiredLookAt.z,
      dampLambda + 1.2,
      delta
    );

    this.camera.position.copy(this.currentCameraPos);
    this.camera.lookAt(this.currentLookAt);
  }

  public handleResize(width: number, height: number): void {
    this.camera.aspect = Math.max(1, width) / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  private getThemeAtmosphereColor(
    theme: PlanetTheme,
    hasSave: boolean
  ): number {
    if (!hasSave) return 0x64748b;
    switch (theme) {
      case 'oceanic':
        return 0x22d3ee;
      case 'volcanic':
        return 0xf97316;
      case 'terrene':
        return 0x10b981;
      case 'crystalline':
        return 0xa855f7;
      case 'desertic':
        return 0xf59e0b;
      case 'toxic':
        return 0x84cc16;
    }
  }

  // ============================================================================
  // PROCEDURAL CANVAS TEXTURE GENERATORS (100% Zero-External-URL Safe)
  // ============================================================================

  private createSolarSurfaceTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#ea580c');
    grad.addColorStop(0.25, '#f59e0b');
    grad.addColorStop(0.5, '#fef08a');
    grad.addColorStop(0.75, '#f59e0b');
    grad.addColorStop(1, '#ea580c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Solar convection granules & bright plasma filaments
    for (let i = 0; i < 240; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const r = 6 + Math.random() * 28;
      const g = ctx.createRadialGradient(x, y, 1, x, y, r);
      if (i % 3 === 0) {
        g.addColorStop(0, 'rgba(255, 255, 240, 0.75)');
        g.addColorStop(1, 'rgba(251, 191, 36, 0)');
      } else {
        g.addColorStop(0, 'rgba(234, 88, 12, 0.55)');
        g.addColorStop(1, 'rgba(234, 88, 12, 0)');
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = this.trackTexture(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  private createRadialGlowTexture(
    innerHex: string,
    midHex: string,
    outerHex: string
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createRadialGradient(128, 128, 8, 128, 128, 126);
    grad.addColorStop(0, innerHex);
    grad.addColorStop(0.38, midHex);
    grad.addColorStop(1, outerHex);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    const tex = this.trackTexture(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private createNebulaTexture(
    primaryHex: string,
    secondaryHex: string
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 48; i++) {
      const x = Math.random() * canvas.width;
      const y = 30 + Math.random() * (canvas.height - 60);
      const r = 35 + Math.random() * 95;
      const g = ctx.createRadialGradient(x, y, 2, x, y, r);
      g.addColorStop(0, i % 2 === 0 ? primaryHex : secondaryHex);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = this.trackTexture(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private createVirginPlanetTextures(seed: number): {
    diffuse: THREE.CanvasTexture;
    bump: THREE.CanvasTexture;
  } {
    const w = 512;
    const h = 256;
    const diffCanvas = document.createElement('canvas');
    diffCanvas.width = w;
    diffCanvas.height = h;
    const dCtx = diffCanvas.getContext('2d')!;

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = w;
    bumpCanvas.height = h;
    const bCtx = bumpCanvas.getContext('2d')!;

    // Base sterile regolith gradient
    const baseTones = [
      ['#334155', '#1e293b'],
      ['#44403c', '#292524'],
      ['#3f3f46', '#27272a'],
      ['#3b4252', '#242933'],
      ['#473c38', '#2b2320'],
      ['#374151', '#1f2937'],
    ];
    const pair = baseTones[(seed - 1) % baseTones.length];
    const grad = dCtx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, pair[1]);
    grad.addColorStop(0.5, pair[0]);
    grad.addColorStop(1, pair[1]);
    dCtx.fillStyle = grad;
    dCtx.fillRect(0, 0, w, h);

    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, w, h);

    // Deterministic pseudo-random craters and dust basins
    let s = seed * 1337;
    const rand = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };

    for (let i = 0; i < 140; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 4 + rand() * 28;

      // Diffuse crater
      dCtx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
      dCtx.lineWidth = 1.5;
      dCtx.fillStyle = 'rgba(15, 23, 42, 0.34)';
      dCtx.beginPath();
      dCtx.arc(x, y, r, 0, Math.PI * 2);
      dCtx.fill();
      dCtx.stroke();

      // Bump crater rim & pit
      bCtx.strokeStyle = '#d4d4d8';
      bCtx.lineWidth = 2;
      bCtx.fillStyle = '#3f3f46';
      bCtx.beginPath();
      bCtx.arc(x, y, r, 0, Math.PI * 2);
      bCtx.fill();
      bCtx.stroke();
    }

    const diffuse = this.trackTexture(new THREE.CanvasTexture(diffCanvas));
    diffuse.colorSpace = THREE.SRGBColorSpace;
    const bump = this.trackTexture(new THREE.CanvasTexture(bumpCanvas));
    return { diffuse, bump };
  }

  private createColonizedPlanetTextures(
    theme: PlanetTheme,
    seed: number
  ): {
    diffuse: THREE.CanvasTexture;
    bump: THREE.CanvasTexture;
    roughness: THREE.CanvasTexture;
    emissive: THREE.CanvasTexture;
  } {
    const w = 512;
    const h = 256;

    const diffCanvas = document.createElement('canvas');
    diffCanvas.width = w;
    diffCanvas.height = h;
    const dCtx = diffCanvas.getContext('2d')!;

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = w;
    bumpCanvas.height = h;
    const bCtx = bumpCanvas.getContext('2d')!;

    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = w;
    roughCanvas.height = h;
    const rCtx = roughCanvas.getContext('2d')!;

    const emiCanvas = document.createElement('canvas');
    emiCanvas.width = w;
    emiCanvas.height = h;
    const eCtx = emiCanvas.getContext('2d')!;

    const palettes: Record<
      PlanetTheme,
      {
        oceanDeep: string;
        oceanShallow: string;
        landBase: string;
        landHigh: string;
        biolum: string;
      }
    > = {
      oceanic: {
        oceanDeep: '#042f4b',
        oceanShallow: '#0891b2',
        landBase: '#0d9488',
        landHigh: '#34d399',
        biolum: '#22d3ee',
      },
      volcanic: {
        oceanDeep: '#27120b',
        oceanShallow: '#7c2d12',
        landBase: '#1c1917',
        landHigh: '#44403c',
        biolum: '#f97316',
      },
      terrene: {
        oceanDeep: '#0c4a6e',
        oceanShallow: '#0284c7',
        landBase: '#15803d',
        landHigh: '#84cc16',
        biolum: '#34d399',
      },
      crystalline: {
        oceanDeep: '#1e1b4b',
        oceanShallow: '#4338ca',
        landBase: '#6d28d9',
        landHigh: '#c084fc',
        biolum: '#e879f9',
      },
      desertic: {
        oceanDeep: '#0f766e',
        oceanShallow: '#14b8a6',
        landBase: '#b45309',
        landHigh: '#fbbf24',
        biolum: '#38bdf8',
      },
      toxic: {
        oceanDeep: '#1a2e05',
        oceanShallow: '#3f6212',
        landBase: '#3b0764',
        landHigh: '#a855f7',
        biolum: '#a3e635',
      },
    };

    const pal = palettes[theme];

    // 1. Ocean Base
    const oceanGrad = dCtx.createLinearGradient(0, 0, 0, h);
    oceanGrad.addColorStop(0, pal.oceanDeep);
    oceanGrad.addColorStop(0.5, pal.oceanShallow);
    oceanGrad.addColorStop(1, pal.oceanDeep);
    dCtx.fillStyle = oceanGrad;
    dCtx.fillRect(0, 0, w, h);

    // Smooth oceans have low bump and low roughness (shiny specular water)
    bCtx.fillStyle = '#404040';
    bCtx.fillRect(0, 0, w, h);
    rCtx.fillStyle = '#383838';
    rCtx.fillRect(0, 0, w, h);
    eCtx.fillStyle = '#000000';
    eCtx.fillRect(0, 0, w, h);

    let s = seed * 7919 + 101;
    const rand = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };

    // 2. Continents & Archipelagos
    for (let i = 0; i < 65; i++) {
      const cx = rand() * w;
      const cy = 24 + rand() * (h - 48);
      const rx = 18 + rand() * 58;
      const ry = 12 + rand() * 36;
      const rot = rand() * Math.PI;

      dCtx.save();
      dCtx.translate(cx, cy);
      dCtx.rotate(rot);
      dCtx.fillStyle = i % 3 === 0 ? pal.landHigh : pal.landBase;
      dCtx.beginPath();
      dCtx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      dCtx.fill();
      dCtx.restore();

      bCtx.save();
      bCtx.translate(cx, cy);
      bCtx.rotate(rot);
      bCtx.fillStyle = i % 3 === 0 ? '#e5e5e5' : '#a3a3a3';
      bCtx.beginPath();
      bCtx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      bCtx.fill();
      bCtx.restore();

      rCtx.save();
      rCtx.translate(cx, cy);
      rCtx.rotate(rot);
      rCtx.fillStyle = '#c8c8c8';
      rCtx.beginPath();
      rCtx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      rCtx.fill();
      rCtx.restore();
    }

    // 3. Bioluminescent Reefs / Magma Rifts / Spore Colonies (Emissive Map)
    for (let i = 0; i < 95; i++) {
      const x = rand() * w;
      const y = 20 + rand() * (h - 40);
      const r = 3 + rand() * 14;
      const g = eCtx.createRadialGradient(x, y, 0.5, x, y, r);
      g.addColorStop(0, pal.biolum);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      eCtx.fillStyle = g;
      eCtx.beginPath();
      eCtx.arc(x, y, r, 0, Math.PI * 2);
      eCtx.fill();

      // Also tint diffuse slightly with bioluminescence
      dCtx.fillStyle = g;
      dCtx.beginPath();
      dCtx.arc(x, y, r * 0.8, 0, Math.PI * 2);
      dCtx.fill();
    }

    const diffuse = this.trackTexture(new THREE.CanvasTexture(diffCanvas));
    diffuse.colorSpace = THREE.SRGBColorSpace;
    const bump = this.trackTexture(new THREE.CanvasTexture(bumpCanvas));
    const roughness = this.trackTexture(new THREE.CanvasTexture(roughCanvas));
    const emissive = this.trackTexture(new THREE.CanvasTexture(emiCanvas));
    emissive.colorSpace = THREE.SRGBColorSpace;

    return { diffuse, bump, roughness, emissive };
  }

  private createCloudLayerTexture(
    theme: PlanetTheme,
    seed: number
  ): THREE.CanvasTexture {
    const w = 512;
    const h = 256;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.clearRect(0, 0, w, h);

    const cloudColor =
      theme === 'volcanic'
        ? 'rgba(254, 215, 170, 0.65)'
        : theme === 'toxic'
        ? 'rgba(217, 249, 157, 0.65)'
        : 'rgba(240, 249, 255, 0.78)';

    let s = seed * 4099 + 17;
    const rand = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };

    for (let i = 0; i < 85; i++) {
      const x = rand() * w;
      const y = 16 + rand() * (h - 32);
      const rx = 24 + rand() * 75;
      const ry = 5 + rand() * 14;
      const g = ctx.createRadialGradient(x, y, 2, x, y, rx);
      g.addColorStop(0, cloudColor);
      g.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, ry / rx);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const tex = this.trackTexture(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private createPlanetaryRingTexture(theme: PlanetTheme): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 256, 0);
    const primary =
      theme === 'crystalline'
        ? 'rgba(192, 132, 252, 0.85)'
        : 'rgba(163, 230, 53, 0.8)';
    const secondary =
      theme === 'crystalline'
        ? 'rgba(56, 189, 248, 0.65)'
        : 'rgba(45, 212, 191, 0.6)';

    grad.addColorStop(0.0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.08, primary);
    grad.addColorStop(0.28, secondary);
    grad.addColorStop(0.42, 'rgba(0,0,0,0.06)'); // Cassini division gap
    grad.addColorStop(0.5, primary);
    grad.addColorStop(0.76, secondary);
    grad.addColorStop(0.92, primary);
    grad.addColorStop(1.0, 'rgba(0,0,0,0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 32);

    const tex = this.trackTexture(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  public dispose(): void {
    for (const geo of this.geometries) {
      geo.dispose();
    }
    for (const mat of this.materials) {
      mat.dispose();
    }
    for (const tex of this.textures) {
      tex.dispose();
    }
    this.geometries = [];
    this.materials = [];
    this.textures = [];
    this.planetRigs = [];
    this.hitMeshes = [];
  }
}
