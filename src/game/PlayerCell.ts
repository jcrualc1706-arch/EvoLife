import * as THREE from 'three';
import { GAME_CONFIG } from './config';
import {
  CellBodyShape,
  CellColorTheme,
  InputState,
  PoisonCloudHazard,
} from './types';

const _forwardDir = new THREE.Vector3();
const _knockbackDecay = new THREE.Vector3();

interface ColorPalette {
  membraneColor: number;
  membraneEmissive: number;
  boostColor: number;
  nucleusColor: number;
  nucleusEmissive: number;
  legColor: number;
}

const COLOR_THEMES: Record<CellColorTheme, ColorPalette> = {
  cyan: {
    membraneColor: 0x22d3ee,
    membraneEmissive: 0x0891b2,
    boostColor: 0x67e8f9,
    nucleusColor: 0xa7f3d0,
    nucleusEmissive: 0x10b981,
    legColor: 0x06b6d4,
  },
  emerald: {
    membraneColor: 0x34d399,
    membraneEmissive: 0x059669,
    boostColor: 0x6ee7b7,
    nucleusColor: 0xfef08a,
    nucleusEmissive: 0x84cc16,
    legColor: 0x10b981,
  },
  crimson: {
    membraneColor: 0xfb7185,
    membraneEmissive: 0xe11d48,
    boostColor: 0xfda4af,
    nucleusColor: 0xfde047,
    nucleusEmissive: 0xf97316,
    legColor: 0xf43f5e,
  },
  violet: {
    membraneColor: 0xc084fc,
    membraneEmissive: 0x7e22ce,
    boostColor: 0xd8b4fe,
    nucleusColor: 0x67e8f9,
    nucleusEmissive: 0x06b6d4,
    legColor: 0x9333ea,
  },
};

interface PooledPoisonCloud extends PoisonCloudHazard {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
}

export class PlayerCell {
  public readonly group: THREE.Group;
  public readonly position: THREE.Vector3;
  public headingAngle = 0; // Radians around Y axis (0 = facing -Z)
  public currentSpeed = 0;
  public angularVelocity = 0;
  public isBoosting = false;
  public currentScale = 1.0;
  public targetScale = 1.0;
  public cameraZoomMultiplier = 1.0;

  private bodyShape: CellBodyShape = 'fusiforme';
  private colorTheme: CellColorTheme = 'cyan';
  private isLandCreature = false;

  private readonly knockbackVelocity = new THREE.Vector3();
  private membraneMesh!: THREE.Mesh;
  private nucleusMesh!: THREE.Mesh;
  private membraneMat!: THREE.MeshPhysicalMaterial;
  private nucleusMat!: THREE.MeshStandardMaterial;
  private boostHaloMat!: THREE.MeshBasicMaterial;
  private legMat!: THREE.MeshStandardMaterial;
  private tailSegments: THREE.Mesh[] = [];
  private ciliaLeft: THREE.Mesh[] = [];
  private ciliaRight: THREE.Mesh[] = [];

  // Evolutionary 3D Part Groups (pre-allocated once, toggled via .visible)
  private evoJawGroup!: THREE.Group;
  private evoJawLeft!: THREE.Mesh;
  private evoJawRight!: THREE.Mesh;
  private evoProboscisGroup!: THREE.Group;
  private evoFlagellumGroup!: THREE.Group;
  private evoLateralTailLeft: THREE.Mesh[] = [];
  private evoLateralTailRight: THREE.Mesh[] = [];
  private evoChloroplastGroup!: THREE.Group;
  private evoArmorGroup!: THREE.Group;
  private evoSpinesGroup!: THREE.Group;
  private evoPoisonGlandGroup!: THREE.Group;
  private evoElectricGroup!: THREE.Group;
  private evoElectricNodes: THREE.Mesh[] = [];
  private evoAmphibianLegsGroup!: THREE.Group;
  private readonly amphibianLegs: THREE.Group[] = [];

  // Pre-allocated World-Space Combat & Social Effect Pools
  private readonly poisonCloudPool: PooledPoisonCloud[] = [];
  private poisonPoolCursor = 0;
  private electricWaveMesh!: THREE.Mesh;
  private electricDomeMesh!: THREE.Mesh;
  private electricWaveMat!: THREE.MeshBasicMaterial;
  private electricDomeMat!: THREE.MeshBasicMaterial;
  private electricPulseTimer = 0;
  private readonly electricPulseDuration = 0.55;
  private socialWaveMesh!: THREE.Mesh;
  private socialWaveMat!: THREE.MeshBasicMaterial;
  private socialWaveTimer = 0;

  // Pre-allocated Mating Call Acoustic Rings & Partner Cell (Spore Ritual)
  private readonly matingRingMeshes: THREE.Mesh[] = [];
  private readonly matingRingMats: THREE.MeshBasicMaterial[] = [];
  private mateCellGroup!: THREE.Group;
  private readonly mateTailSegments: THREE.Mesh[] = [];
  private readonly mateStartPos = new THREE.Vector3();
  private matingCallActive = false;
  private matingCallElapsed = 0;
  private readonly matingCallDuration = 0.9;

  private flagellumPhase = 0;
  private damageFlashTimer = 0;

  private readonly disposableGeometries: THREE.BufferGeometry[] = [];
  private readonly disposableMaterials: THREE.Material[] = [];

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.position.set(0, GAME_CONFIG.WORLD.SWIM_PLANE_Y, 0);
    this.position = this.group.position;

    this.buildProceduralCell();
    this.initCombatEffectsPool(scene);
    scene.add(this.group);
  }

  private buildProceduralCell(): void {
    // 1. Primary Silhouette: Outer translucent cytoplasmic membrane
    const membraneGeo = new THREE.CapsuleGeometry(0.95, 0.9, 16, 24);
    membraneGeo.rotateX(Math.PI / 2);
    this.membraneMat = new THREE.MeshPhysicalMaterial({
      color: 0x22d3ee,
      emissive: 0x0891b2,
      emissiveIntensity: 0.25,
      roughness: 0.18,
      metalness: 0.05,
      transmission: 0.65,
      thickness: 1.2,
      ior: 1.38,
      clearcoat: 1.0,
      clearcoatRoughness: 0.12,
      transparent: true,
      opacity: 0.88,
    });
    this.membraneMesh = new THREE.Mesh(membraneGeo, this.membraneMat);
    this.membraneMesh.castShadow = true;
    this.membraneMesh.receiveShadow = true;
    this.membraneMesh.renderOrder = 2;
    this.group.add(this.membraneMesh);

    // 2. Secondary Read: Glowing inner nucleus core
    const nucleusGeo = new THREE.IcosahedronGeometry(0.52, 2);
    this.nucleusMat = new THREE.MeshStandardMaterial({
      color: 0xa7f3d0,
      emissive: 0x10b981,
      emissiveIntensity: 0.95,
      roughness: 0.45,
      metalness: 0.2,
    });
    this.nucleusMesh = new THREE.Mesh(nucleusGeo, this.nucleusMat);
    this.nucleusMesh.position.set(0, 0, 0.1);
    this.group.add(this.nucleusMesh);

    // 3. Internal Organelles (Mitochondria / Vacuoles)
    const organelleGeo = new THREE.CapsuleGeometry(0.16, 0.28, 8, 12);
    const organelleMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.5,
      roughness: 0.35,
      metalness: 0.1,
    });

    const orgLeft = new THREE.Mesh(organelleGeo, organelleMat);
    orgLeft.position.set(-0.42, 0.12, -0.2);
    orgLeft.rotation.set(0.4, 0.5, 0.2);
    this.group.add(orgLeft);

    const orgRight = new THREE.Mesh(organelleGeo, organelleMat);
    orgRight.position.set(0.42, -0.1, -0.15);
    orgRight.rotation.set(-0.3, -0.4, 0.3);
    this.group.add(orgRight);

    // 4. Sensory Eyespots (Left & Right Sclera + Pupils facing -Z forward)
    const eyeGeo = new THREE.SphereGeometry(0.24, 16, 16);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.15,
      metalness: 0.05,
    });
    const pupilGeo = new THREE.SphereGeometry(0.12, 12, 12);
    const pupilMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.25,
      roughness: 0.1,
      metalness: 0.8,
    });

    for (const side of [-1, 1]) {
      const eyeGroup = new THREE.Group();
      eyeGroup.position.set(side * 0.44, 0.36, -1.12);

      const sclera = new THREE.Mesh(eyeGeo, eyeMat);
      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.set(side * 0.03, 0.04, -0.16);

      eyeGroup.add(sclera);
      eyeGroup.add(pupil);
      this.group.add(eyeGroup);
    }

    // 5. Lateral Cilia Fins (2 per side)
    const ciliaGeo = new THREE.ConeGeometry(0.14, 0.65, 8);
    ciliaGeo.rotateZ(Math.PI / 2);
    const ciliaMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.4,
      roughness: 0.5,
      metalness: 0.1,
    });

    for (let i = 0; i < 2; i++) {
      const zPos = -0.35 + i * 0.65;

      const leftFin = new THREE.Mesh(ciliaGeo, ciliaMat);
      leftFin.position.set(-1.05, 0, zPos);
      leftFin.rotation.y = 0.35;
      this.group.add(leftFin);
      this.ciliaLeft.push(leftFin);

      const rightFin = new THREE.Mesh(ciliaGeo, ciliaMat);
      rightFin.position.set(1.05, 0, zPos);
      rightFin.rotation.z = Math.PI;
      rightFin.rotation.y = -0.35;
      this.group.add(rightFin);
      this.ciliaRight.push(rightFin);
    }

    // 6. Articulated Flagellum Tail (4 segments trailing +Z)
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0x5eead4,
      emissive: 0x14b8a6,
      emissiveIntensity: 0.6,
      roughness: 0.4,
      metalness: 0.15,
    });

    for (let i = 0; i < 4; i++) {
      const radius = 0.24 * (1 - i * 0.18);
      const segGeo = new THREE.SphereGeometry(radius, 12, 12);
      segGeo.scale(0.85, 0.85, 1.65);
      const segMesh = new THREE.Mesh(segGeo, tailMat);
      segMesh.position.set(0, 0, 1.45 + i * 0.48);
      this.group.add(segMesh);
      this.tailSegments.push(segMesh);
      this.disposableGeometries.push(segGeo);
    }

    // 7. Underwater Contact Ring / Bioluminescent Halo beneath cell
    const haloGeo = new THREE.RingGeometry(0.95, 1.45, 32);
    haloGeo.rotateX(-Math.PI / 2);
    this.boostHaloMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const haloMesh = new THREE.Mesh(haloGeo, this.boostHaloMat);
    haloMesh.position.y = -0.95;
    this.group.add(haloMesh);

    // --- 8. EVOLUTIONARY PARTS (Hidden initially, unlocked via ADN) ---

    // 8A. mouth_jaw ("Mandíbula Aserrada"): Carnivore serrated pincers at front (-Z)
    this.evoJawGroup = new THREE.Group();
    this.evoJawGroup.visible = false;
    const jawGeo = new THREE.ConeGeometry(0.22, 0.88, 8);
    jawGeo.rotateX(-Math.PI / 2);
    jawGeo.scale(1.1, 0.65, 1.0);
    const jawMat = new THREE.MeshStandardMaterial({
      color: 0xfda4af,
      emissive: 0xe11d48,
      emissiveIntensity: 0.45,
      roughness: 0.25,
      metalness: 0.55,
    });
    this.evoJawLeft = new THREE.Mesh(jawGeo, jawMat);
    this.evoJawLeft.position.set(-0.34, -0.08, -1.52);
    this.evoJawLeft.rotation.y = -0.28;
    this.evoJawGroup.add(this.evoJawLeft);

    this.evoJawRight = new THREE.Mesh(jawGeo, jawMat);
    this.evoJawRight.position.set(0.34, -0.08, -1.52);
    this.evoJawRight.rotation.y = 0.28;
    this.evoJawGroup.add(this.evoJawRight);
    this.group.add(this.evoJawGroup);

    // 8B. mouth_proboscis ("Probóscide Succionadora"): Omnivore suction tube at front (-Z)
    this.evoProboscisGroup = new THREE.Group();
    this.evoProboscisGroup.visible = false;
    const proboscisTubeGeo = new THREE.CylinderGeometry(0.07, 0.18, 1.05, 12);
    proboscisTubeGeo.rotateX(Math.PI / 2);
    const proboscisTipGeo = new THREE.TorusGeometry(0.11, 0.04, 8, 16);
    const proboscisMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0x10b981,
      emissiveIntensity: 0.65,
      roughness: 0.22,
      metalness: 0.35,
    });
    const tubeMesh = new THREE.Mesh(proboscisTubeGeo, proboscisMat);
    tubeMesh.position.set(0, -0.04, -1.65);
    const tipMesh = new THREE.Mesh(proboscisTipGeo, proboscisMat);
    tipMesh.position.set(0, -0.04, -2.16);
    this.evoProboscisGroup.add(tubeMesh);
    this.evoProboscisGroup.add(tipMesh);
    this.group.add(this.evoProboscisGroup);

    // 8C. flagellum_2 ("Flagelo Bimotor"): Two lateral articulated flagella
    this.evoFlagellumGroup = new THREE.Group();
    this.evoFlagellumGroup.visible = false;
    const biFlagellumMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.75,
      roughness: 0.3,
      metalness: 0.2,
    });
    for (let i = 0; i < 3; i++) {
      const latRadius = 0.19 * (1 - i * 0.2);
      const latGeo = new THREE.SphereGeometry(latRadius, 10, 10);
      latGeo.scale(0.8, 0.8, 1.6);
      this.disposableGeometries.push(latGeo);

      const leftSeg = new THREE.Mesh(latGeo, biFlagellumMat);
      leftSeg.position.set(-0.55 - i * 0.08, 0, 1.3 + i * 0.42);
      this.evoFlagellumGroup.add(leftSeg);
      this.evoLateralTailLeft.push(leftSeg);

      const rightSeg = new THREE.Mesh(latGeo, biFlagellumMat);
      rightSeg.position.set(0.55 + i * 0.08, 0, 1.3 + i * 0.42);
      this.evoFlagellumGroup.add(rightSeg);
      this.evoLateralTailRight.push(rightSeg);
    }
    this.group.add(this.evoFlagellumGroup);

    // 8D. chloroplast_1 ("Cloroplastos Simbióticos"): Glowing emerald organelles inside cell
    this.evoChloroplastGroup = new THREE.Group();
    this.evoChloroplastGroup.visible = false;
    const chloroGeo = new THREE.CapsuleGeometry(0.18, 0.24, 8, 12);
    const chloroMat = new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      emissive: 0x16a34a,
      emissiveIntensity: 1.15,
      roughness: 0.25,
      metalness: 0.1,
    });
    const chloroPositions: [number, number, number, number, number][] = [
      [-0.48, 0.22, -0.55, 0.5, 0.3],
      [0.48, 0.22, -0.55, -0.5, -0.3],
      [-0.52, -0.18, 0.35, -0.4, 0.6],
      [0.52, -0.18, 0.35, 0.4, -0.6],
    ];
    for (const [cx, cy, cz, rx, rz] of chloroPositions) {
      const cMesh = new THREE.Mesh(chloroGeo, chloroMat);
      cMesh.position.set(cx, cy, cz);
      cMesh.rotation.set(rx, 0.2, rz);
      this.evoChloroplastGroup.add(cMesh);
    }
    this.group.add(this.evoChloroplastGroup);

    // 8E. membrane_armor ("Corteza Quitinizada"): Dorsal protective chitin plates
    this.evoArmorGroup = new THREE.Group();
    this.evoArmorGroup.visible = false;
    const armorPlateGeo = new THREE.DodecahedronGeometry(0.42, 0);
    armorPlateGeo.scale(1.35, 0.42, 1.1);
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x818cf8,
      emissive: 0x3730a3,
      emissiveIntensity: 0.45,
      roughness: 0.28,
      metalness: 0.55,
    });
    for (let i = 0; i < 3; i++) {
      const plate = new THREE.Mesh(armorPlateGeo, armorMat);
      const scaleStep = 1 - Math.abs(i - 1) * 0.16;
      plate.scale.setScalar(scaleStep);
      plate.position.set(0, 0.86 - Math.abs(i - 1) * 0.06, -0.55 + i * 0.55);
      this.evoArmorGroup.add(plate);
    }
    this.group.add(this.evoArmorGroup);

    // 8F. rostral_spines ("Espolones Rostrales"): Forward-pointing (-Z) sharp horns
    this.evoSpinesGroup = new THREE.Group();
    this.evoSpinesGroup.visible = false;
    const spineGeo = new THREE.ConeGeometry(0.18, 0.95, 10);
    spineGeo.rotateX(-Math.PI / 2);
    const spineMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xd97706,
      emissiveIntensity: 0.55,
      roughness: 0.2,
      metalness: 0.65,
    });
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(spineGeo, spineMat);
      horn.position.set(side * 0.62, 0.06, -1.42);
      horn.rotation.y = side * -0.16;
      this.evoSpinesGroup.add(horn);
    }
    this.group.add(this.evoSpinesGroup);

    // 8G. poison_gland ("Glándula de Veneno"): Posterior acid-green bulb & ducts at tail base (+Z)
    this.evoPoisonGlandGroup = new THREE.Group();
    this.evoPoisonGlandGroup.visible = false;
    const poisonBulbGeo = new THREE.SphereGeometry(0.36, 14, 14);
    poisonBulbGeo.scale(1.15, 0.85, 1.25);
    const poisonNozzleGeo = new THREE.CylinderGeometry(0.06, 0.12, 0.45, 8);
    poisonNozzleGeo.rotateX(Math.PI / 2);
    const poisonGlandMat = new THREE.MeshStandardMaterial({
      color: 0xa3e635,
      emissive: 0x65a30d,
      emissiveIntensity: 1.1,
      roughness: 0.22,
      metalness: 0.15,
    });
    const bulbMesh = new THREE.Mesh(poisonBulbGeo, poisonGlandMat);
    bulbMesh.position.set(0, 0.22, 1.12);
    this.evoPoisonGlandGroup.add(bulbMesh);
    for (const side of [-1, 1]) {
      const nozzle = new THREE.Mesh(poisonNozzleGeo, poisonGlandMat);
      nozzle.position.set(side * 0.28, 0.12, 1.48);
      nozzle.rotation.y = side * 0.22;
      this.evoPoisonGlandGroup.add(nozzle);
    }
    this.group.add(this.evoPoisonGlandGroup);

    // 8H. electric_cell ("Órgano Bioeléctrico"): Lateral yellow-cyan discharge antennas
    this.evoElectricGroup = new THREE.Group();
    this.evoElectricGroup.visible = false;
    const elecPylonGeo = new THREE.CylinderGeometry(0.06, 0.14, 0.58, 8);
    elecPylonGeo.rotateZ(Math.PI / 2);
    const elecOrbGeo = new THREE.OctahedronGeometry(0.22, 1);
    const elecPylonMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.85,
      roughness: 0.2,
      metalness: 0.7,
    });
    const elecOrbMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfacc15,
      emissiveIntensity: 1.5,
      roughness: 0.1,
      metalness: 0.3,
    });
    for (const side of [-1, 1]) {
      const pylon = new THREE.Mesh(elecPylonGeo, elecPylonMat);
      pylon.position.set(side * 0.96, 0.32, -0.05);
      this.evoElectricGroup.add(pylon);

      const orb = new THREE.Mesh(elecOrbGeo, elecOrbMat);
      orb.position.set(side * 1.28, 0.36, -0.05);
      this.evoElectricGroup.add(orb);
      this.evoElectricNodes.push(orb);
    }
    this.group.add(this.evoElectricGroup);

    // 8I. evoAmphibianLegsGroup: 4 Articulated Amphibian Legs with Webbed Feet (for Creature Stage)
    this.evoAmphibianLegsGroup = new THREE.Group();
    this.evoAmphibianLegsGroup.visible = false;

    const thighGeo = new THREE.CapsuleGeometry(0.16, 0.45, 8, 10);
    thighGeo.translate(0, -0.22, 0);
    const shinGeo = new THREE.CapsuleGeometry(0.13, 0.44, 8, 10);
    shinGeo.translate(0, -0.22, 0);
    const footPadGeo = new THREE.CylinderGeometry(0.28, 0.34, 0.08, 10);
    footPadGeo.scale(1.1, 1.0, 1.45);
    const toeGeo = new THREE.ConeGeometry(0.06, 0.28, 6);
    toeGeo.rotateX(-Math.PI / 2);

    this.legMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.4,
      roughness: 0.35,
      metalness: 0.15,
    });

    const legSockets: [number, number, number, number][] = [
      [-0.82, -0.22, -0.58, -1], // 0: Front-Left
      [0.82, -0.22, -0.58, 1], // 1: Front-Right
      [-0.86, -0.22, 0.56, -1], // 2: Rear-Left
      [0.86, -0.22, 0.56, 1], // 3: Rear-Right
    ];

    for (const [lx, ly, lz, side] of legSockets) {
      const legHip = new THREE.Group();
      legHip.position.set(lx, ly, lz);

      const thighMesh = new THREE.Mesh(thighGeo, this.legMat);
      thighMesh.rotation.z = side * 0.45;
      thighMesh.castShadow = true;
      legHip.add(thighMesh);

      const shinMesh = new THREE.Mesh(shinGeo, this.legMat);
      shinMesh.position.set(side * 0.24, -0.38, 0.05);
      shinMesh.rotation.z = side * -0.15;
      shinMesh.castShadow = true;
      legHip.add(shinMesh);

      const footGroup = new THREE.Group();
      footGroup.position.set(side * 0.32, -0.78, -0.06);
      const padMesh = new THREE.Mesh(footPadGeo, this.legMat);
      footGroup.add(padMesh);

      for (let t = -1; t <= 1; t++) {
        const toeMesh = new THREE.Mesh(toeGeo, this.legMat);
        toeMesh.position.set(t * 0.12, -0.01, -0.28);
        toeMesh.rotation.y = -t * 0.22;
        footGroup.add(toeMesh);
      }

      legHip.add(footGroup);
      this.evoAmphibianLegsGroup.add(legHip);
      this.amphibianLegs.push(legHip);
    }
    this.group.add(this.evoAmphibianLegsGroup);

    this.disposableGeometries.push(
      membraneGeo,
      nucleusGeo,
      organelleGeo,
      eyeGeo,
      pupilGeo,
      ciliaGeo,
      haloGeo,
      jawGeo,
      proboscisTubeGeo,
      proboscisTipGeo,
      chloroGeo,
      armorPlateGeo,
      spineGeo,
      poisonBulbGeo,
      poisonNozzleGeo,
      elecPylonGeo,
      elecOrbGeo,
      thighGeo,
      shinGeo,
      footPadGeo,
      toeGeo
    );
    this.disposableMaterials.push(
      this.membraneMat,
      this.nucleusMat,
      organelleMat,
      eyeMat,
      pupilMat,
      ciliaMat,
      tailMat,
      this.boostHaloMat,
      jawMat,
      proboscisMat,
      biFlagellumMat,
      chloroMat,
      armorMat,
      spineMat,
      poisonGlandMat,
      elecPylonMat,
      elecOrbMat,
      this.legMat
    );
  }

  private initCombatEffectsPool(scene: THREE.Scene): void {
    // 1. Pre-allocate 10 Poison Cloud spheres in world space
    const cloudGeo = new THREE.IcosahedronGeometry(1.0, 2);
    this.disposableGeometries.push(cloudGeo);

    for (let i = 0; i < 10; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x84cc16,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
      });
      this.disposableMaterials.push(mat);

      const mesh = new THREE.Mesh(cloudGeo, mat);
      mesh.visible = false;
      scene.add(mesh);

      this.poisonCloudPool.push({
        position: mesh.position,
        radius: 2.3,
        active: false,
        mesh,
        mat,
        life: 0,
        maxLife: 4.0,
      });
    }

    // 2. Pre-allocate Bioelectric Shockwave Ring & Dome (9.5m max radius)
    const waveRingGeo = new THREE.RingGeometry(0.75, 1.0, 48);
    waveRingGeo.rotateX(-Math.PI / 2);
    this.electricWaveMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.electricWaveMesh = new THREE.Mesh(waveRingGeo, this.electricWaveMat);
    this.electricWaveMesh.visible = false;
    scene.add(this.electricWaveMesh);

    const domeGeo = new THREE.SphereGeometry(1.0, 24, 16);
    domeGeo.scale(1, 0.35, 1);
    this.electricDomeMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0,
      wireframe: true,
      depthWrite: false,
    });
    this.electricDomeMesh = new THREE.Mesh(domeGeo, this.electricDomeMat);
    this.electricDomeMesh.visible = false;
    scene.add(this.electricDomeMesh);

    // 2B. Pre-allocate Socialize Harmonic Ring (KeyC in Creature Stage)
    this.socialWaveMat = new THREE.MeshBasicMaterial({
      color: 0x4ade80,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.socialWaveMesh = new THREE.Mesh(waveRingGeo, this.socialWaveMat);
    this.socialWaveMesh.visible = false;
    scene.add(this.socialWaveMesh);

    // 3. Pre-allocate Mating Call Acoustic Rings (Pink & Cyan harmonic waves)
    for (let r = 0; r < 2; r++) {
      const mat = new THREE.MeshBasicMaterial({
        color: r === 0 ? 0xf472b6 : 0x22d3ee,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ringMesh = new THREE.Mesh(waveRingGeo, mat);
      ringMesh.visible = false;
      scene.add(ringMesh);
      this.matingRingMeshes.push(ringMesh);
      this.matingRingMats.push(mat);
      this.disposableMaterials.push(mat);
    }

    // 4. Pre-allocate 3D Partner Cell ("Pareja Celular") for courtship ritual
    this.mateCellGroup = new THREE.Group();
    this.mateCellGroup.visible = false;

    const mateBodyGeo = new THREE.CapsuleGeometry(0.88, 0.82, 14, 20);
    mateBodyGeo.rotateX(Math.PI / 2);
    const mateBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xf472b6,
      emissive: 0xdb2777,
      emissiveIntensity: 0.4,
      roughness: 0.18,
      metalness: 0.05,
      transmission: 0.6,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.9,
    });
    const mateBodyMesh = new THREE.Mesh(mateBodyGeo, mateBodyMat);
    this.mateCellGroup.add(mateBodyMesh);

    const mateCoreGeo = new THREE.IcosahedronGeometry(0.46, 1);
    const mateCoreMat = new THREE.MeshStandardMaterial({
      color: 0xfbcfe8,
      emissive: 0xec4899,
      emissiveIntensity: 1.1,
      roughness: 0.3,
    });
    const mateCoreMesh = new THREE.Mesh(mateCoreGeo, mateCoreMat);
    this.mateCellGroup.add(mateCoreMesh);

    const mateEyeGeo = new THREE.SphereGeometry(0.2, 12, 12);
    const mateEyeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.4,
      roughness: 0.1,
    });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(mateEyeGeo, mateEyeMat);
      eye.position.set(side * 0.4, 0.32, -1.0);
      this.mateCellGroup.add(eye);
    }

    const mateTailGeo = new THREE.SphereGeometry(0.2, 10, 10);
    mateTailGeo.scale(0.8, 0.8, 1.5);
    for (let t = 0; t < 3; t++) {
      const seg = new THREE.Mesh(mateTailGeo, mateCoreMat);
      seg.scale.setScalar(1 - t * 0.22);
      seg.position.set(0, 0, 1.35 + t * 0.42);
      this.mateCellGroup.add(seg);
      this.mateTailSegments.push(seg);
    }

    scene.add(this.mateCellGroup);

    this.disposableGeometries.push(
      waveRingGeo,
      domeGeo,
      mateBodyGeo,
      mateCoreGeo,
      mateEyeGeo,
      mateTailGeo
    );
    this.disposableMaterials.push(
      this.electricWaveMat,
      this.electricDomeMat,
      this.socialWaveMat,
      mateBodyMat,
      mateCoreMat,
      mateEyeMat
    );
  }

  public applyMorphology(
    bodyShape: CellBodyShape,
    colorTheme: CellColorTheme,
    isLandCreature: boolean
  ): void {
    this.bodyShape = bodyShape;
    this.colorTheme = colorTheme;
    this.isLandCreature = isLandCreature;

    // 1. Adjust outer cytoplasmic membrane proportions
    if (bodyShape === 'esferico') {
      this.membraneMesh.scale.set(1.26, 1.12, 0.82);
    } else if (bodyShape === 'alargado') {
      this.membraneMesh.scale.set(0.8, 0.88, 1.28);
    } else {
      this.membraneMesh.scale.set(1.0, 1.0, 1.0);
    }

    // 2. Toggle 4 Amphibious Legs for Creature Stage
    this.evoAmphibianLegsGroup.visible = isLandCreature;

    // 3. Apply Bioluminescent Color Theme Palette
    const palette = COLOR_THEMES[colorTheme] ?? COLOR_THEMES.cyan;
    this.membraneMat.color.setHex(palette.membraneColor);
    this.membraneMat.emissive.setHex(palette.membraneEmissive);
    this.nucleusMat.color.setHex(palette.nucleusColor);
    this.nucleusMat.emissive.setHex(palette.nucleusEmissive);
    this.boostHaloMat.color.setHex(palette.membraneColor);
    this.legMat.color.setHex(palette.legColor);
    this.legMat.emissive.setHex(palette.membraneEmissive);
  }

  public triggerSocialWave(): void {
    this.socialWaveTimer = 0.65;
    this.socialWaveMesh.position.copy(this.position);
    this.socialWaveMesh.position.y = GAME_CONFIG.WORLD.SWIM_PLANE_Y - 0.2;
    this.socialWaveMesh.scale.setScalar(1.0);
    this.socialWaveMesh.visible = true;
  }

  public updateEditorIdle(delta: number, elapsedTime: number): void {
    this.currentScale = THREE.MathUtils.damp(
      this.currentScale,
      this.targetScale,
      4.0,
      delta
    );
    this.group.scale.setScalar(this.currentScale);

    // Gentle breathing and flagellum motion while inspecting in 3D Editor
    this.flagellumPhase += delta * 6.2;
    for (let i = 0; i < this.tailSegments.length; i++) {
      const seg = this.tailSegments[i];
      const wave = Math.sin(this.flagellumPhase - i * 0.85);
      const amplitude = 0.11 * (1 + i * 0.45);
      seg.position.x = wave * amplitude;
      seg.rotation.y = wave * 0.32;
    }

    if (this.evoFlagellumGroup.visible) {
      for (let i = 0; i < this.evoLateralTailLeft.length; i++) {
        const wave = Math.cos(this.flagellumPhase - i * 0.9);
        const amp = 0.09 * (1 + i * 0.35);
        this.evoLateralTailLeft[i].position.x = -0.55 - i * 0.08 + wave * amp;
        this.evoLateralTailRight[i].position.x = 0.55 + i * 0.08 - wave * amp;
      }
    }

    if (this.evoJawGroup.visible) {
      const jawSnap = Math.sin(this.flagellumPhase * 0.85) * 0.14;
      this.evoJawLeft.rotation.y = -0.25 + jawSnap;
      this.evoJawRight.rotation.y = 0.25 - jawSnap;
    }

    if (this.evoElectricGroup.visible) {
      const sparkScale = 1.0 + Math.sin(elapsedTime * 14.0) * 0.18;
      for (const orb of this.evoElectricNodes) {
        orb.scale.setScalar(sparkScale);
        orb.rotation.y += delta * 4.5;
      }
    }

    if (this.evoAmphibianLegsGroup.visible && this.amphibianLegs.length === 4) {
      const legWave = Math.sin(this.flagellumPhase * 0.65) * 0.24;
      this.amphibianLegs[0].rotation.x = legWave;
      this.amphibianLegs[1].rotation.x = -legWave;
      this.amphibianLegs[2].rotation.x = -legWave;
      this.amphibianLegs[3].rotation.x = legWave;
    }

    for (let i = 0; i < this.ciliaLeft.length; i++) {
      const flutter = Math.sin(this.flagellumPhase * 1.1 + i) * 0.24;
      this.ciliaLeft[i].rotation.y = 0.35 + flutter;
      this.ciliaRight[i].rotation.y = -0.35 - flutter;
    }

    const pulse = 1.0 + Math.sin(elapsedTime * 4.2) * 0.07;
    this.nucleusMesh.scale.setScalar(pulse);

    const palette = COLOR_THEMES[this.colorTheme] ?? COLOR_THEMES.cyan;
    this.membraneMat.color.setHex(palette.membraneColor);
    this.membraneMat.emissive.setHex(palette.membraneEmissive);
    this.membraneMat.emissiveIntensity = 0.35;
    this.boostHaloMat.color.setHex(palette.membraneColor);
    this.boostHaloMat.opacity = 0.38;
  }

  public setGrowthStage(stage: 1 | 2 | 3): void {
    if (stage === 3) {
      this.targetScale = 1.62;
      this.cameraZoomMultiplier = 1.45;
    } else if (stage === 2) {
      this.targetScale = 1.3;
      this.cameraZoomMultiplier = 1.22;
    } else {
      this.targetScale = 1.0;
      this.cameraZoomMultiplier = 1.0;
    }
  }

  public startMatingCall(): void {
    this.matingCallActive = true;
    this.matingCallElapsed = 0;

    // Position the Partner Cell 11m away ahead-right of the player cell so it swims in visibly
    const spawnAngle = this.headingAngle + 0.55;
    const dist = 10.5 * this.currentScale;
    this.mateStartPos.set(
      this.position.x - Math.sin(spawnAngle) * dist,
      GAME_CONFIG.WORLD.SWIM_PLANE_Y,
      this.position.z - Math.cos(spawnAngle) * dist
    );
    this.mateCellGroup.position.copy(this.mateStartPos);
    this.mateCellGroup.scale.setScalar(this.currentScale * 0.95);
    this.mateCellGroup.visible = true;

    for (const ring of this.matingRingMeshes) {
      ring.position.set(
        this.position.x,
        GAME_CONFIG.WORLD.SWIM_PLANE_Y - 0.15,
        this.position.z
      );
      ring.scale.setScalar(1.0);
      ring.visible = true;
    }
  }

  public hideMateCell(): void {
    this.matingCallActive = false;
    this.matingCallElapsed = 0;
    this.mateCellGroup.visible = false;
    for (const ring of this.matingRingMeshes) {
      ring.visible = false;
    }
  }

  public spawnPoisonCloud(): void {
    const cloud = this.poisonCloudPool[this.poisonPoolCursor % this.poisonCloudPool.length];
    this.poisonPoolCursor++;

    // Spawn behind the cell (+Z local direction)
    const backDist = 2.1 * this.currentScale;
    const backX = Math.sin(this.headingAngle) * backDist;
    const backZ = Math.cos(this.headingAngle) * backDist;

    cloud.position.set(
      this.position.x + backX + (Math.random() - 0.5) * 0.5,
      GAME_CONFIG.WORLD.SWIM_PLANE_Y,
      this.position.z + backZ + (Math.random() - 0.5) * 0.5
    );
    cloud.radius = 2.35 * this.currentScale;
    cloud.life = 4.0;
    cloud.maxLife = 4.0;
    cloud.active = true;
    cloud.mesh.visible = true;
    cloud.mesh.scale.setScalar(0.7 * this.currentScale);
    cloud.mat.opacity = 0.48;
  }

  public triggerElectricPulse(): void {
    this.electricPulseTimer = this.electricPulseDuration;
    this.electricWaveMesh.position.copy(this.position);
    this.electricWaveMesh.position.y = GAME_CONFIG.WORLD.SWIM_PLANE_Y - 0.2;
    this.electricWaveMesh.scale.setScalar(1.0);
    this.electricWaveMesh.visible = true;

    this.electricDomeMesh.position.copy(this.position);
    this.electricDomeMesh.scale.setScalar(1.0);
    this.electricDomeMesh.visible = true;
  }

  public getActivePoisonClouds(): readonly PoisonCloudHazard[] {
    return this.poisonCloudPool;
  }

  public syncEvolutionParts(unlockedIds: Set<string>): void {
    this.evoJawGroup.visible = unlockedIds.has('mouth_jaw');
    this.evoProboscisGroup.visible = unlockedIds.has('mouth_proboscis');
    this.evoFlagellumGroup.visible = unlockedIds.has('flagellum_2');
    this.evoChloroplastGroup.visible = unlockedIds.has('chloroplast_1');
    this.evoArmorGroup.visible = unlockedIds.has('membrane_armor');
    this.evoSpinesGroup.visible = unlockedIds.has('rostral_spines');
    this.evoPoisonGlandGroup.visible = unlockedIds.has('poison_gland');
    this.evoElectricGroup.visible = unlockedIds.has('electric_cell');
  }

  public applyDamageKnockback(fromPosition: THREE.Vector3, strength = 15): void {
    _knockbackDecay.subVectors(this.position, fromPosition);
    _knockbackDecay.y = 0;
    if (_knockbackDecay.lengthSq() < 0.001) {
      _knockbackDecay.set(0, 0, 1);
    } else {
      _knockbackDecay.normalize();
    }
    this.knockbackVelocity.copy(_knockbackDecay).multiplyScalar(strength);
    this.damageFlashTimer = 0.42;
  }

  public update(
    delta: number,
    elapsedTime: number,
    input: InputState,
    canBoost: boolean,
    speedMultiplier = 1.0,
    turnMultiplier = 1.0
  ): { isMoving: boolean; isBoosting: boolean } {
    // 0. Smoothly interpolate 3-level cellular growth scale (1.0x -> 1.3x -> 1.62x)
    this.currentScale = THREE.MathUtils.damp(
      this.currentScale,
      this.targetScale,
      3.5,
      delta
    );
    this.group.scale.setScalar(this.currentScale);

    // 1. Smooth angular turning (A / D)
    let targetTurnRate = 0;
    const effectiveTurnSpeed = GAME_CONFIG.PLAYER.TURN_SPEED * turnMultiplier;
    if (input.left) targetTurnRate += effectiveTurnSpeed;
    if (input.right) targetTurnRate -= effectiveTurnSpeed;

    this.angularVelocity = THREE.MathUtils.damp(
      this.angularVelocity,
      targetTurnRate,
      GAME_CONFIG.PLAYER.TURN_DAMPING,
      delta
    );
    this.headingAngle += this.angularVelocity * delta;

    // 2. Smooth forward/backward thrust (W / S) + Space Boost
    this.isBoosting = input.boost && canBoost;

    const maxForward = GAME_CONFIG.PLAYER.MAX_FORWARD_SPEED * speedMultiplier;
    const maxReverse = GAME_CONFIG.PLAYER.MAX_REVERSE_SPEED * speedMultiplier;

    let targetSpeed = 0;
    if (input.forward) {
      targetSpeed = maxForward;
    } else if (input.backward) {
      targetSpeed = -maxReverse;
    }

    if (this.isBoosting) {
      const baseBoostSpeed = input.backward ? -maxReverse : maxForward;
      targetSpeed = baseBoostSpeed * GAME_CONFIG.PLAYER.BOOST_MULTIPLIER;
    }

    const dampingLambda =
      Math.abs(targetSpeed) > 0.01
        ? GAME_CONFIG.PLAYER.ACCELERATION_DAMPING
        : GAME_CONFIG.PLAYER.WATER_DRAG_DAMPING;

    this.currentSpeed = THREE.MathUtils.damp(
      this.currentSpeed,
      targetSpeed,
      dampingLambda,
      delta
    );

    // 3. Apply forward velocity + decaying knockback velocity
    _forwardDir.set(-Math.sin(this.headingAngle), 0, -Math.cos(this.headingAngle));
    this.position.addScaledVector(_forwardDir, this.currentSpeed * delta);

    if (this.knockbackVelocity.lengthSq() > 0.01) {
      this.position.addScaledVector(this.knockbackVelocity, delta);
      this.knockbackVelocity.x = THREE.MathUtils.damp(
        this.knockbackVelocity.x,
        0,
        6.5,
        delta
      );
      this.knockbackVelocity.z = THREE.MathUtils.damp(
        this.knockbackVelocity.z,
        0,
        6.5,
        delta
      );
    }

    // 4. Soft arena boundary containment
    const distSq =
      this.position.x * this.position.x + this.position.z * this.position.z;
    const maxRadius = GAME_CONFIG.WORLD.ARENA_RADIUS - 1.5;
    if (distSq > maxRadius * maxRadius) {
      const dist = Math.sqrt(distSq);
      this.position.x = (this.position.x / dist) * maxRadius;
      this.position.z = (this.position.z / dist) * maxRadius;
      this.currentSpeed *= 0.75;
    }

    // Gentle vertical buoyancy or terrestrial stride bounce
    const speedRatio = Math.min(
      Math.abs(this.currentSpeed) / GAME_CONFIG.PLAYER.MAX_FORWARD_SPEED,
      2.5
    );
    const swimFreq = 5.5 + speedRatio * 10.5 + (this.isBoosting ? 8.0 : 0);
    this.flagellumPhase += delta * swimFreq;

    if (this.isLandCreature) {
      const strideBounce =
        Math.abs(Math.sin(this.flagellumPhase * 0.9)) *
        0.22 *
        Math.min(1, speedRatio * 1.4);
      this.position.y = GAME_CONFIG.WORLD.SWIM_PLANE_Y + strideBounce;
    } else {
      this.position.y =
        GAME_CONFIG.WORLD.SWIM_PLANE_Y + Math.sin(elapsedTime * 2.4) * 0.16;
    }

    // 5. Apply rotation + subtle banking tilt when turning
    const bankAngle = THREE.MathUtils.clamp(
      -this.angularVelocity * 0.12,
      -0.28,
      0.28
    );
    this.group.rotation.set(0, this.headingAngle, bankAngle);

    // 6. Animate procedural flagellum, lateral flagella, amphibian legs, jaws, electric nodes, cilia, and nucleus
    for (let i = 0; i < this.tailSegments.length; i++) {
      const seg = this.tailSegments[i];
      const wave = Math.sin(this.flagellumPhase - i * 0.85);
      const amplitude = (0.1 + speedRatio * 0.14) * (1 + i * 0.45);
      seg.position.x = wave * amplitude;
      seg.rotation.y = wave * 0.35;
    }

    // 6B. Quadruped Amphibian Gait Cycle (Diagonal pairs when moving in Creature Stage)
    if (this.evoAmphibianLegsGroup.visible && this.amphibianLegs.length === 4) {
      const strideAmp = 0.12 + Math.min(0.68, speedRatio * 0.55);
      const strideWave = Math.sin(this.flagellumPhase * 0.9) * strideAmp;
      // Front-Left (0) & Rear-Right (3) in phase; Front-Right (1) & Rear-Left (2) opposite phase
      this.amphibianLegs[0].rotation.x = strideWave;
      this.amphibianLegs[1].rotation.x = -strideWave;
      this.amphibianLegs[2].rotation.x = -strideWave;
      this.amphibianLegs[3].rotation.x = strideWave;
    }

    if (this.evoFlagellumGroup.visible) {
      for (let i = 0; i < this.evoLateralTailLeft.length; i++) {
        const wave = Math.cos(this.flagellumPhase - i * 0.9);
        const amp = (0.08 + speedRatio * 0.12) * (1 + i * 0.35);
        this.evoLateralTailLeft[i].position.x = -0.55 - i * 0.08 + wave * amp;
        this.evoLateralTailRight[i].position.x = 0.55 + i * 0.08 - wave * amp;
      }
    }

    if (this.evoJawGroup.visible) {
      const jawSnap = Math.sin(this.flagellumPhase * 0.85) * 0.16;
      this.evoJawLeft.rotation.y = -0.25 + jawSnap;
      this.evoJawRight.rotation.y = 0.25 - jawSnap;
    }

    if (this.evoElectricGroup.visible) {
      const sparkScale = 1.0 + Math.sin(elapsedTime * 18.0) * 0.22;
      for (const orb of this.evoElectricNodes) {
        orb.scale.setScalar(sparkScale);
        orb.rotation.y += delta * 6.0;
        orb.rotation.z += delta * 4.5;
      }
    }

    for (let i = 0; i < this.ciliaLeft.length; i++) {
      const flutter = Math.sin(this.flagellumPhase * 1.2 + i) * 0.28;
      this.ciliaLeft[i].rotation.y = 0.35 + flutter;
      this.ciliaRight[i].rotation.y = -0.35 - flutter;
    }

    // 7. Update Pooled Poison Clouds
    for (let i = 0; i < this.poisonCloudPool.length; i++) {
      const cloud = this.poisonCloudPool[i];
      if (!cloud.active) continue;

      cloud.life -= delta;
      if (cloud.life <= 0) {
        cloud.active = false;
        cloud.mesh.visible = false;
        continue;
      }

      const progress = 1 - cloud.life / cloud.maxLife;
      const currentScale = (0.85 + progress * 1.65) * this.currentScale;
      cloud.radius = currentScale * 1.05;
      cloud.mesh.scale.set(currentScale, currentScale * 0.55, currentScale);
      cloud.mesh.rotation.y += delta * 0.8;
      cloud.mat.opacity = (1 - progress) * 0.45;
    }

    // 8. Update Bioelectric Shockwave Pulse (expands to 9.5m)
    if (this.electricPulseTimer > 0) {
      this.electricPulseTimer = Math.max(0, this.electricPulseTimer - delta);
      const t = 1 - this.electricPulseTimer / this.electricPulseDuration;
      const currentRadius = 1.2 + t * 8.3; // Reaches 9.5m
      this.electricWaveMesh.position.x = this.position.x;
      this.electricWaveMesh.position.z = this.position.z;
      this.electricWaveMesh.scale.setScalar(currentRadius);
      this.electricWaveMat.opacity = (1 - t) * 0.85;

      this.electricDomeMesh.position.copy(this.position);
      this.electricDomeMesh.scale.setScalar(currentRadius);
      this.electricDomeMesh.rotation.y += delta * 8.0;
      this.electricDomeMat.opacity = (1 - t) * 0.55;

      if (this.electricPulseTimer <= 0) {
        this.electricWaveMesh.visible = false;
        this.electricDomeMesh.visible = false;
      }
    }

    // 8A-2. Update Socialize Harmonic Wave Ring
    if (this.socialWaveTimer > 0) {
      this.socialWaveTimer = Math.max(0, this.socialWaveTimer - delta);
      const t = 1 - this.socialWaveTimer / 0.65;
      const radius = 1.1 + t * 8.4;
      this.socialWaveMesh.position.x = this.position.x;
      this.socialWaveMesh.position.z = this.position.z;
      this.socialWaveMesh.scale.setScalar(radius);
      this.socialWaveMat.opacity = (1 - t) * 0.85;
      if (this.socialWaveTimer <= 0) {
        this.socialWaveMesh.visible = false;
      }
    }

    // 8B. Update Mating Call Acoustic Waves & Partner Cell Approach
    if (this.matingCallActive) {
      this.matingCallElapsed = Math.min(
        this.matingCallDuration,
        this.matingCallElapsed + delta
      );
      const progress = this.matingCallElapsed / this.matingCallDuration;

      for (let r = 0; r < this.matingRingMeshes.length; r++) {
        const ringProgress = (progress + r * 0.45) % 1.0;
        const ringScale = (1.1 + ringProgress * 7.5) * this.currentScale;
        const ring = this.matingRingMeshes[r];
        ring.position.set(
          this.position.x,
          GAME_CONFIG.WORLD.SWIM_PLANE_Y - 0.12,
          this.position.z
        );
        ring.scale.setScalar(ringScale);
        this.matingRingMats[r].opacity = (1 - ringProgress) * 0.85;
      }

      // Target companion position right alongside the player cell
      const targetOffsetDist = 2.4 * this.currentScale;
      const targetX =
        this.position.x + Math.cos(this.headingAngle) * targetOffsetDist;
      const targetZ =
        this.position.z - Math.sin(this.headingAngle) * targetOffsetDist;

      const smoothT = 1 - Math.pow(1 - progress, 2.4);
      this.mateCellGroup.position.x = THREE.MathUtils.lerp(
        this.mateStartPos.x,
        targetX,
        smoothT
      );
      this.mateCellGroup.position.z = THREE.MathUtils.lerp(
        this.mateStartPos.z,
        targetZ,
        smoothT
      );
      this.mateCellGroup.position.y =
        GAME_CONFIG.WORLD.SWIM_PLANE_Y + Math.sin(elapsedTime * 5.0) * 0.14;

      const dxToPlayer = this.position.x - this.mateCellGroup.position.x;
      const dzToPlayer = this.position.z - this.mateCellGroup.position.z;
      this.mateCellGroup.rotation.set(
        0,
        Math.atan2(-dxToPlayer, -dzToPlayer),
        0
      );
      this.mateCellGroup.scale.setScalar(this.currentScale * 0.94);

      for (let t = 0; t < this.mateTailSegments.length; t++) {
        this.mateTailSegments[t].position.x =
          Math.sin(elapsedTime * 18.0 - t * 0.9) * 0.18;
      }
    }

    // Nucleus breathing pulse & damage flash feedback
    const pulse = 1.0 + Math.sin(elapsedTime * 4.2) * 0.07;
    this.nucleusMesh.scale.setScalar(pulse);

    const palette = COLOR_THEMES[this.colorTheme] ?? COLOR_THEMES.cyan;

    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer = Math.max(0, this.damageFlashTimer - delta);
      this.membraneMat.color.setHex(0xf43f5e);
      this.membraneMat.emissive.setHex(0xe11d48);
      this.membraneMat.emissiveIntensity = 0.9;
    } else if (this.matingCallActive) {
      this.membraneMat.color.setHex(0xf472b6);
      this.membraneMat.emissive.setHex(0xec4899);
      this.membraneMat.emissiveIntensity = 0.7;
      this.boostHaloMat.opacity = 0.75;
      this.boostHaloMat.color.setHex(0xf472b6);
    } else if (this.isBoosting) {
      this.membraneMat.color.setHex(palette.boostColor);
      this.membraneMat.emissive.setHex(palette.membraneColor);
      this.membraneMat.emissiveIntensity = 0.65;
      this.boostHaloMat.opacity = 0.65;
      this.boostHaloMat.color.setHex(palette.boostColor);
    } else {
      this.membraneMat.color.setHex(palette.membraneColor);
      this.membraneMat.emissive.setHex(palette.membraneEmissive);
      this.membraneMat.emissiveIntensity = 0.25;
      this.boostHaloMat.opacity = 0.26;
      this.boostHaloMat.color.setHex(palette.membraneColor);
    }

    const isMoving =
      input.forward ||
      input.backward ||
      input.left ||
      input.right ||
      Math.abs(this.currentSpeed) > 0.6;

    return {
      isMoving,
      isBoosting: this.isBoosting,
    };
  }

  public reset(): void {
    this.position.set(0, GAME_CONFIG.WORLD.SWIM_PLANE_Y, 0);
    this.headingAngle = 0;
    this.currentSpeed = 0;
    this.angularVelocity = 0;
    this.isBoosting = false;
    this.currentScale = 1.0;
    this.targetScale = 1.0;
    this.cameraZoomMultiplier = 1.0;
    this.group.scale.setScalar(1.0);
    this.knockbackVelocity.set(0, 0, 0);
    this.damageFlashTimer = 0;
    this.group.rotation.set(0, 0, 0);
    this.evoJawGroup.visible = false;
    this.evoProboscisGroup.visible = false;
    this.evoFlagellumGroup.visible = false;
    this.evoChloroplastGroup.visible = false;
    this.evoArmorGroup.visible = false;
    this.evoSpinesGroup.visible = false;
    this.evoPoisonGlandGroup.visible = false;
    this.evoElectricGroup.visible = false;
    this.applyMorphology('fusiforme', 'cyan', false);

    for (const cloud of this.poisonCloudPool) {
      cloud.active = false;
      cloud.life = 0;
      cloud.mesh.visible = false;
    }
    this.electricPulseTimer = 0;
    this.electricWaveMesh.visible = false;
    this.electricDomeMesh.visible = false;
    this.socialWaveTimer = 0;
    this.socialWaveMesh.visible = false;
    this.hideMateCell();
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
